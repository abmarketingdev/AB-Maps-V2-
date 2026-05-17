"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionEditorContent } from "./SectionEditorContent";

export interface SectionEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: number | null;
  onSaved?: () => void;
}

export function SectionEditorModal({
  open,
  onOpenChange,
  sectionId,
  onSaved,
}: SectionEditorModalProps) {
  const [currentSectionId, setCurrentSectionId] = useState<number | null>(sectionId);

  React.useEffect(() => {
    if (open) setCurrentSectionId(sectionId);
  }, [open, sectionId]);

  const handleSuccess = () => {
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[96vw] w-[96vw] h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col border-[#E0E0E0] rounded-xl shadow-2xl"
      >
        <DialogTitle className="sr-only">
          {currentSectionId === null ? "Opprett ny seksjon" : "Rediger seksjon"}
        </DialogTitle>
        <SectionEditorContent
          sectionId={currentSectionId}
          onSuccess={handleSuccess}
          onSelectSection={(id) => setCurrentSectionId(id)}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
