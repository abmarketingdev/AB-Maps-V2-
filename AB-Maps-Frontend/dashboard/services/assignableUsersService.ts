/**
 * Assignable Users Service
 *
 * Uses GET /api/todos/assignment-users/ which is role-aware:
 *   Admin  -> sees admins + managers + employees
 *   Manager -> sees managers + employees (no admins)
 *   Employee -> 403 Forbidden
 *
 * The service makes a single API call and returns both the
 * permission flag and the user list so the UI never fires
 * two identical requests.
 */

import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface AssignmentUsersResponse {
  requester_role: 'admin' | 'manager';
  count: number;
  results: AssignmentUser[];
}

export interface AssignmentUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  ab_person_id: string | null;
  employee_type: string | null;
  admin_type: string | null;
  date_joined: string;
  last_login: string | null;
  user_type: 'admin' | 'manager' | 'employee' | 'unknown';
  manager_id: string | null;
  employee_id: string | null;
  manager: {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    ab_person_id: string | null;
    is_online: boolean;
    last_seen: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  employee: {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    ab_person_id: string | null;
    is_online: boolean;
    last_seen: string | null;
    created_at: string;
    updated_at: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Simplified UI type
// ---------------------------------------------------------------------------

export interface AssignableUser {
  id: string;
  username: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  user_type: 'admin' | 'manager' | 'employee' | 'unknown';
  type_label: string;
  phone?: string;
  manager_id?: string | null;
  employee_id?: string | null;
}

// ---------------------------------------------------------------------------
// Result type returned by the single fetch call
// ---------------------------------------------------------------------------

export interface FetchAssignableUsersResult {
  canAssign: boolean;
  requesterRole: 'admin' | 'manager' | null;
  users: AssignableUser[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeLabel(user: AssignmentUser): string {
  if (user.user_type === 'admin') {
    if (user.admin_type === 'maps_admin') return 'Maps Admin';
    if (user.admin_type === 'qc_admin') return 'QC Admin';
    return 'Admin';
  }
  if (user.user_type === 'employee') {
    if (user.employee_type === 'maps_emp') return 'Maps Employee';
    if (user.employee_type === 'qc_emp') return 'QC Employee';
    return 'Employee';
  }
  if (user.user_type === 'manager') return 'Manager';
  return user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1);
}

function transformUser(user: AssignmentUser): AssignableUser {
  let name = user.username;
  if (user.manager?.name) {
    name = user.manager.name;
  } else if (user.employee?.name) {
    name = user.employee.name;
  } else if (user.first_name && user.last_name) {
    name = `${user.first_name} ${user.last_name}`;
  } else if (user.first_name) {
    name = user.first_name;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name,
    first_name: user.first_name,
    last_name: user.last_name,
    user_type: user.user_type,
    type_label: getTypeLabel(user),
    phone: user.manager?.phone || user.employee?.phone,
    manager_id: user.manager_id,
    employee_id: user.employee_id,
  };
}

// ---------------------------------------------------------------------------
// Public API — single network call
// ---------------------------------------------------------------------------

/**
 * Fetches assignable users in one call.
 *
 * Returns `{ canAssign: false, ... }` when the user is an employee (403)
 * or when no auth token is present — the UI hides the section.
 */
export async function fetchAssignableUsers(): Promise<FetchAssignableUsersResult> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetchWithAuth(`${apiBase}/api/todos/assignment-users/`);

    if (response.status === 403) {
      return { canAssign: false, requesterRole: null, users: [] };
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch assignable users: ${response.status}`);
    }

    const data: AssignmentUsersResponse = await response.json();

    return {
      canAssign: true,
      requesterRole: data.requester_role,
      users: data.results.map(transformUser),
    };
  } catch (error) {
    console.error('[AssignableUsers] Error:', error);
    throw error;
  }
}
