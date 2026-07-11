// Multi-assignee tasks — live adapter (Module 7, §5.6). /api/todos/v2/tasks/.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type Perspective = 'mine' | 'assigned_by_me' | 'team';

export interface Task {
  id: string;
  title: string;
  description: string;
  assigner_id: string | null;
  assignee_ids: string[];
  status: TaskStatus;
  priority: TaskPriority;
  due: string | null;
  campaign: string | null;        // campaign id (for filtering)
  campaign_name?: string | null;  // display name (backend now returns this)
}

export interface TaskPage { results: Task[]; total_count: number; page: number; page_size: number; total_pages: number }
export interface TaskBoard { todo: Task[]; in_progress: Task[]; done: Task[] }

export interface TaskListOpts {
  perspective: Perspective;
  status?: TaskStatus;
  assigneeId?: string;
  campaign?: string;
  ordering?: string;
  page?: number;
}

const qp = (params: Record<string, string | number | undefined>): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

// ─── Backend adapter ────────────────────────────────────────────────────────
// The maps-service serves a single-user Todo model at /api/todos/v2/tasks/ (status
// pending/in_progress/completed, `deadline`, `user_id`, `related_campaign`) and returns a
// FLAT array (it ignores group_by/perspective). Map it onto the dashboard's Task shape and
// group the board client-side. NOTE: multi-assignee/team/assigned_by_me are backend-limited —
// the list is always the caller's own tasks until the backend implements those perspectives.
interface RawTodo {
  id: string; title: string; description?: string;
  user_id?: string | null; assigned_by_id?: string | null;
  status?: string; priority?: TaskPriority;
  deadline?: string | null; related_campaign?: string | null; related_campaign_name?: string | null;
}
const BE_TO_FE_STATUS: Record<string, TaskStatus> = { pending: 'todo', in_progress: 'in_progress', completed: 'done' };
const FE_TO_BE_STATUS: Record<TaskStatus, string> = { todo: 'pending', in_progress: 'in_progress', done: 'completed' };

function mapTodo(r: RawTodo): Task {
  return {
    id: r.id, title: r.title, description: r.description ?? '',
    assigner_id: r.assigned_by_id ?? null,
    assignee_ids: r.user_id ? [String(r.user_id)] : [],
    status: BE_TO_FE_STATUS[r.status ?? 'pending'] ?? 'todo',
    priority: r.priority ?? 'medium',
    due: r.deadline ?? null,
    campaign: r.related_campaign ?? null,
    campaign_name: r.related_campaign_name ?? null,
  };
}
// The endpoint returns a bare array (or, if paginated later, {results:[...]}). Tolerate both.
function extractRows(raw: unknown): RawTodo[] {
  if (Array.isArray(raw)) return raw as RawTodo[];
  const r = raw as { results?: RawTodo[] } | null;
  return r?.results ?? [];
}

export async function listTasks(o: TaskListOpts): Promise<TaskPage> {
  const raw = await getJSON<unknown>(`/api/todos/v2/tasks/${qp({
    perspective: o.perspective, status: o.status ? FE_TO_BE_STATUS[o.status] : undefined,
    campaign: o.campaign, ordering: o.ordering, page: o.page,
  })}`);
  const results = extractRows(raw).map(mapTodo);
  return { results, total_count: results.length, page: 1, page_size: results.length, total_pages: 1 };
}

export async function boardTasks(o: Omit<TaskListOpts, 'page'>): Promise<TaskBoard> {
  const raw = await getJSON<unknown>(`/api/todos/v2/tasks/${qp({
    perspective: o.perspective, status: o.status ? FE_TO_BE_STATUS[o.status] : undefined,
    campaign: o.campaign, ordering: o.ordering,
  })}`);
  const board: TaskBoard = { todo: [], in_progress: [], done: [] };
  for (const t of extractRows(raw).map(mapTodo)) board[t.status].push(t);
  return board;
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  priority: TaskPriority;
  due?: string | null;
  campaign?: string | null;
  status?: TaskStatus;
  assignee_ids: string[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`Task request failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

// Map the dashboard's create/patch body onto the backend Todo fields (single-user model:
// `deadline`/`related_campaign`/backend status; assignee_ids is not supported server-side yet,
// so a created task is owned by the requester).
function toBackendBody(body: Partial<CreateTaskBody>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (body.title !== undefined) out.title = body.title;
  if (body.description !== undefined) out.description = body.description;
  if (body.priority !== undefined) out.priority = body.priority;
  if (body.status !== undefined) out.status = FE_TO_BE_STATUS[body.status];
  if (body.due !== undefined) out.deadline = body.due;
  if (body.campaign !== undefined) out.related_campaign = body.campaign;
  return out;
}

export async function createTask(body: CreateTaskBody): Promise<Task> {
  const raw = await jsonOrThrow<RawTodo>(await fetchWithAuth('/api/todos/v2/tasks/', { method: 'POST', body: JSON.stringify(toBackendBody(body)) }));
  return mapTodo(raw);
}
export async function patchTask(id: string, body: Partial<CreateTaskBody>): Promise<Task> {
  const raw = await jsonOrThrow<RawTodo>(await fetchWithAuth(`/api/todos/v2/tasks/${id}/`, { method: 'PATCH', body: JSON.stringify(toBackendBody(body)) }));
  return mapTodo(raw);
}
export async function deleteTask(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/todos/v2/tasks/${id}/`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}
export async function completeTask(id: string): Promise<void> {
  await fetchWithAuth(`/api/todos/v2/tasks/${id}/complete/`, { method: 'POST' });
}
export async function startTask(id: string): Promise<void> {
  await fetchWithAuth(`/api/todos/v2/tasks/${id}/start/`, { method: 'POST' });
}
export async function bulkComplete(ids: string[]): Promise<void> {
  await fetchWithAuth('/api/todos/v2/tasks/bulk_complete/', { method: 'POST', body: JSON.stringify({ todo_ids: ids }) });
}
export async function bulkDelete(ids: string[]): Promise<void> {
  await fetchWithAuth('/api/todos/v2/tasks/bulk_delete/', { method: 'POST', body: JSON.stringify({ todo_ids: ids }) });
}
