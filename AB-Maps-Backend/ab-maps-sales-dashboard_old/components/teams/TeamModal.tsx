import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Team, CreateTeamData, createTeam } from "@/services/teamService";

interface TeamModalProps {
  open: boolean;
  onClose: () => void;
  team: Team | null;
  onSaved: (teamData: CreateTeamData, id?: string) => void;
  managerId: string;
}

const TeamModal: React.FC<TeamModalProps> = ({ open, onClose, team, onSaved, managerId }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [team, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const teamData: CreateTeamData = {
      name: name.trim(),
      description: description.trim(),
      member_ids: [], // No members on create/edit
    };
    try {
      let teamId = team?.id;
      if (!teamId) {
        // Create the team
        const created = await createTeam(teamData);
        teamId = created.id;
        if (!teamId || typeof teamId !== 'string') return;
        await onSaved(teamData, teamId);
      } else if (typeof teamId === 'string') {
        // Editing existing team: just update name/description
        await onSaved(teamData, teamId);
      }
    } catch (error) {
      console.error("Error saving team:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Rediger team" : "Opprett team"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Teamnavn</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Teamnavn" 
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beskrivelse</label>
            <Input 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Valgfritt" 
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} type="button" disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()} type="button">
            {saving ? "Lagrer..." : team ? "Lagre endringer" : "Opprett team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamModal; 