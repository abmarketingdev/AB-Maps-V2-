import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(url, options);
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
  person_type?: 'employee' | 'manager';
}

// Add an employee or manager to an area
export async function addEmployeeToArea(areaId: string, employee: Employee): Promise<boolean> {
  try {
    // Use the endpoint provided by the user
    const url = buildApiUrl(`/api/areas/areas/${areaId}/add_employee/`);
    
    // Determine payload based on person_type
    // Default to employee if person_type is not specified (backward compatibility)
    const payload = employee.person_type === 'manager' 
      ? { manager_id: employee.id }
      : { employee_id: employee.id };
    
    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.error('Error adding employee/manager to area:', error);
    return false;
  }
}

// Remove an employee or manager from an area
export async function removeEmployeeFromArea(areaId: string, employee: Employee): Promise<boolean> {
  try {
    // Use the endpoint provided by the user
    const url = buildApiUrl(`/api/areas/areas/${areaId}/remove_employee/`);
    
    // Determine payload based on person_type
    // Default to employee if person_type is not specified (backward compatibility)
    const payload = employee.person_type === 'manager'
      ? { manager_id: employee.id }
      : { employee_id: employee.id };
    
    const response = await makeAuthenticatedRequest(url, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.error('Error removing employee/manager from area:', error);
    return false;
  }
}

// Get all employees unassigned to the area
export async function getUnassignedEmployeesForArea(areaId: string): Promise<Employee[]> {
  try {
    // Use the endpoint provided by the user
    const url = buildApiUrl(`/api/areas/areas/${areaId}/unassigned_employees/`);
    const response = await makeAuthenticatedRequest(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching unassigned employees for area:', error);
    return [];
  }
}

// Get all employees assigned to the area
export async function getAssignedEmployeesForArea(areaId: string): Promise<Employee[]> {
  try {
    // Use the endpoint provided by the user
    const url = buildApiUrl(`/api/areas/areas/${areaId}/employees/`);
    const response = await makeAuthenticatedRequest(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching assigned employees for area:', error);
    return [];
  }
}
