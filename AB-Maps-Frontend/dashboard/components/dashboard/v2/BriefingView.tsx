"use client"

/**
 * Briefing (Hjem) — calm, playful "good morning" welcome shown after login.
 * Standalone full-screen page: no sidebar, no navbar. Surfaces only the few
 * signals worth acting on. A "Gå til dashbord" button fades in after 1.5s to
 * enter the dense app. MOCK DATA via briefingLogic. Norwegian, Duolingo-calm.
 */

import React, { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, AlertCircle, TrendingUp, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/AuthContext"
import { RoyMascot } from "@/components/gamification/RoyMascot"
import {
  emptyBriefing, selectMascotState, generateHeadline, buildFocusCards, pickInsight,
  type FocusCard, type BriefingData,
} from "./briefingLogic"
import { fetchManagerBriefing } from "@/lib/api/briefing"
import { Loader2 } from "lucide-react"

const SEV_DOT: Record<FocusCard["severity"], string> = { warning: "#f59e0b", danger: "#f43f5e", info: "#8b5cf6" }
const DELTA_COLOR: Record<FocusCard["deltaTone"], string> = { warning: "#f59e0b", danger: "#f43f5e", success: "#10b981", neutral: "rgba(255,255,255,0.4)" }
const CARD_ICON = { alerts: AlertCircle, trend: TrendingUp, concentration: Users }

function DotGrid({ total, filled, color }: { total: number; filled: number; color: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" style={{ maxWidth: 132 }} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <motion.span key={i} className="h-2.5 w-2.5 rounded-full"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + i * 0.025, type: "spring", stiffness: 300, damping: 18 }}
          style={{ background: i < filled ? color : "rgba(255,255,255,0.12)" }} />
      ))}
    </div>
  )
}

