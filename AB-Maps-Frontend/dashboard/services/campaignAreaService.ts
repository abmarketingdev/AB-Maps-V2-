import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export interface CampaignArea {
  id: string;
  campaign: string;
  area_id: string;  // Backend returns area_id
}

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(url, options);
}

export { makeAuthenticatedRequest };

// Assign an area to a campaign
export async function assignAreaToCampaign(campaignId: string, areaId: string): Promise<CampaignArea> {
  const url = buildApiUrl('/api/campaigns/campaign-areas/');
  const payload = { campaign: campaignId, area_id: areaId }; // <-- FIXED: use 'area_id' not 'area'
  console.debug('assignAreaToCampaign payload:', payload);
  const response = await makeAuthenticatedRequest(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  let respJson;
  try {
    respJson = await response.clone().json();
  } catch (e) {
    respJson = null;
  }
  console.debug('assignAreaToCampaign response:', response.status, respJson);
  if (!response.ok) throw new Error('Failed to assign area to campaign');
  return respJson;
}

// Remove an area from a campaign (by CampaignArea id)
export async function removeAreaFromCampaign(campaignAreaId: string): Promise<void> {
  const url = buildApiUrl('/api/campaigns/campaign-areas/{id}/', { id: campaignAreaId });
  try {
    await makeAuthenticatedRequest(url, { method: 'DELETE' });
  } catch (e) {
    console.debug('removeAreaFromCampaign error:', e);
    throw e;
  }
}

// Get all areas assigned to a campaign
export async function getAreasForCampaign(campaignId: string): Promise<CampaignArea[]> {
  const url = buildApiUrl('/api/campaigns/campaign-areas/') + `?campaign=${campaignId}`;
  try {
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    console.debug('getAreasForCampaign response:', data);
    return data;
  } catch (e) {
    console.debug('getAreasForCampaign error:', e);
    return [];
  }
}

// Get the CampaignArea assignment for a given area and campaign
export async function getCampaignAreaAssignment(campaignId: string, areaId: string): Promise<CampaignArea | null> {
  const url = buildApiUrl('/api/campaigns/campaign-areas/') + `?campaign=${campaignId}&area_id=${areaId}`;
  try {
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    console.debug('getCampaignAreaAssignment response:', data);
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (e) {
    console.debug('getCampaignAreaAssignment error:', e);
    return null;
  }
}

// Get a campaign area assignment by ID
export async function getCampaignAreaById(id: string): Promise<CampaignArea | null> {
  const url = buildApiUrl('/api/campaigns/campaign-areas/{id}/', { id });
  const response = await makeAuthenticatedRequest(url);
  if (!response.ok) return null;
  return await response.json();
}

// Update a campaign area assignment by ID (PATCH)
export async function patchCampaignArea(id: string, data: Partial<CampaignArea>): Promise<CampaignArea | null> {
  const url = buildApiUrl('/api/campaigns/campaign-areas/{id}/', { id });
  const response = await makeAuthenticatedRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.ok) return null;
  return await response.json();
}

// Update a campaign area assignment by ID (PUT)
export async function putCampaignArea(id: string, data: CampaignArea): Promise<CampaignArea | null> {
  const url = buildApiUrl('/api/campaigns/campaign-areas/{id}/', { id });
  const response = await makeAuthenticatedRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) return null;
  return await response.json();
} 