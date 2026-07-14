import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { assignAreaToCampaign, removeAreaFromCampaign } from "@/services/campaignAreaService";
import { Area } from "@/services/areaService";
import { makeAuthenticatedRequest } from "@/services/campaignAreaService";
import { API_CONFIG, buildApiUrl } from '@/lib/config/apiConfig';

interface AssignAreasModalProps {
  open: boolean;
  campaign: any;
  areas: Area[];
  onClose: () => void;
}

// Helper to fetch available areas for a campaign (with auth)
async function fetchAvailableAreasForCampaign(campaignId: string): Promise<Area[]> {
  try {
    const url = buildApiUrl('/api/areas/areas/available_for_campaign/') + `?campaign=${campaignId}`;
    const res = await makeAuthenticatedRequest(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

// Helper to fetch assigned areas for a campaign (with auth)
async function fetchAssignedAreasForCampaign(campaignId: string): Promise<{ id: string; area: Area }[]> {
  try {
    const url = buildApiUrl('/api/campaigns/campaign-areas/') + `?campaign=${campaignId}`;
    const res = await makeAuthenticatedRequest(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map((ca: any) => ({
      id: ca.id,
      area: ca.area, // Use the full area object from the API
    }));
  } catch (e) {
    return [];
  }
}

const AssignAreasModal: React.FC<AssignAreasModalProps> = ({ open, campaign, areas, onClose }) => {
  const [availableAreas, setAvailableAreas] = useState<Area[]>([]);
  const [assignedAreas, setAssignedAreas] = useState<{ id: string; area: Area }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('AssignAreasModal open:', open, 'campaign:', campaign);
    if (!open || !campaign) return;
    setLoading(true);
    Promise.all([
      fetchAvailableAreasForCampaign(campaign.id),
      fetchAssignedAreasForCampaign(campaign.id),
    ]).then(([avail, assigned]) => {
      setAvailableAreas(Array.isArray(avail) ? avail : []);
      setAssignedAreas(Array.isArray(assigned) ? assigned : []);
    }).finally(() => setLoading(false));
  }, [open, campaign]);

  if (!campaign) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Loading campaign...</DialogTitle>
          </DialogHeader>
          <div className="text-ab-fg-3 text-center py-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Assign area: move from available to assigned in real time, with optimistic update
  const handleAssign = async (area: Area) => {
    if (!campaign) return;
    setAvailableAreas(prev => prev.filter(a => a.id !== area.id));
    setAssignedAreas(prev => [...prev, { id: `temp-${area.id}`, area }]);
    try {
      await assignAreaToCampaign(campaign.id, area.id);
      const [avail, assigned] = await Promise.all([
        fetchAvailableAreasForCampaign(campaign.id),
        fetchAssignedAreasForCampaign(campaign.id),
      ]);
      setAvailableAreas(Array.isArray(avail) ? avail : []);
      setAssignedAreas(Array.isArray(assigned) ? assigned : []);
    } finally {
      // no-op
    }
  };

  // Unassign area: move from assigned to available in real time, with optimistic update
  const handleUnassign = async (campaignAreaId: string, area: Area) => {
    // Fix: Only check startsWith if campaignAreaId is a string
    if (typeof campaignAreaId === 'string' && campaignAreaId.startsWith('temp-')) {
      setAssignedAreas(prev => prev.filter(a => a.id !== campaignAreaId));
      setAvailableAreas(prev => [...prev, area]);
      return;
    }
    setAssignedAreas(prev => prev.filter(a => a.id !== campaignAreaId));
    setAvailableAreas(prev => [...prev, area]);
    try {
      await removeAreaFromCampaign(campaignAreaId);
      if (campaign) {
        const [avail, assigned] = await Promise.all([
          fetchAvailableAreasForCampaign(campaign.id),
          fetchAssignedAreasForCampaign(campaign.id),
        ]);
        setAvailableAreas(Array.isArray(avail) ? avail : []);
        setAssignedAreas(Array.isArray(assigned) ? assigned : []);
      }
    } finally {
      // no-op
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Assign Areas to {campaign?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Available Areas */}
          <div className="flex-1 sm:border-r sm:border-ab-line sm:pr-4">
            <h3 className="font-semibold mb-2">Available Areas</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-ab-inset rounded p-2">
              {loading ? (
                <div className="text-ab-fg-3 text-sm">Loading...</div>
              ) : availableAreas.length === 0 ? (
                <div className="text-ab-fg-3 text-sm">No available areas</div>
              ) : (
                <ul className="space-y-2">
                  {availableAreas.map((area) => (
                    <li key={area.id}>
                      <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium">{area.name}</div>
                          <div className="text-xs text-ab-fg-3">{area.color}</div>
                        </div>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-green-100 rounded-full transition border border-green-200"
                          title="Assign"
                          onClick={() => handleAssign(area)}
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
          {/* Assigned Areas */}
          <div className="flex-1 sm:pl-4">
            <h3 className="font-semibold mb-2">Assigned Areas</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-ab-inset rounded p-2">
              {loading ? (
                <div className="text-ab-fg-3 text-sm">Loading...</div>
              ) : assignedAreas.length === 0 ? (
                <div className="text-ab-fg-3 text-sm">No assigned areas</div>
              ) : (
                <ul className="space-y-2">
                  {assignedAreas.map((a) => {
                    // Use a unique key: for temp assignments use 'temp-' + area.id, else use a.id
                    const isTemp = typeof a.id === 'string' && a.id.startsWith('temp-');
                    const key = isTemp && a.area && a.area.id ? `temp-${a.area.id}` : a.id;
                    return (
                      <li key={key}>
                        <div className="flex items-center justify-between bg-ab-elevated rounded shadow p-3 hover:bg-ab-hover transition">
                          <div>
                            <div className="font-medium">{a.area.name}</div>
                            <div className="text-xs text-ab-fg-3">{a.area.color}</div>
                          </div>
                          <button
                            className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-100 rounded-full transition border border-red-200"
                            title="Unassign"
                            onClick={() => handleUnassign(a.id, a.area)}
                          >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} type="button">
            Close
          </Button>
          <Button type="button" className="bg-black text-white hover:bg-gray-900" onClick={onClose}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignAreasModal; 