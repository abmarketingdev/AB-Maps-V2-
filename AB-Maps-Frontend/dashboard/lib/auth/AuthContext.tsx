"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, LoginRequest, LoginResponse } from './authService';
import { checkSuperuserStatus, clearSuperuserStatusCache } from '@/services/userService';

interface User {
  user_id: string;
  username: string;
  email: string;
  user_type: 'manager' | 'employee';
  user_info: {
    id: string;
    name: string;
    email: string;
    manager_id?: string;
  };
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
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isCheckingSuperuser, setIsCheckingSuperuser] = useState(false);
  
  // isStaff is inferred from user_type === 'manager'
  // In Django, managers typically have is_staff=true
  const isStaff = user?.user_type === 'manager';
  
  // Admin requires both isSuperuser AND isStaff
  const isAdmin = isSuperuser && isStaff;

  // Derived from the auth response (login / verifyToken) which now carries
  // `is_sales_chief`. Falls back to `false` when the field is missing.
  const isSalesChief = Boolean(user?.is_sales_chief);

  // Ref to track if superuser check has been done for current user
  const superuserCheckDone = React.useRef<string | null>(null);

  useEffect(() => {
    // Check authentication status on mount
    initializeAuth();
  }, []);

  // Check superuser status when user changes
  useEffect(() => {
    const userId = user?.user_id || user?.user_info?.id || null;
    
    // Skip if already checked for this user
    if (superuserCheckDone.current === userId) {
      return;
    }

    const checkSuperuser = async () => {
      if (user && userId) {
        // Check cache first
        const cacheKey = `superuser_status_${userId}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
              setIsSuperuser(cachedData.status);
              superuserCheckDone.current = userId;
              return;
            }
          } catch (e) {
            // Invalid cache
          }
        }

        setIsCheckingSuperuser(true);
        try {
          const superuserStatus = await checkSuperuserStatus();
          setIsSuperuser(superuserStatus);
          sessionStorage.setItem(cacheKey, JSON.stringify({
            status: superuserStatus,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error('[AuthContext] Error checking superuser:', error);
          setIsSuperuser(false);
        } finally {
          setIsCheckingSuperuser(false);
          superuserCheckDone.current = userId;
        }
      } else if (!user) {
        // No user, clear superuser status
        setIsSuperuser(false);
        setIsCheckingSuperuser(false);
        superuserCheckDone.current = null;
        sessionStorage.removeItem('superuser_status');
        clearSuperuserStatusCache();
      }
    };

    checkSuperuser();
  }, [user]);

  const initializeAuth = async () => {
    setIsLoading(true);
    try {
      // Always try to verify token first if tokens exist, even if isAuthenticated() returns false
      // This ensures we get fresh user data from the backend instead of trusting localStorage
      const tokens = authService.getAccessToken();
      if (tokens) {
        try {
          // Verify current token to get fresh user data
          const verification = await authService.verifyToken();
          setUser({
            user_id: verification.user_id,
            username: verification.username,
            email: verification.email,
            user_type: verification.user_type,
            user_info: verification.user_info,
            is_sales_chief: Boolean(verification.is_sales_chief),
          });
          return; // Successfully verified, exit early
        } catch (verifyError) {
          console.warn('Token verification failed during initialization:', verifyError);
          // If verification fails, clear auth data and don't fall back to localStorage
          // This prevents using stale/corrupted user data
          await logout();
          return;
        }
      }
      
      // Only if no tokens exist at all, check localStorage as last resort
      // But this should rarely happen - if tokens don't exist, user should login
      const userData = authService.getUserData();
      if (userData) {
        console.warn('No tokens found, using localStorage user data (this should be rare)');
        // Still verify this data is valid by checking if it has required fields
        if (userData.user_type && (userData.user_type === 'manager' || userData.user_type === 'employee')) {
          setUser(userData);
        } else {
          console.error('Invalid user data in localStorage, clearing auth');
          await logout();
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Clear any invalid auth data
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);
      setUser({
        user_id: response.user_id,
        username: response.username,
        email: response.email,
        user_type: response.user_type,
        user_info: response.user_info,
        is_sales_chief: Boolean(response.is_sales_chief),
      });
      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Store userId before clearing user
      const userId = user?.user_id || user?.user_info?.id;
      
      await authService.logout();
      setUser(null);
      setIsSuperuser(false);
      
      // Clear superuser cache
      sessionStorage.removeItem('superuser_status');
      if (userId) {
        sessionStorage.removeItem(`superuser_status_${userId}`);
      }
      clearSuperuserStatusCache();
    } catch (error) {
      console.error('Logout failed:', error);
      // Store userId before clearing user
      const userId = user?.user_id || user?.user_info?.id;
      
      // Clear user even if logout API fails
      setUser(null);
      setIsSuperuser(false);
      
      // Clear superuser cache
      sessionStorage.removeItem('superuser_status');
      if (userId) {
        sessionStorage.removeItem(`superuser_status_${userId}`);
      }
      clearSuperuserStatusCache();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      await authService.refreshToken();
      // Optionally verify token after refresh to update user data
      const verification = await authService.verifyToken();
      setUser({
        user_id: verification.user_id,
        username: verification.username,
        email: verification.email,
        user_type: verification.user_type,
        user_info: verification.user_info,
        is_sales_chief: Boolean(verification.is_sales_chief),
      });
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear auth data and redirect to login
      await logout();
      throw error;
    }
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