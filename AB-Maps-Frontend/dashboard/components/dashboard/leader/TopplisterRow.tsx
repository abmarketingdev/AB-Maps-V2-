"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Trophy } from "lucide-react"
import { RoyMascot, MOOD_TO_ROY } from "@/components/gamification/RoyMascot"
import { computeMood } from "@/components/gamification/lib/mood"
import { fetchLeaderboard, type LeaderItem } from "@/lib/api/dashboardOverview"
import { useLang } from "@/lib/i18n"
import { Placeholder } from "./Placeholder"
import { topplisterDoorsFallback, topplisterRecruited, topplisterActive } from "./dummyData"

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32", "rgba(255,255,255,0.3)", "rgba(255,255,255,0.3)"]

// Renders exactly one leaderboard column with a fixed title (no metric switcher).
// Row rendering is identical to the prod LeaderboardPanel — same RoyMascot,
// same computeMood, same rank medal colours, same mood badge, same score line —
// so it feels like the same product, just three of them side-by-side.
function LeaderColumn({
  title, subtitle, rows, delay = 0, placeholder = false,
}: {
  title: string
  subtitle: string
  rows: LeaderItem[]
  delay?: number
  placeholder?: boolean
}) {
  const reduced = useReducedMotion()

  const inner = (
    <div className="space-y-3">
      {rows.map((entry, i) => {
        const moodOut = computeMood({
          jaProsent: entry.jaProsent,
          dorerPerDag: entry.dorerPerDag,
          minJaProsent: entry.minJaProsent,
          minDorerPerDag: entry.minDorerPerDag,
          rankPercentile: entry.rankPercentile,
          daysOnPlatform: entry.daysOnPlatform,
        })
        const royState = MOOD_TO_ROY[moodOut.mood]

        return (
          <motion.div
            key={entry.name + i}
            initial={reduced ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.15 + i * 0.06, duration: 0.35 }}
            className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-all duration-200 hover:border-ab-line hover:bg-ab-hover"
          >
            {/* Rank medal */}
            <span
              className="w-6 shrink-0 text-center font-mono text-sm font-bold"
              style={{ color: RANK_COLORS[i] ?? "rgba(255,255,255,0.3)" }}
            >
              {entry.rank}
            </span>

            {/* Roy mascot — same size + accent handling as prod LeaderboardPanel */}
            <div className="relative shrink-0">
              <RoyMascot
                state={royState}
                size={40}
                accent={moodOut.colorClass.replace("text-", "#").replace("-500", "")}
              />
              {entry.online && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ab-base bg-emerald-500" />
              )}
            </div>

            {/* Name + region/team */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-ab-fg">{entry.name}</p>
              <p className="truncate text-xs text-ab-fg-3">
                {entry.region || `${entry.dorerPerDag} dører/dag · ${entry.jaProsent.toFixed(1)}% ja`}
              </p>
            </div>

            {/* Mood badge */}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${moodOut.bgClass} ${moodOut.colorClass}`}>
              {moodOut.label}
            </span>
          </motion.div>
        )
      })}
    </div>
  )

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5"
    >
      {/* Header (fixed title, no metric switcher — one column = one metric) */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ab-fg">{title}</h3>
          <p className="mt-0.5 text-xs text-ab-fg-3">{subtitle}</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15">
          <Trophy className="h-4 w-4 text-amber-400" />
        </div>
      </div>

      {placeholder ? <Placeholder>{inner}</Placeholder> : inner}
    </motion.div>
  )
}

interface TopplisterRowProps {
  /** Optional pre-fetched entries for the doors column. If omitted, we fetch. */
  doorsEntries?: LeaderItem[]
  campaignId?: string
}

// 3-column TOPPLISTER row for the Salgsleder + Promoter views.
// All three columns are now fed by REAL /api/dashboard/v2/leaderboard endpoint
// (Phase 4, 2026-08-05 — added `recruited` metric on backend, kept `consistency`
// for col 3). Falls back to dummy only on network error / empty response.
//
// Column-3 label changed from "Aktive givere (%)" to "Mest konsistent" because
// backend supports `consistency` (days-per-week active vs threshold), not a
// literal "active donors %" — that would require hr sales replica which is
// deferred. Boss OK'd the relabel 2026-08-05.
export function TopplisterRow({ doorsEntries, campaignId }: TopplisterRowProps = {}) {
  const { t } = useLang()
  const [doors, setDoors] = useState<LeaderItem[]>(doorsEntries ?? topplisterDoorsFallback)
  const [recruited, setRecruited] = useState<LeaderItem[]>(topplisterRecruited)
  const [consistent, setConsistent] = useState<LeaderItem[]>(topplisterActive)

  useEffect(() => {
    let cancelled = false
    // Column 1 — doors (already wired)
    if (!doorsEntries) {
      fetchLeaderboard("doors", 5, campaignId)
        .then(entries => { if (!cancelled && entries?.length) setDoors(entries) })
        .catch(() => { /* keep fallback */ })
    }
    // Column 2 — recruited (NEW backend metric per Phase 4)
    fetchLeaderboard("recruited", 5, campaignId)
      .then(entries => { if (!cancelled && entries?.length) setRecruited(entries) })
      .catch(() => { /* keep dummy fallback */ })
    // Column 3 — consistency (existing metric, relabelled to "Mest konsistent")
    fetchLeaderboard("consistency", 5, campaignId)
      .then(entries => { if (!cancelled && entries?.length) setConsistent(entries) })
      .catch(() => { /* keep dummy fallback */ })
    return () => { cancelled = true }
  }, [doorsEntries, campaignId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <LeaderColumn title={t("Antall dører banket")} subtitle={t("Beste selgere denne perioden")} rows={doors}     delay={0.0}  />
      <LeaderColumn title={t("Rekrutterte givere")}  subtitle={t("Flest nye givere")}             rows={recruited} delay={0.08} />
      <LeaderColumn title={t("Mest konsistent")}     subtitle={t("Høyest aktivitet daglig")}      rows={consistent} delay={0.16} />
    </div>
  )
}
