"use client"

/**
 * The prod EmployeeDashboardView widgets, rendered inline inside PromoterDashboard
 * WITHOUT the outer greeting header / celebration overlay / full-page wrapper.
 *
 * Visually integrates the live-data widgets into the promoter dashboard as one
 * cohesive page. All API endpoints + polling + shapes are IDENTICAL to
 * EmployeeDashboardView:
 *   - fetchEmployeeToday()               → /api/employee/me/today/  (mount + every 20s)
 *   - RegisterKnockModal on submit       → POST /api/employee/me/registrations/
 *
 * The critical daily-use RegisterKnockModal button is preserved as a floating
 * primary action — same modal, same POST, same refetch trigger.
 */

import { useEffect, useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Loader2, Plus, TrendingUp, TrendingDown, Zap } from "lucide-react"
import { RoyMascot } from "@/components/gamification/RoyMascot"
import { GoalRing } from "@/components/dashboard/v2/employee/GoalRing"
import { StreakFlame } from "@/components/dashboard/v2/employee/StreakFlame"
import { TodayJourney } from "@/components/dashboard/v2/employee/TodayJourney"
import { ResponseDonut } from "@/components/dashboard/v2/employee/ResponseDonut"
import { CountUp } from "@/components/dashboard/v2/employee/CountUp"
// RegisterKnockModal import removed Phase A — modal deleted, POST endpoint didn't exist
import { selectEmployeeMood } from "@/components/dashboard/v2/employee/employeeLogic"
import { useLang } from "@/lib/i18n"
import { useEmployeeToday } from "./EmployeeTodayContext"

const moodGlow: Record<string, string> = {
  "win-big": "#10b981", "win-small": "#3b82f6",
  concerned: "#f43f5e", greeting: "#ec4899", ready: "#3b82f6",
}

export function EmbeddedPromoterWidgets() {
  const reduced = useReducedMotion()
  const { t } = useLang()
  const { data, status } = useEmployeeToday()

  // Formerly here: `useEffect` that listened for `abmaps:open-register-knock`
  // and called setRegisterOpen(true). Removed 2026-08-05 with Phase A cleanup:
  // the inline modal POSTed to /api/employee/me/registrations/ which doesn't
  // exist. Both Registrer dør buttons now redirect to /emp/ instead.

  const mascot = useMemo(() => selectEmployeeMood(data), [data])
  const aheadOfPace = data.doorsToday >= data.avgDoors7
  const paceDelta = data.doorsToday - data.avgDoors7
  const glow = moodGlow[mascot] || "#3b82f6"

  const fade = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.4, ease: [0.23, 1, 0.32, 1] as any } }

  // Loading / error states — inline, don't take over the page
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-ab-line bg-ab-elevated p-8 text-sm text-ab-fg-3">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("Laster dagen din …")}
      </div>
    )
  }
  if (status === "error") {
    return (
      <div className="rounded-2xl border border-ab-line bg-ab-elevated p-6 text-center text-sm text-ab-fg-3">
        {t("Kunne ikke laste dagsdata (backend forsøkt kontaktet). Registrer-knapp fortsatt tilgjengelig via dør-appen.")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Register-knock action bar — prominent, keeps the primary daily action visible */}
      <motion.div {...fade(0)} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-ab-line bg-ab-elevated px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ab-fg">{t("Registrer en dør nå")}</p>
          <p className="mt-0.5 text-xs text-ab-fg-3">{t("Ja / Nei / Ikke hjemme / Følg opp — samme som før")}</p>
        </div>
        {/* Redirects to /emp/ map app — the real knock-registration endpoint.
            The inline modal formerly opened by setRegisterOpen(true) POSTs to a
            non-existent /api/employee/me/registrations/ backend route (verified
            2026-08-05). Employees register knocks via emp map's PATCH
            /api/apartments/{id}/ flow. */}
        <button
          onClick={() => { window.location.href = "/emp/" }}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(16,185,129,0.6)] transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" /> {t("Registrer dør")}
        </button>
      </motion.div>

      {/* Hero: goal ring + Roy + streak + ja-rate side by side */}
      <motion.section {...fade(0.05)} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <GoalRing value={data.doorsToday} goal={data.doorGoal} size={200} />
            <div className="flex flex-col items-center">
              <motion.div
                animate={reduced ? {} : { y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="absolute inset-0 rounded-full blur-2xl -z-10" style={{ background: `${glow}2e`, transform: "scale(1.4)" }} />
                <RoyMascot state={mascot} size={80} accent={glow} />
              </motion.div>
              <p className="mt-3 max-w-[180px] text-center text-xs text-ab-fg-3 leading-snug">
                {mascot === "win-big" ? t("Du knuser det i dag!") : aheadOfPace ? t("Du ligger foran ditt eget snitt.") : t("Hold tempoet — du nærmer deg.")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <StreakFlame days={data.streakDays} atRisk={data.streakAtRisk} minDoors={data.streakMinDoors} doorsToday={data.doorsToday} />

          {/* Ja-rate tile */}
          <div className="rounded-2xl border border-ab-line bg-ab-elevated p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15">
                <Zap className="h-5 w-5 text-emerald-400" />
              </span>
              <div>
                <CountUp value={data.jaProsent} decimals={1} suffix="%" className="font-mono text-2xl font-bold text-ab-fg leading-none" />
                <p className="mt-0.5 text-[11px] text-ab-fg-3">{t("ja-rate i dag")}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: data.jaProsentDelta >= 0 ? "#10b981" : "#f43f5e" }}>
              {data.jaProsentDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {data.jaProsentDelta >= 0 ? "+" : ""}{data.jaProsentDelta.toFixed(1)}{t("pp vs ditt snitt")}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Pace strip */}
      <motion.div {...fade(0.1)} className="flex items-center gap-3 rounded-2xl border border-ab-line bg-ab-elevated px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ background: aheadOfPace ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" }}>
          {aheadOfPace ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-amber-400" />}
        </span>
        <p className="text-sm text-ab-fg-2">
          {aheadOfPace
            ? <>{t("Du er")} <span className="font-semibold text-emerald-400">{paceDelta} {t("dører foran")}</span> {t("ditt 7-dagers snitt på")} {data.avgDoors7}.</>
            : <>{t("Du er")} <span className="font-semibold text-amber-400">{Math.abs(paceDelta)} {t("dører bak")}</span> {t("ditt 7-dagers snitt på")} {data.avgDoors7}.</>}
        </p>
      </motion.div>

      {/* Today journey + response donut */}
      <motion.section {...fade(0.15)} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TodayJourney events={data.journey} />
        <ResponseDonut ja={data.jaToday} nei={data.neiToday} ikkeHjemme={data.ikkeHjemmeToday} folgOpp={data.folgOppToday} jaProsent={data.jaProsent} />
      </motion.section>

      {/* RegisterKnockModal removed Phase A (2026-08-05) — POSTed to a backend
          route that doesn't exist. Knock registration now handled by the /emp/
          CRA map app (PATCH /api/apartments/{id}/); Registrer dør buttons on
          this dashboard redirect there. If the backend adds
          /api/employee/me/registrations/ later, this modal can come back. */}
    </div>
  )
}

export default EmbeddedPromoterWidgets
