import { authService } from "@/lib/auth/authService";

export interface SuperuserCheckResponse {
  is_superuser: boolean;
}

// Cache for superuser status
let superuserStatusCache: { [token: string]: { status: boolean; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if the current user is a superuser
 * Uses the dedicated superuser check endpoint with caching
 */
export const checkSuperuserStatus = async (): Promise<boolean> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Check cache first
    const cached = superuserStatusCache[token];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.status;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/users/check_superuser/`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: SuperuserCheckResponse = await response.json();
    
    // Cache the result
    superuserStatusCache[token] = {
      status: data.is_superuser,
      timestamp: Date.now()
    };
    
    return data.is_superuser;
  } catch (error) {
    console.error('Error checking superuser status:', error);
    return false;
  }
};

/**
 * Clear the superuser status cache
 * Call this when user logs out or token changes
 */
export const clearSuperuserStatusCache = (): void => {
  superuserStatusCache = {};
};

// ============================================================================
// User List Types
// ============================================================================

/**
 * User that can be assigned to admin tasks
 */
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

// ============================================================================
// User List Functions
// ============================================================================

/**
 * Fetches list of managers that can be assigned tasks
 * The managers table already includes admins (is_superuser + is_staff)
 * 
 * @returns Array of users that can be assigned tasks
 */
export async function fetchManagersAndAdmins(): Promise<AssignableUser[]> {
  const token = authService.getAccessToken();
  if (!token) {
    throw new Error('No authentication token available');
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const response = await fetch(`${apiBase}/api/users/managers/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch managers: ${response.status}`);
  }

  const data = await response.json();
  const managers: any[] = Array.isArray(data) ? data : (data.results || []);

  return managers.map((m) => {
    // Use the actual database id field (primary key)
    const userId = m.id;
    if (!userId) {
      console.warn('Manager missing id field:', m);
    }
    
    return {
      id: userId, // This is the database primary key that the backend expects
      user_id: m.user_id || userId, // Keep for compatibility
      username: m.username,
      email: m.email,
      name: m.name || (m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username),
      first_name: m.first_name,
      last_name: m.last_name,
      user_type: 'manager' as const,
    };
  }).filter(u => u.id); // Filter out any entries without an id
} 