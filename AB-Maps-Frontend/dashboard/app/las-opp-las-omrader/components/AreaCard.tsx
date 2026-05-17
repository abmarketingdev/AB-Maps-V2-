'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Unlock, Map, ChevronRight } from 'lucide-react';
import { Area } from '@/services/lockedAreasService';

interface AreaCardProps {
  area: Area;
  isSelected: boolean;
  isLocked?: boolean;
  isChecked?: boolean;
  onSelect: () => void;
  onCheck?: (checked: boolean) => void;
  showCheckbox?: boolean;
  showArrow?: boolean;
  loading?: boolean;
}

const AreaCard: React.FC<AreaCardProps> = ({
  area,
  isSelected,
  isLocked = false,
  isChecked = false,
  onSelect,
  onCheck,
  showCheckbox = false,
  showArrow = false,
  loading = false
}) => {
  const handleCardClick = () => {
    if (!loading) {
      onSelect();
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (onCheck) {
      onCheck(checked);
    }
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected 
          ? 'ring-2 ring-blue-500 bg-blue-50' 
          : 'hover:bg-gray-50'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 truncate">
                {area.name}
              </h3>
              {isLocked && (
                <Badge variant="destructive" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Låst
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Map className="h-4 w-4" />
                <span>{area.area_km2} km²</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{area.num_polygons} polygon{area.num_polygons !== 1 ? 'er' : ''}</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-1 font-mono">
              {area.area_key}
            </p>
          </div>
          
          <div className="flex items-center gap-2 ml-3">
            {showCheckbox && (
              <Checkbox
                checked={isChecked}
                onCheckedChange={handleCheckboxChange}
                disabled={loading}
                className="flex-shrink-0"
              />
            )}
            
            {showArrow && (
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AreaCard;
