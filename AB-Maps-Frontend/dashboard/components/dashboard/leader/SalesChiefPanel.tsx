"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ChevronDown, Users, DoorOpen, UserPlus, TrendingUp } from "lucide-react"
import { Avatar } from "./Avatar"
import { useLang } from "@/lib/i18n"
import { TeamPanel } from "./TeamPanel"
import type { TeamNode } from "./dummyData"

// ─────────────────────────────────────────────────────────────────────────────
// SalesChiefPanel (2026-08-06) — admin/superuser only.
// Adds one collapsible layer ABOVE TeamPanel: chief header → click to expand →
// their teams rendered as the existing TeamPanel cards. Preserves the entire
// team → promoter drill-down unchanged.
//
// Aggregate progress: sums TeamGoal + team-detail actuals across the chief's
// teams. Only becomes meaningful after those teams have been expanded (the
// per-team detail fetch fills in the numbers) — pre-expansion the progress
// bar shows 0% but the team count + promoter count are honest from the
// shallow list.
// ─────────────────────────────────────────────────────────────────────────────

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

export interface ChiefGroup {
  chiefId: string | null   // null = the "Ingen salgssjef" bucket
  chiefName: string        // "—" for the orphan bucket
  teams: TeamNode[]
}

interface SalesChiefPanelProps {
  group: ChiefGroup
  period?: string
  loadingTeamIds?: Set<string>
  onTeamExpand?: (teamId: string) => void
  onGoalSaved?: (teamId?: string) => void
  /** Fires the first time the chief row is expanded — lets the parent trigger
   *  a bulk team-detail prefetch for all teams under this chief. */
  onExpand?: (chiefId: string | null) => void
  /** Deterministic accent color per chief (from the palette). */
  accent: string
  /** Start expanded when true — used to open the top-scoring chief by default. */
  initialOpen?: boolean
}

export function SalesChiefPanel({
  group, period, loadingTeamIds, onTeamExpand, onGoalSaved, onExpand,
  accent, initialOpen = false,
}: SalesChiefPanelProps) {
  const { t } = useLang()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(initialOpen)

  // Aggregate stats across this chief's teams. Goals + actuals come from the
  // per-team detail fetches (only after teams are expanded); pre-expansion,
  // memberCount is the only truthful number.
  const totals = useMemo(() => {
    let teamsCount = group.teams.length
    let promoters = 0
    let doorsGoal = 0
    let recGoal = 0
    let doors = 0
    let recruited = 0
    let sumVervinger = 0
    for (const tm of group.teams) {
      promoters += tm.memberCount ?? tm.promoters.length
      doorsGoal += tm.teamDoorsGoal ?? 0
      recGoal += tm.teamRecruitedGoal ?? 0
      for (const p of tm.promoters) {
        doors += p.doors
        recruited += p.recruited
        sumVervinger += p.sumVervinger
      }
    }
    const doorsPct = doorsGoal ? Math.min(100, Math.round((doors / doorsGoal) * 100)) : 0
    const recPct = recGoal ? Math.min(100, Math.round((recruited / recGoal) * 100)) : 0
    return { teamsCount, promoters, doorsGoal, recGoal, doors, recruited, sumVervinger, doorsPct, recPct }
  }, [group.teams])

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && onExpand) onExpand(group.chiefId)
  }

  const initials = group.chiefName === "—" ? "?" : group.chiefName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated"
      style={{
        boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 2px 0 rgba(0,0,0,0.25)`,
      }}
    >
      {/* Ambient accent glow along the top edge, chief-colored */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      {/* HEADER — click anywhere to toggle */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="group relative w-full text-left px-5 sm:px-6 py-4 sm:py-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-4">
          {/* Chief avatar */}
          <span
            className="mt-0.5 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, ${hexAlpha(accent, 0.65)})` }}
          >
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-4">
                {t("Salgssjef")}
              </p>
              <h3 className="font-instrument text-xl sm:text-2xl leading-none text-ab-fg">
                {group.chiefName}
              </h3>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ab-fg-3">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3 text-ab-fg-4" />
                <span className="font-mono text-ab-fg">{totals.teamsCount}</span> {totals.teamsCount === 1 ? t("team") : t("team")}
              </span>
              <span className="text-ab-fg-4">·</span>
              <span>
                <span className="font-mono text-ab-fg">{totals.promoters}</span> {t("promotører")}
              </span>
              {totals.recGoal > 0 && (
                <>
                  <span className="text-ab-fg-4">·</span>
                  <span className="inline-flex items-center gap-1">
                    <UserPlus className="h-3 w-3 text-[#0E9384]" />
                    <span className="font-mono tabular-nums text-ab-fg">{totals.recruited}</span>
                    <span className="text-ab-fg-4">/</span>
                    <span className="font-mono tabular-nums text-ab-fg">{totals.recGoal}</span>
                  </span>
                </>
              )}
              {totals.doorsGoal > 0 && (
                <>
                  <span className="text-ab-fg-4">·</span>
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3 w-3 text-[#8B5CF6]" />
                    <span className="font-mono tabular-nums text-ab-fg">{totals.doors}</span>
                    <span className="text-ab-fg-4">/</span>
                    <span className="font-mono tabular-nums text-ab-fg">{totals.doorsGoal}</span>
                  </span>
                </>
              )}
            </div>

            {/* Aggregate progress bar — recruits (matches boss's primary KPI) */}
            {totals.recGoal > 0 && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <motion.div
                    initial={reduced ? false : { width: "0%" }}
                    animate={{ width: `${totals.recPct}%` }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${hexAlpha(accent, 0.55)}, ${accent})`,
                      boxShadow: `0 0 8px ${hexAlpha(accent, 0.5)}`,
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-ab-fg-4">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {totals.recPct}%
                  </span>
                  <span>{Math.max(0, totals.recGoal - totals.recruited).toLocaleString("nb-NO")} {t("igjen")}</span>
                </div>
              </div>
            )}
          </div>

          <span
            className={`ml-3 mt-1 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ab-fg-3 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </button>

      {/* EXPANDED — chief's teams (reuses TeamPanel unchanged) */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="teams"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-ab-line-1 bg-black/[0.15] px-3 sm:px-4 py-4 sm:py-5">
              <TeamPanel
                teams={group.teams}
                period={period}
                loadingTeamIds={loadingTeamIds}
                onTeamExpand={onTeamExpand}
                onGoalSaved={onGoalSaved}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Helper to bucket a flat teams list into chief groups. Exposed so
// SalgslederDashboard can compute + sort once then render.
export function groupTeamsByChief(teams: TeamNode[]): ChiefGroup[] {
  const map = new Map<string, ChiefGroup>()
  const orphans: TeamNode[] = []
  for (const t of teams) {
    if (t.salesChiefId) {
      const key = t.salesChiefId
      if (!map.has(key)) {
        map.set(key, { chiefId: key, chiefName: t.salesChiefName || "—", teams: [] })
      }
      map.get(key)!.teams.push(t)
    } else {
      orphans.push(t)
    }
  }
  const groups = Array.from(map.values())
  // Sort by team count descending (chiefs with the most teams first — usually
  // the most-visible/senior ones), then alphabetical for ties.
  groups.sort((a, b) => b.teams.length - a.teams.length || a.chiefName.localeCompare(b.chiefName))
  if (orphans.length > 0) {
    groups.push({ chiefId: null, chiefName: "—", teams: orphans })
  }
  return groups
}
