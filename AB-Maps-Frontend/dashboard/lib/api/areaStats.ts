// Per-area door-knock stats for the merged Områder area-detail view.
// Served entirely by maps-service (it owns address + area + area_employee), one
// indexed query, Redis-cached. "Sales" here = status='ja' knocks (the geographic
// sale); HR commission revenue is NOT area-scoped and is intentionally not shown.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export interface StatusBucket {
  total: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number; ja_rate: number;
}
export interface PostalStat extends StatusBucket { postal_code: string }
export interface PersonStat extends StatusBucket {
  person_id: string; kind: 'employee' | 'manager'; name: string;
}
export interface AreaStats {
  area_id: string;
  name: string;
  campaign: { id: string; name: string } | null;
  doors: number;
  knocked: StatusBucket;
  postals: PostalStat[];
  assignees: PersonStat[];
  unassigned_contributors: PersonStat[];
}

/** GET /api/areas/areas/{id}/stats/ — knocks inside the polygon, scoped to `campaign`,
 *  optional YYYY-MM-DD window. */
export function getAreaStats(
  areaId: string,
  opts: { campaign?: string; start?: string; end?: string } = {},
): Promise<AreaStats> {
  const qs = new URLSearchParams();
  if (opts.campaign) qs.set('campaign', opts.campaign);
  if (opts.start) qs.set('start', opts.start);
  if (opts.end) qs.set('end', opts.end);
  const q = qs.toString();
  return getJSON<AreaStats>(`/api/areas/areas/${areaId}/stats/${q ? `?${q}` : ''}`);
}
