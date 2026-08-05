"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
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
// Dropdown menu portals into document.body so it escapes ancestor
// `overflow-hidden` clipping (hero panel needs overflow-hidden to contain
// the AuroraBg blur; without portal the menu gets chopped mid-list).
export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const options = useMemo(() => last12Months(), [])
  const now = currentPeriod()

  useEffect(() => { setMounted(true) }, [])

  // Position the menu below the button whenever it opens / on scroll+resize.
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

  // Close on outside click / ESC. Includes the portalled menu in the
  // "inside" check so clicks inside the menu don't close it.
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

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-ab-line bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ab-fg-2 transition-colors hover:border-aurora-amber/40 hover:bg-white/[0.06]"
      >
        <Calendar className="h-3 w-3 text-aurora-amber" />
        <span className="capitalize">{periodLabel(value, lang)}</span>
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
                minWidth: Math.max(190, rect.width),
                zIndex: 1000,
              }}
              className="overflow-hidden rounded-xl border border-ab-line bg-ab-elevated shadow-2xl"
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
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
