"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";
import { Layers, ChevronDown, Plus, Shuffle, Check, MapIcon as MapIcn } from "lucide-react";
import ClientLayout, { useCampaignContext } from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { PageHeader } from "@/components/ui-ab";
import {
  Area,
  getAreasWithCampaigns,
  updateArea,
  deleteArea,
} from "@/services/areaService";
import {
  getAssignedEmployeesForArea,
  Employee,
} from "@/services/areaEmployeeService";
import { fetchAllCampaigns, Campaign } from "@/services/campaignService";
import EnhancedAssignEmployeesModal from "@/components/area/EnhancedAssignEmployeesModal";
import CreateAreaModal from "@/components/area/CreateAreaModal";
import { AreasList } from "@/components/area/AreasList";
import { AreasMap } from "@/components/area/AreasMap";
import { AreasWorkloadDock, DockEmployee } from "@/components/area/AreasWorkloadDock";
import { cn } from "@/lib/utils";

const AreasPage: React.FC = () => {
  const { managerId } = useCampaignContext();

  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignFilter, setSelectedCampaignFilter] =
    useState<string>("all");
  const [campaignFilterOpen, setCampaignFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigneesLoading, setAssigneesLoading] = useState(false);

  // Per-area assignees map — fetched in parallel from existing service.
  const [areaAssignees, setAreaAssignees] = useState<
    Record<string, Employee[]>
  >({});

  // Shared selection / hover between list and map
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null);

  // Workload dock employee highlight → highlights matching areas on map
  const [highlightedEmployeeId, setHighlightedEmployeeId] =
    useState<string | null>(null);

  // Mobile map collapse
  const [mapVisible, setMapVisible] = useState(true);

  // Modal state — Edit + Delete inline modals from the original page, plus the
  // existing standalone AssignEmployees modal.
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingArea, setDeletingArea] = useState<Area | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assigningEmployeesArea, setAssigningEmployeesArea] =
    useState<Area | null>(null);
  const [showAssignEmployeesModal, setShowAssignEmployeesModal] =
    useState(false);

  // --- Initial fetch: campaigns + areas in parallel ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [campaignsData, areasData] = await Promise.all([
          fetchAllCampaigns().catch((err) => {
            console.error("Error fetching campaigns:", err);
            toast({
              title: "Feil",
              description: "Kunne ikke laste inn kampanjer for filtrering.",
              variant: "destructive",
            });
            return [] as Campaign[];
          }),
          getAreasWithCampaigns().catch((err) => {
            console.error("Error fetching areas:", err);
            toast({
              title: "Feil",
              description:
                "Kunne ikke laste inn områder. Vennligst prøv igjen.",
              variant: "destructive",
            });
            return [] as Area[];
          }),
        ]);
        if (cancelled) return;
        setCampaigns(campaignsData);
        setAllAreas(areasData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [managerId]);

  // --- Fetch assignees per area in parallel ---
  useEffect(() => {
    if (allAreas.length === 0) {
      setAreaAssignees({});
      return;
    }
    let cancelled = false;
    setAssigneesLoading(true);
    Promise.all(
      allAreas.map((a) =>
        getAssignedEmployeesForArea(a.id)
          .then((emps) => [a.id, emps] as const)
          .catch(() => [a.id, [] as Employee[]] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, Employee[]> = {};
      entries.forEach(([id, emps]) => {
        next[id] = emps;
      });
      setAreaAssignees(next);
      setAssigneesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [allAreas]);

  // --- Derived: filtered areas + decorate with assignees ---
  const areas = useMemo(() => {
    const base =
      selectedCampaignFilter === "all"
        ? allAreas
        : allAreas.filter((a) => a.campaign?.id === selectedCampaignFilter);
    return base.map((a) => ({
      ...a,
      __assignees: (areaAssignees[a.id] ?? []).map((e) => ({
        id: e.id,
        name: e.name,
      })),
    }));
  }, [allAreas, selectedCampaignFilter, areaAssignees]);

  // --- Derived: dock employees (invert area→assignees map) ---
  const dockEmployees = useMemo<DockEmployee[]>(() => {
    const m = new Map<string, DockEmployee>();
    Object.entries(areaAssignees).forEach(([areaId, emps]) => {
      emps.forEach((e) => {
        const existing = m.get(e.id);
        if (existing) {
          if (!existing.areaIds.includes(areaId)) existing.areaIds.push(areaId);
        } else {
          m.set(e.id, {
            id: e.id,
            name: e.name,
            email: e.email,
            areaIds: [areaId],
          });
        }
      });
    });
    return Array.from(m.values());
  }, [areaAssignees]);

  // --- Highlighted area ids derived from employee click ---
  const highlightedAreaIds = useMemo(() => {
    if (!highlightedEmployeeId) return null;
    const emp = dockEmployees.find((e) => e.id === highlightedEmployeeId);
    return emp ? emp.areaIds : [];
  }, [highlightedEmployeeId, dockEmployees]);

  // --- Handlers ---
  const handleSaveEdit = async (id: string, name: string, color: string) => {
    try {
      const updated = await updateArea(id, { name, color });
      if (updated) {
        setAllAreas((prev) => prev.map((a) => (a.id === id ? updated : a)));
        toast({ title: "Område oppdatert" });
      }
    } catch (e) {
      toast({
        title: "Kunne ikke lagre",
        description: "Prøv igjen.",
        variant: "destructive",
      });
    } finally {
      setShowEditModal(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      const ok = await deleteArea(id);
      if (ok) {
        setAllAreas((prev) => prev.filter((a) => a.id !== id));
        if (selectedAreaId === id) setSelectedAreaId(null);
        toast({ title: "Område slettet" });
      }
    } catch (e) {
      toast({
        title: "Kunne ikke slette",
        description: "Prøv igjen.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleAssignSuccess = async () => {
    // Refresh assignees for the affected area
    if (!assigningEmployeesArea) return;
    const id = assigningEmployeesArea.id;
    try {
      const emps = await getAssignedEmployeesForArea(id);
      setAreaAssignees((prev) => ({ ...prev, [id]: emps }));
    } catch {
      /* ignore */
    }
  };

  const selectedCampaignName =
    selectedCampaignFilter === "all"
      ? "Alle kampanjer"
      : campaigns.find((c) => c.id === selectedCampaignFilter)?.name ?? "Alle kampanjer";

  const [showCreateModal, setShowCreateModal] = useState(false);
  const handleNewArea = () => setShowCreateModal(true);
  const handleCreateSuccess = async () => {
    // Refresh full area list so the new row + polygon appear immediately
    try {
      const data = await getAreasWithCampaigns();
      setAllAreas(data);
    } catch (err) {
      console.error("Refresh areas after create failed:", err);
    }
  };
  // TODO: wire "Stokk om" if/when a reshuffle endpoint exists.
  const handleShuffle = () => {
    toast({
      title: "Stokk om er ikke konfigurert ennå",
      description: "Funksjonen kommer i en senere oppdatering.",
    });
  };

  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="relative flex flex-col min-h-screen bg-ab-base bg-page-glow">
          {/* Atmosphere — matches Statistikk / Rapport / Oppgaver */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
            style={{
              maskImage: "linear-gradient(to bottom, black, transparent 70%)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col flex-1 min-h-screen">
            <PageHeader
              eyebrow="GEOGRAFISK FORDELING · KAPASITET"
              title="Områder"
              action={
                <div className="flex items-center gap-2">
                  {/* Campaign filter pill — preserves existing filter state */}
                  <Popover
                    open={campaignFilterOpen}
                    onOpenChange={setCampaignFilterOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
                          "border bg-ab-elevated text-[12px] transition-colors",
                          "hover:border-ab-line-2 hover:bg-ab-hover",
                          campaignFilterOpen
                            ? "ring-2 ring-ab-accent/15 border-ab-accent/30"
                            : "border-ab-line",
                        )}
                      >
                        {selectedCampaignFilter !== "all" && (
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 rounded-full bg-ab-accent shrink-0"
                          />
                        )}
                        <Layers className="h-3 w-3 text-ab-fg-3" />
                        <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
                          Kampanje:
                        </span>
                        <span className="text-ab-fg font-medium truncate max-w-[160px]">
                          {selectedCampaignName}
                        </span>
                        <ChevronDown className="h-3 w-3 text-ab-fg-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-[320px] p-0 bg-ab-canvas border-ab-line"
                    >
                      <Command className="bg-transparent">
                        <CommandInput placeholder="Søk kampanjer..." className="h-9" />
                        <CommandList className="max-h-64">
                          <CommandEmpty>Ingen kampanjer funnet.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="Alle kampanjer"
                              onSelect={() => {
                                setSelectedCampaignFilter("all");
                                setCampaignFilterOpen(false);
                              }}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <span className="text-[13px]">Alle kampanjer</span>
                              {selectedCampaignFilter === "all" && (
                                <Check className="h-3.5 w-3.5 text-ab-accent" />
                              )}
                            </CommandItem>
                            {campaigns.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setSelectedCampaignFilter(c.id);
                                  setCampaignFilterOpen(false);
                                }}
                                className="flex items-center justify-between cursor-pointer"
                              >
                                <span className="text-[13px] truncate">
                                  {c.name}
                                </span>
                                {selectedCampaignFilter === c.id && (
                                  <Check className="h-3.5 w-3.5 text-ab-accent shrink-0" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <button
                    type="button"
                    onClick={handleShuffle}
                    className="ab-btn ghost"
                    title="Omfordel områder mellom ansatte"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    Stokk om
                  </button>

                  <button
                    type="button"
                    onClick={handleNewArea}
                    className="ab-btn primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nytt område
                  </button>
                </div>
              }
            />

            {/* Body — three zones. Row 1: list+map (explicit height so MapLibre
                 reads real container dimensions). Row 2: workload dock. */}
            <div className="flex flex-col">
              <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_1fr] divide-y xl:divide-y-0 xl:divide-x divide-ab-line border-t border-ab-line h-[calc(100vh-260px)] min-h-[520px]">
                {/* LEFT: list */}
                <div className="h-full flex flex-col overflow-hidden">
                  <AreasList
                    areas={areas}
                    loading={loading}
                    selectedAreaId={selectedAreaId}
                    hoveredAreaId={hoveredAreaId}
                    onAreaSelect={(id) => setSelectedAreaId(id)}
                    onAreaHover={(id) => setHoveredAreaId(id)}
                    onEdit={(a) => {
                      setEditingArea(a);
                      setShowEditModal(true);
                    }}
                    onAssignEmployees={(a) => {
                      setAssigningEmployeesArea(a);
                      setShowAssignEmployeesModal(true);
                    }}
                    onDelete={(a) => {
                      setDeletingArea(a);
                      setShowDeleteModal(true);
                    }}
                    onClearFilters={() => setSelectedCampaignFilter("all")}
                    hasActiveFilters={selectedCampaignFilter !== "all"}
                  />
                </div>

                {/* RIGHT: map (full bleed). Explicit height for MapLibre. */}
                <div
                  className={cn(
                    "relative overflow-hidden h-full min-h-[480px]",
                    !mapVisible && "hidden xl:block",
                  )}
                >
                  <AreasMap
                    areas={areas}
                    selectedAreaId={selectedAreaId}
                    hoveredAreaId={hoveredAreaId}
                    highlightedAreaIds={highlightedAreaIds}
                    onAreaSelect={(id) => setSelectedAreaId(id)}
                    onAreaHover={(id) => setHoveredAreaId(id)}
                    onOpenEdit={(a) => {
                      setEditingArea(a);
                      setShowEditModal(true);
                    }}
                  />
                </div>

                {/* Mobile map toggle */}
                <button
                  type="button"
                  onClick={() => setMapVisible((v) => !v)}
                  className="xl:hidden flex items-center justify-center gap-2 h-10 border-t border-ab-line bg-ab-elevated text-[13px] text-ab-fg-2 hover:text-ab-fg"
                >
                  <MapIcn className="h-3.5 w-3.5" />
                  {mapVisible ? "Skjul kart" : "Vis kart"}
                </button>
              </div>

              {/* Workload dock — hidden on small screens for breathing room */}
              <div className="hidden md:block">
                <AreasWorkloadDock
                  employees={dockEmployees}
                  loading={assigneesLoading || loading}
                  highlightedEmployeeId={highlightedEmployeeId}
                  onEmployeeClick={(id) => setHighlightedEmployeeId(id)}
                />
              </div>
            </div>
          </div>

          {/* Edit modal — preserved verbatim from original page */}
          <EditAreaModal
            open={showEditModal}
            area={editingArea}
            onClose={() => setShowEditModal(false)}
            onSave={handleSaveEdit}
          />

          {/* Delete confirm modal — preserved verbatim */}
          <ConfirmDeleteModal
            open={showDeleteModal}
            area={deletingArea}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleConfirmDelete}
          />

          {/* Assign employees modal — reuses existing component */}
          <EnhancedAssignEmployeesModal
            open={showAssignEmployeesModal}
            area={assigningEmployeesArea}
            onClose={() => setShowAssignEmployeesModal(false)}
            onSuccess={handleAssignSuccess}
          />

          {/* Nytt område modal */}
          <CreateAreaModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            campaigns={campaigns}
            onSuccess={handleCreateSuccess}
          />
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
};

// ---- Inline modals (preserved verbatim from original page) ----

const EditAreaModal: React.FC<{
  open: boolean;
  area: Area | null;
  onClose: () => void;
  onSave: (id: string, name: string, color: string) => void;
}> = ({ open, area, onClose, onSave }) => {
  const [name, setName] = useState(area?.name || "");
  const [color, setColor] = useState(area?.color || "");
  useEffect(() => {
    setName(area?.name || "");
    setColor(area?.color || "");
  }, [area, open]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rediger område</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Navn</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Farge</label>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              type="color"
              className="w-16 h-10 p-0 border-none"
            />
            <span className="ml-2 text-xs">{color}</span>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} type="button">
            Avbryt
          </Button>
          <Button
            onClick={() => area && onSave(area.id, name, color)}
            type="button"
            disabled={!name.trim()}
          >
            Lagre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ConfirmDeleteModal: React.FC<{
  open: boolean;
  area: Area | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}> = ({ open, area, onClose, onConfirm }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Slett område</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <p>
          Er du sikker på at du vil slette{" "}
          <span className="font-semibold">{area?.name}</span>?
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} type="button">
          Avbryt
        </Button>
        <Button
          variant="destructive"
          onClick={() => area && onConfirm(area.id)}
          type="button"
        >
          Slett
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default AreasPage;
