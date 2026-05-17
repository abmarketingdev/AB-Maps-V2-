export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  managerId?: string | null;
}

// Dummy data
let employees: Employee[] = [
  { id: '1', name: 'Anna Hansen', email: 'anna@ab.no', phone: '123 45 678', managerId: 'mgr1' },
  { id: '2', name: 'Bjørn Olsen', email: 'bjorn@ab.no', phone: '234 56 789', managerId: 'mgr1' },
  { id: '3', name: 'Cecilie Nilsen', email: 'cecilie@ab.no', phone: '345 67 890', managerId: null },
  { id: '4', name: 'David Li', email: 'david@ab.no', phone: '456 78 901', managerId: 'mgr2' },
];

export async function getEmployees(): Promise<Employee[]> {
  return new Promise((resolve) => setTimeout(() => resolve([...employees]), 300));
}

export async function getEmployeeById(employeeId: string): Promise<Employee | null> {
  const employee = employees.find(e => e.id === employeeId);
  return new Promise((resolve) => setTimeout(() => resolve(employee || null), 100));
}

export async function createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
  const newEmployee = { ...employee, id: (Date.now() + Math.random()).toString() };
  employees.push(newEmployee);
  return new Promise((resolve) => setTimeout(() => resolve(newEmployee), 300));
}

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<Employee | null> {
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return null;
  employees[idx] = { ...employees[idx], ...data };
  return new Promise((resolve) => setTimeout(() => resolve(employees[idx]), 300));
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return false;
  employees.splice(idx, 1);
  return new Promise((resolve) => setTimeout(() => resolve(true), 300));
}

// Simple manager lookup function
export async function getManagerById(managerId: string): Promise<any | null> {
  // For now, return a simple manager object
  // In a real implementation, this would fetch from an API
  return new Promise((resolve) => setTimeout(() => resolve({
    id: managerId,
    name: 'Manager',
    email: 'manager@company.com',
    status: 'active'
  }), 100));
} 