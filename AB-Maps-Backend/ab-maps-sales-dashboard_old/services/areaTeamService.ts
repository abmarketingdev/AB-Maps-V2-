import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';
import { authService } from '@/lib/auth/authService';

export interface AreaTeam {
  id: string;
  area: string;
  team: string;
  assigned_at: string;
}

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

export { makeAuthenticatedRequest };
// Get the AreaTeam assignment for a given area (should be at most one)
export async function getAreaTeamAssignment(areaId: string): Promise<AreaTeam | null> {
  const url = buildApiUrl('/api/areas/area-teams/') + `?area=${areaId}`;
  const response = await makeAuthenticatedRequest(url);
  const data = await response.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }
  return null;
}

// Assign a team to an area (removes any existing assignment first)
export async function assignTeamToArea(areaId: string, teamId: string): Promise<AreaTeam> {
  // Remove existing assignment if any
  const existing = await getAreaTeamAssignment(areaId);
  if (existing) {
    await unassignTeamFromArea(existing.id);
  }
  // Assign new team
  const url = buildApiUrl('/api/areas/area-teams/');
  const response = await makeAuthenticatedRequest(url, {
    method: 'POST',
    body: JSON.stringify({ area: areaId, team: teamId }),
  });
  if (!response.ok) throw new Error('Failed to assign team to area');
  return await response.json();
}

// Unassign a team from an area (by AreaTeam id)
export async function unassignTeamFromArea(areaTeamId: string): Promise<void> {
  const url = buildApiUrl('/api/areas/area-teams/{id}/', { id: areaTeamId });
  await makeAuthenticatedRequest(url, { method: 'DELETE' });
} 