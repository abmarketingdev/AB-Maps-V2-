/**
 * Utility function to completely clear all localStorage data
 * This ensures no authentication data remains when logging out
 */
export const clearAllLocalStorage = (): void => {
  if (typeof window === 'undefined') return;
  
  // Clear main auth service tokens
  localStorage.removeItem('auth_tokens');
  localStorage.removeItem('user_data');
  localStorage.removeItem('jwt');
  localStorage.removeItem('role');
  localStorage.removeItem('userId');
  
  // Clear admin auth tokens
  localStorage.removeItem('admin_auth_tokens');
  localStorage.removeItem('admin_user_data');
  
  // Clear learning auth tokens
  localStorage.removeItem('auth_tokens');
  localStorage.removeItem('user_data');
  
  // Clear any other potential auth-related data
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('userInfo');
  localStorage.removeItem('user_info');
  
  // Clear learning platform specific data
  localStorage.removeItem('learning_access_token');
  localStorage.removeItem('learning_user_data');
  localStorage.removeItem('learning_progress');
  localStorage.removeItem('learning_sections');
  localStorage.removeItem('learning_lessons');
  
  // Clear campaign-related data
  localStorage.removeItem('selectedCampaign');
  localStorage.removeItem('currentCampaign');
  localStorage.removeItem('campaign');
  localStorage.removeItem('campaigns');
  localStorage.removeItem('current_campaign');
  localStorage.removeItem('selected_campaign');
  
  // Clear maps app tokens (employee app)
  localStorage.removeItem('emp_accessToken');
  localStorage.removeItem('emp_refreshToken');
  
  // Dispatch event to notify maps app (if open in another tab/window)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
    console.log('[Logout] Dispatched userLoggedOut event to notify maps app');
  }
  
  // Clear any session storage
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
  
  // Clear any cookies that might contain auth data
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name && (name.includes('auth') || name.includes('token') || name.includes('user'))) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  }
  
  console.log('All authentication data cleared from localStorage, sessionStorage, and cookies');
};

/**
 * Enhanced logout function that calls the API and clears all local data
 */
export const performCompleteLogout = async (logoutApiCall?: () => Promise<void>): Promise<void> => {
  try {
    // First try to call the logout API if provided
    if (logoutApiCall) {
      await logoutApiCall();
    }
  } catch (error) {
    console.warn('Logout API call failed, but continuing with local cleanup:', error);
  } finally {
    // Always clear local data regardless of API call success
    clearAllLocalStorage();
  }
};
