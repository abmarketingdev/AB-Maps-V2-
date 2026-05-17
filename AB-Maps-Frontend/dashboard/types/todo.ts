/**
 * TODO System - TypeScript Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for the TODO system.
 * It includes data structures for TODOs, API requests/responses, filters, and statistics.
 */

// ============================================================================
// Core TODO Interface
// ============================================================================

export interface Todo {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  status_display: string;
  priority: 'low' | 'medium' | 'high';
  priority_display: string;
  deadline: string | null;
  is_overdue: boolean;
  days_until_deadline: number | null;
  related_address: string | null;
  related_campaign: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  user_id: string;
  user_name: string;
  // Admin assignment fields
  is_admin_assigned?: boolean;
  assigned_by?: {
    id: string;
    username: string;
  };
  admin_task_id?: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateTodoRequest {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: string;
  related_address?: string;
  related_campaign?: string;
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  deadline?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface TodoFilters {
  status?: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  is_admin_assigned?: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

export interface TodoListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Todo[];
}

export interface TodoStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  today: number;
  this_week: number;
  high_priority: number;
  with_deadline: number;
}

export interface BulkActionResult {
  completed?: number;
  deleted?: number;
  failed?: number;
  message: string;
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

export interface BulkCompleteRequest {
  todo_ids: string[];
}

export interface BulkDeleteRequest {
  todo_ids: string[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTodo(obj: any): obj is Todo {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.description === 'string' &&
    ['pending', 'in_progress', 'completed'].includes(obj.status) &&
    ['low', 'medium', 'high'].includes(obj.priority)
  );
}

export function isTodoListResponse(obj: any): obj is TodoListResponse {
  return (
    obj &&
    typeof obj.count === 'number' &&
    Array.isArray(obj.results) &&
    obj.results.every(isTodo)
  );
}

// ============================================================================
// Enums for Status and Priority
// ============================================================================

export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum TodoPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

// ============================================================================
// Display Helpers
// ============================================================================

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  [TodoStatus.PENDING]: 'Pending',
  [TodoStatus.IN_PROGRESS]: 'In Progress',
  [TodoStatus.COMPLETED]: 'Completed',
};

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  [TodoPriority.LOW]: 'Low',
  [TodoPriority.MEDIUM]: 'Medium',
  [TodoPriority.HIGH]: 'High',
};

export const TODO_STATUS_COLORS: Record<TodoStatus, string> = {
  [TodoStatus.PENDING]: 'blue',
  [TodoStatus.IN_PROGRESS]: 'yellow',
  [TodoStatus.COMPLETED]: 'green',
};

export const TODO_PRIORITY_COLORS: Record<TodoPriority, string> = {
  [TodoPriority.LOW]: 'secondary',
  [TodoPriority.MEDIUM]: 'default',
  [TodoPriority.HIGH]: 'destructive',
};

// ============================================================================
// Admin Task Assignment Types
// ============================================================================

/**
 * Represents a user assigned to an admin task
 */
export interface AssignedUser {
  user_id: string;
  user_name: string;
  user_type: 'manager' | 'admin';
  todo_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at: string | null;
}

/**
 * Admin-assigned task created by an admin
 */
export interface AdminAssignedTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string | null;
  created_by: {
    id: string;
    username: string;
  };
  created_at: string;
  updated_at: string;
  assigned_count: number;
  assigned_managers_count: number;
  assigned_admins_count: number;
  completed_count: number;
  completion_percentage: number;
  is_fully_completed: boolean;
  assigned_users: AssignedUser[];
  assigned_to?: Array<{
    id: string;
    username: string;
    user_type: 'manager' | 'admin';
  }>;
}

/**
 * Request to assign a task to users via POST /api/todos/assign-users/
 * Creates one todo per selected user with is_admin_assigned=true.
 */
export interface AssignTaskRequest {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: string;
  user_ids: string[];
}

/**
 * Single created-todo entry returned inside AssignTaskResponse
 */
export interface CreatedTodoEntry {
  todo_id: string;
  user_id: string;
  username: string;
  user_type: 'admin' | 'manager' | 'employee';
}

/**
 * Response from POST /api/todos/assign-users/
 */
export interface AssignTaskResponse {
  message: string;
  assigned_count: number;
  created_todos: CreatedTodoEntry[];
}

/**
 * Request to update an admin task
 */
export interface UpdateAdminTaskRequest {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: string;
}

/**
 * Request to add assignees to a task
 */
export interface AddAssigneesRequest {
  assignee_ids: string[];
}

/**
 * Request to remove assignees from a task
 */
export interface RemoveAssigneesRequest {
  assignee_ids: string[];
}

/**
 * Response from adding assignees
 */
export interface AddAssigneesResponse extends AdminAssignedTask {
  added_users?: Array<{
    user_id: string;
    user_name: string;
    user_type: 'manager' | 'admin';
  }>;
  skipped_users?: Array<{
    user_id: string;
    user_name: string;
    reason: string;
  }>;
}

/**
 * Response from removing assignees
 */
export interface RemoveAssigneesResponse extends AdminAssignedTask {
  removed_users?: Array<{
    user_id: string;
    user_name: string;
  }>;
}

/**
 * Filters for admin task list
 */
export interface AdminTaskFilters {
  priority?: 'low' | 'medium' | 'high';
  search?: string;
  ordering?: 'created_at' | '-created_at' | 'deadline' | '-deadline' | 'priority' | '-priority';
  page?: number;
  page_size?: number;
}

/**
 * Paginated response for admin tasks
 */
export interface AdminTaskListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdminAssignedTask[];
}
