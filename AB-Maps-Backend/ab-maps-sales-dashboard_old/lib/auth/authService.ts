export interface LoginRequest {
  username: string;
  password: string;
  user_type?: 'manager' | 'employee';
}

export interface LoginResponse {
  refresh: string;
  access: string;
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
  expires_in: number;
}

export interface RefreshResponse {
  access: string;
  expires_in: number;
}

export interface VerificationResponse {
  valid: boolean;
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
  timestamp: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

class AuthService {
  private readonly API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ab-maps-backend-production.onrender.com';
  private readonly TOKEN_STORAGE_KEY = 'auth_tokens';
  private readonly USER_DATA_KEY = 'user_data';
  private refreshTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-refresh tokens on service initialization
    this.initializeTokenRefresh();
  }

  /**
   * Login user with username/password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Login failed: ${response.status}`);
      }

      const loginData: LoginResponse = await response.json();

      // Store tokens and user data
      this.storeTokens({
        access: loginData.access,
        refresh: loginData.refresh,
      });

      this.storeUserData({
        user_id: loginData.user_id,
        username: loginData.username,
        email: loginData.email,
        user_type: loginData.user_type,
        user_info: loginData.user_info,
      });

      // Setup automatic token refresh
      this.scheduleTokenRefresh(loginData.expires_in);

      return loginData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<RefreshResponse> {
    try {
      const tokens = this.getStoredTokens();
      if (!tokens?.refresh) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${this.API_BASE_URL}/api/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh: tokens.refresh,
        }),
      });

      if (!response.ok) {
        // If refresh fails, clear tokens and redirect to login
        this.clearAuthData();
        throw new Error('Token refresh failed');
      }

      const refreshData: RefreshResponse = await response.json();

      // Update stored access token
      this.storeTokens({
        access: refreshData.access,
        refresh: tokens.refresh, // Keep existing refresh token
      });

      // Schedule next refresh
      this.scheduleTokenRefresh(refreshData.expires_in);

      return refreshData;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearAuthData();
      throw error;
    }
  }

  /**
   * Verify token validity
   */
  async verifyToken(): Promise<VerificationResponse> {
    try {
      const tokens = this.getStoredTokens();
      if (!tokens?.access) {
        throw new Error('No access token available');
      }

      const response = await fetch(`${this.API_BASE_URL}/api/auth/verify/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokens.access}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If verification fails, try to refresh the token first
        if (response.status === 401 && tokens?.refresh) {
          console.log('Token verification failed, attempting refresh...');
          try {
            await this.refreshToken();
            // Retry verification with new token
            const newTokens = this.getStoredTokens();
            if (newTokens?.access) {
              const retryResponse = await fetch(`${this.API_BASE_URL}/api/auth/verify/`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${newTokens.access}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (retryResponse.ok) {
                const verificationData: VerificationResponse = await retryResponse.json();
                if (verificationData.valid) {
                  this.storeUserData({
                    user_id: verificationData.user_id,
                    username: verificationData.username,
                    email: verificationData.email,
                    user_type: verificationData.user_type,
                    user_info: verificationData.user_info,
                  });
                  return verificationData;
                }
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed during verification:', refreshError);
          }
        }
        throw new Error('Token verification failed');
      }

      const verificationData: VerificationResponse = await response.json();

      if (!verificationData.valid) {
        throw new Error('Token is invalid');
      }

      // Update stored user data with fresh info
      this.storeUserData({
        user_id: verificationData.user_id,
        username: verificationData.username,
        email: verificationData.email,
        user_type: verificationData.user_type,
        user_info: verificationData.user_info,
      });

      return verificationData;
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      const tokens = this.getStoredTokens();
      if (tokens?.access) {
        // Call logout endpoint to blacklist token
        await fetch(`${this.API_BASE_URL}/api/auth/logout/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.access}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local cleanup even if API call fails
    } finally {
      this.clearAuthData();
    }
  }

  /**
   * Get access token for API requests
   */
  getAccessToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.access || null;
  }

  /**
   * Get stored user data
   */
  getUserData() {
    if (typeof window === 'undefined') return null;
    
    const userData = localStorage.getItem(this.USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const tokens = this.getStoredTokens();
    return !!(tokens?.access && tokens?.refresh);
  }

  /**
   * Get authorization header for API requests
   */
  getAuthHeader(): { Authorization: string } | {} {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Store authentication tokens
   */
  private storeTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }

  /**
   * Get stored authentication tokens
   */
  private getStoredTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null;
    
    const tokens = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    return tokens ? JSON.parse(tokens) : null;
  }

  /**
   * Store user data
   */
  private storeUserData(userData: any): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
    localStorage.removeItem('jwt'); // Clear old dummy JWT
    localStorage.removeItem('role'); // Clear old role
    localStorage.removeItem('userId'); // Clear old userId
    
    // Clear all campaign-related data
    this.clearCampaignData();
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Clear all campaign-related localStorage data
   */
  private clearCampaignData(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('selectedCampaign');
    localStorage.removeItem('currentCampaign');
    localStorage.removeItem('campaign');
    localStorage.removeItem('campaigns');
    localStorage.removeItem('current_campaign');
    localStorage.removeItem('selected_campaign');
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Refresh token 5 minutes before expiry (or at 75% of expiry time)
    const refreshTime = Math.max((expiresIn * 0.75) * 1000, (expiresIn - 300) * 1000);
    
    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
        // Redirect to login on refresh failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }, refreshTime);
  }

  /**
   * Initialize token refresh on service startup
   */
  private async initializeTokenRefresh(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      if (this.isAuthenticated()) {
        // Verify current token and refresh if needed
        await this.verifyToken();
      }
    } catch (error) {
      console.error('Token initialization failed:', error);
      this.clearAuthData();
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService; 