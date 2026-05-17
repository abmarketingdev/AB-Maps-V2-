/**
 * Dashboard API Service
 * 
 * Service for interacting with the new dashboard API endpoints.
 * All endpoints are user-scoped and support campaign and date filtering.
 */

import { API_CONFIG } from '@/lib/config/apiConfig';
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import type {
  DashboardStatsResponse,
  DashboardTrendsResponse,
  FollowUpsResponse,
  RecentActivitiesResponse,
  DashboardFilters
} from '@/types/dashboard';

const API_BASE = `${API_CONFIG.BASE_URL}/api/dashboard`;

/**
 * Build query string from filter parameters
 * Omits null, undefined, and empty string values
 */
const buildQueryString = (params: Record<string, any>): string => {
  const query = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        query.append(key, value.join(','));
      } else {
        query.append(key, value.toString());
      }
    }
  });
  
  return query.toString();
};

/**
 * Handle API response errors
 */
const handleApiError = async (response: Response, endpoint: string): Promise<never> => {
  let errorMessage = `API error: ${response.statusText}`;
  
  try {
    const errorData = await response.json();
    if (errorData.error || errorData.detail) {
      errorMessage = errorData.error || errorData.detail || errorMessage;
    }
  } catch {
    // If response is not JSON, use status text
  }
  
  if (response.status === 400) {
    errorMessage = `Invalid request: ${errorMessage}`;
  } else if (response.status === 500) {
    errorMessage = 'Server error. Please try again later.';
  }
  
  throw new Error(`${endpoint} - ${errorMessage}`);
};

/**
 * Dashboard API Client
 */
export const dashboardAPI = {
  async getStats(filters: DashboardFilters = {}): Promise<DashboardStatsResponse> {
    const query = buildQueryString(filters);
    const url = `${API_BASE}/stats/?${query}`;
    const response = await fetchWithAuth(url);
    if (!response.ok) await handleApiError(response, 'Stats API');
    return await response.json();
  },

  async getTrends(filters: DashboardFilters = {}): Promise<DashboardTrendsResponse> {
    const query = buildQueryString(filters);
    const url = `${API_BASE}/trends/?${query}`;
    const response = await fetchWithAuth(url);
    if (!response.ok) await handleApiError(response, 'Trends API');
    return await response.json();
  },

  async getFollowUps(filters: DashboardFilters = {}): Promise<FollowUpsResponse> {
    const query = buildQueryString(filters);
    const url = `${API_BASE}/follow-ups/?${query}`;
    const response = await fetchWithAuth(url);
    if (!response.ok) await handleApiError(response, 'Follow-ups API');
    return await response.json();
  },

  async getRecentActivities(filters: DashboardFilters = {}): Promise<RecentActivitiesResponse> {
    const query = buildQueryString(filters);
    const url = `${API_BASE}/recent-activities/?${query}`;
    const response = await fetchWithAuth(url);
    if (!response.ok) await handleApiError(response, 'Recent activities API');
    return await response.json();
  }
};

export default dashboardAPI;

