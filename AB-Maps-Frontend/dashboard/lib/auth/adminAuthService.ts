export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  refresh: string;
  access: string;
  user_id: string;
  username: string;
  email: string;
  user_type: string;
  user_info: {
    id: string;
    name: string;
    email: string;
    is_superuser: boolean;
  };
  expires_in: number;
}

export interface AdminRefreshResponse {
  access: string;
  refresh?: string;
  expires_in: number;
}

export interface AdminVerificationResponse {
  valid: boolean;
  user_id: string;
  username: string;
  email: string;
  user_type: string;
  user_info: {
    id: string;
    name: string;
    email: string;
    is_superuser: boolean;
  };
  timestamp: string;
}

export interface AdminAuthTokens {
  access: string;
  refresh: string;
}

import { clearAllLocalStorage } from './logoutUtils';

class AdminAuthService {
  private readonly API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  private readonly TOKEN_STORAGE_KEY = 'admin_auth_tokens';
  private readonly USER_DATA_KEY = 'admin_user_data';
  private refreshTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeTokenRefresh();
  }

  async login(credentials: AdminLoginRequest): Promise<AdminLoginResponse> {
    // First, perform regular login
          const response = await fetch(`${this.API_BASE_URL}/api/users/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Login failed: ${response.status}`);
    }
    const loginData: AdminLoginResponse = await response.json();
    
    // Then check superuser status using the dedicated endpoint
    const superuserResponse = await fetch(`${this.API_BASE_URL}/api/users/users/check_superuser/`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${loginData.access}`,
      },
    });
    
    if (!superuserResponse.ok) {
      throw new Error('Failed to verify superuser status');
    }
    
    const superuserData = await superuserResponse.json();
    
    // If user is superuser, grant immediate access
    if (superuserData.is_superuser) {
      this.storeTokens({ access: loginData.access, refresh: loginData.refresh });
      this.storeUserData(loginData.user_info);
      this.scheduleTokenRefresh(loginData.expires_in);
      return loginData;
    } else {
      throw new Error('You are not authorized to access the admin dashboard. Superuser privileges required.');
    }
  }

  async refreshToken(): Promise<AdminRefreshResponse> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refresh) throw new Error('No refresh token available');
          const response = await fetch(`${this.API_BASE_URL}/api/users/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!response.ok) {
      this.clearAuthData();
      throw new Error('Token refresh failed');
    }
    const refreshData: AdminRefreshResponse = await response.json();
    this.storeTokens({ access: refreshData.access, refresh: refreshData.refresh || tokens.refresh });
    this.scheduleTokenRefresh(refreshData.expires_in);
    return refreshData;
  }

  async verifyToken(): Promise<AdminVerificationResponse> {
    const tokens = this.getStoredTokens();
    if (!tokens?.access) throw new Error('No access token available');
    
    // First verify the token is valid
          const response = await fetch(`${this.API_BASE_URL}/api/users/auth/verify/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 401 && tokens?.refresh) {
        await this.refreshToken();
        const newTokens = this.getStoredTokens();
        if (newTokens?.access) {
          const retryResponse = await fetch(`${this.API_BASE_URL}/api/users/auth/verify/`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${newTokens.access}`,
              'Content-Type': 'application/json',
            },
          });
          if (retryResponse.ok) {
            const verificationData: AdminVerificationResponse = await retryResponse.json();
            if (verificationData.valid) {
              // Check superuser status after successful token verification
              const superuserResponse = await fetch(`${this.API_BASE_URL}/api/users/users/check_superuser/`, {
                method: 'GET',
                headers: {
                  'accept': 'application/json',
                  'Authorization': `Bearer ${newTokens.access}`,
                },
              });
              
              if (superuserResponse.ok) {
                const superuserData = await superuserResponse.json();
                if (superuserData.is_superuser) {
                  this.storeUserData(verificationData.user_info);
                  return verificationData;
                } else {
                  throw new Error('Superuser privileges required');
                }
              }
            }
          }
        }
      }
      throw new Error('Token verification failed');
    }
    
    const verificationData: AdminVerificationResponse = await response.json();
    if (!verificationData.valid) throw new Error('Token is invalid');
    
    // Check superuser status
    const superuserResponse = await fetch(`${this.API_BASE_URL}/api/users/users/check_superuser/`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${tokens.access}`,
      },
    });
    
    if (!superuserResponse.ok) {
      throw new Error('Failed to verify superuser status');
    }
    
    const superuserData = await superuserResponse.json();
    if (!superuserData.is_superuser) {
      throw new Error('Superuser privileges required');
    }
    
    this.storeUserData(verificationData.user_info);
    return verificationData;
  }

  async logout(): Promise<void> {
    try {
      const tokens = this.getStoredTokens();
      if (tokens?.access && tokens?.refresh) {
        // Call logout endpoint to blacklist both tokens
        const response = await fetch(`${this.API_BASE_URL}/api/users/auth/logout/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.access}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh: tokens.refresh
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn(`Admin logout API returned status ${response.status}: ${response.statusText}`);
          console.warn(`Error details: ${errorText}`);
          
          // If it's a backend configuration issue (400 with blacklist error), 
          // we can still proceed with local logout
          if (response.status === 400 && errorText.includes('blacklist')) {
            console.info('Backend blacklist not configured, proceeding with local logout only');
          }
        } else {
          console.log('Admin logout successful - tokens blacklisted on server');
        }
      } else {
        console.warn('No tokens available for admin logout API call');
      }
    } catch (error) {
      console.error('Admin logout API error:', error);
      // Continue with local cleanup even if API call fails
    } finally {
      this.clearAuthData();
    }
  }

  getAccessToken(): string | null {
    return this.getStoredTokens()?.access || null;
  }

  getUserData() {
    try {
      const data = localStorage.getItem(this.USER_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  private storeTokens(tokens: AdminAuthTokens): void {
    localStorage.setItem(this.TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }

  private getStoredTokens(): AdminAuthTokens | null {
    try {
      const data = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private storeUserData(userInfo: any): void {
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userInfo));
  }

  private clearAuthData(): void {
    // Use the comprehensive logout utility
    clearAllLocalStorage();
    
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
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

  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
    const refreshTime = Math.max((expiresIn * 0.75) * 1000, (expiresIn - 300) * 1000);
    this.refreshTimeout = setTimeout(() => {
      this.refreshToken().catch(() => this.clearAuthData());
    }, refreshTime);
  }

  private async initializeTokenRefresh(): Promise<void> {
    const tokens = this.getStoredTokens();
    if (tokens?.access && tokens?.refresh) {
      // Verify token and superuser status, schedule refresh
      try {
        await this.verifyToken();
      } catch {
        // If verification fails (including superuser check), clear auth data
        this.clearAuthData();
      }
    }
  }
}

export const adminAuthService = new AdminAuthService(); 