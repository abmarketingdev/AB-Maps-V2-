// ============================================================================
// LOCATION SERVICE - Refactored Version
// ============================================================================
// This service handles:
// - Permission management for geolocation
// - Continuous GPS tracking with accuracy smoothing
// - WebSocket communication for real-time location updates
// - Offline queue management
// ============================================================================

// REMOVED: import { API_CONFIG } from '../config/apiConfig'; // Was never used
import { refreshAccessToken, shouldRefreshToken } from '../utils/tokenRefresh';

// ==================== CUSTOM ERROR CLASSES ====================

class PermissionDeniedError extends Error {
  constructor(message = 'Location permission denied', reason = 'user_denied') {
    super(message);
    this.name = 'PermissionDeniedError';
    this.isPermanent = true;
    this.reason = reason; // 'user_denied', 'blocked', 'unsupported'
  }
}

class LocationError extends Error {
  constructor(message = 'Unable to get location', code = null, context = null) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
    this.context = context; // Additional context for debugging
    this.isPermanent = false;
  }
}

// ==================== MAIN SERVICE CLASS ====================

class LocationService {
  constructor() {
    // ---- Tracking state ----
    this.isTracking = false;
    this.watchId = null;           // GPS watchPosition ID
    this.intervalId = null;        // Periodic update timer ID
    
    // ---- Configuration constants ----
    this.UPDATE_INTERVAL_MS = 15000;      // 15 seconds between forced updates
    this.MIN_SEND_INTERVAL_MS = 10000;    // Min 10 seconds between WebSocket sends
    
    // ---- Connection state ----
    this.websocket = null;
    this.employee = null;
    this.isOnline = false;
    this.retryAttempts = 0;
    this.maxRetryAttempts = 5;
    
    // ---- Location state ----
    this.lastLocation = null;
    this.lastRawFix = null;        // Latest raw GPS fix (any accuracy) for periodic sends
    this.locationQueue = [];
    this.lastSendTime = 0;         // Timestamp of last WebSocket send
    
    // ---- Permission state ----
    this.permissionStatus = 'unknown';
    this.isRequestingPermission = false;
    this._permissionStatusRef = null; // Reference for cleanup
    
    // ---- Event listeners ----
    this.listeners = new Map(); //where are teh listeners being used? What are the events?

    // ---- Smart watch / smoothing fields ----
    this.sampleRing = [];          // Recent accepted fixes for smoothing
    this.maxSamples = 8;           // Smoothing window size
    this.minAcceptAcc = 30;        // Meters: update UI when accuracy <= this
    this.dropAcc = 60;             // Meters: ignore fix for UI if accuracy > this
    
    // ---- UI throttling ----
    this.lastUIBroadcastLocation = null;
    this.lastUIBroadcastTime = 0;
    this.UI_BROADCAST_INTERVAL = 3000; // Max once per 3 seconds to UI
    this.UI_BROADCAST_DISTANCE = 3;    // Or when moved >3 meters
  }

  // ==================== INITIALIZATION ====================

  /**
   * Initialize location service with employee data
   * Token is always read fresh from localStorage via _getToken() - never cached
   * @param {Object} employee - Employee data
   */
  async initialize(employee) {
    this.employee = employee;
    console.log('[LocationService] Initializing with employee:', employee?.name);
    // Token is read on-demand from localStorage to avoid stale token issues
    // Permission and WebSocket should be initialized separately after permission is granted
  }

  /**
   * Get fresh access token from localStorage (single source of truth)
   * Never cache tokens - always read fresh to avoid stale token issues
   */
  _getToken() {
    return localStorage.getItem('emp_accessToken');
  }

  // ==================== PERMISSION MANAGEMENT ====================

