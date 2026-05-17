'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Map, Search, Lock, Unlock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import AreaCard from './AreaCard';
import SearchBar from './SearchBar';
import MobileColumnNavigator from './MobileColumnNavigator';
import BulkActionBar from './BulkActionBar';
import BulkLockConfirmationModal from './BulkLockConfirmationModal';
import { useAreaHierarchy } from '../hooks/useAreaHierarchy';

const AreaHierarchy: React.FC = () => {
  const router = useRouter();
  const [showBulkLockModal, setShowBulkLockModal] = React.useState(false);
  const [campaignData, setCampaignData] = React.useState<any>(null);
  
  const {
    // State
    selectedCounty,
    selectedMunicipality,
    selectedBasicDistrict,
    loading,
    search,
    filteredCounties,
    filteredMunicipalities,
    filteredBasicDistricts,
    checkedAreas,
    bulkLockLoading,
    
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
  } = useAreaHierarchy();

  // Load campaign data on mount
  React.useEffect(() => {
    const loadCampaignData = () => {
      try {
        const campaignData = localStorage.getItem('currentCampaign');
        if (campaignData) {
          const parsed = JSON.parse(campaignData);
          setCampaignData(parsed);
        }
      } catch (error) {
        console.error('Error loading campaign data:', error);
      }
    };
    
    loadCampaignData();
  }, []);

  const handleBulkLock = () => {
    setShowBulkLockModal(true);
  };

  const handleConfirmBulkLock = async () => {
    if (campaignData?.id) {
      await bulkLockAreas(campaignData.id);
      setShowBulkLockModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lås nye områder</h1>
          <p className="text-gray-600">
            Velg områder fra fylker, kommuner eller grunnkretser for å låse dem
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      {(selectedCounty || selectedMunicipality) && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Valgt sti:</span>
          {selectedCounty && (
            <>
              <Badge variant="outline">{selectedCounty.name}</Badge>
              {selectedMunicipality && (
                <>
                  <span>→</span>
                  <Badge variant="outline">{selectedMunicipality.name}</Badge>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Counties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Fylke
            </CardTitle>
            <CardDescription>
              Velg et fylke for å se kommuner eller lås fylket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchBar
              placeholder="Søk fylker..."
              value={search.county}
              onChange={(value) => updateSearch('county', value)}
              loading={loading.counties}
            />
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading.counties ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredCounties.length > 0 ? (
                filteredCounties.map((county) => (
                  <AreaCard
                    key={county.area_key}
                    area={county}
                    isSelected={selectedCounty?.area_key === county.area_key}
                    onSelect={() => selectCounty(county)}
                    isLocked={county.is_locked}
                    isChecked={checkedAreas.has(county.area_key)}
                    showCheckbox={true}
                    showArrow={true}
                    onCheck={(checked) => toggleAreaCheck(county.area_key, checked)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Map className="h-8 w-8 mx-auto mb-2" />
                  <p>Ingen fylker funnet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Municipalities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Kommune
            </CardTitle>
            <CardDescription>
              {selectedCounty 
                ? `Kommuner i ${selectedCounty.name} - velg eller lås`
                : 'Velg et fylke først'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchBar
              placeholder="Søk kommuner..."
              value={search.municipality}
              onChange={(value) => updateSearch('municipality', value)}
              loading={loading.municipalities}
              className={!selectedCounty ? 'opacity-50' : ''}
            />
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {!selectedCounty ? (
                <div className="text-center py-8 text-gray-500">
                  <Map className="h-8 w-8 mx-auto mb-2" />
                  <p>Velg et fylke for å se kommuner</p>
                </div>
              ) : loading.municipalities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredMunicipalities.length > 0 ? (
                filteredMunicipalities.map((municipality) => (
                  <AreaCard
                    key={municipality.area_key}
                    area={municipality}
                    isSelected={selectedMunicipality?.area_key === municipality.area_key}
                    onSelect={() => selectMunicipality(municipality)}
                    isLocked={municipality.is_locked}
                    isChecked={checkedAreas.has(municipality.area_key)}
                    showCheckbox={true}
                    showArrow={true}
                    onCheck={(checked) => toggleAreaCheck(municipality.area_key, checked)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Map className="h-8 w-8 mx-auto mb-2" />
                  <p>Ingen kommuner funnet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Column 3: Basic Districts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Grunnkrets
            </CardTitle>
            <CardDescription>
              {selectedMunicipality 
                ? `Grunnkretser i ${selectedMunicipality.name} - velg eller lås`
                : 'Velg en kommune først'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchBar
              placeholder="Søk grunnkretser..."
              value={search.basicDistrict}
              onChange={(value) => updateSearch('basicDistrict', value)}
              loading={loading.basicDistricts}
              className={!selectedMunicipality ? 'opacity-50' : ''}
            />
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {!selectedMunicipality ? (
                <div className="text-center py-8 text-gray-500">
                  <Lock className="h-8 w-8 mx-auto mb-2" />
                  <p>Velg en kommune for å se grunnkretser</p>
                </div>
              ) : loading.basicDistricts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredBasicDistricts.length > 0 ? (
                filteredBasicDistricts.map((district) => (
                  <AreaCard
                    key={district.area_key}
                    area={district}
                    isSelected={selectedBasicDistrict?.area_key === district.area_key}
                    onSelect={() => selectBasicDistrict(district)}
                    isLocked={district.is_locked}
                    isChecked={checkedAreas.has(district.area_key)}
                    showCheckbox={true}
                    onCheck={(checked) => toggleAreaCheck(district.area_key, checked)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Lock className="h-8 w-8 mx-auto mb-2" />
                  <p>Ingen grunnkretser funnet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Navigation */}
      <MobileColumnNavigator
        selectedCounty={selectedCounty}
        selectedMunicipality={selectedMunicipality}
        selectedBasicDistrict={selectedBasicDistrict}
        onBack={() => router.back()}
        onReset={resetSelection}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={checkedAreas.size}
        onBulkLock={handleBulkLock}
        onClearSelection={clearCheckedAreas}
        campaignName={campaignData?.name}
        disabled={bulkLockLoading}
      />

      {/* Bulk Lock Confirmation Modal */}
      <BulkLockConfirmationModal
        open={showBulkLockModal}
        onClose={() => setShowBulkLockModal(false)}
        onConfirm={handleConfirmBulkLock}
        selectedAreas={getCheckedAreas()}
        campaignName={campaignData?.name || 'Unknown Campaign'}
        loading={bulkLockLoading}
      />
    </div>
  );
};

export default AreaHierarchy;
