"use client";

import { getLegendItems } from "@/lib/demographics/metrics";
import type { MetricDefinition } from "@/lib/demographics/types";

interface LegendProps {
  metric: MetricDefinition;
}

/**
 * Legend Component
 * 
 * Phase 3: Display dynamic legend for choropleth map
 * - Shows metric label
 * - Shows color blocks with bucket ranges
 * - Updates when metric changes
 * - Positioned bottom-left over map
 */
export function Legend({ metric }: LegendProps) {
  const legendItems = getLegendItems(metric);

  return (
    <div className="absolute bottom-16 left-4 z-10">
      <div className="bg-ab-elevated backdrop-blur-sm rounded-lg shadow-lg p-3 min-w-[160px]">
        {/* Metric label */}
        <h4 className="text-xs font-semibold text-ab-fg mb-2 uppercase tracking-wide">
          {metric.label}
        </h4>
        
        {/* Color scale */}
        <div className="space-y-1">
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-5 h-4 rounded-sm border border-ab-line flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-ab-fg-2 whitespace-nowrap">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Legend;

