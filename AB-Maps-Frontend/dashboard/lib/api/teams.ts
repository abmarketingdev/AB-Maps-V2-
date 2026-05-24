// Campaign Teams — live adapter for /api/teams/. Manager/chief/admin only
// (employees get 403). Teams belong to one campaign; members are employees or
// managers assigned to that campaign.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export type PersonType = 'employee' | 'manager';

export interface TeamRef { id: string; name: string }
export interface OwnerRef { id: string; name: string }

export interface TeamListItem {
  id: string; name: string; description: string;
  color: string; icon: string;
  campaign: TeamRef | null; owner: OwnerRef | null;
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
export interface TeamAnalytics {
  team_id: string; name: string; campaign: TeamRef | null; member_count: number;
  total_doors: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  ja_rate: number; nei_rate: number; ikke_hjemme_rate: number; contact_rate: number;
  doors_per_active_day: number; consistency_score: number;
  work: { total_seconds: number; total_minutes: number; avg_minutes_per_member: number; active_members: number };
  per_member: TeamAnalyticsMember[];
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

// ─── List / create ────────────────────────────────────────────────────────────
export function listTeams(opts: {
  campaignId?: string; createdBy?: string; search?: string; page?: number; pageSize?: number;
} = {}): Promise<Paginated<TeamListItem>> {
  return getJSON<Paginated<TeamListItem>>(
    `/api/teams/${qp({ campaign_id: opts.campaignId, created_by: opts.createdBy, search: opts.search, page: opts.page, page_size: opts.pageSize })}`,
  );
}

export async function createTeam(body: { name: string; campaign_id: string; description?: string; color?: string; icon?: string }): Promise<TeamDetail> {
  const res = await fetchWithAuth('/api/teams/', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new TeamMemberError(res.status, errMsg(data, `Kunne ikke opprette team (${res.status})`));
  return data as TeamDetail;
}

// ─── Detail / edit / delete ─────────────────────────────────────────────────
export function getTeam(id: string): Promise<TeamDetail> {
  return getJSON<TeamDetail>(`/api/teams/${id}/`);
}

export async function updateTeam(id: string, body: { name?: string; description?: string; color?: string; icon?: string }): Promise<TeamDetail> {
  const res = await fetchWithAuth(`/api/teams/${id}/`, { method: 'PATCH', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new TeamMemberError(res.status, errMsg(data, `Kunne ikke lagre (${res.status})`));
  return data as TeamDetail;
}

export async function deleteTeam(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/teams/${id}/`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new TeamMemberError(res.status, `Kunne ikke slette (${res.status})`);
}

// ─── Members ──────────────────────────────────────────────────────────────────
export async function addTeamMember(id: string, person: { id: string; person_type: PersonType }): Promise<TeamDetail> {
  const body = person.person_type === 'manager' ? { manager_id: person.id } : { employee_id: person.id };
  const res = await fetchWithAuth(`/api/teams/${id}/members/`, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = res.status === 409 ? 'Personen er allerede på et team i denne kampanjen.'
      : res.status === 400 ? 'Personen er ikke tilknyttet kampanjen.'
      : `Kunne ikke legge til (${res.status})`;
    throw new TeamMemberError(res.status, errMsg(data, fallback));
  }
  return data as TeamDetail;
}

export async function removeTeamMember(id: string, person: { id: string; person_type: PersonType }): Promise<void> {
  const q = person.person_type === 'manager' ? `manager_id=${person.id}` : `employee_id=${person.id}`;
  const res = await fetchWithAuth(`/api/teams/${id}/members/?${q}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new TeamMemberError(res.status, `Kunne ikke fjerne (${res.status})`);
}

export function fetchAssignableMembers(id: string): Promise<{ count: number; results: AssignableMember[] }> {
  return getJSON<{ count: number; results: AssignableMember[] }>(`/api/teams/${id}/assignable-members/`);
}

// ─── Analytics / leaderboard ──────────────────────────────────────────────────
export function fetchTeamAnalytics(id: string, opts: { startDate?: string; endDate?: string } = {}): Promise<TeamAnalytics> {
  return getJSON<TeamAnalytics>(`/api/teams/${id}/analytics/${qp({ start_date: opts.startDate, end_date: opts.endDate })}`);
}

export function fetchTeamLeaderboard(opts: { campaignId: string; metric: LeaderboardMetric; startDate?: string; endDate?: string }): Promise<TeamLeaderboard> {
  return getJSON<TeamLeaderboard>(`/api/teams/leaderboard/${qp({ campaign_id: opts.campaignId, metric: opts.metric, start_date: opts.startDate, end_date: opts.endDate })}`);
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
