import { useState, useEffect, useCallback } from 'react';
import { fetchActivitiesSummary, FilterOptions, ActivitiesSummary } from '../services/activitiesService';

export interface DashboardData {
  activitiesSummary: ActivitiesSummary | null;
  loading: boolean;
  error: string | null;
  selectedCampaign: { id: string; name: string } | null;
  selectedDateRange: string;
  filters: {
    status?: string;
    employee_id?: string;
    start_date?: string;
    end_date?: string;
  };
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    activitiesSummary: null,
    loading: false,
    error: null,
    selectedCampaign: null,
    selectedDateRange: 'today',
    filters: {}
  });

  const [token, setToken] = useState<string | null>(null);

  // Get token from localStorage
  useEffect(() => {
    let storedToken = localStorage.getItem('accessToken');
    if (!storedToken) {
      const authTokens = localStorage.getItem('auth_tokens');
      if (authTokens) {
        try {
          const parsed = JSON.parse(authTokens);
          storedToken = parsed.access;
        } catch (e) {
          storedToken = null;
        }
      }
    }
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Get campaign from localStorage
  useEffect(() => {
    const storedCampaign = localStorage.getItem('selectedCampaign');
    let campaignObj = null;
    try {
      campaignObj = storedCampaign ? JSON.parse(storedCampaign) : null;
    } catch (e) {
      campaignObj = null;
    }
    if (campaignObj && campaignObj.id) {
      setData(prev => ({
        ...prev,
        selectedCampaign: { id: campaignObj.id, name: campaignObj.name }
      }));
    }
  }, []);

  const fetchData = useCallback(async (dateRange: string = 'today', additionalFilters?: any) => {
    if (!token || !data.selectedCampaign) {
      setData(prev => ({ ...prev, error: 'No token or campaign selected' }));
      return;
    }

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const filters: FilterOptions = {
        campaign_id: data.selectedCampaign.id,
        date_range: dateRange as 'today' | 'yesterday' | 'this_week',
        include_trends: true,
        ...additionalFilters
      };
      console.log('Calling fetchActivitiesSummary with:', filters, 'token:', token);
      const summary = await fetchActivitiesSummary(filters, token);
      
      setData(prev => ({
        ...prev,
        activitiesSummary: summary,
        loading: false,
        selectedDateRange: dateRange,
        filters: additionalFilters || {}
      }));
    } catch (error) {
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch data'
      }));
    }
  }, [token, data.selectedCampaign]);

  const updateDateRange = useCallback((dateRange: string, additionalFilters?: any) => {
    setData(prev => ({ ...prev, selectedDateRange: dateRange }));
    fetchData(dateRange, additionalFilters);
  }, [fetchData]);

  const refreshData = useCallback(() => {
    fetchData(data.selectedDateRange, data.filters);
  }, [fetchData, data.selectedDateRange, data.filters]);

  // Initial data fetch
  useEffect(() => {
    if (token && data.selectedCampaign) {
      fetchData();
    }
  }, [token, data.selectedCampaign, fetchData]);

  return {
    ...data,
    fetchData,
    updateDateRange,
    refreshData,
    updateFilters: (filters: any) => {
      fetchData(data.selectedDateRange, filters);
    }
  };
} 