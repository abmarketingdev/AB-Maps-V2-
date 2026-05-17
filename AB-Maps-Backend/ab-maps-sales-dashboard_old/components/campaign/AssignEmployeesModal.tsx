import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { makeAuthenticatedRequest } from "@/services/campaignAreaService";
import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';

interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface AssignEmployeesModalProps {
  open: boolean;
  campaign: any;
  onClose: () => void;
}

// Helper to fetch available employees for a campaign (not assigned)
async function fetchAvailableEmployeesForCampaign(campaignId: string): Promise<Employee[]> {
  try {
    // Use the existing unassigned_employees endpoint with campaign_id parameter
    const url = buildApiUrl(`/api/campaigns/campaigns/unassigned_employees/?campaign_id=${campaignId}`);
    const res = await makeAuthenticatedRequest(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('Error fetching available employees:', e);
    return [];
  }
}

// Helper to fetch assigned employees for a campaign
async function fetchAssignedEmployeesForCampaign(campaignId: string): Promise<Employee[]> {
  try {
    const url = buildApiUrl(`/api/campaigns/campaigns/${campaignId}/assigned_employees/`);
    const res = await makeAuthenticatedRequest(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

// Helper to assign employee to campaign
async function assignEmployeeToCampaign(campaignId: string, employeeId: string): Promise<boolean> {
  try {
    const url = buildApiUrl(`/api/campaigns/campaigns/${campaignId}/add_employee/`);
    const res = await makeAuthenticatedRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employee_id: employeeId }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Helper to remove employee from campaign
async function removeEmployeeFromCampaign(campaignId: string, employeeId: string): Promise<boolean> {
  try {
    // The remove_employee endpoint expects employee_id as a query parameter, not in the body
    const url = buildApiUrl(`/api/campaigns/campaigns/${campaignId}/remove_employee/?employee_id=${employeeId}`);
    const res = await makeAuthenticatedRequest(url, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

const AssignEmployeesModal: React.FC<AssignEmployeesModalProps> = ({ open, campaign, onClose }) => {
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('AssignEmployeesModal open:', open, 'campaign:', campaign);
    if (!open || !campaign) return;
    setLoading(true);
    Promise.all([
      fetchAvailableEmployeesForCampaign(campaign.id),
      fetchAssignedEmployeesForCampaign(campaign.id),
    ]).then(([avail, assigned]) => {
      setAvailableEmployees(Array.isArray(avail) ? avail : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
    }).finally(() => setLoading(false));
  }, [open, campaign]);

  if (!campaign) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Laster kampanje...</DialogTitle>
          </DialogHeader>
          <div className="text-gray-400 text-center py-8">Laster...</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Assign employee: move from available to assigned in real time, with optimistic update
  const handleAssign = async (employee: Employee) => {
    if (!campaign) return;
    setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAssignedEmployees(prev => [...prev, employee]);
    try {
      await assignEmployeeToCampaign(campaign.id, employee.id);
      const [avail, assigned] = await Promise.all([
        fetchAvailableEmployeesForCampaign(campaign.id),
        fetchAssignedEmployeesForCampaign(campaign.id),
      ]);
      setAvailableEmployees(Array.isArray(avail) ? avail : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
    } finally {
      // no-op
    }
  };

  // Unassign employee: move from assigned to available in real time, with optimistic update
  const handleUnassign = async (employee: Employee) => {
    setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAvailableEmployees(prev => [...prev, employee]);
    try {
      await removeEmployeeFromCampaign(campaign.id, employee.id);
      if (campaign) {
        const [avail, assigned] = await Promise.all([
          fetchAvailableEmployeesForCampaign(campaign.id),
          fetchAssignedEmployeesForCampaign(campaign.id),
        ]);
        setAvailableEmployees(Array.isArray(avail) ? avail : []);
        setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
      }
    } finally {
      // no-op
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tildel ansatte til {campaign?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-8">
          {/* Available Employees */}
          <div className="flex-1 border-r pr-4">
            <h3 className="font-semibold mb-2">Tilgjengelige ansatte</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
              {loading ? (
                <div className="text-gray-400 text-sm">Laster...</div>
              ) : availableEmployees.length === 0 ? (
                <div className="text-gray-400 text-sm">Ingen tilgjengelige ansatte</div>
              ) : (
                <ul className="space-y-2">
                  {availableEmployees.map((employee) => (
                    <li key={employee.id}>
                      <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-gray-500">{employee.email}</div>
                          <div className="text-xs text-gray-400">Status: {employee.status}</div>
                        </div>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-green-100 rounded-full transition border border-green-200"
                          title="Tildel"
                          onClick={() => handleAssign(employee)}
                        >
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Assigned Employees */}
          <div className="flex-1 pl-4">
            <h3 className="font-semibold mb-2">Tildelte ansatte</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
              {loading ? (
                <div className="text-gray-400 text-sm">Laster...</div>
              ) : assignedEmployees.length === 0 ? (
                <div className="text-gray-400 text-sm">Ingen tildelte ansatte</div>
              ) : (
                <ul className="space-y-2">
                  {assignedEmployees.map((employee) => (
                    <li key={employee.id}>
                      <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-gray-500">{employee.email}</div>
                          <div className="text-xs text-gray-400">Status: {employee.status}</div>
                        </div>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-100 rounded-full transition border border-red-200"
                          title="Fjern tildeling"
                          onClick={() => handleUnassign(employee)}
                        >
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} type="button">
            Lukk
          </Button>
          <Button type="button" className="bg-black text-white hover:bg-gray-900" onClick={onClose}>
            Lagre endringer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignEmployeesModal; 