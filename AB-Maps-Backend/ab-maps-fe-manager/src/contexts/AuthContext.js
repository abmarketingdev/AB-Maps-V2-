import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const userData = await authService.initializeAuth();
      setUser(userData);
    } catch (error) {
      console.error('Authentication failed:', error);
      setError(error.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value = {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    logout,
    isManager: authService.isManager(),
    isEmployee: authService.isEmployee(),
    isAdmin: authService.isAdmin(),
    campaignId: authService.getCampaignId(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 