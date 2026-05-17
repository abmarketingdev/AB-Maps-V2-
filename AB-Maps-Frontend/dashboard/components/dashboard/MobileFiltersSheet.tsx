"use client"

/**
 * Mobile Filters Sheet Component
 * 
 * Mobile-optimized filter interface using Sheet (drawer) component.
 * Shows filters in a bottom drawer on mobile devices.
 */

import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { DateRangeSelector, DateRange, formatDateForAPI } from './DateRangeSelector';
import { DashboardCampaignSelector } from './DashboardCampaignSelector';
import type { DashboardFilters } from '@/types/dashboard';

import { Campaign } from '@/services/campaignService';

interface MobileFiltersSheetProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  onRefresh?: () => void;
  loading?: boolean;
  availableCampaigns?: Campaign[]; // Optional: Filter campaigns to this list (for employees)
}

export function MobileFiltersSheet({
  filters,
  onFiltersChange,
  onRefresh,
  loading = false,
  availableCampaigns
}: MobileFiltersSheetProps) {
  const [open, setOpen] = React.useState(false);

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
    
    return {
      start: null,
      end: null,
      preset: 'last30days'
    };
  };

  const [dateRange, setDateRange] = React.useState<DateRange>(getDateRangeFromFilters());

  React.useEffect(() => {
    setDateRange(getDateRangeFromFilters());
  }, [filters.start_date, filters.end_date]);

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    
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

  const handleApply = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="default" className="md:hidden">
          <Filter className="mr-2 h-4 w-4" />
          Filtre
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader>
          <SheetTitle>Filtre</SheetTitle>
          <SheetDescription>
            Juster kampanje- og datoperiode-filtre
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {/* Campaign Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Kampanje</label>
            <DashboardCampaignSelector
              value={filters.campaign_ids || null}
              onChange={handleCampaignChange}
              availableCampaigns={availableCampaigns}
            />
          </div>

          {/* Date Range Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Datoperiode</label>
            <DateRangeSelector
              value={dateRange}
              onChange={handleDateRangeChange}
            />
          </div>

          {/* Active Filters Display */}
          {(filters.campaign_ids || filters.start_date || filters.end_date) && (
            <div className="pt-4 border-t space-y-2">
              <p className="text-sm font-medium">Aktive filtre:</p>
              <div className="flex flex-wrap gap-2">
                {filters.campaign_ids && (
                  <span className="px-3 py-1 bg-muted rounded-full text-sm">
                    {filters.campaign_ids.split(',').length} kampanje{filters.campaign_ids.split(',').length !== 1 ? 'r' : ''}
                  </span>
                )}
                {(filters.start_date || filters.end_date) && (
                  <span className="px-3 py-1 bg-muted rounded-full text-sm">
                    {filters.start_date && filters.end_date
                      ? `${filters.start_date} til ${filters.end_date}`
                      : filters.start_date
                      ? `Fra ${filters.start_date}`
                      : `Til ${filters.end_date}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Apply Button */}
          <div className="pt-4 space-y-2">
            {onRefresh && (
              <Button 
                onClick={() => {
                  if (onRefresh) onRefresh();
                  setOpen(false);
                }} 
                variant="outline" 
                className="w-full" 
                disabled={loading}
              >
                Oppdater data
              </Button>
            )}
            <Button onClick={handleApply} className="w-full" disabled={loading}>
              Bruk filtre
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileFiltersSheet;

