// Admin User Management — live adapters (Module 4, §6.1). Manager/admin only.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export interface FlatUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  user_type: 'employee' | 'manager' | 'superuser' | 'admin';
  is_superuser: boolean;
  is_sales_chief: boolean;
  manager_id: string | null;
  ab_person_id: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  online: boolean;
}

export interface UserStats { total: number; managers: number; employees: number; superusers: number }

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
  role?: DirectoryRole; search?: string; page?: number; pageSize?: number; ordering?: string;
} = {}): Promise<Paginated<FlatUser>> {
  return getJSON<Paginated<FlatUser>>(
    `/api/users/directory/${qp({ role: opts.role, search: opts.search, page: opts.page, page_size: opts.pageSize, ordering: opts.ordering })}`,
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

export async function registerUser(body: Record<string, unknown>): Promise<Response> {
  return post('/api/users/auth/register/', body);
}

export async function deleteUser(userType: 'employee' | 'manager', id: string): Promise<Response> {
  const base = userType === 'manager' ? '/api/users/managers/' : '/api/users/employees/';
  return fetchWithAuth(`${base}${id}/`, { method: 'DELETE' });
}

export async function updateUser(userType: 'employee' | 'manager', id: string, body: Record<string, unknown>): Promise<Response> {
  const base = userType === 'manager' ? '/api/users/managers/' : '/api/users/employees/';
  return fetchWithAuth(`${base}${id}/`, { method: 'PATCH', body: JSON.stringify(body) });
}
