// Proximity — live adapter for GPS proximity violations (Feature 1).
// GET /api/dashboard/proximity-violations/ (manager/admin/sales-chief). Rejected or
// unverifiable door knocks where the knocker was too far from the door (>75m+accuracy)
// or their position could only be estimated from the last tracking ping.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export interface ProximityViolation {
  id: string;
  ts: string;                       // ISO8601
  employee_id: string | null;
  manager_id: string | null;
  campaign_id: string | null;
  door: { lat: number | null; lon: number | null };
  user: { lat: number | null; lon: number | null; estimated: boolean };
  distance_m: number | null;        // rounded to 1 dp
  address_text: string | null;
}

export interface ProximityViolationsResponse {
  results: ProximityViolation[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  total_violations: number;         // full filtered count (pre-cap)
  estimated_position_count: number;
}

export interface ProximityParams {
  campaignId?: string;
  employeeId?: string;
  startDate?: string;   // YYYY-MM-DD (filters on ts date)
  endDate?: string;
  page?: number;
  pageSize?: number;
}

function qp(p: ProximityParams): string {
  const qs = new URLSearchParams();
  if (p.campaignId) qs.set('campaign_id', p.campaignId);
  if (p.employeeId) qs.set('employee_id', p.employeeId);
  if (p.startDate) qs.set('start_date', p.startDate);
  if (p.endDate) qs.set('end_date', p.endDate);
  if (p.page) qs.set('page', String(p.page));
  if (p.pageSize) qs.set('page_size', String(p.pageSize));
  return qs.toString();
}

/** Paginated list + counts of rejected/estimated knock attempts. */
export function fetchProximityViolations(p: ProximityParams = {}): Promise<ProximityViolationsResponse> {
  return getJSON<ProximityViolationsResponse>(`/api/dashboard/proximity-violations/?${qp(p)}`);
}
