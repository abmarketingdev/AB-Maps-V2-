/**
 * Dashboard Data Hook
 * 
 * React hook for fetching and managing dashboard data from all 4 API endpoints.
 * Handles parallel fetching, error handling, and filter state management.
 */

import { useState, useEffect, useCallback } from 'react';
import { dashboardAPI } from '@/services/dashboardService';
import type {
  DashboardStatsResponse,
  DashboardTrendsResponse,
  FollowUpsResponse,
  RecentActivitiesResponse,
  DashboardFilters,
  DashboardData
} from '@/types/dashboard';

interface UseDashboardDataReturn extends DashboardData {
  filters: DashboardFilters;
  updateFilters: (newFilters: DashboardFilters) => void;
  refreshData: () => void;
}

/**
 * Custom hook for dashboard data management
 * 
 * @param initialFilters - Initial filter values (optional)
 * @returns Dashboard data, loading state, error, and filter management functions
 */
export function useNewDashboardData(initialFilters: DashboardFilters = {}): UseDashboardDataReturn {
  const [data, setData] = useState<DashboardData>({
    stats: null,
    trends: null,
    followUps: null,
    activities: null,
    loading: false,
    error: null
  });

  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);

  /**
   * Build query parameters from filters
   * Omits null/undefined values to allow "All Campaigns" and "All Time" options
   */
  const buildQueryParams = useCallback((filters: DashboardFilters): DashboardFilters => {
    const queryParams: DashboardFilters = {};
    
    // Only include campaign_ids if it's not null (null means "All Campaigns")
    if (filters.campaign_ids !== null && filters.campaign_ids !== undefined && filters.campaign_ids !== '') {
      queryParams.campaign_ids = filters.campaign_ids;
    }
    
    // Only include dates if they're provided (null means "All Time")
    if (filters.start_date) {
      queryParams.start_date = filters.start_date;
    }
    if (filters.end_date) {
      queryParams.end_date = filters.end_date;
    }
    
    // Include optional parameters
    if (filters.limit !== undefined) {
      queryParams.limit = filters.limit;
    }
    if (filters.offset !== undefined) {
      queryParams.offset = filters.offset;
    }
    if (filters.status) {
      queryParams.status = filters.status;
    }
    if (filters.group_by) {
      queryParams.group_by = filters.group_by;
    }
    if (filters.include_percentages !== undefined) {
      queryParams.include_percentages = filters.include_percentages;
    }
    
    return queryParams;
  }, []);

  /**
   * Fetch all dashboard data in parallel
   */
  const fetchDashboardData = useCallback(async (newFilters: DashboardFilters = {}) => {
    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Build query parameters (omit null/undefined values)
      const queryParams = buildQueryParams(newFilters);

      // Fetch all data in parallel for better performance
      const [stats, trends, followUps, activities] = await Promise.all([
        dashboardAPI.getStats({ ...queryParams, include_percentages: true }),
        dashboardAPI.getTrends({ ...queryParams, group_by: 'day' }),
        dashboardAPI.getFollowUps({ ...queryParams, limit: 50 }),
        dashboardAPI.getRecentActivities({ ...queryParams, limit: 20 })
      ]);

      setData({
        stats,
        trends,
        followUps,
        activities,
        loading: false,
        error: null
      });

      setFilters(newFilters);
    } catch (error) {
      console.error('[useNewDashboardData] Error fetching dashboard data:', error);
      
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
      }));
    }
  }, [buildQueryParams]);

  /**
   * Update filters and refetch data
   */
  const updateFilters = useCallback((newFilters: DashboardFilters) => {
    fetchDashboardData(newFilters);
  }, [fetchDashboardData]);

  /**
   * Refresh data with current filters
   */
  const refreshData = useCallback(() => {
    fetchDashboardData(filters);
  }, [fetchDashboardData, filters]);

  // Initial data fetch on mount
  useEffect(() => {
    fetchDashboardData(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  return {
    ...data,
    filters,
    updateFilters,
    refreshData
  };
}

export default useNewDashboardData;

