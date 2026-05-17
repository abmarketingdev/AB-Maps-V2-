import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteCampaign } from "@/services/campaignService";

interface Campaign {
  id: string;
  name: string;
}

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  onConfirmed: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ open, onClose, campaign, onConfirmed }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      console.log("[DEBUG] Deleting campaign:", campaign);
      if (!campaign || !campaign.id) {
        console.error("[DEBUG] No campaign or campaign.id provided to deleteCampaign");
        return;
      }
      console.log("[DEBUG] Calling deleteCampaign with id:", campaign.id);
      setDeleting(true);
      // 1. Role of API: Delete campaign
      // 2. Input: campaign.id; Return: success boolean
      await deleteCampaign(campaign.id);
      setDeleting(false);
      onConfirmed();
    } catch (error) {
      console.error("Error deleting campaign:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slett kampanje</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Er du sikker på at du vil slette <span className="font-semibold">{campaign?.name}</span>?</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button" disabled={deleting}>
            Avbryt
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting} type="button">
            {deleting ? "Sletter..." : "Slett"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDeleteModal; 