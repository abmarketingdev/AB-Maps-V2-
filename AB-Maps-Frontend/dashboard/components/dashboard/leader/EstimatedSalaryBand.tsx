"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { Placeholder } from "./Placeholder"

interface EstimatedSalaryBandProps {
  value: number
  placeholder?: boolean
}

// The wide "Estimert lønn ved oppnåelse av mål" band under the LØNN row.
// Full-width, one big number. Slight gradient so it reads as a promise/target,
// not a fact.
export function EstimatedSalaryBand({ value, placeholder }: EstimatedSalaryBandProps) {
  const reduced = useReducedMotion()
  const { t, lang } = useLang()

  const num = (
    <>
      <span className="text-ab-fg">{value.toLocaleString(lang === "no" ? "nb-NO" : "en-GB")}</span>
      <span className="ml-2 text-lg font-medium text-ab-fg-3">{t("kr")}</span>
    </>
  )

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated px-6 py-5"
    >
      {/* Ambient gradient — subtle, only visible on close read */}
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
          {placeholder ? <Placeholder>{num}</Placeholder> : num}
        </div>
      </div>
    </motion.div>
  )
}
