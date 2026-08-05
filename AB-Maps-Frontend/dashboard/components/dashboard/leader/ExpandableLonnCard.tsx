"use client"

import { useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { Placeholder } from "./Placeholder"
import type { ReactNode } from "react"

export type BreakdownRow = {
  key: string
  label: string          // e.g. team name
  sub?: string           // e.g. manager name
  value: number          // kr
  color: string          // team accent
}

interface ExpandableLonnCardProps {
  label: string
  value: number
  suffix?: string        // e.g. "kr"
  accent: string
  icon: ReactNode
  /** Rows shown when expanded. If empty, card doesn't expand. */
  breakdown?: BreakdownRow[]
  breakdownLabel?: string // header above the rows, e.g. "Per team"
  placeholder?: boolean
}

// A LonnTile that expands on click to show a per-source breakdown (e.g.
// LEDERPROVISJON expands into per-team contributions). Same visual weight
// as LonnTile in its collapsed state — reads as part of the LØNN row.
export function ExpandableLonnCard({
  label, value, suffix = "kr", accent, icon, breakdown, breakdownLabel = "Fordeling", placeholder,
}: ExpandableLonnCardProps) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const canExpand = (breakdown?.length ?? 0) > 0

  const number = (
    <>
      <span className="text-ab-fg">{value.toLocaleString("nb-NO")}</span>
      {suffix && <span className="ml-1 text-sm font-medium text-ab-fg-3">{suffix}</span>}
    </>
  )

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated transition-all duration-200"
      style={{ boxShadow: open ? `0 0 0 1px ${accent}55, 0 8px 32px -12px ${accent}66` : undefined }}
    >
      <button
        type="button"
        onClick={() => canExpand && setOpen(v => !v)}
        disabled={!canExpand}
        className={"block w-full p-5 text-left transition-colors " + (canExpand ? "cursor-pointer hover:bg-ab-hover" : "cursor-default")}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
            {label}
          </p>
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: `${accent}18`, color: accent }}
            >
              {icon}
            </div>
            {canExpand && (
              <motion.div
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="text-ab-fg-3"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            )}
          </div>
        </div>

        <div className="mt-3 font-mono text-2xl font-bold tracking-tight">
          {placeholder ? <Placeholder>{number}</Placeholder> : number}
        </div>

        {canExpand && !open && (
          <p className="mt-2 text-[11px] font-medium text-ab-fg-3 opacity-0 transition-opacity group-hover:opacity-100">
            Klikk for fordeling →
          </p>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && breakdown && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.3, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="border-t border-ab-line-1 px-5 py-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
                {breakdownLabel}
              </p>
              <div className="space-y-1.5">
                {breakdown.map((row, i) => {
                  const pct = value > 0 ? row.value / value : 0
                  return (
                    <motion.div
                      key={row.key}
                      initial={reduced ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                      className="rounded-xl p-2 transition-colors hover:bg-ab-hover"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color, boxShadow: `0 0 8px ${row.color}88` }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ab-fg">{row.label}</p>
                          {row.sub && <p className="truncate text-[11px] text-ab-fg-3">{row.sub}</p>}
                        </div>
                        <div className="text-right font-mono">
                          <p className="text-sm font-semibold text-ab-fg">
                            <Placeholder>
                              {row.value.toLocaleString("nb-NO")}
                              <span className="ml-1 text-xs font-medium text-ab-fg-3">{suffix}</span>
                            </Placeholder>
                          </p>
                          <p className="text-[10px] text-ab-fg-4">{Math.round(pct * 100)}%</p>
                        </div>
                      </div>
                      {/* micro bar */}
                      <div className="ml-5 mt-1.5 h-0.5 overflow-hidden rounded-full bg-ab-hover">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: row.color }}
                          initial={reduced ? false : { width: 0 }}
                          animate={{ width: `${pct * 100}%` }}
                          transition={{ delay: 0.1 + i * 0.05, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                        />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom accent line (visible on hover, always visible when open) */}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] transition-opacity duration-200"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: open ? 1 : 0,
        }}
      />
      {!open && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
    </motion.div>
  )
}
