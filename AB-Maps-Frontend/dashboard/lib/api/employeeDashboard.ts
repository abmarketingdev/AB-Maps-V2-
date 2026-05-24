// Employee Dashboard — live backend adapters (Module 2, guide §7.2/§7.3).
// All endpoints are self-scoped to the authenticated employee (token identity);
// any client-supplied employee_id is ignored.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import { mapThreshold } from '@/lib/api/thresholds';
import type {
  EmployeeDayData, Outcome, JourneyEvent, FollowUp,
  EmployeeStats, CampaignPerf,
} from '@/components/dashboard/v2/employee/employeeLogic';
import type { Threshold } from '@/services/analyticsService';

// ─── §7.2 Gamified dashboard ───────────────────────────────────────────────
interface EmployeeDayResponse {
  first_name: string;
  weekday: string;
  date_str: string;
  time_of_day: 'morgen' | 'dag' | 'kveld';
  within_shift: boolean;
  doors_today: number;
  door_goal: number;
  ja_today: number; nei_today: number; ikke_hjemme_today: number; folg_opp_today: number;
  sales_today: number;
  ja_prosent: number;
  ja_prosent_delta: number;
  streak_days: number;
  streak_at_risk: boolean;
  streak_min_doors: number;
  personal_best_doors: number;
  is_new_best: boolean;
  avg_doors_7: number;
  week_activity: number[];
  week_labels: string[];
  journey: { time: string; outcome: Outcome }[];
  follow_ups: { name: string; address: string; note: string; time: string }[];
}

function mapToday(r: EmployeeDayResponse): EmployeeDayData {
  return {
    firstName: r.first_name,
    weekday: r.weekday,
    dateStr: r.date_str,
    timeOfDay: r.time_of_day,
    withinShift: r.within_shift,
    doorsToday: r.doors_today,
    doorGoal: r.door_goal,
    jaToday: r.ja_today,
    neiToday: r.nei_today,
    ikkeHjemmeToday: r.ikke_hjemme_today,
    folgOppToday: r.folg_opp_today,
    salesToday: r.sales_today,
    jaProsent: r.ja_prosent,
    jaProsentDelta: r.ja_prosent_delta,
    streakDays: r.streak_days,
    streakAtRisk: r.streak_at_risk,
    streakMinDoors: r.streak_min_doors,
    personalBestDoors: r.personal_best_doors,
    isNewBest: r.is_new_best,
    avgDoors7: r.avg_doors_7,
    weekActivity: r.week_activity,
    weekLabels: r.week_labels,
    todayGoal: r.door_goal,
    // Yesterday fields aren't part of /me/today/ (they belong to the briefing);
    // the dashboard view doesn't read them. Default them safely.
    yesterdayDoors: 0,
    yesterdayGoal: r.door_goal,
    yesterdayAchieved: false,
    journey: (r.journey ?? []) as JourneyEvent[],
    followUps: (r.follow_ups ?? []) as FollowUp[],
  };
}

export async function fetchEmployeeToday(
  opts: { campaignId?: string; date?: string } = {},
): Promise<EmployeeDayData> {
  const qs = new URLSearchParams();
  if (opts.campaignId) qs.set('campaign_id', opts.campaignId);
  if (opts.date) qs.set('date', opts.date);
  const q = qs.toString();
  const raw = await getJSON<EmployeeDayResponse>(`/api/employee/me/today/${q ? `?${q}` : ''}`);
  return mapToday(raw);
}

// ─── §7.2 Register a door-knock ─────────────────────────────────────────────
export type RegistrationStatus = 'ja' | 'nei' | 'ikke_hjemme' | 'folg_opp';
export type NeiSubcategory =
  | 'ikke_interessert' | 'darlig_erfaring' | 'bindingstid'
  | 'bedrift' | 'pris' | 'eksisterende_kunde';

export interface RegistrationPayload {
  status: RegistrationStatus;
  address?: string;
  campaign_id?: string;
  position?: { lat: number; lng: number };
  nei_subcategory?: NeiSubcategory;
  notes?: string;
}

/** POST a door-knock registration. Identity comes from the token. */
export async function postRegistration(payload: RegistrationPayload): Promise<void> {
  const res = await fetchWithAuth('/api/employee/me/registrations/', {
    method: 'POST',
    headers: { 'Idempotency-Key': (crypto?.randomUUID?.() ?? String(Date.now())) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`Registration failed (${res.status}): ${detail}`);
  }
}

// ─── §7.3 Employee stats ────────────────────────────────────────────────────
interface CampaignPerfResponse {
  id: string; name: string; color: string;
  threshold: Threshold;
  threshold_scope: 'global' | 'kampanje';
  doors: number; days_worked: number; dorer_per_dag: number; week_doors: number;
  ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  ja_prosent: number; nei_prosent: number; contact_pct: number;
  consistency: number;
  total_min: number; avg_daily_min: number;
  daily: { date: string; doors: number; ja: number }[];
}

interface EmployeeStatsResponse {
  first_name: string;
  period_label: string;
  total_doors: number; dorer_per_dag: number; ja_prosent: number; contact_pct: number;
  ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  consistency: number;
  total_min: number; avg_daily_min: number; active_days: number;
  applied_threshold: Threshold;
  campaigns: CampaignPerfResponse[];
  week_activity: { label: string; doors: number; ja: number }[];
}

function mapCampaignPerf(c: CampaignPerfResponse): CampaignPerf {
  return {
    id: c.id, name: c.name, color: c.color,
    threshold: mapThreshold(c.threshold),
    thresholdScope: c.threshold_scope,
    doors: c.doors,
    daysWorked: c.days_worked,
    dorerPerDag: c.dorer_per_dag,
    weekDoors: c.week_doors,
    ja: c.ja, nei: c.nei, ikkeHjemme: c.ikke_hjemme, folgOpp: c.folg_opp,
    jaProsent: c.ja_prosent, neiProsent: c.nei_prosent, contactPct: c.contact_pct,
    consistency: c.consistency,
    totalMin: c.total_min, avgDailyMin: c.avg_daily_min, // always 0 per-campaign (guide §3 limitation)
    daily: c.daily ?? [],
  };
}

function mapStats(r: EmployeeStatsResponse): EmployeeStats {
  return {
    firstName: r.first_name,
    periodLabel: r.period_label,
    totalDoors: r.total_doors,
    dorerPerDag: r.dorer_per_dag,
    jaProsent: r.ja_prosent,
    contactPct: r.contact_pct,
    ja: r.ja, nei: r.nei, ikkeHjemme: r.ikke_hjemme, folgOpp: r.folg_opp,
    consistency: r.consistency,
    totalMin: r.total_min,
    avgDailyMin: r.avg_daily_min,
    activeDays: r.active_days,
    appliedThreshold: mapThreshold(r.applied_threshold),
    campaigns: (r.campaigns ?? []).map(mapCampaignPerf),
    weekActivity: r.week_activity ?? [],
  };
}

export async function fetchEmployeeStats(
  opts: { startDate?: string; endDate?: string } = {},
): Promise<EmployeeStats> {
  const qs = new URLSearchParams();
  if (opts.startDate) qs.set('start_date', opts.startDate);
  if (opts.endDate) qs.set('end_date', opts.endDate);
  const q = qs.toString();
  const raw = await getJSON<EmployeeStatsResponse>(`/api/employee/me/stats/${q ? `?${q}` : ''}`);
  return mapStats(raw);
}
