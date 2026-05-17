import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Team } from "@/services/teamService";

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  team: Team | null;
  onConfirmed: () => void;
  deleting?: boolean;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ open, onClose, team, onConfirmed, deleting = false }) => {

  const handleDelete = () => {
    if (!team) return;
    // The parent component will handle the actual deletion
    onConfirmed();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slett team</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Er du sikker på at du vil slette <span className="font-semibold">{team?.name}</span>?</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button" disabled={deleting}>
            Avbryt
          </Button>
          <Button variant="destructive" onClick={handleDelete} type="button" disabled={deleting}>
            {deleting ? "Sletter..." : "Slett"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDeleteModal; 