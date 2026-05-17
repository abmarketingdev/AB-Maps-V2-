/**
 * WebSocket service for manager location visualization
 * Handles real-time employee location updates and status changes
 */
import { API_CONFIG } from '../config/apiConfig';

class ManagerWebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.listeners = new Map();
    this.isConnected = false;
    this.statusListeners = new Set();
    this.pingInterval = null;
    this.pongTimeout = null;
    this.currentToken = null;
    this.autoReconnect = true;
    this.employeeLocationListeners = new Set();
    this.employeeStatusListeners = new Set();
  }

  // Add/remove/notify status listeners
  addStatusListener(callback) {
    this.statusListeners.add(callback);
  }
  
  removeStatusListener(callback) {
    this.statusListeners.delete(callback);
  }
  
  notifyStatusListeners(status) {
    this.statusListeners.forEach(cb => {
      try { cb(status); } catch (e) {}
    });
  }

  // Employee location listeners
  addEmployeeLocationListener(callback) {
    this.employeeLocationListeners.add(callback);
  }

  removeEmployeeLocationListener(callback) {
    this.employeeLocationListeners.delete(callback);
  }

  notifyEmployeeLocationListeners(employeeData) {
    this.employeeLocationListeners.forEach(cb => {
      try { cb(employeeData); } catch (e) {}
    });
  }

  // Employee status listeners
  addEmployeeStatusListener(callback) {
    this.employeeStatusListeners.add(callback);
  }

  removeEmployeeStatusListener(callback) {
    this.employeeStatusListeners.delete(callback);
  }

  notifyEmployeeStatusListeners(employeeData) {
    this.employeeStatusListeners.forEach(cb => {
      try { cb(employeeData); } catch (e) {}
    });
  }

  /**
   * Connect to manager dashboard WebSocket
   * @param {string} token - JWT token for authentication
   */
  async connect(token) {
    console.log('[managerWebSocketService] Connecting to WebSocket:', token);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // Try to refresh token if needed before connecting
    const refreshedToken = await this.refreshTokenIfNeeded(token);
    this.currentToken = refreshedToken;

    return new Promise((resolve, reject) => {
      const backendUrl = API_CONFIG.backend.baseUrl.replace('/api', '');
      const wsUrl = `${backendUrl.replace('http://', 'ws://')}/ws/tracking/dashboard/?token=${refreshedToken}`;
      
      console.log('Backend URL:', backendUrl);
      console.log('WebSocket URL:', wsUrl);
      console.log('Token being used:', refreshedToken ? refreshedToken.substring(0, 50) + '...' : 'null');
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[managerWebSocketService] WebSocket connected successfully:', wsUrl);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyStatusListeners(true);
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Manager WebSocket message received:', data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing Manager WebSocket message:', error);
          console.error('Raw message data:', event.data);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('Manager WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.notifyStatusListeners(false);
        
        if (event.code !== 1000 && this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('Manager WebSocket error:', error);
        this.notifyStatusListeners(false);
        reject(error);
      };
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`Scheduling manager reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.autoReconnect && this.currentToken) {
        console.log(`Attempting to reconnect manager (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(this.currentToken).catch(error => {
          console.error('Manager reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.autoReconnect = false;
    
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * Send message to WebSocket
   * @param {Object} message - Message to send
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Sending Manager WebSocket message:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Manager WebSocket is not connected');
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} data - Message data
   */
  handleMessage(data) {
    const { type, ...payload } = data;
    
    console.log(`Handling Manager WebSocket message type: ${type}`, payload);
    
    // Handle ping/pong
    if (type === 'ping') {
      this.send({
        type: 'pong',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (type === 'pong') {
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
      return;
    }

    // Handle employee data response
    if (type === 'employee_data') {
      console.log('WebSocket: Received employee_data response:', payload.employee);
      this.notifyEmployeeLocationListeners(payload.employee);
      return;
    }

    // Handle employees data response
    if (type === 'employees_data') {
      this.notifyEmployeeStatusListeners(payload.employees);
      return;
    }

    // Handle dashboard data response
    if (type === 'dashboard_data') {
      this.notifyListeners('dashboard_data', payload.data);
      return;
    }

    // Handle employee location updates
    if (type === 'location_update') {
      console.log('Real-time location update received:', payload);
      this.notifyEmployeeLocationListeners({
        id: payload.employee_id,
        name: payload.employee_name,
        currentPosition: {
          lat: payload.location.latitude,
          lng: payload.location.longitude
        },
        locationAccuracy: payload.location.accuracy,
        lastSeen: payload.location.timestamp
      });
      return;
    }

    // Handle employee status updates
    if (type === 'status_update') {
      this.notifyEmployeeStatusListeners(payload);
      return;
    }

    // Handle employee online/offline events
    if (type === 'employee_online' || type === 'employee_offline') {
      this.notifyEmployeeStatusListeners({
        ...payload,
        event_type: type
      });
      return;
    }

    // Handle area assignment updates
    if (type === 'area_assignment_update') {
      this.notifyListeners('area_assignment_update', payload);
      return;
    }

    // Handle general dashboard updates
    this.notifyListeners(type, payload);
  }

  /**
   * Add event listener
   * @param {string} eventType - Event type
   * @param {Function} callback - Callback function
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
  }

  /**
   * Remove event listener
   * @param {string} eventType - Event type
   * @param {Function} callback - Callback function
   */
  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  /**
   * Notify listeners for specific event type
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} listener:`, error);
        }
      });
    }
  }

  /**
   * Request employee data from server
   * @param {number} employeeId - Employee ID
   */
  requestEmployeeData(employeeId) {
    this.send({
      type: 'employee_request',
      employee_id: employeeId
    });
  }

  /**
   * Request area data from server
   * @param {number} areaId - Area ID
   */
  requestAreaData(areaId) {
    this.send({
      type: 'request_area_data',
      area_id: areaId
    });
  }

  /**
   * Request current location for specific employee
   * @param {number} employeeId - Employee ID
   */
  requestEmployeeLocation(employeeId) {
    this.send({
      type: 'employee_request',
      employee_id: employeeId
    });
    console.log(`Requested location data for employee: ${employeeId}`);
  }

  /**
   * Request all employees data
   */
  requestAllEmployees() {
    this.send({
      type: 'get_employees'
    });
    console.log('Requested all employees data');
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Set auto-reconnect behavior
   * @param {boolean} enabled - Whether to enable auto-reconnect
   */
  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection stats
   */
  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      currentToken: this.currentToken ? '***' : null
    };
  }

  /**
   * Refresh connection with new token
   * @param {string} newToken - New JWT token
   */
  async refreshConnection(newToken) {
    console.log('Refreshing manager WebSocket connection with new token');
    this.disconnect();
    this.currentToken = newToken;
    await this.connect(newToken);
  }

  /**
   * Refresh JWT token if needed
   * @param {string} currentToken - Current JWT token
   * @returns {string} Refreshed or current token
   */
  async refreshTokenIfNeeded(currentToken) {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        console.log('No refresh token available');
        return currentToken;
      }

              const response = await fetch(`${API_CONFIG.backend.baseUrl}/auth/refresh/`, {
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
        console.log('Manager token refreshed successfully');
        return data.access;
      } else {
        console.log('Manager token refresh failed, redirecting to login...');
        // Check if we're in a popup/iframe
        if (window.opener) {
          // If opened from sales dashboard, close this window
          window.close();
        } else {
          // Otherwise redirect to login
          window.location.href = 'http://localhost:3000/login';
        }
        return currentToken;
      }
    } catch (error) {
      console.error('Manager token refresh error:', error);
      // Check if we're in a popup/iframe
      if (window.opener) {
        // If opened from sales dashboard, close this window
        window.close();
      } else {
        // Otherwise redirect to login
        window.location.href = 'http://localhost:3000/login';
      }
      return currentToken;
    }
  }
}

// Create singleton instance
const managerWebSocketService = new ManagerWebSocketService();

export default managerWebSocketService; 