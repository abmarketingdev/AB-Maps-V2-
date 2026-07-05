/**
 * Building & Apartment Service (Employee App)
 * 
 * Handles API calls for the building-centric apartment system.
 * This replaces direct Geonorge calls with backend-managed apartment data.
 */
import { API_CONFIG } from '../config/apiConfig';
import { fetchWithAuthRefresh } from '../utils/apiInterceptor';
import { getAccessToken } from '../utils/tokenSync';
import { messageFromErrorResponse } from '../utils/apiFieldErrors';

const BASE_URL = API_CONFIG.backend.baseUrl;

/**
 * Get authentication headers for API requests
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
   */
  async bulkCreateApartments(data) {
    try {
      // Get employee ID for created_by_employee field
      const employeeId = data.employee_id || null;

      const response = await fetchWithAuthRefresh(`${BASE_URL}/api/apartments/bulk-create/`, {
        method: 'POST',
        headers: getHeadersWithCampaign(),
        body: JSON.stringify({
          base_address: data.base_address,
          apartment_numbers: data.apartment_numbers,
          campaign_id: data.campaign_id,
          position: data.position,
          created_by_employee_id: employeeId, // Employee creates the building
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
   */
  async getApartments(buildingId, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('building_id', buildingId);
      
      // Add optional filters
      if (options.status) {
        queryParams.append('status', options.status);
      }

      const url = `${BASE_URL}/api/apartments/?${queryParams.toString()}`;
      
      const response = await fetchWithAuthRefresh(url, {
        method: 'GET',
        headers: getHeadersWithCampaign(),
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
   * @param {{ neiSubcategory?: string|null }} [options] - When status is nei, set reason or null (unspecified)
   * @returns {Promise<Object>} Updated apartment object
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

      // GPS proximity guard: pass the knocker's live location when available. If omitted,
      // the backend falls back to the latest tracking-WS ping for this user.
      if (
        options && options.userLocation &&
        typeof options.userLocation.lat === 'number' &&
        typeof options.userLocation.lng === 'number'
      ) {
        payload.user_location = options.userLocation;
      }

      const response = await fetchWithAuthRefresh(`${BASE_URL}/api/apartments/${apartmentId}/`, {
        method: 'PATCH',
        headers: getHeadersWithCampaign(),
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
   * @param {string} buildingId - Building UUID
   * @returns {Promise<Object>} Building summary
   */
  async getBuildingSummary(buildingId) {
    try {
      const response = await fetchWithAuthRefresh(
        `${BASE_URL}/api/apartments/summary/?building_id=${buildingId}`,
        {
          method: 'GET',
          headers: getHeadersWithCampaign(),
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
      const response = await fetchWithAuthRefresh(`${BASE_URL}/api/apartments/${apartmentId}/`, {
        method: 'GET',
        headers: getHeadersWithCampaign(),
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
   * @param {Object} data - Address data
   * @returns {Promise<Object>} Created address
   */
  async createVisitLog(data) {
    try {
      const payload = {
        address_text: data.address_text,
        status: data.status,
        position: data.position,
        campaign: data.campaign,
        notes: data.notes || '',
        building_id: data.building_id,
      };
      if (data.nei_subcategory !== undefined) {
        payload.nei_subcategory = data.nei_subcategory;
      }
      const response = await fetchWithAuthRefresh(`${BASE_URL}/api/addresses/addresses/`, {
        method: 'POST',
        headers: getHeadersWithCampaign(),
        body: JSON.stringify(payload),
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
   * Only the creator (employee) can delete their own building.
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
      
      const response = await fetchWithAuthRefresh(`${BASE_URL}/api/buildings/${buildingId}/`, {
        method: 'DELETE',
        headers: getHeadersWithCampaign(),
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

