"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  authService,
  isAdmin as isAdminType,
  isManagerLevel,
  type LoginRequest,
  type LoginResponse,
  type UserType,
  type UserInfo,
} from './authService';

interface User {
  user_id: string;
  username: string;
  email: string;
  user_type: UserType;
  user_info: UserInfo;
  is_sales_chief?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperuser: boolean;
  isCheckingSuperuser: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isSalesChief: boolean;
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Roles derived from the 4-value user_type (guide §1.1).
  const admin = isAdminType(user?.user_type);
  const isStaff = isManagerLevel(user?.user_type);
  const isSuperuser = admin;
  const isCheckingSuperuser = false;
  const isAdmin = admin;
  const isSalesChief = Boolean(user?.is_sales_chief);

  // Re-hydrate the user on app load via verify (guide §1.4).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!authService.isAuthenticated()) return;
        const v = await authService.verifyToken();
        if (!cancelled && v?.valid) {
          setUser({
            user_id: v.user_id,
            username: v.username,
            email: v.email,
            user_type: v.user_type,
            user_info: v.user_info,
            is_sales_chief: Boolean(v.is_sales_chief),
          });
        }
      } catch {
        // Token invalid/expired — clear and stay logged out.
        try { await authService.logout(); } catch { /* ignore */ }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const data = await authService.login(credentials);
      setUser({
        user_id: data.user_id,
        username: data.username,
        email: data.email,
        user_type: data.user_type,
        user_info: data.user_info,
        is_sales_chief: Boolean(data.is_sales_chief),
      });
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const refreshToken = async (): Promise<void> => {
    await authService.refreshToken();
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isSuperuser,
    isCheckingSuperuser,
    isStaff,
    isAdmin,
    isSalesChief,
    login,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
