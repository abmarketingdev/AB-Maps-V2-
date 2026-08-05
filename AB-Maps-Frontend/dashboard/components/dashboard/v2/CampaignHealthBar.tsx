"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Megaphone, Users, DoorOpen } from "lucide-react"
import type { CampaignHealthItem } from "@/lib/api/dashboardOverview"

type Campaign = CampaignHealthItem

// Ja-rate colour scale — same thresholds used elsewhere in the dashboard so
// the widget feels consistent with mood/leaderboard signals.
function jaRateColor(rate: number): string {
  if (rate >= 5) return "#10b981"    // green — hitting industry target
  if (rate >= 3) return "#F59E0B"    // amber — marginal
  return "#F43F5E"                    // rose — under target
}

interface CampaignHealthBarProps {
  className?: string
  campaigns?: Campaign[]
}

// Redesigned 2026-08-06 (boss request). Was: fake progress bar + "0% fullført
// · mål: 0 dører" because the analytics-service backend hardcoded target=0.
// Now: 3 real KPIs per campaign (employees · doors · ja-rate) computed from
// data we already have. Per-team goals stay on the Salgsleder dashboard's
// TeamPanel (pencil icon → SetTeamGoalModal); this widget is company-wide
// campaign activity, not team-vs-goal.
export function CampaignHealthBar({ className, campaigns }: CampaignHealthBarProps) {
  const reduced = useReducedMotion()
  const CAMPAIGNS = campaigns ?? []

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className={`rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ab-fg">Kampanjestatus</h3>
          <p className="mt-0.5 text-xs text-ab-fg-3">Aktivitet per kampanje</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15">
          <Megaphone className="h-4 w-4 text-cyan-400" />
        </div>
      </div>

      {/* Campaign rows */}
      <div className="space-y-2">
        {CAMPAIGNS.map((c, i) => {
          const jaRate = c.jaRate ?? 0
          const jaColor = jaRateColor(jaRate)
          return (
            <motion.div
              key={c.id}
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.05, duration: 0.35 }}
              className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 hover:border-ab-line-1 hover:bg-white/[0.02] transition-colors"
            >
              {/* Left — colored dot + name */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="truncate text-sm font-medium text-ab-fg-2">{c.name}</span>
              </div>

              {/* Right — 3 KPIs, right-aligned mono */}
              <div className="flex items-center gap-4 text-xs">
                {/* Employees */}
                <span className="flex items-center gap-1 text-ab-fg-3 tabular-nums" title="Ansatte tildelt">
                  <Users className="h-3 w-3" />
                  <span className="font-mono">{c.employees}</span>
                </span>
                {/* Doors — the primary volume metric */}
                <span className="flex items-center gap-1 text-ab-fg-2 tabular-nums" title="Dører banket totalt">
                  <DoorOpen className="h-3 w-3 text-ab-fg-4" />
                  <span className="font-mono font-semibold text-ab-fg">
                    {c.current.toLocaleString("nb-NO")}
                  </span>
                </span>
                {/* Ja-rate — quality metric, colored pill */}
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
                  style={{ background: `${jaColor}1f`, color: jaColor }}
                  title="Ja-andel"
                >
                  {jaRate.toFixed(1)}% ja
                </span>
              </div>
            </motion.div>
          )
        })}
        {CAMPAIGNS.length === 0 && (
          <p className="text-center text-xs text-ab-fg-4 py-4">Ingen kampanjedata ennå.</p>
        )}
      </div>
    </motion.div>
  )
}

export default CampaignHealthBar
