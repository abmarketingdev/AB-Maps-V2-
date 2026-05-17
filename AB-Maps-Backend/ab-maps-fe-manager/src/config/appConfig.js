/**
 * Application configuration
 * Easy to modify for backend integration
 */

export const APP_CONFIG = {
  // API Configuration
  api: {
    baseUrl: process.env.REACT_APP_API_URL || 'https://ab-maps-backend-production.onrender.com',
    timeout: 10000,
    retryAttempts: 3
  },
  
  // Current user (will come from authentication)
  currentUser: {
    id: 102 // Only the ID is needed for the current user
  },
  
  // Map configuration
  map: {
    defaultCenter: [59.9139, 10.7522], // Oslo center
    defaultZoom: 13,
    maxZoom: 18,
    minZoom: 8
  },
  
  // Area configuration
  area: {
    defaultColor: '#2b2d42',
    minPoints: 3,
    maxPoints: 50,
    intersectionCheck: true
  },
  
  // Employee configuration
  employee: {
    markerSize: 38,
    popupWidth: 180,
    maxPopupWidth: 260
  },
  
  // Toast configuration
  toast: {
    duration: 3000,
    position: 'top-right'
  }
};

/**
 * Helper function to check if using dummy data
 */
export const isUsingDummyData = () => APP_CONFIG.useDummyData;

/**
 * Helper function to get current user
 */
export const getCurrentUser = () => APP_CONFIG.currentUser;

/**
 * Helper function to get API base URL
 */
export const getApiBaseUrl = () => APP_CONFIG.api.baseUrl; 