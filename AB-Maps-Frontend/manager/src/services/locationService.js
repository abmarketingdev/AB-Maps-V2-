import { API_CONFIG } from '../config/apiConfig';

class LocationService {
  constructor() {
    this.isTracking = false;
    this.intervalId = null;
    this.websocket = null;
    this.token = null;
    this.employee = null;
    this.updateInterval = 30000; // 30 seconds
    this.lastLocation = null;
    this.locationQueue = [];
    this.isOnline = false;
    this.permissionStatus = 'unknown';
    this.listeners = new Map();
    this.retryAttempts = 0;
    this.maxRetryAttempts = 5;
    this.isRequestingPermission = false; // Flag to prevent multiple simultaneous requests
    this.lastFetchLocation = null;
    this.DISTANCE_THRESHOLD_M = 500;
    
    // Smart watch fields
    this.watchId = null;
    this.sampleRing = [];        // recent accepted fixes
    this.maxSamples = 8;         // smoothing window
    this.minAcceptAcc = 30;      // meters: update UI when accuracy <= this
    this.dropAcc = 60;           // meters: ignore fix if accuracy > this
  }

  /**
   * Initialize location service
   * @param {string} token - JWT token for authentication
   * @param {Object} employee - Employee data
   */
  async initialize(token, employee) {
    this.token = token;
    this.employee = employee;
    console.log('LocationService: Initializing with employee:', employee?.name);
    // Do NOT check location permission or initialize WebSocket here
    // Only do so after permission is granted
  }

