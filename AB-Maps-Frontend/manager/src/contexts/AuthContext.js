import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import authService from '../services/authService';
import { refreshManagerToken, handleAuthFailure } from '../utils/tokenRefresh';

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
  const refreshTimerRef = useRef(null);

  /**
   * Schedule a proactive token refresh before expiry.
   * Uses remaining time until exp (not iat) to avoid drift issues.
   */
  const scheduleTokenRefresh = (token) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const timeUntilExpiry = exp - Date.now();

      if (timeUntilExpiry <= 0) {
        console.warn('[AuthContext] Token already expired, refreshing now');
        doRefresh();
        return;
      }

      const delay = Math.max(Math.floor(timeUntilExpiry * 0.75), 10000);
      console.log(`[AuthContext] Scheduling proactive token refresh in ${Math.round(delay / 1000)}s (expires in ${Math.round(timeUntilExpiry / 1000)}s)`);

      refreshTimerRef.current = setTimeout(doRefresh, delay);
    } catch (err) {
      console.error('[AuthContext] Failed to decode token for refresh scheduling:', err);
    }
  };

  const doRefresh = async () => {
    try {
      const newToken = await refreshManagerToken();
      console.log('[AuthContext] Proactive token refresh succeeded');
      scheduleTokenRefresh(newToken);
    } catch (err) {
      console.error('[AuthContext] Proactive token refresh failed:', err);
      handleAuthFailure();
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const userData = await authService.initializeAuth();
        setUser(userData);
        scheduleTokenRefresh(authService.getAccessToken());
      } catch (err) {
        console.error('Authentication failed:', err);
        setError(err.message);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []);

  const logout = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
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