/**
 * API Interceptor with Automatic Token Refresh
 * Wraps fetch to handle 401 errors and token refresh
 */

import { getAccessToken, syncTokensFromDashboard } from './tokenSync';
import { refreshAccessToken } from './tokenRefresh';

/**
 * Fetch with automatic token refresh on 401
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {number} retryCount - Internal retry counter
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithAuthRefresh(url, options = {}, retryCount = 0) {
  // Get current access token
  let token = getAccessToken();
  
  // If no token found, try syncing from dashboard storage one more time
  if (!token) {
    syncTokensFromDashboard();
    token = getAccessToken();
  }

  if (!token) {
    throw new Error('No access token available. Please login.');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If 401 and we haven't retried yet, try to refresh token
  if (response.status === 401 && retryCount === 0) {
    console.log('[APIInterceptor] 401 error, attempting token refresh...');
    
    try {
      // Refresh token
      const newToken = await refreshAccessToken();
      
      // Retry original request with new token
      console.log('[APIInterceptor] Retrying request with new token...');
      return fetchWithAuthRefresh(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      }, retryCount + 1);
    } catch (refreshError) {
      console.error('[APIInterceptor] Token refresh failed:', refreshError);
      
      // DON'T redirect to login - let the UI handle showing "session expired"
      // Redirecting on any failure causes unexpected logouts on temporary network issues
      throw new Error('Token refresh failed. Please login again.');
    }
  }
  
  // If still 401 after refresh, or other errors
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API call failed: ${response.status} - ${errorText}`);
  }
  
  return response;
}

