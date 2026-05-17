/**
 * Centralized Token Refresh Utility
 * Handles automatic token refresh with rate limiting
 */

import { getRefreshToken, updateAccessToken, updateRefreshToken } from './tokenSync';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;

// Cross-tab refresh coordination keys
const REFRESH_STATE_KEY = 'emp_refresh_state';
const REFRESH_RESULT_KEY = 'emp_refresh_result';
const REFRESH_STALE_MS = 120000; // 2 minutes safety window
const tabId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// In-memory lock for the current tab/runtime
let isRefreshing = false;
let refreshPromise = null;

/**
 * Wait for another tab's refresh to finish by listening to storage updates.
 */
function waitForSharedRefresh() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + REFRESH_STALE_MS;

    const handleResult = (value) => {
      if (!value) return;
      try {
        const data = JSON.parse(value);
        if (!data.ts || Date.now() - data.ts > REFRESH_STALE_MS) return;

        // Consume the result once
        localStorage.removeItem(REFRESH_RESULT_KEY);

        if (!data.ok) {
          reject(new Error(data.error || 'Refresh failed in another tab'));
          return;
        }

        if (data.access) updateAccessToken(data.access);
        if (data.refresh) updateRefreshToken(data.refresh);
        resolve(data.access);
      } catch (err) {
        // If parsing fails, just ignore and keep waiting
      }
    };

    const onStorage = (event) => {
      if (event.key === REFRESH_RESULT_KEY) {
        handleResult(event.newValue);
      }
    };

    // Prime with any existing result in case it was already written
    handleResult(localStorage.getItem(REFRESH_RESULT_KEY));

    window.addEventListener('storage', onStorage);

    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        window.removeEventListener('storage', onStorage);
        clearInterval(timer);
        reject(new Error('Shared refresh timed out'));
      }
    }, 500);

    // Clean up once resolved/rejected
    const cleanup = () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(timer);
    };

    const wrap = (fn) => (value) => {
      cleanup();
      return fn(value);
    };

    resolve = wrap(resolve);
    reject = wrap(reject);
  });
}

/**
 * Refresh access token using refresh token
 * @returns {Promise<string>} New access token
 * @throws {Error} If refresh fails
 */
export async function refreshAccessToken() {
  // If this tab is already refreshing, share that promise
  if (isRefreshing && refreshPromise) {
    console.log('[TokenRefresh] Already refreshing in this tab, waiting...');
    return refreshPromise;
  }

  // If another tab is refreshing, wait for its result
  try {
    const state = localStorage.getItem(REFRESH_STATE_KEY);
    if (state) {
      const parsed = JSON.parse(state);
      if (parsed.state === 'in_progress' && Date.now() - parsed.ts < REFRESH_STALE_MS) {
        console.log('[TokenRefresh] Another tab is refreshing, waiting for shared result...');
        return await waitForSharedRefresh();
      }
    }
  } catch {/* ignore parse errors */}

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Mark shared state so other tabs wait
      localStorage.setItem(REFRESH_STATE_KEY, JSON.stringify({ state: 'in_progress', ts: Date.now(), owner: tabId }));

      console.log('[TokenRefresh] Refreshing access token...');
      
      const response = await fetch(`${API_BASE_URL}/api/users/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TokenRefresh] Refresh failed:', response.status, errorData);
        const error = new Error(
          errorData.detail || 
          `Token refresh failed: ${response.status}. Please login again.`
        );
        // Broadcast failure so waiters can unblock
        localStorage.setItem(REFRESH_RESULT_KEY, JSON.stringify({ ok: false, error: error.message, ts: Date.now(), owner: tabId }));
        throw error;
      }

      const data = await response.json();
      
      // Update access token in both storage locations
      updateAccessToken(data.access);
      
      // If backend returns new refresh token (token rotation), update it
      if (data.refresh) {
        updateRefreshToken(data.refresh);
      }
      
      console.log('[TokenRefresh] Token refreshed successfully');

      // Broadcast success for other tabs
      localStorage.setItem(REFRESH_RESULT_KEY, JSON.stringify({ ok: true, access: data.access, refresh: data.refresh || null, ts: Date.now(), owner: tabId }));
      return data.access;
    } catch (error) {
      console.error('[TokenRefresh] Error refreshing token:', error);
      throw error;
    } finally {
      localStorage.removeItem(REFRESH_STATE_KEY);
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

/**
 * Check if token needs refresh (within 5 minutes of expiry)
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token should be refreshed
 */
export function shouldRefreshToken(token) {
  if (!token) return false;
  
  try {
    // Decode JWT payload (base64)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = exp - now;
    
    // Refresh if token expires within 5 minutes
    return timeUntilExpiry < 5 * 60 * 1000;
  } catch (error) {
    console.error('[TokenRefresh] Error checking token expiry:', error);
    return false;
  }
}

/**
 * Verify token is valid
 * @param {string} token - JWT token to verify
 * @returns {Promise<boolean>} True if token is valid
 */
export async function verifyToken(token) {
  if (!token) return false;
  
  try {
    const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${API_BASE_URL}/api/users/auth/verify-public/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('[TokenRefresh] Error verifying token:', error);
    return false;
  }
}
