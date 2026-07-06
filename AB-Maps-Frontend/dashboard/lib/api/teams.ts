// Campaign Teams — live adapter for the HR microservice at /api/hr/teams/.
// HR is the single writer/owner of teams (CQRS): every write emits an event and
// the read replicas (QC etc.) follow. Access is role-scoped server-side:
//   - team-lead (manager) → only the team(s) they lead;
//   - sales-chief / admin  → all teams;
//   - plain employee       → 403 (no team access).
// Provisjon (rate) fields are stripped from responses for non-HR-staff, and
// create/edit/delete/rates/assign-chief are HR-staff/admin only (403 otherwise).
//
// HR returns a richer shape than the old monolith `/api/teams/`; this adapter
// maps it back onto the dashboard's existing DTOs so the UI is unchanged.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export type PersonType = 'employee' | 'manager';

export interface TeamRef { id: string; name: string }
export interface OwnerRef { id: string; name: string }

export interface TeamListItem {
  id: string; name: string; description: string;
  color: string; icon: string;
  campaign: TeamRef | null; owner: OwnerRef | null; sales_chief: OwnerRef | null;
  member_count: number; created_at: string; updated_at: string;
}

export interface TeamMember {
  id: string; name: string; email: string;
  person_type: PersonType; online: boolean;
  ab_person_id: string | null; added_at: string;
}

export interface TeamDetail extends TeamListItem {
  members: TeamMember[];
  can_edit: boolean;
}

export interface AssignableMember {
  id: string; name: string; email: string; person_type: PersonType; online: boolean;
}

export interface TeamAnalyticsMember {
  id: string; name: string; person_type: PersonType;
  doors: number; ja: number; ja_rate: number; work_minutes: number;
}
export interface TeamDailyPoint {
  date: string; total_doors: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number; yes_rate: number;
}
export interface TeamAlert {
  alert_type: string; severity: 'critical' | 'warning' | string;
  employee_id: string; employee_name: string; current_value: number; threshold_value: number;
  consecutive_days: number; message: string;
}
export interface TeamAnalytics {
  team_id: string; name: string; campaign: TeamRef | null; member_count: number;
  total_doors: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  ja_rate: number; nei_rate: number; ikke_hjemme_rate: number; contact_rate: number;
  doors_per_active_day: number; consistency_score: number;
  work: { total_seconds: number; total_minutes: number; avg_minutes_per_member: number; active_members: number };
  per_member: TeamAnalyticsMember[];
  daily?: TeamDailyPoint[];
  alerts?: TeamAlert[];
}

// Tier-1 quick stats (cheap list) — from /api/dashboard/teams/.
export interface TeamQuickStats {
  team_id: string; name: string; campaign: TeamRef | null; member_count: number;
  total_doors: number; ja: number; ja_rate: number; contact_rate: number;
}

export type LeaderboardMetric = 'ja_rate' | 'doors' | 'contact_rate' | 'work_time' | 'consistency';
export interface LeaderboardEntry {
  rank: number; team_id: string; name: string; color: string; icon: string;
  owner_name: string | null; member_count: number; metric: LeaderboardMetric; value: number;
}
export interface TeamLeaderboard {
  campaign_id: string; metric: LeaderboardMetric; entries: LeaderboardEntry[];
}

export interface Paginated<T> { results: T[]; total_count: number; page: number; page_size: number; total_pages: number }

const qp = (params: Record<string, string | number | undefined>): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

// Raised by member ops so the UI can show the right message.
export class TeamMemberError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; this.name = 'TeamMemberError'; }
}

// ─── HR → dashboard DTO mappers ────────────────────────────────────────────────
// HR TeamSerializer person label: { id, name, email, ab_person_id, user_id, resolved }.
interface HrPerson { id: string; name: string | null; email?: string | null; ab_person_id?: string | null }
interface HrMember { id: number | string; person_id: string | null; role: PersonType;
  person: HrPerson | null; added_at: string }
interface HrTeam {
  id: string; name: string; description: string | null; color: string | null; icon: string | null;
  campaign: { id: string; name: string | null } | null;
  leader: HrPerson | null;
  sales_chief: HrPerson | null;
  members?: HrMember[];
  created_at: string; updated_at: string;
}

const mapRef = (p: { id: string; name: string | null } | null): TeamRef | null =>
  p ? { id: p.id, name: p.name ?? '' } : null;

const mapMember = (m: HrMember): TeamMember => ({
  id: String(m.person_id ?? ''),
  name: m.person?.name ?? '',
  email: m.person?.email ?? '',
  person_type: m.role,
  online: false,               // presence isn't tracked by HR
  ab_person_id: m.person?.ab_person_id ?? null,
  added_at: m.added_at,
});

const mapListItem = (t: HrTeam): TeamListItem => ({
  id: t.id,
  name: t.name,
  description: t.description ?? '',
  color: t.color ?? '',
  icon: t.icon ?? '',
  campaign: mapRef(t.campaign),
  owner: mapRef(t.leader),                 // HR "leader" is the dashboard's "owner"
  sales_chief: mapRef(t.sales_chief ?? null),
  member_count: t.members?.length ?? 0,
  created_at: t.created_at,
  updated_at: t.updated_at,
});

const mapDetail = (t: HrTeam): TeamDetail => ({
  ...mapListItem(t),
  members: (t.members ?? []).map(mapMember),
  can_edit: true,              // real write access is enforced by HR (403 otherwise)
});

