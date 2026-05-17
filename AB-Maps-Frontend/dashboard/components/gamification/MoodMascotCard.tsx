"use client";

import React from "react";
import { Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoodMascot } from "./MoodMascot";
import type { MoodOutput } from "./lib/mood";

interface MoodMascotCardProps {
  name: string;
  seed: string;
  mood: MoodOutput;
  stats: {
    dorerPerDag: number;
    jaProsent: number;
    minJaProsent: number;
    minDorerPerDag: number;
  };
  rank?: number;
}

const COLOR_HEX: Record<string, string> = {
  "text-amber-500": "#f59e0b",
  "text-emerald-500": "#10b981",
  "text-blue-500": "#3b82f6",
  "text-yellow-500": "#eab308",
  "text-violet-500": "#8b5cf6",
  "text-slate-400": "#94a3b8",
  "text-pink-500": "#ec4899",
};

const nbFmt = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });

function statColor(pct: number): string {
  if (pct >= 100) return "text-ab-success";
  if (pct >= 60) return "text-ab-warning";
  return "text-ab-danger";
}

function barColor(pct: number): string {
  if (pct >= 100) return "bg-ab-success";
  if (pct >= 60) return "bg-ab-warning";
  return "bg-ab-danger";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span
        className="h-7 w-7 rounded-full inline-flex items-center justify-center bg-amber-500/15 text-amber-500"
        title="Topp 1"
      >
        <Trophy className="h-4 w-4" />
      </span>
    );
  if (rank === 2)
    return (
      <span
        className="h-7 w-7 rounded-full inline-flex items-center justify-center bg-slate-400/15 text-slate-400"
        title="Topp 2"
      >
        <Medal className="h-4 w-4" />
      </span>
    );
  if (rank === 3)
    return (
      <span
        className="h-7 w-7 rounded-full inline-flex items-center justify-center bg-orange-500/15 text-orange-500"
        title="Topp 3"
      >
        <Medal className="h-4 w-4" />
      </span>
    );
  return (
    <span className="h-7 w-7 rounded-full inline-flex items-center justify-center bg-ab-subtle border border-ab-line-1 text-ab-fg-3 text-[12px] mono tabular font-medium">
      {rank}
    </span>
  );
}

export function MoodMascotCard({
  name,
  seed,
  mood,
  stats,
  rank,
}: MoodMascotCardProps) {
  const { dorerPerDag, jaProsent, minJaProsent, minDorerPerDag } = stats;
  const dorerPct = Math.min(100, Math.round((dorerPerDag / minDorerPerDag) * 100));
  const jaPct = Math.min(100, Math.round((jaProsent / minJaProsent) * 100));
  const tintHex = COLOR_HEX[mood.colorClass] ?? "#94a3b8";

  return (
    <div
      className="relative overflow-hidden bg-ab-elevated border border-ab-line rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 hover:border-ab-line-2 transition-all duration-200"
    >
      {/* 2px mood-colored top-edge gradient accent — instant scan signal */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(to right, transparent, ${tintHex}99, transparent)`,
        }}
      />

      {/* Mood-tinted radial glow top-right — bigger + softer than before */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-70"
        style={{
          background: `${tintHex}26`,
          filter: "blur(40px)",
        }}
      />

      {/* Top row: rank + name */}
      <div className="relative flex items-center gap-3 min-w-0">
        {rank !== undefined && <RankBadge rank={rank} />}
        <div className="text-[15px] font-semibold text-ab-fg truncate">{name}</div>
      </div>

      {/* Mascot */}
      <div className="relative flex justify-center py-4">
        <MoodMascot seed={seed} mood={mood} size="lg" showMoodLabel />
      </div>

      {/* Stat grid */}
      <div className="relative grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
            DØRER/DAG
          </div>
          <div
            className={cn(
              "text-[18px] font-semibold tabular mono leading-tight mt-0.5",
              statColor(dorerPct),
            )}
          >
            {nbFmt.format(dorerPerDag)}
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-ab-subtle overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", barColor(dorerPct))}
              style={{ width: `${dorerPct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-ab-fg-3 tabular mono">
            Mål: {nbFmt.format(minDorerPerDag)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
            JA %
          </div>
          <div
            className={cn(
              "text-[18px] font-semibold tabular mono leading-tight mt-0.5",
              statColor(jaPct),
            )}
          >
            {nbFmt.format(jaProsent)}%
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-ab-subtle overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", barColor(jaPct))}
              style={{ width: `${jaPct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-ab-fg-3 tabular mono">
            Mål: {nbFmt.format(minJaProsent)}%
          </div>
        </div>
      </div>
    </div>
  );
}
