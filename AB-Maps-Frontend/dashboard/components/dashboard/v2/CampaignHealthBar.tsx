"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Megaphone, Users } from "lucide-react"
import type { CampaignHealthItem } from "@/lib/api/dashboardOverview"

type Campaign = CampaignHealthItem

function pct(c: Campaign) { return c.target > 0 ? Math.min((c.current / c.target) * 100, 100) : 0 }

// Progress-based only — there is no campaign timeline (days_left is always 0).
function statusLabel(c: Campaign): { text: string; color: string } {
  const p = pct(c)
  if (p >= 95) return { text: "Fullført snart", color: "#10b981" }
  if (p >= 70) return { text: "I rute", color: "#10b981" }
  if (p >= 40) return { text: "Pågår", color: "#f59e0b" }
  return { text: "Bak skjema", color: "#f43f5e" }
}

interface CampaignHealthBarProps {
  className?: string
  campaigns?: Campaign[]
}

export function CampaignHealthBar({ className, campaigns }: CampaignHealthBarProps) {
  const reduced = useReducedMotion()
  const CAMPAIGNS = campaigns ?? []

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Kampanjestatus</h3>
          <p className="mt-0.5 text-xs text-white/40">Fremdrift mot mål</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15">
          <Megaphone className="h-4 w-4 text-cyan-400" />
        </div>
      </div>

      {/* Campaign rows */}
      <div className="space-y-4">
        {CAMPAIGNS.map((c, i) => {
          const p = pct(c)
          const status = statusLabel(c)
          return (
            <motion.div
              key={c.id}
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.06, duration: 0.35 }}
            >
              {/* Top row */}
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-sm font-medium text-white/85">{c.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-white/40">
                    <Users className="h-3 w-3" />
                    {c.employees}
                  </span>
                  <span className="font-medium" style={{ color: status.color }}>{status.text}</span>
                  <span className="font-mono font-semibold text-white/70">
                    {c.current}/{c.target}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${c.color}99, ${c.color})` }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${p}%` }}
                  transition={{ delay: 0.5 + i * 0.06, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>

              {/* Bottom row */}
              <div className="mt-1 flex justify-between text-xs text-white/30">
                <span>{Math.round(p)}% fullført</span>
                <span>mål: {c.target.toLocaleString("nb-NO")} dører</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

export default CampaignHealthBar
