/**
 * Admin Task Service - API Integration
 * 
 * This service handles all API interactions for admin task assignment.
 * It includes creating tasks, assigning to users, and managing task lifecycle.
 * 
 * Requires: User must have is_superuser=true AND is_staff=true
 */

import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import { buildApiUrl } from '@/lib/config/apiConfig';
import {
  AdminAssignedTask,
  AssignTaskRequest,
  UpdateAdminTaskRequest,
  AddAssigneesRequest,
  RemoveAssigneesRequest,
  AddAssigneesResponse,
  RemoveAssigneesResponse,
  AdminTaskFilters,
  AdminTaskListResponse,
} from '@/types/todo';

// ============================================================================
// Constants
// ============================================================================

const ADMIN_TASK_ENDPOINTS = {
  base: '/api/todos/admin/assigned-tasks/',
  assignTask: '/api/todos/admin/assigned-tasks/assign_task/',
  detail: (id: string) => `/api/todos/admin/assigned-tasks/${id}/`,
  addAssignees: (id: string) => `/api/todos/admin/assigned-tasks/${id}/assign_users/`,
  removeAssignees: (id: string) => `/api/todos/admin/assigned-tasks/${id}/remove_users/`,
};

// ============================================================================
// Helper Functions
// ============================================================================

async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetchWithAuth(url, options);

  if (!response.ok) {
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
          errorData.error ||
          'You do not have permission to perform this action. Admin privileges required.'
      );
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        errorData.error ||
        `HTTP error! status: ${response.status}`
    );
  }

  return response;
}

/**
 * Builds URL with query parameters
 */
function buildUrlWithParams(baseUrl: string, params?: Record<string, any>): string {
  if (!params) return baseUrl;

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// ============================================================================
// Admin Task Operations
// ============================================================================

/**
 * Creates a new task and assigns it to specified users
 * 
 * @param taskData - Task details and assignee IDs
 * @returns Created admin task with assignment details
 */
export async function assignTask(taskData: AssignTaskRequest): Promise<AdminAssignedTask> {
  try {
    const url = buildApiUrl(ADMIN_TASK_ENDPOINTS.assignTask);

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });

    const data = await response.json();
    console.log('[Admin Task Service] Created and assigned task:', data);
    return data;
  } catch (error) {
    console.error('[Admin Task Service] Error assigning task:', error);
    throw error;
  }
}

/**
 * Fetches all admin tasks created by the current admin
 * 
 * @param filters - Optional filters for priority, search, ordering, pagination
 * @returns Paginated list of admin tasks
 */
export async function listAdminTasks(
  filters?: AdminTaskFilters
): Promise<AdminTaskListResponse> {
  try {
    const url = buildUrlWithParams(
      buildApiUrl(ADMIN_TASK_ENDPOINTS.base),
      filters
    );

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[Admin Task Service] Fetched admin tasks:', data);
    
    // Handle both array response and paginated response format
    if (Array.isArray(data)) {
      // API returns array directly
      return {
        results: data,
        count: data.length,
      };
    } else if (data.results && Array.isArray(data.results)) {
      // API returns paginated response
      return data;
    } else {
      // Unexpected format, return empty
      console.warn('[Admin Task Service] Unexpected response format:', data);
      return {
        results: [],
        count: 0,
      };
    }
  } catch (error) {
    console.error('[Admin Task Service] Error fetching admin tasks:', error);
    throw error;
  }
}

/**
 * Fetches a specific admin task by ID
 * 
 * @param taskId - UUID of the admin task
 * @returns Admin task with full details including assignees
 */
export async function getAdminTask(taskId: string): Promise<AdminAssignedTask> {
  try {
    const url = buildApiUrl(ADMIN_TASK_ENDPOINTS.detail(taskId));

    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('[Admin Task Service] Fetched admin task:', data);
    return data;
  } catch (error) {
    console.error('[Admin Task Service] Error fetching admin task:', error);
    throw error;
  }
}

/**
 * Updates an admin task
 * Updates automatically propagate to all assignees' todos
 * 
 * @param taskId - UUID of the admin task
 * @param updates - Fields to update
 * @returns Updated admin task
 */
export async function updateAdminTask(
  taskId: string,
  updates: UpdateAdminTaskRequest
): Promise<AdminAssignedTask> {
  try {
    const url = buildApiUrl(ADMIN_TASK_ENDPOINTS.detail(taskId));

    const response = await makeAuthenticatedRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    console.log('[Admin Task Service] Updated admin task:', data);
    return data;
  } catch (error) {
    console.error('[Admin Task Service] Error updating admin task:', error);
    throw error;
  }
}

/**
 * Adds assignees to an existing admin task
 * 
 * @param taskId - UUID of the admin task
 * @param assigneeData - Array of user IDs to assign
 * @returns Updated admin task with added_users and skipped_users arrays
 */
export async function addAssignees(
  taskId: string,
  assigneeData: AddAssigneesRequest
): Promise<AddAssigneesResponse> {
  try {
    const url = buildApiUrl(ADMIN_TASK_ENDPOINTS.addAssignees(taskId));

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(assigneeData),
    });

    const data = await response.json();
    console.log('[Admin Task Service] Added assignees:', data);
    return data;
  } catch (error) {
    console.error('[Admin Task Service] Error adding assignees:', error);
    throw error;
  }
}

/**
 * Removes assignees from an admin task
 * 
 * @param taskId - UUID of the admin task
 * @param assigneeData - Array of user IDs to remove
 * @returns Updated admin task with removed_users array
 */
export async function removeAssignees(
  taskId: string,
  assigneeData: RemoveAssigneesRequest
): Promise<RemoveAssigneesResponse> {
  try {
    const url = buildApiUrl(ADMIN_TASK_ENDPOINTS.removeAssignees(taskId));

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(assigneeData),
    });

    const data = await response.json();
    console.log('[Admin Task Service] Removed assignees:', data);
    return data;
  } catch (error) {
    console.error('[Admin Task Service] Error removing assignees:', error);
    throw error;
  }
}

/**
 * Deletes an admin task
 * Also deletes all linked todos (CASCADE)
 * 
 * @param taskId - UUID of the admin task to delete
 */
export async function deleteAdminTask(taskId: string): Promise<void> {
  try {
    const url = buildApiUrl(ADMIN_TASK_ENDPOINTS.detail(taskId));

    await makeAuthenticatedRequest(url, {
      method: 'DELETE',
    });

    console.log('[Admin Task Service] Deleted admin task:', taskId);
  } catch (error) {
    console.error('[Admin Task Service] Error deleting admin task:', error);
    throw error;
  }
}

// ============================================================================
// Export all functions
// ============================================================================

export const adminTaskService = {
  assignTask,
  listAdminTasks,
  getAdminTask,
  updateAdminTask,
  addAssignees,
  removeAssignees,
  deleteAdminTask,
};

export default adminTaskService;
