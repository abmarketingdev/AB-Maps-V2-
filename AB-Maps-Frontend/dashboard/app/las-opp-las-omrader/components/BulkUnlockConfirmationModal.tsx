'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Unlock, AlertTriangle } from 'lucide-react';
import { LockedArea } from '@/services/lockedAreasService';

interface BulkUnlockConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedAreas: LockedArea[];
  campaignName: string;
  loading?: boolean;
}

const BulkUnlockConfirmationModal: React.FC<BulkUnlockConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  selectedAreas,
  campaignName,
  loading = false
}) => {
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
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            Confirm Unlocking Areas
          </DialogTitle>
          <DialogDescription>
            You are about to unlock {selectedAreas.length} areas for the campaign
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campaign Info */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-1">Campaign</h3>
            <p className="text-blue-800">{campaignName}</p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900 mb-1">Important Information</h4>
              <p className="text-sm text-yellow-800">
                Unlocked areas will become available for employees in this campaign. 
                This action cannot be undone automatically.
              </p>
            </div>
          </div>

          {/* Selected Areas */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Areas that will be unlocked ({selectedAreas.length})
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {selectedAreas.map((area, index) => (
                <div key={area.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{area.area_name}</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getAreaTypeColor(area.area_type)}`}
                      >
                        {area.area_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Locked by: {area.locked_by_name} • {formatDate(area.locked_at)}
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
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Unlocking areas...
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" />
                Confirm Unlocking
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUnlockConfirmationModal;
