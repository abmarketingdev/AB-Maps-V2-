/**
 * Talkmore Enrichment Service
 * 
 * Handles API calls for Talkmore enrichment pipeline:
 * - Job status and results
 * - Area-based results
 * - Address details
 */
import { API_CONFIG } from '../config/apiConfig';
import authService from './authService';

const BASE_URL = API_CONFIG.backend.baseUrl;

/**
 * Get authentication headers for API requests
 */
const getAuthHeaders = () => {
  const token = authService.getAccessToken();
  const campaignId = authService.getCampaignId();
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
  
  // Add campaign_id to headers if available
  if (campaignId) {
    headers['X-Campaign-ID'] = campaignId;
  }
  
  return headers;
};

/**
 * Talkmore Service Class
 * 
 * Provides methods for:
 * - Fetching job status
 * - Fetching job results (GeoJSON)
 * - Fetching address details
 * - Fetching area-based results
 */
class TalkmoreService {
  
  /**
   * Get job status
   * 
   * @param {string} jobId - Job UUID
   * @returns {Promise<Object>} Job status object
   * 
   * @example
   * const status = await talkmoreService.getJobStatus('550e8400-e29b-41d4-a716-446655440000');
   * // Returns: { id, status, expected_count, done_count, success_count, ... }
   */
  async getJobStatus(jobId) {
    try {
      if (!jobId) {
        throw new Error('Job ID is required');
      }

      const response = await fetch(`${BASE_URL}/talkmore/jobs/${jobId}/status/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TalkmoreService] getJobStatus error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TalkmoreService] getJobStatus success:', result);
      return result;
    } catch (error) {
      console.error('[TalkmoreService] getJobStatus failed:', error);
      throw error;
    }
  }

  /**
   * Get job results as GeoJSON
   * 
   * @param {string} jobId - Job UUID
   * @param {Array} bbox - Optional bounding box [west, south, east, north]
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   * 
   * @example
   * // Get all results
   * const results = await talkmoreService.getJobResults('550e8400-e29b-41d4-a716-446655440000');
   * 
   * // Get results within bounding box
   * const results = await talkmoreService.getJobResults('550e8400-e29b-41d4-a716-446655440000', [10.0, 59.0, 11.0, 60.0]);
   */
  async getJobResults(jobId, bbox = null) {
    try {
      if (!jobId) {
        throw new Error('Job ID is required');
      }

      let url = `${BASE_URL}/talkmore/jobs/${jobId}/results/`;
      
      // Add bbox parameter if provided
      if (bbox && Array.isArray(bbox) && bbox.length === 4) {
        const [west, south, east, north] = bbox;
        url += `?bbox=${west},${south},${east},${north}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TalkmoreService] getJobResults error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        console.log('[TalkmoreService] getJobResults success:', {
          featureCount: data.features.length
        });
        return data;
      } else {
        throw new Error('Invalid response format: expected GeoJSON FeatureCollection');
      }
    } catch (error) {
      console.error('[TalkmoreService] getJobResults failed:', error);
      throw error;
    }
  }

  /**
   * Get address details
   * 
   * @param {string} jobId - Job UUID
   * @param {string} addressUuid - Address UUID
   * @returns {Promise<Object>} Address details object
   * 
   * @example
   * const details = await talkmoreService.getAddressDetails(
   *   '550e8400-e29b-41d4-a716-446655440000',
   *   '610370fa-3cbb-57fc-8587-8d3e693cd3f8'
   * );
   * // Returns: { id, address_uuid, address_text, people, carrier_summary, ... }
   */
  async getAddressDetails(jobId, addressUuid) {
    try {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      if (!addressUuid) {
        throw new Error('Address UUID is required');
      }

      const response = await fetch(`${BASE_URL}/talkmore/jobs/${jobId}/results/${addressUuid}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TalkmoreService] getAddressDetails error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TalkmoreService] getAddressDetails success:', result);
      return result;
    } catch (error) {
      console.error('[TalkmoreService] getAddressDetails failed:', error);
      throw error;
    }
  }

  /**
   * Get enrichment results by area_id
   * 
   * This endpoint allows fetching results without knowing the job_id.
   * Useful for AreaDialog integration where we only have area_id.
   * 
   * @param {string} areaId - Area UUID
   * @param {Array} bbox - Optional bounding box [west, south, east, north]
   * @returns {Promise<Object>} GeoJSON FeatureCollection (empty if no enrichment job)
   * 
   * @example
   * // Get all results for an area
   * const results = await talkmoreService.getAreaResults('area-uuid-123');
   * 
   * // Get results within bounding box
   * const results = await talkmoreService.getAreaResults('area-uuid-123', [10.0, 59.0, 11.0, 60.0]);
   * 
   * // Returns empty FeatureCollection if area has no enrichment job (404)
   */
  async getAreaResults(areaId, bbox = null, includeAll = true) {
    try {
      if (!areaId) {
        throw new Error('Area ID is required');
      }

      let url = `${BASE_URL}/talkmore/areas/${areaId}/results/`;
      const queryParams = [];
      
      // Add bbox parameter if provided
      if (bbox && Array.isArray(bbox) && bbox.length === 4) {
        const [west, south, east, north] = bbox;
        queryParams.push(`bbox=${west},${south},${east},${north}`);
      }
      
      // Add include_all parameter (default: true)
      if (includeAll) {
        queryParams.push('include_all=true');
      }
      
      // Append query string if we have any parameters
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      // Handle 404 - No enrichment job for this area (not an error, just empty)
      if (response.status === 404) {
        console.log('[TalkmoreService] getAreaResults: No enrichment job found for area', areaId);
        return {
          type: 'FeatureCollection',
          features: []
        };
      }

      // Handle 403 - Access denied
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Access denied to this area');
      }

      // Handle 400 - Invalid bbox
      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid bbox parameter');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TalkmoreService] getAreaResults error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        console.log('[TalkmoreService] getAreaResults success:', {
          areaId,
          featureCount: data.features.length
        });
        return data;
      } else {
        throw new Error('Invalid response format: expected GeoJSON FeatureCollection');
      }
    } catch (error) {
      console.error('[TalkmoreService] getAreaResults failed:', error);
      throw error;
    }
  }

  /**
   * Create new enrichment job (if needed in future)
   * 
   * @param {Object} params - Job creation parameters
   * @returns {Promise<Object>} Created job object
   */
  async createJob(params) {
    try {
      const response = await fetch(`${BASE_URL}/talkmore/jobs/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TalkmoreService] createJob error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TalkmoreService] createJob success:', result);
      return result;
    } catch (error) {
      console.error('[TalkmoreService] createJob failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const talkmoreService = new TalkmoreService();

export default talkmoreService;
