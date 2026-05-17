import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';
import { authService } from '@/lib/auth/authService';

// Helper function for authenticated requests (copied from campaignService)
async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeader = authService.getAuthHeader();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      try {
        await authService.refreshToken();
        const newAuthHeader = authService.getAuthHeader();
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...newAuthHeader,
            ...options.headers,
          },
        });
        if (!retryResponse.ok) {
          throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
        }
        return retryResponse;
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Authentication failed');
      }
    } else {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
  }
  return response;
}

export interface Area {
  id: string;
  name: string;
  polygon_geometry?: any;
  color: string;
  created_at: string;
  updated_at: string;
  campaign_id?: string;
  manager?: any;
  status?: string;
  fylke?: string;
  house_count?: number;
  campaign?: {
    id: string;
    name: string;
    description: string;
  } | null;
}

export async function getAreasForManager(): Promise<Area[]> {
  const url = buildApiUrl('/api/areas/areas/my_areas/');
  const response = await makeAuthenticatedRequest(url);
  const data = await response.json();
  return data;
}

export async function updateArea(id: string, data: Partial<Omit<Area, 'id' | 'created_at'>>): Promise<Area | null> {
  const url = buildApiUrl('/api/areas/areas/{id}/', { id });
  const response = await makeAuthenticatedRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.ok) return null;
  return await response.json();
}

export async function deleteArea(id: string): Promise<boolean> {
  const url = buildApiUrl('/api/areas/areas/{id}/', { id });
  const response = await makeAuthenticatedRequest(url, {
    method: 'DELETE',
  });
  return response.ok;
}

export async function assignEmployeeToArea(areaId: string, employeeId: string): Promise<void> {
  const url = buildApiUrl('/api/areas/area-employees/');
  await makeAuthenticatedRequest(url, {
    method: 'POST',
    body: JSON.stringify({ area: areaId, employee_id: employeeId }),
  });
}

export async function setAreaEmployees(areaId: string, employeeIds: string[]): Promise<void> {
  const url = buildApiUrl(`/api/areas/areas/{id}/set-employees/`, { id: areaId });
  await makeAuthenticatedRequest(url, {
    method: 'PUT',
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
}

export async function getAssignedAreasForEmployee(): Promise<Area[]> {
  const url = buildApiUrl('/api/areas/areas/assigned_areas/');
  const response = await makeAuthenticatedRequest(url);
  const data = await response.json();
  return data;
}

export async function getTeamAssignedAreasForEmployee(campaignId?: string): Promise<Area[]> {
  const url = buildApiUrl('/api/areas/areas/assigned_to_me/');
  
  // Prepare headers with campaign ID
  const headers: Record<string, string> = {};
  
  // If no campaignId provided, try to get it from localStorage
  let finalCampaignId = campaignId;
  if (!finalCampaignId) {
    const campaignData = localStorage.getItem('currentCampaign');
    if (campaignData) {
      try {
        if (campaignData.startsWith('{')) {
          const campaign = JSON.parse(campaignData);
          finalCampaignId = campaign.id;
        } else {
          finalCampaignId = campaignData;
        }
        console.log('[DEBUG] getTeamAssignedAreasForEmployee - Using campaign ID from localStorage:', finalCampaignId);
      } catch (error) {
        console.error('[DEBUG] getTeamAssignedAreasForEmployee - Error parsing campaign data from localStorage:', error);
      }
    }
  }
  
  if (finalCampaignId) {
    headers['X-Campaign-ID'] = finalCampaignId;
    console.log('[DEBUG] getTeamAssignedAreasForEmployee - Using campaign ID:', finalCampaignId);
  } else {
    console.error('[DEBUG] getTeamAssignedAreasForEmployee - No campaign ID available, API call will fail');
    throw new Error('Campaign ID is required for assigned_to_me endpoint');
  }
  
  console.log('[DEBUG] getTeamAssignedAreasForEmployee - URL:', url);
  console.log('[DEBUG] getTeamAssignedAreasForEmployee - Headers:', headers);
  
  const response = await makeAuthenticatedRequest(url, { headers });
  const data = await response.json();
  console.log('[DEBUG] getTeamAssignedAreasForEmployee - Response data:', data);
  return data;
}

// Get areas with campaign information for sales dashboard
export async function getAreasWithCampaigns(): Promise<Area[]> {
  try {
    const url = buildApiUrl('/api/areas/areas/with_campaigns/');
    const response = await makeAuthenticatedRequest(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch areas with campaigns: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching areas with campaigns:', error);
    return [];
  }
} 