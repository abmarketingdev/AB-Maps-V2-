"use client"

/**
 * Recent Activities List Component
 * 
 * Activity feed displaying recent contact activities.
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityItem } from './ActivityItem';
import type { RecentActivitiesResponse } from '@/types/dashboard';

interface RecentActivitiesListProps {
  activities: RecentActivitiesResponse | null;
  loading: boolean;
  className?: string;
}

export function RecentActivitiesList({
  activities,
  loading,
  className
}: RecentActivitiesListProps) {

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!activities || activities.results.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Nylige registreringer</CardTitle>
          <CardDescription>Siste kontaktaktiviteter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Ingen nylige aktiviteter
            </p>
            <p className="text-xs text-muted-foreground">
              Aktiviteter vil vises her når kontakter opprettes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Nylige registreringer</CardTitle>
        <CardDescription>
          {activities.count} nylig{activities.count !== 1 ? 'e' : ''} registrering{activities.count !== 1 ? 'er' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
          {activities.results.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default RecentActivitiesList;

