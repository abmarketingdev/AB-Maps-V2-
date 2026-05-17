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
      console.error('Backend error:', error);
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
   * Assign an employee to an area
   * @param {string} areaId - Area ID
   * @param {string} employeeId - Employee ID
   * @returns {Promise<Object>} Response from backend
   */
  async addEmployeeToArea(areaId, employeeId) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.addEmployee(areaId)}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ employee_id: employeeId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'Failed to add employee to area');
    }
    return await response.json();
  }

  /**
   * Remove an employee from an area
   * @param {string} areaId - Area ID
   * @param {string} employeeId - Employee ID
   * @returns {Promise<Object>} Response from backend
   */
  async removeEmployeeFromArea(areaId, employeeId) {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.removeEmployee(areaId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ employee_id: employeeId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'Failed to remove employee from area');
    }
    return await response.json();
  }

  // Add more methods for area-employee assignment if needed
}

export const areaService = new AreaService(); 