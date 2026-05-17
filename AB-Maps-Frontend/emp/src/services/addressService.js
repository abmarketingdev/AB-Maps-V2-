/**
 * Address service for handling address-related API calls
 */
import { API_CONFIG } from '../config/apiConfig';
import { streamNdjson } from './ndjson';
import { fetchWithAuthRefresh } from '../utils/apiInterceptor';
import { getAccessToken } from '../utils/tokenSync';
import { sanitizeAddressWritePayload } from '../constants/neiSubcategory';
import { messageFromErrorResponse } from '../utils/apiFieldErrors';

/**
 * Get headers without Authorization (interceptor handles it)
 */
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

/**
 * Get headers with X-Campaign-ID from localStorage if present
 */
const getHeadersWithCampaign = () => {
  const headers = getHeaders();
  try {
    const raw = localStorage.getItem('currentCampaign');
    if (raw) {
      if (raw.startsWith('{') || raw.startsWith('[')) {
        const campaign = JSON.parse(raw);
        if (campaign?.id) headers['X-Campaign-ID'] = campaign.id;
      } else {
        headers['X-Campaign-ID'] = raw;
      }
    }
  } catch (_) {}
  return headers;
};

/**
 * Address API endpoints
 */
const ADDRESS_ENDPOINTS = {
  addresses: `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/`,
  statuses: `${API_CONFIG.backend.baseUrl}/api/addresses/statuses/`,
  syncQueue: `${API_CONFIG.backend.baseUrl}/api/addresses/sync-queue/`,
  uploadedAddresses: `${API_CONFIG.backend.baseUrl}/api/uploaded-addresses/uploaded-addresses/`,
};

/**
 * Address Service Class
 */
