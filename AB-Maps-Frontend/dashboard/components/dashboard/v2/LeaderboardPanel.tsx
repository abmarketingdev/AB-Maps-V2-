"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Trophy } from "lucide-react"
import { RoyMascot, MOOD_TO_ROY } from "@/components/gamification/RoyMascot"
import { computeMood } from "@/components/gamification/lib/mood"
import { cn } from "@/lib/utils"
import type { LeaderItem, LeaderMetric } from "@/lib/api/dashboardOverview"

type LeaderEntry = LeaderItem

const METRICS: { key: LeaderMetric; label: string }[] = [
  { key: "ja_rate", label: "Ja-rate" },
  { key: "doors", label: "Dører" },
  { key: "consistency", label: "Konsistens" },
]

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32", "rgba(255,255,255,0.3)", "rgba(255,255,255,0.3)"]

interface LeaderboardPanelProps {
  className?: string
  entries?: LeaderEntry[]
  metric?: LeaderMetric
  onMetricChange?: (m: LeaderMetric) => void
}

export function LeaderboardPanel({ className, entries, metric = "ja_rate", onMetricChange }: LeaderboardPanelProps) {
  const reduced = useReducedMotion()
  const rows = entries ?? []

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
      className={`rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ab-fg">Toppliste</h3>
          <p className="mt-0.5 text-xs text-ab-fg-3">Beste selgere</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-ab-elevated p-1">
            {METRICS.map(({ key, label }) => (
              <button key={key} onClick={() => onMetricChange?.(key)}
                className={cn("cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all",
                  metric === key ? "bg-blue-600 text-white" : "text-ab-fg-3 hover:text-ab-fg-2")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15">
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Entries */}
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
              key={entry.name}
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.07, duration: 0.35 }}
              className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-all duration-200 hover:border-ab-line hover:bg-ab-hover cursor-default"
            >
              {/* Rank */}
              <span
                className="w-6 shrink-0 text-center font-mono text-sm font-bold"
                style={{ color: RANK_COLORS[i] }}
              >
                {entry.rank}
              </span>

              {/* Roy mascot */}
              <div className="relative shrink-0">
                <RoyMascot state={royState} size={40} accent={moodOut.colorClass.replace("text-", "#").replace("-500", "")} />
                {/* Online dot */}
                {entry.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ab-base bg-emerald-500" />
                )}
              </div>

              {/* Name + region */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-ab-fg">{entry.name}</p>
                <p className="truncate text-xs text-ab-fg-3">
                  {entry.region || `${entry.dorerPerDag} dører/dag · ${entry.jaProsent.toFixed(1)}% ja`}
                </p>
              </div>

              {/* Mood badge */}
              <span
                className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", moodOut.bgClass, moodOut.colorClass)}
              >
                {moodOut.label}
              </span>

              {/* Score */}
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold text-ab-fg">{entry.score}</p>
                <p className="text-xs text-ab-fg-4">pts</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

export default LeaderboardPanel
