"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METRICS } from "@/lib/demographics/metrics";
import type { MetricDefinition } from "@/lib/demographics/types";

interface MetricSelectorProps {
  selectedMetric: MetricDefinition;
  onMetricChange: (metric: MetricDefinition) => void;
}

/**
 * MetricSelector Component
 * 
 * Dropdown to select which demographic metric to visualize
 * in the choropleth map. Positioned top-right over the map.
 */
export function MetricSelector({ selectedMetric, onMetricChange }: MetricSelectorProps) {
  const handleValueChange = (metricId: string) => {
    const metric = METRICS.find((m) => m.id === metricId);
    if (metric) {
      onMetricChange(metric);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10">
      <div className="bg-white rounded-lg shadow-lg p-3 min-w-[200px]">
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          Color by
        </label>
        <Select value={selectedMetric.id} onValueChange={handleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent>
            {METRICS.map((metric) => (
              <SelectItem key={metric.id} value={metric.id}>
                {metric.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default MetricSelector;

