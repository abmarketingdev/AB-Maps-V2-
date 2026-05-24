// Manager/Admin briefing — live backend adapter (Module 1, guide §3).
// GET /api/dashboard/briefing/?date=YYYY-MM-DD → maps snake_case BriefingResponse
// onto the camelCase BriefingData the view/logic already consume.

import { getJSON } from '@/lib/auth/fetchWithAuth';
import type { BriefingData, BriefEmp, BriefCampaign } from '@/components/dashboard/v2/briefingLogic';

// ─── Backend response shape (guide §3) ─────────────────────────────────────
interface BriefingResponse {
  manager_first_name: string;
  date: string;
  weekday: string;
  time_of_day: 'morgen' | 'dag' | 'kveld';
  totals: { total_doors: number; contact_pct: number; active_count: number; total_count: number };
  signals: {
    ja_rate_today: number;
    ja_rate_delta_7: number;
    ja_spark: number[];
    under_threshold_names: string[];
    under_threshold_delta: number;
    top_concentration_pct: number;
    top_names: string[];
    concentration_delta: number;
    sales_today: number;
    sales_avg: number;
    sales_std: number;
    sales_yesterday_delta_pct: number;
    mood_green_pct: number;
    mood_red_pct: number;
    all_campaigns_on_track: boolean;
    within_shift: boolean;
    minutes_since_activity: number;
    last_sale_minutes_ago: number;
  };
  campaign_at_risk: { name: string; ja_rate: number; pct_complete: number; days_left: number } | null;
  employees: Array<{
    id: string; name: string; ja_prosent: number; dorer_per_dag: number;
    doors: number; consistency: number; hours_on_shift: number; under_threshold: boolean;
  }>;
  campaigns: Array<{ name: string; ja_rate: number; pct_complete: number; days_left: number }>;
}

const toCampaign = (c: BriefingResponse['campaigns'][number]): BriefCampaign => ({
  name: c.name,
  jaRate: c.ja_rate,
  pctComplete: c.pct_complete,
  daysLeft: c.days_left, // always 0 (no timeline) — view ignores it
});

const toEmployee = (e: BriefingResponse['employees'][number]): BriefEmp => ({
  id: e.id,
  name: e.name,
  jaProsent: e.ja_prosent,
  dorerPerDag: e.dorer_per_dag,
  doors: e.doors,
  consistency: e.consistency,
  hoursOnShift: e.hours_on_shift,
  underThreshold: e.under_threshold,
});

export function mapBriefing(r: BriefingResponse): BriefingData {
  const s = r.signals;
  return {
    firstName: r.manager_first_name,
    weekday: r.weekday,
    dateStr: r.date,
    timeOfDay: r.time_of_day,
    totalDoors: r.totals.total_doors,
    contactPct: r.totals.contact_pct,
    activeCount: r.totals.active_count,
    totalCount: r.totals.total_count,
    jaRateToday: s.ja_rate_today,
    jaRateDelta7: s.ja_rate_delta_7,
    jaSpark: s.ja_spark,
    underThresholdNames: s.under_threshold_names,
    underThresholdDelta: s.under_threshold_delta, // placeholder 0 — render without arrow
    topConcentrationPct: s.top_concentration_pct,
    topNames: s.top_names,
    concentrationDelta: s.concentration_delta, // placeholder 0
    salesToday: s.sales_today,
    salesAvg: s.sales_avg,
    salesStd: s.sales_std,
    salesYesterdayDeltaPct: s.sales_yesterday_delta_pct,
    campaignAtRisk: r.campaign_at_risk ? toCampaign(r.campaign_at_risk) : null,
    moodGreenPct: s.mood_green_pct,
    moodRedPct: s.mood_red_pct,
    allCampaignsOnTrack: s.all_campaigns_on_track,
    withinShift: s.within_shift,
    minutesSinceActivity: s.minutes_since_activity,
    lastSaleMinutesAgo: s.last_sale_minutes_ago,
    dataReady: true,
    employees: r.employees.map(toEmployee),
    campaigns: r.campaigns.map(toCampaign),
  };
}

/** Fetch + map the manager/admin briefing. `date` is optional (defaults to today). */
export async function fetchManagerBriefing(date?: string): Promise<BriefingData> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  const raw = await getJSON<BriefingResponse>(`/api/dashboard/briefing/${q}`);
  return mapBriefing(raw);
}
