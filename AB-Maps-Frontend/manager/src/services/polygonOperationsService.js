/**
 * Polygon Operations Service
 * 
 * Handles API calls for polygon-based operations like building/apartment calculations.
 * Replaces external API calls (OSM, Geonorge, Kartvert) with backend API.
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
    'Authorization': token ? `Bearer ${token}` : '',
  };
  
  // Add campaign_id to headers if available
  if (campaignId) {
    headers['X-Campaign-ID'] = campaignId;
  }
  
  return headers;
};

/**
 * Search for buildings and apartments within a polygon
 * 
 * @param {Object} polygon - GeoJSON Polygon object
 * @param {string} polygon.type - Must be "Polygon"
 * @param {Array} polygon.coordinates - Array of coordinate rings
 * @returns {Promise<Object>} Summary object with counts:
 *   {
 *     summary: {
 *       total_houses: number,
 *       total_apartment_buildings: number,
 *       total_individual_apartments: number
 *     }
 *   }
 * 
 * @example
 * const result = await polygonOperationsService.search({
 *   type: "Polygon",
 *   coordinates: [[[10.75, 59.91], [10.76, 59.91], [10.76, 59.92], [10.75, 59.92], [10.75, 59.91]]]
 * });
 * // Returns: { summary: { total_houses: 120, total_apartment_buildings: 5, total_individual_apartments: 250 } }
 */
const search = async (polygon) => {
  try {
    if (!polygon || polygon.type !== 'Polygon') {
      throw new Error('Invalid polygon: must be a GeoJSON Polygon object');
    }

    if (!polygon.coordinates || !Array.isArray(polygon.coordinates)) {
      throw new Error('Invalid polygon: coordinates must be an array');
    }

    const response = await fetch(`${BASE_URL}/polygon-operations/search/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ polygon }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PolygonOperationsService] search error:', {
        status: response.status,
        body: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (data.summary && typeof data.summary === 'object') {
      console.log('[PolygonOperationsService] search success:', data.summary);
      return data;
    } else {
      throw new Error('Invalid response format: expected object with summary property');
    }
  } catch (error) {
    console.error('[PolygonOperationsService] search failed:', error);
    throw error;
  }
};

const polygonOperationsService = {
  search
};

export default polygonOperationsService;
