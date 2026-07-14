"use client"

/**
 * GoalRing — Apple-Activity-style daily goal ring.
 * Animates the arc fill on mount, intensifies the glow as it approaches the goal
 * (goal-gradient effect), and shows a count-up of doors knocked at the center.
 */

import { motion, useReducedMotion } from "framer-motion"
import { CountUp } from "./CountUp"

interface GoalRingProps {
  value: number
  goal: number
  size?: number
  /** label under the big number, e.g. "dører i dag" */
  unit?: string
}

export function GoalRing({ value, goal, size = 240, unit = "dører i dag" }: GoalRingProps) {
  const reduced = useReducedMotion()
  const pct = Math.min(1, value / goal)
  const reached = value >= goal
  const remaining = Math.max(0, goal - value)

  const stroke = 16
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2

  // goal-gradient: glow + color warm up as pct climbs
  const ringColor = reached ? "#10b981" : pct >= 0.7 ? "#3b82f6" : "#60a5fa"
  const glow = reached ? 0.55 : pct >= 0.7 ? 0.4 : 0.18

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* intensifying glow */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full blur-3xl"
        animate={{ background: `${ringColor}`, opacity: glow }}
        transition={{ duration: 0.8 }}
        style={{ transform: "scale(0.85)" }}
      />
      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id="goalRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ringColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={ringColor} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* track */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        {/* progress */}
        <motion.circle
          cx={cx} cy={cx} r={r} fill="none" stroke="url(#goalRingGrad)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          initial={reduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ delay: 0.3, duration: 1.3, ease: [0.23, 1, 0.32, 1] }}
          style={{ filter: `drop-shadow(0 0 ${reached ? 10 : 6}px ${ringColor})` }}
        />
      </svg>

      {/* center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div style={{ fontSize: Math.round(size * 0.26) }}>
          <CountUp value={value} duration={1.3} delay={0.3} className="font-mono font-bold text-ab-fg leading-none" />
        </div>
        <span className="mt-1 text-[11px] uppercase tracking-widest text-ab-fg-3">{unit}</span>
        <div className="mt-2 h-px w-10 bg-ab-hover" />
        <span className="mt-2 text-xs font-medium" style={{ color: reached ? "#10b981" : "rgba(255,255,255,0.5)" }}>
          {reached ? "Mål nådd 🎯" : `${remaining} igjen til ${goal}`}
        </span>
      </div>
    </div>
  )
}

export default GoalRing
