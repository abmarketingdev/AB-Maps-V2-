import { authService } from '@/lib/auth/authService';
import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: Employee[];
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  manager_id?: string | null;
  manager?: {
    id: string;
    name: string;
    email: string;
  } | null;
  status?: string;
  is_online?: boolean;
  last_seen?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  member_ids: string[];
}

// Helper function to make authenticated API requests
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
      // Token might be expired, try to refresh
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

// Get all teams (for admin) or teams for the current manager
export async function getTeams(): Promise<Team[]> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.LIST);
    const response = await makeAuthenticatedRequest(url);
    
    const teamsData = await response.json();
    
    return teamsData.map((team: any) => ({
      id: team.id,
      name: team.name,
      description: team.description || '',
      members: team.members || [],
      manager: team.manager,
      created_at: team.created_at,
      updated_at: team.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching teams:', error);
    return [];
  }
}

// Get teams specifically for the current manager
export async function getTeamsForManager(): Promise<Team[]> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.MY_TEAMS);
    const response = await makeAuthenticatedRequest(url);
    
    const teamsData = await response.json();
    
    return teamsData.map((team: any) => ({
      id: team.id,
      name: team.name,
      description: team.description || '',
      members: team.members || [],
      manager: team.manager,
      created_at: team.created_at,
      updated_at: team.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching teams for manager:', error);
    return [];
  }
}

// Get teams for the current employee
export async function getTeamsForEmployee(): Promise<Team[]> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.EMPLOYEE_TEAMS);
    const response = await makeAuthenticatedRequest(url);
    const teamsData = await response.json();
    return teamsData.map((team: any) => ({
      id: team.id,
      name: team.name,
      description: team.description || '',
      members: team.members || [],
      manager: team.manager,
      created_at: team.created_at,
      updated_at: team.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching teams for employee:', error);
    return [];
  }
}

// Get available employees for the current manager
// This includes employees with manager = NULL or manager = current manager
export async function getAvailableEmployees(): Promise<Employee[]> {
  try {
    const currentUser = authService.getUserData();
    const currentManagerId = currentUser?.user_type === 'manager'
      ? currentUser?.user_info?.id
      : currentUser?.user_info?.manager_id;
    if (!currentManagerId) return [];

    // Fetch unassigned employees
    const urlUnassigned = buildApiUrl(API_CONFIG.EMPLOYEES.LIST) + '?manager_isnull=true';
    // Fetch employees assigned to this manager
    const urlAssigned = buildApiUrl(API_CONFIG.EMPLOYEES.LIST) + `?manager=${currentManagerId}`;

    const [respUnassigned, respAssigned] = await Promise.all([
      makeAuthenticatedRequest(urlUnassigned),
      makeAuthenticatedRequest(urlAssigned),
    ]);
    const dataUnassigned = await respUnassigned.json();
    const dataAssigned = await respAssigned.json();
    const employeesUnassigned = dataUnassigned.results || dataUnassigned;
    const employeesAssigned = dataAssigned.results || dataAssigned;

    // Merge and deduplicate by id
    const allEmployeesMap = new Map();
    [...employeesUnassigned, ...employeesAssigned].forEach((employee: any) => {
      allEmployeesMap.set(employee.id, employee);
    });
    const availableEmployees = Array.from(allEmployeesMap.values());

    return availableEmployees.map((employee: any) => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      manager_id: employee.manager?.id || null,
      status: employee.status,
      is_online: employee.is_online,
      last_seen: employee.last_seen,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching available employees:', error);
    return [];
  }
}

// Create a new team
export async function createTeam(teamData: CreateTeamData): Promise<Team> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.CREATE);
    
    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(teamData),
    });

    const newTeam = await response.json();
    
    // After creating the team, update manager_id for the selected employees
    if (teamData.member_ids && teamData.member_ids.length > 0) {
      const currentUser = authService.getUserData();
      const currentManagerId = currentUser?.user_info?.manager_id || currentUser?.user_info?.id || currentUser?.user_id;
      
      // Update each employee's manager_id
      for (const employeeId of teamData.member_ids) {
        try {
          await assignEmployeeToManager(employeeId, currentManagerId);
        } catch (error) {
          console.error(`Failed to assign employee ${employeeId} to manager:`, error);
        }
      }
    }
    
    return {
      id: newTeam.id,
      name: newTeam.name,
      description: newTeam.description || '',
      members: newTeam.members || [],
      manager: newTeam.manager,
      created_at: newTeam.created_at,
      updated_at: newTeam.updated_at,
    };
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
}

