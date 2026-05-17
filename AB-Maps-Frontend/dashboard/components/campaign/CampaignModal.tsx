import React, { useState } from "react";
// import AreaSelectModal from "./AreaSelectModal"; // Removed: file does not exist
import { Button } from "../ui/button";

interface CampaignModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initial?: any;
  areas?: any[];
}

export default function CampaignModal({ open, onClose, onSave, initial, areas }: CampaignModalProps) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [selectedAreas, setSelectedAreas] = useState(initial?.areaIds || []);
  const [showAreaModal, setShowAreaModal] = useState(false);

  React.useEffect(() => {
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setSelectedAreas(initial?.areaIds || []);
  }, [initial, open]);

  const handleSave = () => {
    // 1. Role of API: Create or update campaign (delegated to parent)
    // 2. Input: { name, description, areaIds } (+ id for update); Return: created/updated campaign object
    onSave({
      ...initial,
      name,
      description,
      areaIds: selectedAreas
    });
  };

  return open ? (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <div
        className="bg-ab-canvas text-ab-fg border border-ab-line rounded-ab-lg shadow-xl p-6 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold tracking-tight text-ab-fg mb-4">
          {initial ? "Rediger kampanje" : "Opprett kampanje"}
        </h2>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Kampanjenavn"
          className="ab-input w-full mb-2"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Beskrivelse (valgfritt)"
          className="ab-input w-full mb-2"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={handleSave} disabled={!name}>
            {initial ? "Lagre endringer" : "Opprett kampanje"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;
} 