"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileFormFieldProps {
  label: string;
  children: React.ReactNode;
  /**
   * Error message to display below the field
   */
  error?: string;
  /**
   * Helper text to display below the field
   */
  helperText?: string;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Custom className for the label
   */
  labelClassName?: string;
}

/**
 * MobileFormField Component
 * 
 * A mobile-optimized form field wrapper that:
 * - Provides proper label/input spacing
 * - Ensures touch-friendly input heights (min 44px)
 * - Single-column layout on mobile
 * - Proper error and helper text display
 */
const MobileFormField: React.FC<MobileFormFieldProps> = ({
  label,
  children,
  error,
  helperText,
  required = false,
  className,
  labelClassName,
}) => {
  const isMobile = useIsMobile();

  // Generate unique ID for label/input association
  const fieldId = React.useId();
  const labelId = `${fieldId}-label`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const helperId = helperText && !error ? `${fieldId}-helper` : undefined;

  return (
    <div className={cn("space-y-2", className)} role="group" aria-labelledby={labelId}>
      <Label
        id={labelId}
        htmlFor={fieldId}
        className={cn(
          "font-medium transition-colors",
          isMobile ? "text-sm" : "text-sm",
          required && "after:content-['*'] after:ml-1 after:text-red-500",
          labelClassName
        )}
      >
        {label}
      </Label>
      <div className={cn(isMobile && "min-h-[44px]")}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              id: fieldId,
              "aria-describedby": [errorId, helperId].filter(Boolean).join(" ") || undefined,
              "aria-invalid": error ? "true" : undefined,
              "aria-required": required ? "true" : undefined,
            });
          }
          return child;
        })}
      </div>
      {error && (
        <p
          id={errorId}
          className={cn(
            "text-red-600 transition-opacity animate-in fade-in duration-200",
            isMobile ? "text-xs" : "text-sm"
          )}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={helperId}
          className={cn(
            "text-gray-500 transition-opacity",
            isMobile ? "text-xs" : "text-sm"
          )}
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export default MobileFormField;

