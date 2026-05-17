// services/salesService.ts
import { authService } from '../lib/auth/authService';

export type Sale = {
  id: string;
  date: string;
  name: string;
  email: string;
  number: string;
  status: string;
  outcome: string;
  value: number | null;
  commission: number | null;
  notes: string;
  campaign: string;
  campaign_id: string | null;
  employee_name: string;
  employee_id: string | null;
  manager_name: string;
  manager_id: string | null;
  area_name: string;
  area_id: string | null;
  completed_at: string | null;
  metadata: Record<string, any>;
};

export type FilteredSalesResponse = {
  results: Sale[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
};

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get campaign ID from localStorage
 */
function getCampaignId(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const selectedCampaign = localStorage.getItem('selectedCampaign');
    if (selectedCampaign) {
      const campaign = JSON.parse(selectedCampaign);
      console.log('Stored campaign:', campaign);
      return campaign.id;
    }
  } catch (error) {
    console.error('Error parsing campaign from localStorage:', error);
  }
  
  return null;
}

/**
 * Fetch filtered sales data from the API
 */
export async function fetchFilteredSales(options: {
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<FilteredSalesResponse> {
  const {
    startDate,
    endDate,
    status,
    search,
    page = 1,
    pageSize = 50
  } = options;

  // Get campaign ID from localStorage
  const campaignId = getCampaignId();
  
  if (!campaignId) {
    // Return empty response instead of throwing error
    return {
      results: [],
      total_count: 0,
      page: 1,
      page_size: 50,
      total_pages: 1
    };
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(campaignId)) {
    throw new Error(`Invalid campaign ID format: ${campaignId}. Expected UUID format.`);
  }

  // Build query parameters
  const params = new URLSearchParams({
    campaign_id: campaignId,
    page: page.toString(),
    page_size: pageSize.toString()
  });

  // Add date parameters only if provided
  if (startDate) {
    params.append('start_date', startDate);
  }
  if (endDate) {
    params.append('end_date', endDate);
  }

  if (status) {
    params.append('status', status);
  }
  if (search) {
    params.append('search', search);
  }

      try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/sales/filtered/?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        }
      });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching filtered sales:', error);
    throw error;
  }
}

/**
 * Legacy function for backward compatibility
 * Now uses the new filtered API with today's data
 */
export async function fetchSales(): Promise<Sale[]> {
  try {
    const response = await fetchFilteredSales({
      startDate: getTodayDate(),
      endDate: getTodayDate()
    });
    return response.results;
  } catch (error) {
    console.error('Error fetching sales:', error);
    // Return empty array on error
    return [];
  }
}

/**
 * Get available campaigns for the dropdown
 */
export async function fetchCampaigns(): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/campaigns/campaigns/all_campaigns/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const campaigns = await response.json();
    console.log('Campaigns API response:', campaigns);
    
    // Handle different response formats
    if (Array.isArray(campaigns)) {
      return campaigns.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name
      }));
    } else if (campaigns && typeof campaigns === 'object') {
      // If it's a paginated response
      const results = campaigns.results || campaigns;
      if (Array.isArray(results)) {
        return results.map((campaign: any) => ({
          id: campaign.id,
          name: campaign.name
        }));
      }
    }
    
    console.error('Unexpected campaigns response format:', campaigns);
    return [];
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    // Return empty array instead of invalid IDs
    return [];
  }
}

/**
 * Set selected campaign in localStorage
 */
export function setSelectedCampaign(campaign: { id: string; name: string }): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('selectedCampaign', JSON.stringify(campaign));
  } catch (error) {
    console.error('Error saving campaign to localStorage:', error);
  }
}

/**
 * Get selected campaign from localStorage
 */
export function getSelectedCampaign(): { id: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const selectedCampaign = localStorage.getItem('selectedCampaign');
    if (selectedCampaign) {
      const campaign = JSON.parse(selectedCampaign);
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(campaign.id)) {
        console.warn('Invalid campaign ID in localStorage, clearing:', campaign.id);
        localStorage.removeItem('selectedCampaign');
        return null;
      }
      
      return campaign;
    }
  } catch (error) {
    console.error('Error parsing campaign from localStorage:', error);
    localStorage.removeItem('selectedCampaign');
  }
  
  return null;
}

/**
 * Clear invalid campaign data from localStorage
 */
export function clearInvalidCampaignData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const selectedCampaign = localStorage.getItem('selectedCampaign');
    if (selectedCampaign) {
      const campaign = JSON.parse(selectedCampaign);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(campaign.id)) {
        console.log('Clearing invalid campaign data:', campaign);
        localStorage.removeItem('selectedCampaign');
      }
    }
  } catch (error) {
    console.error('Error checking campaign data:', error);
    localStorage.removeItem('selectedCampaign');
  }
} 