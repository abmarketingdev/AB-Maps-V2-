"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useRouter } from "next/navigation";
import { Home, LogOut, User, MessageSquare, Bell, Search, Badge, Map } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTeamsForEmployee, Team, getTeamMembersByTeamId, Employee, getEmployeeById, getManagerById, getCampaignTeams, getCampaignById } from "@/services/teamService";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { getAssignedAreasForEmployee, Area, getTeamAssignedAreasForEmployee } from "@/services/areaService";
import { authService } from "@/lib/auth/authService";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { fetchAssignedCampaignsForEmployee, fetchEmployeeCampaignsDirect } from '@/services/campaignService';
import { buildApiUrl } from '@/lib/config/apiConfig';
import CampaignSelector from '@/components/CampaignSelector';

const navItems = [
  {
    href: "/employee",
    title: "Dashboard",
    icon: <Home className="h-5 w-5" />,
    variant: "default" as const,
  },
];

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

// Enhanced team member card component
const TeamMemberCard: React.FC<{ member: Employee; campaigns?: any[] }> = ({ member, campaigns = [] }) => {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 w-full shadow-sm">
      <div className="font-medium text-gray-900 mb-1">{member.name}</div>
      <div className="text-xs text-gray-500 break-all mb-2">{member.email}</div>
      
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
  );
};

const EmployeeDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, Employee[]>>({});
  const [membersLoading, setMembersLoading] = useState(true);
  const [manager, setManager] = useState<any | null>(null);
  const [managerLoading, setManagerLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [assignedAreas, setAssignedAreas] = useState<Area[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [employeeCampaigns, setEmployeeCampaigns] = useState<Record<string, any[]>>({});
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Fetch campaigns for an employee
  const fetchEmployeeCampaigns = async (employeeId: string) => {
    if (employeeCampaigns[employeeId]) return; // Already loaded
    
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
        console.error('Failed to fetch campaigns for employee:', employeeId);
        setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
      }
    } catch (error) {
      console.error('Error fetching campaigns for employee:', employeeId, error);
      setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
    }
  };

  useEffect(() => {
    setTeamsLoading(true);
    getTeamsForEmployee()
      .then(async (teams) => {
        setTeams(teams);
        setMembersLoading(true);
        const map: Record<string, Employee[]> = {};
        await Promise.all(
          teams.map(async (team) => {
            const members = await getTeamMembersByTeamId(team.id);
            // Filter out the logged-in employee
            map[team.id] = members.filter(m => m.id !== user?.user_info?.id);
            
            // Fetch campaigns for all team members
            members.forEach(member => {
              if (member.id !== user?.user_info?.id) {
                fetchEmployeeCampaigns(member.id);
              }
            });
          })
        );
        setTeamMembersMap(map);
        setMembersLoading(false);
      })
      .finally(() => setTeamsLoading(false));
  }, [user?.user_info?.id]);

  useEffect(() => {
    setManagerLoading(true);
    if (user?.user_info?.manager_id) {
      getManagerById(user.user_info.manager_id)
        .then(setManager)
        .catch(console.error)
        .finally(() => setManagerLoading(false));
    } else {
      setManagerLoading(false);
    }
  }, [user?.user_info?.manager_id]);

  useEffect(() => {
    setCampaignsLoading(true);
    fetchEmployeeCampaignsDirect()
      .then((campaignsData) => {
        console.log('Campaigns data received:', campaignsData);
        // Transform the data to match the expected format
        const transformedCampaigns = campaignsData.map((item: any) => ({
          id: item.campaign.id,
          name: item.campaign.name,
          description: item.campaign.description || '',
          teamIds: [],
          areaIds: [],
          created_at: item.campaign.created_at,
          updated_at: item.campaign.updated_at,
          assigned_at: item.assigned_at,
        }));
        setCampaigns(transformedCampaigns);
        
        // Store the first campaign in localStorage for areas API
        if (transformedCampaigns.length > 0) {
          const firstCampaign = transformedCampaigns[0];
          localStorage.setItem('currentCampaign', JSON.stringify({
            id: firstCampaign.id,
            name: firstCampaign.name,
            description: firstCampaign.description
          }));
          console.log('Stored campaign in localStorage:', firstCampaign);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch campaigns:', error);
        setCampaigns([]);
      })
      .finally(() => setCampaignsLoading(false));
  }, []);

  useEffect(() => {
    // Only fetch areas if we have campaigns loaded
    if (campaigns.length === 0) {
      console.log('No campaigns available yet, skipping areas fetch');
      return;
    }
    
    setAreasLoading(true);
    // Use the first campaign's ID
    const campaignId = campaigns[0].id;
    console.log('Fetching areas for campaign:', campaignId);
    
    getTeamAssignedAreasForEmployee(campaignId)
      .then((areas) => {
        console.log('Areas fetched successfully:', areas);
        setAssignedAreas(areas);
      })
      .catch((error) => {
        console.error('Failed to fetch assigned areas:', error);
        setAssignedAreas([]);
      })
      .finally(() => setAreasLoading(false));
  }, [campaigns]); // Add campaigns as dependency

  // Load current campaign from localStorage
  useEffect(() => {
    const storedCampaign = localStorage.getItem('currentCampaign');
    if (storedCampaign) {
      try {
        const campaign = JSON.parse(storedCampaign);
        setSelectedCampaign(campaign);
      } catch (error) {
        console.error('Error parsing stored campaign:', error);
        localStorage.removeItem('currentCampaign');
      }
    }
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const changeCampaign = () => {
    setCampaignModalOpen(true);
  };

  const handleCampaignSelect = (campaign: any) => {
    setSelectedCampaign(campaign);
    setCampaignModalOpen(false);
  };

  const userName = user?.user_info?.name || user?.username || "Employee";
  const userEmail = user?.email || "";
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-64" : "w-[70px]",
          "hidden md:flex",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 py-4">
          <Link href="/employee" className="flex items-center gap-2 font-semibold">
            <User className="h-6 w-6" />
            {sidebarOpen && <span>AB Maps ansatt</span>}
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8">
            {sidebarOpen ? <span>&#10005;</span> : <span>&#9776;</span>}
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {/* Campaign Selector Button - Above Navigation */}
          <div className="mb-4">
            <CampaignSelector 
              onCampaignSelect={changeCampaign}
              selectedCampaign={selectedCampaign}
              useCurrentCampaign={true}
              className="w-full"
            />
          </div>

          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                item.variant === "default" && "bg-muted font-semibold"
              )}
            >
              {item.icon}
              {sidebarOpen && <span>{item.title}</span>}
            </Link>
          ))}
          {/* AB Maps Button */}
          <button
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted w-full",
              "border border-blue-600 text-blue-700 font-semibold"
            )}
            onClick={() => {
              const token = authService.getAccessToken();
              const employeeId = user?.user_info?.id;
              if (token && employeeId) {
                // Use selected campaign or fall back to first campaign
                const campaignToUse = selectedCampaign || (campaigns.length > 0 ? campaigns[0] : null);
                let url = `/emp/?token=${encodeURIComponent(token)}&employee_id=${encodeURIComponent(employeeId)}`;
                
                if (campaignToUse) {
                  url += `&campaign_id=${encodeURIComponent(campaignToUse.id)}`;
                }
                
                window.location.href = url;
              } else {
                alert('You must be logged in to access AB Maps.');
              }
            }}
          >
            <Map className="h-5 w-5" />
            {sidebarOpen && <span>AB Maps</span>}
          </button>
        </nav>
        <div className="mt-auto p-4">
          <Button onClick={handleLogout} className="w-full" disabled={loading} variant="destructive">
            <LogOut className="h-5 w-5 mr-2" />
            {sidebarOpen && "Logg ut"}
          </Button>
        </div>
      </aside>
      {/* Main Content */}
      <div className="flex-1 ml-0 md:ml-64 flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Søk..." className="w-64 pl-8" />
            </div>
            {/* Chatbot Button */}
            <Button variant="outline" size="icon" className="relative">
              <MessageSquare className="h-5 w-5" />
              <span className="sr-only">Åpne chat</span>
            </Button>
            {/* Notification Bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="sr-only">Vis varsler</span>
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    3
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Varsler</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Ny oppgave tildelt</DropdownMenuItem>
                <DropdownMenuItem>Teammøte kl. 14:00</DropdownMenuItem>
                <DropdownMenuItem>Leder har sendt en melding</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* User Avatar (optional for mobile) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full md:hidden">
                  <Avatar>
                    <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Min konto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profil</DropdownMenuItem>
                <DropdownMenuItem>Innstillinger</DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>Logg ut</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {/* Main Dashboard Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-8">
          {/* Top row: 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-8">
            {/* Manager Card */}
            <div className="bg-white rounded-lg shadow-md p-8 h-[240px] flex flex-col justify-center">
              <h2 className="text-lg font-semibold mb-2 text-green-700">Din leder</h2>
              {managerLoading ? (
                <div className="text-gray-500">Laster inn leder...</div>
              ) : manager ? (
                <>
                  <div className="font-medium text-gray-900 mb-1">{manager.name}</div>
                  <div className="text-xs text-gray-500 mb-1">{manager.email}</div>
                  <div className="text-xs text-gray-400 mb-1">Status: {manager.status}</div>
                </>
              ) : (
                <div className="text-gray-500">Ingen leder tildelt.</div>
              )}
            </div>
            {/* Teams Container */}
            <div className="bg-white rounded-lg shadow-md p-8 max-h-[400px] overflow-y-auto flex flex-col">
              <div className="font-semibold text-lg mb-2 text-blue-700">Teammedlemmer</div>
              {teamsLoading || membersLoading ? (
                <div className="text-gray-500">Laster inn team...</div>
              ) : teams.length === 0 ? (
                <div className="text-gray-500">Du er ikke tildelt noe team.</div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {teams.map(team => (
                    <AccordionItem key={team.id} value={team.id}>
                      <AccordionTrigger className="text-base font-medium text-gray-900 bg-gray-100 px-3 rounded hover:bg-gray-200">
                        {team.name}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2">
                          {(teamMembersMap[team.id] || []).length === 0 ? (
                            <div className="text-gray-500 text-sm">Ingen andre medlemmer i dette teamet.</div>
                          ) : (
                            teamMembersMap[team.id].map(member => (
                              <TeamMemberCard 
                                key={member.id} 
                                member={member} 
                                campaigns={employeeCampaigns[member.id] || []}
                              />
                            ))
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
            {/* Campaigns Card */}
            <div className="bg-white rounded-lg shadow-md p-8 h-[240px] flex flex-col justify-center">
              <h2 className="text-lg font-semibold mb-2 text-purple-700">Dine kampanjer</h2>
              {campaignsLoading ? (
                <div className="text-gray-500">Laster inn kampanjer...</div>
              ) : campaigns.length === 0 ? (
                <div className="text-gray-500">Ingen kampanjer tildelt.</div>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: '140px' }}>
                  {campaigns.map(campaign => (
                    <div key={campaign.id} className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 w-full shadow-sm hover:shadow-md transition-shadow">
                      <div className="font-medium text-gray-900 mb-1">{campaign.name}</div>
                      <div className="text-xs text-gray-500 break-all">{campaign.description}</div>
                      {campaign.assigned_at && (
                        <div className="text-xs text-gray-400 mt-1">
                          Tildelt: {new Date(campaign.assigned_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Second row: Assigned Areas full width */}
          <div className="w-full">
            <div className="bg-white rounded-lg shadow-md p-8 w-full">
              <h2 className="text-lg font-semibold mb-4 text-blue-900">Tildelte områder</h2>
              {areasLoading ? (
                <div className="text-gray-500">Laster inn tildelte områder...</div>
              ) : assignedAreas.length === 0 ? (
                <div className="text-gray-500">Ingen områder tildelt deg.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedAreas.map(area => (
                    <div key={area.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-base text-green-700">{area.name}</span>
                        <span className="rounded px-2 py-1 text-xs" style={{ background: area.color, color: '#fff' }}>{area.status}</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">Boliger: {area.house_count ?? 'N/A'}</div>
                      <div className="text-xs text-gray-400">Opprettet: {new Date(area.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Campaign Selection Modal */}
      {campaignModalOpen && (
        <CampaignSelector 
          isOpen={campaignModalOpen}
          onClose={() => setCampaignModalOpen(false)}
          onCampaignSelect={handleCampaignSelect}
          selectedCampaign={selectedCampaign}
          useCurrentCampaign={true}
        />
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default function EmployeeDashboardProtected() {
  return (
    <ProtectedRoute requiredUserType="employee">
      <EmployeeDashboard />
    </ProtectedRoute>
  );
} 