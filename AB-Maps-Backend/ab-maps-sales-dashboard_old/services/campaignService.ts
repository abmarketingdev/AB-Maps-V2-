import { authService } from '@/lib/auth/authService';
import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';

export type Team = { 
  id: string; 
  name: string;
};

export type Campaign = { 
  id: string; 
  name: string; 
  description: string; 
  teamIds: string[]; 
  areaIds: string[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  created_by_id?: string;
};

// Helper function to make authenticated API requests
async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeader = authService.getAuthHeader();

  console.log('[DEBUG] makeAuthenticatedRequest - URL:', url);
  console.log('[DEBUG] makeAuthenticatedRequest - Method:', options.method || 'GET');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  });

  console.log('[DEBUG] makeAuthenticatedRequest - Response Status:', response.status);
  console.log('[DEBUG] makeAuthenticatedRequest - Response Status Text:', response.statusText);

  if (!response.ok) {
    if (response.status === 401) {
      // Token might be expired, try to refresh
      try {
        await authService.refreshToken();
        const newAuthHeader = authService.getAuthHeader();
        
        // Retry the original request with new token
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
        // Refresh failed, redirect to login
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

// Fetch all campaigns created by all managers
export async function fetchAllCampaigns(): Promise<Campaign[]> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.ALL_CAMPAIGNS);
    const response = await makeAuthenticatedRequest(url);
    
    const campaignsData = await response.json();
    
    // Transform backend data to match frontend interface
    const campaigns: Campaign[] = campaignsData.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || '',
      teamIds: campaign.teams?.map((team: any) => team.id) || [],
      areaIds: campaign.areas?.map((area: any) => area.id) || [],
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
      created_by: campaign.created_by,
      created_by_id: campaign.created_by_id,
    }));

    return campaigns;
  } catch (error) {
    console.error('Error fetching all campaigns:', error);
    // Return empty array instead of throwing to handle gracefully
    return [];
  }
}

// Fetch all campaigns for the logged-in manager
export async function fetchCampaignsWithTeams(managerId: string): Promise<Campaign[]> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.MY_CAMPAIGNS);
    const response = await makeAuthenticatedRequest(url);
    
    const campaignsData = await response.json();
    
    // Transform backend data to match frontend interface
    const campaigns: Campaign[] = campaignsData.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || '',
      teamIds: campaign.teams?.map((team: any) => team.id) || [],
      areaIds: campaign.areas?.map((area: any) => area.id) || [],
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
    }));

    return campaigns;
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    // Return empty array instead of throwing to handle gracefully
    return [];
  }
}

// Fetch all teams (from teams endpoint or campaign-teams endpoint)
export async function fetchTeams(): Promise<Team[]> {
  try {
    // Try to fetch from teams endpoint first
    const url = buildApiUrl(API_CONFIG.TEAMS.LIST);
    const response = await makeAuthenticatedRequest(url);
    
    const teamsData = await response.json();
    
    return teamsData.map((team: any) => ({
      id: team.id,
      name: team.name,
    }));
  } catch (error) {
    console.error('Error fetching teams:', error);
    // Fallback to empty array
    return [];
  }
}

// Create a new campaign with teams and areas
export async function createCampaign(data: { 
  name: string; 
  description: string; 
  teamIds: string[]; 
  areaIds: string[] 
}): Promise<Campaign> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.CREATE);
    
    // Transform data to match backend expected format
    const campaignData = {
      name: data.name,
      description: data.description,
      // Backend might expect different field names, adjust as needed
      team_ids: data.teamIds,
      area_ids: data.areaIds,
    };

    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(campaignData),
    });

    const newCampaign = await response.json();
    
    return {
      id: newCampaign.id,
      name: newCampaign.name,
      description: newCampaign.description || '',
      teamIds: newCampaign.teams?.map((team: any) => team.id) || [],
      areaIds: newCampaign.areas?.map((area: any) => area.id) || [],
      created_at: newCampaign.created_at,
      updated_at: newCampaign.updated_at,
    };
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
}

// Update a campaign
export async function updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign | undefined> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.UPDATE, { id });
    
    // Transform data to match backend expected format for PATCH
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const response = await makeAuthenticatedRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });

    const updatedCampaign = await response.json();
    
    return {
      id: updatedCampaign.id,
      name: updatedCampaign.name,
      description: updatedCampaign.description || '',
      teamIds: updatedCampaign.teams?.map((team: any) => team.id) || [],
      areaIds: updatedCampaign.areas?.map((area: any) => area.id) || [],
      created_at: updatedCampaign.created_at,
      updated_at: updatedCampaign.updated_at,
      created_by: updatedCampaign.created_by,
      created_by_id: updatedCampaign.created_by_id,
    };
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw error;
  }
}

// Delete a campaign
export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.DELETE, { id });
    
    console.log('[DEBUG] deleteCampaign - URL:', url);
    console.log('[DEBUG] deleteCampaign - ID:', id);
    
    await makeAuthenticatedRequest(url, {
      method: 'DELETE',
    });

    console.log('[DEBUG] deleteCampaign - Success');
    return true;
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
}

// Bulk assign areas to a campaign (replaces all existing assignments)
export async function bulkAssignAreasToCampaign(campaignId: string, areaIds: string[]): Promise<any> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.UPDATE, { id: campaignId }) + 'areas/';
    
    console.debug('[DEBUG] bulkAssignAreasToCampaign URL:', url);
    console.debug('[DEBUG] bulkAssignAreasToCampaign payload:', { area_ids: areaIds });
    
    const response = await makeAuthenticatedRequest(url, {
      method: 'PUT',
      body: JSON.stringify({ area_ids: areaIds }),
    });

    const data = await response.json();
    console.debug('[DEBUG] bulkAssignAreasToCampaign response:', data);
    
    return data;
  } catch (error) {
    console.error('Error bulk assigning areas to campaign:', error);
    throw error;
  }
} 

// Fetch campaigns assigned to the current employee (employee dashboard)
export async function fetchAssignedCampaignsForEmployee(): Promise<Campaign[]> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.ASSIGNED_TO_ME);
    const response = await makeAuthenticatedRequest(url);
    const campaignsData = await response.json();
    const campaigns: Campaign[] = campaignsData.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || '',
      teamIds: [], // Not available in this endpoint
      areaIds: (campaign.areas || []).map((area: any) => area.id),
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
    }));
    return campaigns;
  } catch (error) {
    console.error('Error fetching assigned campaigns for employee:', error);
    return [];
  }
}

// Fetch campaigns directly assigned to the current employee via CampaignEmployee model
export async function fetchEmployeeCampaignsDirect(): Promise<any[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ab-maps-backend-production.onrender.com';
    const url = `${baseUrl}/api/campaigns/campaigns/my_campaigns_employee/`;
    const accessToken = authService.getAccessToken();
    
    if (!accessToken) {
      console.error('No access token available');
      return [];
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Employee campaigns API response:', data);
      return data;
    } else {
      console.error('Failed to fetch employee campaigns:', response.status, response.statusText);
      return [];
    }
  } catch (error) {
    console.error('Error fetching employee campaigns:', error);
    return [];
  }
} 