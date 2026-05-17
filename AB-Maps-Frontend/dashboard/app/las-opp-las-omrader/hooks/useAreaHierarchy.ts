'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { lockedAreasService, County, Municipality, BasicDistrict } from '@/services/lockedAreasService';

interface AreaHierarchyState {
  selectedCounty: County | null;
  selectedMunicipality: Municipality | null;
  selectedBasicDistrict: BasicDistrict | null;
  counties: County[];
  municipalities: Municipality[];
  basicDistricts: BasicDistrict[];
  loading: {
    counties: boolean;
    municipalities: boolean;
    basicDistricts: boolean;
  };
  search: {
    county: string;
    municipality: string;
    basicDistrict: string;
  };
  checkedAreas: Set<string>;
  bulkLockLoading: boolean;
}

const initialState: AreaHierarchyState = {
  selectedCounty: null,
  selectedMunicipality: null,
  selectedBasicDistrict: null,
  counties: [],
  municipalities: [],
  basicDistricts: [],
  loading: {
    counties: false,
    municipalities: false,
    basicDistricts: false,
  },
  search: {
    county: '',
    municipality: '',
    basicDistrict: '',
  },
  checkedAreas: new Set(),
  bulkLockLoading: false,
};

export const useAreaHierarchy = () => {
  const [state, setState] = useState<AreaHierarchyState>(initialState);
  const { toast } = useToast();

  // Load counties on mount
  useEffect(() => {
    loadCounties();
  }, []);

  const loadCounties = async () => {
    try {
      setState(prev => ({ ...prev, loading: { ...prev.loading, counties: true } }));
      const counties = await lockedAreasService.getCounties();
      setState(prev => ({ ...prev, counties, loading: { ...prev.loading, counties: false } }));
    } catch (error) {
      console.error('Error loading counties:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste inn fylker. Vennligst prøv igjen.',
        variant: 'destructive',
      });
      setState(prev => ({ ...prev, loading: { ...prev.loading, counties: false } }));
    }
  };

  const loadMunicipalities = async (countyAreaKey: string) => {
    try {
      setState(prev => ({ ...prev, loading: { ...prev.loading, municipalities: true } }));
      const municipalities = await lockedAreasService.getMunicipalities(countyAreaKey);
      setState(prev => ({ 
        ...prev, 
        municipalities, 
        loading: { ...prev.loading, municipalities: false } 
      }));
    } catch (error) {
      console.error('Error loading municipalities:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste inn kommuner. Vennligst prøv igjen.',
        variant: 'destructive',
      });
      setState(prev => ({ ...prev, loading: { ...prev.loading, municipalities: false } }));
    }
  };

  const loadBasicDistricts = async (municipalityAreaKey: string) => {
    try {
      setState(prev => ({ ...prev, loading: { ...prev.loading, basicDistricts: true } }));
      const basicDistricts = await lockedAreasService.getBasicDistricts(municipalityAreaKey);
      setState(prev => ({ 
        ...prev, 
        basicDistricts, 
        loading: { ...prev.loading, basicDistricts: false } 
      }));
    } catch (error) {
      console.error('Error loading basic districts:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste inn grunnkretser. Vennligst prøv igjen.',
        variant: 'destructive',
      });
      setState(prev => ({ ...prev, loading: { ...prev.loading, basicDistricts: false } }));
    }
  };

  const selectCounty = useCallback((county: County) => {
    setState(prev => ({
      ...prev,
      selectedCounty: county,
      selectedMunicipality: null,
      selectedBasicDistrict: null,
      municipalities: [],
      basicDistricts: [],
      search: { ...prev.search, municipality: '', basicDistrict: '' }
    }));
    loadMunicipalities(county.area_key);
  }, []);

  const selectMunicipality = useCallback((municipality: Municipality) => {
    setState(prev => ({
      ...prev,
      selectedMunicipality: municipality,
      selectedBasicDistrict: null,
      basicDistricts: [],
      search: { ...prev.search, basicDistrict: '' }
    }));
    loadBasicDistricts(municipality.area_key);
  }, []);

  const selectBasicDistrict = useCallback((basicDistrict: BasicDistrict) => {
    setState(prev => ({
      ...prev,
      selectedBasicDistrict: basicDistrict
    }));
  }, []);

  const handleLockArea = async (areaKey: string, isLocked: boolean) => {
    try {
      if (isLocked) {
        await lockedAreasService.unlockArea(areaKey);
        toast({
          title: 'Suksess',
          description: 'Område låst opp',
          variant: 'default',
        });
      } else {
        await lockedAreasService.lockArea(areaKey);
        toast({
          title: 'Suksess',
          description: 'Område låst',
          variant: 'default',
        });
      }
      
      // Refresh the current level to update lock status
      if (state.selectedMunicipality) {
        loadBasicDistricts(state.selectedMunicipality.area_key);
      } else if (state.selectedCounty) {
        loadMunicipalities(state.selectedCounty.area_key);
      } else {
        loadCounties();
      }
    } catch (error) {
      console.error('Error toggling lock status:', error);
      toast({
        title: 'Feil',
        description: `Kunne ikke ${isLocked ? 'låse opp' : 'låse'} område. Vennligst prøv igjen.`,
        variant: 'destructive',
      });
    }
  };

  const updateSearch = useCallback((level: 'county' | 'municipality' | 'basicDistrict', value: string) => {
    setState(prev => ({
      ...prev,
      search: { ...prev.search, [level]: value }
    }));
  }, []);

  const resetSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedCounty: null,
      selectedMunicipality: null,
      selectedBasicDistrict: null,
      municipalities: [],
      basicDistricts: [],
      search: { county: '', municipality: '', basicDistrict: '' }
    }));
  }, []);

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

  const clearCheckedAreas = useCallback(() => {
    setState(prev => ({ ...prev, checkedAreas: new Set() }));
  }, []);

  const getCheckedAreas = useCallback(() => {
    const allAreas = [...state.counties, ...state.municipalities, ...state.basicDistricts];
    return allAreas.filter(area => state.checkedAreas.has(area.area_key));
  }, [state.counties, state.municipalities, state.basicDistricts, state.checkedAreas]);

  const bulkLockAreas = useCallback(async (campaignId: string) => {
    const checkedAreas = getCheckedAreas();
    if (checkedAreas.length === 0) return;

    try {
      setState(prev => ({ ...prev, bulkLockLoading: true }));
      const areaKeys = checkedAreas.map(area => area.area_key);
      await lockedAreasService.bulkLockAreas(campaignId, areaKeys);
      
      toast({
        title: 'Suksess',
        description: `${checkedAreas.length} områder ble låst`,
        variant: 'default',
      });
      
      // Clear checked areas and refresh data
      setState(prev => ({ ...prev, checkedAreas: new Set() }));
      
      // Refresh current level
      if (state.selectedMunicipality) {
        loadBasicDistricts(state.selectedMunicipality.area_key);
      } else if (state.selectedCounty) {
        loadMunicipalities(state.selectedCounty.area_key);
      } else {
        loadCounties();
      }
    } catch (error) {
      console.error('Error bulk locking areas:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke låse områder. Vennligst prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setState(prev => ({ ...prev, bulkLockLoading: false }));
    }
  }, [getCheckedAreas, state.selectedMunicipality, state.selectedCounty, toast]);

  // Filter functions
  const filterCounties = (counties: County[], search: string) => {
    if (!search) return counties;
    return counties.filter(county => 
      county.name.toLowerCase().includes(search.toLowerCase())
    );
  };

  const filterMunicipalities = (municipalities: Municipality[], search: string) => {
    if (!search) return municipalities;
    return municipalities.filter(municipality => 
      municipality.name.toLowerCase().includes(search.toLowerCase())
    );
  };

  const filterBasicDistricts = (basicDistricts: BasicDistrict[], search: string) => {
    if (!search) return basicDistricts;
    return basicDistricts.filter(district => 
      district.name.toLowerCase().includes(search.toLowerCase())
    );
  };

  const filteredCounties = filterCounties(state.counties, state.search.county);
  const filteredMunicipalities = filterMunicipalities(state.municipalities, state.search.municipality);
  const filteredBasicDistricts = filterBasicDistricts(state.basicDistricts, state.search.basicDistrict);

  return {
    // State
    ...state,
    filteredCounties,
    filteredMunicipalities,
    filteredBasicDistricts,
    
    // Actions
    selectCounty,
    selectMunicipality,
    selectBasicDistrict,
    handleLockArea,
    updateSearch,
    resetSelection,
    
    // Bulk actions
    toggleAreaCheck,
    clearCheckedAreas,
    getCheckedAreas,
    bulkLockAreas,
    
    // Loading functions
    loadCounties,
    loadMunicipalities,
    loadBasicDistricts,
  };
};
