import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import { buildApiUrl, API_CONFIG } from '@/lib/config/apiConfig';

/**
 * Sales-Chief Team API client.
 *
 * Endpoints (all JWT-authenticated; caller must have `is_sales_chief=true`):
 *
 *   GET    /api/users/sales-chief/available-people/    — people the chief can add
 *   GET    /api/users/sales-chief/team/                — chief's current team
 *   POST   /api/users/sales-chief/team/add/            — add one
 *   POST   /api/users/sales-chief/team/bulk-add/       — add many
 *   DELETE /api/users/sales-chief/team/<id>/remove/    — remove one
 *   POST   /api/users/sales-chief/team/bulk-remove/    — remove many
 *
 * All error responses carry a stable `code` field so the UI can branch on
 * it (e.g. `already_in_team`, `user_not_found`, `self_add_not_allowed`,
 * `role_required`, `not_in_team`).
 */

export type Role = 'manager' | 'employee';

export interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  username: string;
  ab_person_id: string | null;
  role: Role;
  added_at: string;
  phone?: string | null;
  is_online?: boolean;
}

export interface AvailablePerson {
  user_id: string;
  name: string;
  email: string;
  username: string;
  ab_person_id: string | null;
  role: Role;
  is_online?: boolean;
  phone?: string | null;
}

export interface TeamResponse {
  count: number;
  team: TeamMember[];
}

export interface AvailablePeopleResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AvailablePerson[];
}

export interface BulkAddResult {
  added: TeamMember[];
  already_exists: string[];
  not_found: string[];
  /** Users that could not be auto-classified and no explicit role was sent. */
  no_role: string[];
}

export interface BulkRemoveResult {
  removed: number;
  /** Full snapshots of every user that was actually removed. */
  removed_members: TeamMember[];
  not_found: string[];
}

export interface RemoveResult {
  removed: number;
  member: TeamMember;
}

/** A thrown error that carries the backend's stable error code. */
export class SalesChiefApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;

  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = 'SalesChiefApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function parseError(res: Response, fallback: string): Promise<SalesChiefApiError> {
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  const detail =
    (body as { detail?: string }).detail ||
    (body as { message?: string }).message ||
    fallback;
  const code = (body as { code?: string }).code;
  return new SalesChiefApiError(detail, res.status, code, body);
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

export interface FetchAvailableParams {
  search?: string;
  role?: Role;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

// ─── LIVE (Module 4 / §6) ───────────────────────────────────────────────

async function jsonOrThrow<T>(res: Response, errMsg: string): Promise<T> {
  if (!res.ok) throw await parseError(res, errMsg);
  return res.json() as Promise<T>;
}

export async function fetchAvailablePeople(
  params: FetchAvailableParams = {}
): Promise<AvailablePeopleResponse> {
  const qs = new URLSearchParams();
  if (params.role) qs.set('role', params.role);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('page_size', String(params.pageSize));
  const url = buildApiUrl(API_CONFIG.SALES_CHIEF.AVAILABLE_PEOPLE) + (qs.toString() ? `?${qs}` : '');
  return jsonOrThrow<AvailablePeopleResponse>(await fetchWithAuth(url, { signal: params.signal }), 'Kunne ikke hente tilgjengelige personer');
}

export async function fetchMyTeam(signal?: AbortSignal): Promise<TeamResponse> {
  const url = buildApiUrl(API_CONFIG.SALES_CHIEF.TEAM);
  return jsonOrThrow<TeamResponse>(await fetchWithAuth(url, { signal }), 'Kunne ikke hente teamet');
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                    */
/* -------------------------------------------------------------------------- */

export async function addTeamMember(userId: string, role?: Role): Promise<TeamMember> {
  const url = buildApiUrl(API_CONFIG.SALES_CHIEF.ADD);
  return jsonOrThrow<TeamMember>(
    await fetchWithAuth(url, { method: 'POST', body: JSON.stringify({ user_id: userId, ...(role ? { role } : {}) }) }),
    'Kunne ikke legge til medlem',
  );
}

export async function bulkAddTeamMembers(
  members: Array<{ user_id: string; role?: Role }>
): Promise<BulkAddResult> {
  const url = buildApiUrl(API_CONFIG.SALES_CHIEF.BULK_ADD);
  return jsonOrThrow<BulkAddResult>(
    await fetchWithAuth(url, { method: 'POST', body: JSON.stringify({ members }) }),
    'Kunne ikke legge til medlemmer',
  );
}

export async function removeTeamMember(userId: string): Promise<RemoveResult> {
  const url = buildApiUrl(API_CONFIG.SALES_CHIEF.REMOVE, { user_id: userId });
  return jsonOrThrow<RemoveResult>(
    await fetchWithAuth(url, { method: 'DELETE' }),
    'Kunne ikke fjerne medlem',
  );
}

export async function bulkRemoveTeamMembers(userIds: string[]): Promise<BulkRemoveResult> {
  const url = buildApiUrl(API_CONFIG.SALES_CHIEF.BULK_REMOVE);
  return jsonOrThrow<BulkRemoveResult>(
    await fetchWithAuth(url, { method: 'POST', body: JSON.stringify({ user_ids: userIds }) }),
    'Kunne ikke fjerne medlemmer',
  );
}
