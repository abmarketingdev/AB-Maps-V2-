/**
 * Polygon Deletion Service
 * Handles bulk deletion of entities within a polygon boundary
 * Only available to superusers
 */
import authService from './authService';
import { API_CONFIG } from '../config/apiConfig';

const API_BASE_URL = API_CONFIG.backend.baseUrl;

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
  
  // Campaign ID is required for polygon deletion
  if (campaignId) {
    headers['X-Campaign-ID'] = campaignId;
  }
  
  return headers;
};

/**
 * Convert frontend polygon format to GeoJSON format
 * @param {Array} currentArea - Array of {lat, lng} points
 * @returns {Object} GeoJSON Polygon object
 */
export const convertToGeoJSON = (currentArea) => {
  if (!currentArea || currentArea.length < 3) {
    throw new Error('Polygon must have at least 3 points');
  }

  // Convert to [lng, lat] format (GeoJSON standard)
  const coordinates = currentArea.map(point => [point.lng, point.lat]);
  
  // Close the polygon if not already closed
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];
  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    coordinates.push([...firstPoint]);
  }
  
  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
};

/**
 * Polygon Deletion Response Types
 */

/**
 * @typedef {Object} DeletionPreview
 * @property {boolean} success
 * @property {boolean} dry_run
 * @property {string} campaign_id
 * @property {string} campaign_name
 * @property {number} polygon_area_km2
 * @property {Object} will_delete
 * @property {number} total_will_delete
 * @property {string} warning
 */

/**
 * @typedef {Object} DeletionResult
 * @property {boolean} success
 * @property {boolean} dry_run
 * @property {string} campaign_id
 * @property {string} campaign_name
 * @property {number} polygon_area_km2
 * @property {Object} deleted
 * @property {number} total_deleted
 * @property {number} execution_time_ms
 * @property {string} deleted_at
 */

class PolygonDeletionService {
  /**
   * Preview what will be deleted (dry run)
   * @param {Object} polygon - GeoJSON Polygon object
   * @param {Array<string>} entityTypes - Entity types to delete ['addresses', 'uploaded_addresses', 'areas']
   * @param {boolean} includePartialAreas - Include areas that partially overlap (default: false)
   * @returns {Promise<DeletionPreview>} Preview of what will be deleted
   */
  async previewDeletion(polygon, entityTypes = ['addresses', 'uploaded_addresses', 'areas'], includePartialAreas = false) {
    try {
      console.log('[PolygonDeletionService] Previewing deletion...', { entityTypes, includePartialAreas });
      
      // Note: API_BASE_URL already includes /api, so we just append the rest
      const response = await fetch(`${API_BASE_URL}/polygon-operations/delete/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          polygon,
          entity_types: entityTypes,
          dry_run: true,
          include_partial_areas: includePartialAreas,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleApiError(response.status, errorData);
      }

      const data = await response.json();
      console.log('[PolygonDeletionService] Preview result:', data);
      return data;
    } catch (error) {
      console.error('[PolygonDeletionService] Preview error:', error);
      throw error;
    }
  }

  /**
   * Execute deletion within polygon
   * @param {Object} polygon - GeoJSON Polygon object
   * @param {Array<string>} entityTypes - Entity types to delete ['addresses', 'uploaded_addresses', 'areas']
   * @param {boolean} includePartialAreas - Include areas that partially overlap (default: false)
   * @returns {Promise<DeletionResult>} Result of deletion operation
   */
  async executeDeletion(polygon, entityTypes = ['addresses', 'uploaded_addresses', 'areas'], includePartialAreas = false) {
    try {
      console.log('[PolygonDeletionService] Executing deletion...', { entityTypes, includePartialAreas });
      
      // Note: API_BASE_URL already includes /api, so we just append the rest
      const response = await fetch(`${API_BASE_URL}/polygon-operations/delete/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          polygon,
          entity_types: entityTypes,
          dry_run: false,
          include_partial_areas: includePartialAreas,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleApiError(response.status, errorData);
      }

      const data = await response.json();
      console.log('[PolygonDeletionService] Deletion result:', data);
      return data;
    } catch (error) {
      console.error('[PolygonDeletionService] Deletion error:', error);
      throw error;
    }
  }

  /**
   * Handle API errors and convert to user-friendly messages
   * @param {number} status - HTTP status code
   * @param {Object} errorData - Error response data
   * @returns {Error} Error with user-friendly message
   */
  handleApiError(status, errorData) {
    const errorMessage = errorData.error || errorData.detail || errorData.message;
    
    switch (status) {
      case 400:
        return new Error(errorMessage || 'Invalid request. Please check your polygon.');
      case 401:
        return new Error('Authentication required. Please log in again.');
      case 403:
        return new Error('Only superusers can perform bulk deletion operations.');
      case 404:
        return new Error('Campaign not found. Please refresh and try again.');
      case 500:
        return new Error(
          errorData.details || 
          'Server error occurred. The transaction was rolled back - no data was deleted.'
        );
      default:
        return new Error(errorMessage || `Server error (${status})`);
    }
  }
}

// Export singleton instance
export const polygonDeletionService = new PolygonDeletionService();
export default polygonDeletionService;

