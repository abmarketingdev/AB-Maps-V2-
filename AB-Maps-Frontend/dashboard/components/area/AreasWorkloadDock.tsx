"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
import { Search, ArrowUpDown, ChevronDown, Check } from "lucide-react";
import { stringToHsl } from "@/lib/stringToHsl";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { SmartAvatar } from "@/components/gamification/SmartAvatar";

export interface DockEmployee {
  id: string;
  name: string;
  email?: string;
  areaIds: string[]; // areas this employee is assigned to
}

interface AreasWorkloadDockProps {
  employees: DockEmployee[];
  loading: boolean;
  highlightedEmployeeId: string | null;
  onEmployeeClick: (employeeId: string | null) => void;
}

type SortKey = "load-desc" | "load-asc" | "name" | "areas";

const SORT_LABELS: Record<SortKey, string> = {
  "load-desc": "Belastning ↓",
  "load-asc": "Belastning ↑",
  name: "Navn A-Å",
  areas: "Tildelte områder",
};

// TODO(backend): expose real `load_percent` per employee. Until then derive
// from assigned-areas count: min(100, areas * 12). Don't render fake numbers
// without indicating the fallback.
function deriveLoad(areaCount: number): number {
  return Math.min(100, areaCount * 12);
}

function loadColor(pct: number): string {
  if (pct >= 80) return "var(--ab-danger-fg)";
  if (pct >= 50) return "var(--ab-warning-fg)";
  return "var(--ab-success-fg)";
}

function initials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function AreasWorkloadDock({
  employees,
  loading,
  highlightedEmployeeId,
  onEmployeeClick,
}: AreasWorkloadDockProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("load-desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);

  const sorted = useMemo(() => {
    let list = [...employees];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.email ?? "").toLowerCase().includes(q),
      );
    }
    // "Tilgjengelig i dag" is a UX toggle. Real availability would require
    // a backend field. For now treat under-50% load as available.
    // TODO(backend): availability/online status field on employee.
    if (availableOnly) {
      list = list.filter((e) => deriveLoad(e.areaIds.length) < 50);
    }
    list.sort((a, b) => {
      const la = deriveLoad(a.areaIds.length);
      const lb = deriveLoad(b.areaIds.length);
      if (sortKey === "load-desc") return lb - la || a.name.localeCompare(b.name);
      if (sortKey === "load-asc") return la - lb || a.name.localeCompare(b.name);
      if (sortKey === "areas")
        return b.areaIds.length - a.areaIds.length || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [employees, search, sortKey, availableOnly]);

  return (
    <div className="flex flex-col bg-ab-canvas border-t border-ab-line" style={{ height: 140 }}>
      {/* Top strip */}
      <div className="h-10 px-5 flex items-center gap-3 border-b border-ab-line-1">
        <span className="text-[11px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold whitespace-nowrap">
          WORKLOAD-DOCK · KAPASITET
        </span>

        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] transition-colors",
                sortOpen
                  ? "ring-2 ring-ab-accent/15 border-ab-accent/30 bg-ab-elevated"
                  : "bg-ab-elevated border-ab-line hover:border-ab-line-2",
              )}
            >
              <ArrowUpDown className="h-3 w-3 text-ab-fg-3" />
              <span className="text-ab-fg-2">Sortér:</span>
              <span className="text-ab-fg font-medium">{SORT_LABELS[sortKey]}</span>
              <ChevronDown className="h-3 w-3 text-ab-fg-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-0 bg-ab-canvas border-ab-line">
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
                      <span className="text-[13px]">{SORT_LABELS[k]}</span>
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

        <button
          type="button"
          onClick={() => setAvailableOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] transition-colors",
            availableOnly
              ? "bg-ab-accent/10 text-ab-accent border-ab-accent/30 ring-2 ring-ab-accent/15"
              : "bg-ab-elevated text-ab-fg-2 border-ab-line hover:border-ab-line-2 hover:text-ab-fg",
          )}
          title="Vis kun ansatte med ledig kapasitet"
        >
          Tilgjengelig i dag
        </button>

        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk ansatt..."
            className="ab-input h-8 w-full text-[12px] rounded-full bg-ab-subtle border-ab-line hover:border-ab-line-2 focus:border-ab-accent transition-colors"
            style={{ paddingLeft: 32, paddingRight: 12 }}
          />
        </div>
      </div>

      {/* Rings */}
      <div className="flex-1 px-5 flex items-center gap-5 overflow-x-auto">
        {loading ? (
          <div className="flex items-center gap-5 py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-12 w-12 rounded-full bg-ab-subtle animate-pulse" />
                <div className="h-2 w-8 bg-ab-subtle rounded animate-pulse" />
                <div className="h-2 w-12 bg-ab-subtle rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-[12px] text-ab-fg-3 mx-auto">Ingen ansatte å vise</div>
        ) : (
          sorted.map((emp) => {
            const load = deriveLoad(emp.areaIds.length);
            const isActive = emp.id === highlightedEmployeeId;
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() =>
                  onEmployeeClick(isActive ? null : emp.id)
                }
                title={`${emp.name} · ${emp.areaIds.length} områder · ${load}%`}
                className={cn(
                  "shrink-0 flex flex-col items-center gap-1 py-1 px-1 rounded-md transition-transform duration-120 hover:scale-105 cursor-pointer",
                  isActive && "scale-105",
                )}
              >
                <Ring
                  size={48}
                  load={load}
                  stroke={loadColor(load)}
                  employee={emp}
                  ringClass={isActive ? "ring-2 ring-ab-accent ring-offset-2 ring-offset-ab-canvas rounded-full" : ""}
                />
                <span
                  className="text-[11px] font-medium mono tabular"
                  style={{ color: loadColor(load) }}
                >
                  {load}%
                </span>
                <span className="text-[11px] text-ab-fg-3 truncate max-w-[60px]">
                  {firstName(emp.name)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function Ring({
  size,
  load,
  stroke,
  employee,
  ringClass,
}: {
  size: number;
  load: number;
  stroke: string;
  employee: DockEmployee;
  ringClass?: string;
}) {
  const r = (size - 6) / 2; // 3px padding for stroke
  const c = 2 * Math.PI * r;
  const offset = c - (load / 100) * c;
  // Inner face fills inset-1 (≈ size - 8 px). Pass the actual computed pixel
  // size to MoodMascot so the avatar matches the ring's inner diameter.
  // showMoodIndicator=false because the colored capacity ring around already
  // signals state — adding a corner badge here would look busy.
  return (
    <div className={cn("relative", ringClass)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ab-border-strong)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-1 rounded-full overflow-hidden pointer-events-none">
        <SmartAvatar
          size="md"
          user={{ id: employee.id, name: employee.name, user_type: "employee" }}
          performance={{ jaProsent: 0, dorerPerDag: 0 }}
          showMoodIndicator={false}
        />
      </div>
    </div>
  );
}
