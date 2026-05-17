"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, LoginRequest, LoginResponse } from './authService';

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
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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

  useEffect(() => {
    // Check authentication status on mount
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    setIsLoading(true);
    try {
      if (authService.isAuthenticated()) {
        // Verify current token
        const verification = await authService.verifyToken();
        setUser({
          user_id: verification.user_id,
          username: verification.username,
          email: verification.email,
          user_type: verification.user_type,
          user_info: verification.user_info,
        });
      } else {
        // Get user data from localStorage if available
        const userData = authService.getUserData();
        if (userData) {
          setUser(userData);
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
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear user even if logout API fails
      setUser(null);
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