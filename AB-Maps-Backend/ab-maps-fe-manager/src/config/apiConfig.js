/**
 * API configuration for the application
 */
export const API_CONFIG = {
  // Backend API configuration
  backend: {
    baseUrl: 'https://ab-maps-backend-production.onrender.com/api',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  },
  
  // External APIs
  nominatim: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'no',
      'User-Agent': 'AB Maps Application (mailto:support@abmarketing.no)'
    },
    countryCode: 'no',
    zoom: 18,
    limit: 5
  },
  overpass: {
    baseUrl: 'https://overpass-api.de/api/interpreter',
    timeout: 25
  }
};

/**
 * Address API endpoints
 */
export const ADDRESS_ENDPOINTS = {
  addresses: `${API_CONFIG.backend.baseUrl}/addresses/addresses/`,
  statuses: `${API_CONFIG.backend.baseUrl}/addresses/statuses/`,
  syncQueue: `${API_CONFIG.backend.baseUrl}/addresses/sync-queue/`,
};

/**
 * Address status options
 */
export const ADDRESS_STATUS_OPTIONS = [
  {
    value: 'ja',
    label: 'Ja',
    color: '#2ecc71',
    icon: 'check'
  },
  {
    value: 'ikke_hjemme',
    label: 'Ikke hjemme',
    color: '#f1c40f',
    icon: 'clock'
  },
  {
    value: 'nei',
    label: 'Nei',
    color: '#e74c3c',
    icon: 'times'
  }
];
