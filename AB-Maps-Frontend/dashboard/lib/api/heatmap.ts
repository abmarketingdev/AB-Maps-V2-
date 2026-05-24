// Demographics heatmap — live adapter (Module 6, §6.3). Team-scoped, read-only.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export type HeatmapMetric = 'ja_rate' | 'doors';
export interface HeatmapCell { area_id: string; value: number }

export function fetchHeatmap(metric: HeatmapMetric, campaignId?: string): Promise<HeatmapCell[]> {
  const qs = new URLSearchParams({ metric });
  if (campaignId) qs.set('campaign_id', campaignId);
  return getJSON<HeatmapCell[]>(`/api/dashboard/heatmap/?${qs.toString()}`);
}
