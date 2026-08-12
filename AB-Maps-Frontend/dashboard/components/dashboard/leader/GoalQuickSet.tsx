"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarRange, DoorOpen, UserPlus, X } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { saveTeamGoal } from "@/lib/api/teams"

/**
 * Fast, date-range goal setter (2026-08-12).
 *
 * Instead of the /mal-innstillinger detour (one modal per team, per month), a
 * chief/lead picks a MONTH RANGE + a single set of targets and we upsert the
 * goal for every month in the range × every selected team via the existing
 * per-month PUT (`saveTeamGoal`). Monthly is required; weekly + daily optional.
 */

export interface QuickSetTeam {
  id: string
  name: string
}

interface GoalQuickSetProps {
  /** Teams the caller may edit (can_edit === true). */
  teams: QuickSetTeam[]
  /** Focused month (YYYY-MM) — used as the default range start+end. */
  defaultPeriod?: string
  /** Optional: pre-open with focus on a period section (from a "not set" prompt). */
  focus?: "monthly" | "weekly" | "daily"
  onClose: () => void
  onSaved: () => void
}

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** All YYYY-MM strings from start..end inclusive (max 24 to stay sane). */
function monthsInRange(startYm: string, endYm: string): string[] {
  const [sy, sm] = startYm.split("-").map(Number)
  const [ey, em] = endYm.split("-").map(Number)
  if (!sy || !sm || !ey || !em) return []
  let cur = sy * 12 + (sm - 1)
  const end = ey * 12 + (em - 1)
  if (end < cur) return []
  const out: string[] = []
  while (cur <= end && out.length < 24) {
    const y = Math.floor(cur / 12)
    const m = (cur % 12) + 1
    out.push(`${y}-${String(m).padStart(2, "0")}`)
    cur++
  }
  return out
}

function parseOptional(v: string): number | null | "invalid" {
  if (v.trim() === "") return null
  const n = parseInt(v, 10)
  if (Number.isNaN(n) || n < 0) return "invalid"
  return n
}

