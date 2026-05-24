"use client"

/**
 * EmployeeDashboardView — the gamified daily dashboard (`/employee/dashbord`).
 * Centerpiece: a dominant goal ring with Roy reacting beside it. Streak + ja-rate
 * flank it; today's journey + response donut + a self-pace strip sit below.
 * Milestone moments fire a one-shot Celebration. Live employee dashboard data.
 */

import React, { useMemo, useState, useEffect, useCallback } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { TrendingUp, TrendingDown, Plus, Zap } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { RoyMascot } from "@/components/gamification/RoyMascot"
import { GoalRing } from "./GoalRing"
import { StreakFlame } from "./StreakFlame"
import { TodayJourney } from "./TodayJourney"
import { ResponseDonut } from "./ResponseDonut"
import { CountUp } from "./CountUp"
import { Celebration } from "./Celebration"
import { RegisterKnockModal } from "./RegisterKnockModal"
import { emptyEmployeeDay, selectEmployeeMood, getMilestone, type EmployeeDayData } from "./employeeLogic"
import { Loader2 } from "lucide-react"
import { fetchEmployeeToday } from "@/lib/api/employeeDashboard"

const moodGlow: Record<string, string> = { "win-big": "#10b981", "win-small": "#3b82f6", concerned: "#f43f5e", greeting: "#ec4899", ready: "#3b82f6" }

export function EmployeeDashboardView() {
  const reduced = useReducedMotion()
  const { user } = useAuth()
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "Jonas"

  // Live "today" (Module 2, guide §7.2). No mock — empty seed while loading,
  // error state on failure; polls for updates once loaded.
  const [data, setData] = useState<EmployeeDayData>(() => emptyEmployeeDay(firstName))
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const refetch = useCallback(() => {
    return fetchEmployeeToday()
      .then((d) => { setData(d); setStatus("ok") })
      .catch(() => { /* keep current data on poll failures */ })
  }, [])
  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchEmployeeToday()
      .then((d) => { if (!cancelled) { setData(d); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("error") })
    const id = window.setInterval(() => { void refetch() }, 20000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [firstName, refetch])

  const mascot = useMemo(() => selectEmployeeMood(data), [data])
  const milestone = useMemo(() => getMilestone(data), [data])
  const [celebrated, setCelebrated] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)

  const aheadOfPace = data.doorsToday >= data.avgDoors7
  const paceDelta = data.doorsToday - data.avgDoors7
  const glow = moodGlow[mascot] || "#3b82f6"

  const fade = (delay: number) => reduced ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] as any } }

  if (status !== "ok") {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 text-center" style={{ background: "linear-gradient(180deg, #0a0f1e 0%, #0b1120 100%)" }}>
        {status === "loading"
          ? <><Loader2 className="h-7 w-7 animate-spin text-white/40" /><p className="text-sm text-white/40">Laster dagen din…</p></>
          : <><p className="text-sm text-white/50">Kunne ikke laste dagsdataene.</p><button onClick={() => window.location.reload()} className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white">Prøv igjen</button></>}
      </div>
    )
  }

  return (
    <div className="min-h-full" style={{ background: "linear-gradient(180deg, #0a0f1e 0%, #0b1120 100%)" }}>
      {/* one-shot milestone celebration */}
      {!celebrated && <Celebration milestone={milestone} onDone={() => setCelebrated(true)} />}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* header */}
        <motion.div {...fade(0)} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm capitalize text-white/40">{data.weekday} {data.dateStr}</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">Hei, {firstName} 👋</h1>
          </div>
          <button
            onClick={() => setRegisterOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(16,185,129,0.6)] transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" /> Registrer dør
          </button>
        </motion.div>

        {/* hero: ring + Roy + flanking tiles */}
        <motion.section {...fade(0.1)} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* ring hero */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <GoalRing value={data.doorsToday} goal={data.doorGoal} size={240} />
              <div className="flex flex-col items-center">
                <motion.div
                  animate={reduced ? {} : { y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="relative"
                >
                  <div className="absolute inset-0 rounded-full blur-2xl -z-10" style={{ background: `${glow}2e`, transform: "scale(1.4)" }} />
                  <RoyMascot state={mascot} size={96} accent={glow} />
                </motion.div>
                <p className="mt-3 max-w-[180px] text-center text-sm text-white/55 leading-snug">
                  {mascot === "win-big" ? "Du knuser det i dag!" : aheadOfPace ? "Du ligger foran ditt eget snitt." : "Hold tempoet — du nærmer deg."}
                </p>
              </div>
            </div>
          </div>

          {/* flanking tiles */}
          <div className="grid grid-cols-1 gap-6">
            <StreakFlame days={data.streakDays} atRisk={data.streakAtRisk} minDoors={data.streakMinDoors} doorsToday={data.doorsToday} />
            {/* ja-rate tile */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
                  <Zap className="h-6 w-6 text-emerald-400" />
                </span>
                <div>
                  <div className="flex items-baseline gap-1">
                    <CountUp value={data.jaProsent} decimals={1} suffix="%" className="font-mono text-3xl font-bold text-white leading-none" />
                  </div>
                  <p className="text-[12px] text-white/45 mt-0.5">ja-rate i dag</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[12px] font-medium" style={{ color: data.jaProsentDelta >= 0 ? "#10b981" : "#f43f5e" }}>
                {data.jaProsentDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {data.jaProsentDelta >= 0 ? "+" : ""}{data.jaProsentDelta.toFixed(1)}pp vs ditt snitt
              </div>
            </div>
          </div>
        </motion.section>

        {/* pace strip */}
        <motion.div {...fade(0.2)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ background: aheadOfPace ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" }}>
            {aheadOfPace ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-amber-400" />}
          </span>
          <p className="text-sm text-white/65">
            {aheadOfPace
              ? <>Du er <span className="font-semibold text-emerald-400">{paceDelta} dører foran</span> ditt 7-dagers snitt på {data.avgDoors7}.</>
              : <>Du er <span className="font-semibold text-amber-400">{Math.abs(paceDelta)} dører bak</span> ditt 7-dagers snitt på {data.avgDoors7}.</>}
          </p>
        </motion.div>

        {/* journey + donut */}
        <motion.section {...fade(0.3)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodayJourney events={data.journey} />
          <ResponseDonut ja={data.jaToday} nei={data.neiToday} ikkeHjemme={data.ikkeHjemmeToday} folgOpp={data.folgOppToday} jaProsent={data.jaProsent} />
        </motion.section>
      </div>

      <RegisterKnockModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={() => { setCelebrated(false); void refetch() }}
      />
    </div>
  )
}

export default EmployeeDashboardView
