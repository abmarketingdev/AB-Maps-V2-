import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { lockedAreasService, LockedArea, CampaignStatistics } from '@/services/lockedAreasService';

interface UnlockAreasState {
  lockedAreas: LockedArea[];
  statistics: CampaignStatistics | null;
  checkedAreas: Set<string>;
  loading: {
    areas: boolean;
    statistics: boolean;
    bulkUnlock: boolean;
  };
  search: string;
  campaignId: string | null;
}

export const useUnlockAreas = () => {
  const { toast } = useToast();
  const [state, setState] = useState<UnlockAreasState>({
    lockedAreas: [],
    statistics: null,
    checkedAreas: new Set(),
    loading: {
      areas: false,
      statistics: false,
      bulkUnlock: false,
    },
    search: '',
    campaignId: null,
  });

  // Load campaign data from localStorage
  useEffect(() => {
    const loadCampaignData = () => {
      try {
        const campaignData = localStorage.getItem('currentCampaign');
        if (campaignData) {
          const parsed = JSON.parse(campaignData);
          setState(prev => ({ ...prev, campaignId: parsed.id }));
        }
      } catch (error) {
        console.error('Error loading campaign data:', error);
      }
    };
    
    loadCampaignData();
  }, []);

  // Load locked areas
  const loadLockedAreas = useCallback(async () => {
    if (!state.campaignId) return;
    
    try {
      setState(prev => ({ ...prev, loading: { ...prev.loading, areas: true } }));
      const areas = await lockedAreasService.getCampaignLockedAreas(state.campaignId);
      console.log('Loaded locked areas:', areas);
      console.log('Campaign ID:', state.campaignId);
      setState(prev => ({ ...prev, lockedAreas: areas }));
    } catch (error) {
      console.error('Error loading locked areas:', error);
      toast({
        title: 'Error',
        description: 'Failed to load locked areas. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, areas: false } }));
    }
  }, [state.campaignId, toast]);

  // Load campaign statistics
  const loadStatistics = useCallback(async () => {
    if (!state.campaignId) return;
    
    try {
      setState(prev => ({ ...prev, loading: { ...prev.loading, statistics: true } }));
      const stats = await lockedAreasService.getCampaignStatistics(state.campaignId);
      setState(prev => ({ ...prev, statistics: stats }));
    } catch (error) {
      console.error('Error loading statistics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaign statistics. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, statistics: false } }));
    }
  }, [state.campaignId, toast]);

  // Load data when campaign ID is available
  useEffect(() => {
    if (state.campaignId) {
      loadLockedAreas();
      loadStatistics();
    }
  }, [state.campaignId, loadLockedAreas, loadStatistics]);

  // Toggle area selection
  const toggleAreaCheck = useCallback((areaKey: string, checked: boolean) => {
    setState(prev => {
      const newCheckedAreas = new Set(prev.checkedAreas);
      if (checked) {
        newCheckedAreas.add(areaKey);
      } else {
        newCheckedAreas.delete(areaKey);
      }
      return { ...prev, checkedAreas: newCheckedAreas };
    });
  }, []);

  // Clear all selections
  const clearCheckedAreas = useCallback(() => {
    setState(prev => ({ ...prev, checkedAreas: new Set() }));
  }, []);

  // Get selected areas
  const getCheckedAreas = useCallback(() => {
    return state.lockedAreas.filter(area => state.checkedAreas.has(area.area_key));
  }, [state.lockedAreas, state.checkedAreas]);

  // Bulk unlock areas
  const bulkUnlockAreas = useCallback(async () => {
    if (!state.campaignId || state.checkedAreas.size === 0) return;

    try {
      setState(prev => ({ ...prev, loading: { ...prev.loading, bulkUnlock: true } }));
      const areaKeys = Array.from(state.checkedAreas);
      const result = await lockedAreasService.bulkUnlockAreas(state.campaignId, areaKeys);
      
      toast({
        title: 'Success',
        description: result.message,
        variant: 'default',
      });
      
      // Clear selections and refresh data
      setState(prev => ({ ...prev, checkedAreas: new Set() }));
      await Promise.all([loadLockedAreas(), loadStatistics()]);
      
    } catch (error) {
      console.error('Error bulk unlocking areas:', error);
      toast({
        title: 'Error',
        description: 'Failed to unlock areas. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, bulkUnlock: false } }));
    }
  }, [state.campaignId, state.checkedAreas, loadLockedAreas, loadStatistics, toast]);

  // Update search
  const updateSearch = useCallback((value: string) => {
    setState(prev => ({ ...prev, search: value }));
  }, []);

  // Filter areas based on search
  const filteredAreas = state.lockedAreas.filter(area =>
    area.area_name.toLowerCase().includes(state.search.toLowerCase()) ||
    area.area_key.toLowerCase().includes(state.search.toLowerCase()) ||
    area.area_type.toLowerCase().includes(state.search.toLowerCase())
  );

  return {
    // State
    lockedAreas: filteredAreas,
    statistics: state.statistics,
    checkedAreas: state.checkedAreas,
    loading: state.loading,
    search: state.search,
    campaignId: state.campaignId,
    
    // Actions
    toggleAreaCheck,
    clearCheckedAreas,
    getCheckedAreas,
    bulkUnlockAreas,
    updateSearch,
    loadLockedAreas,
    loadStatistics,
  };
};
