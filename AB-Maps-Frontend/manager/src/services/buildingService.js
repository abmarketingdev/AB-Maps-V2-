/**
 * Building & Apartment Service
 * 
 * Handles API calls for the building-centric apartment system.
 * This replaces direct Geonorge calls with backend-managed apartment data.
 */
import { API_CONFIG } from '../config/apiConfig';
import authService from './authService';
import { messageFromErrorResponse } from '../utils/apiFieldErrors';

const BASE_URL = API_CONFIG.backend.baseUrl;

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
 * Building Service Class
 * 
 * Provides methods for:
 * - Bulk creating apartments (Discovery flow)
 * - Fetching apartments for a building
 * - Updating apartment status (Visit flow)
 * - Getting building summary statistics
 */
class BuildingService {
  
  /**
   * Bulk create apartments for a building (Discovery flow)
   * 
   * This is called when user clicks on empty map space and apartments are found.
   * Backend creates the Building record and all Apartment records.
   * 
   * @param {Object} data - Creation data
   * @param {string} data.base_address - The building's base address
   * @param {string[]} data.apartment_numbers - Array of apartment unit numbers
   * @param {string} data.campaign_id - Campaign UUID
   * @param {Object} data.position - { lat: number, lon: number }
   * @returns {Promise<Object>} Result with building_id, created count, etc.
   * 
   * @example
   * const result = await buildingService.bulkCreateApartments({
   *   base_address: "Hausmanns gate 19A, 0182 Oslo",
   *   apartment_numbers: ["1", "2", "3", "H0101"],
   *   campaign_id: "uuid",
   *   position: { lat: 59.91, lon: 10.75 }
   * });
   * // Returns: { created: 4, skipped: 0, total: 4, building_id: "uuid", building_created: true }
   */
  async bulkCreateApartments(data) {
    try {
      // Get manager ID for created_by field
      const currentUser = authService.getCurrentUser();
      const managerId = currentUser?.user_info?.id || null;

      const response = await fetch(`${BASE_URL}/apartments/bulk-create/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          base_address: data.base_address,
          apartment_numbers: data.apartment_numbers,
          campaign_id: data.campaign_id,
          position: data.position,
          created_by_id: managerId, // Manager creates the building
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BuildingService] bulkCreateApartments error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[BuildingService] bulkCreateApartments success:', result);
      return result;
    } catch (error) {
      console.error('[BuildingService] bulkCreateApartments failed:', error);
      throw error;
    }
  }

  /**
   * Get all apartments for a specific building
   * 
   * @param {string} buildingId - Building UUID
   * @param {Object} options - Optional filters
   * @param {string} options.status - Filter by status ('ja', 'nei', etc., or 'unvisited')
   * @returns {Promise<Object>} Paginated result with apartments array
   * 
   * @example
   * const { results } = await buildingService.getApartments("building-uuid");
   * // Returns: { count: 50, results: [{ id, apartment_number, status, is_visited, ... }] }
   */
  async getApartments(buildingId, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('building_id', buildingId);
      
      // Add optional filters
      if (options.status) {
        queryParams.append('status', options.status);
      }

      const url = `${BASE_URL}/apartments/?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BuildingService] getApartments error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[BuildingService] getApartments success:', {
        buildingId,
        count: result.count || result.results?.length,
        is_talkmore_campaign: result.carrier_info?.is_talkmore_campaign || false
      });
      
