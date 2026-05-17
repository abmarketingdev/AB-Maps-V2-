"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LessonEditorContent } from "./LessonEditorContent";

export interface LessonEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number | null;
  preselectedSectionId?: number;
  onSaved?: () => void;
}

export function LessonEditorModal({
  open,
  onOpenChange,
  lessonId,
  preselectedSectionId,
  onSaved,
}: LessonEditorModalProps) {
  const [currentLessonId, setCurrentLessonId] = useState<number | null>(lessonId);
  const [currentPreselected, setCurrentPreselected] = useState<number | undefined>(preselectedSectionId);

  useEffect(() => {
    if (open) {
      setCurrentLessonId(lessonId);
      setCurrentPreselected(preselectedSectionId);
    }
  }, [open, lessonId, preselectedSectionId]);

  const handleSuccess = () => {
    onSaved?.();
    onOpenChange(false);
  };

  const handleSelectLesson = (id: number | null, sectionId?: number) => {
    setCurrentLessonId(id);
    setCurrentPreselected(sectionId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[96vw] w-[96vw] h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col border-[#E0E0E0] rounded-xl shadow-2xl"
      >
        <DialogTitle className="sr-only">
          {currentLessonId === null ? "Opprett ny leksjon" : "Rediger leksjon"}
        </DialogTitle>
        <LessonEditorContent
          lessonId={currentLessonId}
          preselectedSectionId={currentPreselected}
          onSuccess={handleSuccess}
          onSelectLesson={handleSelectLesson}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
