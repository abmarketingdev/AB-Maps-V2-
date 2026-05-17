import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus, UserMinus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAvailableEmployeesForTeam, getAssignedMembersForTeam, assignEmployeeToTeamAndManager, unassignEmployeeFromTeamAndManager, deleteTeam, Team, Employee } from '@/services/teamService';
import { buildApiUrl } from '@/lib/config/apiConfig';
import { authService } from '@/lib/auth/authService';

interface TeamTableProps {
  teams: Team[];
  areas: any[];
  loading: boolean;
  onEdit: (team: Team) => void;
}

// Campaign badge component
const CampaignBadge: React.FC<{ campaign: any }> = ({ campaign }) => {
  // Generate a consistent color based on campaign name
  const getCampaignColor = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <span 
      className={`inline-flex items-center text-xs px-2 py-1 mr-1 mb-1 rounded-full border ${getCampaignColor(campaign.name)}`}
      title={`Assigned: ${new Date(campaign.assigned_at).toLocaleDateString()}`}
    >
      {campaign.name}
    </span>
  );
};

// Enhanced employee card component
const EmployeeCard: React.FC<{ employee: Employee; campaigns?: any[] }> = ({ employee, campaigns = [] }) => {
  return (
    <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-50 transition">
      <div className="flex-1">
        <div className="font-medium text-gray-900 mb-1">{employee.name}</div>
        <div className="text-xs text-gray-500 mb-2">{employee.email}</div>
        
        {/* Campaign badges */}
        {campaigns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {campaigns.map((campaign, index) => (
              <CampaignBadge key={index} campaign={campaign} />
            ))}
          </div>
        )}
        
        {campaigns.length === 0 && (
          <div className="text-xs text-gray-400 italic">No campaigns assigned</div>
        )}
      </div>
    </div>
  );
};

