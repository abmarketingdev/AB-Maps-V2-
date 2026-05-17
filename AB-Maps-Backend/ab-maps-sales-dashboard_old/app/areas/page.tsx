"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Area, getAreasWithCampaigns, updateArea, deleteArea, assignEmployeeToArea, setAreaEmployees } from "@/services/areaService";
import ClientLayout, { useCampaignContext } from "../ClientLayout";
import { Team, getTeamsForManager, getTeamMembers } from "@/services/teamService";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { assignTeamToArea, getAreaTeamAssignment, unassignTeamFromArea } from '@/services/areaTeamService';
import { getAreasForCampaign } from '@/services/campaignAreaService';
import { fetchAllCampaigns, Campaign } from '@/services/campaignService';
import { UserPlus, UserMinus, Filter } from "lucide-react";
import { buildApiUrl } from '@/lib/config/apiConfig';
import { makeAuthenticatedRequest } from '@/services/areaTeamService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

// Helper to fetch available teams for an area
async function fetchAvailableTeams(areaId: string) {
  const url = buildApiUrl('/api/teams/teams/available_for_area/') + `?area=${areaId}`;
  const res = await makeAuthenticatedRequest(url);
  if (!res.ok) throw new Error("Failed to fetch available teams");
  return await res.json();
}

// Helper to fetch assigned teams for an area
async function fetchAssignedTeams(areaId: string) {
  const url = buildApiUrl('/api/areas/area-teams/') + `?area=${areaId}`;
  const res = await makeAuthenticatedRequest(url);
  if (!res.ok) throw new Error("Failed to fetch assigned teams");
  return await res.json();
}

