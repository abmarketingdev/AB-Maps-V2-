"use client"

/**
 * StreakFlame — consecutive-day streak with a living flame.
 * Loss-aversion: when the shift is active but today's minimum isn't met yet, a
 * warm "ikke mist streaken" nudge appears. Milestone days (7/30/100) pulse gold.
 */

import { motion, useReducedMotion } from "framer-motion"
import { Flame } from "lucide-react"
import { CountUp } from "./CountUp"

interface StreakFlameProps {
  days: number
  atRisk: boolean
  minDoors: number
  doorsToday: number
}

const MILESTONES = [7, 30, 100]

export function StreakFlame({ days, atRisk, minDoors, doorsToday }: StreakFlameProps) {
  const reduced = useReducedMotion()
  const isMilestone = MILESTONES.includes(days)
  const color = atRisk ? "#f59e0b" : isMilestone ? "#fbbf24" : "#fb923c"
  const remaining = Math.max(0, minDoors - doorsToday)

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5"
      style={atRisk ? { borderColor: "rgba(245,158,11,0.35)", boxShadow: "0 0 24px -10px rgba(245,158,11,0.5)" } : undefined}
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl shrink-0"
          style={{ background: `${color}1f` }}
          animate={reduced ? {} : { scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.span
            aria-hidden className="absolute inset-0 rounded-2xl blur-md"
            style={{ background: color }}
            animate={reduced ? {} : { opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <Flame className="relative h-6 w-6" style={{ color }} fill={color} />
        </motion.div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <CountUp value={days} duration={1} className="font-mono text-3xl font-bold text-white leading-none" />
            <span className="text-sm text-white/45">dager</span>
          </div>
          <p className="text-[12px] text-white/45 mt-0.5">streak på rad{isMilestone ? " · milepæl!" : ""}</p>
        </div>
      </div>

      {atRisk ? (
        <motion.p
          initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          className="mt-4 text-[12px] font-medium leading-snug" style={{ color: "#f59e0b" }}
        >
          Ikke mist streaken — {remaining} dører igjen for å holde den i live i dag.
        </motion.p>
      ) : (
        <p className="mt-4 text-[12px] text-white/40 leading-snug">
          Du holder streaken så lenge du banker minst {minDoors} dører per dag.
        </p>
      )}
    </div>
  )
}

export default StreakFlame
