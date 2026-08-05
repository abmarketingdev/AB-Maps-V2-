"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { fetchSalarySummary, fetchMySalary, currentPeriod } from "@/lib/api/salary"

interface EstimatedSalaryBandProps {
  /**
   * Which endpoint to consume:
   *   'salgsleder' → /api/hr/salary/summary/ (manager view)
   *   'promoter'   → /api/hr/salary/me/      (employee view)
   * Both return the same shape but scoped differently.
   */
  variant?: 'salgsleder' | 'promoter'
  /** YYYY-MM. When omitted, defaults to current month. */
  period?: string
  /** When set, backend restricts aggregation to this campaign. */
  campaignId?: string
}

// The wide "Estimert lønn ved oppnåelse av mål" band under the LØNN row.
// Renders REAL projected salary — from /api/hr/salary/{summary,me}/'s
// `estimert_lonn_ved_mal` field. That field requires the Goals endpoint
// (Phase D) to be populated; until then it's null and this component
// renders nothing (no fake number, silent hide).
export function EstimatedSalaryBand({ variant = 'salgsleder', period, campaignId }: EstimatedSalaryBandProps) {
  const reduced = useReducedMotion()
  const { t, lang } = useLang()
  const [value, setValue] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setValue(null)  // reset when period changes so we don't flash stale
    const fetcher = variant === 'promoter' ? fetchMySalary : fetchSalarySummary
    fetcher({ period: period ?? currentPeriod(), campaignId })
      .then((s: any) => {
        if (cancelled) return
        const raw = s?.estimert_lonn_ved_mal
        if (raw != null) {
          const parsed = parseFloat(raw)
          if (!isNaN(parsed) && parsed > 0) setValue(parsed)
        }
      })
      .catch(() => { /* silent — component hides itself when value stays null */ })
    return () => { cancelled = true }
  }, [variant, period, campaignId])

  // Silent hide until Phase D goals endpoint ships (nothing to promise yet).
  if (value === null) return null

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated px-6 py-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, rgba(52,97,255,0.10), transparent 60%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ab-accent/15 text-ab-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
              {t("Estimert lønn")}
            </p>
            <p className="mt-0.5 text-xs text-ab-fg-3">{t("ved oppnåelse av mål")}</p>
          </div>
        </div>

        <div className="font-mono text-3xl font-bold tracking-tight">
          <span className="text-ab-fg">
            {value.toLocaleString(lang === "no" ? "nb-NO" : "en-GB")}
          </span>
          <span className="ml-2 text-lg font-medium text-ab-fg-3">{t("kr")}</span>
        </div>
      </div>
    </motion.div>
  )
}
