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
      className="group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-5"
      whileHover={reduced ? {} : { boxShadow: `0 0 24px ${accent}22` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
          {label}
        </p>
        {icon && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: `${accent}18`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 font-mono text-2xl font-bold tracking-tight">
        {placeholder ? <Placeholder>{number}</Placeholder> : number}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
    </motion.div>
  )
}
