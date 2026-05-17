/**
 * Enrichment Job WebSocket Handler
 * Handles WebSocket connection for a single enrichment job
 * 
 * This is used by MultiJobWebSocketManager to manage individual job connections
 */
import authService from './authService';
import { refreshManagerToken, handleAuthFailure } from '../utils/tokenRefresh';

class EnrichmentJobWebSocket {
  constructor(jobId, accessToken) {
    this.jobId = jobId;
    this.accessToken = accessToken;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.pingInterval = null;
    this.pongTimeout = null;
    this.autoReconnect = true;
    this.reconnectTimeout = null;
    this.connectionTimeout = null;
    
    // Event callbacks
    this.callbacks = {
      onStatus: null,
      onFeatureDone: null,
      onJobDone: null,
      onError: null,
      onConnectionChange: null
    };
    
    // Throttle status requests to avoid overwhelming the server
    this.lastStatusRequestTime = 0;
    this.statusRequestThrottle = 500; // Request status at most once per 500ms
    this.pendingStatusRequest = null;
  }

  /**
   * Set event callbacks
   * @param {Object} callbacks - Callback functions
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Connect to WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    console.log('[EnrichmentJobWebSocket] Connecting to job:', this.jobId);
    
    if (!this.jobId) {
      const error = new Error('Job ID is required');
      console.error('[EnrichmentJobWebSocket] Connection failed:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error.message);
      }
      throw error;
    }

    // If already connected, return
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[EnrichmentJobWebSocket] Already connected to job:', this.jobId);
      return Promise.resolve();
    }

    // Try to refresh token if needed before connecting
    const refreshedToken = await this.refreshTokenIfNeeded(this.accessToken);
    this.accessToken = refreshedToken;

    return new Promise((resolve, reject) => {
      const BACKEND_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL;
      if (!BACKEND_URL) {
        const error = new Error('Backend URL not configured');
        console.error('[EnrichmentJobWebSocket] Connection failed:', error);
        if (this.callbacks.onError) {
          this.callbacks.onError(error.message);
        }
        reject(error);
        return;
      }

      // Convert HTTP/HTTPS to WS/WSS
      // Include token as query parameter (same pattern as managerWebSocketService)
      const wsUrl = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://') + 
                    `/ws/talkmore/jobs/${this.jobId}/?token=${encodeURIComponent(refreshedToken)}`;

      console.log('[EnrichmentJobWebSocket] Backend URL:', BACKEND_URL);
      console.log('[EnrichmentJobWebSocket] WebSocket URL:', wsUrl.replace(/\?token=[^&]+/, '?token=***'));
      console.log('[EnrichmentJobWebSocket] Token being used:', refreshedToken ? refreshedToken.substring(0, 50) + '...' : 'null');

      try {
        this.ws = new WebSocket(wsUrl);

        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.error('[EnrichmentJobWebSocket] Connection timeout for job:', this.jobId);
            this.ws.close();
            const error = new Error('WebSocket connection timeout');
            if (this.callbacks.onError) {
              this.callbacks.onError(error.message);
            }
            reject(error);
          }
        }, 10000); // 10 second timeout

        this.ws.onopen = () => {
          console.log('[EnrichmentJobWebSocket] WebSocket connected successfully:', wsUrl, 'for job:', this.jobId);
          clearTimeout(this.connectionTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          if (this.callbacks.onConnectionChange) {
            this.callbacks.onConnectionChange(true);
          }
          
          // Start ping interval (every 60 seconds)
          this.startPingInterval();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[EnrichmentJobWebSocket] Message received for job:', this.jobId, data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[EnrichmentJobWebSocket] Error parsing WebSocket message:', {
              jobId: this.jobId,
              error: error.message,
              rawMessage: event.data,
              timestamp: new Date().toISOString()
            });
            
            if (this.callbacks.onError) {
              this.callbacks.onError(`Message parse error: ${error.message}`);
            }
          }
        };

        this.ws.onclose = (event) => {
          console.log('[EnrichmentJobWebSocket] WebSocket disconnected:', {
            jobId: this.jobId,
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            timestamp: new Date().toISOString()
          });
          
          clearTimeout(this.connectionTimeout);
          this.isConnected = false;
          
          if (this.callbacks.onConnectionChange) {
            this.callbacks.onConnectionChange(false);
          }
          
          this.stopPingInterval();

          // Handle close codes
          if (event.code === 4000) {
            // Bad Request - No job_id provided
            const error = new Error('Bad Request: No job_id provided');
            console.error('[EnrichmentJobWebSocket] Close code 4000:', error);
            if (this.callbacks.onError) {
              this.callbacks.onError(error.message);
            }
            this.autoReconnect = false; // Don't reconnect for bad requests
            return;
          }

          if (event.code === 4001) {
            // Unauthorized - Token expired
            console.warn('[EnrichmentJobWebSocket] Close code 4001: Unauthorized, attempting token refresh');
            this.handleTokenRefresh().then(() => {
              if (this.autoReconnect) {
                this.scheduleReconnect();
              }
            }).catch(() => {
              const error = new Error('Authentication failed');
              if (this.callbacks.onError) {
                this.callbacks.onError(error.message);
              }
            });
            return;
          }

          if (event.code === 4003) {
            // Forbidden - Job not found or access denied
            const error = new Error('Forbidden: Job not found or access denied');
            console.error('[EnrichmentJobWebSocket] Close code 4003:', error);
            if (this.callbacks.onError) {
              this.callbacks.onError(error.message);
            }
            this.autoReconnect = false; // Don't reconnect for forbidden
            return;
          }

          if (event.code === 1000) {
            // Normal closure
            console.log('[EnrichmentJobWebSocket] Normal closure for job:', this.jobId);
            this.autoReconnect = false;
            return;
          }

          // Auto-reconnect for other errors
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            const error = new Error('Max reconnection attempts reached');
            console.error('[EnrichmentJobWebSocket] Max reconnection attempts reached for job:', this.jobId);
            if (this.callbacks.onError) {
              this.callbacks.onError(error.message);
            }
          }
        };

        this.ws.onerror = (error) => {
          console.error('[EnrichmentJobWebSocket] WebSocket error:', {
            jobId: this.jobId,
            error: error,
            timestamp: new Date().toISOString()
          });
          
          clearTimeout(this.connectionTimeout);
          
          if (this.callbacks.onError) {
            this.callbacks.onError('WebSocket connection error');
          }
          
          reject(error);
        };
      } catch (error) {
        console.error('[EnrichmentJobWebSocket] Error creating WebSocket:', {
          jobId: this.jobId,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        
        if (this.callbacks.onError) {
          this.callbacks.onError(`Connection error: ${error.message}`);
        }
        
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    console.log('[EnrichmentJobWebSocket] Disconnecting from job:', this.jobId);
    
    this.autoReconnect = false;

    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
      this.isConnected = false;
    }

    this.stopPingInterval();
    
    // Clear any pending status request
    if (this.pendingStatusRequest) {
      clearTimeout(this.pendingStatusRequest);
      this.pendingStatusRequest = null;
    }
  }

  /**
   * Send message to WebSocket
   * @param {Object} message - Message to send
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[EnrichmentJobWebSocket] Sending message for job:', this.jobId, message);
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[EnrichmentJobWebSocket] Error sending message:', {
          jobId: this.jobId,
          error: error.message,
          message: message
        });
        if (this.callbacks.onError) {
          this.callbacks.onError(`Send error: ${error.message}`);
        }
      }
    } else {
      console.warn('[EnrichmentJobWebSocket] WebSocket is not connected for job:', this.jobId);
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} data - Message data
   */
  handleMessage(data) {
    // Validate message structure
    if (!data || typeof data !== 'object') {
      console.error('[EnrichmentJobWebSocket] Invalid message: not an object', data);
      return;
    }

    if (!data.type) {
      console.error('[EnrichmentJobWebSocket] Invalid message: missing type', data);
      return;
    }

    const { type, ...payload } = data;

    console.log(`[EnrichmentJobWebSocket] Handling message type: ${type} for job:`, this.jobId, payload);

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
      console.log('[EnrichmentJobWebSocket] Received initial_status for job:', this.jobId, payload.job);
      if (payload.job) {
        if (this.callbacks.onStatus) {
          this.callbacks.onStatus(payload.job);
        }
      } else {
        console.warn('[EnrichmentJobWebSocket] initial_status missing job data:', payload);
      }
      return;
    }