class AddressService {
  /**
   * Get all addresses with optional filtering
   * @param {Object} filters - Optional filters
   * @param {string} token - Authentication token
   * @returns {Promise<Array>} Array of addresses
   */
  async getAddresses(filters = {}, token = null) {
    try {
      const accessToken = token || getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          queryParams.append(key, filters[key]);
        }
      });

      // Build initial URL
      const baseUrl = queryParams.toString() 
        ? `${ADDRESS_ENDPOINTS.addresses}?${queryParams.toString()}`
        : ADDRESS_ENDPOINTS.addresses;

      // Paginate through all pages using the "next" attribute
      let url = baseUrl;
      const headers = getHeaders();
      const aggregated = [];

      while (url) {
        const response = await fetchWithAuthRefresh(url, { 
          method: 'GET', 
          headers 
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const pageResults = Array.isArray(data) ? data : (data.results || []);
        aggregated.push(...pageResults);
        url = data?.next || null;
      }

      return aggregated;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      throw error;
    }
  }

  /**
   * Get a single address by ID
   * @param {string} addressId - Address UUID
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Address object
   */
  async getAddress(addressId, token = null) {
    try {
      const accessToken = token || getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const response = await fetchWithAuthRefresh(`${ADDRESS_ENDPOINTS.addresses}${addressId}/`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching address:', error);
      throw error;
    }
  }

  /**
   * Partially update an address (PATCH)
   * Useful for updating only specific fields like notes without sending entire object
   * @param {string} addressId - Address UUID
   * @param {Object} updates - Partial address data (e.g., { notes: "..." })
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Updated address
   */
  async patchAddress(addressId, updates, token = null) {
    try {
      const accessToken = token || getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      const body = sanitizeAddressWritePayload(
        typeof updates === 'object' && updates !== null ? { ...updates } : {}
      );
      const response = await fetchWithAuthRefresh(`${ADDRESS_ENDPOINTS.addresses}${addressId}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await messageFromErrorResponse(response));
      }

      return await response.json();
    } catch (error) {
      console.error('Error patching address:', error);
      throw error;
    }
  }

  /**
   * Get uploaded addresses for a specific campaign and employee
   * @param {string} campaignId - Campaign ID
   * @param {string} employeeId - Employee ID
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Uploaded addresses response
   */
  async getUploadedAddresses(campaignId, employeeId, token = null) {
    try {
      const accessToken = token || getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const queryParams = new URLSearchParams({
        campaign: campaignId,
        campaign_id: campaignId,
        employee: employeeId,
        employee_id: employeeId
      });

      const baseUrl = `${ADDRESS_ENDPOINTS.uploadedAddresses}?${queryParams.toString()}`;
      const headers = getHeaders();

      // Walk through pages until "next" is null
      let url = baseUrl;
      let aggregated = [];
      let count = 0;
      let previous = null;

      while (url) {
        const response = await fetchWithAuthRefresh(url, { 
          method: 'GET', 
          headers 
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const pageResults = Array.isArray(data) ? data : (data.results || []);
        aggregated = aggregated.concat(pageResults);
        if (!count && data && typeof data.count === 'number') {
          count = data.count;
        }
        previous = data?.previous ?? previous;
        url = data?.next || null;
      }

      if (!count) count = aggregated.length;
      return { count, next: null, previous, results: aggregated };
    } catch (error) {
      console.error('Error fetching uploaded addresses:', error);
      throw error;
    }
  }

  /**
   * Get a specific uploaded address by ID
   * @param {string} addressId - Uploaded address ID
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Uploaded address object
   */
  async getUploadedAddress(addressId, token = null) {
    try {
      const accessToken = token || getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      console.log('[AddressService] Fetching uploaded address with ID:', addressId);
      console.log('[AddressService] Using endpoint:', `${ADDRESS_ENDPOINTS.uploadedAddresses}${addressId}/`);
      
      const response = await fetchWithAuthRefresh(`${ADDRESS_ENDPOINTS.uploadedAddresses}${addressId}/`, {
        method: 'GET',
        headers: getHeaders(),
      });

      console.log('[AddressService] Response status:', response.status);
      console.log('[AddressService] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AddressService] Error response text:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AddressService] Received data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching uploaded address:', error);
      throw error;
    }
  }

  /**
   * Stream all addresses via NDJSON (fallback to JSON) and emit items progressively.
   * Each item may include `nei_subcategory` / `nei_subcategory_display` when status is nei.
   */
  async streamAddressesNdjson(token = null, onItem, onDone, onError, signal, extraQuery = {}) {
    const accessToken = token || getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const qs = new URLSearchParams({ bulk: 'true', bulk_format: 'ndjson', ...extraQuery });
    const base = process.env.REACT_APP_BACKEND_URL || API_CONFIG.backend.baseUrl || '';
    const url = `${base}/api/addresses/addresses/?${qs.toString()}`;
    const headers = {
      ...getHeadersWithCampaign(),
      Accept: 'application/x-ndjson'
    };
    delete headers['Content-Type'];
    // Note: streamNdjson uses fetch internally, so we need to pass token for Authorization
    // The interceptor won't work for streaming, so we add token manually
    headers['Authorization'] = `Bearer ${accessToken}`;
    return streamNdjson(url, headers, onItem, onDone, onError, signal);
  }

  /**
   * Stream all uploaded addresses for a campaign via NDJSON (fallback to JSON)
   */
  async streamUploadedAddressesNdjson(campaignId, token = null, onItem, onDone, onError, signal, extraQuery = {}) {
    const accessToken = token || getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const qs = new URLSearchParams({ bulk: 'true', bulk_format: 'ndjson', campaign: campaignId, ...extraQuery });
    const base = process.env.REACT_APP_BACKEND_URL || API_CONFIG.backend.baseUrl || '';
    const url = `${base}/api/uploaded-addresses/uploaded-addresses/?${qs.toString()}`;
    const headers = {
      ...getHeaders(),
      Accept: 'application/x-ndjson'
    };
    delete headers['Content-Type'];
    // Note: streamNdjson uses fetch internally, so we need to pass token for Authorization
    // The interceptor won't work for streaming, so we add token manually
    headers['Authorization'] = `Bearer ${accessToken}`;
    return streamNdjson(url, headers, onItem, onDone, onError, signal);
  }

  /**
   * Get nearby addresses (JSON) - Function 1: Call FIRSTLY
   */
  async getNearbyAddresses(lat, lon, radius_m = 90000, limit = 20000, token = null, campaignId = null) {
    const accessToken = token || getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const base = process.env.REACT_APP_BACKEND_URL || API_CONFIG.backend.baseUrl || '';
    // Always enforce radius 90000m and limit 20000 to match manager
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radius_m: '90000',
      limit: '20000'
    });
    if (campaignId) params.append('campaign_id', campaignId);
    const url = `${base}/api/addresses/nearby/?${params.toString()}`;
    const headers = getHeadersWithCampaign();
    const res = await fetchWithAuthRefresh(url, { 
      headers, 
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error(`Failed to fetch nearby addresses: ${res.status}`);
    const data = await res.json();
    // Ensure it always returns an array
    return Array.isArray(data) ? data : (data.results || []);
  }

  /**
   * Get nearby uploaded addresses (JSON) - Function 2: Call SECOND
   */
  async getNearbyUploadedAddresses(lat, lon, radius_m = 90000, limit = 20000, token = null, campaignId = null) {
    const accessToken = token || getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const base = process.env.REACT_APP_BACKEND_URL || API_CONFIG.backend.baseUrl || '';
    // Always enforce radius 90000m and limit 20000 to match manager
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radius_m: '90000',
      limit: '20000'
    });
    if (campaignId) params.append('campaign_id', campaignId);
    // Note: No manager_id for employee app - employees see all uploaded addresses in campaign
    const url = `${base}/api/uploaded-addresses/nearby/?${params.toString()}`;
    const headers = getHeaders();
    const res = await fetchWithAuthRefresh(url, { 
      headers, 
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error(`Failed to fetch nearby uploaded addresses: ${res.status}`);
    const data = await res.json();
    // Ensure it always returns an array
    return Array.isArray(data) ? data : (data.results || []);
  }
}

// Create and export a singleton instance
const addressService = new AddressService();
export default addressService;

// Also export the class for testing purposes
export { AddressService }; 
