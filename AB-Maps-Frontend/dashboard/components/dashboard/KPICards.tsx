"use client"

/**
 * KPI Cards Component
 * 
 * Container component displaying 4 KPI cards:
 * - Total Contacts
 * - Ja Count
 * - Hit Rate
 * - Average Per Day
 */

import React from 'react';
import { Users, CheckCircle2, Target, TrendingUp } from 'lucide-react';
import { KPICard } from './KPICard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { DashboardStatsResponse } from '@/types/dashboard';

interface KPICardsProps {
  stats: DashboardStatsResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loading skeleton for KPI cards
 */
function KPICardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Error state for KPI cards
 */
function KPICardsError({ error }: { error: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-destructive">
              {i === 1 ? error : 'Feil ved lasting av data'}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KPICards({ stats, loading, error }: KPICardsProps) {
  // Loading state
  if (loading) {
    return <KPICardsSkeleton />;
  }

  // Error state
  if (error) {
    return <KPICardsError error={error} />;
  }

  // No data state
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Ingen data tilgjengelig
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { summary, status_counts, calculated_metrics } = stats;

  // Calculate hit rate with fallback if calculated_metrics is missing
  // This handles cases where the API doesn't return calculated_metrics when filtering
  const hitRate = calculated_metrics?.hit_rate != null 
    ? calculated_metrics.hit_rate 
    : (summary.total_responses > 0 
        ? (status_counts.ja / summary.total_responses) * 100 
        : 0);

  // Format hit rate as percentage
  const hitRateDisplay = hitRate.toFixed(1);

  // Format average per day
  const avgPerDayDisplay = summary.avg_per_day ? summary.avg_per_day.toFixed(2) : '0.00';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Contacts Card */}
      <KPICard
        title="Totale pitcher"
        value={summary.total_responses}
        icon={Users}
        color="blue"
        subtitle={`${summary.days_in_range} dager i perioden`}
      />

      {/* Ja Count Card */}
      <KPICard
        title="Ja"
        value={status_counts.ja}
        icon={CheckCircle2}
        color="green"
        subtitle={`${hitRateDisplay}% treffrate`}
      />

      {/* Hit Rate Card */}
      <KPICard
        title="Closing rate"
        value={`${hitRateDisplay}%`}
        icon={Target}
        color="purple"
        subtitle={`${status_counts.ja} / ${summary.total_responses} kontakter`}
      />

      {/* Average Per Day Card */}
      <KPICard
        title="Gj.snitt salg / dag"
        value={avgPerDayDisplay}
        icon={TrendingUp}
        color="orange"
        subtitle={`${summary.days_in_range} dager`}
      />
    </div>
  );
}

export default KPICards;

