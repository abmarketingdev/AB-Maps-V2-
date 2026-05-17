"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredUserType?: 'manager' | 'employee';
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredUserType,
  redirectTo = '/login',
}) => {
  const { user, isAuthenticated, isLoading, isSuperuser } = useAuth();
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

    // Superusers can access any page
    if (isSuperuser) return;

    // Check user type if required
    if (requiredUserType && user && user.user_type !== requiredUserType) {
      hasRedirected.current = true;
      router.push('/unauthorized');
      return;
    }
  }, [isAuthenticated, isLoading, user, requiredUserType, redirectTo, router, isSuperuser]);

  // Show loading or nothing while checking auth
  if (isLoading) {
    return <>{children}</>;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Render content
  return <>{children}</>;
};

export default ProtectedRoute; 