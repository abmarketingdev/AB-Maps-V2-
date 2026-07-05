/**
 * WebSocket service for Talkmore enrichment real-time updates
 * Handles real-time enrichment progress and feature updates (1 by 1)
 */
import { API_CONFIG } from '../config/apiConfig';
import authService from './authService';
import { refreshManagerToken, handleAuthFailure } from '../utils/tokenRefresh';

class TalkmoreWebSocketService {
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
    this.currentJobId = null;
    this.autoReconnect = true;
    this.jobStatusListeners = new Set();
    this.featureListeners = new Set();
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
      try { cb(status); } catch (e) { }
    });
  }

  // Job status listeners
  addJobStatusListener(callback) {
    this.jobStatusListeners.add(callback);
  }

  removeJobStatusListener(callback) {
    this.jobStatusListeners.delete(callback);
  }

  notifyJobStatusListeners(jobStatus) {
    this.jobStatusListeners.forEach(cb => {
      try { cb(jobStatus); } catch (e) { }
    });
  }

  // Feature listeners (for feature.done messages)
  addFeatureListener(callback) {
    this.featureListeners.add(callback);
  }

  removeFeatureListener(callback) {
    this.featureListeners.delete(callback);
  }

  notifyFeatureListeners(featureData) {
    this.featureListeners.forEach(cb => {
      try { cb(featureData); } catch (e) { }
    });
  }

  /**
   * Connect to Talkmore job WebSocket
   * @param {string} jobId - Job UUID
   * @param {string} token - JWT token for authentication
   */
  async connect(jobId, token) {
    console.log('[talkmoreWebSocketService] Connecting to WebSocket for job:', jobId);
    
    if (!jobId) {
      throw new Error('Job ID is required');
    }

    // If already connected to the same job, return
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentJobId === jobId) {
      console.log('[talkmoreWebSocketService] Already connected to job:', jobId);
      return Promise.resolve();
    }

    // Disconnect if connected to different job
    if (this.ws && this.currentJobId !== jobId) {
      console.log('[talkmoreWebSocketService] Disconnecting from previous job:', this.currentJobId);
      this.disconnect();
    }

    // Try to refresh token if needed before connecting
    const refreshedToken = await this.refreshTokenIfNeeded(token);
    this.currentToken = refreshedToken;
    this.currentJobId = jobId;

    return new Promise((resolve, reject) => {
      const BACKEND_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL;
      if (!BACKEND_URL) {
        reject(new Error('Backend URL not configured'));
        return;
      }

      // Convert HTTP/HTTPS to WS/WSS. Browsers can't set WS headers, so the JWT
      // is passed as a ?token= query param (mirrors managerWebSocketService).
      const wsUrl = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://') +
                    `/ws/talkmore/jobs/${jobId}/?token=${refreshedToken}`;

      console.log('[talkmoreWebSocketService] Backend URL:', BACKEND_URL);
      console.log('[talkmoreWebSocketService] WebSocket URL:', wsUrl);
      console.log('[talkmoreWebSocketService] Token being used:', refreshedToken ? refreshedToken.substring(0, 50) + '...' : 'null');

      this.ws = new WebSocket(wsUrl);

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout

      this.ws.onopen = () => {
        console.log('[talkmoreWebSocketService] WebSocket connected successfully:', wsUrl);
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyStatusListeners(true);
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[talkmoreWebSocketService] Message received:', data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[talkmoreWebSocketService] Error parsing WebSocket message:', error);
          console.error('[talkmoreWebSocketService] Raw message data:', event.data);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[talkmoreWebSocketService] WebSocket disconnected:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        this.notifyStatusListeners(false);

        // Auto-reconnect if not a normal closure and job is not done
        if (event.code !== 1000 && this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[talkmoreWebSocketService] WebSocket error:', error);
        clearTimeout(connectionTimeout);
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
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 
      this.maxReconnectDelay
    );

    console.log(`[talkmoreWebSocketService] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.autoReconnect && this.currentToken && this.currentJobId) {
        console.log(`[talkmoreWebSocketService] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(this.currentJobId, this.currentToken).catch(error => {
          console.error('[talkmoreWebSocketService] Reconnection failed:', error);
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
      this.currentJobId = null;
    }

    // Clear ping interval if exists
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * Send message to WebSocket
   * @param {Object} message - Message to send
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[talkmoreWebSocketService] Sending message:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[talkmoreWebSocketService] WebSocket is not connected');
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} data - Message data
   */
  handleMessage(data) {
    const { type, ...payload } = data;

    console.log(`[talkmoreWebSocketService] Handling message type: ${type}`, payload);

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

    // Handle initial_status - sent on connect
    if (type === 'initial_status') {
      console.log('[talkmoreWebSocketService] Received initial_status:', payload.job);
      if (payload.job) {
        this.notifyJobStatusListeners(payload.job);
      }
      return;
    }

    // Handle feature.done - sent 1 by 1 as addresses are enriched
    if (type === 'feature.done') {
      console.log('[talkmoreWebSocketService] Received feature.done:', payload);
      this.notifyFeatureListeners({
        address_uuid: payload.address_uuid,
        lat: payload.lat,
        lon: payload.lon,
        address_text: payload.address_text,
        carrier_summary: payload.carrier_summary,
        show_marker: payload.show_marker,
        timestamp: payload.timestamp
      });
      return;
    }

    // Handle job.done - sent when job completes
    if (type === 'job.done') {
      console.log('[talkmoreWebSocketService] Received job.done:', payload);
      this.notifyJobStatusListeners({
        status: 'done',
        finished_at: payload.timestamp,
        total_addresses: payload.total_addresses,
        success_count: payload.success_count,
        no_data_count: payload.no_data_count,
        failed_count: payload.failed_count
      });
      // Notify listeners
      this.notifyListeners('job.done', payload);
      return;
    }

    // Handle job_status - response to get_status request
    if (type === 'job_status') {
      console.log('[talkmoreWebSocketService] Received job_status:', payload.status);
      if (payload.status) {
        this.notifyJobStatusListeners(payload.status);
      }
      return;
    }

    // Handle error messages
    if (type === 'error') {
      console.error('[talkmoreWebSocketService] Received error:', payload.message);
      this.notifyListeners('error', payload);
      return;
    }

    // Handle general messages
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
          console.error(`[talkmoreWebSocketService] Error in ${eventType} listener:`, error);
        }
      });
    }
  }

  /**
   * Request job status update
   */
  requestStatus() {
    this.send({
      type: 'get_status'
    });
    console.log('[talkmoreWebSocketService] Requested status update');
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Get current job ID
   * @returns {string|null} Current job ID
   */
  getCurrentJobId() {
    return this.currentJobId;
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
      currentJobId: this.currentJobId,
      currentToken: this.currentToken ? '***' : null
    };
  }

  /**
   * Refresh connection with new token
   * @param {string} newToken - New JWT token
   */
  async refreshConnection(newToken) {
    console.log('[talkmoreWebSocketService] Refreshing connection with new token');
    const jobId = this.currentJobId;
    this.disconnect();
    this.currentToken = newToken;
    if (jobId) {
      await this.connect(jobId, newToken);
    }
  }

  /**
   * Refresh JWT token if needed
   * @param {string} currentToken - Current JWT token
   * @returns {string} Refreshed or current token
   */
  async refreshTokenIfNeeded(currentToken) {
    try {
      return await refreshManagerToken();
    } catch (error) {
      console.error('[talkmoreWebSocketService] Token refresh error:', error);
      handleAuthFailure();
      return currentToken;
    }
  }
}

// Create singleton instance
const talkmoreWebSocketService = new TalkmoreWebSocketService();

export default talkmoreWebSocketService;
