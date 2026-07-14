"use client"

/**
 * EmployeeStatsView — "Min statistikk" (`/employee/stats`).
 * A per-employee mirror of the admin Analytics: the SAME metric families
 * (statuses, timing, above/below admin thresholds) but scoped to one rep and
 * broken down per campaign, so the salesperson can evaluate themselves.
 * Tabs: Oversikt · Per kampanje · Arbeidstid · Terskler. MOCK DATA.
 */

import React, { useMemo, useState, useEffect } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts"
import { LayoutGrid, Flame, Clock, SlidersHorizontal, Check, X, DoorOpen, TrendingUp, Percent, Timer, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { CountUp } from "./CountUp"
import { ResponseDonut } from "./ResponseDonut"
import {
  emptyEmployeeStats, evalThreshold, fmtMins, THRESHOLD_FIELDS, OUTCOME_META,
  type EmployeeStats, type CampaignPerf,
} from "./employeeLogic"
import { fetchEmployeeStats } from "@/lib/api/employeeDashboard"

type Tab = "oversikt" | "kampanje" | "arbeidstid" | "terskler"
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "oversikt", label: "Oversikt", icon: LayoutGrid },
  { id: "kampanje", label: "Per kampanje", icon: Flame },
  { id: "arbeidstid", label: "Arbeidstid", icon: Clock },
  { id: "terskler", label: "Terskler", icon: SlidersHorizontal },
]

function ChartTooltip({ active, payload, label, unit = "dører" }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-ab-line bg-ab-overlay px-3 py-2 shadow-xl">
      <p className="text-[11px] text-ab-fg-3">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-mono text-sm font-semibold" style={{ color: p.color || p.fill || "#fff" }}>{p.value} {unit}</p>
      ))}
    </div>
  )
}

const card = "rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"

// ─── Tabs: Oversikt ─────────────────────────────────────────────────────────

