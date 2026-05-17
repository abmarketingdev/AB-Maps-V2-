/**
 * User Promotion Service - API Integration
 * 
 * This service handles all API interactions for user role promotions.
 * It includes promoting employees to managers, managers to superusers,
 * and demoting superusers to managers.
 * 
 * Requires: User must have is_superuser=true
 */

import { adminAuthService } from "@/lib/auth/adminAuthService";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Request interface for promoting an employee to manager
 */
export interface PromoteEmployeeToManagerRequest {
  employee_id: string;
  reason?: string;
}

/**
 * Request interface for promoting a manager to superuser
 */
export interface PromoteManagerToSuperuserRequest {
  manager_id: string;
  reason?: string;
}

/**
 * Request interface for demoting a superuser to manager
 */
export interface PromoteSuperuserToManagerRequest {
  manager_id: string;
  reason?: string;
}

/**
 * Manager data structure returned in promotion responses
 */
export interface ManagerData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at?: string;
}

/**
 * Migrated records count structure
 */
export interface MigratedRecords {
  addresses: number;
  area_assignments: number;
  campaign_assignments: number;
  activities: number;
  sales: number;
  performance_metrics: number;
  dashboard_summaries: number;
  location_pings: number;
  buildings: number;
  analytics_thresholds: number;
  campaign_forms: number;
  team_members: number;
}

/**
 * Permissions structure
 */
export interface Permissions {
  is_staff: boolean;
  is_superuser: boolean;
}

/**
 * Success response for employee to manager promotion
 */
export interface PromoteEmployeeToManagerResponse {
  success: true;
  message: string;
  data: {
    user_id: string;
    old_employee_id: string;
    new_manager_id: string;
    manager: ManagerData;
    migrated_records: MigratedRecords;
    promoted_at: string;
    promoted_by: string;
    reason?: string;
  };
}

/**
 * Success response for manager to superuser promotion
 */
export interface PromoteManagerToSuperuserResponse {
  success: true;
  message: string;
  data: {
    user_id: string;
    manager_id: string;
    manager: ManagerData;
    permissions: Permissions;
    promoted_at: string;
    promoted_by: string;
    reason?: string;
  };
}

/**
 * Success response for superuser to manager demotion
 */
export interface DemoteSuperuserToManagerResponse {
  success: true;
  message: string;
  data: {
    user_id: string;
    manager_id: string;
    manager: ManagerData;
    permissions: Permissions;
    demoted_at: string;
    demoted_by: string;
    reason?: string;
  };
}

/**
 * Error response structure
 */
export interface PromotionErrorResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * Union type for all promotion responses
 */
export type PromotionResponse =
  | PromoteEmployeeToManagerResponse
  | PromoteManagerToSuperuserResponse
  | DemoteSuperuserToManagerResponse;

/**
 * Custom error class for promotion errors
 */
export class PromotionError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "PromotionError";
  }
}

// ============================================================================
// Error Code Mapping
// ============================================================================

const ERROR_CODE_MESSAGES: Record<string, string> = {
  PERMISSION_DENIED: "You don't have permission to perform this action. Only superusers can promote users.",
  MISSING_EMPLOYEE_ID: "Invalid employee selected. Please try again.",
  MISSING_MANAGER_ID: "Invalid manager selected. Please try again.",
  PROMOTION_ERROR: "An error occurred during promotion.",
  ALREADY_SUPERUSER: "This manager is already a superuser.",
  NOT_SUPERUSER: "This manager is not a superuser and cannot be demoted.",
  SELF_DEMOTION_FORBIDDEN: "You cannot demote yourself. Please ask another superuser.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
};

/**
 * Get user-friendly error message from error code
 */
