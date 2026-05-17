'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Map, User, Calendar, Loader2 } from 'lucide-react';
import { LockedArea } from '@/services/lockedAreasService';

interface LockedAreaCardProps {
  area: LockedArea;
  isChecked: boolean;
  onCheck: (checked: boolean) => void;
  loading?: boolean;
}

const LockedAreaCard: React.FC<LockedAreaCardProps> = ({
  area,
  isChecked,
  onCheck,
  loading = false
}) => {
  const handleCheckboxChange = (checked: boolean) => {
    onCheck(checked);
  };

  const getAreaTypeColor = (areaType: string) => {
    switch (areaType.toLowerCase()) {
      case 'fylke':
        return 'bg-blue-100 text-blue-800';
      case 'kommune':
        return 'bg-green-100 text-green-800';
      case 'grunnkrets':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('no-NO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      isChecked ? 'border-blue-500 bg-blue-50/50' : ''
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="flex-shrink-0 pt-1">
            <Checkbox
              checked={isChecked}
              onCheckedChange={handleCheckboxChange}
              disabled={loading}
            />
          </div>

          {/* Area Info */}
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-grow min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {area.area_name}
                </h3>
                <p className="text-sm text-gray-600 font-mono">
                  {area.area_key}
                </p>
              </div>
              
              <div className="flex items-center gap-2 ml-3">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getAreaTypeColor(area.area_type)}`}
                >
                  {area.area_type}
                </Badge>
                <Lock className="h-4 w-4 text-red-500 flex-shrink-0" />
              </div>
            </div>

            {/* Area Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-1">
                <Map className="h-3 w-3" />
                <span>{area.area_level}</span>
              </div>
              
              {area.children_count > 0 && (
                <div className="flex items-center gap-1">
                  <span>Children: {area.children_count}</span>
                </div>
              )}
            </div>

            {/* Lock Information */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-3 w-3" />
                <span>Locked by: {area.locked_by_name}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-3 w-3" />
                <span>Locked: {formatDate(area.locked_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LockedAreaCard;