function Oversikt({ s }: { s: EmployeeStats }) {
  const reduced = useReducedMotion()
  const t = s.appliedThreshold
  const kpis = [
    { icon: DoorOpen, color: "#3b82f6", value: s.totalDoors, label: "totale dører", decimals: 0, suffix: "" },
    { icon: TrendingUp, color: "#8b5cf6", value: s.dorerPerDag, label: "dører / dag", decimals: 0, suffix: "" },
    { icon: TrendingUp, color: "#10b981", value: s.jaProsent, label: "ja-rate", decimals: 1, suffix: "%" },
    { icon: Percent, color: "#f59e0b", value: s.contactPct, label: "kontaktrate", decimals: 0, suffix: "%" },
    { icon: TrendingUp, color: "#06b6d4", value: s.consistency, label: "konsistens", decimals: 0, suffix: "%" },
  ]
  const checks = [
    { label: "Dører / dag", value: s.dorerPerDag, target: t.doorsDay, suffix: "" },
    { label: "Ja-prosent", value: s.jaProsent, target: t.minJa, suffix: "%" },
    { label: "Kontaktrate", value: s.contactPct, target: t.minContact, suffix: "%" },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className={`${card} p-4`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl mb-3" style={{ background: `${k.color}1f` }}>
              <k.icon className="h-4 w-4" style={{ color: k.color }} />
            </span>
            <CountUp value={k.value} decimals={k.decimals} suffix={k.suffix} className="font-mono text-2xl font-bold text-ab-fg" />
            <p className="text-[12px] text-ab-fg-3 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResponseDonut ja={s.ja} nei={s.nei} ikkeHjemme={s.ikkeHjemme} folgOpp={s.folgOpp} jaProsent={s.jaProsent} />

        {/* threshold summary vs admin's global threshold */}
        <div className={`${card} p-5`}>
          <h3 className="text-[13px] font-semibold text-ab-fg-2 mb-1">Mot leders terskler</h3>
          <p className="text-xs text-ab-fg-3 mb-4">Standardterskler satt av admin.</p>
          <div className="space-y-3.5">
            {checks.map((c) => {
              const r = evalThreshold(c.value, c.target, true)
              const color = r.ok ? "#10b981" : "#f43f5e"
              return (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <span className="text-ab-fg-2">{c.label}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-ab-fg">{c.value}{c.suffix}</span>
                      <span className="text-ab-fg-4">/ {c.target}{c.suffix}</span>
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full" style={{ background: `${color}22` }}>
                        {r.ok ? <Check className="h-2.5 w-2.5" style={{ color }} /> : <X className="h-2.5 w-2.5" style={{ color }} />}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ab-hover">
                    <motion.div className="h-full rounded-full" style={{ background: color }}
                      initial={reduced ? false : { width: 0 }} animate={{ width: `${Math.min(100, r.pct)}%` }} transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* week activity */}
      <div className={`${card} p-6`}>
        <h3 className="text-[13px] font-semibold text-ab-fg-2 mb-4">Uken på et blikk</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.weekActivity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="wkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
              <Area type="monotone" dataKey="doors" stroke="#3b82f6" strokeWidth={2.5} fill="url(#wkFill)" isAnimationActive={!reduced} animationDuration={1000} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Tabs: Per kampanje ──────────────────────────────────────────────────────

function CampaignCard({ c }: { c: CampaignPerf }) {
  const reduced = useReducedMotion()
  const checks = [
    { label: "Dører/dag", value: c.dorerPerDag, target: c.threshold.doorsDay, suffix: "" },
    { label: "Ja %", value: c.jaProsent, target: c.threshold.minJa, suffix: "%" },
    { label: "Kontakt %", value: c.contactPct, target: c.threshold.minContact, suffix: "%" },
  ]
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="relative p-5">
        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: c.color }} />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            <span className="text-[15px] font-semibold text-ab-fg">{c.name}</span>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: c.thresholdScope === "kampanje" ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)", color: c.thresholdScope === "kampanje" ? "#10b981" : "#a78bfa" }}>
            {c.thresholdScope === "kampanje" ? "Kampanjeterskel" : "Global terskel"}
          </span>
        </div>

        {/* numbers */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { v: c.doors, l: "dører" },
            { v: c.dorerPerDag, l: "/ dag" },
            { v: `${c.jaProsent}%`, l: "ja" },
            { v: `${c.consistency}%`, l: "konsistens" },
          ].map((x, i) => (
            <div key={i}>
              <div className="font-mono text-lg font-bold text-ab-fg">{x.v}</div>
              <div className="text-[11px] text-ab-fg-3">{x.l}</div>
            </div>
          ))}
        </div>

        {/* status mini-bars */}
        <div className="flex h-2 w-full overflow-hidden rounded-full mb-1.5">
          {([["ja", c.ja], ["nei", c.nei], ["folg-opp", c.folgOpp], ["ikke-hjemme", c.ikkeHjemme]] as const).map(([k, v]) => (
            <motion.div key={k} style={{ background: OUTCOME_META[k].color }}
              initial={reduced ? false : { width: 0 }} animate={{ width: `${(v / c.doors) * 100}%` }} transition={{ duration: 0.7 }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ab-fg-3 mb-4">
          {(["ja", "nei", "folg-opp", "ikke-hjemme"] as const).map(k => (
            <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: OUTCOME_META[k].color }} />{OUTCOME_META[k].label}</span>
          ))}
        </div>

        {/* threshold checks */}
        <div className="grid grid-cols-3 gap-2 border-t border-ab-line pt-3">
          {checks.map((ch) => {
            const r = evalThreshold(ch.value, ch.target, true)
            const color = r.ok ? "#10b981" : "#f43f5e"
            return (
              <div key={ch.label} className="rounded-xl bg-ab-elevated p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ab-fg-3">{ch.label}</span>
                  {r.ok ? <ArrowUpRight className="h-3.5 w-3.5" style={{ color }} /> : <ArrowDownRight className="h-3.5 w-3.5" style={{ color }} />}
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold" style={{ color }}>{ch.value}{ch.suffix}</div>
                <div className="text-[10px] text-ab-fg-4">mål {ch.target}{ch.suffix}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PerKampanje({ s }: { s: EmployeeStats }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {s.campaigns.map(c => <CampaignCard key={c.id} c={c} />)}
    </div>
  )
}

// ─── Tabs: Arbeidstid ────────────────────────────────────────────────────────

function Arbeidstid({ s }: { s: EmployeeStats }) {
  const reduced = useReducedMotion()
  const data = s.campaigns.map(c => ({ name: c.name.split(" ")[0], min: c.avgDailyMin, color: c.color }))
  const tiles = [
    { icon: Clock, color: "#3b82f6", value: fmtMins(s.totalMin), label: "total arbeidstid" },
    { icon: Timer, color: "#10b981", value: fmtMins(s.avgDailyMin), label: "snitt per dag" },
    { icon: LayoutGrid, color: "#f59e0b", value: `${s.activeDays}`, label: "aktive dager" },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiles.map((t, i) => (
          <div key={i} className={`${card} p-5 flex items-center gap-3`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${t.color}1f` }}>
              <t.icon className="h-5 w-5" style={{ color: t.color }} />
            </span>
            <div>
              <div className="font-mono text-2xl font-bold text-ab-fg">{t.value}</div>
              <p className="text-[12px] text-ab-fg-3">{t.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={`${card} p-6`}>
        <h3 className="text-[13px] font-semibold text-ab-fg-2 mb-1">Snitt arbeidstid per kampanje</h3>
        <p className="text-xs text-ab-fg-3 mb-4">Minutter per aktiv dag.</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip unit="min" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="min" radius={[6, 6, 0, 0]} isAnimationActive={!reduced} animationDuration={900}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Tabs: Terskler ──────────────────────────────────────────────────────────

function Terskler({ s }: { s: EmployeeStats }) {
  const t = s.appliedThreshold
  // measured aggregate value for each threshold field we can evaluate
  const measured: Partial<Record<string, number>> = {
    doorsDay: s.dorerPerDag,
    doorsWeek: s.dorerPerDag * 5,
    minJa: s.jaProsent,
    minContact: s.contactPct,
  }
  return (
    <div className="space-y-6">
      <div className={`${card} p-5`}>
        <h3 className="text-[13px] font-semibold text-ab-fg-2 mb-1">Dine terskler (global standard)</h3>
        <p className="text-xs text-ab-fg-3 mb-4">Disse er satt av admin. Grønt = du ligger over målet.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THRESHOLD_FIELDS.map((f) => {
            const target = t[f.key]
            const value = measured[f.key]
            const has = value != null
            const r = has ? evalThreshold(value!, target, f.higherIsBetter) : { ok: true, pct: 100 }
            const color = !has ? "#64748b" : r.ok ? "#10b981" : "#f43f5e"
            return (
              <div key={f.key} className="rounded-xl border border-ab-line bg-ab-elevated p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ab-fg-2">{f.label}</span>
                  <span className="font-mono text-sm font-semibold text-ab-fg">{target}{f.suffix || ""}</span>
                </div>
                {has ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-ab-hover">
                      <div className="h-full rounded-full" style={{ background: color, width: `${Math.min(100, r.pct)}%` }} />
                    </div>
                    <span className="font-mono text-[12px] font-semibold" style={{ color }}>{value}{f.suffix || ""}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-ab-fg-4">Ingen direkte måling tilgjengelig</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* campaign overrides */}
      <div className={`${card} p-5`}>
        <h3 className="text-[13px] font-semibold text-ab-fg-2 mb-3">Kampanjespesifikke terskler</h3>
        <div className="space-y-2.5">
          {s.campaigns.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-ab-elevated px-4 py-3">
              <span className="flex items-center gap-2.5 text-[13px] text-ab-fg-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}
              </span>
              <div className="flex items-center gap-4 text-[12px]">
                <span className="text-ab-fg-3">Dører/dag <span className="font-mono font-semibold text-ab-fg">{c.threshold.doorsDay}</span></span>
                <span className="text-ab-fg-3">Ja% <span className="font-mono font-semibold text-ab-fg">{c.threshold.minJa}</span></span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: c.thresholdScope === "kampanje" ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)", color: c.thresholdScope === "kampanje" ? "#10b981" : "#a78bfa" }}>
                  {c.thresholdScope === "kampanje" ? "Egen" : "Global"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export function EmployeeStatsView() {
  const reduced = useReducedMotion()
  const { user } = useAuth()
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "Jonas"
  const [tab, setTab] = useState<Tab>("oversikt")

  // Live employee stats (Module 2, guide §7.3). No mock — empty seed while
  // loading; error state on failure. Per-campaign work-time is always 0.
  const [s, setS] = useState<EmployeeStats>(() => emptyEmployeeStats(firstName))
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchEmployeeStats()
      .then((live) => { if (!cancelled) { setS(live); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("error") })
    return () => { cancelled = true }
  }, [firstName])

  if (status !== "ok") {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 text-center bg-ab-base">
        {status === "loading"
          ? <><Loader2 className="h-7 w-7 animate-spin text-ab-fg-3" /><p className="text-sm text-ab-fg-3">Laster statistikk…</p></>
          : <><p className="text-sm text-ab-fg-3">Kunne ikke laste statistikken din.</p><button onClick={() => window.location.reload()} className="cursor-pointer rounded-lg border border-ab-line bg-ab-elevated px-3 py-1.5 text-xs font-medium text-ab-fg-2 hover:text-ab-fg">Prøv igjen</button></>}
      </div>
    )
  }

  return (
    <div className="min-h-full bg-ab-base">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ab-fg">Min statistikk</h1>
            <p className="text-sm text-ab-fg-3 mt-0.5">Din egen ytelse, målt mot leders terskler · {s.periodLabel}</p>
          </div>
        </div>

        {/* tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-ab-line bg-ab-elevated p-1.5 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => setTab(id)}
                className="relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>
                {active && <motion.span layoutId="emp-stats-tab" className="absolute inset-0 rounded-xl bg-blue-500/15 border border-blue-400/25" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{label}</span>
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
            {tab === "oversikt" && <Oversikt s={s} />}
            {tab === "kampanje" && <PerKampanje s={s} />}
            {tab === "arbeidstid" && <Arbeidstid s={s} />}
            {tab === "terskler" && <Terskler s={s} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default EmployeeStatsView
