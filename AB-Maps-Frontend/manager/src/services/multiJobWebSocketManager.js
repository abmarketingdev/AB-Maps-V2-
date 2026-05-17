/**
 * Multi-Job WebSocket Manager
 * Manages multiple concurrent enrichment job WebSocket connections
 * 
 * This service allows tracking multiple enrichment jobs simultaneously,
 * each with its own WebSocket connection and state management.
 */
import EnrichmentJobWebSocket from './enrichmentJobWebSocket';
import authService from './authService';
import { refreshManagerToken } from '../utils/tokenRefresh';

class MultiJobWebSocketManager {
  constructor(accessToken) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    
    this.accessToken = accessToken;
    this.connections = new Map(); // Map<jobId, EnrichmentJobWebSocket>
    this.jobMetadata = new Map(); // Map<jobId, { areaId, areaName, callbacks }>
    this.reconnectDelays = new Map(); // Map<jobId, delay>
    this.errorHistory = new Map(); // Map<jobId, Array<error>>
  }

  /**
   * Connect to a specific enrichment job
   * @param {string} jobId - Enrichment job UUID
   * @param {string} areaId - Area UUID (for tracking)
   * @param {string} areaName - Area name (for display)
   * @param {Object} callbacks - Event callbacks
   * @param {Function} callbacks.onStatus - Called when job status updates
   * @param {Function} callbacks.onFeatureDone - Called when a feature is enriched
   * @param {Function} callbacks.onJobDone - Called when job completes
   * @param {Function} callbacks.onError - Called when an error occurs
   * @param {Function} callbacks.onConnectionChange - Called when connection state changes
   * @returns {Promise<void>}
   */
  async connectToJob(jobId, areaId, areaName, callbacks = {}) {
    console.log('[MultiJobWebSocketManager] Connecting to job:', {
      jobId,
      areaId,
      areaName,
      timestamp: new Date().toISOString()
    });

    if (!jobId) {
      const error = new Error('Job ID is required');
      console.error('[MultiJobWebSocketManager] Connection failed:', error);
      throw error;
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      const error = new Error(`Invalid job ID format: ${jobId}`);
      console.error('[MultiJobWebSocketManager] Connection failed:', error);
      throw error;
    }

    // If already connected to this job, return
    const existingConnection = this.connections.get(jobId);
    if (existingConnection && existingConnection.getConnectionStatus()) {
      console.log('[MultiJobWebSocketManager] Already connected to job:', jobId);
      return Promise.resolve();
    }

    // Disconnect existing connection if any (might be in reconnecting state)
    if (existingConnection) {
      console.log('[MultiJobWebSocketManager] Disconnecting existing connection for job:', jobId);
      this.disconnectFromJob(jobId);
    }

    // Store job metadata
    this.jobMetadata.set(jobId, {
      areaId,
      areaName,
      callbacks,
      connectedAt: new Date().toISOString(),
      lastStatus: null
    });

    // Initialize error history for this job
    if (!this.errorHistory.has(jobId)) {
      this.errorHistory.set(jobId, []);
    }

    // Create new WebSocket connection
    const ws = new EnrichmentJobWebSocket(jobId, this.accessToken);

    // Set up callbacks with error tracking
    ws.setCallbacks({
      onStatus: (status) => {
        console.log('[MultiJobWebSocketManager] Status update for job:', jobId, status);
        const metadata = this.jobMetadata.get(jobId);
        if (metadata) {
          metadata.lastStatus = status;
        }
        if (callbacks.onStatus) {
          try {
            callbacks.onStatus(status);
          } catch (error) {
            console.error('[MultiJobWebSocketManager] Error in onStatus callback:', {
              jobId,
              error: error.message,
              stack: error.stack
            });
          }
        }
      },
      onFeatureDone: (featureData) => {
        console.log('[MultiJobWebSocketManager] Feature done for job:', jobId, featureData);
        if (callbacks.onFeatureDone) {
          try {
            callbacks.onFeatureDone(featureData);
          } catch (error) {
            console.error('[MultiJobWebSocketManager] Error in onFeatureDone callback:', {
              jobId,
              error: error.message,
              stack: error.stack
            });
          }
        }
      },
      onJobDone: (jobData) => {
        console.log('[MultiJobWebSocketManager] Job done for job:', jobId, jobData);
        if (callbacks.onJobDone) {
          try {
            callbacks.onJobDone(jobData);
          } catch (error) {
            console.error('[MultiJobWebSocketManager] Error in onJobDone callback:', {
              jobId,
              error: error.message,
              stack: error.stack
            });
          }
        }
        // Optionally disconnect after job is done (or keep for status updates)
        // this.disconnectFromJob(jobId);
      },
      onError: (errorMessage) => {
        console.error('[MultiJobWebSocketManager] Error for job:', jobId, errorMessage);
        
        // Track error in history
        const errors = this.errorHistory.get(jobId) || [];
        errors.push({
          message: errorMessage,
          timestamp: new Date().toISOString()
        });
        // Keep only last 10 errors per job
        if (errors.length > 10) {
          errors.shift();
        }
        this.errorHistory.set(jobId, errors);

        if (callbacks.onError) {
          try {
            callbacks.onError(errorMessage);
          } catch (error) {
            console.error('[MultiJobWebSocketManager] Error in onError callback:', {
              jobId,
              error: error.message,
              stack: error.stack
            });
          }
        }
      },
      onConnectionChange: (isConnected) => {
        console.log('[MultiJobWebSocketManager] Connection change for job:', jobId, 'connected:', isConnected);
        if (callbacks.onConnectionChange) {
          try {
            callbacks.onConnectionChange(isConnected);
          } catch (error) {
            console.error('[MultiJobWebSocketManager] Error in onConnectionChange callback:', {
              jobId,
              error: error.message,
              stack: error.stack
            });
          }
        }
      }
    });

    // Store connection
    this.connections.set(jobId, ws);

    // Attempt connection
    try {
      await ws.connect();
      console.log('[MultiJobWebSocketManager] Connection established for job:', jobId);
    } catch (error) {
      console.error('[MultiJobWebSocketManager] Connection failed for job:', jobId, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      // Track error
      const errors = this.errorHistory.get(jobId) || [];
      errors.push({
        message: `Connection failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      this.errorHistory.set(jobId, errors);

      // Remove failed connection
      this.connections.delete(jobId);
      
      throw error;
    }
  }

  /**
   * Disconnect from a specific job
   * @param {string} jobId - Enrichment job UUID
   */
  disconnectFromJob(jobId) {
    console.log('[MultiJobWebSocketManager] Disconnecting from job:', jobId);

    const ws = this.connections.get(jobId);
    if (ws) {
      ws.disconnect();
      this.connections.delete(jobId);
    }

    // Clean up metadata
    this.jobMetadata.delete(jobId);
    this.reconnectDelays.delete(jobId);
    // Keep error history for debugging (optional: clear after some time)
  }

  /**
   * Disconnect from all jobs
   */
  disconnectAll() {
    console.log('[MultiJobWebSocketManager] Disconnecting from all jobs:', this.connections.size);

    const jobIds = Array.from(this.connections.keys());
    jobIds.forEach(jobId => {
      this.disconnectFromJob(jobId);
    });

    console.log('[MultiJobWebSocketManager] All connections closed');
  }

  /**
   * Request status for a specific job
   * @param {string} jobId - Enrichment job UUID
   */
  requestStatus(jobId) {
    console.log('[MultiJobWebSocketManager] Requesting status for job:', jobId);

    const ws = this.connections.get(jobId);
    if (ws) {
      ws.requestStatus();
    } else {
      console.warn('[MultiJobWebSocketManager] No connection found for job:', jobId);
    }
  }

  /**
   * Get active job IDs
   * @returns {string[]} Array of active job IDs
   */
  getActiveJobIds() {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if job is connected
   * @param {string} jobId - Enrichment job UUID
   * @returns {boolean} True if connected
   */
  isJobConnected(jobId) {
    const ws = this.connections.get(jobId);
    return ws ? ws.getConnectionStatus() : false;
  }

  /**
   * Get job metadata
   * @param {string} jobId - Enrichment job UUID
   * @returns {Object|null} Job metadata or null if not found
   */
  getJobMetadata(jobId) {
    return this.jobMetadata.get(jobId) || null;
  }

  /**
   * Get error history for a job
   * @param {string} jobId - Enrichment job UUID
   * @returns {Array} Array of error objects
   */
  getJobErrorHistory(jobId) {
    return this.errorHistory.get(jobId) || [];
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.connections.size,
      connectedJobs: [],
      disconnectedJobs: [],
      errors: {}
    };

    this.connections.forEach((ws, jobId) => {
      const metadata = this.jobMetadata.get(jobId);
      const isConnected = ws.getConnectionStatus();
      const jobInfo = {
        jobId,
        areaId: metadata?.areaId || null,
        areaName: metadata?.areaName || null,
        isConnected,
        lastStatus: metadata?.lastStatus || null,
        errorCount: (this.errorHistory.get(jobId) || []).length
      };

      if (isConnected) {
        stats.connectedJobs.push(jobInfo);
      } else {
        stats.disconnectedJobs.push(jobInfo);
      }

      const errors = this.errorHistory.get(jobId);
      if (errors && errors.length > 0) {
        stats.errors[jobId] = errors;
      }
    });

    return stats;
  }

  /**
   * Update access token (for token refresh)
   * @param {string} newToken - New access token
   */
  updateAccessToken(newToken) {
    console.log('[MultiJobWebSocketManager] Updating access token');
    this.accessToken = newToken;

    // Update token for all active connections
    this.connections.forEach((ws, jobId) => {
      // The EnrichmentJobWebSocket will handle token refresh on next connection attempt
      // For active connections, we might need to reconnect with new token
      if (ws.getConnectionStatus()) {
        console.log('[MultiJobWebSocketManager] Reconnecting job with new token:', jobId);
        // Disconnect and reconnect with new token
        ws.disconnect();
        const metadata = this.jobMetadata.get(jobId);
        if (metadata) {
          // Reconnect with new token
          ws.accessToken = newToken;
          ws.connect().catch(error => {
            console.error('[MultiJobWebSocketManager] Reconnection with new token failed:', jobId, error);
          });
        }
      } else {
        // Update token for future connection attempts
        ws.accessToken = newToken;
      }
    });
  }

  /**
   * Refresh token for all connections
   * @returns {Promise<void>}
   */
  async refreshAllTokens() {
    console.log('[MultiJobWebSocketManager] Refreshing tokens for all connections');
    try {
      const newToken = await refreshManagerToken();
      this.updateAccessToken(newToken);
      console.log('[MultiJobWebSocketManager] Tokens refreshed successfully');
    } catch (error) {
      console.error('[MultiJobWebSocketManager] Token refresh error:', error);
      throw error;
    }
  }
}

export default MultiJobWebSocketManager;
