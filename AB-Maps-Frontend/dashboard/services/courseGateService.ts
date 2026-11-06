// Course gate (Dana 05.11): an admin can require a person to finish a course before they may
// use the map. Learning is the source of truth (GET /api/learning/me/assignments/); Maps itself
// answers 403 course_required for a blocked person. Admins are never blocked.
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export interface CourseGateSection {
  id: number;
  title: string;
  progress_percent?: number;
  reason?: string;
}

export interface CourseGateState {
  blocked: boolean;
  sections: CourseGateSection[];
}

const KEY = 'ab_course_gate';

/** Last known state (sessionStorage), so launchMap can decide synchronously. */
export function getCachedCourseGate(): CourseGateState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CourseGateState) : null;
  } catch {
    return null;
  }
}

/** Ask Learning. Returns null on any error (fail open: never block on a failed check). */
export async function fetchCourseGate(): Promise<CourseGateState | null> {
  try {
    const res = await fetchWithAuth('/api/learning/me/assignments/', { method: 'GET' });
    if (!res.ok) return null;
    const body = await res.json();
    const state: CourseGateState = { blocked: !!body.blocked, sections: body.sections || [] };
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
    return state;
  } catch {
    return null;
  }
}

export function courseUrl(state: CourseGateState | null): string {
  const first = state?.sections?.[0];
  return first ? `/ab-academy/${first.id}` : '/ab-academy';
}

export function courseNames(sections: CourseGateSection[]): string {
  const names = sections.map((s) => `«${s.title}»`);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}`;
}

// ── admin (learning admin users page) ─────────────────────────────────────────
export interface CourseAssignment {
  id: number;
  user_id: string;
  user_name: string | null;
  section_id: number;
  section_title: string;
  reason: string;
  assigned_by_name: string | null;
  assigned_at: string;
  completed_at: string | null;
  revoked_at: string | null;
  is_open: boolean;
  already_completed?: boolean;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || body.detail || `Feil (${res.status})`;
  } catch {
    return `Feil (${res.status})`;
  }
}

export async function listAssignments(userId: string): Promise<CourseAssignment[]> {
  const res = await fetchWithAuth(`/api/learning/admin/assignments/?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()).results as CourseAssignment[];
}

export async function assignCourse(userId: string, sectionId: number, reason: string): Promise<CourseAssignment> {
  const res = await fetchWithAuth('/api/learning/admin/assignments/', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, section_id: sectionId, reason }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function revokeAssignment(id: number): Promise<CourseAssignment> {
  const res = await fetchWithAuth(`/api/learning/admin/assignments/${id}/revoke/`, { method: 'POST' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
