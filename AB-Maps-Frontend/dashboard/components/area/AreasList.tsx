"use client";

import React, { useEffect, useRef } from "react";
import { Area } from "@/services/areaService";
import { stringToHsl } from "@/lib/stringToHsl";
import { useTheme } from "next-themes";
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
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Assignee {
  id: string;
  name: string;
}

interface AreaWithAssignees extends Area {
  __assignees?: Assignee[];
}

interface AreasListProps {
  areas: AreaWithAssignees[];
  loading: boolean;
  selectedAreaId: string | null;
  hoveredAreaId: string | null;
  onAreaSelect: (areaId: string | null) => void;
  onAreaHover: (areaId: string | null) => void;
  onEdit: (area: Area) => void;
  onAssignEmployees: (area: Area) => void;
  onDelete: (area: Area) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const fmtInt = new Intl.NumberFormat("nb-NO");

function initials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Load % is not provided by the backend yet. Derive a placeholder from assignee count.
// TODO(backend): expose `load_percent` per area; remove this fallback when available.
function deriveLoad(assigneeCount: number): number {
  return Math.min(100, assigneeCount * 25);
}

function loadColor(pct: number): string {
  if (pct >= 80) return "var(--ab-danger-fg)";
  if (pct >= 50) return "var(--ab-warning-fg)";
  return "var(--ab-accent-9)";
}

export function AreasList({
  areas,
  loading,
  selectedAreaId,
  hoveredAreaId,
  onAreaSelect,
  onAreaHover,
  onEdit,
  onAssignEmployees,
  onDelete,
  onClearFilters,
  hasActiveFilters,
}: AreasListProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Scroll selected row into view when selection changes from the map
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  useEffect(() => {
    if (!selectedAreaId) return;
    const el = rowRefs.current.get(selectedAreaId);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedAreaId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <ListHeader />
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-3 px-3 py-3 border-b border-ab-line-1"
              style={{
                gridTemplateColumns: "minmax(160px,1.4fr) 80px 1fr 110px 32px",
                minHeight: 48,
              }}
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <ListHeader />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
          <MapPin className="h-14 w-14 text-ab-fg-3 mb-3" strokeWidth={1.25} />
          <div className="text-[16px] font-medium text-ab-fg">
            Ingen områder funnet
          </div>
          <p className="mt-1 text-[13px] text-ab-fg-2">
            Prøv å justere kampanjefilteret
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="ab-btn ghost mt-4"
            >
              Tilbakestill filter
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ListHeader />
      <div className="flex-1 overflow-y-auto">
        {areas.map((area, idx) => {
          const assignees = area.__assignees ?? [];
          const load = deriveLoad(assignees.length);
          const isSelected = area.id === selectedAreaId;
          const isHovered = area.id === hoveredAreaId && !isSelected;
          const lc = loadColor(load);
          const isLast = idx === areas.length - 1;
          return (
            <div
              key={area.id}
              ref={(el) => {
                if (el) rowRefs.current.set(area.id, el);
                else rowRefs.current.delete(area.id);
              }}
              role="row"
              tabIndex={0}
              onClick={() => onAreaSelect(area.id)}
              onMouseEnter={() => onAreaHover(area.id)}
              onMouseLeave={() => onAreaHover(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onAreaSelect(area.id);
                }
              }}
              className={cn(
                "group relative grid items-center gap-3 px-3 cursor-pointer transition-colors duration-120",
                !isLast && "border-b border-ab-line-1",
                isSelected && "bg-ab-accent-soft",
                !isSelected && isHovered && "bg-ab-subtle/60",
                !isSelected && !isHovered && "hover:bg-ab-subtle/60",
              )}
              style={{
                gridTemplateColumns: "minmax(160px,1.4fr) 80px 1fr 110px 32px",
                minHeight: 48,
              }}
            >
              {isSelected && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-0.5 bg-ab-accent"
                />
              )}

              {/* OMRÅDE */}
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-sm border border-black/10 dark:border-white/10 shrink-0"
                  style={{ background: area.color || "var(--ab-accent-9)" }}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ab-fg truncate">
                    {area.name}
                  </div>
                  {area.campaign?.name && (
                    <div className="text-[11px] text-ab-fg-3 uppercase tracking-wider truncate">
                      {area.campaign.name}
                    </div>
                  )}
                </div>
              </div>

              {/* DØRER */}
              <div className="text-right mono text-[13px] text-ab-fg tabular">
                {area.house_count != null ? (
                  fmtInt.format(area.house_count)
                ) : (
                  <span className="text-ab-fg-3 opacity-60">—</span>
                )}
              </div>

              {/* BELASTNING */}
              <div className="flex flex-col gap-1 min-w-0 pr-2">
                <div className="h-1 w-full rounded-full bg-ab-subtle overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
                    style={{ width: `${load}%`, background: lc }}
                    aria-hidden
                  />
                </div>
                <span
                  className="text-[12px] mono tabular"
                  style={{ color: lc }}
                >
                  {assignees.length > 0 ? `${load}%` : "—"}
                </span>
              </div>

              {/* TILDELT */}
              <div className="flex items-center justify-end">
                {assignees.length === 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssignEmployees(area);
                    }}
                    title="Tildel ansatte"
                    className="h-6 w-6 rounded-full border border-dashed border-ab-line bg-ab-subtle inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:border-ab-line-2 transition-colors"
                  >
                    <UserPlus className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex items-center">
                    {assignees.slice(0, 3).map((u) => (
                      <span
                        key={u.id}
                        title={u.name}
                        className="h-6 w-6 rounded-full inline-flex items-center justify-center text-[9px] font-semibold ring-2 ring-ab-elevated -ml-2 first:ml-0 shrink-0"
                        style={{
                          background: stringToHsl(u.name, { dark: isDark }),
                          color: isDark
                            ? "rgba(255,255,255,0.88)"
                            : "rgba(0,0,0,0.72)",
                        }}
                      >
                        {initials(u.name)}
                      </span>
                    ))}
                    {assignees.length > 3 && (
                      <span className="ml-1 h-6 px-1.5 rounded-full bg-ab-subtle border border-ab-line-1 text-[11px] font-medium tabular text-ab-fg-2 inline-flex items-center">
                        +{assignees.length - 3}
                      </span>
                    )}
                  </div>
                )}
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
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <DropdownMenuItem
                      onSelect={() => onEdit(area)}
                      className="cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2 text-ab-fg-3" />
                      Rediger
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onAssignEmployees(area)}
                      className="cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-2 text-ab-fg-3" />
                      Tildel ansatte
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onDelete(area)}
                      className="cursor-pointer text-ab-danger focus:text-ab-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Slett
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListHeader() {
  return (
    <div
      className="grid items-center gap-3 px-3 h-9 sticky top-0 bg-ab-canvas border-b border-ab-line z-[1]"
      style={{
        gridTemplateColumns: "minmax(160px,1.4fr) 80px 1fr 110px 32px",
      }}
    >
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">
        OMRÅDE
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold text-right">
        DØRER
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">
        BELASTNING
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold text-right">
        TILDELT
      </span>
      <span />
    </div>
  );
}
