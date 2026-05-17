'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, AlertTriangle } from 'lucide-react';
import { Area } from '@/services/lockedAreasService';

interface BulkLockConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedAreas: Area[];
  campaignName: string;
  loading?: boolean;
}

const BulkLockConfirmationModal: React.FC<BulkLockConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  selectedAreas,
  campaignName,
  loading = false
}) => {
  const getAreaTypeLabel = (areaKey: string) => {
    if (areaKey.startsWith('fylke:')) return 'Fylke';
    if (areaKey.startsWith('kommune:')) return 'Kommune';
    if (areaKey.startsWith('grunnkrets:')) return 'Grunnkrets';
    return 'Område';
  };

  const getAreaTypeColor = (areaKey: string) => {
    if (areaKey.startsWith('fylke:')) return 'bg-blue-100 text-blue-800';
    if (areaKey.startsWith('kommune:')) return 'bg-green-100 text-green-800';
    if (areaKey.startsWith('grunnkrets:')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Bekreft låsing av områder
          </DialogTitle>
          <DialogDescription>
            Du er i ferd med å låse {selectedAreas.length} områder for kampanjen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campaign Info */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-1">Kampanje</h3>
            <p className="text-blue-800">{campaignName}</p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900 mb-1">Viktig informasjon</h4>
              <p className="text-sm text-yellow-800">
                Låste områder vil ikke være tilgjengelige for ansatte i denne kampanjen. 
                Du kan låse opp områdene senere hvis nødvendig.
              </p>
            </div>
          </div>

          {/* Selected Areas */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Områder som vil bli låst ({selectedAreas.length})
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {selectedAreas.map((area, index) => (
                <div key={area.area_key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{area.name}</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getAreaTypeColor(area.area_key)}`}
                      >
                        {getAreaTypeLabel(area.area_key)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {area.area_km2} km² • {area.num_polygons} polygon{area.num_polygons !== 1 ? 'er' : ''}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{area.area_key}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Låser områder...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Bekreft låsing
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkLockConfirmationModal;

