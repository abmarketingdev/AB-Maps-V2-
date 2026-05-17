import React, { useState } from "react";
import { Button } from "../ui/button";

interface AreaSelectModalProps {
  open: boolean;
  onClose: () => void;
  areas: any[];
  selected: string[];
  onSelect: (ids: string[]) => void;
}

export default function AreaSelectModal({ open, onClose, areas, selected, onSelect }: AreaSelectModalProps) {
  const [search, setSearch] = useState("");
  const filtered = areas.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onSelect(selected.filter(s => s !== id));
    } else {
      onSelect([...selected, id]);
    }
  };

  return open ? (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Areas</h2>
        <input placeholder="Search areas..." value={search} onChange={e => setSearch(e.target.value)} className="w-full mb-2 p-2 border rounded" />
        <div className="max-h-64 overflow-y-auto mb-4">
          {filtered.map(a => (
            <div
              key={a.id}
              onClick={() => toggle(a.id)}
              className={`flex items-center gap-3 p-2 rounded cursor-pointer ${selected.includes(a.id) ? "bg-blue-100" : "hover:bg-gray-100"}`}
            >
              <input type="checkbox" checked={selected.includes(a.id)} readOnly />
              <span className="font-medium">{a.name}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  ) : null;
} 