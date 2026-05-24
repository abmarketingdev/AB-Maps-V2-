// Geographic door-knock breakdown — live adapter (Module 8 redesign).
// GET /api/dashboard/v2/sales/geo/ — team-scoped, manager/admin only.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export interface GeoPostal {
  postal_code: string;
  total: number;
  ja: number;
  nei: number;
  ikke_hjemme: number;
  ja_rate: number;
  employee_count: number;
}
export interface GeoCity {
  city: string;
  total: number;
  ja: number;
  nei: number;
  ikke_hjemme: number;
  ja_rate: number;
  postals: GeoPostal[];
}
export interface SalesGeoTotals {
  total: number;
  ja: number;
  nei: number;
  ikke_hjemme: number;
  ja_rate: number;
}
export interface SalesGeo {
  cities: GeoCity[];
  totals: SalesGeoTotals;
}

export function fetchSalesGeo(opts: { campaignId?: string; startDate?: string; endDate?: string } = {}): Promise<SalesGeo> {
  const qs = new URLSearchParams();
  if (opts.campaignId) qs.set('campaign_id', opts.campaignId);
  if (opts.startDate) qs.set('start_date', opts.startDate);
  if (opts.endDate) qs.set('end_date', opts.endDate);
  const q = qs.toString();
  return getJSON<SalesGeo>(`/api/dashboard/v2/sales/geo/${q ? `?${q}` : ''}`);
}