    // Handle feature.done - sent 1 by 1 as addresses are enriched
    if (type === 'feature.done') {
      console.log('[EnrichmentJobWebSocket] Received feature.done for job:', this.jobId, payload);
      if (this.callbacks.onFeatureDone) {
        this.callbacks.onFeatureDone({
          address_uuid: payload.address_uuid,
          lat: payload.lat,
          lon: payload.lon,
          address_text: payload.address_text,
          carrier_summary: payload.carrier_summary,
          show_marker: payload.show_marker,
          timestamp: payload.timestamp
        });
      }
      
      // Request status update to get latest progress after each feature is done
      // Throttle requests to avoid overwhelming the server (max once per 500ms)
      this.requestStatusThrottled();
      
      return;
    }

    // Handle job.done - sent when job completes
    if (type === 'job.done') {
      console.log('[EnrichmentJobWebSocket] Received job.done for job:', this.jobId, payload);
      if (this.callbacks.onJobDone) {
        this.callbacks.onJobDone({
          job_id: payload.job_id || this.jobId,
          total_addresses: payload.total_addresses,
          success_count: payload.success_count,
          no_data_count: payload.no_data_count,
          failed_count: payload.failed_count,
          timestamp: payload.timestamp
        });
      }
      // Disable auto-reconnect after job is done
      this.autoReconnect = false;
      
      // Close WebSocket connection after job is done (with a short delay to ensure message is processed)
      setTimeout(() => {
        console.log('[EnrichmentJobWebSocket] Closing connection after job.done for job:', this.jobId);
        this.disconnect();
      }, 500); // 500ms delay to ensure callback is processed
      
      return;
    }