function AreaSpark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const W = 100, H = 40
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - ((v - min) / range) * (H - 8) - 4])
  const line = pts.map(p => `${p[0]},${p[1]}`).join(" ")
  const area = `0,${H} ${line} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-12" aria-hidden>
      <defs><linearGradient id="briefSpark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.4" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={area} fill="url(#briefSpark)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Donut({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="relative h-[72px] w-[72px] shrink-0" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <motion.circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ delay: 0.9, duration: 0.9, ease: [0.23, 1, 0.32, 1] }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center"><span className="font-mono text-lg font-bold text-ab-fg">{label}</span></div>
    </div>
  )
}

const DELTA_BG: Record<FocusCard["deltaTone"], string> = { success: "rgba(16,185,129,0.12)", warning: "rgba(245,158,11,0.12)", danger: "rgba(244,63,94,0.12)", neutral: "rgba(255,255,255,0.06)" }
function DeltaPill({ text, tone }: { text: string; tone: FocusCard["deltaTone"] }) {
  return <span className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: DELTA_BG[tone], color: DELTA_COLOR[tone] }}>{text}</span>
}

export function BriefingView() {
  const router = useRouter()
  const reduced = useReducedMotion()
  const { user } = useAuth()
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "Anna"

  // Live manager/admin briefing (Module 1). No mock — loader until it arrives,
  // error state on failure.
  const [data, setData] = useState<BriefingData>(() => emptyBriefing(firstName))
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchManagerBriefing()
      .then((d) => { if (!cancelled) { setData(d); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("error") })
    return () => { cancelled = true }
  }, [firstName])
  const realMascot = useMemo(() => selectMascotState(data), [data])
  // Wake-up sequence: boot asleep, then stretch awake into the real mood.
  const [mascot, setMascot] = useState<typeof realMascot>(reduced ? realMascot : "sleeping")
  useEffect(() => {
    if (reduced) { setMascot(realMascot); return }
    setMascot("sleeping")
    const t = setTimeout(() => setMascot(realMascot), 1700)
    return () => clearTimeout(t)
  }, [realMascot, reduced])
  const mascotGlow = mascot === "win-big" ? "#f59e0b" : mascot === "win-small" ? "#3b82f6" : mascot === "concerned" ? "#f43f5e" : mascot === "greeting" ? "#ec4899" : mascot === "sleeping" ? "#6b7280" : "#3b82f6"
  const { headline, supporting } = useMemo(() => generateHeadline(data), [data])
  const cards = useMemo(() => buildFocusCards(data), [data])
  const insight = useMemo(() => pickInsight(data), [data])
  const insightMax = Math.max(...insight.bars.map(b => b.raw), 1)

  const [showCta, setShowCta] = useState(reduced ? true : false)
  useEffect(() => { if (reduced) return; const t = setTimeout(() => setShowCta(true), 1500); return () => clearTimeout(t) }, [reduced])

  const goDashboard = () => router.push("/dashbord")

  // staggered entrance
  const fade = (delay: number) => reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] as any } }

  if (status !== "ok") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-5 px-4 sm:px-6 text-center bg-ab-base">
        {status === "loading" ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-ab-fg-3" />
            <p className="text-sm text-ab-fg-3">Henter dagens oversikt…</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-ab-fg">God {data.timeOfDay}, {firstName}</p>
            <p className="text-sm text-ab-fg-3 max-w-sm">Kunne ikke hente dagens oversikt akkurat nå.</p>
            <button onClick={goDashboard} className="mt-1 cursor-pointer rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">Gå til dashbord</button>
          </>
        )}
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-ab-base">
      {/* Ambient playful blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div className="absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-blue-600/10 blur-3xl"
          animate={reduced ? {} : { x: [0, 30, 0], y: [0, 20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-emerald-600/8 blur-3xl"
          animate={reduced ? {} : { x: [0, -24, 0], y: [0, -16, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute top-1/3 right-1/3 h-64 w-64 rounded-full bg-purple-600/8 blur-3xl"
          animate={reduced ? {} : { scale: [1, 1.15, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-16 pb-40">
        {/* 1. Hero */}
        <section aria-labelledby="hero-h" className="flex items-center gap-6 mb-12">
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            className="relative shrink-0"
          >
            {/* soft mood-tinted glow behind */}
            <motion.div className="absolute inset-0 rounded-full blur-2xl -z-10"
              animate={{ background: `${mascotGlow}33` }} transition={{ duration: 0.6 }}
              style={{ transform: "scale(1.4)" }} />
            {/* keyed inner: replays a stretch when the mood changes (= wake-up) */}
            <motion.div
              key={mascot}
              initial={reduced ? false : { scale: 0.82 }}
              animate={{ scale: [0.82, 1.14, 1] }}
              transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.6, 1] }}
            >
              <RoyMascot state={mascot} size={100} accent={mascotGlow} />
            </motion.div>
          </motion.div>
          <div className="min-w-0">
            <motion.p {...fade(0.25)} className="text-sm text-ab-fg-3 mb-1.5 capitalize">
              {data.weekday} {data.dateStr} · god {data.timeOfDay}, {firstName}
            </motion.p>
            <motion.h1 {...fade(0.35)} id="hero-h" className="text-2xl sm:text-3xl font-bold text-ab-fg leading-snug">
              {headline}
            </motion.h1>
            {supporting && <motion.p {...fade(0.5)} className="mt-2 text-base text-ab-fg-3 leading-relaxed">{supporting}</motion.p>}
          </div>
        </section>

        {/* 2. Dine fokuspunkter */}
        <section aria-labelledby="focus-h" className="mb-12">
          <motion.h2 {...fade(0.6)} id="focus-h" className="text-xs font-bold uppercase tracking-widest text-ab-fg-4 mb-4">Dine fokuspunkter</motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map((c, i) => {
              const Icon = CARD_ICON[c.kind]
              const tint = SEV_DOT[c.severity]
              return (
                <motion.a
                  key={c.kind} href={c.href}
                  initial={reduced ? false : { opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.12, type: "spring", stiffness: 180, damping: 16 }}
                  whileHover={reduced ? {} : { y: -4 }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-5 cursor-pointer transition-all hover:border-ab-line hover:bg-ab-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  {/* top accent */}
                  <div className="absolute inset-x-0 top-0 h-[3px] opacity-70" style={{ background: `linear-gradient(90deg, ${tint}, transparent)` }} />
                  {/* header */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${tint}1f` }}><Icon className="h-3.5 w-3.5" style={{ color: tint }} /></span>
                    <span className="text-[13px] font-semibold text-ab-fg-2">{c.label}</span>
                  </div>

                  {/* kind-specific body */}
                  {c.kind === "alerts" && (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-baseline gap-1.5 mb-3">
                        <span className="font-mono text-4xl font-bold text-ab-fg leading-none">{c.value}</span>
                        {c.valueSuffix && <span className="text-sm text-ab-fg-4">{c.valueSuffix}</span>}
                      </div>
                      <DotGrid total={data.totalCount} filled={data.underThresholdNames.length} color={tint} />
                      <p className="mt-3 text-xs text-ab-fg-3 truncate">{c.context}</p>
                    </div>
                  )}

                  {c.kind === "trend" && (
                    <div className="flex-1 flex flex-col">
                      <span className="font-mono text-4xl font-bold text-ab-fg leading-none mb-2">{c.value}</span>
                      {c.sparkline && <AreaSpark data={c.sparkline} color="#10b981" />}
                      <p className="mt-2 text-xs text-ab-fg-3">{c.context}</p>
                    </div>
                  )}

                  {c.kind === "concentration" && (
                    <div className="flex-1 flex items-center gap-4">
                      <Donut pct={data.topConcentrationPct} color={tint} label={c.value} />
                      <p className="text-xs text-ab-fg-3 leading-relaxed">{c.context}</p>
                    </div>
                  )}

                  {/* delta + link */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    {c.delta ? <DeltaPill text={c.delta} tone={c.deltaTone} /> : <span />}
                    <span className="flex items-center gap-1 text-[11px] font-medium text-ab-fg-4 group-hover:text-blue-400 transition-colors shrink-0">Se mer <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
                  </div>
                </motion.a>
              )
            })}
          </div>
        </section>

        {/* 3. Mønster vi har lagt merke til */}
        <motion.section {...fade(1.0)} aria-labelledby="insight-h" className="mb-10">
          <h2 className="sr-only" id="insight-h">Mønster vi har lagt merke til</h2>
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-6 border-l-2" style={{ borderLeftColor: "#3b82f6" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-2">Mønster vi har lagt merke til</p>
            <h3 className="text-lg font-semibold text-ab-fg leading-snug">{insight.headline}</h3>
            <p className="mt-1.5 text-sm text-ab-fg-3 leading-relaxed">{insight.supporting}</p>

            <div className="mt-5 space-y-2.5">
              {insight.bars.map((b, i) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-ab-fg-3 text-right truncate">{b.label}</span>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-ab-inset">
                    <motion.div className="h-full rounded-full bg-blue-500"
                      initial={reduced ? false : { width: 0 }} animate={{ width: `${(b.raw / insightMax) * 100}%` }}
                      transition={{ delay: 1.2 + i * 0.08, duration: 0.7, ease: [0.23, 1, 0.32, 1] }} />
                  </div>
                  <span className="w-24 shrink-0 text-xs font-mono text-ab-fg-3 text-right">{b.value}</span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm italic text-ab-fg-3 leading-relaxed">Implikasjon: {insight.implikasjon}</p>
          </div>
        </motion.section>

        {/* 4. Footer line */}
        <motion.div {...fade(1.2)} className="flex items-center justify-between gap-3 pt-5 border-t border-ab-line text-sm">
          <span className="text-ab-fg-4">{data.totalDoors.toLocaleString("nb-NO")} dører · {data.contactPct}% kontakt · {data.activeCount}/{data.totalCount} aktive</span>
          <button onClick={goDashboard} className="cursor-pointer flex items-center gap-1 text-ab-fg-3 hover:text-ab-fg transition-colors">Åpne full analyse <ArrowRight className="h-3.5 w-3.5" /></button>
        </motion.div>
      </div>

      {/* Appearing CTA after 1.5s */}
      <motion.div
        initial={false}
        animate={showCta ? { opacity: 1, y: 0, pointerEvents: "auto" } : { opacity: 0, y: 24, pointerEvents: "none" }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="fixed bottom-8 left-0 right-0 flex justify-center px-4 sm:px-6 z-20"
      >
        <motion.button
          onClick={goDashboard}
          animate={reduced || !showCta ? {} : { y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="cursor-pointer flex items-center gap-2.5 rounded-2xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_8px_32px_-4px_rgba(59,130,246,0.55)] hover:bg-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ab-base"
        >
          Gå til dashbord
          <ArrowRight className="h-5 w-5" />
        </motion.button>
      </motion.div>
    </main>
  )
}

export default BriefingView
