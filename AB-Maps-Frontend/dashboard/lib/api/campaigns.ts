// Campaigns with stats — live adapter (Module 6, §5.8). Read + status.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export type CampaignStatus = 'active' | 'paused' | 'ended';

export interface CampaignStats {
  pct_complete: number;
  days_left: number | null;
  available_doors: number;
  knocked?: number;
  total_ja?: number;
  sales_week: number;
  sales_lifetime: number;
  employee_ids: string[];
  areas: number;
  color: string | null;
}

export interface CampaignWithStats {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  brand_color_hex?: string | null;
  created_at?: string;
  stats?: CampaignStats;
}

// View-friendly shape (mirrors KampanjeView's Campaign + CampaignMetrics).
export interface CampaignVM {
  id: string;
  name: string;
  description: string;
  color: string;
  status: CampaignStatus;
  areas: number;
  employeeIds: string[];
  salesWeek: number;
  salesLifetime: number;
  pctComplete: number;
  availableDoors: number;
  knocked: number;
  totalJa: number;
  created: Date;
}

export function mapCampaign(c: CampaignWithStats): CampaignVM {
  const s = c.stats;
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? '',
    color: s?.color || c.brand_color_hex || '#3b82f6',
    status: c.status ?? 'active',
    areas: s?.areas ?? 0,
    employeeIds: s?.employee_ids ?? [],
    salesWeek: s?.sales_week ?? 0,
    salesLifetime: s?.sales_lifetime ?? 0,
    pctComplete: s?.pct_complete ?? 0,
    availableDoors: s?.available_doors ?? 0,
    knocked: s?.knocked ?? 0,
    totalJa: s?.total_ja ?? s?.sales_lifetime ?? 0,
    created: c.created_at ? new Date(c.created_at) : new Date(),
  };
}

export async function fetchCampaignsWithStats(status?: CampaignStatus): Promise<CampaignVM[]> {
  const qs = new URLSearchParams({ expand: 'stats' });
  if (status) qs.set('status', status);
  const raw = await getJSON<CampaignWithStats[] | { results: CampaignWithStats[] }>(
    `/api/campaigns/campaigns/?${qs.toString()}`,
  );
  const list = Array.isArray(raw) ? raw : (raw?.results ?? []);
  return list.map(mapCampaign);
}

export async function updateCampaignStatus(id: string, status: CampaignStatus): Promise<Response> {
  return fetchWithAuth(`/api/campaigns/campaigns/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
