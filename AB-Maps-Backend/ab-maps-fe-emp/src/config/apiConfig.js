/**
 * API configuration for the application
 */
export const API_CONFIG = {
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
  },
  backend: {
    baseUrl: 'https://ab-maps-backend-production.onrender.com',
    profile: '/api/users/users/profile/'
  }
};
