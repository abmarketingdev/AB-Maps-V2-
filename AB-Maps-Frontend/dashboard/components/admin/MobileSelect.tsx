"use client";

import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  /**
   * Whether the select is disabled
   */
  disabled?: boolean;
  /**
   * Custom className for the select trigger
   */
  className?: string;
  /**
   * Error state styling
   */
  error?: boolean;
}

/**
 * MobileSelect Component
 * 
 * A mobile-optimized select component that:
 * - Ensures touch-friendly trigger height (min 44px)
 * - Provides proper mobile styling
 * - Handles error states
 */
const MobileSelect: React.FC<MobileSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select...",
  options,
  disabled = false,
  className,
  error = false,
}) => {
  const isMobile = useIsMobile();

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "w-full transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isMobile && "min-h-[44px] h-auto",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        aria-invalid={error ? "true" : undefined}
        aria-required={false}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className={cn(
          isMobile && "max-h-[60vh]",
          "transition-all animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={cn(
              isMobile && "min-h-[44px] py-3",
              "transition-colors hover:bg-gray-100 focus:bg-gray-100"
            )}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default MobileSelect;

