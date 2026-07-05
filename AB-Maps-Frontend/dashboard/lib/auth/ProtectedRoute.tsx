"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

// Role context handed to a custom `allow` predicate so a page can express an
// access rule richer than a single user_type (e.g. "admins OR sales-chiefs").
export interface AllowCtx {
  isAdmin: boolean;
  isSuperuser: boolean;
  isSalesChief: boolean;
  isStaff: boolean;
  user: { user_type: string } | null;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredUserType?: 'manager' | 'employee';
  /**
   * Optional role predicate. When provided it fully governs authorization
   * (evaluated AFTER auth passes) and takes precedence over requiredUserType —
   * a superuser is NOT auto-allowed, so the predicate must include them itself.
   */
  allow?: (ctx: AllowCtx) => boolean;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredUserType,
  allow,
  redirectTo = '/login',
}) => {
  const { user, isAuthenticated, isLoading, isSuperuser, isAdmin, isSalesChief, isStaff } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // Prevent multiple redirects
    if (hasRedirected.current) return;

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
      hasRedirected.current = true;
      router.push(redirectTo);
      return;
    }

    // Custom role predicate wins when supplied (governs superusers too).
    if (allow) {
      const ok = allow({ isAdmin, isSuperuser, isSalesChief, isStaff, user: user ? { user_type: user.user_type } : null });
      if (!ok) {
        hasRedirected.current = true;
        router.push('/unauthorized');
      }
      return;
    }

    // Superusers can access any page
    if (isSuperuser) return;

    // Check user type if required
    if (requiredUserType && user && user.user_type !== requiredUserType) {
      hasRedirected.current = true;
      router.push('/unauthorized');
      return;
    }
  }, [isAuthenticated, isLoading, user, requiredUserType, allow, redirectTo, router, isSuperuser, isAdmin, isSalesChief, isStaff]);

  // Show loading or nothing while checking auth
  if (isLoading) {
    return <>{children}</>;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Role predicate failed — render nothing while the redirect fires (no content flash).
  if (allow && !allow({ isAdmin, isSuperuser, isSalesChief, isStaff, user: user ? { user_type: user.user_type } : null })) {
    return null;
  }

  // Render content
  return <>{children}</>;
};

export default ProtectedRoute; 