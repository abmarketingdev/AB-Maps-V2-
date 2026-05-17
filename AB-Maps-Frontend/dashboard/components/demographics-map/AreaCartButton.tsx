"use client";

import { Lock, ChevronRight } from "lucide-react";
import { useAreasLockStore } from "@/stores/areasLockStore";
import { cn } from "@/lib/utils";

/**
 * AreaCartButton Component
 * 
 * Phase 4: Floating cart-style button showing selected area count
 * 
 * Features:
 * - Shows count of selected areas
 * - Clicking opens the locked areas panel
 * - Hidden when no selection and panel is closed
 * - Positioned top-right, below navigation controls
 */
export function AreaCartButton() {
  const selectedCount = useAreasLockStore((state) => state.selectedAreaKeys.size);
  const lockedCount = useAreasLockStore((state) => state.lockedAreaKeys.size);
  const panelOpen = useAreasLockStore((state) => state.panelOpen);
  const openPanel = useAreasLockStore((state) => state.openPanel);

  // Hide if no selection, no locked areas, and panel closed
  if (selectedCount === 0 && lockedCount === 0 && !panelOpen) return null;

  return (
    <button
      onClick={openPanel}
      className={cn(
        "absolute top-20 right-4 z-20",
        "flex items-center gap-2",
        "bg-white shadow-lg rounded-full",
        "px-4 py-2.5",
        "border border-gray-200",
        "hover:bg-gray-50 hover:shadow-xl",
        "transition-all duration-200",
        "group"
      )}
      aria-label={`Åpne områdepanel. ${selectedCount} valgt, ${lockedCount} låst.`}
    >
      <Lock className="h-4 w-4 text-gray-600 group-hover:text-orange-600 transition-colors" />
      
      <div className="flex items-center gap-2">
        {/* Selected count badge */}
        {selectedCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="font-medium text-gray-900">Valgt</span>
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {selectedCount}
            </span>
          </span>
        )}
        
        {/* Separator when both counts shown */}
        {selectedCount > 0 && lockedCount > 0 && (
          <span className="text-gray-300">|</span>
        )}
        
        {/* Locked count badge */}
        {lockedCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="font-medium text-gray-600">Låst</span>
            <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {lockedCount}
            </span>
          </span>
        )}
        
        {/* Empty state - just show icon when panel is open but nothing selected */}
        {selectedCount === 0 && lockedCount === 0 && panelOpen && (
          <span className="font-medium text-gray-500">Områder</span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
    </button>
  );
}

export default AreaCartButton;

