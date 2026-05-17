import { useState, useEffect, useCallback, useRef } from 'react';
import talkmoreService from '../services/talkmoreService';
import talkmoreWebSocketService from '../services/talkmoreWebSocketService';
import authService from '../services/authService';

/**
 * Custom hook for managing Talkmore job state, API calls, and WebSocket connection
 * 
 * @param {string} jobId - Job UUID (optional, if not provided, WebSocket won't connect)
 * @param {boolean} autoConnect - Whether to automatically connect WebSocket on mount (default: true)
 * @returns {Object} Hook return object with state and methods
 */
export const useTalkmoreJob = (jobId = null, autoConnect = true) => {
  // State management
  const [jobStatus, setJobStatus] = useState(null);
  const [features, setFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs to track if we're mounted and prevent state updates after unmount
  const isMountedRef = useRef(true);
  const currentJobIdRef = useRef(null);

  /**
   * Fetch job status via REST API (fallback)
   */
  const fetchJobStatus = useCallback(async () => {
    if (!jobId) {
      console.warn('[useTalkmoreJob] fetchJobStatus: No job ID provided');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const status = await talkmoreService.getJobStatus(jobId);
      if (isMountedRef.current) {
        setJobStatus(status);
      }
      return status;
    } catch (err) {
      console.error('[useTalkmoreJob] fetchJobStatus error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to fetch job status');
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [jobId]);

  /**
   * Fetch results via REST API (for initial load or filtering)
   * 
   * @param {Array} bbox - Optional bounding box [west, south, east, north]
   */
  const fetchResults = useCallback(async (bbox = null) => {
    if (!jobId) {
      console.warn('[useTalkmoreJob] fetchResults: No job ID provided');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await talkmoreService.getJobResults(jobId, bbox);
      if (isMountedRef.current) {
        if (data && data.features) {
          setFeatures(data.features);
        }
      }
      return data;
    } catch (err) {
      console.error('[useTalkmoreJob] fetchResults error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to fetch results');
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [jobId]);

  /**
   * Fetch address details
   * 
   * @param {string} addressUuid - Address UUID
   */
  const fetchAddressDetails = useCallback(async (addressUuid) => {
    if (!jobId) {
      console.warn('[useTalkmoreJob] fetchAddressDetails: No job ID provided');
      return null;
    }

    if (!addressUuid) {
      console.warn('[useTalkmoreJob] fetchAddressDetails: No address UUID provided');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const details = await talkmoreService.getAddressDetails(jobId, addressUuid);
      return details;
    } catch (err) {
      console.error('[useTalkmoreJob] fetchAddressDetails error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to fetch address details');
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [jobId]);

  /**
   * Fetch area-based results (for AreaDialog integration)
   * 
   * @param {string} areaId - Area UUID
   * @param {Array} bbox - Optional bounding box [west, south, east, north]
   */
  const fetchAreaResults = useCallback(async (areaId, bbox = null) => {
    if (!areaId) {
      console.warn('[useTalkmoreJob] fetchAreaResults: No area ID provided');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await talkmoreService.getAreaResults(areaId, bbox);
      if (isMountedRef.current) {
        if (data && data.features) {
          setFeatures(data.features);
        }
      }
      return data;
    } catch (err) {
      console.error('[useTalkmoreJob] fetchAreaResults error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to fetch area results');
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Request status update via WebSocket
   */
  const requestStatus = useCallback(() => {
    if (isConnected) {
      talkmoreWebSocketService.requestStatus();
    } else {
      console.warn('[useTalkmoreJob] requestStatus: WebSocket not connected');
    }
  }, [isConnected]);

  /**
   * Manually reconnect WebSocket
   */
  const reconnect = useCallback(async () => {
    if (!jobId) {
      console.warn('[useTalkmoreJob] reconnect: No job ID provided');
      return;
    }

    const token = authService.getAccessToken();
    if (!token) {
      console.warn('[useTalkmoreJob] reconnect: No access token available');
      setError('No access token available');
      return;
    }

    try {
      await talkmoreWebSocketService.connect(jobId, token);
    } catch (err) {
      console.error('[useTalkmoreJob] reconnect error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to reconnect');
      }
    }
  }, [jobId]);

  /**
   * Clear all results and reset state
   */
  const clearResults = useCallback(() => {
    setFeatures([]);
    setJobStatus(null);
    setError(null);
  }, []);

  // WebSocket connection management
  useEffect(() => {
    isMountedRef.current = true;

    if (!jobId || !autoConnect) {
      return;
    }

    const token = authService.getAccessToken();
    if (!token) {
      console.warn('[useTalkmoreJob] No access token available for WebSocket connection');
      if (isMountedRef.current) {
        setError('No access token available');
      }
      return;
    }

    // Track current job ID
    currentJobIdRef.current = jobId;

    // Connect to WebSocket
    const connectWebSocket = async () => {
      try {
        await talkmoreWebSocketService.connect(jobId, token);
      } catch (err) {
        console.error('[useTalkmoreJob] WebSocket connection error:', err);
        if (isMountedRef.current) {
          setError(err.message || 'Failed to connect to WebSocket');
        }
      }
    };

    connectWebSocket();

    // Set up WebSocket listeners
    const handleConnectionStatus = (connected) => {
      if (isMountedRef.current && currentJobIdRef.current === jobId) {
        setIsConnected(connected);
      }
    };

    const handleJobStatus = (status) => {
      if (isMountedRef.current && currentJobIdRef.current === jobId) {
        setJobStatus(status);
        setError(null);
      }
    };

    const handleFeatureDone = (featureData) => {
      if (isMountedRef.current && currentJobIdRef.current === jobId) {
        // Only add features with show_marker=true
        if (featureData.show_marker) {
          // Convert feature.done message to GeoJSON Feature format
          const feature = {
            type: 'Feature',
            id: featureData.address_uuid,
            geometry: {
              type: 'Point',
              coordinates: [featureData.lon, featureData.lat]
            },
            properties: {
              address_text: featureData.address_text,
              carrier_summary: featureData.carrier_summary,
              show_marker: featureData.show_marker,
              people: [] // Will be fetched if needed via fetchAddressDetails
            }
          };

          // Add feature to array (avoid duplicates)
          setFeatures(prev => {
            const exists = prev.find(f => f.id === featureData.address_uuid);
            if (exists) {
              return prev; // Don't add duplicate
            }
            return [...prev, feature];
          });
        }
      }
    };

    const handleJobDone = (data) => {
      if (isMountedRef.current && currentJobIdRef.current === jobId) {
        // Update job status to done
        setJobStatus(prev => ({
          ...prev,
          status: 'done',
          finished_at: data.timestamp,
          total_addresses: data.total_addresses,
          success_count: data.success_count,
          no_data_count: data.no_data_count,
          failed_count: data.failed_count
        }));

        // Optionally fetch final results
        // fetchResults();
      }
    };

    const handleError = (errorData) => {
      if (isMountedRef.current && currentJobIdRef.current === jobId) {
        setError(errorData.message || 'WebSocket error');
      }
    };

    // Register listeners
    talkmoreWebSocketService.addStatusListener(handleConnectionStatus);
    talkmoreWebSocketService.addJobStatusListener(handleJobStatus);
    talkmoreWebSocketService.addFeatureListener(handleFeatureDone);
    talkmoreWebSocketService.on('job.done', handleJobDone);
    talkmoreWebSocketService.on('error', handleError);

    // Initial connection status check
    setIsConnected(talkmoreWebSocketService.getConnectionStatus());

    // Cleanup on unmount or jobId change
    return () => {
      isMountedRef.current = false;

      // Remove listeners
      talkmoreWebSocketService.removeStatusListener(handleConnectionStatus);
      talkmoreWebSocketService.removeJobStatusListener(handleJobStatus);
      talkmoreWebSocketService.removeFeatureListener(handleFeatureDone);
      talkmoreWebSocketService.off('job.done', handleJobDone);
      talkmoreWebSocketService.off('error', handleError);

      // Disconnect if this was the current job
      if (currentJobIdRef.current === jobId) {
        talkmoreWebSocketService.disconnect();
        currentJobIdRef.current = null;
      }
    };
  }, [jobId, autoConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    // State
    jobStatus,
    features,
    isLoading,
    isConnected,
    error,

    // Methods
    fetchJobStatus,
    fetchResults,
    fetchAddressDetails,
    fetchAreaResults,
    requestStatus,
    reconnect,
    clearResults
  };
};

export default useTalkmoreJob;
