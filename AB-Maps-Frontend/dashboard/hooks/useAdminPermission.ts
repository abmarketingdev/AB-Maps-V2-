/**
 * useAdminPermission Hook
 * 
 * Custom hook to check if the current user has admin permissions.
 * Admin requires: is_superuser=true AND is_staff=true
 * 
 * @returns { isAdmin: boolean, isLoading: boolean }
 */

import { useAuth } from '@/lib/auth/AuthContext';

export interface UseAdminPermissionReturn {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if current user is an admin
 * Admin requires both isSuperuser AND isStaff
 * 
 * @example
 * ```tsx
 * const { isAdmin, isLoading } = useAdminPermission();
 * 
 * if (isLoading) return <Loading />;
 * if (!isAdmin) return <Unauthorized />;
 * 
 * return <AdminContent />;
 * ```
 */
export function useAdminPermission(): UseAdminPermissionReturn {
  const { isAdmin, isLoading, isCheckingSuperuser } = useAuth();

  return {
    isAdmin: isAdmin || false,
    isLoading: isLoading || isCheckingSuperuser,
  };
}

export default useAdminPermission;