// Assign an employee to a manager (update employee's manager_id)
export async function assignEmployeeToManager(employeeId: string, managerId: string): Promise<void> {
  try {
    const url = buildApiUrl(API_CONFIG.EMPLOYEES.UPDATE, { id: employeeId });
    
    await makeAuthenticatedRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({
        manager_id: managerId,
      }),
    });
  } catch (error) {
    console.error('Error assigning employee to manager:', error);
    throw error;
  }
}

// Add a member to an existing team
export async function addMemberToTeam(teamId: string, employeeId: string): Promise<void> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.ADD_MEMBER, { id: teamId });
    
    await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        employee_id: employeeId,
      }),
    });

    // Also update the employee's manager_id
    const currentUser = authService.getUserData();
    const currentManagerId = currentUser?.user_info?.manager_id || currentUser?.user_info?.id || currentUser?.user_id;
    
    if (currentManagerId) {
      await assignEmployeeToManager(employeeId, currentManagerId);
    }
  } catch (error) {
    console.error('Error adding member to team:', error);
    throw error;
  }
}

// Remove a member from a team
export async function removeMemberFromTeam(teamId: string, employeeId: string): Promise<void> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.REMOVE_MEMBER, { id: teamId });
    
    await makeAuthenticatedRequest(url, {
      method: 'DELETE',
      body: JSON.stringify({
        employee_id: employeeId,
      }),
    });
  } catch (error) {
    console.error('Error removing member from team:', error);
    throw error;
  }
}

// Update an existing team
export async function updateTeam(id: string, data: Partial<CreateTeamData>): Promise<Team | null> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.UPDATE, { id });
    
    const response = await makeAuthenticatedRequest(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    const updatedTeam = await response.json();
    
    return {
      id: updatedTeam.id,
      name: updatedTeam.name,
      description: updatedTeam.description || '',
      members: updatedTeam.members || [],
      manager: updatedTeam.manager,
      created_at: updatedTeam.created_at,
      updated_at: updatedTeam.updated_at,
    };
  } catch (error) {
    console.error('Error updating team:', error);
    throw error;
  }
}

// Delete a team
export async function deleteTeam(id: string): Promise<boolean> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAMS.DELETE, { id });
    
    const response = await makeAuthenticatedRequest(url, {
      method: 'DELETE',
    });

    // Check for successful deletion (204 No Content or 200 OK)
    if (response.status === 204 || response.status === 200) {
      return true;
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting team:', error);
    throw error;
  }
} 

export async function getTeamMembers(teamId: string): Promise<Employee[]> {
  const url = buildApiUrl(API_CONFIG.TEAMS.MEMBERS, { id: teamId });
  const response = await makeAuthenticatedRequest(url);
  const data = await response.json();
  // The API returns an array of team member objects, each with an employee field
  return (data || []).map((tm: any) => ({
    id: tm.employee.id,
    name: tm.employee.name,
    email: tm.employee.email,
    phone: tm.employee.phone,
    manager_id: tm.employee.manager?.id || null,
    status: tm.employee.status,
    is_online: tm.employee.is_online,
    last_seen: tm.employee.last_seen,
    created_at: tm.employee.created_at,
    updated_at: tm.employee.updated_at,
  }));
} 

