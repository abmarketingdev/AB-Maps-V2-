"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { DoorOpen, UserPlus, X } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { saveCampaignGoal } from "@/lib/api/campaigns"

interface SetCampaignGoalModalProps {
  campaignId: string
  campaignName: string
  /** Selected month (YYYY-MM). Falls back to current month if omitted. */
  period?: string
  initialDoorsGoal?: number
  initialRecruitedGoal?: number
  initialDoorsWeeklyGoal?: number | null
  initialRecruitedWeeklyGoal?: number | null
  onClose: () => void
  onSaved: () => void
}

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function periodLabel(period: string, lang: "no" | "en") {
  const [y, m] = period.split("-").map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  return d.toLocaleDateString(lang === "no" ? "nb-NO" : "en-GB",
    { month: "long", year: "numeric" })
}

// Modal for setting a campaign's (project's) per-month + per-week goals
// (2026-08-06). Mirrors SetTeamGoalModal exactly — same visual signature,
// same validation, same portal pattern. Backend: hr-service CampaignGoalView.
export function SetCampaignGoalModal({
  campaignId, campaignName, period, initialDoorsGoal = 0, initialRecruitedGoal = 0,
  initialDoorsWeeklyGoal = null, initialRecruitedWeeklyGoal = null,
  onClose, onSaved,
}: SetCampaignGoalModalProps) {
  const { t, lang } = useLang()
  const [mounted, setMounted] = useState(false)
  const [doorsGoal, setDoorsGoal] = useState(String(initialDoorsGoal || ""))
  const [recruitedGoal, setRecruitedGoal] = useState(String(initialRecruitedGoal || ""))
  const [doorsWeeklyGoal, setDoorsWeeklyGoal] = useState(
    initialDoorsWeeklyGoal != null ? String(initialDoorsWeeklyGoal) : "",
  )
  const [recruitedWeeklyGoal, setRecruitedWeeklyGoal] = useState(
    initialRecruitedWeeklyGoal != null ? String(initialRecruitedWeeklyGoal) : "",
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const targetPeriod = period ?? currentPeriod()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function parseOptional(v: string): number | null | "invalid" {
    if (v.trim() === "") return null
    const n = parseInt(v, 10)
    if (Number.isNaN(n) || n < 0) return "invalid"
    return n
  }

  async function handleSave() {
    setErr(null)
    const d = parseInt(doorsGoal || "0", 10)
    const r = parseInt(recruitedGoal || "0", 10)
    if (Number.isNaN(d) || Number.isNaN(r) || d < 0 || r < 0) {
      setErr(t("Mål må være et positivt tall"))
      return
    }
    const dw = parseOptional(doorsWeeklyGoal)
    const rw = parseOptional(recruitedWeeklyGoal)
    if (dw === "invalid" || rw === "invalid") {
      setErr(t("Ukesmål må være et positivt tall"))
      return
    }
    setSaving(true)
    try {
      await saveCampaignGoal(campaignId, {
        period: targetPeriod,
        doors_goal: d,
        recruited_goal: r,
        doors_weekly_goal: dw,
        recruited_weekly_goal: rw,
      })
      onSaved()
    } catch (e: any) {
      setErr(e?.message || t("Kunne ikke lagre mål"))
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
        className="bg-black/60 backdrop-blur-sm"
      />
      <div
        key="wrap"
        style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}
        className="flex items-center justify-center p-3 sm:p-4"
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          style={{ pointerEvents: "auto" }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-ab-line bg-ab-elevated shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-ab-fg-3">
                {t("Prosjekt-mål")}
              </p>
              <h3 className="mt-0.5 font-instrument text-2xl leading-tight text-ab-fg">
                {campaignName}
              </h3>
              <p className="mt-1 text-xs text-ab-fg-3 capitalize">
                {periodLabel(targetPeriod, lang)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ab-fg-3 transition-colors hover:bg-white/[0.06] hover:text-ab-fg"
              aria-label={t("Lukk")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-6 pb-5">
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
              {t("Måned")}
            </p>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
                <DoorOpen className="h-3 w-3 text-[#8B5CF6]" />
                {t("Mål: Dører")}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={doorsGoal}
                onChange={(e) => setDoorsGoal(e.target.value)}
                className="w-full rounded-xl border border-ab-line bg-white/[0.03] px-4 py-3 font-mono text-lg text-ab-fg placeholder:text-ab-fg-4 focus:border-aurora-amber/50 focus:outline-none"
                placeholder="0"
                autoFocus
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
                <UserPlus className="h-3 w-3 text-[#0E9384]" />
                {t("Mål: Rekruttert")}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={recruitedGoal}
                onChange={(e) => setRecruitedGoal(e.target.value)}
                className="w-full rounded-xl border border-ab-line bg-white/[0.03] px-4 py-3 font-mono text-lg text-ab-fg placeholder:text-ab-fg-4 focus:border-aurora-amber/50 focus:outline-none"
                placeholder="0"
              />
            </label>

            <div className="border-t border-ab-line-1 pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
                {t("Uke")}{" "}
                <span className="ml-1 font-normal normal-case tracking-normal text-ab-fg-4">
                  {t("(valgfritt)")}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
                    <DoorOpen className="h-3 w-3 text-[#8B5CF6]" />
                    {t("Dører / uke")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={doorsWeeklyGoal}
                    onChange={(e) => setDoorsWeeklyGoal(e.target.value)}
                    className="w-full rounded-xl border border-ab-line bg-white/[0.03] px-4 py-3 font-mono text-lg text-ab-fg placeholder:text-ab-fg-4 focus:border-aurora-amber/50 focus:outline-none"
                    placeholder="—"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
                    <UserPlus className="h-3 w-3 text-[#0E9384]" />
                    {t("Rekruttert / uke")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={recruitedWeeklyGoal}
                    onChange={(e) => setRecruitedWeeklyGoal(e.target.value)}
                    className="w-full rounded-xl border border-ab-line bg-white/[0.03] px-4 py-3 font-mono text-lg text-ab-fg placeholder:text-ab-fg-4 focus:border-aurora-amber/50 focus:outline-none"
                    placeholder="—"
                  />
                </label>
              </div>
            </div>

            {err && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-300">
                {err}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-ab-line-1 bg-white/[0.02] px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full px-4 py-2 text-xs font-medium text-ab-fg-2 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              {t("Avbryt")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-aurora-amber px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-aurora-amber/90 disabled:opacity-50"
            >
              {saving ? t("Lagrer…") : t("Lagre mål")}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  )
}
