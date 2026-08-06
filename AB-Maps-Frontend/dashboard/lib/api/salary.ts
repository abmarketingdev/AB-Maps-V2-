// Salary summary adapters — feed the LØNN section of the redesigned dashboards.
// Backend: hr-service commission/views.py SalarySummaryView + MySalaryView.
// Feature-flagged behind SALARY_ENDPOINT_ENABLED on the backend — when off,
// endpoints return 503 and these adapters throw; consumers should catch and
// hide the section gracefully.
//
// Shipped: Phase 2+5, 2026-08-05.

import { getJSON } from '@/lib/auth/fetchWithAuth';

// ─── Shapes (mirror what commission/salary_service.py returns) ─────────────────

export interface SalaryAktive {
  current: number;
  goal: number | null;   // null until Goals endpoint ships (Phase D)
}

export interface SalaryPerTeamRow {
  team_id: string;
  team_name: string;
  chief_contribution: string;  // decimal as string
  sum_vervinger: string;
}

/** Salgsleder-view response. Scope tells the frontend how to label things. */
export interface SalarySummary {
  period: string | null;
  scope: 'global' | 'chief_or_lead' | 'self';
  campaign_scoped: boolean;    // true when campaign_id filter was applied
  aktive_givere: SalaryAktive;
  sum_vervinger: string;
  leder_provisjon: string;
  estimert_lonn: string;
  estimert_lonn_ved_mal: string | null;
  per_team_breakdown: SalaryPerTeamRow[];
}

/** Employee-view response. Never includes leder_provisjon / breakdown. */
export interface MySalary {
  period: string | null;
  scope: 'self';
  campaign_scoped: boolean;
  aktive_givere: SalaryAktive;
  sum_vervinger: string;
  estimert_lonn: string;
  // The service returns leder_provisjon/estimert_lonn_ved_mal/per_team fields
  // too for shape consistency — always 0 / null / [] for /me/. Types kept
  // narrow here so consumers of MySalary don't accidentally render them.
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

function qs(opts: { period?: string; campaignId?: string }): string {
  const parts: string[] = [];
  if (opts.period) parts.push(`period=${encodeURIComponent(opts.period)}`);
  if (opts.campaignId) parts.push(`campaign_id=${encodeURIComponent(opts.campaignId)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Salgsleder LØNN row. Auth: manager/chief/admin/hr — 403 for plain employees. */
export function fetchSalarySummary(opts: { period?: string; campaignId?: string } = {}): Promise<SalarySummary> {
  return getJSON<SalarySummary>(`/api/hr/salary/summary/${qs(opts)}`);
}

/** Promoter LØNN row. Auth: any authenticated user; always self-scoped. */
export function fetchMySalary(opts: { period?: string; campaignId?: string } = {}): Promise<MySalary> {
  return getJSON<MySalary>(`/api/hr/salary/me/${qs(opts)}`);
}

// ─── MÅL MÅNED aggregate (2026-08-06) ────────────────────────────────────────
// Backend: hr-service GoalsSummaryView. Sums Phase D team_goals + actual
// recruits across all teams the caller can see. Actual doors are fetched
// separately from analytics-service (fetchEmployeeDoors) — hr-service
// intentionally does not do cross-service HTTP calls.

export interface GoalsPerTeamRow {
  team_id: string;
  team_name: string;
  doors_goal: number;
  recruited_goal: number;
  recruited_actual: number;
}

export interface GoalsSummary {
  period: string | null;
  team_count: number;
  monthly: {
    recruited_goal: number;
    recruited_actual: number;
    doors_goal: number;
  };
  per_team: GoalsPerTeamRow[];
}

export function fetchGoalsSummary(opts: { period?: string } = {}): Promise<GoalsSummary> {
  const q = opts.period ? `?period=${encodeURIComponent(opts.period)}` : '';
  return getJSON<GoalsSummary>(`/api/hr/salary/goals-summary/${q}`);
}

/** Current period as YYYY-MM string (Oslo month) — helper for callers. */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