// Helper to assign a team to an area
async function assignTeamToAreaApi(areaId: string, teamId: string) {
  const url = buildApiUrl('/api/areas/area-teams/');
  const res = await makeAuthenticatedRequest(url, {
    method: "POST",
    body: JSON.stringify({ area: areaId, team: teamId, team_id: teamId }),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to assign team to area:', data);
    throw new Error("Failed to assign team to area");
  }
  return data;
}

// Helper to remove a team from an area
async function removeTeamFromAreaApi(areaTeamId: string) {
  const url = buildApiUrl('/api/areas/area-teams/{id}/', { id: areaTeamId });
  const res = await makeAuthenticatedRequest(url, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove team from area");
}

// Helper to fetch team details by ID (if needed)
async function fetchTeamById(teamId: string) {
  const url = buildApiUrl('/api/teams/teams/{id}/', { id: teamId });
  const res = await makeAuthenticatedRequest(url);
  if (!res.ok) throw new Error('Failed to fetch team details');
  return await res.json();
}

const AreasPage: React.FC = () => {
  const { managerId } = useCampaignContext();
  const [areas, setAreas] = useState<Area[]>([]);
  const [allAreas, setAllAreas] = useState<Area[]>([]); // Store all areas for filtering
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingArea, setDeletingArea] = useState<Area | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assigningArea, setAssigningArea] = useState<Area | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTeamsModalOpen, setAssignTeamsModalOpen] = useState(false);
  const [assignTeamsArea, setAssignTeamsArea] = useState<Area | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [assignedTeam, setAssignedTeam] = useState<Team | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Fetch campaigns for filter dropdown
  useEffect(() => {
    async function fetchCampaigns() {
      setCampaignsLoading(true);
      try {
        const campaignsData = await fetchAllCampaigns();
        setCampaigns(campaignsData);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        toast({
          title: 'Feil',
          description: 'Kunne ikke laste inn kampanjer for filtrering.',
          variant: 'destructive',
        });
      } finally {
        setCampaignsLoading(false);
      }
    }
    fetchCampaigns();
  }, [managerId]);

  // Fetch areas
  useEffect(() => {
    async function fetchAreas() {
      setLoading(true);
      try {
        const areasWithCampaigns = await getAreasWithCampaigns();
        setAllAreas(areasWithCampaigns); // Store all areas
        setAreas(areasWithCampaigns); // Initially show all areas
      } catch (error) {
        console.error('Error fetching areas:', error);
        toast({
          title: 'Feil',
          description: 'Kunne ikke laste inn områder. Vennligst prøv igjen.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    fetchAreas();
  }, [managerId]);

  // Filter areas based on selected campaign
  useEffect(() => {
    if (selectedCampaignFilter === 'all') {
      setAreas(allAreas);
    } else {
      const filteredAreas = allAreas.filter(area => 
        area.campaign?.id === selectedCampaignFilter
      );
      setAreas(filteredAreas);
    }
  }, [selectedCampaignFilter, allAreas]);

  // Handlers
  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setShowEditModal(true);
  };
  const handleDelete = (area: Area) => {
    setDeletingArea(area);
    setShowDeleteModal(true);
  };
  const handleAssign = (area: Area) => {
    setAssigningArea(area);
    setShowAssignModal(true);
  };

  const handleAssignTeams = async (area: Area) => {
    setAssignTeamsArea(area);
    setAssignTeamsModalOpen(true);
    setTeamsLoading(true);
    const allTeams = await getTeamsForManager();
    const areaTeamAssignment = await getAreaTeamAssignment(area.id);
    let assigned: Team | null = null;
    if (areaTeamAssignment) {
      assigned = allTeams.find(t => t.id === areaTeamAssignment.team) || null;
    }
    setAssignedTeam(assigned);
    setAvailableTeams(allTeams.filter(t => !assigned || t.id !== assigned.id));
    setTeamsLoading(false);
  };

  // Save handlers
  const handleSaveEdit = async (id: string, name: string, color: string) => {
    // 1. Role of API: Update area (edit name/color)
    // 2. Input: id, { name, color }; Return: updated area object
    const updated = await updateArea(id, { name, color });
    if (updated) setAreas(areas => areas.map(a => a.id === id ? updated : a));
    setShowEditModal(false);
  };
  const handleAssignTeam = async (areaId: string, teamId: string | null) => {
    // 1. Role of API: Assign team to area
    // 2. Input: areaId, teamId; Return: updated area object
    const updated = await updateArea(areaId, { campaign_id: teamId || "" });
    if (updated) setAreas(areas => areas.map(a => a.id === areaId ? updated : a));
    setShowAssignModal(false);
  };
  const handleConfirmDelete = async (id: string) => {
    // 1. Role of API: Delete area
    // 2. Input: id; Return: success boolean
    const ok = await deleteArea(id);
    if (ok) setAreas(areas => areas.filter(a => a.id !== id));
    setShowDeleteModal(false);
  };

  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="p-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Områder</h1>
          
          {/* Campaign Filter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600">Filtrer etter kampanje:</span>
              <Select
                value={selectedCampaignFilter}
                onValueChange={setSelectedCampaignFilter}
                disabled={campaignsLoading}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={campaignsLoading ? "Laster inn kampanjer..." : "Velg kampanje..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kampanjer</SelectItem>
                  {campaignsLoading ? (
                    <SelectItem value="loading" disabled>Laster inn kampanjer...</SelectItem>
                  ) : campaigns.length === 0 ? (
                    <SelectItem value="no-campaigns" disabled>Ingen kampanjer tilgjengelig</SelectItem>
                  ) : (
                    campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Clear Filter Button */}
            {selectedCampaignFilter !== 'all' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCampaignFilter('all')}
                className="text-gray-600 hover:text-gray-800"
              >
                Fjern filter
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-600">
          Viser {areas.length} av {allAreas.length} områder
          {selectedCampaignFilter !== 'all' && (
            <span> for kampanjen "{campaigns.find(c => c.id === selectedCampaignFilter)?.name}"</span>
          )}
          {selectedCampaignFilter !== 'all' && areas.length === 0 && (
            <span className="text-orange-600 font-medium"> - Ingen områder funnet for denne kampanjen</span>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left font-medium">Navn</th>
                <th className="px-4 py-2 text-left font-medium">Farge</th>
                <th className="px-4 py-2 text-left font-medium">Kampanje</th>
                <th className="px-4 py-2 text-right font-medium">Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8">Laster inn...</td></tr>
              ) : areas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8">
                    {selectedCampaignFilter === 'all' 
                      ? 'Ingen områder funnet.' 
                      : `Ingen områder funnet for valgt kampanje.`
                    }
                  </td>
                </tr>
              ) : (
                areas.map(area => (
                  <tr key={area.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{area.name}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block w-4 h-4 rounded-full mr-2 align-middle" style={{ background: area.color }} />
                      {area.color}
                    </td>
                    <td className="px-4 py-2">{area.campaign?.name || '-'}</td>
                    <td className="px-4 py-2 text-right flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(area)}>Rediger</Button>
                      <Button size="sm" className="bg-black text-white hover:bg-gray-900" onClick={() => handleAssignTeams(area)}>
                        Tildel team
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(area)}>Slett</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Modals for Edit, Assign, Delete will go here */}
        <EditAreaModal
          open={showEditModal}
          area={editingArea}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
        />
        <ConfirmDeleteModal
          open={showDeleteModal}
          area={deletingArea}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleConfirmDelete}
        />
        <AssignTeamsModal
          open={assignTeamsModalOpen}
          area={assignTeamsArea}
          onClose={() => setAssignTeamsModalOpen(false)}
        />
      </div>
      </ClientLayout>
    </ProtectedRoute>
  );
};

const EditAreaModal: React.FC<{
  open: boolean;
  area: Area | null;
  onClose: () => void;
  onSave: (id: string, name: string, color: string) => void;
}> = ({ open, area, onClose, onSave }) => {
  const [name, setName] = useState(area?.name || "");
  const [color, setColor] = useState(area?.color || "");
  useEffect(() => {
    setName(area?.name || "");
    setColor(area?.color || "");
  }, [area, open]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rediger område</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Navn</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Farge</label>
            <Input value={color} onChange={e => setColor(e.target.value)} type="color" className="w-16 h-10 p-0 border-none" />
            <span className="ml-2 text-xs">{color}</span>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} type="button">Avbryt</Button>
          <Button onClick={() => area && onSave(area.id, name, color)} type="button" disabled={!name.trim()}>Lagre</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ConfirmDeleteModal: React.FC<{
  open: boolean;
  area: Area | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}> = ({ open, area, onClose, onConfirm }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Slett område</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <p>Er du sikker på at du vil slette <span className="font-semibold">{area?.name}</span>?</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} type="button">Avbryt</Button>
        <Button variant="destructive" onClick={() => area && onConfirm(area.id)} type="button">Slett</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const AssignTeamsModal: React.FC<{
  open: boolean;
  area: Area | null;
  onClose: () => void;
}> = ({ open, area, onClose }) => {
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [assignedTeams, setAssignedTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch both columns on open or area change
  useEffect(() => {
    if (!open || !area) return;
    setLoading(true);
    Promise.all([
      getTeamsForManager(), // fetch all teams for the current manager
      fetchAssignedTeams(area.id)
    ]).then(([myTeams, assigned]) => {
      // assigned is the full API response, so use .results and extract .team
      const assignedTeamIds = Array.isArray(assigned?.results)
        ? assigned.results.map((at: any) => at.team?.id)
        : [];
      // Only show teams that are not already assigned
      setAvailableTeams(Array.isArray(myTeams) ? myTeams.filter((t: any) => !assignedTeamIds.includes(t.id)) : []);
      setAssignedTeams(Array.isArray(assigned?.results) ? assigned.results : []);
    }).finally(() => setLoading(false));
  }, [open, area]);

  // Assign team: move from available to assigned in real time, with optimistic update
  const handleAssign = async (team: any) => {
    if (!area) return;
    setLoading(true);
    setAvailableTeams(prev => prev.filter(t => t.id !== team.id));
    // Optimistically add to assignedTeams as a fake areaTeam object
    setAssignedTeams(prev => [
      ...prev,
      { id: `temp-${team.id}`, team: { id: team.id, name: team.name, description: team.description } }
    ]);
    try {
      await assignTeamToAreaApi(area.id, team.id);
      const [avail, assigned] = await Promise.all([
        getTeamsForManager(), // Re-fetch all teams to get the latest list
        fetchAssignedTeams(area.id)
      ]);
      const assignedTeamIds = Array.isArray(assigned?.results)
        ? assigned.results.map((at: any) => at.team?.id)
        : [];
      setAvailableTeams(Array.isArray(avail) ? avail.filter((t: any) => !assignedTeamIds.includes(t.id)) : []);
      setAssignedTeams(Array.isArray(assigned?.results) ? assigned.results : []);
    } finally {
      setLoading(false);
    }
  };

  // Unassign team: move from assigned to available in real time, with optimistic update
  const handleUnassign = async (areaTeam: any) => {
    setLoading(true);
    setAssignedTeams(prev => prev.filter(t => t.id !== areaTeam.id));
    setAvailableTeams(prev => [
      ...prev,
      { id: areaTeam.team.id, name: areaTeam.team.name, description: areaTeam.team.description }
    ]);
    try {
      await removeTeamFromAreaApi(areaTeam.id);
      if (area) {
        const [avail, assigned] = await Promise.all([
          getTeamsForManager(), // Re-fetch all teams to get the latest list
          fetchAssignedTeams(area.id)
        ]);
        const assignedTeamIds = Array.isArray(assigned?.results)
          ? assigned.results.map((at: any) => at.team?.id)
          : [];
        setAvailableTeams(Array.isArray(avail) ? avail.filter((t: any) => !assignedTeamIds.includes(t.id)) : []);
        setAssignedTeams(Array.isArray(assigned?.results) ? assigned.results : []);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tildel team til {area?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-8">
          {/* Available Teams */}
          <div className="flex-1 border-r pr-4">
            <h3 className="font-semibold mb-2">Tilgjengelige team</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
              {loading ? (
                <div className="text-gray-400 text-sm">Laster inn...</div>
              ) : availableTeams.length === 0 ? (
                <div className="text-gray-400 text-sm">Ingen tilgjengelige team</div>
              ) : (
                <ul className="space-y-2">
                  {availableTeams.map(team => (
                    <li key={team.id}>
                      <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-xs text-gray-500">{team.description}</div>
                        </div>
                        <UserPlus className="w-8 h-8 text-green-600 cursor-pointer hover:bg-green-100 rounded-full p-1 transition" onClick={() => handleAssign(team)} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Assigned Teams */}
          <div className="flex-1 pl-4">
            <h3 className="font-semibold mb-2">Tildelte team</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
              {loading ? (
                <div className="text-gray-400 text-sm">Laster inn...</div>
              ) : assignedTeams.length === 0 ? (
                <div className="text-gray-400 text-sm">Ingen tildelt team</div>
              ) : (
                <ul className="space-y-2">
                  {assignedTeams.map(areaTeam => (
                    <li key={areaTeam.id}>
                      <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium">{areaTeam.team?.name}</div>
                          <div className="text-xs text-gray-500">{areaTeam.team?.description}</div>
                        </div>
                        <UserMinus className="w-8 h-8 text-red-600 cursor-pointer hover:bg-red-100 rounded-full p-1 transition" onClick={() => handleUnassign(areaTeam)} />
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
          {/* Save Changes closes the popup */}
          <Button type="button" onClick={onClose}>
            Lagre endringer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AreasPage; 