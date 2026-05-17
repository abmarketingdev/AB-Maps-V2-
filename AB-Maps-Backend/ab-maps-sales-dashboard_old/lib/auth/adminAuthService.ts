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

class AdminAuthService {
  private readonly API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ab-maps-backend-production.onrender.com';
  private readonly TOKEN_STORAGE_KEY = 'admin_auth_tokens';
  private readonly USER_DATA_KEY = 'admin_user_data';
  private refreshTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeTokenRefresh();
  }

  async login(credentials: AdminLoginRequest): Promise<AdminLoginResponse> {
    const response = await fetch(`${this.API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Login failed: ${response.status}`);
    }
    const loginData: AdminLoginResponse = await response.json();
    if (
      loginData.user_type !== 'admin' ||
      !loginData.user_info?.is_superuser
    ) {
      throw new Error('You are not authorized to access the admin dashboard.');
    }
    this.storeTokens({ access: loginData.access, refresh: loginData.refresh });
    this.storeUserData(loginData.user_info);
    this.scheduleTokenRefresh(loginData.expires_in);
    return loginData;
  }

  async refreshToken(): Promise<AdminRefreshResponse> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refresh) throw new Error('No refresh token available');
    const response = await fetch(`${this.API_BASE_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!response.ok) {
      this.clearAuthData();
      throw new Error('Token refresh failed');
    }
    const refreshData: AdminRefreshResponse = await response.json();
    this.storeTokens({ access: refreshData.access, refresh: tokens.refresh });
    this.scheduleTokenRefresh(refreshData.expires_in);
    return refreshData;
  }

  async verifyToken(): Promise<AdminVerificationResponse> {
    const tokens = this.getStoredTokens();
    if (!tokens?.access) throw new Error('No access token available');
    const response = await fetch(`${this.API_BASE_URL}/api/auth/verify/`, {
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
          const retryResponse = await fetch(`${this.API_BASE_URL}/api/auth/verify/`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${newTokens.access}`,
              'Content-Type': 'application/json',
            },
          });
          if (retryResponse.ok) {
            const verificationData: AdminVerificationResponse = await retryResponse.json();
            if (verificationData.valid) {
              this.storeUserData(verificationData.user_info);
              return verificationData;
            }
          }
        }
      }
      throw new Error('Token verification failed');
    }
    const verificationData: AdminVerificationResponse = await response.json();
    if (!verificationData.valid) throw new Error('Token is invalid');
    this.storeUserData(verificationData.user_info);
    return verificationData;
  }

  async logout(): Promise<void> {
    const tokens = this.getStoredTokens();
    if (tokens?.access) {
      await fetch(`${this.API_BASE_URL}/api/auth/logout/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access}`,
          'Content-Type': 'application/json',
        },
      });
    }
    this.clearAuthData();
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
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
    
    // Clear all campaign-related data
    this.clearCampaignData();
    
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
    // Refresh 1 minute before expiry
    this.refreshTimeout = setTimeout(() => {
      this.refreshToken().catch(() => this.clearAuthData());
    }, Math.max(0, (expiresIn - 60) * 1000));
  }

  private async initializeTokenRefresh(): Promise<void> {
    const tokens = this.getStoredTokens();
    if (tokens?.access && tokens?.refresh) {
      // Optionally verify token and schedule refresh
      try {
        await this.verifyToken();
      } catch {
        this.clearAuthData();
      }
    }
  }
}

export const adminAuthService = new AdminAuthService(); 