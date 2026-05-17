// stores/areasLockStore.ts
// Zustand store for area selection and locking state

import { create } from 'zustand';
import { lockedAreasService, LockedArea } from '@/services/lockedAreasService';
import { toast } from '@/hooks/use-toast';

/**
 * Area info stored for selection (minimal data)
 */
export interface AreaInfo {
  area_key: string;    // "kommune:0301", "grunnkrets:03010101", "fylke:03"
  name: string;        // "Oslo", "Bergen", etc.
  code: string;        // "0301", "03010101", "03"
  level: 'fylke' | 'kommune' | 'grunnkrets';
}

/**
 * Locked area info from API (subset of LockedArea)
 */
export interface LockedAreaInfo {
  area_key: string;
  area_type: string;   // "fylke", "kommune", "grunnkrets"
  area_code: string;
  area_name: string;
  locked_at: string;
  locked_by_name: string;
}

/**
 * Store state interface
 */
interface AreasLockState {
  // Selection (client-side)
  selectedAreaKeys: Set<string>;
  selectedAreas: Map<string, AreaInfo>;
  
  // Locked (from server)
  lockedAreaKeys: Set<string>;
  lockedAreas: LockedAreaInfo[];
  
  // UI state
  panelOpen: boolean;
  activeTab: 'selected' | 'locked';
  isLoading: boolean;
  
  // Campaign context
  campaignId: string | null;
}

/**
 * Store actions interface
 */
interface AreasLockActions {
  // Selection
  toggleSelection: (area: AreaInfo) => void;
  removeSelection: (area_key: string) => void;
  clearSelection: () => void;
  isSelected: (area_key: string) => boolean;
  
  // Locked areas
  setLockedAreas: (areas: LockedArea[]) => void;
  fetchLockedAreas: () => Promise<void>;
  isLocked: (area_key: string) => boolean;
  
  // Bulk operations
  lockSelectedAreas: () => Promise<{ success: boolean; count: number }>;
  unlockAreas: (area_keys: string[]) => Promise<{ success: boolean; count: number }>;
  
  // UI
  openPanel: () => void;
  closePanel: () => void;
  setActiveTab: (tab: 'selected' | 'locked') => void;
  
  // Campaign
  setCampaignId: (id: string | null) => void;
  initializeCampaign: () => void;
  
  // Computed helpers
  getSelectedArray: () => AreaInfo[];
  getSelectedCount: () => number;
  getLockedCount: () => number;
}

type AreasLockStore = AreasLockState & AreasLockActions;

/**
 * Initial state
 */
const initialState: AreasLockState = {
  selectedAreaKeys: new Set<string>(),
  selectedAreas: new Map<string, AreaInfo>(),
  lockedAreaKeys: new Set<string>(),
  lockedAreas: [],
  panelOpen: false,
  activeTab: 'selected',
  isLoading: false,
  campaignId: null,
};

/**
 * Zustand store for area selection and locking
 */
