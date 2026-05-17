"use client";

import type { TooltipData } from "@/lib/demographics/types";

interface TooltipProps {
  data: TooltipData | null;
}

/**
 * Tooltip Component
 * 
 * Phase 4: Display tooltip on hover over grunnkrets
 * - Shows area name and code
 * - Shows key demographic fields
 * - Positioned at cursor location
 * - Minimal rerenders - only updates when data changes
 */
export function Tooltip({ data }: TooltipProps) {
  if (!data) return null;

  // Format number with null handling
  const formatNumber = (value: number | null): string => {
    if (value === null || value === undefined) return "N/A";
    return value.toLocaleString();
  };

  // Format percentage with null handling
  const formatPercent = (value: number | null): string => {
    if (value === null || value === undefined) return "N/A";
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: data.x + 12,
        top: data.y + 12,
      }}
    >
      <div className="bg-gray-900/95 text-white rounded-lg shadow-xl px-3 py-2 min-w-[180px] max-w-[280px]">
        {/* Area name and code */}
        <div className="border-b border-gray-700 pb-1.5 mb-1.5">
          <h4 className="font-semibold text-sm truncate">{data.name || "Unknown"}</h4>
          <p className="text-xs text-gray-400">Code: {data.code}</p>
        </div>

        {/* Demographics */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Population:</span>
            <span className="font-medium">{formatNumber(data.population_total)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Donor Pool:</span>
            <span className="font-medium">{formatNumber(data.donor_pool_stable)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Age 67+:</span>
            <span className="font-medium">{formatNumber(data.pop_67_plus)}</span>
          </div>
          {data.share_30_66 !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Share 30-66:</span>
              <span className="font-medium">{formatPercent(data.share_30_66)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Tooltip;

