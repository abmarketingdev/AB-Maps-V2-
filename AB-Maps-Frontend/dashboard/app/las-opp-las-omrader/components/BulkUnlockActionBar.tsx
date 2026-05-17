'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Unlock, X } from 'lucide-react';

interface BulkUnlockActionBarProps {
  selectedCount: number;
  onBulkUnlock: () => void;
  onClearSelection: () => void;
  campaignName?: string;
  disabled?: boolean;
}

const BulkUnlockActionBar: React.FC<BulkUnlockActionBarProps> = ({
  selectedCount,
  onBulkUnlock,
  onClearSelection,
  campaignName,
  disabled = false
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 flex items-center gap-4 min-w-[300px] max-w-[90vw]">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Unlock className="h-3 w-3" />
            {selectedCount} selected
          </Badge>
        </div>
        
        <div className="flex-1">
          <p className="text-sm text-gray-600">
            {campaignName && `For ${campaignName}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          
          <Button
            onClick={onBulkUnlock}
            disabled={disabled}
            className="flex items-center gap-1"
          >
            <Unlock className="h-3 w-3" />
            <span className="hidden sm:inline">Unlock areas</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BulkUnlockActionBar;