export const useAreasLockStore = create<AreasLockStore>((set, get) => ({
  ...initialState,

  // ==================== Selection Actions ====================

  toggleSelection: (area: AreaInfo) => {
    const { selectedAreaKeys, selectedAreas, lockedAreaKeys } = get();
    
    // Check if already locked - prevent selection
    if (lockedAreaKeys.has(area.area_key)) {
      toast({
        title: 'Allerede låst',
        description: `${area.name} er allerede låst i denne kampanjen.`,
      });
      return;
    }

    // Create new Set/Map (immutable update)
    const newSelectedKeys = new Set(selectedAreaKeys);
    const newSelectedAreas = new Map(selectedAreas);

    if (newSelectedKeys.has(area.area_key)) {
      // Remove from selection
      newSelectedKeys.delete(area.area_key);
      newSelectedAreas.delete(area.area_key);
      console.log('[AreasLockStore] Deselected:', area.area_key);
    } else {
      // Add to selection
      newSelectedKeys.add(area.area_key);
      newSelectedAreas.set(area.area_key, area);
      console.log('[AreasLockStore] Selected:', area.area_key);
    }

    set({
      selectedAreaKeys: newSelectedKeys,
      selectedAreas: newSelectedAreas,
    });
  },

  removeSelection: (area_key: string) => {
    const { selectedAreaKeys, selectedAreas } = get();
    
    const newSelectedKeys = new Set(selectedAreaKeys);
    const newSelectedAreas = new Map(selectedAreas);
    
    newSelectedKeys.delete(area_key);
    newSelectedAreas.delete(area_key);
    
    set({
      selectedAreaKeys: newSelectedKeys,
      selectedAreas: newSelectedAreas,
    });
    
    console.log('[AreasLockStore] Removed from selection:', area_key);
  },

  clearSelection: () => {
    set({
      selectedAreaKeys: new Set<string>(),
      selectedAreas: new Map<string, AreaInfo>(),
    });
    console.log('[AreasLockStore] Cleared all selections');
  },

  isSelected: (area_key: string) => {
    return get().selectedAreaKeys.has(area_key);
  },

  // ==================== Locked Areas Actions ====================

  setLockedAreas: (areas: LockedArea[]) => {
    const lockedAreaInfos: LockedAreaInfo[] = areas.map(a => ({
      area_key: a.area_key,
      area_type: a.area_type,
      area_code: a.area_code,
      area_name: a.area_name,
      locked_at: a.locked_at,
      locked_by_name: a.locked_by_name,
    }));
    
    const lockedKeys = new Set(areas.map(a => a.area_key));
    
    // Also remove any selected items that are now locked
    const { selectedAreaKeys, selectedAreas } = get();
    const newSelectedKeys = new Set<string>();
    const newSelectedAreas = new Map<string, AreaInfo>();
    
    selectedAreaKeys.forEach(key => {
      if (!lockedKeys.has(key)) {
        newSelectedKeys.add(key);
        const area = selectedAreas.get(key);
        if (area) newSelectedAreas.set(key, area);
      }
    });
    
    set({
      lockedAreas: lockedAreaInfos,
      lockedAreaKeys: lockedKeys,
      selectedAreaKeys: newSelectedKeys,
      selectedAreas: newSelectedAreas,
    });
    
    console.log('[AreasLockStore] Set locked areas:', lockedKeys.size);
  },

  fetchLockedAreas: async () => {
    const { campaignId, setLockedAreas } = get();
    
    if (!campaignId) {
      console.warn('[AreasLockStore] No campaign ID, cannot fetch locked areas');
      return;
    }

    set({ isLoading: true });
    
    try {
      console.log('[AreasLockStore] Fetching locked areas for campaign:', campaignId);
      const areas = await lockedAreasService.getCampaignLockedAreas(campaignId);
      setLockedAreas(areas);
    } catch (error) {
      console.error('[AreasLockStore] Failed to fetch locked areas:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste låste områder',
        variant: 'destructive',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  isLocked: (area_key: string) => {
    return get().lockedAreaKeys.has(area_key);
  },

  // ==================== Bulk Operations ====================

  lockSelectedAreas: async () => {
    const { campaignId, selectedAreaKeys, fetchLockedAreas, clearSelection } = get();
    
    if (!campaignId) {
      toast({
        title: 'Feil',
        description: 'Ingen kampanje valgt',
        variant: 'destructive',
      });
      return { success: false, count: 0 };
    }
    
    if (selectedAreaKeys.size === 0) {
      toast({
        title: 'Ingen områder valgt',
        description: 'Velg områder på kartet først',
      });
      return { success: false, count: 0 };
    }

    set({ isLoading: true });
    
    try {
      const areaKeys = Array.from(selectedAreaKeys);
      console.log('[AreasLockStore] Locking areas:', areaKeys);
      
      await lockedAreasService.bulkLockAreas(campaignId, areaKeys);
      
      toast({
        title: 'Suksess',
        description: `Låst ${areaKeys.length} område${areaKeys.length > 1 ? 'r' : ''}`,
      });
      
      // Clear selection and refresh locked list
      clearSelection();
      await fetchLockedAreas();
      
      return { success: true, count: areaKeys.length };
    } catch (error) {
      console.error('[AreasLockStore] Failed to lock areas:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke låse områder. Prøv igjen.',
        variant: 'destructive',
      });
      return { success: false, count: 0 };
    } finally {
      set({ isLoading: false });
    }
  },

  unlockAreas: async (area_keys: string[]) => {
    const { campaignId, fetchLockedAreas } = get();
    
    if (!campaignId) {
      toast({
        title: 'Feil',
        description: 'Ingen kampanje valgt',
        variant: 'destructive',
      });
      return { success: false, count: 0 };
    }
    
    if (area_keys.length === 0) {
      return { success: false, count: 0 };
    }

    set({ isLoading: true });
    
    try {
      console.log('[AreasLockStore] Unlocking areas:', area_keys);
      
      await lockedAreasService.bulkUnlockAreas(campaignId, area_keys);
      
      toast({
        title: 'Suksess',
        description: `Låst opp ${area_keys.length} område${area_keys.length > 1 ? 'r' : ''}`,
      });
      
      // Refresh locked list
      await fetchLockedAreas();
      
      return { success: true, count: area_keys.length };
    } catch (error) {
      console.error('[AreasLockStore] Failed to unlock areas:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke låse opp områder. Prøv igjen.',
        variant: 'destructive',
      });
      return { success: false, count: 0 };
    } finally {
      set({ isLoading: false });
    }
  },

  // ==================== UI Actions ====================

  openPanel: () => {
    set({ panelOpen: true });
  },

  closePanel: () => {
    set({ panelOpen: false });
  },

  setActiveTab: (tab: 'selected' | 'locked') => {
    set({ activeTab: tab });
  },

  // ==================== Campaign Actions ====================

  setCampaignId: (id: string | null) => {
    set({ campaignId: id });
    console.log('[AreasLockStore] Campaign ID set to:', id);
  },

  initializeCampaign: () => {
    try {
      const campaignData = localStorage.getItem('currentCampaign');
      if (campaignData) {
        const parsed = JSON.parse(campaignData);
        const campaignId = parsed.id || parsed;
        set({ campaignId });
        console.log('[AreasLockStore] Initialized campaign ID from localStorage:', campaignId);
      } else {
        console.warn('[AreasLockStore] No campaign found in localStorage');
      }
    } catch (error) {
      console.error('[AreasLockStore] Error parsing campaign from localStorage:', error);
    }
  },

  // ==================== Computed Helpers ====================

  getSelectedArray: () => {
    return Array.from(get().selectedAreas.values());
  },

  getSelectedCount: () => {
    return get().selectedAreaKeys.size;
  },

  getLockedCount: () => {
    return get().lockedAreaKeys.size;
  },
}));

/**
 * Selector hooks for optimized rerenders
 * Use these when you only need specific parts of state
 */
export const useSelectedCount = () => useAreasLockStore(state => state.selectedAreaKeys.size);
export const useLockedCount = () => useAreasLockStore(state => state.lockedAreaKeys.size);
export const usePanelOpen = () => useAreasLockStore(state => state.panelOpen);
export const useActiveTab = () => useAreasLockStore(state => state.activeTab);
export const useIsLoading = () => useAreasLockStore(state => state.isLoading);

/**
 * Get store actions without subscribing to state changes
 * Use this for event handlers to avoid unnecessary rerenders
 */
export const getAreasLockActions = () => {
  const state = useAreasLockStore.getState();
  return {
    toggleSelection: state.toggleSelection,
    removeSelection: state.removeSelection,
    clearSelection: state.clearSelection,
    isSelected: state.isSelected,
    isLocked: state.isLocked,
    fetchLockedAreas: state.fetchLockedAreas,
    lockSelectedAreas: state.lockSelectedAreas,
    unlockAreas: state.unlockAreas,
    openPanel: state.openPanel,
    closePanel: state.closePanel,
    setActiveTab: state.setActiveTab,
    setCampaignId: state.setCampaignId,
    initializeCampaign: state.initializeCampaign,
  };
};

