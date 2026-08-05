"use client"

/**
 * Bento KPI tile — dark card with sparkline behind big digits, small progress
 * ring, delta pill. Used for both Mål måned and Mål uke rows.
 */
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { CountUp } from "./CountUp"
import { Sparkline } from "./Sparkline"
import type { ReactNode } from "react"

interface GoalTileProps {
  label: string
  current: number
  goal?: number
  accent?: string
  icon?: ReactNode
  spark?: number[]           // 6-12 numeric points
  delta?: number             // pp or %
  deltaUnit?: string
  suffix?: string
  index?: number             // for staggered animation
  className?: string
}

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
}

// Deterministic sparkline fallback (matches label length pattern, no random flicker).
function fallbackSpark(label: string, current: number): number[] {
  const s = label.split("").reduce((a,c) => a + c.charCodeAt(0), 0)
  return Array.from({ length: 10 }, (_, i) => {
    return current * (0.6 + Math.sin((i + s) * 0.9) * 0.2 + (i / 9) * 0.35)
  })
}

export function GoalTile({
  label, current, goal, accent = "#3461FF", icon, spark, delta, deltaUnit = "%", suffix, index = 0, className,
}: GoalTileProps) {
  const reduced = useReducedMotion()
  const pct = goal ? Math.min(100, Math.round((current / goal) * 100)) : null
  const series = spark ?? fallbackSpark(label, current)
  const remaining = goal ? Math.max(0, goal - current) : null

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={cn("bento-tile relative overflow-hidden rounded-2xl border border-ab-line p-4 sm:p-5", className)}
      style={{
        background: `
          radial-gradient(circle at top right, ${hexAlpha(accent, 0.14)}, transparent 55%),
          linear-gradient(180deg, ${hexAlpha(accent, 0.03)}, transparent 60%),
          var(--ab-bg-elevated)
        `,
      }}
    >
      {/* Sparkline behind — subtle */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-40">
        <Sparkline data={series} color={accent} height={64} className="w-full h-full" />
      </div>

      {/* Header row */}
      <div className="relative flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
          {label}
        </p>
        {icon && (
          <span
            className="grid h-8 w-8 place-items-center rounded-xl"
            style={{ background: hexAlpha(accent, 0.14), color: accent }}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Big number */}
      <div className="relative mt-2.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[30px] leading-none font-semibold text-ab-fg tabular-nums tracking-tight">
          <CountUp value={current} duration={900} />
        </span>
        {goal ? (
          <span className="font-mono text-sm text-ab-fg-4 tabular-nums">/ {goal.toLocaleString("nb-NO")}</span>
        ) : suffix ? (
          <span className="text-xs text-ab-fg-3">{suffix}</span>
        ) : null}
      </div>

      {/* Progress + delta row */}
      <div className="relative mt-4 space-y-2">
        {pct !== null && (
          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="race-fill h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${hexAlpha(accent, 0.75)}, ${accent})`,
                boxShadow: `0 0 10px ${hexAlpha(accent, 0.55)}`,
              }}
            />
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] font-mono">
          {pct !== null ? (
            <span className="text-ab-fg-3">{pct}%</span>
          ) : (
            <span />
          )}
          {remaining !== null ? (
            <span className="text-ab-fg-4">{remaining.toLocaleString("nb-NO")} igjen</span>
          ) : delta !== undefined ? (
            <span className={delta >= 0 ? "text-aurora-streak" : "text-rose-400"}>
              {delta > 0 ? "+" : ""}{delta}{deltaUnit}
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

export default GoalTile
