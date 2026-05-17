import type { LearningUser, LearningLoginRequest, LearningLoginResponse } from './learningTypes';
import { clearAllLocalStorage } from '@/lib/auth/logoutUtils';
import { getCorrectUserId, getUserDataFromStorage } from './learningUtils';

// Learning platform authentication service
export class LearningAuthService {
  private static instance: LearningAuthService;

  static getInstance(): LearningAuthService {
    if (!LearningAuthService.instance) {
      LearningAuthService.instance = new LearningAuthService();
    }
    return LearningAuthService.instance;
  }

  async login(username: string, password: string, userType: 'manager' | 'employee' = 'employee'): Promise<LearningLoginResponse> {
    // Use the existing auth system
    console.log('Login API URL:', process.env.NEXT_PUBLIC_API_URL);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        user_type: userType
      }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();

    // Store tokens using the existing auth system format
    localStorage.setItem('auth_tokens', JSON.stringify({
      access: data.access,
      refresh: data.refresh
    }));

    localStorage.setItem('user_data', JSON.stringify({
      user_id: data.user_id,
      username: data.username,
      email: data.email,
      user_type: data.user_type,
      user_info: data.user_info
    }));

    return {
      access: data.access,
      refresh: data.refresh,
      user: {
        id: parseInt(data.user_info.id), // Use user_info.id instead of user_id
        username: data.username,
        email: data.email,
        first_name: data.user_info.name.split(' ')[0] || '',
        last_name: data.user_info.name.split(' ').slice(1).join(' ') || '',
        is_staff: data.user_type === 'manager',
        is_superuser: false, // Will be checked separately
        date_joined: new Date().toISOString()
      }
    };
  }

  async checkSuperuser(): Promise<boolean> {
    const tokens = localStorage.getItem('auth_tokens');
    if (!tokens) return false;

    try {
      const tokenData = JSON.parse(tokens);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/users/check_superuser/`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access}`,
          'accept': 'application/json'
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.is_superuser || false;
    } catch (error) {
      console.error('Error checking superuser status:', error);
      return false;
    }
  }

  async getCurrentUser(): Promise<LearningUser> {
    const userData = getUserDataFromStorage();
    if (!userData) throw new Error('No user data found');

    return {
      id: parseInt(userData.user_info.id), // Always use user_info.id
      username: userData.username,
      email: userData.email,
      first_name: userData.user_info.name.split(' ')[0] || '',
      last_name: userData.user_info.name.split(' ').slice(1).join(' ') || '',
      is_staff: userData.user_type === 'manager',
      is_superuser: false, // Will be checked separately
      date_joined: new Date().toISOString()
    };
  }

  async isAuthenticated(): Promise<boolean> {
    const tokens = localStorage.getItem('auth_tokens');
    console.log("Checking authentication, tokens exist:", !!tokens);
    if (!tokens) return false;

    try {
      await this.getCurrentUser();
      console.log("Authentication successful");
      return true;
    } catch (error) {
      console.log("Authentication failed:", error);
      this.logout();
      return false;
    }
  }

  logout(): void {
    clearAllLocalStorage();
  }

  getToken(): string | null {
    const tokens = localStorage.getItem('auth_tokens');
    if (!tokens) return null;

    try {
      const tokenData = JSON.parse(tokens);
      return tokenData.access;
    } catch {
      return null;
    }
  }

  getRefreshToken(): string | null {
    const tokens = localStorage.getItem('auth_tokens');
    if (!tokens) return null;

    try {
      const tokenData = JSON.parse(tokens);
      return tokenData.refresh;
    } catch {
      return null;
    }
  }
}
