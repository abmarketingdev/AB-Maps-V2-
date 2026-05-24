// User lookups — live adapters.
//  - checkSuperuserStatus → GET /api/users/users/check_superuser/
//  - fetchAssignableUsers / fetchManagersAndAdmins / fetchAllUsers → GET /api/users/assignable/
import { getJSON } from '@/lib/auth/fetchWithAuth';

export interface SuperuserCheckResponse {
  is_superuser: boolean;
}

let superuserCache: { value: boolean; ts: number } | null = null;
const SUPERUSER_TTL = 5 * 60 * 1000;

export const checkSuperuserStatus = async (): Promise<boolean> => {
  if (superuserCache && Date.now() - superuserCache.ts < SUPERUSER_TTL) {
    return superuserCache.value;
  }
  try {
    const res = await getJSON<SuperuserCheckResponse>('/api/users/users/check_superuser/');
    const value = !!res?.is_superuser;
    superuserCache = { value, ts: Date.now() };
    return value;
  } catch {
    return false;
  }
};

export const clearSuperuserStatusCache = (): void => {
  superuserCache = null;
};

// ============================================================================
// User List Types
// ============================================================================

export interface AssignableUser {
  id: string;
  user_id: string;
  username: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  user_type: 'manager' | 'admin';
}

// Shape returned by /api/users/assignable/
interface AssignableApiUser {
  id: string;
  username: string;
  name: string;
  email: string;
  user_type: 'employee' | 'manager' | 'superuser' | 'admin';
}

function splitName(name: string): { first_name: string; last_name: string } {
  const parts = (name || '').trim().split(/\s+/);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

function mapUser(u: AssignableApiUser): AssignableUser {
  const { first_name, last_name } = splitName(u.name);
  // The legacy AssignableUser type only models manager|admin; superuser maps to admin.
  const user_type: 'manager' | 'admin' = u.user_type === 'manager' ? 'manager' : 'admin';
  return {
    id: u.id,
    user_id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    first_name,
    last_name,
    user_type,
  };
}

async function fetchAssignable(): Promise<AssignableApiUser[]> {
  const res = await getJSON<{ count: number; results: AssignableApiUser[] }>('/api/users/assignable/');
  return res?.results ?? [];
}

export const fetchAllUsers = async (): Promise<AssignableUser[]> => {
  return (await fetchAssignable()).map(mapUser);
};

export const fetchAssignableUsers = async (): Promise<AssignableUser[]> => {
  return (await fetchAssignable()).map(mapUser);
};

// Only managers / admins / superusers (admin-task assignees).
export const fetchManagersAndAdmins = async (): Promise<AssignableUser[]> => {
  return (await fetchAssignable())
    .filter((u) => u.user_type !== 'employee')
    .map(mapUser);
};
