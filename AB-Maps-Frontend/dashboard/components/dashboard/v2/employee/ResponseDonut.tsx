"use client"

/**
 * ResponseDonut — ja / nei / ikke hjemme / følg opp as concentric animated arcs
 * (hand-rolled SVG, no Recharts). ja-prosent reads instantly in the center.
 */

import { motion, useReducedMotion } from "framer-motion"
import { OUTCOME_META, type Outcome } from "./employeeLogic"

interface Segment { outcome: Outcome; value: number }

export function ResponseDonut({ ja, nei, ikkeHjemme, folgOpp, jaProsent }: {
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number; jaProsent: number
}) {
  const reduced = useReducedMotion()
  const segments: Segment[] = [
    { outcome: "ja", value: ja },
    { outcome: "folg-opp", value: folgOpp },
    { outcome: "ikke-hjemme", value: ikkeHjemme },
    { outcome: "nei", value: nei },
  ]
  const total = segments.reduce((s, x) => s + x.value, 0) || 1

  const size = 160, stroke = 18, r = (size - stroke) / 2, c = 2 * Math.PI * r, cx = size / 2
  let offset = 0

  return (
    <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5">
      <h3 className="text-[13px] font-semibold text-ab-fg-2 mb-4">Svarfordeling i dag</h3>
      <div className="flex items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            {segments.map((seg, i) => {
              const frac = seg.value / total
              const dash = c * frac
              const thisOffset = offset
              offset += frac
              return (
                <motion.circle
                  key={seg.outcome}
                  cx={cx} cy={cx} r={r} fill="none" stroke={OUTCOME_META[seg.outcome].color} strokeWidth={stroke}
                  strokeDasharray={`${dash} ${c - dash}`}
                  initial={reduced ? false : { strokeDashoffset: 0, opacity: 0 }}
                  animate={{ strokeDashoffset: -c * thisOffset, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                  style={{ transformOrigin: "center" }}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-ab-fg">{jaProsent}%</span>
            <span className="text-[10px] uppercase tracking-widest text-ab-fg-3">ja-rate</span>
          </div>
        </div>

        <div className="flex-1 space-y-2.5">
          {segments.map((seg) => (
            <div key={seg.outcome} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: OUTCOME_META[seg.outcome].color }} />
              <span className="text-[13px] text-ab-fg-3 flex-1">{OUTCOME_META[seg.outcome].label}</span>
              <span className="font-mono text-sm font-semibold text-ab-fg">{seg.value}</span>
              <span className="font-mono text-[11px] text-ab-fg-4 w-10 text-right">{Math.round(seg.value / total * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ResponseDonut
