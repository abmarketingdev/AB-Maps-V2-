// Deviations — live adapter for the personal-baseline deviation surface (Feature 2).
// GET /api/dashboard/deviations/ (manager/admin/sales-chief). This is the live view
// of the same data the 21:10 digest emails: per team, sellers in a ≥3-day dip below
// their OWN rolling average, plus sellers below the company standard today.

import { getJSON } from '@/lib/auth/fetchWithAuth';
import type { BaselineSource } from './pace';

export interface StreakDay {
  day: string;   // YYYY-MM-DD
  doors: number;
}

// A seller flagged for a personal-baseline deviation streak.
export interface FlaggedSeller {
  person_id: string;
  name: string;
  today_doors: number;
  personal_average: number | null;
  company_standard: number;
  baseline: number;
  baseline_source: BaselineSource | string;
  streak_len: number;
  streak_days: StreakDay[];
  shortfall_pct: number;
}

// A seller below the company standard today (no personal-baseline streak).
export interface BelowStandardSeller {
  person_id: string;
  name: string;
  today_doors: number;
  personal_average: number | null;
  company_standard: number;
  baseline: number;
  baseline_source: BaselineSource | string;
}

export interface DeviationTeam {
  team_id: string;
  team_name: string;
  flagged: FlaggedSeller[];
  below_standard: BelowStandardSeller[];
  sellers: BelowStandardSeller[];   // all members (same line shape)
  has_concerns: boolean;
}

export interface DeviationsResponse {
  date: string;
  teams: DeviationTeam[];
}

export interface DeviationsParams {
  date?: string;
  teamId?: string;
  campaignId?: string;
  all?: boolean;   // include teams with no concerns
}

function qp(p: DeviationsParams): string {
  const qs = new URLSearchParams();
  if (p.date) qs.set('date', p.date);
  if (p.teamId) qs.set('team_id', p.teamId);
  if (p.campaignId) qs.set('campaign_id', p.campaignId);
  if (p.all) qs.set('all', '1');
  return qs.toString();
}

/** Flagged sellers + streak details per team (the digest data, live). */
export function fetchDeviations(p: DeviationsParams = {}): Promise<DeviationsResponse> {
  return getJSON<DeviationsResponse>(`/api/dashboard/deviations/?${qp(p)}`);
}
