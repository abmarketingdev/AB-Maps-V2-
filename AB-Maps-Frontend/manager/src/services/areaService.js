/**
 * Area service for managing areas (production, no dummy data)
 */
import authService from './authService';
import { API_CONFIG as MainAPI_CONFIG } from '../config/apiConfig';

const API_CONFIG = {
  baseUrl: MainAPI_CONFIG.backend.baseUrl,
  endpoints: {
    areas: '/areas/areas',
    areaEmployees: '/areas/area-employees',
    addEmployee: (areaId) => `/areas/areas/${areaId}/add_employee/`,
    removeEmployee: (areaId) => `/areas/areas/${areaId}/remove_employee/`,
    areaDetail: (areaId) => `/areas/areas/${areaId}/`,
    myAreas: '/areas/areas/my_areas/',
    unassignedEmployees: (areaId) => `/areas/areas/${areaId}/unassigned_employees/`,
    assignedEmployees: (areaId) => `/areas/areas/${areaId}/employees/`,
  }
};

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

class AreaService {
  /**
   * Get all areas (for viewing)
   * @returns {Promise<Array>} Array of areas
   */
  async getAllAreas() {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.areas}/`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch areas');
    const data = await response.json();
    // Always return an array
    return Array.isArray(data) ? data : (data.results || []);
  }

  /**
   * Get nearby areas based on user location
   * @param {number} lat - Latitude of user location
   * @param {number} lng - Longitude of user location
   * @param {number} radius_m - Radius in meters (default: 90000 = 90km)
   * @returns {Promise<Array>} Array of nearby areas with distance_m field
   */
  async getNearbyAreas(lat, lng, radius_m = 145000) {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius_m: String(radius_m),
      include_geometry: 'true'
    });
    
    // Add campaign_id if available (follows same pattern as addresses)
    const campaignId = authService.getCampaignId();
    if (campaignId) {
      params.append('campaign_id', campaignId);
    }
    
    const url = `${API_CONFIG.baseUrl}/areas/areas/nearby/?${params.toString()}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    
    if (!response.ok) throw new Error('Failed to fetch nearby areas');
    
    const data = await response.json();
    // Always return an array, same format as getAllAreas()
    return Array.isArray(data) ? data : (data.results || []);
  }

  /**
   * Get areas for the current manager (using the my_areas endpoint)
   * @returns {Promise<Array>} Array of areas created by the current manager
   */
  async getManagerAreas() {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.myAreas}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch manager areas');
    const data = await response.json();
    // Always return an array
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get locked areas for a specific campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Object containing locked areas and campaign info
   */
  async getLockedAreas(campaignId) {
    if (!campaignId) {
      throw new Error('Campaign ID is required for locked areas');
    }
    
    const url = `${API_CONFIG.baseUrl}/locked-areas/campaigns/${campaignId}/map-areas/`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    
    if (!response.ok) throw new Error('Failed to fetch locked areas');
    
    const data = await response.json();
    return data;
  }

  /**
   * Create new area
   * @param {Object} areaData - Area data (should match backend serializer)
   * @returns {Promise<Object>} Created area
   */
  async createArea(areaData) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.areas}/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(areaData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || JSON.stringify(error) || 'Failed to create area');
    }
    return await response.json();
  }

  /**
   * Update area
   * @param {string} areaId - Area ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated area
   */
  async updateArea(areaId, updateData) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.areaDetail(areaId)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updateData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to update area');
    }
    return await response.json();
  }

  /**
   * Delete area
   * @param {string} areaId - Area ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteArea(areaId) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.areaDetail(areaId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete area');
    return true;
  }

  /**
   * Get employees assigned to a specific area
   * @param {string} areaId - Area ID
   * @returns {Promise<Array>} Array of area-employee objects (with nested employee info)
   */
  async getAreaEmployees(areaId) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.areas}/${areaId}/employees/`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch area employees');
    return await response.json();
  }

  /**
   * Get employees assigned to a specific area via teams (team_employees endpoint)
   * @param {string} areaId - Area ID
   * @returns {Promise<Array>} Array of employee objects
   */
  async getAreaTeamEmployees(areaId) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.areas}/${areaId}/team_employees/`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch area team employees');
    return await response.json();
  }

  /**
   * Assign an employee or manager to an area
   * @param {string} areaId - Area ID
   * @param {Object} employee - Employee/Manager object with id and person_type fields
   * @returns {Promise<Object>} Response from backend
   */
  async addEmployeeToArea(areaId, employee) {
    // Determine payload based on person_type
    // Default to employee if person_type is not specified (backward compatibility)
    const payload = employee.person_type === 'manager' 
      ? { manager_id: employee.id }
      : { employee_id: employee.id };
    
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.addEmployee(areaId)}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'Failed to add employee/manager to area');
    }
    return await response.json();
  }

  /**
   * Remove an employee or manager from an area
   * @param {string} areaId - Area ID
   * @param {Object} employee - Employee/Manager object with id and person_type fields
   * @returns {Promise<Object>} Response from backend
   */
  async removeEmployeeFromArea(areaId, employee) {
    // Determine payload based on person_type
    // Default to employee if person_type is not specified (backward compatibility)
    const payload = employee.person_type === 'manager'
      ? { manager_id: employee.id }
      : { employee_id: employee.id };
    
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.removeEmployee(areaId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'Failed to remove employee/manager from area');
    }
    return await response.json();
  }

  /**
   * Get unassigned employees for a specific area
   * @param {string} areaId - Area ID
   * @returns {Promise<Array>} Array of unassigned employee objects
   */
  async getUnassignedEmployees(areaId) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.unassignedEmployees(areaId)}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch unassigned employees');
    return await response.json();
  }

  // Add more methods for area-employee assignment if needed
}

export const areaService = new AreaService(); 
