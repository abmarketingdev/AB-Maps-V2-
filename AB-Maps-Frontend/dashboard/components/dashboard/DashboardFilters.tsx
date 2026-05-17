"use client"

/**
 * Dashboard Filters Component
 * 
 * Main filter component that combines campaign selector and date range selector.
 * Manages filter state and applies filters to the dashboard.
 */

import React from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangeSelector, DateRange, formatDateForAPI } from './DateRangeSelector';
import { DashboardCampaignSelector } from './DashboardCampaignSelector';
import { MobileFiltersSheet } from './MobileFiltersSheet';
import type { DashboardFilters } from '@/types/dashboard';

import { Campaign } from '@/services/campaignService';

interface DashboardFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
  availableCampaigns?: Campaign[]; // Optional: Filter campaigns to this list (for employees)
}

export function DashboardFilters({
  filters,
  onFiltersChange,
  onRefresh,
  loading = false,
  className,
  availableCampaigns
}: DashboardFiltersProps) {
  // Initialize date range from filters
  const getDateRangeFromFilters = (): DateRange => {
    if (!filters.start_date && !filters.end_date) {
      return {
        start: null,
        end: null,
        preset: 'allTime'
      };
    }
    
    if (filters.start_date && filters.end_date) {
      return {
        start: new Date(filters.start_date),
        end: new Date(filters.end_date),
        preset: 'custom'
      };
    }
    
    // Default to last 30 days if dates are partially set
    return {
      start: null,
      end: null,
      preset: 'last30days'
    };
  };

  const [dateRange, setDateRange] = React.useState<DateRange>(getDateRangeFromFilters());

  // Update date range when filters change externally
  React.useEffect(() => {
    setDateRange(getDateRangeFromFilters());
  }, [filters.start_date, filters.end_date]);

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    
    // Build new filters
    const newFilters: DashboardFilters = {
      ...filters,
      start_date: range.preset === 'allTime' ? null : formatDateForAPI(range.start),
      end_date: range.preset === 'allTime' ? null : formatDateForAPI(range.end)
    };
    
    onFiltersChange(newFilters);
  };

  const handleCampaignChange = (campaignIds: string | null) => {
    const newFilters: DashboardFilters = {
      ...filters,
      campaign_ids: campaignIds
    };
    
    onFiltersChange(newFilters);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className={className}>
      {/* Mobile: Filter Button + Sheet */}
      <div className="md:hidden mb-3">
        <MobileFiltersSheet
          filters={filters}
          onFiltersChange={onFiltersChange}
          onRefresh={onRefresh}
          loading={loading}
          availableCampaigns={availableCampaigns}
        />
      </div>

      {/* Desktop: Inline Filters */}
      <div className="hidden md:block">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Campaign Selector */}
          <div className="flex-1 min-w-0">
            <DashboardCampaignSelector
              value={filters.campaign_ids || null}
              onChange={handleCampaignChange}
              availableCampaigns={availableCampaigns}
            />
          </div>

          {/* Date Range Selector */}
          <div className="flex-1 min-w-0">
            <DateRangeSelector
              value={dateRange}
              onChange={handleDateRangeChange}
            />
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <Button
              variant="outline"
              size="default"
              onClick={handleRefresh}
              disabled={loading}
              className="shrink-0"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Oppdater</span>
            </Button>
          )}
        </div>
      </div>

        {/* Refresh Button - Mobile */}
        {onRefresh && (
          <div className="md:hidden mt-3">
            <Button
              variant="outline"
              size="default"
              onClick={handleRefresh}
              disabled={loading}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Oppdater
            </Button>
          </div>
        )}

      {/* Active Filters Display - Mobile */}
      {(filters.campaign_ids || filters.start_date || filters.end_date) && (
        <div className="md:hidden mt-3 flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          <span>Aktive:</span>
          {filters.campaign_ids && (
            <span className="px-2 py-0.5 bg-muted rounded text-xs">
              {filters.campaign_ids.split(',').length} kampanje{filters.campaign_ids.split(',').length !== 1 ? 'r' : ''}
            </span>
          )}
          {(filters.start_date || filters.end_date) && (
            <span className="px-2 py-0.5 bg-muted rounded text-xs">
              {filters.start_date && filters.end_date
                ? `${filters.start_date} til ${filters.end_date}`
                : filters.start_date
                ? `Fra ${filters.start_date}`
                : `Til ${filters.end_date}`}
            </span>
          )}
        </div>
      )}

      {/* Active Filters Display - Desktop */}
      {(filters.campaign_ids || filters.start_date || filters.end_date) && (
        <div className="hidden md:flex mt-3 flex-wrap gap-2 items-center text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Aktive filtre:</span>
          {filters.campaign_ids && (
            <span className="px-2 py-1 bg-muted rounded">
              {filters.campaign_ids.split(',').length} kampanje{filters.campaign_ids.split(',').length !== 1 ? 'r' : ''}
            </span>
          )}
          {(filters.start_date || filters.end_date) && (
            <span className="px-2 py-1 bg-muted rounded">
              {filters.start_date && filters.end_date
                ? `${filters.start_date} til ${filters.end_date}`
                : filters.start_date
                ? `Fra ${filters.start_date}`
                : `Til ${filters.end_date}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardFilters;

