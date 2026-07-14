"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Loader2, Search, Trash2, X, AlertTriangle } from "lucide-react";
import { useAreasLockStore } from "@/stores/areasLockStore";
import { SelectedAreasList, LockedAreasList } from "./AreaList";

/**
 * LockedAreasPanel Component
 * 
 * Phase 5: Right-side panel with tabs for selected and locked areas
 * 
 * Features:
 * - Two tabs: Selected (client-side) and Locked (server-side)
 * - Grouped lists by area type (fylke, kommune, grunnkrets)
 * - Lock selected areas button
 * - Per-row unlock buttons
 * - Search filter for locked areas
 * - Loading states
 */
export function LockedAreasPanel() {
  const [searchQuery, setSearchQuery] = useState("");

  // Store state and actions
  const panelOpen = useAreasLockStore((state) => state.panelOpen);
  const closePanel = useAreasLockStore((state) => state.closePanel);
  const activeTab = useAreasLockStore((state) => state.activeTab);
  const setActiveTab = useAreasLockStore((state) => state.setActiveTab);
  const selectedAreas = useAreasLockStore((state) => state.selectedAreas);
  const lockedAreas = useAreasLockStore((state) => state.lockedAreas);
  const isLoading = useAreasLockStore((state) => state.isLoading);
  const removeSelection = useAreasLockStore((state) => state.removeSelection);
  const clearSelection = useAreasLockStore((state) => state.clearSelection);
  const lockSelectedAreas = useAreasLockStore((state) => state.lockSelectedAreas);
  const unlockAreas = useAreasLockStore((state) => state.unlockAreas);
  const campaignId = useAreasLockStore((state) => state.campaignId);

  // Convert Map to array for list
  const selectedAreasArray = useMemo(() => {
    return Array.from(selectedAreas.values());
  }, [selectedAreas]);

  const selectedCount = selectedAreas.size;
  const lockedCount = lockedAreas.length;

  // Keyboard shortcut: Escape to close panel
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape" && panelOpen) {
      closePanel();
    }
  }, [panelOpen, closePanel]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Handle lock button click
  const handleLockSelected = async () => {
    await lockSelectedAreas();
    // Switch to locked tab after successful lock
    setActiveTab("locked");
  };

  // Handle tab change with type safety
  const handleTabChange = (value: string) => {
    if (value === "selected" || value === "locked") {
      setActiveTab(value);
    }
  };

  return (
    <Sheet open={panelOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-ab-fg-2" />
              <SheetTitle className="text-xl">Områder</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={closePanel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SheetDescription>
            Velg områder på kartet og lås dem for denne kampanjen
          </SheetDescription>
        </SheetHeader>

        {/* No campaign warning */}
        {!campaignId && (
          <Alert variant="destructive" className="mx-6 mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Ingen kampanje valgt. Velg en kampanje for å låse områder.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex-1 flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-2 mx-6 mt-4" style={{ width: "calc(100% - 48px)" }}>
            <TabsTrigger value="selected" className="flex items-center gap-2">
              Valgt
              {selectedCount > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {selectedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="locked" className="flex items-center gap-2">
              Låst
              {lockedCount > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {lockedCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Selected Tab */}
          <TabsContent value="selected" className="flex-1 flex flex-col px-6 mt-4">
            <SelectedAreasList
              areas={selectedAreasArray}
              onRemove={removeSelection}
              isLoading={isLoading}
            />

            {/* Action buttons */}
            <div className="border-t pt-4 mt-4 space-y-2">
              <Button
                onClick={handleLockSelected}
                disabled={selectedCount === 0 || isLoading || !campaignId}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Låser...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Lås valgte ({selectedCount})
                  </>
                )}
              </Button>

              {selectedCount > 0 && (
                <Button
                  variant="outline"
                  onClick={clearSelection}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Fjern alle valg
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Locked Tab */}
          <TabsContent value="locked" className="flex-1 flex flex-col px-6 mt-4">
            {/* Search input */}
            {lockedCount > 5 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ab-fg-3" />
                <Input
                  type="text"
                  placeholder="Søk etter område..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            <LockedAreasList
              areas={lockedAreas}
              onUnlock={unlockAreas}
              isLoading={isLoading}
              searchQuery={searchQuery}
            />

            {/* Unlock all button (optional) */}
            {lockedCount > 1 && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-ab-fg-3 text-center mb-2">
                  Hold musepekeren over et område for å låse det opp
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export default LockedAreasPanel;

