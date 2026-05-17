"use client";

import React, { useEffect, useMemo, useState } from "react";
import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { PageHeader } from "@/components/ui-ab";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/components/ui/use-toast";

import CampaignModal from "@/components/campaign/CampaignModal";
import ConfirmDeleteModal from "@/components/campaign/ConfirmDeleteModal";
import AssignEmployeesModal from "@/components/campaign/AssignEmployeesModal";
import { CampaignsListView, CampaignMetrics } from "@/components/campaign/CampaignsListView";
import { CampaignsGridView } from "@/components/campaign/CampaignsGridView";
import { CampaignDetailSheet } from "@/components/campaign/CampaignDetailSheet";

import {
  Campaign,
  bulkAssignAreasToCampaign,
} from "@/services/campaignService";
import { assignAreaToCampaign } from "@/services/campaignAreaService";
import { useCampaigns } from "@/components/campaign/CampaignsContext";
import { getAreasWithCampaigns } from "@/services/areaService";
import {
  getAssignedEmployeesForArea,
  Employee,
} from "@/services/areaEmployeeService";
import { analyticsService } from "@/services/analyticsService";

import { motion, useReducedMotion } from "framer-motion";
import {
  List as ListIcon,
  LayoutGrid,
  Plus,
  Search,
  ArrowUpDown,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "grid";

type SortKey = "active" | "name" | "newest" | "oldest" | "sales" | "employees";

const SORT_LABELS: Record<SortKey, string> = {
  active: "Sist aktiv",
  name: "Navn A-Å",
  newest: "Opprettet (nyest)",
  oldest: "Opprettet (eldst)",
  sales: "Antall salg",
  employees: "Antall ansatte",
};

const VIEW_KEY = "kampanje:view";
const DEFAULT_KEY = "kampanje:default";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function weekStartISO() {
  // ISO week starts Monday — go back to current week's Monday
  const d = new Date();
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export default function CampaignPage() {
  const reduce = useReducedMotion();
  const { campaigns, loading, createCampaign, updateCampaign, deleteCampaign } =
    useCampaigns();

  // View toggle persisted in localStorage
  const [view, setView] = useState<ViewMode>("list");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === "grid" || stored === "list") setView(stored as ViewMode);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // Default campaign id persisted in localStorage
  const [defaultCampaignId, setDefaultCampaignId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(DEFAULT_KEY);
      if (v) setDefaultCampaignId(v);
    } catch {
      /* ignore */
    }
  }, []);

  const handleToggleDefault = (c: Campaign) => {
    const isDefault = defaultCampaignId === c.id;
    const next = isDefault ? null : c.id;
    setDefaultCampaignId(next);
    try {
      if (next) localStorage.setItem(DEFAULT_KEY, next);
      else localStorage.removeItem(DEFAULT_KEY);
    } catch {
      /* ignore */
    }
    toast({
      title: isDefault
        ? "Fjernet som standardkampanje"
        : "Satt som standardkampanje",
    });
  };

  // Modal state — preserves the existing wiring exactly
  const [modalOpen, setModalOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCampaignObj, setDeleteCampaignObj] = useState<any>(null);
  const [assignEmployeesModalOpen, setAssignEmployeesModalOpen] =
    useState(false);
  const [assignEmployeesCampaign, setAssignEmployeesCampaign] = useState<any>(null);

  // Detail sheet state
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);

  // Filter / sort / search state
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("active");
  const [sortOpen, setSortOpen] = useState(false);

  // ---- Derived metrics: areas count + assignees + sales ----
  const [areasByCampaign, setAreasByCampaign] = useState<Record<string, number>>({});
  const [assigneesByCampaign, setAssigneesByCampaign] =
    useState<Record<string, Employee[]>>({});
  const [campaignAnalytics, setCampaignAnalytics] = useState<{
    lifetime: Record<string, number>;
    week: Record<string, number>;
    employees: Record<string, number>;
  }>({ lifetime: {}, week: {}, employees: {} });

  // Areas → group by campaign id
  useEffect(() => {
    let cancelled = false;
    getAreasWithCampaigns()
      .then((areas) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        const byCampaign: Record<string, string[]> = {};
        areas.forEach((a) => {
          const cid = a.campaign?.id;
          if (!cid) return;
          counts[cid] = (counts[cid] ?? 0) + 1;
          (byCampaign[cid] ??= []).push(a.id);
        });
        setAreasByCampaign(counts);

        // Then fetch assignees for the first ~5 areas of each campaign in parallel
        // to approximate the campaign's employee roster. Capped to avoid fan-out.
        const sample: { campaignId: string; areaId: string }[] = [];
        Object.entries(byCampaign).forEach(([cid, ids]) => {
          ids.slice(0, 5).forEach((id) => sample.push({ campaignId: cid, areaId: id }));
        });
        Promise.all(
          sample.map(({ campaignId, areaId }) =>
            getAssignedEmployeesForArea(areaId)
              .then((emps) => ({ campaignId, emps }))
              .catch(() => ({ campaignId, emps: [] as Employee[] })),
          ),
        ).then((entries) => {
          if (cancelled) return;
          const merged: Record<string, Map<string, Employee>> = {};
          entries.forEach(({ campaignId, emps }) => {
            const map = (merged[campaignId] ??= new Map());
            emps.forEach((e) => map.set(e.id, e));
          });
          const out: Record<string, Employee[]> = {};
          Object.entries(merged).forEach(([cid, map]) => {
            out[cid] = Array.from(map.values());
          });
          setAssigneesByCampaign(out);
        });
      })
      .catch(() => {
        if (!cancelled) setAreasByCampaign({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Analytics: one call for this-week + one for lifetime, both with all campaign ids.
  // TODO(backend): would prefer a dedicated /campaigns/aggregate endpoint to skip
  // the wide analytics fetch.
  useEffect(() => {
    if (campaigns.length === 0) return;
    let cancelled = false;
    const ids = campaigns.map((c) => c.id);
    const today = todayISO();
    const weekStart = weekStartISO();

    Promise.allSettled([
      analyticsService.getAnalyticsPreview({
        campaign_ids: ids,
        start_date: "2020-01-01",
        end_date: today,
      }),
      analyticsService.getAnalyticsPreview({
        campaign_ids: ids,
        start_date: weekStart,
        end_date: today,
      }),
    ]).then(([lifetimeRes, weekRes]) => {
      if (cancelled) return;
      const lifetime: Record<string, number> = {};
      const week: Record<string, number> = {};
      const employees: Record<string, number> = {};
      if (lifetimeRes.status === "fulfilled") {
        lifetimeRes.value.campaigns.forEach((c) => {
          lifetime[c.campaign_id] = c.total_doors;
          employees[c.campaign_id] = c.num_employees;
        });
      }
      if (weekRes.status === "fulfilled") {
        weekRes.value.campaigns.forEach((c) => {
          week[c.campaign_id] = c.total_doors;
        });
      }
      setCampaignAnalytics({ lifetime, week, employees });
    });
    return () => {
      cancelled = true;
    };
  }, [campaigns]);

  // ---- Merged metrics map for downstream views ----
  const metrics = useMemo<Record<string, CampaignMetrics>>(() => {
    const out: Record<string, CampaignMetrics> = {};
    campaigns.forEach((c) => {
      const assignees = (assigneesByCampaign[c.id] ?? []).map((e) => ({
        id: e.id,
        name: e.name,
      }));
      out[c.id] = {
        areasCount: areasByCampaign[c.id],
        employeesCount:
          (campaignAnalytics.employees[c.id] ?? assignees.length) || undefined,
        salesWeek: campaignAnalytics.week[c.id],
        salesLifetime: campaignAnalytics.lifetime[c.id],
        assignees,
      };
    });
    return out;
  }, [campaigns, areasByCampaign, assigneesByCampaign, campaignAnalytics]);

  // ---- Search + sort ----
  const visible = useMemo(() => {
    let list = [...campaigns];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q),
      );
    }
    const ms = (s?: string) => (s ? new Date(s).getTime() : 0);
    switch (sortKey) {
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        list.sort((a, b) => ms(b.created_at) - ms(a.created_at));
        break;
      case "oldest":
        list.sort((a, b) => ms(a.created_at) - ms(b.created_at));
        break;
      case "sales": {
        const sales = (id: string) =>
          campaignAnalytics.lifetime[id] ?? 0;
        list.sort((a, b) => sales(b.id) - sales(a.id));
        break;
      }
      case "employees": {
        const n = (id: string) =>
          campaignAnalytics.employees[id] ?? (metrics[id]?.assignees?.length ?? 0);
        list.sort((a, b) => n(b.id) - n(a.id));
        break;
      }
      case "active":
      default: {
        // "Sist aktiv" — proxy with updated_at fallback to created_at
        list.sort(
          (a, b) =>
            ms(b.updated_at ?? b.created_at) -
            ms(a.updated_at ?? a.created_at),
        );
      }
    }
    return list;
  }, [campaigns, search, sortKey, campaignAnalytics, metrics]);

  const hasActiveFilters = search.trim().length > 0;
  const clearFilters = () => setSearch("");

  // ---- Existing modal handlers (preserved verbatim from previous page) ----
  const handleCreate = () => {
    setEditCampaign(null);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    let campaignId = data.id;
    const isUpdate = !!data.id;
    try {
      if (isUpdate) {
        await updateCampaign(data.id, {
          name: data.name,
          description: data.description,
          areaIds: [],
        });
        const selectedAreaIds = data.areaIds || [];
        await bulkAssignAreasToCampaign(campaignId, selectedAreaIds);
        toast({
          title: "Områder oppdatert",
          description: "Områdetildelinger oppdatert vellykket.",
        });
      } else {
        const newCampaign = await createCampaign({
          name: data.name,
          description: data.description,
          areaIds: [],
        });
        campaignId = newCampaign.id;
        const selectedAreaIds = data.areaIds || [];
        await Promise.allSettled(
          selectedAreaIds.map((areaId: any) =>
            assignAreaToCampaign(campaignId, areaId),
          ),
        );
        toast({ title: "Kampanje opprettet" });
      }
      setModalOpen(false);
    } catch (err) {
      console.error("[ERROR] handleSave failed:", err);
      setModalOpen(false);
      toast({
        title: "Feil",
        description:
          "Kunne ikke oppdatere områdetildelinger. Vennligst prøv igjen.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (c: Campaign) => {
    setEditCampaign(c);
    setModalOpen(true);
  };

  const handleDelete = (c: Campaign) => {
    setDeleteCampaignObj(c);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (deleteCampaignObj) {
      try {
        await deleteCampaign(deleteCampaignObj.id);
        toast({ title: "Kampanje slettet" });
      } catch (err: any) {
        if (!err.message?.includes("404")) {
          console.error("[ERROR] Failed to delete campaign:", err);
          toast({
            title: "Kunne ikke slette",
            description: "Prøv igjen.",
            variant: "destructive",
          });
        }
      }
      setDeleteModalOpen(false);
      setDeleteCampaignObj(null);
      if (detailCampaign?.id === deleteCampaignObj.id) {
        setDetailCampaign(null);
      }
    }
  };

  const handleAssignEmployees = (campaign: Campaign) => {
    setAssignEmployeesCampaign(campaign);
    setAssignEmployeesModalOpen(true);
  };

  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="relative flex flex-col min-h-screen bg-ab-base bg-page-glow">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
            style={{
              maskImage: "linear-gradient(to bottom, black, transparent 70%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col flex-1 min-h-screen">
            <PageHeader
              eyebrow="ARBEIDSFLATE · KAMPANJER"
              title={
                <span className="inline-flex items-baseline gap-2">
                  Kampanjer
                  <Badge
                    variant="outline"
                    className="text-[11px] text-ab-fg-3 tabular mono border-ab-line"
                  >
                    {campaigns.length}
                  </Badge>
                </span>
              }
              description="Administrer kampanjer på tvers av regionen"
              action={
                <div className="flex items-center gap-2">
                  {/* View toggle */}
                  <div
                    role="tablist"
                    className="inline-flex items-center gap-0.5 h-8 p-0.5 bg-ab-subtle border border-ab-line rounded-lg"
                  >
                    <ViewBtn
                      active={view === "list"}
                      onClick={() => setView("list")}
                      label="Listevisning"
                    >
                      <ListIcon className="h-3.5 w-3.5" />
                    </ViewBtn>
                    <ViewBtn
                      active={view === "grid"}
                      onClick={() => setView("grid")}
                      label="Rutenettvisning"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </ViewBtn>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="ab-btn primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Opprett kampanje
                  </button>
                </div>
              }
            />

            {/* Filter / sort bar */}
            <div className="flex items-center gap-2 px-5 py-3 flex-wrap">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Søk kampanjer…"
                  className="ab-input h-9 w-full text-[13px] rounded-full bg-ab-subtle border-ab-line hover:border-ab-line-2 focus:border-ab-accent transition-colors"
                  style={{ paddingLeft: 32, paddingRight: search ? 30 : 12 }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Nullstill søk"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <Popover open={sortOpen} onOpenChange={setSortOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 h-9 px-3 rounded-full",
                      "border bg-ab-elevated text-[12px] transition-colors",
                      "hover:border-ab-line-2 hover:bg-ab-hover",
                      sortOpen
                        ? "ring-2 ring-ab-accent/15 border-ab-accent/30"
                        : "border-ab-line",
                    )}
                  >
                    <ArrowUpDown className="h-3 w-3 text-ab-fg-3" />
                    <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
                      Sortér:
                    </span>
                    <span className="text-ab-fg font-medium">
                      {SORT_LABELS[sortKey]}
                    </span>
                    <ChevronDown className="h-3 w-3 text-ab-fg-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-56 p-0 bg-ab-canvas border-ab-line"
                >
                  <Command className="bg-transparent">
                    <CommandList>
                      <CommandGroup>
                        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                          <CommandItem
                            key={k}
                            value={SORT_LABELS[k]}
                            onSelect={() => {
                              setSortKey(k);
                              setSortOpen(false);
                            }}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <span className="text-[13px]">
                              {SORT_LABELS[k]}
                            </span>
                            {sortKey === k && (
                              <Check className="h-3.5 w-3.5 text-ab-accent" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="ml-auto text-[12px] text-ab-fg-3 mono tabular">
                Vis: {visible.length} / {campaigns.length}
              </div>
            </div>

            {/* Body */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1"
            >
              {view === "list" ? (
                <CampaignsListView
                  campaigns={visible}
                  metrics={metrics}
                  loading={loading}
                  defaultCampaignId={defaultCampaignId}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearFilters}
                  onOpenCreate={handleCreate}
                  onRowClick={(c) => setDetailCampaign(c)}
                  onEdit={handleEdit}
                  onAssignEmployees={handleAssignEmployees}
                  onDelete={handleDelete}
                  onToggleDefault={handleToggleDefault}
                />
              ) : (
                <CampaignsGridView
                  campaigns={visible}
                  metrics={metrics}
                  loading={loading}
                  defaultCampaignId={defaultCampaignId}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearFilters}
                  onOpenCreate={handleCreate}
                  onCardClick={(c) => setDetailCampaign(c)}
                  onEdit={handleEdit}
                  onAssignEmployees={handleAssignEmployees}
                  onDelete={handleDelete}
                  onToggleDefault={handleToggleDefault}
                />
              )}
            </motion.div>
          </div>

          {/* Existing modals — byte-identical wiring */}
          <CampaignModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
            initial={editCampaign}
          />
          <ConfirmDeleteModal
            open={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            campaign={deleteCampaignObj}
            onConfirmed={handleDeleteConfirmed}
          />
          <AssignEmployeesModal
            open={assignEmployeesModalOpen}
            campaign={assignEmployeesCampaign}
            onClose={() => setAssignEmployeesModalOpen(false)}
          />

          {/* Detail sheet */}
          <CampaignDetailSheet
            campaign={detailCampaign}
            metrics={
              detailCampaign ? metrics[detailCampaign.id] ?? {} : {}
            }
            open={!!detailCampaign}
            onClose={() => setDetailCampaign(null)}
            onEdit={(c) => {
              setDetailCampaign(null);
              handleEdit(c);
            }}
            onAssignEmployees={(c) => {
              setDetailCampaign(null);
              handleAssignEmployees(c);
            }}
            onDelete={(c) => {
              setDetailCampaign(null);
              handleDelete(c);
            }}
          />
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors duration-120",
        active
          ? "bg-ab-elevated text-ab-fg shadow-sm"
          : "text-ab-fg-3 hover:text-ab-fg",
      )}
    >
      {children}
    </button>
  );
}
