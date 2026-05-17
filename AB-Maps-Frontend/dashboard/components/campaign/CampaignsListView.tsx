"use client";

import React, { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  Pencil,
  UserPlus,
  Trash2,
  Map as MapIcon,
  Star,
  SearchX,
  Layers,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import { nb } from "date-fns/locale";
import { stringToHsl } from "@/lib/stringToHsl";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Campaign } from "@/services/campaignService";

export interface CampaignMetrics {
  areasCount?: number;
  employeesCount?: number;
  salesWeek?: number;
  salesLifetime?: number;
  assignees?: { id: string; name: string }[];
}

interface CampaignsListViewProps {
  campaigns: Campaign[];
  metrics: Record<string, CampaignMetrics>;
  loading: boolean;
  defaultCampaignId: string | null;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onOpenCreate: () => void;
  onRowClick: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onAssignEmployees: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  onToggleDefault: (campaign: Campaign) => void;
}

const fmtInt = new Intl.NumberFormat("nb-NO");

function initials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeCreated(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = diffMs / 86400000;
    if (diffDays < 1) return formatDistanceToNow(d, { locale: nb, addSuffix: true });
    if (diffDays < 7) return formatDistanceToNow(d, { locale: nb, addSuffix: true });
    return format(d, "d. MMM yyyy", { locale: nb });
  } catch {
    return "—";
  }
}