export function GoalQuickSet({ teams, defaultPeriod, focus, onClose, onSaved }: GoalQuickSetProps) {
  const { t } = useLang()
  const [mounted, setMounted] = useState(false)
  const start0 = defaultPeriod || currentPeriod()
  const [startYm, setStartYm] = useState(start0)
  const [endYm, setEndYm] = useState(start0)
  const [doorsGoal, setDoorsGoal] = useState("")
  const [recruitedGoal, setRecruitedGoal] = useState("")
  const [doorsWeekly, setDoorsWeekly] = useState("")
  const [recruitedWeekly, setRecruitedWeekly] = useState("")
  const [doorsDaily, setDoorsDaily] = useState("")
  const [recruitedDaily, setRecruitedDaily] = useState("")
  const [allTeams, setAllTeams] = useState(teams.length > 1)
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "")
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose, saving])

  const months = useMemo(() => monthsInRange(startYm, endYm), [startYm, endYm])
  const targetTeams = allTeams ? teams : teams.filter((tm) => tm.id === teamId)

  async function handleSave() {
    setErr(null)
    const d = parseInt(doorsGoal || "0", 10)
    const r = parseInt(recruitedGoal || "0", 10)
    if (Number.isNaN(d) || Number.isNaN(r) || d < 0 || r < 0) {
      setErr(t("Mål må være et positivt tall")); return
    }
    const dw = parseOptional(doorsWeekly), rw = parseOptional(recruitedWeekly)
    const dd = parseOptional(doorsDaily), rd = parseOptional(recruitedDaily)
    if ([dw, rw, dd, rd].includes("invalid")) {
      setErr(t("Uke-/dagsmål må være et positivt tall")); return
    }
    if (months.length === 0) { setErr(t("Velg et gyldig datointervall")); return }
    if (targetTeams.length === 0) { setErr(t("Velg minst ett team")); return }

    setSaving(true)
    const jobs: Array<{ teamId: string; period: string }> = []
    for (const tm of targetTeams) for (const period of months) jobs.push({ teamId: tm.id, period })
    setProgress({ done: 0, total: jobs.length })
    try {
      let done = 0
      for (const job of jobs) {
        await saveTeamGoal(job.teamId, {
          period: job.period,
          doors_goal: d,
          recruited_goal: r,
          doors_weekly_goal: dw as number | null,
          recruited_weekly_goal: rw as number | null,
          doors_daily_goal: dd as number | null,
          recruited_daily_goal: rd as number | null,
        })
        done++
        setProgress({ done, total: jobs.length })
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.message || t("Kunne ikke lagre mål"))
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  const inputCls = "w-full rounded-xl border border-ab-line bg-white/[0.03] px-4 py-3 font-mono text-lg text-ab-fg placeholder:text-ab-fg-4 focus:border-aurora-amber/50 focus:outline-none"
  const labelCls = "mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3"

  return createPortal(
    <AnimatePresence>
      <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }} onClick={() => !saving && onClose()}
        style={{ position: "fixed", inset: 0, zIndex: 999 }} className="bg-black/60 backdrop-blur-sm" />
      <div key="wrap" style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}
        className="flex items-center justify-center p-3 sm:p-4">
        <motion.div key="modal" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          style={{ pointerEvents: "auto" }}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-ab-line bg-ab-elevated shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-ab-fg-3 flex items-center gap-1.5">
                <CalendarRange className="h-3 w-3 text-aurora-amber" />
                {t("Sett mål")}
              </p>
              <h3 className="mt-0.5 font-instrument text-2xl leading-tight text-ab-fg">
                {t("Mål for en periode")}
              </h3>
              <p className="mt-1 text-xs text-ab-fg-3">
                {t("Velg datointervall og mål — vi lagrer for hver måned i intervallet.")}
              </p>
            </div>
            <button type="button" onClick={() => !saving && onClose()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ab-fg-3 transition-colors hover:bg-white/[0.06] hover:text-ab-fg"
              aria-label={t("Lukk")}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 pb-5">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}><CalendarRange className="h-3 w-3 text-aurora-amber" />{t("Fra måned")}</span>
                <input type="month" value={startYm} onChange={(e) => { setStartYm(e.target.value); if (e.target.value > endYm) setEndYm(e.target.value) }} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}><CalendarRange className="h-3 w-3 text-aurora-amber" />{t("Til måned")}</span>
                <input type="month" value={endYm} min={startYm} onChange={(e) => setEndYm(e.target.value)} className={inputCls} />
              </label>
            </div>
            <p className="text-[11px] text-ab-fg-4">
              {months.length > 0
                ? t("{n} måned(er) i intervallet").replace("{n}", String(months.length))
                : t("Ugyldig intervall")}
            </p>

            {/* Team scope */}
            {teams.length > 1 && (
              <div className="flex items-center gap-3 rounded-xl border border-ab-line bg-white/[0.02] px-3 py-2.5">
                <label className="flex items-center gap-2 text-xs text-ab-fg-2">
                  <input type="checkbox" checked={allTeams} onChange={(e) => setAllTeams(e.target.checked)} />
                  {t("Gjelder alle mine team")}{" "}<span className="text-ab-fg-4">({teams.length})</span>
                </label>
                {!allTeams && (
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
                    className="ml-auto rounded-lg border border-ab-line bg-white/[0.03] px-2 py-1.5 text-xs text-ab-fg focus:outline-none">
                    {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Monthly — required */}
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">{t("Måned")}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}><DoorOpen className="h-3 w-3 text-[#8B5CF6]" />{t("Dører")}</span>
                <input type="number" min={0} step={1} inputMode="numeric" value={doorsGoal} onChange={(e) => setDoorsGoal(e.target.value)} className={inputCls} placeholder="0" autoFocus={focus !== "weekly" && focus !== "daily"} />
              </label>
              <label className="block">
                <span className={labelCls}><UserPlus className="h-3 w-3 text-[#0E9384]" />{t("Rekruttert")}</span>
                <input type="number" min={0} step={1} inputMode="numeric" value={recruitedGoal} onChange={(e) => setRecruitedGoal(e.target.value)} className={inputCls} placeholder="0" />
              </label>
            </div>

            {/* Weekly — optional */}
            <div className="border-t border-ab-line-1 pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
                {t("Uke")} <span className="ml-1 font-normal normal-case tracking-normal text-ab-fg-4">{t("(valgfritt)")}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}><DoorOpen className="h-3 w-3 text-[#8B5CF6]" />{t("Dører / uke")}</span>
                  <input type="number" min={0} step={1} inputMode="numeric" value={doorsWeekly} onChange={(e) => setDoorsWeekly(e.target.value)} className={inputCls} placeholder="—" autoFocus={focus === "weekly"} />
                </label>
                <label className="block">
                  <span className={labelCls}><UserPlus className="h-3 w-3 text-[#0E9384]" />{t("Rekruttert / uke")}</span>
                  <input type="number" min={0} step={1} inputMode="numeric" value={recruitedWeekly} onChange={(e) => setRecruitedWeekly(e.target.value)} className={inputCls} placeholder="—" />
                </label>
              </div>
            </div>

            {/* Daily — optional */}
            <div className="border-t border-ab-line-1 pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
                {t("Dag")} <span className="ml-1 font-normal normal-case tracking-normal text-ab-fg-4">{t("(valgfritt)")}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}><DoorOpen className="h-3 w-3 text-[#8B5CF6]" />{t("Dører / dag")}</span>
                  <input type="number" min={0} step={1} inputMode="numeric" value={doorsDaily} onChange={(e) => setDoorsDaily(e.target.value)} className={inputCls} placeholder="—" autoFocus={focus === "daily"} />
                </label>
                <label className="block">
                  <span className={labelCls}><UserPlus className="h-3 w-3 text-[#0E9384]" />{t("Rekruttert / dag")}</span>
                  <input type="number" min={0} step={1} inputMode="numeric" value={recruitedDaily} onChange={(e) => setRecruitedDaily(e.target.value)} className={inputCls} placeholder="—" />
                </label>
              </div>
            </div>

            {err && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-300">{err}</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-ab-line-1 bg-white/[0.02] px-6 py-3">
            <span className="text-[11px] text-ab-fg-4">
              {saving && progress ? `${t("Lagrer")} ${progress.done}/${progress.total}…`
                : t("Lagrer {n} mål").replace("{n}", String(Math.max(0, months.length * targetTeams.length)))}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => !saving && onClose()} disabled={saving}
                className="rounded-full px-4 py-2 text-xs font-medium text-ab-fg-2 transition-colors hover:bg-white/[0.06] disabled:opacity-50">
                {t("Avbryt")}
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="rounded-full bg-aurora-amber px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-aurora-amber/90 disabled:opacity-50">
                {saving ? t("Lagrer…") : t("Lagre mål")}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  )
}
