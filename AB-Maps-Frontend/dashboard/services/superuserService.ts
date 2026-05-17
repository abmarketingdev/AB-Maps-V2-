import { adminAuthService } from "@/lib/auth/adminAuthService";

export interface Superuser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  is_active: boolean;
  is_sales_chief?: boolean;
  date_joined: string;
  last_login?: string;
}

export interface CreateSuperuserRequest {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  user_type: string;
  admin_type?: string; // Optional: 'maps_admin' or 'qc_admin', defaults to 'maps_admin'
}

export interface UpdateSuperuserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  is_sales_chief?: boolean;
}

/**
 * Create a new superuser
 */
export const createSuperuser = async (payload: CreateSuperuserRequest): Promise<Superuser> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/users/create_superuser/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to create superuser: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating superuser:', error);
    throw error;
  }
};

/**
 * Get all superusers
 */
export const getSuperusers = async (): Promise<Superuser[]> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/users/superusers/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to fetch superusers: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching superusers:', error);
    throw error;
  }
};

/**
 * Update a superuser
 */
export const updateSuperuser = async (id: string, payload: UpdateSuperuserRequest): Promise<Superuser> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/users/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to update superuser: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating superuser:', error);
    throw error;
  }
};

/**
 * Delete a superuser
 */
export const deleteSuperuser = async (id: string): Promise<boolean> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/users/${id}/delete_superuser/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to delete superuser: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting superuser:', error);
    throw error;
  }
}; 