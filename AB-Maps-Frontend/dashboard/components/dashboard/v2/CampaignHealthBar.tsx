"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Megaphone, Users, DoorOpen, UserPlus } from "lucide-react"
import type { CampaignHealthItem } from "@/lib/api/dashboardOverview"

type Campaign = CampaignHealthItem

// Ja-rate colour scale — same thresholds used elsewhere in the dashboard.
function jaRateColor(rate: number): string {
  if (rate >= 5) return "#10b981"    // green — hitting target
  if (rate >= 3) return "#F59E0B"    // amber — marginal
  return "#F43F5E"                    // rose — under target
}

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

interface CampaignHealthBarProps {
  className?: string
  campaigns?: Campaign[]
}

// Redesigned 2026-08-06 (v3, boss request). Card grid instead of full-width
// rows so screen space isn't wasted — 8 campaigns fit in a compact 2-column
// grid on desktop, one-per-row on mobile. Aesthetic matches TeamPanel on the
// Salgsleder dashboard: campaign-colored top strip + soft radial glow,
// prominent hero number, ja-rate pill top-right, employees badge bottom-left.
//
// 2026-08-08 (v4): hero number swapped from doors → RECRUITS (ja count) per
// client ask "Antall rekrutterte istedenfor kampanjestatus" — the "campaign
// status" concept is retired, this widget now emphasises how many donors
// each campaign has actually recruited. Doors moved to secondary line.
// Volume bar scaled against the campaign with the most recruits.
export function CampaignHealthBar({ className, campaigns }: CampaignHealthBarProps) {
  const reduced = useReducedMotion()
  const CAMPAIGNS = campaigns ?? []
  const maxRecruits = CAMPAIGNS.reduce((m, c) => Math.max(m, c.ja ?? 0), 1)

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
          <h3 className="text-sm font-semibold text-ab-fg">Rekrutterte per kampanje</h3>
          <p className="mt-0.5 text-xs text-ab-fg-3">Nye givere denne perioden</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15">
          <UserPlus className="h-4 w-4 text-emerald-400" />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {CAMPAIGNS.map((c, i) => {
          const jaRate = c.jaRate ?? 0
          const jaColor = jaRateColor(jaRate)
          const recruits = c.ja ?? 0
          const volumePct = maxRecruits > 0 ? Math.round((recruits / maxRecruits) * 100) : 0
          return (
            <motion.div
              key={c.id}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="group relative overflow-hidden rounded-2xl border border-ab-line-1 bg-white/[0.02] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5"
              style={{
                boxShadow: `inset 0 24px 40px -32px ${hexAlpha(c.color, 0.28)}`,
              }}
            >
              {/* Top color strip */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${c.color} 20%, ${c.color} 80%, transparent)` }}
              />
              {/* Radial glow from top-left */}
              <div
                className="pointer-events-none absolute -top-2 left-0 right-0 h-20 opacity-60"
                style={{ background: `radial-gradient(ellipse 60% 100% at 12% 0%, ${hexAlpha(c.color, 0.30)} 0%, transparent 65%)` }}
              />

              <div className="relative px-4 pt-4 pb-3">
                {/* Header: name + ja-pill */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
                    <h4 className="truncate text-sm font-semibold text-ab-fg">{c.name}</h4>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums"
                    style={{ background: `${jaColor}1f`, color: jaColor }}
                    title="Ja-andel"
                  >
                    {jaRate.toFixed(1)}% ja
                  </span>
                </div>

                {/* Hero number — recruits (ja count) per client ask 2026-08-08 */}
                <div className="mt-3 flex items-baseline gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-mono text-2xl font-bold tabular-nums text-ab-fg">
                    {recruits.toLocaleString("nb-NO")}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-ab-fg-4">rekruttert</span>
                </div>

                {/* Relative-volume bar — this campaign's recruits vs the top-recruiter one */}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <motion.div
                    initial={reduced ? false : { width: "0%" }}
                    animate={{ width: `${volumePct}%` }}
                    transition={{ delay: 0.5 + i * 0.04, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${hexAlpha(c.color, 0.55)}, ${c.color})`,
                      boxShadow: `0 0 8px ${hexAlpha(c.color, 0.55)}`,
                    }}
                  />
                </div>

                {/* Footer: employees badge + secondary doors count so the metric
                    is still visible without dominating */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-ab-fg-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-ab-line-1 bg-white/[0.02] px-2 py-0.5 font-mono tabular-nums">
                    <Users className="h-3 w-3 text-ab-fg-4" />
                    {c.employees}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ab-fg-4 tabular-nums" title="Antall dører banket">
                    <DoorOpen className="h-3 w-3" />
                    {c.current.toLocaleString("nb-NO")}
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
        {CAMPAIGNS.length === 0 && (
          <p className="col-span-full text-center text-xs text-ab-fg-4 py-6">Ingen kampanjedata ennå.</p>
        )}
      </div>
    </motion.div>
  )
}

export default CampaignHealthBar