// Fetch employee details by a list of IDs
export async function getEmployeesByIds(ids: string[]): Promise<Employee[]> {
  if (!ids.length) return [];
  try {
    // The API supports filtering by id__in
    const url = buildApiUrl(API_CONFIG.EMPLOYEES.LIST) + `?id__in=${ids.join(',')}`;
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    // The API may return { results: [...] } or an array
    const employees = data.results || data;
    return employees.map((employee: any) => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      manager_id: employee.manager?.id || null,
      status: employee.status,
      is_online: employee.is_online,
      last_seen: employee.last_seen,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching employees by IDs:', error);
    return [];
  }
} 

// Fetch team members (employees) for a given team
export async function getTeamMembersByTeamId(teamId: string): Promise<Employee[]> {
  try {
    const url = buildApiUrl(API_CONFIG.TEAM_MEMBERS.LIST) + `?team=${teamId}`;
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    // The API returns { results: [...] }
    const members = data.results || [];
    return members.map((member: any) => ({
      id: member.employee.id,
      name: member.employee.name,
      email: member.employee.email,
      phone: member.employee.phone,
      manager_id: member.employee.manager?.id || null,
      status: member.employee.status,
      is_online: member.employee.is_online,
      last_seen: member.employee.last_seen,
      created_at: member.employee.created_at,
      updated_at: member.employee.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching team members by team ID:', error);
    return [];
  }
} 

// Fetch employee details by ID
export async function getEmployeeById(employeeId: string): Promise<Employee | null> {
  try {
    const url = buildApiUrl(API_CONFIG.EMPLOYEES.DETAIL, { id: employeeId });
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      manager_id: data.manager?.id || null,
      manager: data.manager || null,
      status: data.status,
      is_online: data.is_online,
      last_seen: data.last_seen,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error('Error fetching employee by ID:', error);
    return null;
  }
} 

// Fetch manager details by ID
export async function getManagerById(managerId: string): Promise<any | null> {
  try {
    const url = buildApiUrl(API_CONFIG.MANAGERS.DETAIL, { id: managerId });
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching manager by ID:', error);
    return null;
  }
} 

// Fetch campaign-team assignments
export async function getCampaignTeams(): Promise<any[]> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.CAMPAIGN_TEAMS);
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching campaign-team assignments:', error);
    return [];
  }
} 

// Fetch campaign details by ID
export async function getCampaignById(campaignId: string): Promise<any | null> {
  try {
    const url = buildApiUrl(API_CONFIG.CAMPAIGNS.DETAIL, { id: campaignId });
    const response = await makeAuthenticatedRequest(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching campaign by ID:', error);
    return null;
  }
} 

// Get available employees for a team
export async function getAvailableEmployeesForTeam(teamId: string): Promise<Employee[]> {
  const url = buildApiUrl(`/api/teams/teams/${teamId}/available_employees/`);
  const response = await makeAuthenticatedRequest(url);
  const data = await response.json();
  // The response is a team object with an 'available_employees' field or just a list
  // We'll assume it's a list of employees
  // If the API returns a team object, adjust accordingly
  if (Array.isArray(data)) {
    return data;
  } else if (Array.isArray(data.available_employees)) {
    return data.available_employees;
  } else {
    // fallback: try to extract from members or return empty
    return [];
  }
}

// Get assigned members for a team (TeamMember objects)
export async function getAssignedMembersForTeam(teamId: string): Promise<Employee[]> {
  // The endpoint is /api/teams/teams/{id}/members/
  const url = buildApiUrl(`/api/teams/teams/${teamId}/members/`);
  const response = await makeAuthenticatedRequest(url);
  const data = await response.json();
  // The API returns an array of employees
  if (Array.isArray(data)) {
    return data;
  } else if (Array.isArray(data.members)) {
    return data.members;
  } else {
    return [];
  }
} 

// Assign an employee to a team and manager
export async function assignEmployeeToTeamAndManager(teamId: string, employeeId: string, managerId: string): Promise<void> {
  // Add to team
  const url = buildApiUrl(`/api/teams/teams/${teamId}/add_member/`);
  await makeAuthenticatedRequest(url, {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  });
  // Assign to manager
  const empUrl = buildApiUrl(API_CONFIG.EMPLOYEES.UPDATE, { id: employeeId });
  await makeAuthenticatedRequest(empUrl, {
    method: 'PATCH',
    body: JSON.stringify({ manager_id: managerId }),
  });
}

// Unassign an employee from a team and manager
export async function unassignEmployeeFromTeamAndManager(teamId: string, employeeId: string): Promise<void> {
  // Remove from team
  const url = buildApiUrl(`/api/teams/teams/${teamId}/remove_member/`);
  await makeAuthenticatedRequest(url, {
    method: 'DELETE',
    body: JSON.stringify({ employee_id: employeeId }),
  });
  // Unassign manager
  const empUrl = buildApiUrl(API_CONFIG.EMPLOYEES.UPDATE, { id: employeeId });
  await makeAuthenticatedRequest(empUrl, {
    method: 'PATCH',
    body: JSON.stringify({ manager_id: null }),
  });
} 