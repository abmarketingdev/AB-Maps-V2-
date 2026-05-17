// services/activitiesService.ts
import { authService } from '../lib/auth/authService';

export type Activity = {
  id: string;
  date: string;
  activity: string;
  campaign: string;
  name: string;
  mobile: string;
  outcome: string;
  employee_id: string;
  manager_id: string;
};

export type FilteredActivitiesResponse = {
  results: Activity[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type FilterOptions = {
  campaign_id: string;
  date_range?: 'today' | 'yesterday' | 'this_week';
  start_date?: string;
  end_date?: string;
  status?: string;
  manager_id?: string;
  employee_id?: string;
  include_trends?: boolean;
};

export type ActivitiesSummary = {
  total: number;
  by_status: Record<string, number>;
  hit_rate: string;
  conversion_rate: string;
  rejection_rate: string;
  no_answer_rate: string;
  performance_metrics: {
    avg_per_day?: number;
    best_day?: string;
    best_day_count?: number;
    total_employees?: number;
    avg_per_employee?: number;
  };
  trends?: {
    daily_totals: number[];
    daily_hit_rates: number[];
  };
};

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ab-maps-backend-production.onrender.com';

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
 * Fetch filtered activities data from the API
 */
export async function fetchFilteredActivities(options: {
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<FilteredActivitiesResponse> {
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

  // Add optional parameters only if they are provided
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

  // Get auth token
  const token = await authService.getAccessToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  // Make API request
  const url = `${API_BASE_URL}/api/dashboard/activities/filtered/?${params.toString()}`;
  console.log('Fetching activities from:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No activities found for the selected filters');
    }
    if (response.status === 401) {
      throw new Error('Authentication required. Please log in.');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Bad request');
    }
    throw new Error(`Failed to fetch activities: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Activities API response:', data);
  
  return data;
}

/**
 * Fetch activities summary from the API
 */
export async function fetchActivitiesSummary(filters: FilterOptions, token: string): Promise<ActivitiesSummary> {
  const {
    campaign_id,
    date_range,
    start_date,
    end_date,
    status,
    manager_id,
    employee_id,
    include_trends = true
  } = filters;

  if (!campaign_id) {
    throw new Error('campaign_id is required');
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(campaign_id)) {
    throw new Error(`Invalid campaign ID format: ${campaign_id}. Expected UUID format.`);
  }

  // Build query parameters
  const params = new URLSearchParams({
    campaign_id: campaign_id,
    include_trends: include_trends.toString()
  });

  // Add optional parameters only if they are provided
  if (date_range) {
    params.append('date_range', date_range);
  }
  if (start_date) {
    params.append('start_date', start_date);
  }
  if (end_date) {
    params.append('end_date', end_date);
  }
  if (status) {
    params.append('status', status);
  }
  if (manager_id) {
    params.append('manager_id', manager_id);
  }
  if (employee_id) {
    params.append('employee_id', employee_id);
  }

  // Make API request
  const url = `${API_BASE_URL}/api/dashboard/activities/summary/?${params.toString()}`;
  console.log('Fetching activities summary from:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No activities found for the selected filters');
    }
    if (response.status === 401) {
      throw new Error('Authentication required. Please log in.');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Bad request');
    }
    throw new Error(`Failed to fetch activities summary: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Activities summary API response:', data);
  
  return data;
}

/**
 * Format status counts for dashboard display
 */
export function formatStatusCounts(byStatus: Record<string, number>) {
  return {
    ja: byStatus['Ja'] || byStatus['ja'] || 0,
    nei: byStatus['Nei'] || byStatus['nei'] || 0,
    ikke_hjemme: byStatus['Ikke Hjem'] || byStatus['ikke_hjemme'] || 0,
    tilbakeringing: byStatus['Tilbakeringing'] || byStatus['tilbakeringing'] || 0,
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0)
  };
}

/**
 * Fetch all activities (legacy function for compatibility)
 */
export async function fetchActivities(): Promise<Activity[]> {
  try {
    const response = await fetchFilteredActivities();
    return response.results;
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
}

/**
 * Fetch campaigns list
 */
export async function fetchCampaigns(): Promise<Array<{ id: string; name: string }>> {
  try {
    const token = await authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/api/campaigns/campaigns/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || data;
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    throw error;
  }
}

/**
 * Set selected campaign in localStorage
 */
export function setSelectedCampaign(campaign: { id: string; name: string }): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('selectedCampaign', JSON.stringify(campaign));
    console.log('Campaign saved to localStorage:', campaign);
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
      console.log('Retrieved campaign from localStorage:', campaign);
      return campaign;
    }
  } catch (error) {
    console.error('Error parsing campaign from localStorage:', error);
  }
  
  return null;
}

/**
 * Clear invalid campaign data from localStorage
 */
export function clearInvalidCampaignData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('selectedCampaign');
    console.log('Cleared invalid campaign data from localStorage');
  } catch (error) {
    console.error('Error clearing campaign data from localStorage:', error);
  }
} 