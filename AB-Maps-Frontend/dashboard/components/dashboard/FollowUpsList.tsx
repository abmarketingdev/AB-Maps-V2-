"use client"

/**
 * Follow-ups List Component
 * 
 * List of follow-up addresses with pagination support.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { FollowUpItem } from './FollowUpItem';
import type { FollowUpsResponse, FollowUpAddress, DashboardFilters } from '@/types/dashboard';

interface FollowUpsListProps {
  followUps: FollowUpsResponse | null;
  loading: boolean;
  filters: DashboardFilters;
  onFiltersChange?: (filters: DashboardFilters) => void;
  onAddressClick?: (address: FollowUpAddress) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 10;

export function FollowUpsList({
  followUps,
  loading,
  filters,
  onFiltersChange,
  onAddressClick,
  className
}: FollowUpsListProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  const [prevFilters, setPrevFilters] = useState<DashboardFilters>(filters);

  // Reset pagination when filters change (except offset/limit)
  useEffect(() => {
    const filtersChanged = 
      prevFilters.campaign_ids !== filters.campaign_ids ||
      prevFilters.start_date !== filters.start_date ||
      prevFilters.end_date !== filters.end_date;
    
    if (filtersChanged && currentPage !== 0) {
      setCurrentPage(0);
    }
    
    setPrevFilters(filters);
  }, [filters.campaign_ids, filters.start_date, filters.end_date, currentPage, prevFilters]);

  // Calculate pagination info
  const totalPages = followUps ? Math.ceil(followUps.count / ITEMS_PER_PAGE) : 0;
  const currentOffset = currentPage * ITEMS_PER_PAGE;

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages || loadingPage) return;

    setLoadingPage(true);
    setCurrentPage(newPage);

    const newFilters: DashboardFilters = {
      ...filters,
      limit: ITEMS_PER_PAGE,
      offset: newPage * ITEMS_PER_PAGE
    };

    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
    
    // Reset loading state after a short delay (actual loading handled by parent)
    setTimeout(() => setLoadingPage(false), 100);
  };

  // Handle address click
  const handleAddressClick = (address: FollowUpAddress) => {
    if (onAddressClick) {
      onAddressClick(address);
    } else {
      // Default: Open in AB Maps if available
      if (address.position && address.position.coordinates) {
        const [lng, lat] = address.position.coordinates;
        const mapsUrl = process.env.NEXT_PUBLIC_AB_MAPS_MANAGER_URL;
        if (mapsUrl) {
          window.open(`${mapsUrl}?lat=${lat}&lng=${lng}`, '_blank');
        }
      }
    }
  };

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
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!followUps || followUps.results.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Følg opp</CardTitle>
          <CardDescription>Adresser som krever oppfølging</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <RefreshCw className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Ingen oppfølging påkrevd
            </p>
            <p className="text-xs text-muted-foreground">
              Alle adresser er behandlet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Følg opp</CardTitle>
            <CardDescription>
              {followUps.count} adresse{followUps.count !== 1 ? 'r' : ''} som krever oppfølging
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 sm:space-y-3">
          {/* Follow-up Items */}
          {followUps.results.map((address) => (
            <FollowUpItem
              key={address.id}
              address={address}
              onClick={handleAddressClick}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 sm:mt-6 pt-4 border-t">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              Viser {currentOffset + 1} til {Math.min(currentOffset + ITEMS_PER_PAGE, followUps.count)} av {followUps.count}
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0 || loadingPage}
                className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Forrige</span>
              </Button>
              <div className="text-xs sm:text-sm text-muted-foreground px-2 whitespace-nowrap">
                Side {currentPage + 1} av {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1 || loadingPage}
                className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
              >
                <span className="hidden sm:inline">Neste</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FollowUpsList;