    // Handle job_status - response to get_status request
    if (type === 'job_status') {
      console.log('[EnrichmentJobWebSocket] Received job_status for job:', this.jobId, payload.status);
      if (payload.status) {
        if (this.callbacks.onStatus) {
          this.callbacks.onStatus(payload.status);
        }
      } else {
        console.warn('[EnrichmentJobWebSocket] job_status missing status data:', payload);
      }
      return;
    }

    // Handle error messages
    if (type === 'error') {
      console.error('[EnrichmentJobWebSocket] Received error for job:', this.jobId, payload.message);
      if (this.callbacks.onError) {
        this.callbacks.onError(payload.message || 'Unknown error');
      }
      return;
    }

    // Unknown message type
    console.warn('[EnrichmentJobWebSocket] Unknown message type:', type, 'for job:', this.jobId);
  }

  /**
   * Request job status update
   */
  requestStatus() {
    this.send({
      type: 'get_status'
    });
    console.log('[EnrichmentJobWebSocket] Requested status update for job:', this.jobId);
  }

  /**
   * Request job status update with throttling
   * Prevents too many requests when receiving many feature.done messages
   */
  requestStatusThrottled() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastStatusRequestTime;

    // If enough time has passed, request immediately
    if (timeSinceLastRequest >= this.statusRequestThrottle) {
      this.lastStatusRequestTime = now;
      this.requestStatus();
      // Clear any pending request
      if (this.pendingStatusRequest) {
        clearTimeout(this.pendingStatusRequest);
        this.pendingStatusRequest = null;
      }
    } else {
      // Schedule a request for later if not already scheduled
      if (!this.pendingStatusRequest) {
        const delay = this.statusRequestThrottle - timeSinceLastRequest;
        this.pendingStatusRequest = setTimeout(() => {
          this.lastStatusRequestTime = Date.now();
          this.requestStatus();
          this.pendingStatusRequest = null;
        }, delay);
      }
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (!this.autoReconnect) {
      console.log('[EnrichmentJobWebSocket] Auto-reconnect disabled for job:', this.jobId);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 
      this.maxReconnectDelay
    );

    console.log(`[EnrichmentJobWebSocket] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms for job:`, this.jobId);

    this.reconnectTimeout = setTimeout(() => {
      if (this.autoReconnect && this.accessToken) {
        console.log(`[EnrichmentJobWebSocket] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) for job:`, this.jobId);
        this.connect().catch(error => {
          console.error('[EnrichmentJobWebSocket] Reconnection failed for job:', this.jobId, error);
          if (this.callbacks.onError) {
            this.callbacks.onError(`Reconnection failed: ${error.message}`);
          }
        });
      }
    }, delay);
  }

  /**
   * Start ping interval
   */
  startPingInterval() {
    this.stopPingInterval(); // Clear any existing interval
    
    // Send ping every 60 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: new Date().toISOString()
        });
      }
    }, 60000);
  }

  /**
   * Stop ping interval
   */
  stopPingInterval() {
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
   * Handle token refresh
   * @returns {Promise<string>} New access token
   */
  async handleTokenRefresh() {
    console.log('[EnrichmentJobWebSocket] Refreshing token for job:', this.jobId);
    const newToken = await this.refreshTokenIfNeeded(this.accessToken);
    this.accessToken = newToken;
    return newToken;
  }

  /**
   * Refresh JWT token if needed
   * @param {string} currentToken - Current JWT token
   * @returns {Promise<string>} Refreshed or current token
   */
  async refreshTokenIfNeeded(currentToken) {
    try {
      return await refreshManagerToken();
    } catch (error) {
      console.error('[EnrichmentJobWebSocket] Token refresh error:', {
        jobId: this.jobId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      handleAuthFailure();
      return currentToken;
    }
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get job ID
   * @returns {string} Job ID
   */
  getJobId() {
    return this.jobId;
  }
}

export default EnrichmentJobWebSocket;
