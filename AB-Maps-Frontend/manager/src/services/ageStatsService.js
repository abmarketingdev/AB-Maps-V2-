/**
 * Age Statistics Service for AB Maps Manager
 * Handles fetching age statistics for locked areas from SSB API
 */

import authService from './authService';

const API_BASE_URL = process.env.REACT_APP_API_URL;

/**
 * TypeScript-like type definitions (in comments for documentation)
 * 
 * @typedef {Object} LockedAreaAgeStat
 * @property {string} id - Locked area UUID
 * @property {'fylke' | 'kommune'} area_type - Type of area
 * @property {string} area_code - SSB region code (2 digits for fylke, 4 for kommune)
 * @property {string} area_name - Human-readable area name
 * @property {number | null} mean_age - Average age (1 decimal place)
 * @property {number | null} median_age - Median age (1 decimal place)
 * @property {boolean} cached - Whether stats were from DB cache
 * 
 * @typedef {Object} AgeStatsResponse
 * @property {string} campaign_id - The campaign UUID
 * @property {number | null} stats_year - Year the statistics are from
 * @property {string} [error] - Error message if SSB API failed
 * @property {LockedAreaAgeStat[]} data - List of locked areas with stats
 */

class AgeStatsService {
  constructor() {
    // Note: API_BASE_URL already includes /api, so we only add /locked-areas
    this.baseUrl = `${API_BASE_URL}/locked-areas`;
  }

  /**
   * Get age statistics for all locked areas in the current campaign
   * @returns {Promise<AgeStatsResponse>} Age statistics response
   */
  async getAgeStats() {
    try {
      const token = authService.getAccessToken();
      const campaignId = authService.getCampaignId();

      if (!token) {
        throw new Error('No authentication token available');
      }

      if (!campaignId) {
        throw new Error('No campaign selected');
      }

      const response = await fetch(`${this.baseUrl}/age-stats/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Campaign-ID': campaignId,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          throw new Error(errorData.error || 'Bad request - check campaign ID');
        }
        if (response.status === 401) {
          throw new Error('Authentication failed - please log in again');
        }
        if (response.status === 404) {
          throw new Error(errorData.error || 'Campaign not found');
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[AgeStatsService] Received age stats:', data);
      return data;
    } catch (error) {
      console.error('[AgeStatsService] Error fetching age stats:', error);
      throw error;
    }
  }

  /**
   * Get the zoom level appropriate for an area type
   * @param {'fylke' | 'kommune'} areaType - Type of area
   * @returns {number} Zoom level for flyTo
   */
  getZoomLevelForAreaType(areaType) {
    switch (areaType) {
      case 'fylke':
        return 5; // Wider view for county
      case 'kommune':
        return 8; // Closer view for municipality
      default:
        return 10;
    }
  }

  /**
   * Get center coordinates for an area using its polygon geometry from map-areas API
   * @deprecated This method is no longer used. Use the already-loaded lockedAreas data instead.
   * The AgeStatsPopup component now uses getAreaCoordinatesFromLockedAreas() which works with
   * the lockedAreas data that's already loaded in App.js via useMapState.
   * @param {string} areaCode - SSB area code
   * @param {'fylke' | 'kommune'} areaType - Type of area
   * @returns {Promise<{lat: number, lng: number} | null>} Center coordinates
   */
  async getAreaCoordinates(areaCode, areaType) {
    try {
      const token = authService.getAccessToken();
      const campaignId = authService.getCampaignId();

      if (!token || !campaignId) {
        console.error('[AgeStatsService] Missing token or campaign ID');
        return null;
      }

      // Fetch map areas to get the geometry - use the correct endpoint
      const response = await fetch(`${API_BASE_URL}/locked-areas/campaigns/${campaignId}/map-areas/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[AgeStatsService] Failed to fetch map areas: ${response.status}`);
        return null;
      }

      const areas = await response.json();
      
      if (!Array.isArray(areas)) {
        console.error('[AgeStatsService] Invalid response format - expected array');
        return null;
      }

      // Match area by both area_code and area_type to ensure we get the right one
      const area = areas.find(a => 
        a.area_code === areaCode && a.area_type === areaType
      );

      if (!area) {
        console.error(`[AgeStatsService] Area not found: ${areaCode} (${areaType})`);
        return null;
      }

      if (!area.polygon_geometry || !area.polygon_geometry.coordinates) {
        console.error('[AgeStatsService] Area has no polygon geometry');
        return null;
      }

      // Calculate centroid of the polygon
      const coords = area.polygon_geometry.coordinates;
      let centroid = null;

      if (area.polygon_geometry.type === 'MultiPolygon') {
        // MultiPolygon structure: [[[[lng, lat], [lng, lat], ...]]]
        // Get the first polygon's first ring
        if (coords[0] && coords[0][0] && Array.isArray(coords[0][0])) {
          const firstRing = coords[0][0];
          centroid = this.calculateCentroid(firstRing);
        }
      } else if (area.polygon_geometry.type === 'Polygon') {
        // Polygon structure: [[[lng, lat], [lng, lat], ...]]
        // Get the first ring (exterior ring)
        if (coords[0] && Array.isArray(coords[0])) {
          centroid = this.calculateCentroid(coords[0]);
        }
      }

      if (centroid && centroid[0] && centroid[1]) {
        // Centroid is [lng, lat], return as {lat, lng}
        return { lat: centroid[1], lng: centroid[0] };
      }

      console.error('[AgeStatsService] Could not calculate centroid');
      return null;
    } catch (error) {
      console.error('[AgeStatsService] Error getting area coordinates:', error);
      return null;
    }
  }

  /**
   * Calculate centroid of a polygon
   * @param {Array} ring - Array of [lng, lat] coordinates
   * @returns {Array} [lng, lat] centroid
   */
  calculateCentroid(ring) {
    if (!ring || ring.length === 0) return null;
    
    let sumLng = 0;
    let sumLat = 0;
    const count = ring.length;

    for (const coord of ring) {
      sumLng += coord[0];
      sumLat += coord[1];
    }

    return [sumLng / count, sumLat / count];
  }
}

// Create singleton instance
const ageStatsService = new AgeStatsService();

export default ageStatsService;

