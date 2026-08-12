"use client"

// Shared card primitives for the MÅL sections on both dashboards.
// Extracted from MalRow.tsx (2026-08-06) so PromoterMalRow can reuse the
// exact same visual signature — wavy area chart, big mono goal fraction,
// thin progress bar.

import { motion, useReducedMotion } from "framer-motion"

export function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

// Deterministic pseudo-random sparkline — seeded so re-renders don't jitter.
export function makeSparkline(seed: number, count = 24, base = 50, amp = 20): number[] {
  const out: number[] = []
  let x = seed
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280
    const rnd = x / 233280
    out.push(base + Math.sin(i / 3) * amp * 0.5 + (rnd - 0.5) * amp)
  }
  return out
}

export function AreaWave({ points, color, className = "" }: { points: number[]; color: string; className?: string }) {
  if (!points || points.length < 2) return null
  const W = 400, H = 100
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const step = W / (points.length - 1)
  const pts = points.map((v, i) => ({
    x: i * step,
    y: H - ((v - min) / range) * H * 0.85 - H * 0.075,
  }))
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cp1x = prev.x + step / 2
    const cp1y = prev.y
    const cp2x = curr.x - step / 2
    const cp2y = curr.y
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
  }
  const area = `${d} L ${W} ${H} L 0 ${H} Z`
  const gradId = `spark-grad-${color.replace("#", "")}-${Math.abs(points[0] * 1000) | 0}`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-2/3 w-full ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.55" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export interface GoalCardProps {
  label: string
  /** null = "data ikke tilgjengelig" — renders "?". Use null (not 0) when the
   *  metric hasn't been computed yet (e.g. weekly doors before we ship the
   *  analytics weekly slice). */
  value: number | null
  /** Semantics:
   *   - undefined → no goal slot at all (card is a pure count like "Team i dag")
   *   - null → goal exists conceptually but wasn't set → render "value/?"
   *   - number > 0 → normal "value/N"
   *   - 0 → treated same as undefined (no goal slot) for backward compat */
  goal?: number | null
  suffix?: string
  accent: string
  icon: React.ReactNode
  sparkline?: number[]
  hero?: boolean
  caption?: string
  /** Small size — used on 4-across grids like PromoterMalRow. */
  compact?: boolean
  /** Optional top-right action slot — used for pencil / "→" links so leaders
   *  can jump straight from a KPI card to the goal editor for that row.
   *  Left undefined = no chrome, card is view-only. */
  action?: React.ReactNode
}

function formatNumOrQ(n: number | null | undefined): string {
  if (n == null) return "?"
  return n.toLocaleString("nb-NO")
}

export function GoalCard({ label, value, goal, suffix, accent, icon, sparkline, hero, caption, compact, action }: GoalCardProps) {
  const reduced = useReducedMotion()
  const hasGoalSlot = goal !== undefined && goal !== 0
  const hasKnownGoal = typeof goal === "number" && goal > 0
  const hasKnownValue = typeof value === "number"
  const pct = hasKnownGoal && hasKnownValue ? Math.min(100, Math.round((value / goal) * 100)) : 0
  const remaining = hasKnownGoal && hasKnownValue ? Math.max(0, goal - value) : 0
  const minH = hero ? "min-h-[280px]" : compact ? "min-h-[130px]" : "min-h-[160px]"
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated sm:transition-transform sm:duration-300 sm:hover:-translate-y-0.5 ${hero ? "sm:col-span-2 sm:row-span-2 " : ""}${minH} flex flex-col`}
      style={{ boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 2px 0 rgba(0,0,0,0.25)` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-0 sm:opacity-70"
        style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)` }}
      />
      {sparkline && sparkline.length > 1 && <AreaWave points={sparkline} color={accent} />}

      <div className={`relative ${compact ? "p-4 sm:p-4" : "p-5 sm:p-6"} flex-1 flex flex-col`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3 flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${accent}22, ${accent}0a)`,
                color: accent,
                boxShadow: `inset 0 0 0 1px ${accent}22`,
              }}
            >
              {icon}
            </span>
            {label}
          </p>
          {action && (
            <div className="flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {action}
            </div>
          )}
        </div>

        <div className={`relative mt-3 font-mono ${hero ? "text-5xl sm:text-7xl" : compact ? "text-xl sm:text-3xl" : "text-2xl sm:text-4xl"} sm:leading-none font-bold tracking-tight text-ab-fg`}>
          <span>{formatNumOrQ(value)}</span>
          {hasGoalSlot && (
            <>
              <span className="mx-1 text-ab-fg-4">/</span>
              <span>{formatNumOrQ(goal)}</span>
            </>
          )}
          {suffix && <span className="ml-1 text-sm font-medium text-ab-fg-3">{suffix}</span>}
        </div>

        {caption && <p className="mt-2 text-[11px] text-ab-fg-3">{caption}</p>}

        {/* Progress bar only when we can honestly render one. If the goal is
            set but the actual is null (or vice versa) we skip the bar rather
            than show a misleading 0% — the "?" in the fraction already tells
            the reader the row is incomplete. */}
        {hasGoalSlot && hasKnownGoal && hasKnownValue && (
          <div className="relative mt-auto pt-4">
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div
                initial={reduced ? false : { width: "0%" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${hexAlpha(accent, 0.55)}, ${accent})`,
                  boxShadow: `0 0 8px ${hexAlpha(accent, 0.5)}`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-mono tabular-nums text-ab-fg-4">
              <span>{pct}%</span>
              <span>{remaining.toLocaleString("nb-NO")} igjen</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