const TeamTable: React.FC<TeamTableProps> = ({ teams, areas, loading, onEdit }) => {
  const { user } = useAuth();
  const managerId = user?.user_info?.manager_id || user?.user_info?.id || user?.user_id || "";
  const [openModalTeamId, setOpenModalTeamId] = React.useState<string | null>(null);
  const [availableEmployees, setAvailableEmployees] = React.useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = React.useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = React.useState(false);
  const [teamList, setTeamList] = React.useState<Team[]>(teams);
  const [employeeCampaigns, setEmployeeCampaigns] = React.useState<Record<string, any[]>>({});
  const [loadingCampaigns, setLoadingCampaigns] = React.useState<Record<string, boolean>>({});
  
  React.useEffect(() => { setTeamList(teams); }, [teams]);

  // Fetch campaigns for an employee
  const fetchEmployeeCampaigns = async (employeeId: string) => {
    if (employeeCampaigns[employeeId]) return; // Already loaded
    
    setLoadingCampaigns(prev => ({ ...prev, [employeeId]: true }));
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ab-maps-backend-production.onrender.com';
      const apiUrl = `${baseUrl}/api/campaigns/campaigns/employee_campaigns/?employee_id=${employeeId}`;
      const accessToken = authService.getAccessToken();
      
      if (!accessToken) {
        console.error('No access token available');
        setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
        return;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmployeeCampaigns(prev => ({ 
          ...prev, 
          [employeeId]: data.map((item: any) => item.campaign) 
        }));
      } else {
        console.error('Failed to fetch campaigns for employee:', employeeId, response.status, response.statusText);
        setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
      }
    } catch (error) {
      console.error('Error fetching campaigns for employee:', employeeId, error);
      setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
    } finally {
      setLoadingCampaigns(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  const handleAssignMember = async (teamId: string) => {
    setOpenModalTeamId(teamId);
    setLoadingEmployees(true);
    try {
      const [available, assigned] = await Promise.all([
        getAvailableEmployeesForTeam(teamId),
        getAssignedMembersForTeam(teamId),
      ]);
      setAvailableEmployees(available);
      setAssignedEmployees(assigned);
      
      // Fetch campaigns for all employees
      const allEmployees = [...available, ...assigned];
      allEmployees.forEach(emp => {
        fetchEmployeeCampaigns(emp.id);
      });
    } catch (e) {
      setAvailableEmployees([]);
      setAssignedEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleCloseModal = () => {
    setOpenModalTeamId(null);
    setAvailableEmployees([]);
    setAssignedEmployees([]);
    setLoadingEmployees(false);
  };

  // Add member handler
  const handleAddMember = async (teamId: string, employee: Employee) => {
    if (!managerId) return;
    await assignEmployeeToTeamAndManager(teamId, employee.id, managerId);
    setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAssignedEmployees(prev => [...prev, employee]);
  };

  // Remove member handler
  const handleRemoveMember = async (teamId: string, employee: Employee) => {
    await unassignEmployeeFromTeamAndManager(teamId, employee.id);
    setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAvailableEmployees(prev => [...prev, employee]);
  };

  const handleDeleteTeam = async (team: Team) => {
    if (confirm(`Er du sikker på at du vil slette teamen "${team.name}"?`)) {
      try {
        await deleteTeam(team.id);
        setTeamList(prev => prev.filter(t => t.id !== team.id));
      } catch (error) {
        console.error('Error deleting team:', error);
        alert('Kunne ikke slette team');
      }
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Teamnavn</TableHead>
            <TableHead>Medlemmer</TableHead>
            <TableHead>Områder</TableHead>
            <TableHead className="text-right">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">Laster inn team...</TableCell>
            </TableRow>
          ) : teamList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">Ingen team funnet</TableCell>
            </TableRow>
          ) : (
            teamList.map(team => (
              <React.Fragment key={team.id}>
                <TableRow>
                  <TableCell>
                    <div>
                      <div className="font-medium">{team.name}</div>
                      {team.description && (
                        <div className="text-sm text-gray-500">{team.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{team.members?.length || 0} medlemmer</div>
                      {team.members && team.members.length > 0 && (
                        <div className="text-sm text-gray-500">
                          {team.members.slice(0, 2).map((member: any) => member.name).join(", ")}
                          {team.members.length > 2 && ` +${team.members.length - 2} flere`}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">Områdefunksjon kommer snart</span>
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => onEdit(team)}>
                      Rediger
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteTeam(team)}>
                      Slett
                    </Button>
                    <Button size="sm" onClick={() => handleAssignMember(team.id)}>
                      Tildel bruker
                    </Button>
                  </TableCell>
                </TableRow>
                <Dialog open={openModalTeamId === team.id} onOpenChange={open => { if (!open) handleCloseModal(); }}>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Tildel brukere til {team.name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-8 h-full">
                      {/* Available Employees */}
                      <div className="flex-1 border-r pr-4">
                        <h3 className="font-semibold mb-2">Tilgjengelige brukere</h3>
                        <div className="min-h-[300px] max-h-[60vh] overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
                          {loadingEmployees ? (
                            <div className="text-gray-400 text-sm">Laster inn...</div>
                          ) : availableEmployees.length === 0 ? (
                            <div className="text-gray-400 text-sm">Ingen tilgjengelige brukere</div>
                          ) : (
                            <ul className="space-y-2">
                              {availableEmployees.map(emp => (
                                <li key={emp.id}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <EmployeeCard 
                                        employee={emp} 
                                        campaigns={employeeCampaigns[emp.id] || []}
                                      />
                                    </div>
                                    <UserPlus 
                                      className="w-8 h-8 text-green-600 cursor-pointer hover:bg-green-100 rounded-full p-1 transition ml-2" 
                                      onClick={() => handleAddMember(team.id, emp)} 
                                    />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      {/* Assigned Employees */}
                      <div className="flex-1 pl-4">
                        <h3 className="font-semibold mb-2">Tildelte brukere</h3>
                        <div className="min-h-[300px] max-h-[60vh] overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
                          {loadingEmployees ? (
                            <div className="text-gray-400 text-sm">Laster inn...</div>
                          ) : assignedEmployees.length === 0 ? (
                            <div className="text-gray-400 text-sm">Ingen tildelte brukere</div>
                          ) : (
                            <ul className="space-y-2">
                              {assignedEmployees.map(emp => (
                                <li key={emp.id}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <EmployeeCard 
                                        employee={emp} 
                                        campaigns={employeeCampaigns[emp.id] || []}
                                      />
                                    </div>
                                    <UserMinus 
                                      className="w-8 h-8 text-red-600 cursor-pointer hover:bg-red-100 rounded-full p-1 transition ml-2" 
                                      onClick={() => handleRemoveMember(team.id, emp)} 
                                    />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TeamTable;

// Add this to your global CSS or Tailwind config if not present:
// .scrollbar-hide::-webkit-scrollbar { display: none; }
// .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } 