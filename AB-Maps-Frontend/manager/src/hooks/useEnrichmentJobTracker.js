/**
 * React Hook for Enrichment Job Tracking
 * 
 * Manages multiple enrichment job WebSocket connections and state
 * Provides a simple interface for components to track job progress
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import MultiJobWebSocketManager from '../services/multiJobWebSocketManager';
import authService from '../services/authService';

/**
 * Hook for tracking multiple enrichment jobs
 * @returns {Object} Job tracking state and methods
 */
export const useEnrichmentJobTracker = () => {
  // State: Map<jobId, jobState>
  const [jobs, setJobs] = useState(new Map());
  
  // Manager instance
  const [manager, setManager] = useState(null);
  
  // Ref to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Ref to track manager initialization
  const managerInitializedRef = useRef(false);

  /**
   * Initialize manager on mount
   */
  useEffect(() => {
    isMountedRef.current = true;

    const initializeManager = async () => {
      try {
        const token = authService.getAccessToken();
        if (!token) {
          console.warn('[useEnrichmentJobTracker] No access token available');
          return;
        }

        console.log('[useEnrichmentJobTracker] Initializing MultiJobWebSocketManager');
        const mgr = new MultiJobWebSocketManager(token);
        setManager(mgr);
        managerInitializedRef.current = true;
      } catch (error) {
        console.error('[useEnrichmentJobTracker] Failed to initialize manager:', error);
      }
    };

    initializeManager();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (manager) {
        console.log('[useEnrichmentJobTracker] Cleaning up: disconnecting all jobs');
        manager.disconnectAll();
      }
    };
  }, []); // Only run on mount

  /**
   * Update job state helper
   * @param {string} jobId - Job ID
   * @param {Object} updates - State updates
   */
  const updateJobState = useCallback((jobId, updates) => {
    if (!isMountedRef.current) return;

    setJobs(prev => {
      const newJobs = new Map(prev);
      const currentJob = newJobs.get(jobId) || {};
      newJobs.set(jobId, {
        ...currentJob,
        ...updates,
        jobId // Ensure jobId is always present
      });
      return newJobs;
    });
  }, []);

  /**
   * Add a new job to track
   * @param {string} jobId - Enrichment job UUID
   * @param {string} areaId - Area UUID
   * @param {string} areaName - Area name
   */
  const addJob = useCallback(async (jobId, areaId, areaName) => {
    if (!jobId || !areaId || !areaName) {
      console.error('[useEnrichmentJobTracker] addJob: Missing required parameters', {
        jobId: !!jobId,
        areaId: !!areaId,
        areaName: !!areaName
      });
      return;
    }

    // Wait for manager to be initialized
    if (!managerInitializedRef.current || !manager) {
      console.warn('[useEnrichmentJobTracker] Manager not initialized yet, waiting...');
      // Retry after a short delay
      setTimeout(() => {
        if (manager) {
          addJob(jobId, areaId, areaName);
        }
      }, 100);
      return;
    }

    console.log('[useEnrichmentJobTracker] Adding job:', { jobId, areaId, areaName });

    // Initialize job state
    const initialJobState = {
      jobId,
      areaId,
      areaName,
      status: 'connecting',
      progress: 0,
      expectedCount: 0,
      doneCount: 0,
      successCount: 0,
      noDataCount: 0,
      failedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      isConnected: false,
      error: null
    };

    updateJobState(jobId, initialJobState);

    // Set up callbacks
    const callbacks = {
      onStatus: (status) => {
        if (!isMountedRef.current) return;

        console.log('[useEnrichmentJobTracker] Status update for job:', jobId, status);

        // Determine status from job status
        let jobStatus = 'enriching';
        if (status.status) {
          if (status.status.includes('enriching')) {
            jobStatus = 'enriching';
          } else if (status.status.includes('writing')) {
            jobStatus = 'writing';
          } else if (status.status === 'done' || status.status === 'completed') {
            jobStatus = 'done';
          } else if (status.status === 'error' || status.status === 'failed') {
            jobStatus = 'error';
          }
        }

        // Calculate progress
        let progress = 0;
        if (status.expected_count && status.expected_count > 0) {
          progress = Math.min(100, (status.done_count / status.expected_count) * 100);
        } else if (status.progress_percentage !== undefined) {
          progress = status.progress_percentage;
        }

        updateJobState(jobId, {
          status: jobStatus,
          progress: Math.round(progress * 10) / 10, // Round to 1 decimal
          expectedCount: status.expected_count || status.total_addresses || 0,
          doneCount: status.done_count || 0,
          successCount: status.success_count || 0,
          noDataCount: status.no_data_count || 0,
          failedCount: status.failed_count || 0,
          startedAt: status.started_at || initialJobState.startedAt,
          finishedAt: status.finished_at || null
        });
      },
      onFeatureDone: (featureData) => {
        if (!isMountedRef.current) return;
        // Feature done doesn't change job state significantly, but we could track it
        // For now, we rely on status updates for progress
        console.log('[useEnrichmentJobTracker] Feature done for job:', jobId, featureData);
      },
      onJobDone: (jobData) => {
        if (!isMountedRef.current) return;

        console.log('[useEnrichmentJobTracker] Job done:', jobId, jobData);

        updateJobState(jobId, {
          status: 'done',
          progress: 100,
          expectedCount: jobData.total_addresses || 0,
          doneCount: jobData.total_addresses || 0,
          successCount: jobData.success_count || 0,
          noDataCount: jobData.no_data_count || 0,
          failedCount: jobData.failed_count || 0,
          finishedAt: jobData.timestamp || new Date().toISOString()
        });

        // Optionally remove job after a delay (or keep it for display)
        // setTimeout(() => {
        //   removeJob(jobId);
        // }, 5000); // Remove after 5 seconds
      },
      onError: (errorMessage) => {
        if (!isMountedRef.current) return;

        console.error('[useEnrichmentJobTracker] Error for job:', jobId, errorMessage);

        updateJobState(jobId, {
          status: 'error',
          error: errorMessage
        });
      },
      onConnectionChange: (isConnected) => {
        if (!isMountedRef.current) return;

        console.log('[useEnrichmentJobTracker] Connection change for job:', jobId, isConnected);

        updateJobState(jobId, {
          isConnected,
          status: isConnected ? 'enriching' : 'connecting'
        });
      }
    };

    // Connect to job via manager
    try {
      await manager.connectToJob(jobId, areaId, areaName, callbacks);
      console.log('[useEnrichmentJobTracker] Successfully connected to job:', jobId);
    } catch (error) {
      console.error('[useEnrichmentJobTracker] Failed to connect to job:', jobId, error);
      updateJobState(jobId, {
        status: 'error',
        error: error.message || 'Failed to connect',
        isConnected: false
      });
    }
  }, [manager, updateJobState]);

  /**
   * Remove a job from tracking
   * @param {string} jobId - Enrichment job UUID
   */
  const removeJob = useCallback((jobId) => {
    if (!jobId) {
      console.warn('[useEnrichmentJobTracker] removeJob: No job ID provided');
      return;
    }

    console.log('[useEnrichmentJobTracker] Removing job:', jobId);

    if (manager) {
      manager.disconnectFromJob(jobId);
    }

    if (!isMountedRef.current) return;

    setJobs(prev => {
      const newJobs = new Map(prev);
      newJobs.delete(jobId);
      return newJobs;
    });
  }, [manager]);

  /**
   * Get active jobs as array
   * @returns {Array} Array of job objects
   */
  const getActiveJobs = useCallback(() => {
    return Array.from(jobs.values()).filter(job => {
      // Consider a job active if it's not done and not in error state
      // Or if it's done but recently completed (within last 5 minutes)
      if (job.status === 'done') {
        if (job.finishedAt) {
          const finishedTime = new Date(job.finishedAt).getTime();
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          return finishedTime > fiveMinutesAgo;
        }
        return false;
      }
      return job.status !== 'error' || job.isConnected;
    });
  }, [jobs]);

  /**
   * Get all jobs (including completed/error)
   * @returns {Array} Array of all job objects
   */
  const getAllJobs = useCallback(() => {
    return Array.from(jobs.values());
  }, [jobs]);

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Object|null} Job state or null
   */
  const getJob = useCallback((jobId) => {
    return jobs.get(jobId) || null;
  }, [jobs]);

  /**
   * Request status update for a job
   * @param {string} jobId - Job ID
   */
  const requestJobStatus = useCallback((jobId) => {
    if (!jobId) {
      console.warn('[useEnrichmentJobTracker] requestJobStatus: No job ID provided');
      return;
    }

    if (manager) {
      manager.requestStatus(jobId);
    } else {
      console.warn('[useEnrichmentJobTracker] requestJobStatus: Manager not available');
    }
  }, [manager]);

  /**
   * Check if there are any active jobs
   * @returns {boolean}
   */
  const hasActiveJobs = jobs.size > 0 && getActiveJobs().length > 0;

  /**
   * Get connection statistics
   * @returns {Object} Connection stats
   */
  const getConnectionStats = useCallback(() => {
    if (!manager) {
      return {
        totalConnections: 0,
        connectedJobs: [],
        disconnectedJobs: [],
        errors: {}
      };
    }
    return manager.getConnectionStats();
  }, [manager]);

  return {
    // State
    jobs,
    manager,
    
    // Methods
    addJob,
    removeJob,
    getActiveJobs,
    getAllJobs,
    getJob,
    requestJobStatus,
    getConnectionStats,
    
    // Computed
    hasActiveJobs,
    activeJobsCount: getActiveJobs().length,
    totalJobsCount: jobs.size
  };
};

export default useEnrichmentJobTracker;
