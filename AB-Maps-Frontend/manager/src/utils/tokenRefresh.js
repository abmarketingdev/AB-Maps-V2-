/**
 * Centralized Token Refresh for Manager App
 * Uses a lock pattern to prevent multiple simultaneous refresh calls.
 * All WebSocket services should use this instead of inline refresh logic.
 */

import authService from '../services/authService';

const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || '/login';

let isRefreshing = false;
let refreshPromise = null;

/**
 * Refresh the manager access token using the stored refresh token.
 * Concurrent callers share the same in-flight promise.
 * After refresh, both localStorage AND authService.accessToken are updated
 * so all HTTP services see the new token immediately.
 * @returns {Promise<string>} New access token
 */
export async function refreshManagerToken() {
  if (isRefreshing && refreshPromise) {
    console.log('[ManagerTokenRefresh] Already refreshing, waiting...');
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('manager_refreshToken');
      if (!refreshToken) {
        throw new Error('No manager refresh token available');
      }

      const API_BASE_URL = process.env.REACT_APP_API_URL;
      if (!API_BASE_URL) {
        throw new Error('API_BASE_URL not configured');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.access);
      authService.setAccessToken(data.access);
      if (data.refresh) {
        localStorage.setItem('manager_refreshToken', data.refresh);
      }

      console.log('[ManagerTokenRefresh] Token refreshed successfully');
      return data.access;
    } catch (error) {
      console.error('[ManagerTokenRefresh] Refresh failed:', error);
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Check if a JWT token is expired or near expiry (within 5 minutes).
 * @param {string} token - JWT token
 * @returns {boolean}
 */
export function shouldRefreshManagerToken(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return (exp - Date.now()) < 5 * 60 * 1000;
  } catch {
    return true;
  }
}

/**
 * Handle auth failure: redirect to login or close popup window.
 */
export function handleAuthFailure() {
  if (window.opener) {
    window.close();
  } else {
    window.location.href = LOGIN_URL;
  }
}
