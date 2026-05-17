"use client"

/**
 * Date Range Selector Component
 * 
 * Provides date range filtering with presets and custom date picker.
 * Supports "All Time" option which omits date parameters.
 */

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export type DatePreset = 'last7days' | 'last30days' | 'last90days' | 'allTime' | 'custom';

export interface DateRange {
  start: Date | null;
  end: Date | null;
  preset: DatePreset;
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

/**
 * Get date range from preset
 */
const getDateRangeFromPreset = (preset: DatePreset): { start: Date | null; end: Date | null } => {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  switch (preset) {
    case 'last7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end: today };
    }
    case 'last30days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end: today };
    }
    case 'last90days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      return { start, end: today };
    }
    case 'allTime':
      return { start: null, end: null };
    case 'custom':
      return { start: null, end: null };
    default:
      return { start: null, end: null };
  }
};

/**
 * Format date for display
 */
const formatDateDisplay = (date: Date | null): string => {
  if (!date) return '';
  return format(date, 'MMM dd, yyyy');
};

/**
 * Format date for API (YYYY-MM-DD)
 */
export const formatDateForAPI = (date: Date | null): string | null => {
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
};

export function DateRangeSelector({ value, onChange, className }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const handlePresetChange = (preset: DatePreset) => {
    const { start, end } = getDateRangeFromPreset(preset);
    onChange({
      start,
      end,
      preset
    });
    
    // Close popover if not custom
    if (preset !== 'custom') {
      setIsOpen(false);
    }
  };

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    
    onChange({
      start: range.from || null,
      end: range.to || null,
      preset: 'custom'
    });
  };

  const displayText = () => {
    if (value.preset === 'allTime') {
      return 'Hele perioden';
    }
    if (value.preset === 'custom') {
      if (value.start && value.end) {
        return `${formatDateDisplay(value.start)} - ${formatDateDisplay(value.end)}`;
      }
      if (value.start) {
        return `Fra ${formatDateDisplay(value.start)}`;
      }
      return 'Velg datoperiode';
    }
    // Preset selected
    const { start, end } = getDateRangeFromPreset(value.preset);
    if (start && end) {
      return `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;
    }
    return 'Velg datoperiode';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value.start && !value.end && value.preset !== 'allTime' && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Preset Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Hurtigvalg</label>
            <Select
              value={value.preset}
              onValueChange={(val) => handlePresetChange(val as DatePreset)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last7days">Siste 7 dager</SelectItem>
                <SelectItem value="last30days">Siste 30 dager</SelectItem>
                <SelectItem value="last90days">Siste 90 dager</SelectItem>
                <SelectItem value="allTime">Hele perioden</SelectItem>
                <SelectItem value="custom">Egendefinert periode</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Picker */}
          {value.preset === 'custom' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Velg datoperiode</label>
              <Calendar
                mode="range"
                selected={{
                  from: value.start || undefined,
                  to: value.end || undefined
                }}
                onSelect={handleDateSelect}
                numberOfMonths={isMobile ? 1 : 2}
                className="rounded-md border"
              />
            </div>
          )}

          {/* Display selected range for presets */}
          {value.preset !== 'custom' && value.preset !== 'allTime' && (
            <div className="text-sm text-muted-foreground">
              {(() => {
                const { start, end } = getDateRangeFromPreset(value.preset);
                if (start && end) {
                  return `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;
                }
                return '';
              })()}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Bruk
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateRangeSelector;

