import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Team, updateTeam, getTeamMembers } from "@/services/teamService";
import { Area, assignEmployeeToArea } from "@/services/areaService";

interface AssignAreaModalProps {
  open: boolean;
  onClose: () => void;
  team: Team | null;
  areas: Area[];
  onSaved: () => void;
}

const AssignAreaModal: React.FC<AssignAreaModalProps> = ({ open, onClose, team, areas, onSaved }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (team) setSelected(team.areaIds);
    else setSelected([]);
  }, [team, open]);

  const handleSave = async () => {
    if (!team) return;
    setSaving(true);
    await updateTeam(team.id, { areaIds: selected });
    // Assign all team members to all selected areas
    try {
      const members = await getTeamMembers(team.id);
      await Promise.all(
        members.flatMap((emp) =>
          selected.map((areaId) =>
            assignEmployeeToArea(areaId, emp.id).catch((err) => {
              console.error(`Failed to assign employee ${emp.id} to area ${areaId}:`, err);
            })
          )
        )
      );
    } catch (err) {
      console.error("Failed to assign team members to areas:", err);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Areas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="border rounded p-2 min-h-[40px]">
              {areas.map(area => (
                <label key={area.id} className="inline-flex items-center mr-4 mb-1">
                  <input
                    type="checkbox"
                    checked={selected.includes(area.id)}
                    onChange={e => {
                      if (e.target.checked) setSelected([...selected, area.id]);
                      else setSelected(selected.filter(id => id !== area.id));
                    }}
                    className="mr-2"
                  />
                  {area.name}
                </label>
              ))}
              {areas.length === 0 && <span className="text-muted-foreground text-xs">No areas available</span>}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} type="button" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} type="button">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignAreaModal; 