// Manager/Admin main dashboard — live adapters (Module 3, guide §5.2).
// All endpoints live under /api/dashboard/v2/ and are manager/admin + team-scoped.
// Optional campaign_id scopes any widget to one campaign.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export type DashRange = '7d' | '30d' | '90d';
export type LeaderMetric = 'ja_rate' | 'doors' | 'consistency';
export type ActivityTone = 'info' | 'success' | 'warn' | 'danger' | 'neutral';

// ─── Widget data shapes (consumed directly by the widgets) ──────────────────
export interface KpiStats {
  online: { value: number; total: number };
  totalDoors: { value: number; deltaPct?: number };
  yesRate: { value: number; deltaPct?: number };
  activeCampaigns: { value: number };
  salesToday: { value: number; deltaPct?: number };
}
export interface TrendPoint { date: string; doors: number; yesRate: number }
export interface MoodCount { mood: string; count: number }
export interface CampaignHealthItem {
  id: string; name: string; target: number; current: number;
  employees: number; color: string; daysLeft: number;
}
export interface LeaderItem {
  rank: number; name: string; region: string;
  dorerPerDag: number; jaProsent: number;
  minJaProsent: number; minDorerPerDag: number;
  rankPercentile: number; daysOnPlatform: number; score: number; online: boolean;
}
export interface ActivityItem {
  id: string; time: string; agent: string; action: string;
  location: string; campaign?: string; tone: ActivityTone;
}
export interface DashboardOverview {
  kpis: KpiStats;
  trends: TrendPoint[];
  mood: MoodCount[];
  campaigns: CampaignHealthItem[];
  leaderboard: LeaderItem[];
  activities: ActivityItem[];
}

// ─── Raw backend shapes ─────────────────────────────────────────────────────
interface RawStats {
  online_employees: { value: number; total: number };
  total_doors: { value: number; delta_pct?: number };
  yes_rate: { value: number; delta_pct?: number };
  active_campaigns: { value: number };
  sales_today: { value: number; delta_pct?: number };
}
interface RawTrends { points: { date: string; doors: number; yes_rate: number }[] }
interface RawMood { segments: { mood: string; count: number }[] }
interface RawCampaignHealth {
  campaigns: { id: string; name: string; target: number; current: number; employees: number; color: string | null; days_left: number }[];
}
interface RawLeaderboard {
  entries: {
    rank: number; name: string; region: string;
    dorer_per_dag: number; ja_prosent: number;
    min_ja_prosent: number; min_dorer_per_dag: number;
    rank_percentile: number; days_on_platform: number; score: number; online: boolean;
  }[];
}
type RawActivity = { id: string; time: string; agent: string; action: string; location: string; campaign?: string; tone: ActivityTone };
interface RawOverview {
  stats: RawStats;
  trends: RawTrends;
  mood: RawMood;
  campaign_health: RawCampaignHealth;
  leaderboard: RawLeaderboard;
  recent_activities: RawActivity[];
}

// ─── Mappers ────────────────────────────────────────────────────────────────
const mapStats = (s: RawStats): KpiStats => ({
  online: { value: s.online_employees.value, total: s.online_employees.total },
  totalDoors: { value: s.total_doors.value, deltaPct: s.total_doors.delta_pct },
  yesRate: { value: s.yes_rate.value, deltaPct: s.yes_rate.delta_pct },
  activeCampaigns: { value: s.active_campaigns.value },
  salesToday: { value: s.sales_today.value, deltaPct: s.sales_today.delta_pct },
});

const mapTrends = (t: RawTrends): TrendPoint[] =>
  (t.points ?? []).map((p) => ({
    date: new Date(p.date).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' }),
    doors: p.doors,
    yesRate: p.yes_rate,
  }));

const mapMood = (m: RawMood): MoodCount[] => (m.segments ?? []).map((s) => ({ mood: s.mood, count: s.count }));

const mapCampaigns = (c: RawCampaignHealth): CampaignHealthItem[] =>
  (c.campaigns ?? []).map((x) => ({
    id: x.id, name: x.name, target: x.target, current: x.current,
    employees: x.employees, color: x.color || '#3b82f6', daysLeft: x.days_left,
  }));

const mapLeaderboard = (l: RawLeaderboard): LeaderItem[] =>
  (l.entries ?? []).map((e) => ({
    rank: e.rank, name: e.name, region: e.region,
    dorerPerDag: e.dorer_per_dag, jaProsent: e.ja_prosent,
    minJaProsent: e.min_ja_prosent, minDorerPerDag: e.min_dorer_per_dag,
    rankPercentile: e.rank_percentile, daysOnPlatform: e.days_on_platform,
    score: e.score, online: e.online,
  }));

const mapActivities = (rows: RawActivity[]): ActivityItem[] =>
  (rows ?? []).map((r) => ({
    id: r.id, time: r.time, agent: r.agent, action: r.action,
    location: r.location, campaign: r.campaign, tone: r.tone,
  }));

const qp = (params: Record<string, string | undefined>): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

// ─── Public fetchers ────────────────────────────────────────────────────────
/** One composite call on first paint (guide §0) — bundles all six widgets. */
export async function fetchOverview(range: DashRange, campaignId?: string): Promise<DashboardOverview> {
  const raw = await getJSON<RawOverview>(`/api/dashboard/v2/overview/${qp({ range, campaign_id: campaignId })}`);
  return {
    kpis: mapStats(raw.stats),
    trends: mapTrends(raw.trends),
    mood: mapMood(raw.mood),
    campaigns: mapCampaigns(raw.campaign_health),
    leaderboard: mapLeaderboard(raw.leaderboard),
    activities: mapActivities(raw.recent_activities),
  };
}

export async function fetchTrends(range: DashRange, campaignId?: string): Promise<TrendPoint[]> {
  return mapTrends(await getJSON<RawTrends>(`/api/dashboard/v2/trends/${qp({ range, campaign_id: campaignId })}`));
}

export async function fetchLeaderboard(metric: LeaderMetric, limit = 5, campaignId?: string): Promise<LeaderItem[]> {
  return mapLeaderboard(await getJSON<RawLeaderboard>(
    `/api/dashboard/v2/leaderboard/${qp({ metric, limit: String(limit), campaign_id: campaignId })}`,
  ));
}

export async function fetchActivities(limit = 50, campaignId?: string): Promise<ActivityItem[]> {
  return mapActivities(await getJSON<RawActivity[]>(
    `/api/dashboard/v2/activities/${qp({ limit: String(limit), campaign_id: campaignId })}`,
  ));
}