  /**
   * Check current permission state without requesting
   * @param {boolean} updateInternal - Whether to update internal permissionStatus
   * @returns {Promise<string>} - 'granted', 'denied', 'prompt', 'unsupported', or 'unknown'
   */
  async checkPermissionState(updateInternal = false) {
    if (!navigator.geolocation) {
      if (updateInternal) this.permissionStatus = 'unsupported';
      return 'unsupported';
    }


    // one of the main function that will allow us to see the perm status of geolocation
    //what does navigator.permissions.query do?
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[LocationService] Current permission state:', perm.state);
        if (updateInternal) this.permissionStatus = perm.state;
        return perm.state; // 'granted', 'denied', or 'prompt'
      } catch (e) {
        console.warn('[LocationService] Failed to query permission state:', e);
        return 'unknown';
      }
    }

    // Fallback: Permissions API not available
    return 'unknown';
  }

  /**
   * Set up permission change listener
   * Call this after permission is granted to handle revocations
   */
  async setupPermissionListener() {
    if (!navigator.permissions || !navigator.permissions.query) return;

    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      
      // Store reference for cleanup
      this._permissionStatusRef = perm;
      

      //callback says that when you are done with something, run this function
      perm.onchange = () => {
        const oldStatus = this.permissionStatus;
        this.permissionStatus = perm.state;
        
        console.log('[LocationService] Permission changed:', oldStatus, '->', perm.state);
        this.notifyListeners('permission_changed', { 
          status: perm.state,
          previousStatus: oldStatus 
        });
        
        if (perm.state === 'granted' && oldStatus !== 'granted') {
          // Permission was just granted
          this.notifyListeners('permission_granted', { location: this.lastLocation });
        } else if (perm.state === 'denied') {
          // Permission was revoked - stop tracking
          this.stopTracking();
          this.notifyListeners('permission_denied', { 
            error: 'Location permission was revoked',
            reason: 'revoked'
          });
        }
      };
    } catch (e) {
      console.error('[LocationService] Failed to setup permission listener:', e);
    }
  }

  /**
   * Request location permission from user
   * @returns {Promise<Object>} Location object if successful
   */
  async requestLocationPermission() {
    // Prevent multiple simultaneous permission requests
    if (this.isRequestingPermission) {
      console.log('[LocationService] Permission request already in progress, waiting...');
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new LocationError('Permission request timeout - please try again'));
        }, 30000); // 30 second timeout to prevent infinite wait
        
        const checkInterval = setInterval(() => {
          if (!this.isRequestingPermission) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            if (this.permissionStatus === 'granted') {
              resolve(this.lastLocation);
            } else {
              reject(new LocationError('Permission request failed'));
            }
          }
        }, 100);
      });
    }

    this.isRequestingPermission = true;

    try {
      console.log('[LocationService] Requesting location permission...');

      // Check if geolocation is supported
      if (!navigator.geolocation) {
        this.permissionStatus = 'unsupported';
        this.isRequestingPermission = false;
        this.notifyListeners('permission_denied', { 
          error: 'Geolocation not supported',
          reason: 'unsupported'
        });
        throw new PermissionDeniedError('Geolocation not supported by this browser', 'unsupported');
      }

      // STEP 1: Check current permission state BEFORE requesting
      const permState = await this.checkPermissionState(true);
      console.log('[LocationService] Pre-flight permission check:', permState);

      // STEP 2: Handle based on current state
      if (permState === 'granted') {
        // Permission API says granted - try to get location directly first
        console.log('[LocationService] Permission already granted, getting location...');
        
        try {
          const location = await this.getLocationDirectly();
          this.permissionStatus = 'granted';
          this.lastLocation = location;
          this.isRequestingPermission = false;
          this.notifyListeners('permission_granted', { location });
          await this.setupPermissionListener();
          return location;
        } catch (directError) {
          // CRITICAL FIX: Handle "stale permission" scenario
          // Permissions API says "granted" but getCurrentPosition fails with PERMISSION_DENIED
          // This happens after page reload, tab switch, or when browser requires fresh user gesture
          console.warn('[LocationService] ⚠️ Direct location failed despite "granted" state:', {
            errorCode: directError.code,
            errorMessage: directError.message,
            context: directError.context
          });
          
          // Check if this is a PERMISSION_DENIED error (code 1)
          if (directError.code === 1 || directError.message?.includes('denied')) {
            console.log('[LocationService] 🔄 Stale permission detected - falling back to fresh prompt');
            
            // Re-check permission state after the error
            const freshPermState = await this.checkPermissionState(false);
            console.log('[LocationService] Fresh permission state after error:', freshPermState);
            
            if (freshPermState === 'denied') {
              // Actually denied now - don't try again
              this.permissionStatus = 'denied';
              this.isRequestingPermission = false;
              this.notifyListeners('permission_denied', {
                error: 'Location access denied. Enable in browser settings.',
                reason: 'user_denied'
              });
              throw new PermissionDeniedError(
                'Location access denied. Enable in browser settings.',
                'user_denied'
              );
            }
            
            // Permission state is still "granted" or "prompt" - browser is being inconsistent
            // Fall back to getLocationWithPrompt to trigger a fresh browser dialog
            console.log('[LocationService] 🔄 Triggering fresh browser prompt due to stale permission...');
            const location = await this.getLocationWithPrompt();
            this.permissionStatus = 'granted';
            this.lastLocation = location;
            this.isRequestingPermission = false;
            this.notifyListeners('permission_granted', { location });
            await this.setupPermissionListener();
            return location;
          }
          
          // For non-permission errors (timeout, position unavailable), re-throw
          throw directError;
        }
      }

      if (permState === 'denied') {
        // Permission explicitly denied - don't try again
        console.log('[LocationService] Permission explicitly denied');
        this.permissionStatus = 'denied';
        this.isRequestingPermission = false;
        this.notifyListeners('permission_denied', {
          error: 'Location access blocked. Enable in browser settings.',
          reason: 'blocked'
        });
        throw new PermissionDeniedError(
          'Location access blocked. Click the lock icon in your browser\'s address bar to enable.',
          'blocked'
        );
      }

      // STEP 3: State is 'prompt' or 'unknown' - request permission from user
      console.log('[LocationService] Requesting permission from user (state:', permState, ')');

      // Call getCurrentPosition - this will trigger the browser prompt
      const location = await this.getLocationWithPrompt();

      this.permissionStatus = 'granted';
      this.lastLocation = location;
      this.isRequestingPermission = false;
      this.notifyListeners('permission_granted', { location });
      await this.setupPermissionListener();
      return location;

    } catch (error) {
      this.isRequestingPermission = false;

      // Re-throw custom errors as-is
      if (error instanceof PermissionDeniedError || error instanceof LocationError) {
        throw error;
      }

      // Wrap unknown errors
      throw new LocationError(error.message || 'Unknown location error');
    }
  }

  // ==================== LOCATION FETCHING ====================

  /**
   * Get location directly (when permission is already granted)
   * Includes retry logic for TIMEOUT/POSITION_UNAVAILABLE only
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>} Location object
   */
  async getLocationDirectly(retryCount = 0) {
    const maxRetries = 1; // One initial attempt + one retry

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = this.formatLocation(pos);
          console.log('[LocationService] ✅ Location retrieved:', location);
          resolve(location);
        },
        async (err) => {
          const errorType = this.getErrorType(err.code);
          console.warn(`[LocationService] Location attempt ${retryCount + 1} failed:`, {
            message: err.message,
            code: err.code,
            errorType
          });

          // CRITICAL: Do NOT retry on PERMISSION_DENIED (code 1)
          // This indicates browser requires fresh user gesture or permission is revoked
          // Retrying won't help and wastes time
          if (errorType === 'PERMISSION_DENIED') {
            console.log('[LocationService] ❌ Permission denied - not retrying');
            const errorMsg = this.getLocationErrorMessage(err, 'direct');
            reject(new LocationError(errorMsg, err.code, 'getLocationDirectly_permission_denied'));
            return;
          }

          // Only retry on TIMEOUT or POSITION_UNAVAILABLE (GPS issues, not permission issues)
          const isRetryableError = errorType === 'TIMEOUT' || errorType === 'POSITION_UNAVAILABLE';
          
          if (retryCount < maxRetries && isRetryableError) {
            const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s
            console.log(`[LocationService] Retrying in ${delay}ms (${errorType})...`);

            setTimeout(async () => {
              try {
                const location = await this.getLocationDirectly(retryCount + 1);
                resolve(location);
              } catch (retryErr) {
                reject(retryErr);
              }
            }, delay);
          } else {
            // All retries exhausted or non-retryable error
            const errorMsg = this.getLocationErrorMessage(err, 'direct');
            console.error('[LocationService] Location fetch failed:', {
              errorMsg,
              errorType,
              retryCount,
              maxRetries
            });
            reject(new LocationError(errorMsg, err.code, 'getLocationDirectly'));
          }
        },
        {
          timeout: 30000,
          enableHighAccuracy: true,
          maximumAge: 10000
        }
      );
    });
  }

  /**
   * Get location with user prompt (triggers browser permission dialog)
   * @returns {Promise<Object>} Location object
   */
  async getLocationWithPrompt() {
    return new Promise((resolve, reject) => {
      console.log('[LocationService] Calling getCurrentPosition to trigger browser prompt...');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = this.formatLocation(pos);
          console.log('[LocationService] ✅ Permission granted by user, location received:', location);
          resolve(location);
        },
        async (err) => {
          console.error('[LocationService] ❌ getCurrentPosition error:', {
            code: err.code,
            message: err.message,
            errorType: this.getErrorType(err.code)
          });

          const errorType = this.getErrorType(err.code);

          // Handle based on error type
          if (errorType === 'PERMISSION_DENIED') {
            // Chrome/Firefox bug: Sometimes throws error code 1 WHILE the prompt is still open
            // Wait a moment, then check the actual permission state
            setTimeout(async () => {
              try {
                if (navigator.permissions && navigator.permissions.query) {
                  const perm = await navigator.permissions.query({ name: 'geolocation' });
                  console.log('[LocationService] Permission state after error code 1:', perm.state);

                  if (perm.state === 'denied') {
                    // Actually denied by user
                    this.permissionStatus = 'denied';
                    reject(new PermissionDeniedError(
                      'Location access denied. Enable in browser settings.',
                      'user_denied'
                    ));
                  } else if (perm.state === 'granted') {
                    // Permission was granted after the error - retry getting location
                    console.log('[LocationService] Permission granted after error, retrying...');
                    try {
                      const location = await this.getLocationDirectly();
                      resolve(location);
                    } catch (retryErr) {
                      reject(retryErr);
                    }
                  } else {
                    // Still 'prompt' - user dismissed without clicking allow/block
                    console.log('[LocationService] User dismissed prompt without decision');
                    reject(new LocationError(
                      'Please click on "Grant Location Access button" to continue',
                      err.code,
                      'prompt_dismissed'
                    ));
                  }
                } else {
                  // No Permissions API - assume denied
                  this.permissionStatus = 'denied';
                  reject(new PermissionDeniedError(
                    'Location access denied. Enable in browser settings.',
                    'user_denied'
                  ));
                }
              } catch (e) {
                reject(new LocationError('Failed to check permission state', err.code, 'api_error'));
              }
            }, 1000); // Wait 1 second for browser prompt to be handled

          } else if (errorType === 'TIMEOUT') {
            // GPS timeout - permission might be granted but signal weak
            reject(new LocationError(
              'Location request timed out. Please try again.',
              err.code,
              'timeout'
            ));
          } else if (errorType === 'POSITION_UNAVAILABLE') {
            // GPS unavailable - permission might be granted but hardware issue
            reject(new LocationError(
              'Unable to determine location. Check GPS settings.',
              err.code,
              'position_unavailable'
            ));
          } else {
            reject(new LocationError(this.getLocationErrorMessage(err, 'prompt'), err.code));
          }
        },
        {
          timeout: 30000,
          enableHighAccuracy: true,
          maximumAge: 0 // Force fresh location request
        }
      );
    });
  }

  /**
   * Get current location (one-shot, no events)
   * @returns {Promise<Object>} Location object
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = this.formatLocation(pos);
          resolve(loc);
        },
        (err) => reject(new LocationError(this.getLocationErrorMessage(err, 'current'), err.code)),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    });
  }

  // ==================== GPS TRACKING ====================

  /**
   * Start continuous GPS tracking
   * @returns {boolean} True if tracking started successfully
   */
  startTracking() {
    if (this.isTracking) {
      console.log('[LocationService] Already tracking');
      return true;
    }

    // Require granted permission before starting
    if (this.permissionStatus !== 'granted') {
      console.warn('[LocationService] startTracking called without granted permission; aborting.');
      return false;
    }

    this.isTracking = true;
    this.lastSendTime = 0; // Reset send time on tracking start
    console.log('[LocationService] 🚀 Starting smart watch tracking (continuous GPS)');
    this.notifyListeners('tracking_started');

    // Start a continuous watch — keeps GPS warm and improves accuracy quickly
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onFix(pos),
      (err) => this._onFixError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 0,   // Do NOT use cached fixes
        timeout: 15000
      }
    );

    // Start periodic interval to ensure regular updates are sent
    // Uses lastRawFix (any accuracy) so updates are sent even with poor GPS
    this.intervalId = setInterval(() => {
      const fixToSend = this.lastLocation || this.lastRawFix;
      if (fixToSend) {
        console.log('[LocationService] ⏰ Periodic interval: sending location update', {
          accuracy: fixToSend.accuracy?.toFixed(1),
          source: this.lastLocation ? 'smoothed' : 'raw'
        });
        this._sendOrQueue(fixToSend);
      }
    }, this.UPDATE_INTERVAL_MS);

    return true;
  }

  /**
   * Stop GPS tracking
   */
  stopTracking() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    
    // Clear watch
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Clear sample ring and raw fix to prevent stale data on restart
    this.sampleRing = [];
    this.lastRawFix = null;
    
    console.log('[LocationService] Tracking stopped');
    this.notifyListeners('tracking_stopped');
  }

  // ==================== WEBSOCKET COMMUNICATION ====================

  /**
   * Initialize WebSocket connection for real-time updates
   */
  async initializeWebSocket() {
    // Close existing connection if any
    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN || 
          this.websocket.readyState === WebSocket.CONNECTING) {
        console.log('[LocationService] Closing existing WebSocket connection');
        this.websocket.close(1000, 'Reinitializing');
      }
      this.websocket = null;
    }

    // Always read fresh token from localStorage (single source of truth)
    let token = this._getToken();
    
    // If token is expired or near expiry, try to refresh before connecting
    if (!token || shouldRefreshToken(token)) {
      console.log('[LocationService] Token missing or near expiry, attempting refresh before WS connect...');
      try {
        token = await refreshAccessToken();
        console.log('[LocationService] Token refreshed successfully before WS connect');
      } catch (err) {
        console.error('[LocationService] Token refresh failed before WS connect:', err);
        if (!token) {
          throw new Error('No access token available for WebSocket connection');
        }
      }
    }

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const wsUrl = `${BACKEND_URL.replace(/^http/, 'ws')}/ws/tracking/?token=${token}`;
    console.log('[LocationService] Connecting to WS:', wsUrl);

    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(wsUrl);

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
          this.websocket.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout

      this.websocket.onopen = () => {
        console.log('[LocationService] 🌐 WebSocket connected to server');
        clearTimeout(connectionTimeout);
        this.isOnline = true;
        this.retryAttempts = 0;
        this.notifyListeners('websocket_connected');
        this.sendQueuedLocations();
        // Send current location immediately so server has it right away
        this._sendCurrentLocationOnConnect();
        resolve();
      };

      this.websocket.onerror = (error) => {
        console.error('[LocationService] WebSocket connection error:', error);
        clearTimeout(connectionTimeout);
        reject(new Error(`WebSocket connection failed: ${error.message || 'Unknown error'}`));
      };

      this.websocket.onclose = (e) => {
        console.log('[LocationService] WS closed', e.code, e.reason);
        clearTimeout(connectionTimeout);
        this.isOnline = false;
        this.notifyListeners('websocket_disconnected', { code: e.code, reason: e.reason });
        
        // Auto-reconnect on unexpected close
        if (e.code !== 1000 && this.retryAttempts < this.maxRetryAttempts) {
          // Auth-related close codes (4001, 4003) or generic 1006 may indicate expired token
          const isAuthClose = e.code === 4001 || e.code === 4003 || e.code === 1006;
          if (isAuthClose) {
            console.log('[LocationService] Auth-related WS close, refreshing token before reconnect...');
            refreshAccessToken()
              .then(() => {
                console.log('[LocationService] Token refreshed after auth-close, reconnecting...');
                this.scheduleReconnect();
              })
              .catch(err => {
                console.error('[LocationService] Token refresh failed after auth-close:', err);
                this.scheduleReconnect();
              });
          } else {
            this.scheduleReconnect();
          }
        }
      };

      this.websocket.onmessage = (e) => {
        try {
          this.handleWebSocketMessage(JSON.parse(e.data));
        } catch (err) {
          console.error('[LocationService] WS message parse error', err);
        }
      };
    });
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  scheduleReconnect() {
    this.retryAttempts++;
    const delay = Math.min(1000 * 2 ** (this.retryAttempts - 1), 30000);
    console.log(`[LocationService] Reconnect #${this.retryAttempts} in ${delay}ms`);
    setTimeout(() => this.initializeWebSocket().catch(err => {
      console.error('[LocationService] Reconnection failed:', err);
    }), delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleWebSocketMessage(data) {
    console.log('[LocationService] WS message received:', data);
    switch (data.type) {
      case 'location_confirmed':
        console.log('[LocationService] ✅ Location confirmed by server:', {
          timestamp: data.timestamp,
          device_id: data.device_id,
          message: 'Manager can now see this location'
        });
        this.notifyListeners('location_confirmed', data);
        break;
      case 'ping':
        console.log('[LocationService] 🏓 Ping received, sending pong');
        this.sendWebSocketMessage({ type: 'pong', timestamp: new Date().toISOString() });
        break;
      case 'request_location':
        console.log('[LocationService] 📍 Server requested location, sending immediately');
        this.getCurrentLocation()
          .then(loc => this.sendLocationUpdate(loc))
          .catch(err => console.error('[LocationService] Failed to respond to request_location:', err));
        break;
      case 'error':
        console.error('[LocationService] ❌ Server error:', data.message);
        this.notifyListeners('server_error', data);
        break;
      default:
        console.log('[LocationService] ❓ Unhandled WS type:', data.type, data);
    }
  }

  /**
   * Send a message via WebSocket
   */
  sendWebSocketMessage(msg) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(msg));
    }
  }

  /**
   * Send a location update via WebSocket
   */
  sendLocationUpdate(location) {
    const msg = { type: 'location_update', ...location };
    try {
      console.log('[LocationService] 📤 Sending location_update to server:', {
        type: msg.type,
        lat: msg.latitude,
        lng: msg.longitude,
        accuracy: msg.accuracy,
        timestamp: msg.timestamp,
        device_id: msg.device_id
      });
      this.websocket.send(JSON.stringify(msg));
      console.log('[LocationService] ✅ location_update sent successfully to server');
    } catch (e) {
      console.error('[LocationService] ❌ Failed to send location_update:', e);
      this.locationQueue.push(location);
    }
  }

  /**
   * Send all queued locations
   */
  sendQueuedLocations() {
    while (this.locationQueue.length) {
      this.sendLocationUpdate(this.locationQueue.shift());
    }
  }

  /**
   * Send current location immediately when WebSocket connects.
   * Ensures server receives at least one location right away, rather than
   * waiting for the 15s interval. On desktop, watchPosition may never fire,
   * so we fall back to getCurrentPosition if we don't have a location yet.
   */
  _sendCurrentLocationOnConnect() {
    const fix = this.lastLocation || this.lastRawFix;
    if (fix) {
      console.log('[LocationService] 📤 Sending initial location on connect:', { lat: fix.latitude, lng: fix.longitude });
      this._sendOrQueue(fix);
      return;
    }
    // No location yet (e.g. desktop before watchPosition fires) - fetch and send
    this.getCurrentLocation()
      .then(loc => {
        console.log('[LocationService] 📤 Fetched and sending initial location on connect:', { lat: loc.latitude, lng: loc.longitude });
        this.lastLocation = loc;
        this._sendOrQueue(loc);
      })
      .catch(err => console.warn('[LocationService] Could not fetch initial location on connect:', err));
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Format GPS position to location object
   */
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

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(a, b) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = a.latitude * Math.PI / 180;
    const φ2 = b.latitude * Math.PI / 180;
    const Δφ = (b.latitude - a.latitude) * Math.PI / 180;
    const Δλ = (b.longitude - a.longitude) * Math.PI / 180;
    const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /**
   * Get error type from geolocation error code
   */
  getErrorType(errorCode) {
    switch (errorCode) {
      case 1: return 'PERMISSION_DENIED';
      case 2: return 'POSITION_UNAVAILABLE';
      case 3: return 'TIMEOUT';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Get user-friendly error message from geolocation error
   * @param {GeolocationPositionError} err - The error object
   * @param {string} context - Context for the error (e.g., 'permission_request', 'direct')
   */
  getLocationErrorMessage(err, context = 'unknown') {
    switch (err.code) {
      case 1: 
        // Code 1 can be actual denial OR browser race condition
        return context === 'permission_request' || context === 'prompt'
          ? 'Location access denied. Enable in browser settings.'
          : 'Location access failed. Please try again or check browser settings.';
      case 2: 
        return 'Unable to determine your location. Please check GPS settings.';
      case 3: 
        return 'Getting your location is taking longer than expected. Please try again.';
      default: 
        return 'Unknown error occurred while getting location';
    }
  }

  // ==================== EVENT SYSTEM ====================

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} cb - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    
    // Return unsubscribe function
    return () => this.off(event, cb);
  }

  /**
   * Unsubscribe from an event
   */
  off(event, cb) {
    this.listeners.get(event)?.delete(cb);
  }

  /**
   * Notify all listeners of an event
   */
  notifyListeners(event, data) {
    this.listeners.get(event)?.forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.error(`[LocationService] Error in listener for ${event}:`, err);
      }
    });
  }

  // ==================== STATUS & LIFECYCLE ====================

  /**
   * Get current service status
   */
  getStatus() {
    return { 
      isTracking: this.isTracking, 
      isOnline: this.isOnline, 
      permissionStatus: this.permissionStatus, 
      lastLocation: this.lastLocation,
      queueLength: this.locationQueue.length
    };
  }

  /**
   * Destroy the service and clean up all resources
   */
  destroy() {
    console.log('[LocationService] Destroying service...');
    
    // Stop tracking (clears watchId and intervalId)
    this.stopTracking();
    
    // Close WebSocket
    if (this.websocket) {
      this.websocket.close(1000, 'Service destroyed');
      this.websocket = null;
    }
    
    // Clear all event listeners
    this.listeners.clear();
    
    // Clear queue
    this.locationQueue = [];
    
    // Reset all state flags
    this.permissionStatus = 'unknown';
    this.isOnline = false;
    this.isRequestingPermission = false;
    this.lastLocation = null;
    this.lastRawFix = null;
    this.lastSendTime = 0;
    this.sampleRing = [];
    this.retryAttempts = 0;
    
    // Clean up permission listener
    if (this._permissionStatusRef) {
      this._permissionStatusRef.onchange = null;
      this._permissionStatusRef = null;
    }
    
    // Reset UI state
    this.lastUIBroadcastLocation = null;
    this.lastUIBroadcastTime = 0;
    
    console.log('[LocationService] Service destroyed and reset');
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Check if UI listeners should be notified (throttling)
   */
  _shouldBroadcastToUI(location) {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastUIBroadcastTime;
    
    // Always broadcast if first time or been >3 seconds
    if (!this.lastUIBroadcastLocation || timeSinceLastBroadcast > this.UI_BROADCAST_INTERVAL) {
      return true;
    }
    
    // Broadcast if moved >3 meters
    if (this.lastUIBroadcastLocation) {
      const distance = this.calculateDistance(this.lastUIBroadcastLocation, location);
      if (distance > this.UI_BROADCAST_DISTANCE) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Handle GPS fix from watchPosition
   */
  _onFix(pos) {
    const fix = this.formatLocation(pos);
    const acc = fix.accuracy ?? 9999;
    const now = Date.now();

    // Always store the latest raw fix so periodic interval can send it
    this.lastRawFix = fix;

    // Log first few fixes to show tracking is working
    if (this.sampleRing.length < 3) {
      console.log(`[LocationService] 📍 GPS fix #${this.sampleRing.length + 1}:`, {
        lat: fix.latitude.toFixed(6),
        lng: fix.longitude.toFixed(6),
        accuracy: `${fix.accuracy?.toFixed(1)}m`,
        timestamp: fix.timestamp
      });
    }

    // Throttle WebSocket sends (min 10 seconds between sends from GPS)
    // This prevents flooding the server while still ensuring manager visibility
    const timeSinceLastSend = now - this.lastSendTime;
    if (timeSinceLastSend >= this.MIN_SEND_INTERVAL_MS) {
      this._sendOrQueue(fix);
      this.lastSendTime = now;
    }

    // Drop very coarse fixes for UI updates only
    if (acc > this.dropAcc) {
      if (this._shouldBroadcastToUI(fix)) {
        this.notifyListeners('location_warming', { location: fix });
        this.lastUIBroadcastLocation = fix;
        this.lastUIBroadcastTime = now;
      }
      return;
    }

    // Keep a small ring buffer for UI smoothing
    this.sampleRing.push(fix);
    if (this.sampleRing.length > this.maxSamples) this.sampleRing.shift();

    // Weighted smoothing by 1/accuracy for UI display
    const wsum = this.sampleRing.reduce((s, f) => s + (1 / Math.max(1, f.accuracy)), 0);
    const lat = this.sampleRing.reduce((s, f) => s + f.latitude / Math.max(1, f.accuracy), 0) / wsum;
    const lng = this.sampleRing.reduce((s, f) => s + f.longitude / Math.max(1, f.accuracy), 0) / wsum;
    const bestAcc = Math.min(...this.sampleRing.map(f => f.accuracy ?? 9999));

    const smoothed = { ...fix, latitude: lat, longitude: lng, accuracy: bestAcc };

    // Throttle UI notifications
    const shouldBroadcast = this._shouldBroadcastToUI(smoothed);
    
    // Update UI when reasonably accurate
    if (smoothed.accuracy <= this.minAcceptAcc) {
      this.lastLocation = smoothed;
      
      if (shouldBroadcast) {
        this.notifyListeners('location_updated', { location: smoothed });
        this.lastUIBroadcastLocation = smoothed;
        this.lastUIBroadcastTime = now;
      }
    } else {
      if (shouldBroadcast) {
        this.notifyListeners('location_warming', { location: smoothed });
        this.lastUIBroadcastLocation = smoothed;
        this.lastUIBroadcastTime = now;
      }
    }
  }

  /**
   * Handle GPS error from watchPosition
   */
  _onFixError(err) {
    console.error('[LocationService] watchPosition error:', err);
    
    const errorType = this.getErrorType(err.code);
    
    // Check if this is a fatal error that stops the watch
    if (errorType === 'PERMISSION_DENIED') {
      // Permission was revoked - stop tracking
      console.warn('[LocationService] Permission revoked during tracking');
      this.permissionStatus = 'denied';
      this.stopTracking();
      this.notifyListeners('permission_denied', { 
        error: this.getLocationErrorMessage(err, 'tracking'),
        reason: 'revoked'
      });
    } else {
      // Transient error - just notify, watch continues
      this.notifyListeners('location_error', { 
        error: this.getLocationErrorMessage(err, 'tracking'),
        code: err.code,
        errorType
      });
    }
  }

  /**
   * Send location via WebSocket or queue if offline
   */
  _sendOrQueue(location) {
    if (this.isOnline && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendLocationUpdate(location);
    } else {
      console.log('[LocationService] WebSocket offline, queuing location');
      this.locationQueue.push(location);
      this.notifyListeners('location_queued', { location });
    }
  }
}

// ==================== SINGLETON EXPORT ====================

const locationService = new LocationService();
export default locationService;
