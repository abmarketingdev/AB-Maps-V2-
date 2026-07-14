// Employee Dashboard — live backend adapters (Module 2, guide §7.2/§7.3).
// All endpoints are self-scoped to the authenticated employee (token identity);
// any client-supplied employee_id is ignored.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import { mapThreshold } from '@/lib/api/thresholds';
import {
  emptyEmployeeDay,
  type EmployeeDayData, type Outcome, type JourneyEvent, type FollowUp,
  type EmployeeStats, type CampaignPerf,
} from '@/components/dashboard/v2/employee/employeeLogic';
import type { Threshold } from '@/services/analyticsService';

// The backend emits knock outcomes with underscores (ja / nei / ikke_hjemme / folg_opp);
// the UI's OUTCOME_META is keyed with hyphens (ikke-hjemme / folg-opp). Without this
// normalisation, OUTCOME_META[outcome] is undefined and `.color` throws — white-screening the
// employee dashboard the moment a "ikke hjemme"/"følg opp" knock exists in today's journey.
const OUTCOME_NORMALISE: Record<string, Outcome> = {
  ja: 'ja', nei: 'nei',
  'ikke-hjemme': 'ikke-hjemme', ikke_hjemme: 'ikke-hjemme',
  'folg-opp': 'folg-opp', folg_opp: 'folg-opp',
};
function normaliseOutcome(v: unknown): Outcome | null {
  return (typeof v === 'string' && OUTCOME_NORMALISE[v]) || null;
}

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
  // Start from a fully-populated seed and override only fields the backend actually sends, so a
  // missing/partial payload degrades to safe zeros instead of throwing (e.g. `undefined.toFixed`).
  const base = emptyEmployeeDay(r?.first_name ?? '');
  const num = (v: unknown, d: number | null | undefined) =>
    (typeof v === 'number' && !Number.isNaN(v) ? v : (typeof d === 'number' ? d : 0));
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
  return {
    ...base,
    firstName: str(r?.first_name, base.firstName),
    weekday: str(r?.weekday, base.weekday),
    dateStr: str(r?.date_str, base.dateStr),
    timeOfDay: (r?.time_of_day ?? base.timeOfDay) as EmployeeDayData['timeOfDay'],
    withinShift: bool(r?.within_shift, base.withinShift),
    doorsToday: num(r?.doors_today, base.doorsToday),
    doorGoal: num(r?.door_goal, base.doorGoal),
    jaToday: num(r?.ja_today, base.jaToday),
    neiToday: num(r?.nei_today, base.neiToday),
    ikkeHjemmeToday: num(r?.ikke_hjemme_today, base.ikkeHjemmeToday),
    folgOppToday: num(r?.folg_opp_today, base.folgOppToday),
    salesToday: num(r?.sales_today, base.salesToday),
    jaProsent: num(r?.ja_prosent, base.jaProsent),
    jaProsentDelta: num(r?.ja_prosent_delta, base.jaProsentDelta),
    streakDays: num(r?.streak_days, base.streakDays),
    streakAtRisk: bool(r?.streak_at_risk, base.streakAtRisk),
    streakMinDoors: num(r?.streak_min_doors, base.streakMinDoors),
    personalBestDoors: num(r?.personal_best_doors, base.personalBestDoors),
    isNewBest: bool(r?.is_new_best, base.isNewBest),
    avgDoors7: num(r?.avg_doors_7, base.avgDoors7),
    weekActivity: Array.isArray(r?.week_activity) ? r.week_activity : base.weekActivity,
    weekLabels: Array.isArray(r?.week_labels) ? r.week_labels : base.weekLabels,
    todayGoal: num(r?.door_goal, base.todayGoal),
    yesterdayGoal: num(r?.door_goal, base.yesterdayGoal),
    journey: (Array.isArray(r?.journey) ? r.journey : [])
      .map((e: { time?: string; outcome?: unknown }) => {
        const outcome = normaliseOutcome(e?.outcome);
        return outcome ? { time: String(e?.time ?? ''), outcome } : null;
      })
      .filter((e): e is JourneyEvent => e !== null),
    followUps: (Array.isArray(r?.follow_ups) ? r.follow_ups : []) as FollowUp[],
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
