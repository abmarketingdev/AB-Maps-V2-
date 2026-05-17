"use client";

import React from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  X,
  Pencil,
  UserPlus,
  BarChart2,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { stringToHsl } from "@/lib/stringToHsl";
import { useTheme } from "next-themes";
import { Campaign } from "@/services/campaignService";
import { CampaignMetrics } from "./CampaignsListView";

const fmtInt = new Intl.NumberFormat("nb-NO");

function initials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d. MMM yyyy", { locale: nb });
  } catch {
    return "—";
  }
}

interface CampaignDetailSheetProps {
  campaign: Campaign | null;
  metrics: CampaignMetrics;
  open: boolean;
  onClose: () => void;
  onEdit: (c: Campaign) => void;
  onAssignEmployees: (c: Campaign) => void;
  onDelete: (c: Campaign) => void;
}

export function CampaignDetailSheet({
  campaign,
  metrics,
  open,
  onClose,
  onEdit,
  onAssignEmployees,
  onDelete,
}: CampaignDetailSheetProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (!campaign) return null;

  const dot = stringToHsl(campaign.name, {
    dark: isDark,
    saturation: 58,
    lightness: 56,
  });
  const assignees = metrics.assignees ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[560px] sm:w-[560px] p-0 bg-ab-canvas border-l border-ab-line flex flex-col"
        >
          <SheetTitle className="sr-only">{campaign.name}</SheetTitle>

          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-ab-canvas border-b border-ab-line-1 px-5 pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  KAMPANJE · OVERSIKT
                </div>
                <div className="mt-1 flex items-center gap-2.5 min-w-0">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: dot }}
                  />
                  <h2 className="text-[20px] font-semibold tracking-tight text-ab-fg truncate">
                    {campaign.name}
                  </h2>
                </div>
                {campaign.description ? (
                  <p className="mt-2 text-[13px] text-ab-fg-2 leading-relaxed">
                    {campaign.description}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-ab-fg-3 italic">
                    Ingen beskrivelse
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Lukk"
                className="h-8 w-8 -mr-1 rounded-full inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-1 mt-3">
              <button
                type="button"
                onClick={() => onEdit(campaign)}
                className="ab-btn ghost h-8"
              >
                <Pencil className="h-3.5 w-3.5" />
                Rediger
              </button>
              <button
                type="button"
                onClick={() => onAssignEmployees(campaign)}
                className="ab-btn ghost h-8"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Tildel ansatte
              </button>
              <Link
                href={`/sales?campaign=${encodeURIComponent(campaign.id)}`}
                className="ab-btn ghost h-8"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Se i Statistikk
              </Link>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="ab-btn ghost h-8 text-ab-danger hover:text-ab-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Slett
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* NØKKELTALL */}
            <section>
              <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold mb-2">
                NØKKELTALL
              </div>
              <div className="rounded-lg border border-ab-line overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-y-0 divide-ab-line-1">
                  <KPI
                    label="Områder"
                    value={
                      metrics.areasCount != null
                        ? fmtInt.format(metrics.areasCount)
                        : "—"
                    }
                  />
                  <KPI
                    label="Ansatte"
                    value={
                      metrics.employeesCount != null
                        ? fmtInt.format(metrics.employeesCount)
                        : "—"
                    }
                  />
                </div>
                <div className="grid grid-cols-2 divide-x border-t divide-ab-line-1 border-ab-line-1">
                  <KPI
                    label="Salg lifetime"
                    value={
                      metrics.salesLifetime != null
                        ? fmtInt.format(metrics.salesLifetime)
                        : "—"
                    }
                  />
                  <KPI
                    label="Salg denne uken"
                    value={
                      metrics.salesWeek != null
                        ? fmtInt.format(metrics.salesWeek)
                        : "—"
                    }
                  />
                </div>
              </div>
            </section>

            {/* TILDELTE ANSATTE */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  TILDELTE ANSATTE
                </div>
                <span className="text-[11px] text-ab-fg-3 mono tabular">
                  {assignees.length > 0 ? fmtInt.format(assignees.length) : "—"}
                </span>
              </div>
              {assignees.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onAssignEmployees(campaign)}
                  className="ab-btn ghost"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Legg til ansatt
                </button>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {assignees.slice(0, 8).map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-2 h-7 pl-1 pr-2.5 rounded-full bg-ab-subtle border border-ab-line-1"
                      >
                        <span
                          className="h-5 w-5 rounded-full inline-flex items-center justify-center text-[9px] font-semibold shrink-0"
                          style={{
                            background: stringToHsl(u.name, { dark: isDark }),
                            color: isDark
                              ? "rgba(255,255,255,0.88)"
                              : "rgba(0,0,0,0.72)",
                          }}
                        >
                          {initials(u.name)}
                        </span>
                        <span className="text-[12px] text-ab-fg truncate max-w-[140px]">
                          {u.name}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAssignEmployees(campaign)}
                      className="text-[12px] text-ab-accent hover:text-ab-accent-2 font-medium"
                    >
                      Vis alle
                    </button>
                    <span className="text-ab-fg-3">·</span>
                    <button
                      type="button"
                      onClick={() => onAssignEmployees(campaign)}
                      className="text-[12px] text-ab-accent hover:text-ab-accent-2 font-medium inline-flex items-center gap-1"
                    >
                      <UserPlus className="h-3 w-3" />
                      Legg til ansatt
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* OMRÅDER I KAMPANJEN */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  OMRÅDER I KAMPANJEN
                </div>
                <span className="text-[11px] text-ab-fg-3 mono tabular">
                  {metrics.areasCount != null
                    ? fmtInt.format(metrics.areasCount)
                    : "—"}
                </span>
              </div>
              <Link
                href={`/areas?campaign=${encodeURIComponent(campaign.id)}`}
                className="inline-flex items-center gap-1.5 text-[12px] text-ab-accent hover:text-ab-accent-2 font-medium"
              >
                Se alle i Områder
                <ChevronRight className="h-3 w-3" />
              </Link>
            </section>

            {/* AKTIVITET */}
            <section>
              <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold mb-2">
                AKTIVITET
              </div>
              <ul className="space-y-2 text-[12px] text-ab-fg-2 leading-relaxed">
                {campaign.created_by && (
                  <li>
                    Opprettet av{" "}
                    <span className="font-medium text-ab-fg">
                      {campaign.created_by}
                    </span>
                    {campaign.created_at && (
                      <span className="text-ab-fg-3 mono tabular">
                        {" "}
                        · {formatDate(campaign.created_at)}
                      </span>
                    )}
                  </li>
                )}
                {campaign.updated_at &&
                  campaign.updated_at !== campaign.created_at && (
                    <li className="text-ab-fg-3">
                      Sist oppdatert{" "}
                      <span className="mono tabular">
                        {formatDate(campaign.updated_at)}
                      </span>
                    </li>
                  )}
              </ul>
            </section>
          </div>

          {/* Sticky footer */}
          <div className="border-t border-ab-line-1 bg-ab-canvas px-4 py-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="ab-btn primary"
            >
              Lukk
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett kampanje</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette{" "}
              <span className="font-semibold">{campaign.name}</span>? Denne
              handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                onDelete(campaign);
              }}
              className="bg-ab-danger text-ab-on-accent hover:bg-ab-danger/90"
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
        {label}
      </div>
      <div className="text-[20px] font-semibold text-ab-fg tabular mono leading-tight mt-1">
        {value}
      </div>
    </div>
  );
}