  async checkLocationPermission() {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      this.permissionStatus = 'unsupported';
      this.notifyListeners('permission_error', { error: 'Geolocation not supported' });
      return;
    }
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        this.permissionStatus = perm.state;
        perm.onchange = () => {
          this.permissionStatus = perm.state;
          this.notifyListeners('permission_changed', { status: perm.state });
          if (perm.state === 'granted') this.startTracking();
          else if (perm.state === 'denied') this.stopTracking();
        };
      } catch (e) {
        console.error('Permission check error', e);
        this.permissionStatus = 'error';
      }
    }
  }

  async requestLocationPermission() {
    // Prevent multiple simultaneous permission requests
    if (this.isRequestingPermission) {
      console.log('Permission request already in progress, waiting...');
      return new Promise((resolve, reject) => {
        // Wait for the current request to complete
        const checkInterval = setInterval(() => {
          if (!this.isRequestingPermission) {
            clearInterval(checkInterval);
            if (this.permissionStatus === 'granted') {
              resolve(this.lastLocation);
            } else {
              reject(new Error('Permission request failed'));
            }
          }
        }, 100);
      });
    }

    this.isRequestingPermission = true;
    
    return new Promise((resolve, reject) => {
      console.log('[LocationService] Requesting location permission...');
      
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        const error = new Error('Geolocation not supported');
        this.permissionStatus = 'unsupported';
        this.isRequestingPermission = false;
        this.notifyListeners('permission_denied', { error: error.message });
        reject(error);
        return;
      }
      
      // IMPORTANT: Do NOT check permission status before calling getCurrentPosition
      // The browser prompt is asynchronous, and checking permission status before
      // the user responds causes a race condition. getCurrentPosition() will handle
      // the permission prompt correctly and return the appropriate error if denied.
      // Directly call getCurrentPosition - it will trigger the browser prompt if needed
      this.getCurrentLocationWithTimeout(resolve, reject, 0);
    });
  }
  
  getCurrentLocationWithTimeout(resolve, reject, retryCount = 0) {
    const maxRetries = 2;
    const timeout = 20000; // Increased from 10s to 20s for better GPS acquisition
    
    console.log(`[LocationService] Attempting to get location (attempt ${retryCount + 1}/${maxRetries + 1})...`);
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('[LocationService] ✅ Location permission granted, position received:', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date(pos.timestamp).toISOString()
        });
        this.permissionStatus = 'granted';
        this.lastLocation = this.formatLocation(pos);
        this.isRequestingPermission = false;
        this.notifyListeners('permission_granted', { location: this.lastLocation });
        // Emit a location update so listeners (map) can load nearby data
        try { this.handleLocationUpdate(this.lastLocation); } catch {}
        resolve(this.lastLocation);
      },
      (err) => {
        console.error('[LocationService] ❌ Location error:', {
          code: err.code,
          message: err.message,
          attempt: retryCount + 1,
          errorType: this.getErrorType(err.code)
        });
        
        const errorType = this.getErrorType(err.code);
        const msg = this.getLocationErrorMessage(err);

        const handleAsPermissionDenied = () => {
          this.permissionStatus = 'denied';
          this.isRequestingPermission = false;
          this.notifyListeners('permission_denied', { error: msg });
          reject(new Error(msg));
        };

        const handleAsTransientLocationError = () => {
          // Permission may still be granted; do NOT flip to denied here.
          this.isRequestingPermission = false;
          this.notifyListeners('location_error', { error: msg });
          reject(new Error(msg));
        };
        
        // Only treat PERMISSION_DENIED as a permission issue when Permissions API agrees.
        // Timeout and Position Unavailable are GPS issues, not permission issues
        if (errorType === 'PERMISSION_DENIED') {
          if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions
              .query({ name: 'geolocation' })
              .then((perm) => {
                console.log('[LocationService] Permissions API state AFTER error:', perm.state);
                if (perm.state === 'denied' || perm.state === 'prompt') {
                  // Browser really considers permission denied or not granted yet.
                  handleAsPermissionDenied();
                } else {
                  // Permissions API says granted, but we still got code 1.
                  // Treat this as a transient location error, not a hard permission denial.
                  console.warn('[LocationService] Geolocation error code=1 but Permissions API says', perm.state, '- treating as transient location error, not permission denial');
                  handleAsTransientLocationError();
                }
              })
              .catch((e) => {
                console.warn('[LocationService] Permissions API query failed (post-error):', e);
                handleAsPermissionDenied();
              });
          } else {
            handleAsPermissionDenied();
          }
          return;
        }
        
        // For timeout and position unavailable, retry if we haven't exceeded max retries
        if (retryCount < maxRetries && (errorType === 'TIMEOUT' || errorType === 'POSITION_UNAVAILABLE')) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[LocationService] ⏳ Retrying in ${delay}ms (${errorType})...`);
          setTimeout(() => {
            this.getCurrentLocationWithTimeout(resolve, reject, retryCount + 1);
          }, delay);
          return;
        }
        
        // All retries exhausted or other error
        // Don't mark as "denied" for timeout/position unavailable - permission might be granted
        if (errorType === 'TIMEOUT' || errorType === 'POSITION_UNAVAILABLE') {
          // Permission might be granted, but GPS failed
          // Check actual permission status
          if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
              console.log('[LocationService] Permission status after GPS failure:', permissionStatus.state);
              if (permissionStatus.state === 'granted') {
                // Permission is granted, but GPS failed - don't mark as denied
                this.permissionStatus = 'granted';
                this.isRequestingPermission = false;
                this.notifyListeners('permission_granted', { location: null });
                reject(new Error(msg)); // Still reject, but with accurate error message
              } else {
                this.permissionStatus = 'denied';
                this.isRequestingPermission = false;
                this.notifyListeners('permission_denied', { error: msg });
                reject(new Error(msg));
              }
            }).catch(() => {
              // Can't check permission, assume it might be granted but GPS failed
              this.permissionStatus = 'prompt';
              this.isRequestingPermission = false;
              reject(new Error(msg));
            });
          } else {
            // Can't check permission, assume it might be granted but GPS failed
            this.permissionStatus = 'prompt';
            this.isRequestingPermission = false;
            reject(new Error(msg));
          }
        } else {
          // Unknown error
          this.permissionStatus = 'denied';
          this.isRequestingPermission = false;
          this.notifyListeners('permission_denied', { error: msg });
          reject(new Error(msg));
        }
      },
      { enableHighAccuracy: true, timeout: timeout, maximumAge: 0 }
    );
  }
  
  getErrorType(errorCode) {
    switch (errorCode) {
      case 1: return 'PERMISSION_DENIED';
      case 2: return 'POSITION_UNAVAILABLE';
      case 3: return 'TIMEOUT';
      default: return 'UNKNOWN';
    }
  }

  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = this.formatLocation(pos);
          // Emit a location update so listeners (map) can load nearby data
          try { this.handleLocationUpdate(loc); } catch {}
          resolve(loc);
        },
        (err) => reject(new Error(this.getLocationErrorMessage(err))),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    });
  }

  formatLocation(pos) {
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: new Date(pos.timestamp).toISOString(),
      device_id: this.employee ? `employee_${this.employee.id}` : 'unknown'
    };
  }

  handleLocationUpdate(location) {
    this.lastLocation = location;
    this.notifyListeners('location_updated', { location });
    // Removed duplicate API calls - useMapState.js handles nearby address fetching
    if (this.isOnline && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendLocationUpdate(location);
    } else {
      this.locationQueue.push(location);
      this.notifyListeners('location_queued', { location });
    }
  }

  calculateDistance(a, b) {
    const R = 6371e3;
    const φ1 = a.latitude * Math.PI/180;
    const φ2 = b.latitude * Math.PI/180;
    const Δφ = (b.latitude - a.latitude) * Math.PI/180;
    const Δλ = (b.longitude - a.longitude) * Math.PI/180;
    const x = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  // Removed fetchNearbyIfNeeded method to prevent duplicate API calls
  // useMapState.js now handles all nearby address fetching

  getLocationErrorMessage(err) {
    switch (err.code) {
      case 1: return 'Location access denied by browser';
      case 2: return 'Unable to determine your location. Please check GPS settings.';
      case 3: return 'Getting your location is taking longer than expected. Please try again.';
      default: return 'Unknown error occurred while getting location';
    }
  }

  // DEV ONLY: inject a fake location for testing over insecure HTTP
  injectTestLocation(lat, lon) {
    const loc = {
      latitude: lat,
      longitude: lon,
      accuracy: 15,
      altitude: null,
      heading: null,
      speed: null,
      timestamp: new Date().toISOString(),
      device_id: 'dev_test'
    };
    this.permissionStatus = 'granted';
    this.isTracking = true;
    this.handleLocationUpdate(loc);
    this.notifyListeners('permission_granted', { location: loc });
    this.notifyListeners('tracking_started', {});
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
  }

  off(event, cb) {
    this.listeners.get(event)?.delete(cb);
  }

  notifyListeners(event, data) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  getStatus() {
    return { isTracking: this.isTracking, isOnline: this.isOnline, permissionStatus: this.permissionStatus, lastLocation: this.lastLocation };
  }

  async startTracking() {
    if (this.isTracking) return;

    // FIX #1: Do NOT call requestLocationPermission() from here.
    // startTracking should only be called once permission has already been
    // granted by higher-level code (e.g. App.handleRequestPermission or
    // the Permissions API onchange handler). Calling requestLocationPermission()
    // again from here caused double permission prompts and race conditions.
    if (this.permissionStatus !== 'granted') {
      console.warn('[LocationService] startTracking called without granted permission; aborting.');
      return;
    }

    this.isTracking = true;
    console.log('[LocationService] 🚀 Starting smart watch tracking (continuous GPS)');
    this.notifyListeners('tracking_started');

    // Start a continuous watch — keeps GPS warm and improves accuracy quickly
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onFix(pos),
      (err) => this._onFixError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 0,   // do NOT use cached fixes
        timeout: 15000
      }
    );

    // Also start a 15-second interval to ensure regular updates are sent
    // This ensures the manager gets updates even if GPS accuracy is poor
    this.updateInterval = setInterval(() => {
      if (this.lastLocation) {
        console.log('[LocationService] ⏰ 15-second interval: sending location update');
        this._sendOrQueue(this.lastLocation);
      }
    }, 15000);
  }

  stopTracking() {
    if (!this.isTracking) return;
    this.isTracking = false;
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.notifyListeners('tracking_stopped');
  }

  destroy() {
    this.stopTracking();
    if (this.websocket) this.websocket.close();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.listeners.clear();
    this.locationQueue = [];
  }

  // Private helper methods for smart watch functionality
  _onFix(pos) {
    const fix = this.formatLocation(pos);
    const acc = fix.accuracy ?? 9999;

    // Log first few fixes to show tracking is working
    if (this.sampleRing.length < 3) {
      console.log(`[LocationService] 📍 GPS fix #${this.sampleRing.length + 1}:`, {
        lat: fix.latitude.toFixed(6),
        lng: fix.longitude.toFixed(6),
        accuracy: `${fix.accuracy?.toFixed(1)}m`,
        timestamp: fix.timestamp
      });
    }

    // ALWAYS send to WebSocket for manager visibility (regardless of accuracy)
    // This ensures the manager can see all employees, even with poor GPS
    // Note: Regular 15-second updates are now handled by the interval timer
    this._sendOrQueue(fix); // Send every GPS fix to WebSocket

    // Drop very coarse fixes for UI updates only (but WebSocket already sent above)
    if (acc > this.dropAcc) {
      this.notifyListeners('location_warming', { location: fix });
      return;
    }

    // Keep a small ring buffer for UI smoothing
    this.sampleRing.push(fix);
    if (this.sampleRing.length > this.maxSamples) this.sampleRing.shift();

    // Weighted smoothing by 1/accuracy for UI display
    const wsum = this.sampleRing.reduce((s, f) => s + (1 / Math.max(1, f.accuracy)), 0);
    const lat = this.sampleRing.reduce((s, f) => s + f.latitude  / Math.max(1, f.accuracy), 0) / wsum;
    const lng = this.sampleRing.reduce((s, f) => s + f.longitude / Math.max(1, f.accuracy), 0) / wsum;
    const bestAcc = Math.min(...this.sampleRing.map(f => f.accuracy ?? 9999));

    const smoothed = { ...fix, latitude: lat, longitude: lng, accuracy: bestAcc };

    // Update UI when reasonably accurate
    if (smoothed.accuracy <= this.minAcceptAcc) {
      this.lastLocation = smoothed;
      this.notifyListeners('location_updated', { location: smoothed });
    } else {
      this.notifyListeners('location_warming', { location: smoothed });
    }
  }

  _onFixError(err) {
    console.error('[LocationService] watchPosition error:', err);
    this.notifyListeners('location_error', { error: this.getLocationErrorMessage(err) });
  }

  _sendOrQueue(location) {
    if (this.isOnline && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      console.log('[LocationService] Sending location to WebSocket:', {
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp
      });
      this.sendLocationUpdate(location);
    } else {
      console.log('[LocationService] WebSocket offline, queuing location:', {
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy
      });
      this.locationQueue.push(location);
      this.notifyListeners('location_queued', { location });
    }
  }
}

const locationService = new LocationService();
export default locationService; 