export function CampaignsListView({
  campaigns,
  metrics,
  loading,
  defaultCampaignId,
  hasActiveFilters,
  onClearFilters,
  onOpenCreate,
  onRowClick,
  onEdit,
  onAssignEmployees,
  onDelete,
  onToggleDefault,
}: CampaignsListViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const reduce = useReducedMotion();

  const cols = useMemo(
    () => "minmax(280px,1.4fr) 80px 140px 120px 140px 40px",
    [],
  );

  if (loading) {
    return (
      <div className="border-t border-ab-line-1">
        <Header cols={cols} />
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-3 px-5 border-b border-ab-line-1"
              style={{ gridTemplateColumns: cols, minHeight: 64 }}
            >
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-14 ml-auto" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 w-16 ml-auto" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return hasActiveFilters ? (
      <div className="flex flex-col items-center justify-center text-center px-6 py-20">
        <SearchX className="h-12 w-12 text-ab-fg-3 mb-3" strokeWidth={1.25} />
        <div className="text-[15px] font-medium text-ab-fg">
          Ingen kampanjer matcher
        </div>
        <p className="mt-1 text-[13px] text-ab-fg-2">
          Prøv et annet søk eller tilbakestill filtre
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="ab-btn ghost mt-4"
        >
          Tilbakestill
        </button>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center text-center px-6 py-24">
        <Layers className="h-16 w-16 text-ab-fg-3 mb-4" strokeWidth={1.25} />
        <div className="text-[18px] font-medium text-ab-fg">
          Ingen kampanjer ennå
        </div>
        <p className="mt-1 text-[13px] text-ab-fg-2">
          Opprett din første kampanje for å komme i gang
        </p>
        <button
          type="button"
          onClick={onOpenCreate}
          className="ab-btn primary mt-6"
        >
          + Opprett kampanje
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-ab-line-1">
      <Header cols={cols} />
      <div>
        {campaigns.map((c, idx) => {
          const m = metrics[c.id] ?? {};
          const isDefault = defaultCampaignId === c.id;
          const stagger = reduce ? 0 : Math.min(idx, 12) * 0.02;
          const assignees = m.assignees ?? [];
          const employeesCount = m.employeesCount ?? assignees.length;
          return (
            <motion.div
              key={c.id}
              role="row"
              tabIndex={0}
              onClick={() => onRowClick(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(c);
                }
              }}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1], delay: stagger }}
              className={cn(
                "group grid items-center gap-3 px-5 border-b border-ab-line-1 cursor-pointer transition-colors duration-120",
                "hover:bg-ab-subtle/60",
                isDefault && "bg-ab-accent/[0.04]",
              )}
              style={{ gridTemplateColumns: cols, minHeight: 64 }}
            >
              {/* KAMPANJE */}
              <div className="flex items-center gap-3 min-w-0">
                {isDefault && (
                  <Star
                    className="h-3.5 w-3.5 text-ab-warning shrink-0"
                    fill="currentColor"
                    aria-label="Standardkampanje"
                  />
                )}
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: stringToHsl(c.name, { dark: isDark, saturation: 58, lightness: 56 }) }}
                />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ab-fg truncate">
                    {c.name}
                  </div>
                  {c.description && (
                    <div className="text-[12px] text-ab-fg-3 truncate">
                      {c.description}
                    </div>
                  )}
                </div>
              </div>

              {/* OMRÅDER */}
              <div className="text-right">
                {m.areasCount != null ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-ab-fg tabular mono">
                    <MapIcon className="h-3 w-3 text-ab-fg-3" />
                    {fmtInt.format(m.areasCount)}
                  </span>
                ) : (
                  <span className="text-ab-fg-3 opacity-60">—</span>
                )}
              </div>

              {/* ANSATTE */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignEmployees(c);
                }}
                className="flex items-center cursor-pointer"
                title="Tildel ansatte"
              >
                {assignees.length === 0 ? (
                  employeesCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-ab-fg-2 hover:text-ab-fg">
                      <span className="h-6 w-6 rounded-full border border-dashed border-ab-line bg-ab-subtle inline-flex items-center justify-center text-ab-fg-3">
                        <UserPlus className="h-3 w-3" />
                      </span>
                      <span className="tabular mono">{fmtInt.format(employeesCount)}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="h-6 w-6 rounded-full border border-dashed border-ab-line bg-ab-subtle inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:border-ab-line-2 transition-colors"
                    >
                      <UserPlus className="h-3 w-3" />
                    </button>
                  )
                ) : (
                  <div className="flex items-center">
                    {assignees.slice(0, 4).map((u) => (
                      <span
                        key={u.id}
                        title={u.name}
                        className="h-6 w-6 rounded-full inline-flex items-center justify-center text-[9px] font-semibold ring-2 ring-ab-canvas -ml-2 first:ml-0 shrink-0"
                        style={{
                          background: stringToHsl(u.name, { dark: isDark }),
                          color: isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.72)",
                        }}
                      >
                        {initials(u.name)}
                      </span>
                    ))}
                    {assignees.length > 4 && (
                      <span className="ml-1 h-6 px-1.5 rounded-full bg-ab-subtle border border-ab-line-1 text-[11px] font-medium tabular text-ab-fg-2 inline-flex items-center">
                        +{assignees.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* SALG · DENNE UKEN */}
              <div className="text-right">
                {m.salesWeek != null ? (
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-[14px] font-semibold text-ab-fg tabular mono">
                      {fmtInt.format(m.salesWeek)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 mt-0.5">
                      denne uken
                    </span>
                  </div>
                ) : (
                  <span className="text-ab-fg-3 opacity-60">—</span>
                )}
              </div>

              {/* OPPRETTET */}
              <div className="min-w-0">
                {c.created_by && (
                  <div className="text-[12px] text-ab-fg-2 truncate">
                    av {c.created_by}
                  </div>
                )}
                <div className="text-[11px] text-ab-fg-3 mono tabular truncate">
                  {relativeCreated(c.created_at)}
                </div>
              </div>

              {/* ACTIONS */}
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Flere handlinger"
                      className="h-7 w-7 rounded-md inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-120"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[220px]">
                    <DropdownMenuItem
                      onSelect={() => onEdit(c)}
                      className="cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2 text-ab-fg-3" />
                      Rediger
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onAssignEmployees(c)}
                      className="cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-2 text-ab-fg-3" />
                      Tildel ansatte
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onToggleDefault(c)}
                      className="cursor-pointer"
                    >
                      <Star
                        className="h-3.5 w-3.5 mr-2"
                        fill={isDefault ? "currentColor" : "none"}
                      />
                      {isDefault ? "Fjern som standardkampanje" : "Sett som standardkampanje"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onDelete(c)}
                      className="cursor-pointer text-ab-danger focus:text-ab-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Slett
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Header({ cols }: { cols: string }) {
  return (
    <div
      className="grid items-center gap-3 px-5 h-9 sticky top-0 bg-ab-canvas border-b border-ab-line z-[1]"
      style={{ gridTemplateColumns: cols }}
    >
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">
        KAMPANJE
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold text-right">
        OMRÅDER
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">
        ANSATTE
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold text-right">
        SALG · DENNE UKEN
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">
        OPPRETTET
      </span>
      <span />
    </div>
  );
}
