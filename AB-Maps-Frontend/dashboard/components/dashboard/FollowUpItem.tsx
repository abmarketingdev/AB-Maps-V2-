"use client"

/**
 * Follow-up Item Component
 * 
 * Individual follow-up address item displaying address, status, date, notes, and location.
 */

import React from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FollowUpAddress } from '@/types/dashboard';

interface FollowUpItemProps {
  address: FollowUpAddress;
  onClick?: (address: FollowUpAddress) => void;
  className?: string;
}

/**
 * Get status badge color
 */
const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case 'folg_opp':
    case 'følg opp':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ja':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'nei':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'ikke_hjemme':
    case 'ikke hjemme':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy HH:mm');
  } catch {
    return dateString;
  }
};

/**
 * Format coordinates for display
 */
const formatCoordinates = (coordinates: [number, number]): string => {
  return `${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`;
};

export function FollowUpItem({ address, onClick, className }: FollowUpItemProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(address);
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow touch-manipulation",
        onClick && "hover:border-primary active:scale-[0.98]",
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-3">
          {/* Header: Status and Date */}
          <div className="flex items-start justify-between gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs", getStatusColor(address.status))}
            >
              {address.status_display || address.status}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(address.recorded_at)}</span>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="font-medium text-sm leading-tight">
                {address.address_text}
              </p>
            </div>
          </div>

          {/* Campaign */}
          {address.campaign && (
            <div className="text-xs text-muted-foreground">
              Kampanje: {address.campaign.name}
            </div>
          )}

          {/* Notes */}
          {address.notes && (
            <div className="flex items-start gap-2 pt-2 border-t">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">
                {address.notes}
              </p>
            </div>
          )}

          {/* Location Coordinates */}
          {address.position && address.position.coordinates && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <MapPin className="h-3 w-3 inline mr-1" />
              {formatCoordinates(address.position.coordinates)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default FollowUpItem;

