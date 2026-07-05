// Pace — live adapter for the seller-pace endpoints (Feature 2).
// Team pace: GET /api/dashboard/v2/pace/ (manager/admin/sales-chief).
// Reads seller_day_metric: doors + first/last knock → active window + doors/hour,
// plus the personal-baseline deviation status. Requires campaign_id OR team_id.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export type BaselineSource = 'personal' | 'company_standard';
export type PersonKind = 'employee' | 'manager';

export interface PaceRow {
  employee_id: string;
  person_kind: PersonKind | string;
  name: string;
  doors_knocked: number;
  first_knock_at: string | null;
  last_knock_at: string | null;
  active_window_minutes: number;
  pace_doors_per_hour: number | null; // null when the active window is 0
  personal_average: number | null;
  baseline_source: BaselineSource | string;
  is_alert: boolean;
  streak_len: number;
  below_company_standard_today: boolean;
}

export interface TeamPacePage {
  results: PaceRow[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  // The day the backend actually returned pace for — auto-falls back to the latest
  // day with data when the requested date is empty (per-day data is sparse).
  effective_date: string;
}

// One person's per-day pace over a range (sparse — only days they knocked).
export interface PaceDay {
  day: string;
  doors_knocked: number;
  first_knock_at: string | null;
  last_knock_at: string | null;
  active_window_minutes: number;
  pace_doors_per_hour: number | null;
}
export interface PaceSeries {
  person_id: string;
  person_kind: PersonKind | string;
  start_date: string;
  end_date: string;
  series: PaceDay[];
}

export interface TeamPaceParams {
  campaignId?: string;
  teamId?: string;
  date?: string;      // YYYY-MM-DD (Oslo); default = today
  page?: number;
  pageSize?: number;
}

function qp(p: TeamPaceParams): string {
  const qs = new URLSearchParams();
  if (p.campaignId) qs.set('campaign_id', p.campaignId);
  if (p.teamId) qs.set('team_id', p.teamId);
  if (p.date) qs.set('date', p.date);
  if (p.page) qs.set('page', String(p.page));
  if (p.pageSize) qs.set('page_size', String(p.pageSize));
  return qs.toString();
}

/** Per-person pace table (employees + managers) for a campaign/team, worst-first. */
export function fetchTeamPace(p: TeamPaceParams): Promise<TeamPacePage> {
  return getJSON<TeamPacePage>(`/api/dashboard/v2/pace/?${qp(p)}`);
}

export interface PaceSeriesParams {
  personId: string;
  personKind?: PersonKind | string;
  startDate?: string;
  endDate?: string;
}

/** One person's per-day pace series (first/last knock, active window, doors/hour). */
export function fetchEmployeePaceSeries(p: PaceSeriesParams): Promise<PaceSeries> {
  const qs = new URLSearchParams();
  qs.set('person_id', p.personId);
  if (p.personKind) qs.set('person_kind', p.personKind);
  if (p.startDate) qs.set('start_date', p.startDate);
  if (p.endDate) qs.set('end_date', p.endDate);
  return getJSON<PaceSeries>(`/api/dashboard/employee-pace-series/?${qs.toString()}`);
}
