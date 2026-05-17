// lib/demographics/metrics.ts
// Metric definitions for choropleth styling

import type { MetricDefinition } from './types';

/**
 * Available metrics for choropleth visualization
 * Each metric defines:
 * - id: unique identifier
 * - label: display name
 * - property: MVT feature property name
 * - thresholds: bucket boundaries for step expression
 * - colors: color for each bucket (one more than thresholds)
 * - format: function to format values for display
 */
export const METRICS: MetricDefinition[] = [
  {
    id: 'population_total',
    label: 'Total Population',
    property: 'population_total',
    thresholds: [50, 200, 500, 1000, 2000],
    colors: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494'],
    format: (v) => v.toLocaleString(),
  },
  {
    id: 'donor_pool_stable',
    label: 'Donor Pool (Stable)',
    property: 'donor_pool_stable',
    thresholds: [30, 100, 250, 500, 1000],
    colors: ['#feebe2', '#fcc5c0', '#fa9fb5', '#f768a1', '#c51b8a', '#7a0177'],
    format: (v) => v.toLocaleString(),
  },
  {
    id: 'pop_67_plus',
    label: 'Population 67+',
    property: 'pop_67_plus',
    thresholds: [10, 30, 60, 120, 250],
    colors: ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c', '#00441b'],
    format: (v) => v.toLocaleString(),
  },
  {
    id: 'share_30_66',
    label: 'Share 30-66 (%)',
    property: 'share_30_66',
    thresholds: [0.3, 0.4, 0.5, 0.6],
    colors: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#084594'],
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  {
    id: 'mean_age_est_total',
    label: 'Mean Age',
    property: 'mean_age_est_total',
    thresholds: [35, 40, 45, 50, 55],
    colors: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404', '#662506'],
    format: (v) => v.toFixed(1),
  },
];

/**
 * Default metric to show on initial load
 */
export const DEFAULT_METRIC = METRICS[0];

/**
 * Get metric definition by ID
 */
export function getMetricById(id: string): MetricDefinition | undefined {
  return METRICS.find((m) => m.id === id);
}

/**
 * Generate MapLibre step expression for choropleth coloring
 * 
 * Creates expression like:
 * ["step", ["coalesce", ["get", "property"], 0], color1, threshold1, color2, ...]
 * 
 * @param metric - The metric definition to generate expression for
 * @returns MapLibre expression array
 */
export function getChoroplethExpression(metric: MetricDefinition): unknown[] {
  const expression: unknown[] = [
    'step',
    ['coalesce', ['get', metric.property], 0],
  ];

  // Add base color (for values below first threshold)
  expression.push(metric.colors[0]);

  // Add threshold-color pairs
  metric.thresholds.forEach((threshold, index) => {
    expression.push(threshold);
    expression.push(metric.colors[index + 1]);
  });

  return expression;
}

/**
 * Get legend items for a metric
 * Returns array of { label, color } for rendering legend
 */
export function getLegendItems(metric: MetricDefinition): Array<{ label: string; color: string }> {
  const items: Array<{ label: string; color: string }> = [];

  // First bucket: 0 to first threshold
  items.push({
    label: `< ${metric.format(metric.thresholds[0])}`,
    color: metric.colors[0],
  });

  // Middle buckets
  for (let i = 0; i < metric.thresholds.length - 1; i++) {
    items.push({
      label: `${metric.format(metric.thresholds[i])} - ${metric.format(metric.thresholds[i + 1])}`,
      color: metric.colors[i + 1],
    });
  }

  // Last bucket: above last threshold
  items.push({
    label: `> ${metric.format(metric.thresholds[metric.thresholds.length - 1])}`,
    color: metric.colors[metric.colors.length - 1],
  });

  return items;
}

