import { authService } from '@/lib/auth/authService';
import { buildApiUrl, API_CONFIG } from '@/lib/config/apiConfig';

export type Activity = {
  id: number;
  date: string;
  activity: string;
  campaign: string;
  name: string;
  mobile: string;
  outcome: string;
  employee_id?: string;
  manager_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateActivityRequest = {
  activity: string;
  campaign: string;
  name: string;
  mobile: string;
  outcome: string;
  employee_id?: string;
};

export type UpdateActivityRequest = Partial<CreateActivityRequest>;

// Dummy data for development - will be replaced with real API calls
const dummyActivities: Activity[] = [
  {
    id: 1,
    date: "10. Mar 23:35",
    activity: "Standard OMS",
    campaign: "Norsk Folkehjelp",
    name: "Dana Barzinje",
    mobile: "48631833",
    outcome: "Ja",
    employee_id: "emp1",
    manager_id: "mgr1",
    created_at: "2024-03-10T23:35:00Z",
    updated_at: "2024-03-10T23:35:00Z",
  },
  {
    id: 2,
    date: "1. Mar 19:46",
    activity: "Maps",
    campaign: "Norsk Folkehjelp",
    name: "John Smith",
    mobile: "48631834",
    outcome: "Ja",
    employee_id: "emp2",
    manager_id: "mgr1",
    created_at: "2024-03-01T19:46:00Z",
    updated_at: "2024-03-01T19:46:00Z",
  },
];

/**
 * Fetch activities for the current user
 * Managers see all activities under their management
 * Employees see only their own activities
 */
export async function fetchActivities(): Promise<Activity[]> {
  try {
    // TODO: Replace with real API call
    // const response = await fetch(buildApiUrl(API_CONFIG.ACTIVITIES.LIST), {
    //   method: 'GET',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     ...authService.getAuthHeader(),
    //   },
    // });
    
    // if (!response.ok) {
    //   throw new Error(`Failed to fetch activities: ${response.status}`);
    // }
    
    // const activities = await response.json();
    // return activities;

    // Simulate API delay and return dummy data
    return new Promise((resolve) => {
      setTimeout(() => {
        const userData = authService.getUserData();
        let filteredActivities = dummyActivities;
        
        // Filter based on user type
        if (userData?.user_type === 'employee') {
          filteredActivities = dummyActivities.filter(
            activity => activity.employee_id === userData.user_info?.id
          );
        } else if (userData?.user_type === 'manager') {
          filteredActivities = dummyActivities.filter(
            activity => activity.manager_id === userData.user_info?.id
          );
        }
        
        resolve(filteredActivities);
      }, 200);
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
} 