/**
 * Authentication service for AB Maps Manager
 * Handles JWT token verification and user authentication
 */
//this one uses /api must be changed to NEXT_PUBLIC_API_URL
const API_BASE_URL = process.env.REACT_APP_API_URL;
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || '/login';

class AuthService {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
  }

  /**
   * Get JWT token from URL parameters
   */
  getTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    console.log('Token from URL:', token ? 'Present' : 'Missing');
    if (token) {
      console.log('Token length:', token.length);
      console.log('Token preview:', token.substring(0, 50) + '...');
      console.log('Full token:', token);

      // Try to decode the token to see if it's properly formatted
      try {
        const decodedToken = decodeURIComponent(token);
        console.log('Decoded token:', decodedToken);
        const parsedToken = JSON.parse(decodedToken);
        console.log('Parsed token object:', parsedToken);
        console.log('Access token from parsed object:', parsedToken.access ? 'Present' : 'Missing');
      } catch (error) {
        console.error('Error decoding/parsing token:', error);
      }
    }
    return token;
  }

  /**
   * Get campaign ID from URL parameters
   */
  getCampaignIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const campaignId = urlParams.get('campaign_id');
    console.log('Full URL search params:', window.location.search);
    console.log('All URL params:', Object.fromEntries(urlParams.entries()));
    console.log('Campaign ID from URL:', campaignId ? campaignId : 'Missing');
    return campaignId;
  }

  /**
   * Parse stored tokens from localStorage
   */
  parseStoredTokens(tokenString) {
    try {
      if (!tokenString) return null;

      // First, try to decode the URL-encoded string
      let decodedString = tokenString;
      try {
        decodedString = decodeURIComponent(tokenString);
        console.log('URL decoded string:', decodedString);
      } catch (decodeError) {
        console.log('URL decode failed, using original string');
      }

      const tokens = JSON.parse(decodedString);
      console.log('Successfully parsed tokens object:', tokens);
      return tokens;
    } catch (error) {
      console.error('Error parsing stored tokens:', error);
      return null;
    }
  }

  /**
   * Verify JWT token with backend
   */
  async verifyToken(token) {
    try {
      const verifyUrl = `${API_BASE_URL}/auth/verify-public/`;
      console.log('Verifying token with backend:', verifyUrl);
      console.log('Token being verified:', token ? token.substring(0, 50) + '...' : 'null');
      console.log('Full token for verification:', token);

      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Verification response status:', response.status);
      console.log('Verification response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Verification failed with status:', response.status);
        console.error('Verification error response:', errorText);
        throw new Error(`Token verification failed: ${response.status} - ${errorText}`);
      }

      const verificationData = await response.json();
      console.log('Verification successful, data:', verificationData);

      if (!verificationData.valid) {
        throw new Error('Token is invalid');
      }

      return verificationData;
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  }

  /**
   * Initialize authentication.
   * Tries URL token first (fresh open from dashboard), then falls back to
   * localStorage tokens (page refresh / navigation).
   */
  async initializeAuth() {
    try {
      console.log('=== Starting authentication initialization ===');

      // --- 1. Resolve tokens: URL first, then localStorage ---
      const tokenString = this.getTokenFromUrl();
      let tokens = null;
      let fromUrl = false;

      if (tokenString) {
        fromUrl = true;
        try {
          tokens = this.parseStoredTokens(tokenString);
        } catch {
          tokens = { access: tokenString };
        }
      }

      // Fallback: restore from localStorage (page refresh scenario)
      if (!tokens || !tokens.access) {
        console.log('[AuthService] No token in URL, checking localStorage...');
        const storedAccess = localStorage.getItem('accessToken');
        const storedRefresh = localStorage.getItem('manager_refreshToken');

        if (storedRefresh) {
          // Refresh token available -- get a fresh access token
          console.log('[AuthService] Refreshing token from localStorage refresh token...');
          try {
            const { refreshManagerToken } = await import('../utils/tokenRefresh');
            const freshAccess = await refreshManagerToken();
            tokens = { access: freshAccess, refresh: storedRefresh };
          } catch (refreshErr) {
            console.error('[AuthService] Token refresh failed:', refreshErr);
            // Last resort: try the stored access token (may still be valid)
            if (storedAccess) {
              tokens = { access: storedAccess, refresh: storedRefresh };
            }
          }
        } else if (storedAccess) {
          tokens = { access: storedAccess };
        }
      }

      if (!tokens || !tokens.access) {
        throw new Error('No token available (URL or localStorage)');
      }

      // --- 2. Resolve campaign ID: URL first, then localStorage ---
      let campaignId = this.getCampaignIdFromUrl();
      if (campaignId) {
        let shouldOverwrite = true;
        const stored = localStorage.getItem('currentCampaign');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id === campaignId) shouldOverwrite = false;
          } catch {
            if (stored === campaignId) shouldOverwrite = false;
          }
        }
        if (shouldOverwrite) {
          localStorage.setItem('currentCampaign', campaignId);
        }
      } else {
        // On page refresh, campaign ID is already in localStorage
        campaignId = localStorage.getItem('currentCampaign');
        if (campaignId) {
          try { campaignId = JSON.parse(campaignId)?.id || campaignId; } catch { /* use as-is */ }
        }
      }

      // --- 3. Clean URL params after extracting tokens ---
      if (fromUrl) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('token');
        cleanUrl.searchParams.delete('campaign_id');
        window.history.replaceState({}, '', cleanUrl.toString());
        console.log('[AuthService] Cleaned tokens from URL');
      }

      // --- 4. Verify token with backend ---
      console.log('[AuthService] Verifying token with backend...');
      const verificationData = await this.verifyToken(tokens.access);

      // --- 5. Set user data ---
      this.user = {
        user_id: verificationData.user_id,
        username: verificationData.username,
        email: verificationData.email,
        user_type: verificationData.user_type,
        user_info: verificationData.user_info,
        accessToken: tokens.access,
        campaignId: campaignId,
      };

      this.isAuthenticated = true;
      this.accessToken = tokens.access;
      localStorage.setItem('accessToken', tokens.access);

      if (tokens.refresh) {
        localStorage.setItem('manager_refreshToken', tokens.refresh);
      }

      console.log('=== Authentication initialization completed successfully ===');
      console.log('Is authenticated:', this.isAuthenticated);
      console.log('Campaign ID:', campaignId);
      console.log('Source:', fromUrl ? 'URL' : 'localStorage');

      return this.user;
    } catch (error) {
      console.error('=== Authentication initialization failed ===');
      console.error('Error details:', error);
      this.user = null;
      this.isAuthenticated = false;
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  /**
   * Get access token for API calls.
   * Checks in-memory first, then falls back to localStorage where
   * refreshManagerToken() writes the refreshed token.
   */
  getAccessToken() {
    if (this.accessToken) return this.accessToken;
    const stored = localStorage.getItem('accessToken');
    if (stored) {
      this.accessToken = stored;
    }
    return this.accessToken;
  }

  /**
   * Update the in-memory access token (called after a successful refresh).
   */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Get campaign ID
   */
  getCampaignId() {
    return this.user?.campaignId || localStorage.getItem('currentCampaign');
  }

  /**
   * Logout user
   */
  logout() {
    this.user = null;
    this.isAuthenticated = false;
    this.accessToken = null;

    // Check if we're in a popup/iframe
    if (window.opener) {
      // If opened from sales dashboard, close this window
      window.close();
    } else {
      // Otherwise redirect to login
      window.location.href = LOGIN_URL;
    }
  }

  /**
   * Check if user is a manager
   */
  isManager() {
    return this.user && this.user.user_type === 'manager';
  }

  /**
   * Check if user is an employee
   */
  isEmployee() {
    return this.user && this.user.user_type === 'employee';
  }

  /**
   * Check if user is an admin
   */
  isAdmin() {
    return this.user && this.user.user_type === 'admin';
  }

  /**
   * Check if current user is a superuser
   * Uses the dedicated superuser check endpoint with caching
   * @returns {Promise<boolean>} True if user is superuser
   */
  async checkSuperuser() {
    try {
      // DEV MODE: Uncomment to force superuser for testing
      // if (process.env.NODE_ENV === 'development') {
      //   console.log('🔧 [AuthService] DEV MODE: Forcing superuser = true');
      //   return true;
      // }

      const token = this.getAccessToken();
      if (!token) {
        console.warn('🔴 [AuthService] No access token available for superuser check');
        return false;
      }

      // Check cache first (5 minute cache)
      const cacheKey = 'superuser_status';
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
            console.log('📦 [AuthService] Using cached superuser status:', cachedData.status);
            return cachedData.status;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }

      // Note: API_BASE_URL already includes /api, so we just append the rest
      const apiUrl = `${API_BASE_URL}/users/users/check_superuser/`;
      console.log('🔍 [AuthService] Checking superuser status...', { apiUrl, tokenLength: token?.length });
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json',
        },
      });

      console.log('📡 [AuthService] Superuser API response:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText 
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        console.warn('🔴 [AuthService] Superuser check failed:', { 
          status: response.status, 
          error: errorText 
        });
        return false;
      }

      const data = await response.json();
      console.log('📋 [AuthService] Superuser API data:', data);
      
      const isSuperuser = data.is_superuser || false;

      // Cache the result
      sessionStorage.setItem(cacheKey, JSON.stringify({
        status: isSuperuser,
        timestamp: Date.now()
      }));

      console.log(isSuperuser ? '✅ [AuthService] SUPERUSER = TRUE' : '❌ [AuthService] SUPERUSER = FALSE');
      return isSuperuser;
    } catch (error) {
      console.error('🔴 [AuthService] Error checking superuser status:', error);
      return false;
    }
  }

  /**
   * Clear the superuser status cache
   * Call this when user logs out or token changes
   */
  clearSuperuserCache() {
    sessionStorage.removeItem('superuser_status');
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService; 