export const getErrorMessage = (code: string): string => {
  return ERROR_CODE_MESSAGES[code] || "An unexpected error occurred. Please try again.";
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Promote an employee to manager
 * 
 * @param employeeId - The UUID of the employee to promote
 * @param reason - Optional reason for the promotion (for audit trail)
 * @returns Promise resolving to the promotion response
 * @throws {PromotionError} If the promotion fails
 */
export const promoteEmployeeToManager = async (
  employeeId: string,
  reason?: string
): Promise<PromoteEmployeeToManagerResponse> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new PromotionError(
        "AUTH_ERROR",
        "No authentication token available. Please log in again."
      );
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      throw new PromotionError(
        "CONFIG_ERROR",
        "API base URL is not configured."
      );
    }

    const requestBody: PromoteEmployeeToManagerRequest = {
      employee_id: employeeId,
      ...(reason && { reason }),
    };

    const response = await fetch(
      `${apiBase}/api/users/promote-employee-to-manager/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorResponse = data as PromotionErrorResponse;
      const errorCode = errorResponse.code || "PROMOTION_ERROR";
      const errorMessage =
        errorResponse.error ||
        getErrorMessage(errorCode) ||
        `Failed to promote employee: ${response.status}`;

      throw new PromotionError(errorCode, errorMessage, response.status);
    }

    return data as PromoteEmployeeToManagerResponse;
  } catch (error) {
    if (error instanceof PromotionError) {
      throw error;
    }

    // Handle network errors or other unexpected errors
    console.error("Error promoting employee to manager:", error);
    throw new PromotionError(
      "NETWORK_ERROR",
      error instanceof Error
        ? error.message
        : "Network error. Please check your connection and try again."
    );
  }
};

/**
 * Promote a manager to superuser
 * 
 * @param managerId - The UUID of the manager to promote
 * @param reason - Optional reason for the promotion (for audit trail)
 * @returns Promise resolving to the promotion response
 * @throws {PromotionError} If the promotion fails
 */
export const promoteManagerToSuperuser = async (
  managerId: string,
  reason?: string
): Promise<PromoteManagerToSuperuserResponse> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new PromotionError(
        "AUTH_ERROR",
        "No authentication token available. Please log in again."
      );
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      throw new PromotionError(
        "CONFIG_ERROR",
        "API base URL is not configured."
      );
    }

    const requestBody: PromoteManagerToSuperuserRequest = {
      manager_id: managerId,
      ...(reason && { reason }),
    };

    const response = await fetch(
      `${apiBase}/api/users/promote-manager-to-superuser/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorResponse = data as PromotionErrorResponse;
      const errorCode = errorResponse.code || "PROMOTION_ERROR";
      const errorMessage =
        errorResponse.error ||
        getErrorMessage(errorCode) ||
        `Failed to promote manager: ${response.status}`;

      throw new PromotionError(errorCode, errorMessage, response.status);
    }

    return data as PromoteManagerToSuperuserResponse;
  } catch (error) {
    if (error instanceof PromotionError) {
      throw error;
    }

    // Handle network errors or other unexpected errors
    console.error("Error promoting manager to superuser:", error);
    throw new PromotionError(
      "NETWORK_ERROR",
      error instanceof Error
        ? error.message
        : "Network error. Please check your connection and try again."
    );
  }
};

/**
 * Demote a superuser to manager
 * 
 * @param managerId - The UUID of the superuser to demote
 * @param reason - Optional reason for the demotion (for audit trail)
 * @returns Promise resolving to the demotion response
 * @throws {PromotionError} If the demotion fails
 */
export const demoteSuperuserToManager = async (
  managerId: string,
  reason?: string
): Promise<DemoteSuperuserToManagerResponse> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new PromotionError(
        "AUTH_ERROR",
        "No authentication token available. Please log in again."
      );
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      throw new PromotionError(
        "CONFIG_ERROR",
        "API base URL is not configured."
      );
    }

    const requestBody: PromoteSuperuserToManagerRequest = {
      manager_id: managerId,
      ...(reason && { reason }),
    };

    const response = await fetch(
      `${apiBase}/api/users/demote-superuser-to-manager/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorResponse = data as PromotionErrorResponse;
      const errorCode = errorResponse.code || "PROMOTION_ERROR";
      const errorMessage =
        errorResponse.error ||
        getErrorMessage(errorCode) ||
        `Failed to demote superuser: ${response.status}`;

      throw new PromotionError(errorCode, errorMessage, response.status);
    }

    return data as DemoteSuperuserToManagerResponse;
  } catch (error) {
    if (error instanceof PromotionError) {
      throw error;
    }

    // Handle network errors or other unexpected errors
    console.error("Error demoting superuser to manager:", error);
    throw new PromotionError(
      "NETWORK_ERROR",
      error instanceof Error
        ? error.message
        : "Network error. Please check your connection and try again."
    );
  }
};
