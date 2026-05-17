import { authService } from '@/lib/auth/authService';
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';



export type Campaign = { 
  id: string; 
  name: string; 
  description: string; 
 
  areaIds: string[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  created_by_id?: string;
};

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(url, options);
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






// Create a new campaign with areas
export async function createCampaign(data: { 
  name: string; 
  description: string; 
  areaIds: string[] 
}): Promise<Campaign> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.CREATE);
    
    // Transform data to match backend expected format
    const campaignData = {
      name: data.name,
      description: data.description,
      // Backend might expect different field names, adjust as needed
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
//this is being used in the CampaignSelector component
export async function fetchAssignedCampaignsForEmployee(employeeId: string): Promise<Campaign[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${baseUrl}/api/campaigns/campaigns/employee_campaigns/?employee_id=${employeeId}`;
    const accessToken = authService.getAccessToken();
    if (!accessToken) {
      console.error('No access token available');
      return [];
    }
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      console.error('Failed to fetch campaigns for employee:', employeeId);
      return [];
    }
    const data = await response.json();
    const campaigns: Campaign[] = data.map((item: any) => item.campaign);
    return campaigns;
  } catch (error) {
    console.error('Error fetching campaigns for employee:', employeeId, error);
    return [];
  }
}

// Fetch campaigns directly assigned to the current employee via CampaignEmployee model
export async function fetchEmployeeCampaignsDirect(): Promise<any[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const url = `${baseUrl}/api/campaigns/campaigns/my_campaigns_employee/`;
    const response = await fetchWithAuth(url, {
      headers: {
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
