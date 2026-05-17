/**
 * Address service for handling address-related API calls
 */
import { API_CONFIG, ADDRESS_ENDPOINTS } from '../config/apiConfig';
import authService from './authService';

/**
 * Get authentication headers for API requests
 */
const getAuthHeaders = () => {
  const token = authService.getAccessToken();
  const campaignId = authService.getCampaignId();
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
  
  // Add campaign_id to headers if available
  if (campaignId) {
    headers['X-Campaign-ID'] = campaignId;
  }
  
  return headers;
};

/**
 * Address API endpoints
 */
// const ADDRESS_ENDPOINTS = {
//   addresses: `${BACKEND_BASE_URL}/addresses/addresses/`,
//   syncQueue: `${BACKEND_BASE_URL}/addresses/sync-queue/`,
// };

/**
 * Address Service Class
 */
class AddressService {
  /**
   * Get all addresses with optional filtering
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of addresses
   */
  async getAddresses(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          queryParams.append(key, filters[key]);
        }
      });

      const url = queryParams.toString() 
        ? `${ADDRESS_ENDPOINTS.addresses}?${queryParams.toString()}`
        : ADDRESS_ENDPOINTS.addresses;

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.results || data;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      throw error;
    }
  }

  /**
   * Get a single address by ID
   * @param {string} addressId - Address UUID
   * @returns {Promise<Object>} Address object
   */
  async getAddress(addressId) {
    try {
      const response = await fetch(`${ADDRESS_ENDPOINTS.addresses}${addressId}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
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
   * Create a new address
   * @param {Object} addressData - Address data
   * @returns {Promise<Object>} Created address
   */
  async createAddress(addressData) {
    try {
      const response = await fetch(ADDRESS_ENDPOINTS.addresses, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(addressData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating address:', error);
      throw error;
    }
  }

  /**
   * Update an existing address
   * @param {string} addressId - Address UUID
   * @param {Object} addressData - Updated address data
   * @returns {Promise<Object>} Updated address
   */
  async updateAddress(addressId, addressData) {
    try {
      const response = await fetch(`${ADDRESS_ENDPOINTS.addresses}${addressId}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(addressData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  }

  /**
   * Delete an address
   * @param {string} addressId - Address UUID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAddress(addressId) {
    try {
      const response = await fetch(`${ADDRESS_ENDPOINTS.addresses}${addressId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  }

  /**
   * Get sync queue items
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of sync queue items
   */
  async getSyncQueueItems(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          queryParams.append(key, filters[key]);
        }
      });

      const url = queryParams.toString() 
        ? `${ADDRESS_ENDPOINTS.syncQueue}?${queryParams.toString()}`
        : ADDRESS_ENDPOINTS.syncQueue;

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.results || data;
    } catch (error) {
      console.error('Error fetching sync queue items:', error);
      throw error;
    }
  }

  /**
   * Create a sync queue item
   * @param {Object} queueData - Queue item data
   * @returns {Promise<Object>} Created queue item
   */
  async createSyncQueueItem(queueData) {
    try {
      const response = await fetch(ADDRESS_ENDPOINTS.syncQueue, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(queueData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating sync queue item:', error);
      throw error;
    }
  }

  /**
   * Delete a sync queue item
   * @param {string} itemId - Queue item UUID
   * @returns {Promise<boolean>} Success status
   */
  async deleteSyncQueueItem(itemId) {
    try {
      const response = await fetch(`${ADDRESS_ENDPOINTS.syncQueue}${itemId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting sync queue item:', error);
      throw error;
    }
  }

  /**
   * Get address by text (search for existing address)
   * @param {string} addressText - The address text to search for
   * @returns {Promise<Object|null>} Address object if found, null otherwise
   */
  async getAddressByText(addressText) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('search', addressText);
      
      const url = `${ADDRESS_ENDPOINTS.addresses}?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || data;
      
      // Return the first exact match or null if not found
      const exactMatch = results.find(addr => 
        addr.address_text.toLowerCase() === addressText.toLowerCase()
      );
      
      return exactMatch || null;
    } catch (error) {
      console.error('Error searching for address by text:', error);
      throw error;
    }
  }

  /**
   * Get campaign IDs for the current employee
   * @returns {Promise<Object>} Object with campaign_ids array
   */
  async getEmployeeCampaignIds() {
    try {
      const response = await fetch(`${API_CONFIG.backend.baseUrl}/api/campaigns/campaigns/my_campaign_ids/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employee campaign IDs:', error);
      throw error;
    }
  }

  /**
   * Get full campaign details for the current employee
   * @returns {Promise<Array>} Array of campaign objects with details
   */
  async getEmployeeCampaigns() {
    try {
      const response = await fetch(`${API_CONFIG.backend.baseUrl}/api/campaigns/campaigns/my_campaigns_employee/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employee campaigns:', error);
      throw error;
    }
  }

  /**
   * Search addresses with text search
   * @param {string} searchText - Text to search for
   * @returns {Promise<Array>} Array of matching addresses
   */
  async searchAddresses(searchText) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('search', searchText);
      
      const url = `${ADDRESS_ENDPOINTS.addresses}?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.results || data;
    } catch (error) {
      console.error('Error searching addresses:', error);
      throw error;
    }
  }

  /**
   * Get addresses within a specific area (by coordinates)
   * @param {Array} coordinates - Array of [lat, lng] coordinates forming a polygon
   * @returns {Promise<Array>} Array of addresses in the area
   */
  async getAddressesInArea(coordinates) {
    try {
      // Convert coordinates to the format expected by the backend
      const points = coordinates.map(coord => ({
        lat: coord.lat || coord[0],
        lng: coord.lng || coord[1]
      }));

      // For now, we'll use the existing Overpass API functionality
      // In the future, this could be enhanced to use the backend API
      const { getAddressesInPolygon } = await import('./apiService');
      return await getAddressesInPolygon(points);
    } catch (error) {
      console.error('Error getting addresses in area:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const addressService = new AddressService();
export default addressService;

// Also export the class for testing purposes
export { AddressService }; 