      // Return full response including carrier_info
      // Ensure carrier_info is always present with default values
      return {
        count: result.count || 0,
        results: result.results || [],
        carrier_info: result.carrier_info || {
          is_talkmore_campaign: false,
          enriched_count: 0
        }
      };
    } catch (error) {
      console.error('[BuildingService] getApartments failed:', error);
      throw error;
    }
  }

  /**
   * Update apartment status (Mark visit)
   * 
   * This is the main action when an employee visits an apartment.
   * Backend updates the apartment, recalculates building counts,
   * and invalidates tile cache.
   * 
   * @param {string} apartmentId - Apartment UUID
   * @param {string} status - New status: 'ja' | 'nei' | 'ikke_hjemme' | 'folg_opp' | null
   * @param {string} [notes] - Optional notes about the visit
   * @returns {Promise<Object>} Updated apartment object
   * 
   * @example
   * const updated = await buildingService.updateApartmentStatus("apt-uuid", "ja", "Friendly person");
   * // Returns: { id, apartment_number, status: "ja", is_visited: true, building_status: "in_progress" }
   */
  async updateApartmentStatus(apartmentId, status, notes = null, options = {}) {
    try {
      const payload = { status };
      
      // Only include notes if provided (not null/undefined/empty)
      if (notes && notes.trim()) {
        payload.notes = notes.trim();
      }

      if (status === 'nei' && options && Object.prototype.hasOwnProperty.call(options, 'neiSubcategory')) {
        payload.nei_subcategory = options.neiSubcategory;
      }
      if (status !== 'nei' && status !== null && status !== undefined) {
        delete payload.nei_subcategory;
      }

      const response = await fetch(`${BASE_URL}/apartments/${apartmentId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const msg = await messageFromErrorResponse(response);
        console.error('[BuildingService] updateApartmentStatus error:', response.status, msg);
        throw new Error(msg);
      }

      const result = await response.json();
      console.log('[BuildingService] updateApartmentStatus success:', {
        apartmentId,
        newStatus: status,
        buildingStatus: result.building_status
      });
      return result;
    } catch (error) {
      console.error('[BuildingService] updateApartmentStatus failed:', error);
      throw error;
    }
  }

  /**
   * Get building summary statistics
   * 
   * Returns aggregated stats for a building including visit counts
   * and status breakdown.
   * 
   * @param {string} buildingId - Building UUID
   * @returns {Promise<Object>} Building summary
   * 
   * @example
   * const summary = await buildingService.getBuildingSummary("building-uuid");
   * // Returns: {
   * //   building_id: "uuid",
   * //   base_address: "...",
   * //   total_apartments: 50,
   * //   visited: 25,
   * //   unvisited: 25,
   * //   status_breakdown: { ja: 15, nei: 5, ikke_hjemme: 3, folg_opp: 2 },
   * //   building_status: "in_progress",
   * //   is_completed: false
   * // }
   */
  async getBuildingSummary(buildingId) {
    try {
      const response = await fetch(
        `${BASE_URL}/apartments/summary/?building_id=${buildingId}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BuildingService] getBuildingSummary error:', {
          status: response.status,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[BuildingService] getBuildingSummary success:', result);
      return result;
    } catch (error) {
      console.error('[BuildingService] getBuildingSummary failed:', error);
      throw error;
    }
  }

  /**
   * Get a single apartment by ID
   * 
   * @param {string} apartmentId - Apartment UUID
   * @returns {Promise<Object>} Apartment object
   */
  async getApartment(apartmentId) {
    try {
      const response = await fetch(`${BASE_URL}/apartments/${apartmentId}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[BuildingService] getApartment failed:', error);
      throw error;
    }
  }

  /**
   * Create an address record for detailed visit logging (optional)
   * 
   * This can be called after updating apartment status if you want
   * to create a detailed visit record with notes.
   * 
   * @param {Object} data - Address data
   * @param {string} data.address_text - Full address with apartment
   * @param {string} data.status - Visit status
   * @param {Object} data.position - GeoJSON Point
   * @param {string} data.campaign - Campaign UUID
   * @param {string} data.notes - Optional visit notes
   * @param {string} data.building_id - Building UUID (for ghost buster)
   * @returns {Promise<Object>} Created address
   */
  async createVisitLog(data) {
    try {
      const response = await fetch(`${BASE_URL}/addresses/addresses/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          address_text: data.address_text,
          status: data.status,
          position: data.position,
          campaign: data.campaign,
          notes: data.notes || '',
          building_id: data.building_id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[BuildingService] createVisitLog failed:', error);
      throw error;
    }
  }

  /**
   * Delete a building and all its apartments
   * 
   * Only the creator (manager) can delete their own building.
   * Apartments are cascade deleted, but addresses are kept (building_id set to NULL).
   * 
   * @param {string} buildingId - Building UUID
   * @returns {Promise<void>}
   * 
   * @throws {Error} If user is not authorized (403) or building not found (404)
   */
  async deleteBuilding(buildingId) {
    try {
      console.log('[BuildingService] Deleting building:', buildingId);
      
      const response = await fetch(`${BASE_URL}/buildings/${buildingId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.status === 204) {
        console.log('[BuildingService] Building deleted successfully');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (_) {
          errorMessage = errorText || errorMessage;
        }
        
        console.error('[BuildingService] deleteBuilding error:', {
          status: response.status,
          body: errorText
        });
        
        if (response.status === 403) {
          throw new Error('Du har ikke tillatelse til å slette denne bygningen.');
        }
        if (response.status === 404) {
          throw new Error('Bygningen ble ikke funnet.');
        }
        
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('[BuildingService] deleteBuilding failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const buildingService = new BuildingService();
export default buildingService;

// Also export the class for testing
export { BuildingService };

