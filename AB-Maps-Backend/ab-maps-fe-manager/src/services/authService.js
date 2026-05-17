/**
 * Authentication service for AB Maps Manager
 * Handles JWT token verification and user authentication
 */

import { API_CONFIG } from '../config/apiConfig';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ab-maps-backend-production.onrender.com/api';

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
   * Initialize authentication
   */
  async initializeAuth() {
    try {
      console.log('=== Starting authentication initialization ===');
      
      // Get token from URL
      const tokenString = this.getTokenFromUrl();
      if (!tokenString) {
        throw new Error('No token provided in URL');
      }

      // Get campaign ID from URL
      const campaignId = this.getCampaignIdFromUrl();
      console.log('Campaign ID from URL:', campaignId);
      if (campaignId) {
        console.log('Campaign ID found in URL, storing in localStorage');
        localStorage.setItem('currentCampaign', campaignId);
      } else {
        console.log('No campaign ID found in URL');
      }

      // Parse tokens - handle both JSON string and direct token
      let tokens;
      try {
        console.log('Attempting to parse token string...');
        tokens = this.parseStoredTokens(tokenString);
        console.log('Successfully parsed tokens:', tokens);
      } catch (parseError) {
        // If parsing fails, try to use the token string directly
        console.log('Token parsing failed, trying direct token usage');
        console.error('Parse error:', parseError);
        tokens = { access: tokenString };
      }

      if (!tokens || !tokens.access) {
        throw new Error('Invalid token format');
      }

      console.log('Token validation passed, proceeding to verify with backend...');

      // Verify token with backend
      const verificationData = await this.verifyToken(tokens.access);

      console.log('Token verification successful, setting user data...');

      // Set user data
      this.user = {
        user_id: verificationData.user_id,
        username: verificationData.username,
        email: verificationData.email,
        user_type: verificationData.user_type,
        user_info: verificationData.user_info,
        accessToken: tokens.access,
        campaignId: campaignId, // Include campaign ID in user data
      };

      this.isAuthenticated = true;

      // Store token for future API calls
      this.accessToken = tokens.access;

      // Store refresh token if available
      if (tokens.refresh) {
        localStorage.setItem('refreshToken', tokens.refresh);
        console.log('Refresh token stored in localStorage');
      }

      console.log('=== Authentication initialization completed successfully ===');
      console.log('User data:', this.user);
      console.log('Is authenticated:', this.isAuthenticated);
      console.log('Access token available:', !!this.accessToken);
      console.log('Campaign ID:', campaignId);

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
   * Get access token for API calls
   */
  getAccessToken() {
    return this.accessToken;
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
      window.location.href = 'http://localhost:3000/login';
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
}

// Create singleton instance
const authService = new AuthService();

export default authService; 