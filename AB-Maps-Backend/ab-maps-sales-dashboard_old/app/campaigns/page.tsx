"use client";
import React, { useEffect, useState } from "react";
import ClientLayout from "../ClientLayout";
import CampaignGrid from "@/components/campaign/CampaignGrid";
import CampaignModal from "@/components/campaign/CampaignModal";
import { fetchAllCampaigns, createCampaign, updateCampaign, deleteCampaign, bulkAssignAreasToCampaign } from "@/services/campaignService";

import { Button } from "@/components/ui/button";
import ConfirmDeleteModal from "@/components/campaign/ConfirmDeleteModal";
import { useCampaigns } from "@/components/campaign/CampaignsContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { assignAreaToCampaign, removeAreaFromCampaign, getAreasForCampaign } from '@/services/campaignAreaService';
import { toast } from "@/components/ui/use-toast";
import AssignEmployeesModal from '@/components/campaign/AssignEmployeesModal';
import { Campaign } from "@/services/campaignService";

export default function CampaignPage() {
  const managerId = "mgr1"; // Replace with actual logged-in manager ID
  const { campaigns, loading, createCampaign, updateCampaign, deleteCampaign } = useCampaigns();
  const { user } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCampaignObj, setDeleteCampaignObj] = useState<any>(null);
  const [assignEmployeesModalOpen, setAssignEmployeesModalOpen] = useState(false);
  const [assignEmployeesCampaign, setAssignEmployeesCampaign] = useState<any>(null);
  const [localCampaigns, setLocalCampaigns] = useState<any[]>([]);



  // Sync localCampaigns with context campaigns
  useEffect(() => {
    setLocalCampaigns(campaigns);
  }, [campaigns]);

  const handleCreate = () => {
    setEditCampaign(null);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    let campaignId = data.id;
    let isUpdate = !!data.id;
    let newCampaign;
    try {
      if (isUpdate) {
        newCampaign = await updateCampaign(data.id, {
          name: data.name,
          description: data.description,
          teamIds: data.teamIds || [],
          areaIds: []
        });
        const selectedAreaIds = data.areaIds || [];
        console.debug('[DEBUG] handleSave: campaignId', campaignId, 'selectedAreaIds', selectedAreaIds);
        await bulkAssignAreasToCampaign(campaignId, selectedAreaIds);
        toast({
          title: 'Areas updated',
          description: 'Area assignments updated successfully.',
        });
      } else {
        newCampaign = await createCampaign({
          name: data.name,
          description: data.description,
          teamIds: data.teamIds || [],
          areaIds: []
        });
        campaignId = newCampaign.id;
        const selectedAreaIds = data.areaIds || [];
        await Promise.allSettled(selectedAreaIds.map((areaId: any) => assignAreaToCampaign(campaignId, areaId)));
      }
      setModalOpen(false);
    } catch (err) {
      console.error('[ERROR] handleSave failed:', err);
      setModalOpen(false);
      toast({
        title: 'Error',
        description: 'Failed to update area assignments. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (c: any) => {
    setEditCampaign(c);
    setModalOpen(true);
  };

  const handleDelete = (c: any) => {
    console.log('[DEBUG] handleDelete called with:', c);
    setDeleteCampaignObj(c);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (deleteCampaignObj) {
      // Optimistically remove from UI
      setLocalCampaigns(prev => prev.filter(c => c.id !== deleteCampaignObj.id));
      try {
        await deleteCampaign(deleteCampaignObj.id);
      } catch (err: any) {
        if (err.message && err.message.includes('404')) {
          console.warn('[WARN] Campaign already deleted:', deleteCampaignObj.id);
        } else {
          console.error('[ERROR] Failed to delete campaign:', err);
        }
      }
      setDeleteModalOpen(false);
      setDeleteCampaignObj(null);
    }
  };

  const handleAssignEmployees = (campaign: any) => {
    setAssignEmployeesCampaign(campaign);
    setAssignEmployeesModalOpen(true);
  };

  // Add areaNames to campaigns for display
  const campaignsWithAreaNames = localCampaigns.map(c => ({
    ...c,
    description: c.description || "",
    areaNames: c.areaIds || []
  }));

  return (
    <ClientLayout>
      <div className="flex min-h-screen flex-col bg-muted/40">
        <div className="flex-1 space-y-4 p-4 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Kampanjer</h1>
            <Button onClick={handleCreate}>Opprett kampanje</Button>
          </div>
          <CampaignGrid
            campaigns={campaignsWithAreaNames}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAssignEmployees={handleAssignEmployees}
          />
          <CampaignModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
            initial={editCampaign}
          />
          <ConfirmDeleteModal
            open={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            campaign={deleteCampaignObj}
            onConfirmed={handleDeleteConfirmed}
          />
          <AssignEmployeesModal
            open={assignEmployeesModalOpen}
            campaign={assignEmployeesCampaign}
            onClose={() => setAssignEmployeesModalOpen(false)}
          />
        </div>
      </div>
    </ClientLayout>
  );
} 