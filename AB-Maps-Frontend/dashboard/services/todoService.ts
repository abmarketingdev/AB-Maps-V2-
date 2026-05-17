/**
 * TODO Service - API Integration
 * 
 * This service handles all API interactions for the TODO system.
 * It includes CRUD operations, bulk actions, and specialized endpoints.
 */

import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';
import {
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  TodoFilters,
  TodoListResponse,
  TodoStats,
  BulkActionResult,
  BulkCompleteRequest,
  BulkDeleteRequest,
  AssignTaskRequest,
  AssignTaskResponse,
} from '@/types/todo';

// ============================================================================
// Constants
// ============================================================================

const TODO_ENDPOINTS = {
  base: '/api/todos/todos/',
  detail: (id: string) => `/api/todos/todos/${id}/`,
  complete: (id: string) => `/api/todos/todos/${id}/complete/`,
  start: (id: string) => `/api/todos/todos/${id}/start/`,
  today: '/api/todos/todos/today/',
  overdue: '/api/todos/todos/overdue/',
  upcoming: '/api/todos/todos/upcoming/',
  stats: '/api/todos/todos/stats/',
  bulkComplete: '/api/todos/todos/bulk_complete/',
  bulkDelete: '/api/todos/todos/bulk_delete/',
  assignUsers: '/api/todos/assign-users/',
};

// ============================================================================
// Helper Functions
// ============================================================================

async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithAuth(url, options);
}

/**
 * Builds URL with query parameters
 */
function buildUrlWithParams(baseUrl: string, params?: Record<string, any>): string {
  if (!params) return baseUrl;

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Fetches all TODOs for the current user with optional filters
 * 
 * @param filters - Optional filters including:
 *   - status: Filter by status (pending/in_progress/completed)
 *   - priority: Filter by priority (low/medium/high)
 *   - search: Search in title/description
 *   - is_admin_assigned: Filter by admin assignment (true/false)
 *   - ordering: Sort order
 *   - page: Page number for pagination
 *   - page_size: Items per page
 */
export async function fetchTodos(filters?: TodoFilters): Promise<TodoListResponse> {
  try {
    const url = buildUrlWithParams(
      buildApiUrl(TODO_ENDPOINTS.base),
      filters
    );

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[TODO Service] Fetched TODOs:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error fetching TODOs:', error);
    throw error;
  }
}

/**
 * Creates a new TODO
 */
export async function createTodo(todoData: CreateTodoRequest): Promise<Todo> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.base);

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(todoData),
    });

    const data = await response.json();
    console.log('[TODO Service] Created TODO:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error creating TODO:', error);
    throw error;
  }
}

/**
 * Fetches a specific TODO by ID
 */
export async function getTodo(id: string): Promise<Todo> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.detail(id));

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[TODO Service] Fetched TODO:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error fetching TODO:', error);
    throw error;
  }
}

/**
 * Updates a TODO
 */
export async function updateTodo(
  id: string,
  updates: UpdateTodoRequest
): Promise<Todo> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.detail(id));

    const response = await makeAuthenticatedRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    console.log('[TODO Service] Updated TODO:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error updating TODO:', error);
    throw error;
  }
}

/**
 * Deletes a TODO
 */
export async function deleteTodo(id: string): Promise<void> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.detail(id));

    await makeAuthenticatedRequest(url, {
      method: 'DELETE',
    });

    console.log('[TODO Service] Deleted TODO:', id);
  } catch (error) {
    console.error('[TODO Service] Error deleting TODO:', error);
    throw error;
  }
}

// ============================================================================
// Quick Actions
// ============================================================================

/**
 * Marks a TODO as complete
 */
export async function completeTodo(id: string): Promise<Todo> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.complete(id));

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
    });

    const data = await response.json();
    console.log('[TODO Service] Completed TODO:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error completing TODO:', error);
    throw error;
  }
}

/**
 * Marks a TODO as started (in progress)
 */
export async function startTodo(id: string): Promise<Todo> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.start(id));

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
    });

    const data = await response.json();
    console.log('[TODO Service] Started TODO:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error starting TODO:', error);
    throw error;
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Marks multiple TODOs as complete
 */
export async function bulkCompleteTodos(todoIds: string[]): Promise<BulkActionResult> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.bulkComplete);

    const requestData: BulkCompleteRequest = {
      todo_ids: todoIds,
    };

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    const data = await response.json();
    console.log('[TODO Service] Bulk completed TODOs:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error bulk completing TODOs:', error);
    throw error;
  }
}

/**
 * Deletes multiple TODOs
 */
export async function bulkDeleteTodos(todoIds: string[]): Promise<BulkActionResult> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.bulkDelete);

    const requestData: BulkDeleteRequest = {
      todo_ids: todoIds,
    };

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    const data = await response.json();
    console.log('[TODO Service] Bulk deleted TODOs:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error bulk deleting TODOs:', error);
    throw error;
  }
}

// ============================================================================
// Task Assignment
// ============================================================================

/**
 * Assigns a task to one or more users.
 * Calls POST /api/todos/assign-users/ which creates one todo per user
 * with is_admin_assigned=true and assigned_by=current user.
 *
 * Permission rules (enforced server-side):
 *  - Admin: can assign to admins, managers, employees
 *  - Manager: can assign to managers and employees only
 *  - Employee: 403
 */
export async function assignTask(
  request: AssignTaskRequest
): Promise<AssignTaskResponse> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.assignUsers);

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    const data: AssignTaskResponse = await response.json();
    console.log('[TODO Service] Assigned task:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error assigning task:', error);
    throw error;
  }
}

// ============================================================================
// Specialized Endpoints
// ============================================================================

/**
 * Fetches TODOs due today
 */
export async function getTodaysTodos(): Promise<Todo[]> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.today);

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[TODO Service] Fetched today\'s TODOs:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error fetching today\'s TODOs:', error);
    throw error;
  }
}

/**
 * Fetches overdue TODOs
 */
export async function getOverdueTodos(): Promise<Todo[]> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.overdue);

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[TODO Service] Fetched overdue TODOs:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error fetching overdue TODOs:', error);
    throw error;
  }
}

/**
 * Fetches upcoming TODOs (next 7 days)
 */
export async function getUpcomingTodos(): Promise<Todo[]> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.upcoming);

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[TODO Service] Fetched upcoming TODOs:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error fetching upcoming TODOs:', error);
    throw error;
  }
}

/**
 * Fetches TODO statistics
 */
export async function getTodoStats(): Promise<TodoStats> {
  try {
    const url = buildApiUrl(TODO_ENDPOINTS.stats);

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[TODO Service] Fetched TODO stats:', data);
    return data;
  } catch (error) {
    console.error('[TODO Service] Error fetching TODO stats:', error);
    throw error;
  }
}

// ============================================================================
// Export all functions
// ============================================================================

export const todoService = {
  // CRUD
  fetchTodos,
  createTodo,
  getTodo,
  updateTodo,
  deleteTodo,
  
  // Quick Actions
  completeTodo,
  startTodo,
  
  // Bulk Operations
  bulkCompleteTodos,
  bulkDeleteTodos,
  
  // Assignment
  assignTask,
  
  // Specialized
  getTodaysTodos,
  getOverdueTodos,
  getUpcomingTodos,
  getTodoStats,
};

export default todoService;

