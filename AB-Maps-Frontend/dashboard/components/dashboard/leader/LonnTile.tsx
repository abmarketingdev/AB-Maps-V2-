"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Placeholder } from "./Placeholder"
import { CountUp } from "./CountUp"
import type { ReactNode } from "react"

interface LonnTileProps {
  label: string
  value: number
  suffix?: string   // "kr"
  goal?: number     // renders "45/60" when set
  accent: string
  icon?: ReactNode
  placeholder?: boolean
}

// Single money/count tile — reused across both LØNN rows (Salgsleder uses
// this for AKTIVE GIVERE + ESTIMERT LØNN; expandable tiles for the others).
// Icon-in-square + count-up value, matching GoalTilesRow density.
export function LonnTile({ label, value, suffix, goal, accent, icon, placeholder }: LonnTileProps) {
  const reduced = useReducedMotion()

  const number = goal != null
    ? (
        <>
          <CountUp value={value} className="text-ab-fg" />
          <span className="mx-1 text-ab-fg-4">/</span>
          <span className="text-lg font-semibold text-ab-fg-3">{goal.toLocaleString("nb-NO")}</span>
        </>
      )
    : (
        <>
          <CountUp value={value} className="text-ab-fg" />
          {suffix && <span className="ml-1 text-sm font-medium text-ab-fg-3">{suffix}</span>}
        </>
      )

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-5 sm:p-6 sm:transition-transform sm:duration-300 sm:hover:-translate-y-0.5"
      style={{
        // Subtle inset highlight at the top + hairline shadow underneath for
        // premium depth. Kept lightweight so mobile perf isn't affected.
        boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 2px 0 rgba(0,0,0,0.25)`,
      }}
      whileHover={reduced ? {} : { boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.06), 0 0 0 1px ${accent}22, 0 12px 32px -12px ${accent}55` }}
    >
      {/* Persistent radial glow from top-right — laptop-visible only so the
          mobile card stays flat (radial gradients look busy in a small tile). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-0 sm:opacity-70 transition-opacity duration-300 group-hover:sm:opacity-100"
        style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)` }}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
          {label}
        </p>
        {icon && (
          <div
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:sm:scale-105"
            style={{
              background: `linear-gradient(135deg, ${accent}22, ${accent}0a)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px ${accent}22, 0 4px 12px -6px ${accent}55`,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="relative mt-3 sm:mt-5 font-mono text-2xl sm:text-[2rem] sm:leading-none font-bold tracking-tight">
        {placeholder ? <Placeholder>{number}</Placeholder> : number}
      </div>
      {/* Bottom accent stripe — always subtly visible on laptop, fills on hover. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] opacity-0 sm:opacity-30 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
    </motion.div>
  )
}
