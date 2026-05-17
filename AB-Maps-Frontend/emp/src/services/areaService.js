/**
 * Area service for managing areas (employee app)
 */
import { API_CONFIG } from '../config/apiConfig';
import { fetchWithAuthRefresh } from '../utils/apiInterceptor';
import { getAccessToken } from '../utils/tokenSync';

/**
 * Get headers without Authorization (interceptor handles it)
 * Includes X-Campaign-ID from localStorage if present
 */
const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Parse campaign ID from localStorage
  let campaignId = null;
  try {
    const campaignRaw = localStorage.getItem('currentCampaign');
    if (campaignRaw) {
      // Handle JSON string format: {"id":"..."}
      if (campaignRaw.startsWith('{') || campaignRaw.startsWith('[')) {
        const campaignObj = JSON.parse(campaignRaw);
        campaignId = campaignObj?.id || campaignObj;
      } else {
        campaignId = campaignRaw;
      }
    }
  } catch (e) {
    console.warn('Failed to parse campaign ID from localStorage:', e);
  }
  
  // Add campaign_id to headers if available
  if (campaignId) {
    headers['X-Campaign-ID'] = campaignId;
  }
  
  return headers;
};

class AreaService {
  /**
   * Get locked areas for a specific campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Object containing locked areas and campaign info
   */
  async getLockedAreas(campaignId) {
    if (!campaignId) {
      throw new Error('Campaign ID is required for locked areas');
    }
    
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const url = `${API_CONFIG.backend.baseUrl}/api/locked-areas/campaigns/${campaignId}/map-areas/`;
    const response = await fetchWithAuthRefresh(url, { 
      method: 'GET',
      headers: getHeaders() 
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to fetch locked areas');
    }
    
    const data = await response.json();
    return data;
  }
}

export const areaService = new AreaService();
export default areaService;

