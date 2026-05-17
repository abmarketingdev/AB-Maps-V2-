"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface DataField {
  label: string;
  value: React.ReactNode;
  /**
   * Whether to highlight this field (e.g., primary data)
   */
  highlight?: boolean;
}

interface MobileDataCardProps {
  /**
   * Title of the card
   */
  title?: string;
  /**
   * Subtitle or secondary title
   */
  subtitle?: string;
  /**
   * Data fields to display
   */
  fields: DataField[];
  /**
   * Badge to display (e.g., status, type)
   */
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  /**
   * Action buttons to display at the bottom
   */
  actions?: React.ReactNode;
  /**
   * Click handler for the entire card
   */
  onClick?: () => void;
  /**
   * Custom className
   */
  className?: string;
}

/**
 * MobileDataCard Component
 * 
 * A mobile-optimized card component for displaying data that would
 * typically be shown in a table row. Converts table data into
 * touch-friendly card format on mobile devices.
 * 
 * Features:
 * - Touch-friendly card layout
 * - Proper spacing and typography
 * - Action buttons support
 * - Clickable card support
 */
const MobileDataCard: React.FC<MobileDataCardProps> = ({
  title,
  subtitle,
  fields,
  badge,
  actions,
  onClick,
  className,
}) => {
  const isMobile = useIsMobile();

  return (
    <Card
      className={cn(
        "transition-all",
        onClick && "cursor-pointer hover:shadow-md active:scale-[0.98]",
        isMobile && "min-h-[120px]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className={cn(isMobile ? "p-4" : "p-6")}>
        {/* Header */}
        {(title || badge) && (
          <div className="flex items-start justify-between mb-3">
            {title && (
              <div className="flex-1 pr-2">
                <h3
                  className={cn(
                    "font-semibold",
                    isMobile ? "text-base" : "text-lg"
                  )}
                >
                  {title}
                </h3>
                {subtitle && (
                  <p
                    className={cn(
                      "text-gray-600 mt-1",
                      isMobile ? "text-xs" : "text-sm"
                    )}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            {badge && (
              <Badge
                variant={badge.variant || "default"}
                className={cn(
                  "flex-shrink-0",
                  isMobile ? "text-[10px] px-2 py-0" : "text-xs"
                )}
              >
                {badge.label}
              </Badge>
            )}
          </div>
        )}

        {/* Data Fields */}
        <div className={cn("space-y-2", isMobile && "space-y-2.5")}>
          {fields.map((field, index) => (
            <div
              key={index}
              className={cn(
                "flex flex-col",
                field.highlight && "bg-gray-50 p-2 rounded"
              )}
            >
              <span
                className={cn(
                  "text-gray-600 font-medium",
                  isMobile ? "text-xs mb-0.5" : "text-sm mb-1"
                )}
              >
                {field.label}
              </span>
              <span
                className={cn(
                  "text-gray-900",
                  field.highlight
                    ? isMobile
                      ? "text-sm font-semibold"
                      : "text-base font-semibold"
                    : isMobile
                    ? "text-sm"
                    : "text-base"
                )}
              >
                {field.value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {actions && (
          <div
            className={cn(
              "mt-4 pt-4 border-t",
              isMobile ? "flex flex-col gap-2" : "flex flex-row gap-2"
            )}
          >
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MobileDataCard;

