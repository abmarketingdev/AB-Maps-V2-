"use client"

/**
 * Activity Item Component
 * 
 * Individual activity item displaying status, address, timestamp, and campaign name.
 */

import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { MapPin, Clock, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RecentActivity } from '@/types/dashboard';

interface ActivityItemProps {
  activity: RecentActivity;
  className?: string;
}

/**
 * Get status badge color
 */
const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case 'ja':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'nei':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'ikke_hjemme':
    case 'ikke hjemme':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'folg_opp':
    case 'følg opp':
      return 'bg-blue-100 text-blue-800 border-blue-200';
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
 * Format relative time (e.g., "2 hours ago")
 */
const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
};

export function ActivityItem({ activity, className }: ActivityItemProps) {
  return (
    <Card
      className={cn(
        "transition-shadow",
        className
      )}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-3">
          {/* Header: Status and Time */}
          <div className="flex items-start justify-between gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs", getStatusColor(activity.status))}
            >
              {activity.status}
            </Badge>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatRelativeTime(activity.created_at)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(activity.created_at)}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="font-medium text-sm leading-tight">
                {activity.address_text}
              </p>
            </div>
          </div>

          {/* Campaign */}
          {activity.campaign && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>{activity.campaign.name}</span>
            </div>
          )}

          {/* Location Coordinates */}
          {activity.metadata?.position && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <MapPin className="h-3 w-3 inline mr-1" />
              {activity.metadata.position.lat.toFixed(6)}, {activity.metadata.position.lng.toFixed(6)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivityItem;

