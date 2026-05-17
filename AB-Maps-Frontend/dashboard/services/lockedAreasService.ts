import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(url, options);
}

// Types for the locked areas system
export interface Area {
  name: string;
  area_key: string;
  code: string;
  area_km2: number;
  num_polygons: number;
  is_locked?: boolean;
  locked_at?: string;
  locked_by?: string;
}

export interface County extends Area {
  // Counties have additional properties if needed
}

export interface Municipality extends Area {
  // Municipalities have additional properties if needed
}

export interface BasicDistrict extends Area {
  // Basic districts have additional properties if needed
}

export interface AreaStatistics {
  total_areas: number;
  locked_areas: number;
  unlocked_areas: number;
  recently_locked: number; // Last 7 days
  recently_unlocked: number; // Last 7 days
}

export interface LockedArea extends Area {
  id: string;
  campaign: string;
  area_type: string;
  area_code: string;
  area_name: string;
  county_code: string | null;
  municipality_code: string | null;
  area_level: string;
  locked_at: string;
  locked_by: string;
  locked_by_name: string;
  campaign_name: string;
  is_active: boolean;
  children_count: number;
  parent_areas: any[];
  created_at: string;
  updated_at: string;
}

export interface CampaignStatistics {
  campaign_id: string;
  campaign_name: string;
  total_available_areas: number;
  total_locked_areas: number;
  locked_by_type: {
    fylke: number;
    kommune: number;
    grunnkrets: number;
  };
  lock_percentage: number;
}

export interface SearchResult {
  areas: Area[];
  total_count: number;
}

// Main service class for locked areas
export class LockedAreasService {
  private baseUrl = buildApiUrl('/api/locked-areas');

  /**
   * Get overview statistics for the locked areas system
   */
  async getStatistics(): Promise<AreaStatistics> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/statistics/`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Return mock data for development
      return {
        total_areas: 0,
        locked_areas: 0,
        unlocked_areas: 0,
        recently_locked: 0,
        recently_unlocked: 0,
      };
    }
  }

  /**
   * Get all counties (first level of hierarchy)
   */
  async getCounties(): Promise<County[]> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/hierarchy/?level=fylke`);
      const data = await response.json();
      return Object.values(data.fylker || {});
    } catch (error) {
      console.error('Error fetching counties:', error);
      return [];
    }
  }

  /**
   * Get municipalities for a specific county
   */
  async getMunicipalities(countyAreaKey: string): Promise<Municipality[]> {
    try {
      const response = await makeAuthenticatedRequest(
        `${this.baseUrl}/hierarchy/?parent_area_key=${countyAreaKey}&level=kommune`
      );
      const data = await response.json();
      return data.areas || [];
    } catch (error) {
      console.error('Error fetching municipalities:', error);
      return [];
    }
  }

  /**
   * Get basic districts for a specific municipality
   */
  async getBasicDistricts(municipalityAreaKey: string): Promise<BasicDistrict[]> {
    try {
      const response = await makeAuthenticatedRequest(
        `${this.baseUrl}/hierarchy/?parent_area_key=${municipalityAreaKey}&level=grunnkrets`
      );
      const data = await response.json();
      return data.areas || [];
    } catch (error) {
      console.error('Error fetching basic districts:', error);
      return [];
    }
  }

  /**
   * Search areas across all levels
   */
  async searchAreas(query: string): Promise<SearchResult> {
    try {
      const response = await makeAuthenticatedRequest(
        `${this.baseUrl}/search/?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error searching areas:', error);
      return { areas: [], total_count: 0 };
    }
  }

  /**
   * Get all currently locked areas
   */
  async getLockedAreas(): Promise<LockedArea[]> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/locked/`);
      const data = await response.json();
      return data.areas || [];
    } catch (error) {
      console.error('Error fetching locked areas:', error);
      return [];
    }
  }

  /**
   * Lock an area
   */
  async lockArea(areaKey: string): Promise<void> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/lock/`, {
        method: 'POST',
        body: JSON.stringify({ area_key: areaKey }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to lock area: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error locking area:', error);
      throw error;
    }
  }

  /**
   * Unlock an area
   */
  async unlockArea(areaKey: string): Promise<void> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/unlock/`, {
        method: 'POST',
        body: JSON.stringify({ area_key: areaKey }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to unlock area: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error unlocking area:', error);
      throw error;
    }
  }

  /**
   * Bulk lock multiple areas for a campaign
   */
  async bulkLockAreas(campaignId: string, areaKeys: string[]): Promise<any[]> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/campaigns/${campaignId}/bulk-lock/`, {
        method: 'POST',
        body: JSON.stringify({ area_keys: areaKeys }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to bulk lock areas: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error bulk locking areas:', error);
      throw error;
    }
  }

  /**
   * Get campaign-specific statistics
   */
  async getCampaignStatistics(campaignId: string): Promise<CampaignStatistics> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/campaigns/${campaignId}/statistics/`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching campaign statistics:', error);
      throw error;
    }
  }

  /**
   * Get locked areas for a specific campaign
   */
  async getCampaignLockedAreas(campaignId: string): Promise<LockedArea[]> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/campaigns/${campaignId}/locked-areas/`);
      const data = await response.json();
      console.log('API Response for locked areas:', data);
      console.log('Response type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      // API returns areas directly as an array, not wrapped in an object
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching campaign locked areas:', error);
      return [];
    }
  }

  /**
   * Bulk unlock multiple areas for a campaign
   */
  async bulkUnlockAreas(campaignId: string, areaKeys: string[]): Promise<{ message: string; unlocked_count: number }> {
    try {
      const response = await makeAuthenticatedRequest(`${this.baseUrl}/campaigns/${campaignId}/bulk-unlock/`, {
        method: 'POST',
        body: JSON.stringify({ area_keys: areaKeys }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to bulk unlock areas: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error bulk unlocking areas:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const lockedAreasService = new LockedAreasService();
