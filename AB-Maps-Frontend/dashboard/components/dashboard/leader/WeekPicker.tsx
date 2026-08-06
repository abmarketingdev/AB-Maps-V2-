"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarDays, Check, ChevronDown } from "lucide-react"
import { useLang } from "@/lib/i18n"

// ISO week helpers. Norway uses ISO (Mon–Sun, ISO 8601). All computed in
// local time — matches the backend which computes weeks server-local in Oslo.

/** Value used for the "live rolling 7 days" option — sent as empty week to
 *  the backend so it falls back to last-7-days. */
export const LIVE_WEEK = "live"

/** Format an ISO week ID: e.g. new Date(2026, 7, 6) → "2026-W32". */
function isoWeekOf(d: Date): string {
  // Copy so we don't mutate input.
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day)  // shift to Thursday of same ISO week
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const wk = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${dt.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`
}

/** Monday (start) of an ISO week ID like "2026-W32". */
function mondayOfIsoWeek(weekId: string): Date {
  const [ys, ws] = weekId.split("-W")
  const year = Number(ys)
  const week = Number(ws)
  const jan4 = new Date(year, 0, 4)               // ISO week 1 always contains Jan 4
  const jan4Day = jan4.getDay() || 7              // ISO day 1 = Monday, 7 = Sunday
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (jan4Day - 1))
  const mon = new Date(week1Monday)
  mon.setDate(week1Monday.getDate() + (week - 1) * 7)
  return mon
}

/** All ISO weeks whose Monday-through-Sunday range overlaps the given month.
 *  A week is included even if only 1 day of it falls in the month, so the
 *  first/last weeks of any month are always represented. */
function weeksOverlappingMonth(period: string): { id: string; mon: Date; sun: Date }[] {
  const [y, m] = period.split("-").map(Number)
  const monthStart = new Date(y, (m || 1) - 1, 1)
  const monthEnd = new Date(y, m || 1, 0)  // last day of month
  const out: { id: string; mon: Date; sun: Date }[] = []
  // Start from the Monday of the week containing monthStart.
  const startDay = monthStart.getDay() || 7
  const cur = new Date(monthStart)
  cur.setDate(monthStart.getDate() - (startDay - 1))
  while (cur <= monthEnd) {
    const mon = new Date(cur)
    const sun = new Date(cur)
    sun.setDate(cur.getDate() + 6)
    out.push({ id: isoWeekOf(mon), mon, sun })
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

/** Short date range label: "3.–9. aug". */
function weekRangeLabel(mon: Date, sun: Date, lang: "no" | "en"): string {
  const locale = lang === "no" ? "nb-NO" : "en-GB"
  const sameMonth = mon.getMonth() === sun.getMonth()
  const monDay = mon.getDate()
  const sunDay = sun.getDate()
  const monMonth = mon.toLocaleDateString(locale, { month: "short" })
  const sunMonth = sun.toLocaleDateString(locale, { month: "short" })
  return sameMonth
    ? `${monDay}.–${sunDay}. ${sunMonth}`
    : `${monDay}. ${monMonth} – ${sunDay}. ${sunMonth}`
}

interface WeekPickerProps {
  /** YYYY-MM — the currently selected month (from MonthPicker). */
  period: string
  /** Selected week id (YYYY-Www) or LIVE_WEEK for rolling 7 days. */
  value: string
  onChange: (week: string) => void
}

export function WeekPicker({ period, value, onChange }: WeekPickerProps) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const now = useMemo(() => new Date(), [])
  const nowWeekId = useMemo(() => isoWeekOf(now), [now])
  const nowPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const isCurrentMonth = period === nowPeriod

  const weeks = useMemo(() => weeksOverlappingMonth(period), [period])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const b = buttonRef.current?.getBoundingClientRect()
      if (b) setRect({ top: b.bottom + 6, left: b.left, width: b.width })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Label for the trigger button.
  const buttonLabel = useMemo(() => {
    if (value === LIVE_WEEK) return t("Denne uken")
    const match = weeks.find(w => w.id === value)
    if (!match) return value
    const wkNum = value.split("-W")[1]
    return `${t("Uke")} ${wkNum} · ${weekRangeLabel(match.mon, match.sun, lang)}`
  }, [value, weeks, lang, t])

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-ab-line bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ab-fg-2 transition-colors hover:border-aurora-amber/40 hover:bg-white/[0.06]"
      >
        <CalendarDays className="h-3 w-3 text-aurora-amber" />
        <span>{buttonLabel}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "fixed",
                top: rect.top,
                left: rect.left,
                minWidth: Math.max(240, rect.width),
                zIndex: 1000,
              }}
              className="overflow-hidden rounded-xl border border-ab-line bg-ab-elevated shadow-2xl"
            >
              <ul role="listbox" className="max-h-80 overflow-y-auto py-1 text-sm">
                {isCurrentMonth && (
                  <li>
                    <button
                      type="button"
                      onClick={() => { onChange(LIVE_WEEK); setOpen(false) }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors ${
                        value === LIVE_WEEK ? "bg-white/[0.08] text-ab-fg" : "text-ab-fg-2 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span>{t("Denne uken")}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-aurora-amber">
                          {t("live")}
                        </span>
                        {value === LIVE_WEEK && <Check className="h-3 w-3 text-aurora-amber" />}
                      </span>
                    </button>
                  </li>
                )}
                {weeks.map(w => {
                  const selected = w.id === value
                  const isNow = w.id === nowWeekId
                  const wkNum = w.id.split("-W")[1]
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => { onChange(w.id); setOpen(false) }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors ${
                          selected ? "bg-white/[0.08] text-ab-fg" : "text-ab-fg-2 hover:bg-white/[0.05]"
                        }`}
                      >
                        <span>
                          {t("Uke")} <span className="font-mono">{wkNum}</span>
                          <span className="ml-2 text-ab-fg-4">{weekRangeLabel(w.mon, w.sun, lang)}</span>
                        </span>
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
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** Sensible default when switching month:
 *  - current month → LIVE_WEEK (rolling last 7 days)
 *  - past month → the LAST ISO week that overlaps the month (most recent)
 */
export function defaultWeekForPeriod(period: string): string {
  const now = new Date()
  const nowPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  if (period === nowPeriod) return LIVE_WEEK
  const weeks = weeksOverlappingMonth(period)
  return weeks.length ? weeks[weeks.length - 1].id : LIVE_WEEK
}
