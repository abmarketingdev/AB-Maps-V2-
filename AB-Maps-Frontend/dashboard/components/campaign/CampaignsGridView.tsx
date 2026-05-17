"use client";

import React from "react";
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
  Star,
  SearchX,
  Layers,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { stringToHsl } from "@/lib/stringToHsl";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Campaign } from "@/services/campaignService";
import { CampaignMetrics } from "./CampaignsListView";

interface CampaignsGridViewProps {
  campaigns: Campaign[];
  metrics: Record<string, CampaignMetrics>;
  loading: boolean;
  defaultCampaignId: string | null;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onOpenCreate: () => void;
  onCardClick: (campaign: Campaign) => void;
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
    const diffDays = (now.getTime() - d.getTime()) / 86400000;
    if (diffDays < 7) return formatDistanceToNow(d, { locale: nb, addSuffix: true });
    return format(d, "d. MMM yyyy", { locale: nb });
  } catch {
    return "—";
  }
}

export function CampaignsGridView({
  campaigns,
  metrics,
  loading,
  defaultCampaignId,
  hasActiveFilters,
  onClearFilters,
  onOpenCreate,
  onCardClick,
  onEdit,
  onAssignEmployees,
  onDelete,
  onToggleDefault,
}: CampaignsGridViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const reduce = useReducedMotion();

  // Decide whether to reserve description height (avoid card-height jump
  // when some have descriptions and others don't)
  const reserveDescHeight = campaigns.some((c) => !!c.description);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-5 py-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-ab-line p-5 bg-ab-elevated">
            <Skeleton className="h-3 w-12 mb-3" />
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48 mb-5" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-5 py-5">
      {campaigns.map((c, idx) => {
        const m = metrics[c.id] ?? {};
        const isDefault = defaultCampaignId === c.id;
        const stagger = reduce ? 0 : Math.min(idx, 12) * 0.02;
        const assignees = m.assignees ?? [];
        const employeesCount = m.employeesCount ?? assignees.length;
        const dot = stringToHsl(c.name, {
          dark: isDark,
          saturation: 58,
          lightness: 56,
        });
        return (
          <motion.div
            key={c.id}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: stagger }}
            onClick={() => onCardClick(c)}
            className={cn(
              "group cursor-pointer rounded-xl border bg-ab-elevated p-5 transition-all duration-180",
              "hover:border-ab-line-2 hover:shadow-md hover:-translate-y-0.5",
              isDefault
                ? "border-ab-accent/30 bg-ab-accent/[0.04]"
                : "border-ab-line",
            )}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: dot }}
                />
                {isDefault && (
                  <Star
                    className="h-3.5 w-3.5 text-ab-warning shrink-0"
                    fill="currentColor"
                    aria-label="Standardkampanje"
                  />
                )}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Flere handlinger"
                      className="h-7 w-7 -mt-1 -mr-1 rounded-md inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-120"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[220px]">
                    <DropdownMenuItem onSelect={() => onEdit(c)} className="cursor-pointer">
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
            </div>

            <div className="mt-3">
              <div className="text-[16px] font-semibold text-ab-fg line-clamp-1">
                {c.name}
              </div>
              {c.description ? (
                <div className="text-[12px] text-ab-fg-3 line-clamp-2 mt-1">
                  {c.description}
                </div>
              ) : reserveDescHeight ? (
                <div className="min-h-[28px]" />
              ) : null}
            </div>

            {/* Mini stats */}
            <div className="mt-4 grid grid-cols-3 divide-x divide-ab-line-1 rounded-lg border border-ab-line bg-ab-base/40">
              <Stat
                label="Områder"
                value={
                  m.areasCount != null ? fmtInt.format(m.areasCount) : "—"
                }
              />
              <Stat
                label="Ansatte"
                value={
                  employeesCount > 0 ? fmtInt.format(employeesCount) : "—"
                }
              />
              <Stat
                label="Salg i dag"
                value={
                  m.salesWeek != null ? fmtInt.format(m.salesWeek) : "—"
                }
              />
            </div>

            {/* Avatar pile */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onAssignEmployees(c);
              }}
              className="mt-4 flex items-center justify-between cursor-pointer"
              title="Tildel ansatte"
            >
              {assignees.length === 0 ? (
                <span className="inline-flex items-center gap-2 text-[12px] text-ab-fg-3 hover:text-ab-fg">
                  <span className="h-6 w-6 rounded-full border border-dashed border-ab-line bg-ab-subtle inline-flex items-center justify-center">
                    <UserPlus className="h-3 w-3" />
                  </span>
                  <span>Tildel ansatte</span>
                </span>
              ) : (
                <div className="flex items-center">
                  {assignees.slice(0, 4).map((u) => (
                    <span
                      key={u.id}
                      title={u.name}
                      className="h-6 w-6 rounded-full inline-flex items-center justify-center text-[9px] font-semibold ring-2 ring-ab-elevated -ml-2 first:ml-0 shrink-0"
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

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-ab-line-1 text-[11px] text-ab-fg-3 mono tabular">
              Opprettet {relativeCreated(c.created_at)}
              {c.created_by ? ` av ${c.created_by}` : ""}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <div className="text-[16px] font-semibold text-ab-fg tabular mono leading-none">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold mt-1">
        {label}
      </div>
    </div>
  );
}