// ─── List / create ────────────────────────────────────────────────────────────
export async function listTeams(opts: {
  campaignId?: string; salesChiefId?: string; createdBy?: string; search?: string; page?: number; pageSize?: number;
} = {}): Promise<Paginated<TeamListItem>> {
  // The dashboard's "Mine team" toggle sets createdBy=<my id>; HR exposes this as
  // the `mine=true` filter (teams I personally lead), applied on top of scoping.
  // `salesChiefId` (admin only) narrows to one sales chief's teams.
  const raw = await getJSON<any>(
    `/api/hr/teams/${qp({ campaign_id: opts.campaignId, sales_chief_id: opts.salesChiefId, mine: opts.createdBy ? 'true' : undefined, search: opts.search, page: opts.page, page_size: opts.pageSize })}`,
  );
  const results: HrTeam[] = raw?.results ?? (Array.isArray(raw) ? raw : []);
  return {
    results: results.map(mapListItem),
    total_count: raw?.count ?? results.length,
    page: raw?.page ?? 1,
    page_size: raw?.page_size ?? results.length,
    total_pages: raw?.total_pages ?? 1,
  };
}

export async function createTeam(body: { name: string; campaign_id: string; description?: string; color?: string; icon?: string }): Promise<TeamDetail> {
  const res = await fetchWithAuth('/api/hr/teams/', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new TeamMemberError(res.status, errMsg(data, `Kunne ikke opprette team (${res.status})`));
  return mapDetail(data as HrTeam);
}

// ─── Detail / edit / delete ─────────────────────────────────────────────────
export async function getTeam(id: string): Promise<TeamDetail> {
  const raw = await getJSON<HrTeam>(`/api/hr/teams/${id}/`);
  return mapDetail(raw);
}

export async function updateTeam(id: string, body: { name?: string; description?: string; color?: string; icon?: string }): Promise<TeamDetail> {
  const res = await fetchWithAuth(`/api/hr/teams/${id}/`, { method: 'PATCH', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new TeamMemberError(res.status, errMsg(data, `Kunne ikke lagre (${res.status})`));
  return mapDetail(data as HrTeam);
}

export async function deleteTeam(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/hr/teams/${id}/`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new TeamMemberError(res.status, `Kunne ikke slette (${res.status})`);
}

// ─── Members ──────────────────────────────────────────────────────────────────
export async function addTeamMember(id: string, person: { id: string; person_type: PersonType }): Promise<TeamDetail> {
  // HR expects { person_id, role }; the write is idempotent (re-adding is a no-op).
  const res = await fetchWithAuth(`/api/hr/teams/${id}/members/`, {
    method: 'POST', body: JSON.stringify({ person_id: person.id, role: person.person_type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = res.status === 403 ? 'Du har ikke tilgang til å endre dette teamet.'
      : `Kunne ikke legge til (${res.status})`;
    throw new TeamMemberError(res.status, errMsg(data, fallback));
  }
  return mapDetail(data as HrTeam);
}

export async function removeTeamMember(id: string, person: { id: string; person_type: PersonType }): Promise<void> {
  // HR removes by person domain id in the path; the delete is idempotent.
  const res = await fetchWithAuth(`/api/hr/teams/${id}/members/${person.id}/`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new TeamMemberError(res.status, `Kunne ikke fjerne (${res.status})`);
}

export async function fetchAssignableMembers(id: string): Promise<{ count: number; results: AssignableMember[] }> {
  // HR returns a bare list [{ id, type, name, ab_person_id, user_id }]; wrap + remap.
  const raw = await getJSON<any>(`/api/hr/teams/${id}/assignable-members/`);
  const rows: Array<{ id: string; type: PersonType; name: string | null }> =
    Array.isArray(raw) ? raw : (raw?.results ?? []);
  const results: AssignableMember[] = rows.map((r) => ({
    id: r.id, name: r.name ?? '', email: '', person_type: r.type, online: false,
  }));
  return { count: results.length, results };
}

// ─── Analytics / leaderboard ──────────────────────────────────────────────────
// Teams Analytics (Features 12/13) — door-knock analytics live in the analytics
// service, scoped to admin (all) / sales-chief (own team).
export function fetchTeamsList(opts: { startDate?: string; endDate?: string } = {}): Promise<{ period: { start_date: string; end_date: string }; teams: TeamQuickStats[] }> {
  return getJSON(`/api/dashboard/teams/${qp({ start_date: opts.startDate, end_date: opts.endDate })}`);
}
export function fetchTeamAnalytics(id: string, opts: { startDate?: string; endDate?: string } = {}): Promise<TeamAnalytics> {
  return getJSON<TeamAnalytics>(`/api/dashboard/teams/${id}/analytics/${qp({ start_date: opts.startDate, end_date: opts.endDate })}`);
}

export function fetchTeamLeaderboard(opts: { campaignId: string; metric: LeaderboardMetric; startDate?: string; endDate?: string }): Promise<TeamLeaderboard> {
  return getJSON<TeamLeaderboard>(`/api/hr/teams/leaderboard/${qp({ campaign_id: opts.campaignId, metric: opts.metric, start_date: opts.startDate, end_date: opts.endDate })}`);
}

function errMsg(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    const parts = Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
    if (parts.length) return parts.join(' · ');
  }
  return fallback;
}
