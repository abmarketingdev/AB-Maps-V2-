/**
 * Token Synchronization Utility
 * Syncs tokens between dashboard (auth_tokens) and maps app (emp_accessToken)
 */

const DASHBOARD_TOKEN_KEY = 'auth_tokens';
const DASHBOARD_USER_KEY = 'user_data';
const MAPS_ACCESS_KEY = 'emp_accessToken';
const MAPS_REFRESH_KEY = 'emp_refreshToken';

/**
 * Sync tokens from dashboard format to maps format
 */
export function syncTokensFromDashboard() {
  try {
    const authTokens = localStorage.getItem(DASHBOARD_TOKEN_KEY);
    if (!authTokens) {
      console.log('[TokenSync] No dashboard tokens found');
      return false;
    }

    const tokens = JSON.parse(authTokens);
    if (tokens.access) {
      localStorage.setItem(MAPS_ACCESS_KEY, tokens.access);
      console.log('[TokenSync] Synced access token from dashboard');
    }
    if (tokens.refresh) {
      localStorage.setItem(MAPS_REFRESH_KEY, tokens.refresh);
      console.log('[TokenSync] Synced refresh token from dashboard');
    }
    return true;
  } catch (error) {
    console.error('[TokenSync] Error syncing from dashboard:', error);
    return false;
  }
}

/**
 * Sync tokens from maps format to dashboard format
 */
export function syncTokensToDashboard() {
  try {
    const accessToken = localStorage.getItem(MAPS_ACCESS_KEY);
    const refreshToken = localStorage.getItem(MAPS_REFRESH_KEY);
    
    if (!accessToken) {
      console.log('[TokenSync] No maps access token found');
      return false;
    }

    const tokens = {
      access: accessToken,
      refresh: refreshToken || null
    };
    
    localStorage.setItem(DASHBOARD_TOKEN_KEY, JSON.stringify(tokens));
    console.log('[TokenSync] Synced tokens to dashboard format');
    return true;
  } catch (error) {
    console.error('[TokenSync] Error syncing to dashboard:', error);
    return false;
  }
}

/**
 * Get access token (checks both locations)
 */
export function getAccessToken() {
  // First check maps format
  let token = localStorage.getItem(MAPS_ACCESS_KEY);
  
  // If not found, check dashboard format and sync
  if (!token) {
    const authTokens = localStorage.getItem(DASHBOARD_TOKEN_KEY);
    if (authTokens) {
      try {
        const tokens = JSON.parse(authTokens);
        if (tokens.access) {
          token = tokens.access;
          // Sync to maps format for future use
          localStorage.setItem(MAPS_ACCESS_KEY, token);
        }
      } catch (error) {
        console.error('[TokenSync] Error parsing dashboard tokens:', error);
      }
    }
  }
  
  return token;
}

/**
 * Get refresh token (checks both locations)
 */
export function getRefreshToken() {
  // First check maps format
  let token = localStorage.getItem(MAPS_REFRESH_KEY);
  
  // If not found, check dashboard format and sync
  if (!token) {
    const authTokens = localStorage.getItem(DASHBOARD_TOKEN_KEY);
    if (authTokens) {
      try {
        const tokens = JSON.parse(authTokens);
        if (tokens.refresh) {
          token = tokens.refresh;
          // Sync to maps format for future use
          localStorage.setItem(MAPS_REFRESH_KEY, token);
        }
      } catch (error) {
        console.error('[TokenSync] Error parsing dashboard tokens:', error);
      }
    }
  }
  
  return token;
}

/**
 * Update access token in both locations
 */
export function updateAccessToken(newToken) {
  localStorage.setItem(MAPS_ACCESS_KEY, newToken);
  
  // Also update dashboard format
  const authTokens = localStorage.getItem(DASHBOARD_TOKEN_KEY);
  if (authTokens) {
    try {
      const tokens = JSON.parse(authTokens);
      tokens.access = newToken;
      localStorage.setItem(DASHBOARD_TOKEN_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error('[TokenSync] Error updating dashboard tokens:', error);
    }
  }
}

/**
 * Update refresh token in both locations
 */
export function updateRefreshToken(newToken) {
  localStorage.setItem(MAPS_REFRESH_KEY, newToken);
  
  // Also update dashboard format
  const authTokens = localStorage.getItem(DASHBOARD_TOKEN_KEY);
  if (authTokens) {
    try {
      const tokens = JSON.parse(authTokens);
      tokens.refresh = newToken;
      localStorage.setItem(DASHBOARD_TOKEN_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error('[TokenSync] Error updating dashboard tokens:', error);
    }
  }
}

/**
 * Clear all tokens from both locations
 */
export function clearAllTokens() {
  localStorage.removeItem(MAPS_ACCESS_KEY);
  localStorage.removeItem(MAPS_REFRESH_KEY);
  localStorage.removeItem(DASHBOARD_TOKEN_KEY);
  localStorage.removeItem(DASHBOARD_USER_KEY);
  console.log('[TokenSync] Cleared all tokens');
}

/**
 * Initialize token sync on app startup
 */
export function initializeTokenSync() {
  // Sync from dashboard on startup
  syncTokensFromDashboard();
  
  // Listen for storage events (cross-tab synchronization)
  window.addEventListener('storage', (e) => {
    if (e.key === DASHBOARD_TOKEN_KEY) {
      console.log('[TokenSync] Dashboard tokens updated, syncing...');
      syncTokensFromDashboard();
    }
  });
  
  // Listen for custom events (same-tab updates)
  window.addEventListener('tokenUpdated', (e) => {
    if (e.detail?.source === 'dashboard') {
      console.log('[TokenSync] Token update event received from dashboard');
      syncTokensFromDashboard();
    }
  });
}

