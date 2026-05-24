"use client"

/**
 * EmployeeBriefingView — calm post-login welcome for a salesperson (`/employee`).
 * Centred on a YESTERDAY recap + TODAY's goal, both measured against the admin's
 * daily-door threshold. Roy wakes up happy if yesterday's goal was reached, sad
 * if not. A "Gå til dashbord" button fades in after 1.5s → /employee/dashbord.
 * MOCK DATA, Norwegian.
 */

import React, { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Flame, Target, Check, X } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { RoyMascot } from "@/components/gamification/RoyMascot"
import { GoalRing } from "./GoalRing"
import { selectBriefingMascot, getYesterdayHeadline } from "./employeeLogic"
import { fetchEmployeeBriefing, emptyEmployeeBriefing, type EmployeeBriefing } from "@/lib/api/employeeBriefing"
import { Loader2 } from "lucide-react"

export function EmployeeBriefingView() {
  const router = useRouter()
  const reduced = useReducedMotion()
  const { user } = useAuth()
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "Jonas"

  // Live employee briefing (Module 1). No mock — empty seed while loading.
  const seed = useMemo<EmployeeBriefing>(() => emptyEmployeeBriefing(firstName), [firstName])
  const [data, setData] = useState<EmployeeBriefing>(seed)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchEmployeeBriefing()
      .then((d) => { if (!cancelled) { setData(d); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("error") })
    return () => { cancelled = true }
  }, [firstName])

  const goal = data.goal
  const realMascot = useMemo(() => selectBriefingMascot(goal), [goal])
  const { headline, supporting } = useMemo(() => getYesterdayHeadline(goal, data.firstName), [goal, data.firstName])

  // Wake-up: boot asleep, then stretch awake into yesterday's-result mood.
  const [mascot, setMascot] = useState<typeof realMascot>(reduced ? realMascot : "sleeping")
  useEffect(() => {
    if (reduced) { setMascot(realMascot); return }
    setMascot("sleeping")
    const t = setTimeout(() => setMascot(realMascot), 1700)
    return () => clearTimeout(t)
  }, [realMascot, reduced])
  const glow = goal.yesterdayAchieved ? "#10b981" : "#f43f5e"

  const [showCta, setShowCta] = useState(reduced ? true : false)
  useEffect(() => { if (reduced) return; const t = setTimeout(() => setShowCta(true), 1500); return () => clearTimeout(t) }, [reduced])

  const go = () => router.push("/employee/dashbord")

  if (status !== "ok") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 55%, #0a0f1e 100%)" }}>
        {status === "loading"
          ? <><Loader2 className="h-7 w-7 animate-spin text-white/40" /><p className="text-sm text-white/40">Henter dagen din…</p></>
          : <><p className="text-lg font-semibold text-white">God {data.timeOfDay}, {firstName}</p><p className="text-sm text-white/45">Kunne ikke hente dagsoversikten.</p><button onClick={go} className="mt-1 cursor-pointer rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500">Gå til dashbord</button></>}
      </main>
    )
  }
  const fade = (delay: number) => reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] as any } }

  const yPct = Math.round(goal.yesterdayPct * 100)

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 55%, #0a0f1e 100%)" }}>
      {/* ambient blobs (tinted by yesterday's outcome) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div className="absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: `${glow}1a` }}
          animate={reduced ? {} : { x: [0, 30, 0], y: [0, 20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl"
          animate={reduced ? {} : { x: [0, -24, 0], y: [0, -16, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        {/* Roy */}
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
          className="relative"
        >
          <motion.div className="absolute inset-0 rounded-full blur-2xl -z-10"
            animate={{ background: `${glow}40` }} transition={{ duration: 0.6 }} style={{ transform: "scale(1.5)" }} />
          <motion.div key={mascot}
            initial={reduced ? false : { scale: 0.82 }} animate={{ scale: [0.82, 1.14, 1] }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.6, 1] }}>
            <RoyMascot state={mascot} size={120} accent={glow} />
          </motion.div>
        </motion.div>

        {/* greeting */}
        <motion.p {...fade(0.25)} className="mt-8 text-sm capitalize text-white/45">
          {data.weekday} {data.dateStr} · god {data.timeOfDay}
        </motion.p>
        <motion.h1 {...fade(0.35)} className="mt-2 text-2xl sm:text-3xl font-bold leading-snug text-white max-w-xl">
          {headline}
        </motion.h1>
        <motion.p {...fade(0.5)} className="mt-3 text-base leading-relaxed text-white/55 max-w-lg">
          {supporting}
        </motion.p>

        {/* I går / I dag */}
        <div className="mt-10 grid w-full grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Yesterday */}
          <motion.div {...fade(0.65)} className="rounded-2xl border bg-white/[0.03] p-5 text-left"
            style={{ borderColor: goal.yesterdayAchieved ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">I går</span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: goal.yesterdayAchieved ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)", color: glow }}>
                {goal.yesterdayAchieved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {goal.yesterdayAchieved ? "Mål nådd" : "Under mål"}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-white">{goal.yesterdayDoors}</span>
              <span className="text-sm text-white/40">/ {goal.yesterdayGoal} dører</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/8">
              <motion.div className="h-full rounded-full" style={{ background: glow }}
                initial={reduced ? false : { width: 0 }} animate={{ width: `${Math.min(100, yPct)}%` }}
                transition={{ delay: 0.9, duration: 0.8, ease: [0.23, 1, 0.32, 1] }} />
            </div>
            <p className="mt-2 text-[12px] text-white/40">{yPct}% av målet · satt av din leder</p>
          </motion.div>

          {/* Today */}
          <motion.div {...fade(0.78)} className="rounded-2xl border border-blue-400/25 bg-blue-500/[0.05] p-5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">I dag</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-blue-300">
                <Target className="h-3 w-3" /> Dagens mål
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-white">{goal.todayGoal}</span>
              <span className="text-sm text-white/40">dører å banke</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-white/50">
              {goal.hasTodayGoal
                ? <>Målet er satt av din leder for i dag. Du er inne i en <span className="text-orange-300 font-medium">{data.streakDays}-dagers streak</span> 🔥</>
                : <>Ingen eget mål satt i dag — vi bruker standardmålet på {goal.globalDefault} dører.</>}
            </p>
          </motion.div>
        </div>

        {/* live ring preview */}
        <motion.div {...fade(0.95)} className="mt-10 flex flex-col items-center">
          <GoalRing value={data.doorsToday} goal={goal.todayGoal} size={180} />
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/[0.07] px-4 py-2 text-sm text-white/70">
            <Flame className="h-4 w-4 text-orange-400" fill="#fb923c" /> {data.streakDays} dager på rad
          </span>
        </motion.div>
      </div>

      {/* CTA */}
      <motion.div
        initial={false}
        animate={showCta ? { opacity: 1, y: 0, pointerEvents: "auto" } : { opacity: 0, y: 24, pointerEvents: "none" }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="fixed bottom-8 left-0 right-0 z-20 flex justify-center px-6"
      >
        <motion.button
          onClick={go}
          animate={reduced || !showCta ? {} : { y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_8px_32px_-4px_rgba(59,130,246,0.55)] transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Gå til dashbord <ArrowRight className="h-5 w-5" />
        </motion.button>
      </motion.div>
    </main>
  )
}

export default EmployeeBriefingView
