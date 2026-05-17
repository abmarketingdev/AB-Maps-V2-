import { useState, useCallback, useRef, useEffect } from 'react';
import talkmoreService from '../services/talkmoreService';

/**
 * Custom hook for fetching area-based Talkmore enrichment results
 * 
 * This hook is separate from useTalkmoreJob because it doesn't use WebSocket
 * and is specifically for area-based queries (no job_id needed).
 * 
 * @returns {Object} Hook return object with state and methods
 */
export const useTalkmoreAreaResults = () => {
  // State management
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  /**
   * Fetch enrichment results for an area by area_id
   * 
   * @param {string} areaId - UUID of the area
   * @param {Array} bbox - Optional bounding box [west, south, east, north]
   * @param {boolean} includeAll - If true, include all results (default: true)
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  const fetchResultsByArea = useCallback(async (areaId, bbox = null, includeAll = true) => {
    if (!areaId) {
      console.warn('[useTalkmoreAreaResults] fetchResultsByArea: No area ID provided');
      if (isMountedRef.current) {
        setError('Area ID is required');
      }
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await talkmoreService.getAreaResults(areaId, bbox, includeAll);
      
      if (isMountedRef.current) {
        // Validate response structure
        if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
          setFeatures(data.features);
          setError(null);
        } else {
          // Empty collection is valid (no enrichment job)
          setFeatures([]);
          setError(null);
        }
      }
      
      return data;
    } catch (err) {
      console.error('[useTalkmoreAreaResults] fetchResultsByArea error:', err);
      
      if (isMountedRef.current) {
        // Handle specific error cases
        if (err.message && err.message.includes('Access denied')) {
          setError('Ingen tilgang til dette området');
        } else if (err.message && err.message.includes('Invalid bbox')) {
          setError('Ugyldig bounding box');
        } else {
          setError(err.message || 'Kunne ikke hente resultater');
        }
        setFeatures([]);
      }
      
      return null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Clear results and reset state
   */
  const clearResults = useCallback(() => {
    if (isMountedRef.current) {
      setFeatures([]);
      setError(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    features,
    loading,
    error,
    fetchResultsByArea,
    clearResults
  };
};

export default useTalkmoreAreaResults;
