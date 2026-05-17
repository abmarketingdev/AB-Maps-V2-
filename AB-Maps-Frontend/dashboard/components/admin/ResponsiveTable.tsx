"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import MobileDataCard from "./MobileDataCard";

interface TableColumn {
  key: string;
  label: string;
  /**
   * Whether this column should be highlighted in mobile card view
   */
  highlight?: boolean;
  /**
   * Custom render function for cell content
   */
  render?: (value: any, row: any) => React.ReactNode;
}

interface ResponsiveTableProps {
  /**
   * Column definitions
   */
  columns: TableColumn[];
  /**
   * Table data
   */
  data: any[];
  /**
   * Key field for React keys (default: "id")
   */
  keyField?: string;
  /**
   * Title field for mobile cards (default: first column)
   */
  titleField?: string;
  /**
   * Subtitle field for mobile cards
   */
  subtitleField?: string;
  /**
   * Badge field for mobile cards
   */
  badgeField?: {
    field: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  /**
   * Actions to display in mobile cards
   */
  actions?: (row: any) => React.ReactNode;
  /**
   * Click handler for rows/cards
   */
  onRowClick?: (row: any) => void;
  /**
   * Custom className for table container
   */
  className?: string;
  /**
   * Empty state message
   */
  emptyMessage?: string;
}

/**
 * ResponsiveTable Component
 * 
 * A responsive table component that:
 * - Renders as a table on desktop
 * - Renders as cards on mobile
 * - Provides horizontal scroll fallback for tables
 * - Handles empty states
 */
const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  columns,
  data,
  keyField = "id",
  titleField,
  subtitleField,
  badgeField,
  actions,
  onRowClick,
  className,
  emptyMessage = "No data available",
}) => {
  const isMobile = useIsMobile();

  // Determine title field (use first column if not specified)
  const titleKey = titleField || columns[0]?.key;

  if (data.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  // Mobile: Render as cards
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {data.map((row) => {
          const fields = columns.map((column) => {
            const value = row[column.key];
            const displayValue = column.render
              ? column.render(value, row)
              : value;

            return {
              label: column.label,
              value: displayValue,
              highlight: column.highlight,
            };
          });

          const title = titleKey ? row[titleKey] : undefined;
          const subtitle = subtitleField ? row[subtitleField] : undefined;
          const badge = badgeField
            ? {
                label: row[badgeField.field] || "",
                variant: badgeField.variant,
              }
            : undefined;

          return (
            <MobileDataCard
              key={row[keyField]}
              title={title}
              subtitle={subtitle}
              fields={fields}
              badge={badge}
              actions={actions ? actions(row) : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            />
          );
        })}
      </div>
    );
  }

  // Desktop: Render as table
  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
            {actions && <TableHead className="w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row[keyField]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer" : ""}
            >
              {columns.map((column) => {
                const value = row[column.key];
                const displayValue = column.render
                  ? column.render(value, row)
                  : value;

                return (
                  <TableCell key={column.key}>{displayValue}</TableCell>
                );
              })}
              {actions && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    {actions(row)}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ResponsiveTable;

