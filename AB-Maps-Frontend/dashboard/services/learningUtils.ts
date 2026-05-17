/**
 * Utility functions for learning platform
 */

/**
 * Get the correct user ID from localStorage
 * Always uses user_info.id instead of user_id
 * Works for both employees and managers
 */
export const getCorrectUserId = (): string => {
  if (typeof window === 'undefined') {
    throw new Error('Cannot access localStorage on server side');
  }
  
  const userData = localStorage.getItem('user_data');
  if (!userData) {
    throw new Error('No user data found in localStorage');
  }
  
  try {
    const user = JSON.parse(userData);
    
    // Always use user_info.id instead of user_id
    if (!user.user_info || !user.user_info.id) {
      throw new Error('user_info.id not found in user data');
    }
    
    // Log for debugging (can be removed in production)
    console.log(`Using user_info.id: ${user.user_info.id} for user_type: ${user.user_type}`);
    
    return user.user_info.id;
  } catch (error) {
    console.error('Error parsing user data:', error);
    throw new Error('Invalid user data in localStorage');
  }
};

/**
 * Get the complete user data from localStorage
 * Ensures we're using the correct ID structure
 * Works for both employees and managers
 */
export const getUserDataFromStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const userData = localStorage.getItem('user_data');
  if (!userData) {
    return null;
  }
  
  try {
    const user = JSON.parse(userData);
    
    // Validate that we have the required fields
    if (!user.user_info || !user.user_info.id) {
      console.error('Invalid user data structure:', user);
      return null;
    }
    
    // Log for debugging (can be removed in production)
    console.log(`User data validated - user_type: ${user.user_type}, using user_info.id: ${user.user_info.id}`);
    
    return {
      user_id: user.user_id, // Keep original for reference
      username: user.username,
      email: user.email,
      user_type: user.user_type,
      user_info: {
        id: user.user_info.id, // This is the correct ID to use
        name: user.user_info.name,
        email: user.user_info.email
      }
    };
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

/**
 * Validate that the current user data has the correct structure
 */
export const validateUserData = (): boolean => {
  try {
    const userData = getUserDataFromStorage();
    return userData !== null && userData.user_info && userData.user_info.id;
  } catch {
    return false;
  }
};

/**
 * Test function to verify correct user ID usage
 * Logs the user data structure for debugging
 */
export const testUserIdUsage = (): void => {
  try {
    const userData = getUserDataFromStorage();
    if (userData) {
      console.log('=== User ID Usage Test ===');
      console.log('User Type:', userData.user_type);
      console.log('❌ user_id (DON\'T USE):', userData.user_id);
      console.log('✅ user_info.id (USE THIS):', userData.user_info.id);
      console.log('Username:', userData.username);
      console.log('Name:', userData.user_info.name);
      console.log('==========================');
    } else {
      console.error('No user data found for testing');
    }
  } catch (error) {
    console.error('Error testing user ID usage:', error);
  }
};
