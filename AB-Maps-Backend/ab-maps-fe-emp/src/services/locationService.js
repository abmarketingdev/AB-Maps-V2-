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
      console.log('Requesting location permission...');
      
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        const error = new Error('Geolocation not supported');
        this.permissionStatus = 'unsupported';
        this.isRequestingPermission = false;
        this.notifyListeners('permission_denied', { error: error.message });
        reject(error);
        return;
      }
      
      // Check current permission status first
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
          console.log('Current permission status:', permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            const error = new Error('Location permission denied by browser');
            this.permissionStatus = 'denied';
            this.isRequestingPermission = false;
            this.notifyListeners('permission_denied', { error: error.message });
            reject(error);
            return;
          }
          
          // If permission is granted, proceed with getting location
          if (permissionStatus.state === 'granted') {
            this.getCurrentLocationWithTimeout(resolve, reject);
          } else {
            // If permission is prompt, try to get location (this will trigger the permission prompt)
            this.getCurrentLocationWithTimeout(resolve, reject);
          }
        }).catch((error) => {
          console.error('Error checking permission status:', error);
          // Fallback to trying to get location anyway
          this.getCurrentLocationWithTimeout(resolve, reject);
        });
      } else {
        // Fallback for browsers that don't support permissions API
        this.getCurrentLocationWithTimeout(resolve, reject);
      }
    });
  }
  
  getCurrentLocationWithTimeout(resolve, reject) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('Location permission granted, position received:', pos);
        this.permissionStatus = 'granted';
        this.lastLocation = this.formatLocation(pos);
        this.isRequestingPermission = false;
        this.notifyListeners('permission_granted', { location: this.lastLocation });
        resolve(this.lastLocation);
      },
      (err) => {
        console.error('Location permission denied or error:', err);
        this.permissionStatus = 'denied';
        this.isRequestingPermission = false;
        const msg = this.getLocationErrorMessage(err);
        this.notifyListeners('permission_denied', { error: msg });
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async initializeWebSocket() {
    // Always get the latest access token from localStorage
    this.token = localStorage.getItem('accessToken');
    if (!this.token) return;
    
    // Try to refresh token if it might be expired
    await this.refreshTokenIfNeeded();
    
    const backendUrl = API_CONFIG.backend.baseUrl.replace('/api', '');
    const wsUrl = `${backendUrl.replace(/^http/, 'ws')}/ws/tracking/?token=${this.token}`;
    console.log('Connecting to WS:', wsUrl);
    
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(wsUrl);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.websocket.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
        clearTimeout(connectionTimeout);
        this.isOnline = true;
        this.retryAttempts = 0;
        this.notifyListeners('websocket_connected');
        this.sendQueuedLocations();
        resolve();
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        console.error('WebSocket URL attempted:', wsUrl);
        console.error('Token available:', !!this.token);
        clearTimeout(connectionTimeout);
        reject(new Error(`WebSocket connection failed: ${error.message || 'Unknown error'}`));
      };
      
      this.websocket.onclose = (e) => {
        console.log('WS closed', e.code, e.reason);
        clearTimeout(connectionTimeout);
        this.isOnline = false;
        this.notifyListeners('websocket_disconnected', { code: e.code, reason: e.reason });
        if (e.code !== 1000 && this.retryAttempts < this.maxRetryAttempts) this.scheduleReconnect();
      };
      
      this.websocket.onmessage = (e) => {
        try { this.handleWebSocketMessage(JSON.parse(e.data)); }
        catch (err) { console.error('WS message parse error', err); }
      };
    });
  }

  scheduleReconnect() {
    this.retryAttempts++;
    const delay = Math.min(1000 * 2 **(this.retryAttempts -1), 30000);
    console.log(`Reconnect #${this.retryAttempts} in ${delay}ms`);
    setTimeout(() => this.initializeWebSocket(), delay);
  }

  async startTracking() {
    if (this.isTracking) return;
    if (this.permissionStatus !== 'granted') {
      try { await this.requestLocationPermission(); }
      catch { return; }
    }
    console.log('Starting continuous push every', this.updateInterval);
    this.isTracking = true;
    this.notifyListeners('tracking_started');
    try {
      const loc = await this.getCurrentLocation();
      this.sendLocationUpdate(loc);
    } catch {};
    this.intervalId = setInterval(async () => {
      try {
        const loc = await this.getCurrentLocation();
        // Log before sending
        console.log('[LocationService] Attempting to send location_update:', loc);
        this.sendLocationUpdate(loc);
      } catch (e) {
        console.error('[LocationService] Error getting location for interval update:', e);
      }
    }, this.updateInterval);
  }

  stopTracking() {
    if (!this.isTracking) return;
    this.isTracking = false;
    clearInterval(this.intervalId);
    this.notifyListeners('tracking_stopped');
  }

  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = this.formatLocation(pos);
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
    if (this.isOnline && this.websocket.readyState === WebSocket.OPEN) {
      this.sendLocationUpdate(location);
    } else {
      this.locationQueue.push(location);
      this.notifyListeners('location_queued', { location });
    }
  }

  sendLocationUpdate(location) {
    const msg = { type: 'location_update', ...location };
    try {
      // Log before sending
      console.log('[LocationService] Sending location_update payload:', msg);
      this.websocket.send(JSON.stringify(msg));
      // Log after successful send
      console.log('[LocationService] location_update sent successfully:', msg);
    } catch (e) {
      // Log error
      console.error('[LocationService] Failed to send location_update:', msg, e);
      this.locationQueue.push(location);
    }
  }

  sendQueuedLocations() {
    while (this.locationQueue.length) {
      this.sendLocationUpdate(this.locationQueue.shift());
    }
  }

  handleWebSocketMessage(data) {
    console.log('WS message', data);
    switch (data.type) {
      case 'location_confirmed':
        this.notifyListeners('location_confirmed', data);
        break;
      case 'ping':
        this.sendWebSocketMessage({ type: 'pong', timestamp: new Date().toISOString() });
        break;
      case 'request_location':
        // Immediately get and send current location
        this.getCurrentLocation()
          .then(loc => this.sendLocationUpdate(loc))
          .catch(err => console.error('Failed to respond to request_location:', err));
        break;
      case 'error':
        console.error('Server error', data.message);
        this.notifyListeners('server_error', data);
        break;
      default:
        console.log('Unhandled WS type', data.type);
    }
  }

  sendWebSocketMessage(msg) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(msg));
    }
  }

  /**
   * Refresh JWT token if needed
   */
  async refreshTokenIfNeeded() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        console.log('No refresh token available');
        return;
      }

      const response = await fetch(`${API_CONFIG.backend.baseUrl}/api/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.access);
        this.token = data.access;
        console.log('Token refreshed successfully');
      } else {
        console.log('Token refresh failed, redirecting to login...');
        // Redirect to sales dashboard for re-authentication
        window.location.href = 'https://www.abtest.no/login'; //change when frontend is deployed
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // Redirect to sales dashboard for re-authentication
      window.location.href = 'https://www.abtest.no/login'; //change when frontend is deployed
    }
  }

  calculateDistance(a, b) {
    const R = 6371e3, φ1 = a.latitude * Math.PI/180, φ2 = b.latitude * Math.PI/180;
    const Δφ = (b.latitude - a.latitude)*Math.PI/180;
    const Δλ = (b.longitude - a.longitude)*Math.PI/180;
    const x = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  getLocationErrorMessage(err) {
    switch (err.code) {
      case 1: return 'Permission denied';
      case 2: return 'Position unavailable';
      case 3: return 'Timeout';
      default: return 'Unknown error';
    }
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

  destroy() {
    this.stopTracking();
    if (this.websocket) this.websocket.close();
    this.listeners.clear();
    this.locationQueue = [];
  }
}

const locationService = new LocationService();
export default locationService;
