'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Map, Lock } from 'lucide-react';
import { County, Municipality, BasicDistrict } from '@/services/lockedAreasService';

interface MobileColumnNavigatorProps {
  selectedCounty: County | null;
  selectedMunicipality: Municipality | null;
  selectedBasicDistrict: BasicDistrict | null;
  onBack: () => void;
  onReset: () => void;
}

const MobileColumnNavigator: React.FC<MobileColumnNavigatorProps> = ({
  selectedCounty,
  selectedMunicipality,
  selectedBasicDistrict,
  onBack,
  onReset
}) => {
  const [currentStep, setCurrentStep] = useState<'county' | 'municipality' | 'basicDistrict'>('county');

  const getCurrentStep = () => {
    if (selectedBasicDistrict) return 'basicDistrict';
    if (selectedMunicipality) return 'municipality';
    if (selectedCounty) return 'county';
    return 'county';
  };

  const getStepTitle = () => {
    switch (getCurrentStep()) {
      case 'county':
        return 'Velg Fylke';
      case 'municipality':
        return 'Velg Kommune';
      case 'basicDistrict':
        return 'Lås Grunnkretser';
      default:
        return 'Velg Fylke';
    }
  };

  const getStepDescription = () => {
    switch (getCurrentStep()) {
      case 'county':
        return 'Velg et fylke for å se kommuner';
      case 'municipality':
        return `Kommuner i ${selectedCounty?.name}`;
      case 'basicDistrict':
        return `Grunnkretser i ${selectedMunicipality?.name}`;
      default:
        return 'Velg et fylke for å se kommuner';
    }
  };

  const canGoBack = () => {
    return selectedCounty !== null;
  };

  const handleBack = () => {
    if (selectedBasicDistrict) {
      // Go back to municipality selection
      setCurrentStep('municipality');
    } else if (selectedMunicipality) {
      // Go back to county selection
      setCurrentStep('county');
    } else {
      onBack();
    }
  };

  return (
    <div className="lg:hidden space-y-4">
      {/* Step Indicator */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${selectedCounty ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-600">Fylke</span>
              </div>
              <ChevronRight className="h-3 w-3 text-gray-400" />
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${selectedMunicipality ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-600">Kommune</span>
              </div>
              <ChevronRight className="h-3 w-3 text-gray-400" />
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${selectedBasicDistrict ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-600">Grunnkrets</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="text-xs"
            >
              Tilbakestill
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Selection */}
      {(selectedCounty || selectedMunicipality) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Valgt sti</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCounty && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Map className="h-3 w-3" />
                  {selectedCounty.name}
                </Badge>
              )}
              {selectedMunicipality && (
                <>
                  <ChevronRight className="h-3 w-3 text-gray-400" />
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Map className="h-3 w-3" />
                    {selectedMunicipality.name}
                  </Badge>
                </>
              )}
              {selectedBasicDistrict && (
                <>
                  <ChevronRight className="h-3 w-3 text-gray-400" />
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    {selectedBasicDistrict.name}
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          disabled={!canGoBack()}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </Button>
        
        <div className="text-center">
          <h3 className="font-medium text-gray-900">{getStepTitle()}</h3>
          <p className="text-sm text-gray-600">{getStepDescription()}</p>
        </div>
        
        <div className="w-20" /> {/* Spacer for alignment */}
      </div>
    </div>
  );
};

export default MobileColumnNavigator;
