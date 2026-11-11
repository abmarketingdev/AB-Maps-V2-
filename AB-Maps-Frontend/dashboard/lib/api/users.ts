// Admin User Management — live adapters (Module 4, §6.1). Manager/admin only.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export type EmployeeType = 'maps_emp' | 'qc_emp' | 'hr_emp';
export type AdminType = 'maps_admin' | 'qc_admin';
export type Dept = 'maps' | 'qc' | 'hr';

export interface FlatUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  user_type: 'employee' | 'manager' | 'superuser' | 'admin';
  employee_type: EmployeeType | null;   // maps_emp / qc_emp / hr_emp (employees)
  admin_type: AdminType | null;         // maps_admin / qc_admin (superusers)
  is_superuser: boolean;
  is_sales_chief: boolean;
  manager_id: string | null;
  ab_person_id: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  online: boolean;
}

export interface UserStats {
  total: number; managers: number; employees: number; superusers: number;
  by_employee_type?: Record<EmployeeType, number>;
  by_admin_type?: Record<AdminType, number>;
  by_dept?: Record<Dept, number>;
  sales_chiefs?: number;
}

export interface Paginated<T> { results: T[]; total_count: number; page: number; page_size: number; total_pages: number }

export type DirectoryRole = 'manager' | 'employee' | 'superuser';

const qp = (params: Record<string, string | number | undefined>): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

export function fetchUserStats(): Promise<UserStats> {
  return getJSON<UserStats>('/api/users/stats/');
}

export function fetchDirectory(opts: {
  role?: DirectoryRole; dept?: Dept; employeeType?: EmployeeType; adminType?: AdminType;
  search?: string; page?: number; pageSize?: number; ordering?: string;
} = {}): Promise<Paginated<FlatUser>> {
  return getJSON<Paginated<FlatUser>>(
    `/api/users/directory/${qp({ role: opts.role, dept: opts.dept, employee_type: opts.employeeType, admin_type: opts.adminType, search: opts.search, page: opts.page, page_size: opts.pageSize, ordering: opts.ordering })}`,
  );
}

export function fetchAssignable(): Promise<{ count: number; results: FlatUser[] }> {
  return getJSON<{ count: number; results: FlatUser[] }>('/api/users/assignable/');
}

// ─── Write ops (existing endpoints) ─────────────────────────────────────────
async function post(path: string, body: unknown): Promise<Response> {
  return fetchWithAuth(path, { method: 'POST', body: JSON.stringify(body) });
}

export const promoteEmployeeToManager = (userId: string, reason?: string) =>
  post('/api/users/promote-employee-to-manager/', { user_id: userId, reason });
export const promoteManagerToSuperuser = (userId: string, reason?: string) =>
  post('/api/users/promote-manager-to-superuser/', { user_id: userId, reason });
export const demoteSuperuserToManager = (userId: string, reason?: string) =>
  post('/api/users/demote-superuser-to-manager/', { user_id: userId, reason });

// Canonical registration is POST /users/users/ (UserViewSet.create → RegisterSerializer).
// The old /auth/register/ alias does not exist on the microservice (404).
export async function registerUser(body: Record<string, unknown>): Promise<Response> {
  return post('/api/users/users/', body);
}

// `id` here is the auth User.id (directory rows are keyed by user, not by the
// Employee/Manager person record), so both ops target the identity aggregate
// /users/users/{id}/ — the UserViewSet resolves by User.id and writes name/phone
// through to the linked person record + emits UserUpdated/UserDeactivated.
export async function deleteUser(_userType: 'employee' | 'manager', id: string): Promise<Response> {
  return fetchWithAuth(`/api/users/users/${id}/`, { method: 'DELETE' });
}

export interface BulkDeleteResult { id: string; name: string; ok: boolean; error: string | null }

/**
 * Delete several users (M-DEL). One call to POST /users/users/bulk-delete/ (admin only, max 200,
 * same tombstone path as single delete). If that endpoint is not deployed yet (404/405), falls
 * back to the single DELETE with concurrency 3. `onProgress(done, total)` drives the progress bar.
 */
export async function bulkDeleteUsers(
  users: { id: string; name: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkDeleteResult[]> {
  const total = users.length
  const nameOf = new Map(users.map(u => [u.id, u.name]))
  onProgress?.(0, total)
  const res = await post('/api/users/users/bulk-delete/', { ids: users.map(u => u.id) })
  if (res.ok) {
    const body = await res.json() as { results: BulkDeleteResult[] }
    onProgress?.(total, total)
    return body.results.map(r => ({ ...r, name: r.name || nameOf.get(r.id) || r.id }))
  }
  if (res.status !== 404 && res.status !== 405) {
    let msg = `Feil ${res.status}`
    try { const b = await res.json(); if (b?.detail) msg = String(b.detail) } catch { /* keep status */ }
    throw new Error(msg)
  }
  // Fallback: loop the single DELETE, 3 at a time.
  const out: BulkDeleteResult[] = new Array(total)
  let next = 0, done = 0
  const worker = async () => {
    while (next < total) {
      const i = next++
      const u = users[i]
      try {
        const r = await deleteUser('employee', u.id)
        out[i] = { id: u.id, name: u.name, ok: r.ok,
          error: r.ok ? null : r.status === 404 ? 'Fant ikke brukeren (allerede slettet?)'
            : r.status === 403 ? 'Ingen tilgang' : `Feil ${r.status}` }
      } catch {
        out[i] = { id: u.id, name: u.name, ok: false, error: 'Nettverksfeil' }
      }
      onProgress?.(++done, total)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return out
}

export async function updateUser(_userType: 'employee' | 'manager', id: string, body: Record<string, unknown>): Promise<Response> {
  return fetchWithAuth(`/api/users/users/${id}/`, { method: 'PATCH', body: JSON.stringify(body) });
}
