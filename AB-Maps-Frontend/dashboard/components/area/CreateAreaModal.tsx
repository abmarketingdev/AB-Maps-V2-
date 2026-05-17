"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Campaign } from "@/services/campaignService";
import { createArea } from "@/services/areaService";
import { toast } from "@/components/ui/use-toast";
import { Clock, Plus } from "lucide-react";

interface CreateAreaModalProps {
  open: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  onSuccess: () => void;
}

// Small default polygon centered on Oslo. The user can refine
// the geometry later by editing the area.
function defaultOsloPolygon() {
  // ~600m × 400m box near Oslo center
  return {
    type: "Polygon",
    coordinates: [[
      [10.745, 59.913],
      [10.760, 59.913],
      [10.760, 59.918],
      [10.745, 59.918],
      [10.745, 59.913],
    ]],
  };
}

const DEFAULT_COLOR = "#3B82F6";

export default function CreateAreaModal({
  open,
  onClose,
  campaigns,
  onSuccess,
}: CreateAreaModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [campaignId, setCampaignId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setColor(DEFAULT_COLOR);
      setCampaignId("none");
      setSaving(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createArea({
        name: name.trim(),
        color,
        polygon_geometry: defaultOsloPolygon(),
        campaign_id: campaignId !== "none" ? campaignId : undefined,
      });
      toast({
        title: "Område opprettet",
        description:
          "Standardpolygon plassert i Oslo sentrum. Bruk Rediger for å justere.",
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Create area failed:", err);
      toast({
        title: "Kunne ikke opprette område",
        description: err?.message ?? "Prøv igjen.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-semibold tracking-tight text-ab-fg">
            Nytt område
          </DialogTitle>
          <DialogDescription className="text-[13px] text-ab-fg-2">
            Opprett et nytt område med standardpolygon. Tildel kampanje og
            ansatte etterpå.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
              Navn
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Sagene Vest"
              disabled={saving}
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
              Farge
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={saving}
                className="w-16 h-10 p-0 border-ab-line cursor-pointer"
              />
              <span className="text-[12px] mono text-ab-fg-2 tabular">
                {color}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
              Kampanje (valgfritt)
            </label>
            <Select
              value={campaignId}
              onValueChange={setCampaignId}
              disabled={saving}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue placeholder="Velg kampanje..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-[11px] text-ab-fg-3 leading-relaxed bg-ab-subtle/40 border border-ab-line-1 rounded-ab-md px-3 py-2">
            Standardpolygon plasseres i Oslo sentrum. Bruk{" "}
            <span className="text-ab-fg-2 font-medium">Rediger</span> på området
            etterpå for å justere geometrien.
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Clock className="h-4 w-4 mr-1.5 animate-spin" />
                Oppretter...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Opprett område
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
