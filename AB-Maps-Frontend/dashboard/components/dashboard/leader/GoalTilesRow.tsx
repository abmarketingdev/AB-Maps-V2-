"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"
import { Placeholder } from "./Placeholder"
import { CountUp } from "./CountUp"

type Tile = {
  key: string
  label: string
  current: number
  goal: number
  accent: string
  icon: ReactNode
  placeholder?: boolean
}

interface GoalTilesRowProps {
  tiles: Tile[]
}

// Shared MÅL row (rendered twice per view — MÅL MÅNED + MÅL UKE).
// Icon-in-a-colored-square + count-up number + progress arc bar +
// remaining-to-goal micro-label. Matches DashboardV2 tile density.
export function GoalTilesRow({ tiles }: GoalTilesRowProps) {
  const reduced = useReducedMotion()

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t, i) => {
        const pct = Math.min(1, t.current / Math.max(1, t.goal))
        const reached = t.current >= t.goal
        const remaining = Math.max(0, t.goal - t.current)

        return (
          <motion.div
            key={t.key}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-5 transition-all duration-200 hover:border-ab-line-2"
            whileHover={reduced ? {} : { boxShadow: `0 0 24px ${t.accent}22` }}
          >
            {/* Top row: icon + label */}
            <div className="flex items-start justify-between mb-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${t.accent}18`, color: t.accent }}
              >
                {t.icon}
              </div>
              <p className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3 max-w-[9rem]">
                {t.label}
              </p>
            </div>

            {/* Big current/goal number */}
            <div className="font-mono text-3xl font-bold tracking-tight leading-none">
              {t.placeholder ? (
                <Placeholder>
                  <CountUp value={t.current} delay={i * 60} className="text-ab-fg" />
                  <span className="mx-1 text-ab-fg-4">/</span>
                  <span className="text-lg font-semibold text-ab-fg-3">{t.goal.toLocaleString("nb-NO")}</span>
                </Placeholder>
              ) : (
                <>
                  <CountUp value={t.current} delay={i * 60} className="text-ab-fg" />
                  <span className="mx-1 text-ab-fg-4">/</span>
                  <span className="text-lg font-semibold text-ab-fg-3">{t.goal.toLocaleString("nb-NO")}</span>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ab-hover">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: reached
                    ? "linear-gradient(90deg, #10b981, #34d399)"
                    : `linear-gradient(90deg, ${t.accent}88, ${t.accent})`,
                  boxShadow: reached ? "0 0 10px #10b98166" : `0 0 8px ${t.accent}55`,
                }}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${pct * 100}%` }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] font-medium">
              <span className="text-ab-fg-3">{Math.round(pct * 100)}%</span>
              {reached ? (
                <span className="text-emerald-400">Mål nådd ✓</span>
              ) : (
                <span className="text-ab-fg-3">
                  <Placeholder>{remaining.toLocaleString("nb-NO")} igjen</Placeholder>
                </span>
              )}
            </div>

            {/* Subtle glow line on hover */}
            <div
              className="absolute inset-x-0 bottom-0 h-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
