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

export function listTasks(o: TaskListOpts): Promise<TaskPage> {
  return getJSON<TaskPage>(`/api/todos/v2/tasks/${qp({
    perspective: o.perspective, status: o.status, assignee_id: o.assigneeId,
    campaign: o.campaign, ordering: o.ordering, page: o.page,
  })}`);
}

export function boardTasks(o: Omit<TaskListOpts, 'page'>): Promise<TaskBoard> {
  return getJSON<TaskBoard>(`/api/todos/v2/tasks/${qp({
    group_by: 'status', perspective: o.perspective, status: o.status,
    assignee_id: o.assigneeId, campaign: o.campaign, ordering: o.ordering,
  })}`);
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

export async function createTask(body: CreateTaskBody): Promise<Task> {
  return jsonOrThrow<Task>(await fetchWithAuth('/api/todos/v2/tasks/', { method: 'POST', body: JSON.stringify(body) }));
}
export async function patchTask(id: string, body: Partial<CreateTaskBody>): Promise<Task> {
  return jsonOrThrow<Task>(await fetchWithAuth(`/api/todos/v2/tasks/${id}/`, { method: 'PATCH', body: JSON.stringify(body) }));
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
