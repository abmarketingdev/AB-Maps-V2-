// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL,
  
  // Authentication endpoints
  AUTH: {
    LOGIN: '/api/users/auth/login/',
    TOKEN: '/api/users/auth/token/',
    REFRESH: '/api/users/auth/refresh/',
    LOGOUT: '/api/users/auth/logout/',
    VERIFY: '/api/users/auth/verify/',
  },
  


  // Users endpoints
  USERS: {
    REGISTER: '/api/users/auth/register/',
    PROFILE: '/api/users/profile/',
    PROMOTE_EMPLOYEE_TO_MANAGER: '/api/users/promote-employee-to-manager/',
    PROMOTE_MANAGER_TO_SUPERUSER: '/api/users/promote-manager-to-superuser/',
    DEMOTE_SUPERUSER_TO_MANAGER: '/api/users/demote-superuser-to-manager/',
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
    CAMPAIGN_AREAS: '/api/campaigns/campaign-areas/',
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
  },

  SALES_CHIEF: {
    TEAM: '/api/users/sales-chief/team/',
    AVAILABLE_PEOPLE: '/api/users/sales-chief/available-people/',
    ADD: '/api/users/sales-chief/team/add/',
    BULK_ADD: '/api/users/sales-chief/team/bulk-add/',
    REMOVE: '/api/users/sales-chief/team/{user_id}/remove/',
    BULK_REMOVE: '/api/users/sales-chief/team/bulk-remove/',
  },
};

// External application URLs
export const EXTERNAL_APPS = {
  AB_MAPS_EMPLOYEE: process.env.NEXT_PUBLIC_AB_MAPS_EMPLOYEE_URL,
  AB_MAPS_MANAGER: process.env.NEXT_PUBLIC_AB_MAPS_MANAGER_URL,
  AB_MAPS_AREA_LOCKER: process.env.NEXT_PUBLIC_AB_MAPS_MANAGER_URL,
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