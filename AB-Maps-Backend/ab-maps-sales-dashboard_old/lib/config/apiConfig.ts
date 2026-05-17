// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ab-maps-backend-production.onrender.com',
  
  // Authentication endpoints
  AUTH: {
    LOGIN: '/api/users/auth/login/',
    TOKEN: '/api/users/auth/token/',
    REFRESH: '/api/users/auth/refresh/',
    LOGOUT: '/api/users/auth/logout/',
    VERIFY: '/api/users/auth/verify/',
  },
  
  // Teams endpoints
  TEAMS: {
    LIST: '/api/teams/teams/',
    MY_TEAMS: '/api/teams/teams/my_teams/',
    EMPLOYEE_TEAMS: '/api/teams/teams/employee_teams/',
    DETAIL: '/api/teams/teams/{id}/',
    CREATE: '/api/teams/teams/',
    UPDATE: '/api/teams/teams/{id}/',
    DELETE: '/api/teams/teams/{id}/',
    ADD_MEMBER: '/api/teams/teams/{id}/add_member/',
    REMOVE_MEMBER: '/api/teams/teams/{id}/remove_member/',
    MEMBERS: '/api/teams/teams/{id}/members/',
  },

  TEAM_MEMBERS: {
    LIST: '/api/teams/members/',
    CREATE: '/api/teams/members/',
    DETAIL: '/api/teams/members/{id}/',
    UPDATE: '/api/teams/members/{id}/',
    DELETE: '/api/teams/members/{id}/',
  },

  // Users endpoints
  USERS: {
    REGISTER: '/api/users/auth/register/',
    PROFILE: '/api/users/profile/',
  },

  EMPLOYEES: {
    LIST: '/api/users/employees/',
    DETAIL: '/api/users/employees/{id}/',
    CREATE: '/api/users/employees/',
    UPDATE: '/api/users/employees/{id}/',
    DELETE: '/api/users/employees/{id}/',
  },

  MANAGERS: {
    LIST: '/api/users/managers/',
    DETAIL: '/api/users/managers/{id}/',
    CREATE: '/api/users/managers/',
    UPDATE: '/api/users/managers/{id}/',
    DELETE: '/api/users/managers/{id}/',
  },
  
  AREAS: {
    LIST: '/api/areas/',
    DETAIL: '/api/areas/{id}/',
    CREATE: '/api/areas/',
    UPDATE: '/api/areas/{id}/',
    DELETE: '/api/areas/{id}/',
  },

  CAMPAIGNS: {
    LIST: '/api/campaigns/campaigns/',
    MY_CAMPAIGNS: '/api/campaigns/campaigns/my_campaigns/',
    ALL_CAMPAIGNS: '/api/campaigns/campaigns/all_campaigns/',
    ASSIGNED_TO_ME: '/api/campaigns/campaigns/assigned_to_me/',
    DETAIL: '/api/campaigns/campaigns/{id}/',
    CREATE: '/api/campaigns/campaigns/',
    UPDATE: '/api/campaigns/campaigns/{id}/',
    DELETE: '/api/campaigns/campaigns/{id}/',
    ADD_TEAM: '/api/campaigns/campaigns/{id}/add_team/',
    REMOVE_TEAM: '/api/campaigns/campaigns/{id}/remove_team/',
    TEAMS: '/api/campaigns/campaigns/{id}/teams/',
    CAMPAIGN_AREAS: '/api/campaigns/campaign-areas/',
    CAMPAIGN_TEAMS: '/api/campaigns/campaign-teams/',
  },
  
  ACTIVITIES: {
    LIST: '/api/activities/',
    DETAIL: '/api/activities/{id}/',
    CREATE: '/api/activities/',
    UPDATE: '/api/activities/{id}/',
    DELETE: '/api/activities/{id}/',
  },
  
  REPORTS: {
    SALES: '/api/reports/sales/',
    ACTIVITIES: '/api/reports/activities/',
    TEAMS: '/api/reports/teams/',
  }
};

// External application URLs
export const EXTERNAL_APPS = {
  AB_MAPS_EMPLOYEE: process.env.NEXT_PUBLIC_AB_MAPS_EMPLOYEE_URL || 'http://localhost:3002',
  AB_MAPS_MANAGER: process.env.NEXT_PUBLIC_AB_MAPS_MANAGER_URL || 'http://localhost:3001',
  AB_MAPS_AREA_LOCKER: process.env.NEXT_PUBLIC_AB_MAPS_AREA_LOCKER_URL || 'http://localhost:3003',
};

// Helper function to build full URLs
export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = API_CONFIG.BASE_URL + endpoint;
  
  // Replace path parameters (e.g., {id} with actual values)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value);
    });
  }
  
  return url;
};

export default API_CONFIG; 