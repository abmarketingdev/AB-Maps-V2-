"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Team, getTeamsForManager, createTeam, updateTeam, deleteTeam, Employee, getAvailableEmployees, CreateTeamData, getTeamMembers, assignEmployeeToManager } from "@/services/teamService";
import { Area, getAreasForManager } from "@/services/areaService";
import TeamTable from "@/components/teams/TeamTable";
import TeamModal from "@/components/teams/TeamModal";
import ConfirmDeleteModal from "@/components/teams/ConfirmDeleteModal";
import ClientLayout from "../ClientLayout";
import { useCampaignContext } from "../ClientLayout";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

const TeamsPage: React.FC = () => {
  const { user } = useAuth();
  const managerId = user?.user_info?.manager_id || user?.user_info?.id || user?.user_id || "";
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!managerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [teamsData, areasData] = await Promise.all([
          getTeamsForManager(managerId),
          getAreasForManager(managerId),
        ]);
        setTeams(teamsData);
        setAreas(areasData);
      } catch (error) {
        console.error("Error fetching teams data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [managerId]);

  // Modal handlers
  const handleCreate = () => {
    setEditingTeam(null);
    setShowTeamModal(true);
  };
  const handleEdit = async (team: Team) => {
    setEditingTeam(team);
    setShowTeamModal(true);
  };

  // Save handlers
  const handleSaveTeam = async (teamData: CreateTeamData, id?: string) => {
    try {
      if (id) {
        const updated = await updateTeam(id, teamData);
        if (updated) {
          setTeams(teams => teams.map(t => t.id === id ? updated : t));
        }
      } else {
        await createTeam(teamData);
        // Re-fetch teams from backend for real-time sync
        const teamsData = await getTeamsForManager(managerId);
        setTeams(teamsData);
      }
      setShowTeamModal(false);
    } catch (error) {
      console.error("Error saving team:", error);
    }
  };

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (teamToDelete && !deleting) {
      setDeleting(true);
      try {
        await deleteTeam(teamToDelete.id);
        setTeams(teams => teams.filter(t => t.id !== teamToDelete.id));
      } catch (error) {
        console.error("Error deleting team:", error);
      } finally {
        setDeleting(false);
        setShowDeleteModal(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading teams...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Team</h1>
        <Button size="sm" onClick={handleCreate}>
          Opprett team
        </Button>
      </div>
      
      {teams.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg font-medium">
            Ingen team funnet.
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Opprett ditt første team for å komme i gang.
          </p>
        </div>
      ) : (
        <TeamTable
          teams={teams}
          areas={areas}
          loading={loading}
          onEdit={handleEdit}
        />
      )}
      
      <TeamModal
        open={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        team={editingTeam}
        onSaved={handleSaveTeam}
        managerId={managerId}
      />
      
      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        team={teamToDelete}
        onConfirmed={handleConfirmDelete}
        deleting={deleting}
      />
    </div>
  );
};

export default function TeamsPageWithLayout() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <TeamsPage />
      </ClientLayout>
    </ProtectedRoute>
  );
} 