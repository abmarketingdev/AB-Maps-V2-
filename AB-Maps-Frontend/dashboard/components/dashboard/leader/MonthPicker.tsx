"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Check, ChevronDown } from "lucide-react"
import { useLang } from "@/lib/i18n"

// YYYY-MM string helpers. All computation done in local time — matches
// how the backend expects `period=YYYY-MM` (Oslo month).
function periodOf(year: number, month0: number) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`
}
function currentPeriod() {
  const d = new Date()
  return periodOf(d.getFullYear(), d.getMonth())
}
function periodLabel(period: string, lang: "no" | "en") {
  const [y, m] = period.split("-").map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  return d.toLocaleDateString(lang === "no" ? "nb-NO" : "en-GB",
    { month: "long", year: "numeric" })
}

// Build a list of the last 12 months (current + 11 back).
function last12Months(): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(periodOf(d.getFullYear(), d.getMonth()))
  }
  return out
}

interface MonthPickerProps {
  value: string                       // "YYYY-MM"
  onChange: (period: string) => void
}

// Pill dropdown for selecting a month. Aurora Nordic styling (borrowed from
// SectionHeader + LonnTile). Renders inline in the dashboard hero panel.
export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const options = useMemo(() => last12Months(), [])
  const now = currentPeriod()

  // Close on outside click / ESC
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-ab-line bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ab-fg-2 transition-colors hover:border-aurora-amber/40 hover:bg-white/[0.06]"
      >
        <Calendar className="h-3 w-3 text-aurora-amber" />
        <span className="capitalize">{periodLabel(value, lang)}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-1.5 min-w-[190px] overflow-hidden rounded-xl border border-ab-line bg-ab-elevated shadow-2xl"
          >
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1 text-sm">
              {options.map(p => {
                const selected = p === value
                const isNow = p === now
                return (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => { onChange(p); setOpen(false) }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors ${
                        selected ? "bg-white/[0.08] text-ab-fg" : "text-ab-fg-2 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="capitalize">{periodLabel(p, lang)}</span>
                      <span className="flex items-center gap-1.5">
                        {isNow && (
                          <span className="text-[9px] font-mono uppercase tracking-wider text-aurora-amber">
                            {t("nå")}
                          </span>
                        )}
                        {selected && <Check className="h-3 w-3 text-aurora-amber" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
