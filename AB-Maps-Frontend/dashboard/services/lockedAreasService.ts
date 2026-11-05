import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(url, options);
}

// Types for the locked areas system (used by stores/areasLockStore.ts)
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

// Main service class for locked areas
export class LockedAreasService {
  private baseUrl = buildApiUrl('/api/locked-areas');

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
  }}

// Export a singleton instance
export const lockedAreasService = new LockedAreasService();
