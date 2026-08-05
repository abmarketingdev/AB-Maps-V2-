"use client"

/**
 * HERO bento tile — 2x2 large card with radial aurora glow behind the primary
 * number. Used for the "one metric that matters" on each dashboard's hero band.
 */
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { CountUp } from "./CountUp"
import { Sparkline } from "./Sparkline"
import type { ReactNode } from "react"

interface HeroKpiProps {
  label: string
  current: number
  goal?: number
  accent?: string
  icon?: ReactNode
  spark?: number[]
  delta?: number
  deltaUnit?: string
  meta?: string       // small line under the number, e.g. "vs 82 % forrige uke"
  right?: ReactNode   // optional side slot (e.g. RoyMascot for promoter)
  className?: string
}

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
}

function fallbackSpark(label: string, current: number): number[] {
  const s = label.split("").reduce((a,c) => a + c.charCodeAt(0), 0)
  return Array.from({ length: 12 }, (_, i) => current * (0.55 + Math.sin((i + s) * 0.85) * 0.22 + (i / 11) * 0.4))
}

export function HeroKpi({
  label, current, goal, accent = "#3461FF", icon, spark, delta, deltaUnit = "%", meta, right, className,
}: HeroKpiProps) {
  const reduced = useReducedMotion()
  const series = spark ?? fallbackSpark(label, current)
  const pct = goal ? Math.min(100, Math.round((current / goal) * 100)) : null
  const remaining = goal ? Math.max(0, goal - current) : null

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className={cn("bento-tile relative overflow-hidden rounded-3xl border border-ab-line p-6 sm:p-7", className)}
      style={{
        background: `
          radial-gradient(80% 60% at 20% 20%, ${hexAlpha(accent, 0.18)}, transparent 55%),
          radial-gradient(60% 70% at 90% 80%, ${hexAlpha("#FF7A45", 0.10)}, transparent 60%),
          linear-gradient(180deg, ${hexAlpha(accent, 0.05)}, transparent 60%),
          var(--ab-bg-elevated)
        `,
      }}
    >
      {/* Aurora glow blob behind the number */}
      <div
        className="pointer-events-none absolute -top-8 -left-8 h-72 w-72 rounded-full aurora-glow"
        style={{ background: `radial-gradient(circle, ${hexAlpha(accent, 0.35)} 0%, transparent 60%)`, filter: "blur(40px)" }}
      />

      {/* Sparkline strip behind */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-50">
        <Sparkline data={series} color={accent} height={96} className="w-full h-full" strokeWidth={2} />
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && (
              <span
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: hexAlpha(accent, 0.18), color: accent }}
              >
                {icon}
              </span>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
              {label}
            </p>
          </div>

          <div className="mt-4 flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-mono text-[64px] sm:text-[80px] leading-[0.9] font-semibold text-ab-fg tabular-nums tracking-tight">
              <CountUp value={current} duration={1100} />
            </span>
            {goal && (
              <span className="font-mono text-2xl text-ab-fg-4 tabular-nums">
                / {goal.toLocaleString("nb-NO")}
              </span>
            )}
          </div>

          {meta && (
            <p className="mt-2 text-xs text-ab-fg-3">{meta}</p>
          )}

          {(pct !== null || delta !== undefined) && (
            <div className="mt-5 flex items-center gap-3">
              {pct !== null && (
                <div className="flex items-center gap-2 min-w-[160px]">
                  <div className="h-1.5 w-32 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="race-fill h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${hexAlpha(accent, 0.75)}, ${accent})`,
                        boxShadow: `0 0 14px ${hexAlpha(accent, 0.7)}`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-ab-fg-3">{pct}%</span>
                </div>
              )}
              {delta !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-mono",
                    delta >= 0 ? "text-aurora-streak" : "text-rose-400",
                  )}
                >
                  {delta > 0 ? "+" : ""}{delta}{deltaUnit}
                </span>
              )}
              {remaining !== null && (
                <span className="text-[11px] font-mono text-ab-fg-4">{remaining.toLocaleString("nb-NO")} igjen</span>
              )}
            </div>
          )}
        </div>

        {right && (
          <div className="shrink-0 relative">{right}</div>
        )}
      </div>
    </motion.div>
  )
}

export default HeroKpi
