"use client"

/**
 * TodayJourney — a horizontal timeline of today's door knocks. Each knock is an
 * outcome-colored bead that springs in, giving a satisfying sense of accumulated
 * progress (narrative momentum) instead of another stat card.
 */

import { motion, useReducedMotion } from "framer-motion"
import { OUTCOME_META, type JourneyEvent, type Outcome } from "./employeeLogic"

export function TodayJourney({ events }: { events: JourneyEvent[] }) {
  const reduced = useReducedMotion()
  const counts = events.reduce((acc, e) => { acc[e.outcome] = (acc[e.outcome] || 0) + 1; return acc }, {} as Record<Outcome, number>)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-white/70">Dagens runde</h3>
        <div className="flex items-center gap-3">
          {(Object.keys(OUTCOME_META) as Outcome[]).map((o) => (
            <span key={o} className="flex items-center gap-1.5 text-[11px] text-white/45">
              <span className="h-2 w-2 rounded-full" style={{ background: OUTCOME_META[o].color }} />
              {OUTCOME_META[o].label}
            </span>
          ))}
        </div>
      </div>

      {/* timeline */}
      <div className="relative">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/8" />
        <div className="relative flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {events.map((e, i) => {
            const meta = OUTCOME_META[e.outcome]
            const big = e.outcome === "ja"
            return (
              <motion.div
                key={i}
                className="group/bead relative flex flex-col items-center shrink-0"
                initial={reduced ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 320, damping: 18 }}
              >
                <span
                  className="rounded-full ring-2 ring-[#0d1528]"
                  style={{
                    width: big ? 16 : 11, height: big ? 16 : 11,
                    background: meta.color,
                    boxShadow: big ? `0 0 10px ${meta.color}` : undefined,
                  }}
                />
                <span className="mt-1.5 text-[9px] font-mono text-white/30 opacity-0 group-hover/bead:opacity-100 transition-opacity absolute top-full whitespace-nowrap">
                  {e.time}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* tally */}
      <div className="mt-4 flex items-center gap-4 border-t border-white/8 pt-3">
        {(Object.keys(OUTCOME_META) as Outcome[]).map((o) => (
          <div key={o} className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-bold" style={{ color: OUTCOME_META[o].color }}>{counts[o] || 0}</span>
            <span className="text-[11px] text-white/40">{OUTCOME_META[o].label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TodayJourney
