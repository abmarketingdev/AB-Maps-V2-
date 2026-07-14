"use client"

/**
 * Salg (Sales Activity) — status-focused, time-based redesign v4.
 *
 * Tracks door-knock REGISTRERINGER and their STATUS (Ja / Nei / Ikke hjemme).
 * No money/amount anywhere — purely activity + status.
 *
 * Data strategy (Module 5, §2.6 — never make the client fetch raw rows and
 * aggregate over a whole range):
 *   - KPIs + pulse chart + swim lanes  → GET /v2/sales/summary/ (server GROUP BY,
 *     one call, full range; by_employee_lane beads are server-capped at 200/lane).
 *   - Swim-lane timeline                → rendered on <canvas> (handles thousands
 *     of beads without the DOM-node jank of one element per registration).
 *   - Liste (raw registrations)         → lazy-loaded from /v2/sales/ page-by-page,
 *     only when the user opens the tab. Never preloads all pages.
 *   - Heatmap (7 days × hour)           → a small raw slice scoped to its own
 *     7-day window (the only thing summary can't express), fetched in background.
 *
 * Date control: Dag (single day) | Periode (presets + custom from–to).
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  TrendingUp, TrendingDown, Zap, Trophy, ChevronLeft, ChevronRight, ChevronDown,
  CalendarDays, MapPin, Activity as ActivityIcon, LayoutList, GanttChartSquare, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoyMascot, MOOD_TO_ROY } from "@/components/gamification/RoyMascot"
import { computeMood } from "@/components/gamification/lib/mood"
import {
  fetchSales, fetchAllSales, fetchSalesSummary,
  type Reg as SaleReg, type SalesSummary,
} from "@/lib/api/sales"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

// ─── Status model ─────────────────────────────────────────────────────────────

type Status = "ja" | "nei" | "ikke_hjemme"

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  ja:          { label: "Ja",          color: "#10b981", bg: "bg-emerald-500/15" },
  nei:         { label: "Nei",         color: "#f43f5e", bg: "bg-rose-500/15" },
  ikke_hjemme: { label: "Ikke hjemme", color: "#f59e0b", bg: "bg-amber-500/15" },
}
const STATUS_ORDER: Status[] = ["ja", "nei", "ikke_hjemme"]

interface Reg {
  id: string
  ts: Date
  employeeId: string
  employee: string
  campaignId: string
  status: Status
  city: string
  postalCode: string
}

// A timeline bead from summary.by_employee_lane (status + timestamp only).
interface Bead { tsMs: number; status: Status }
interface Lane { id: string; name: string; beads: Bead[]; count: number; ja: number; capped: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOUR_START = 9
const HOUR_END   = 22
const LANE_BEAD_CAP = 200 // server cap on beads per lane in /summary/
const nbFmt = new Intl.NumberFormat("nb-NO")

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
function dayOffsetFromDate(d: Date) {
  return Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000)
}

// Mascot mood for an employee lane, derived from their ja-rate + volume.
function royForLane(ja: number, total: number) {
  const m = computeMood({
    jaProsent: total ? (ja / total) * 100 : 0,
    dorerPerDag: total,
    minJaProsent: 3, minDorerPerDag: 0,
    rankPercentile: 50, daysOnPlatform: 90,
  })
  return { state: MOOD_TO_ROY[m.mood] }
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const isStatus = (s: string): s is Status => s === "ja" || s === "nei" || s === "ikke_hjemme"

// ─── Date control ─────────────────────────────────────────────────────────────

type DateMode = "dag" | "periode"
interface DateState { mode: DateMode; day: Date; rangeStart: Date; rangeEnd: Date }

const RANGE_PRESETS: { key: string; label: string; resolve: () => [Date, Date] }[] = [
  { key: "7d",  label: "Siste 7 dager",  resolve: () => { const e = startOfDay(new Date()); const s = new Date(e); s.setDate(s.getDate() - 6);  return [s, e] } },
  { key: "14d", label: "Siste 14 dager", resolve: () => { const e = startOfDay(new Date()); const s = new Date(e); s.setDate(s.getDate() - 13); return [s, e] } },
  { key: "week", label: "Denne uken",    resolve: () => { const e = startOfDay(new Date()); const s = new Date(e); const dow = (s.getDay() + 6) % 7; s.setDate(s.getDate() - dow); return [s, e] } },
  { key: "month", label: "Denne måneden", resolve: () => { const e = startOfDay(new Date()); const s = new Date(e.getFullYear(), e.getMonth(), 1); return [s, e] } },
]

function DateControl({ state, setState }: { state: DateState; setState: (s: DateState) => void }) {
  const dayInputRef = useRef<HTMLInputElement>(null)
  const today = startOfDay(new Date())
  const isToday = startOfDay(state.day).getTime() === today.getTime()
  const yest = new Date(today); yest.setDate(yest.getDate() - 1)
  const isYesterday = startOfDay(state.day).getTime() === yest.getTime()

  const weekday = state.day.toLocaleDateString("nb-NO", { weekday: "long" })
  const dateStr = state.day.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })
  const shift = (n: number) => { const d = new Date(state.day); d.setDate(d.getDate() + n); setState({ ...state, day: d }) }
  const canForward = startOfDay(state.day).getTime() < today.getTime()

  const [activePreset, setActivePreset] = useState<string>("7d")

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-2xl bg-ab-elevated border border-ab-line p-1">
        {(["dag", "periode"] as DateMode[]).map(m => (
          <button
            key={m}
            onClick={() => setState({ ...state, mode: m })}
            className={cn("cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-all capitalize",
              state.mode === m ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}
          >
            {m === "dag" ? "Dag" : "Periode"}
          </button>
        ))}
      </div>

      {state.mode === "dag" ? (
        <>
          {/* Day nav */}
          <div className="flex items-center gap-1 rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-1.5">
            <button onClick={() => shift(-1)} className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-all" aria-label="Forrige dag">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => dayInputRef.current?.showPicker?.()} className="cursor-pointer relative flex flex-col items-center px-4 min-w-[180px]">
              <span className="text-base font-bold capitalize text-ab-fg leading-tight">{weekday}</span>
              <span className="text-xs text-ab-fg-3">{dateStr}</span>
              <input ref={dayInputRef} type="date" value={state.day.toISOString().slice(0, 10)} max={today.toISOString().slice(0, 10)}
                onChange={e => { if (e.target.value) setState({ ...state, day: startOfDay(new Date(e.target.value)) }) }}
                className="absolute inset-0 opacity-0 cursor-pointer" tabIndex={-1} />
            </button>
            <button onClick={() => canForward && shift(1)} disabled={!canForward} className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-all disabled:opacity-20 disabled:cursor-not-allowed" aria-label="Neste dag">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-1 rounded-2xl bg-ab-elevated border border-ab-line p-1">
            <button onClick={() => setState({ ...state, day: today })} className={cn("cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-all", isToday ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>I dag</button>
            <button onClick={() => setState({ ...state, day: yest })} className={cn("cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-all", isYesterday ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>I går</button>
          </div>
        </>
      ) : (
        <>
          {/* Predefined ranges */}
          <div className="flex flex-wrap gap-1 rounded-2xl bg-ab-elevated border border-ab-line p-1">
            {RANGE_PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => { const [s, e] = p.resolve(); setActivePreset(p.key); setState({ ...state, rangeStart: s, rangeEnd: e }) }}
                className={cn("cursor-pointer rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
                  activePreset === p.key ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}
              >{p.label}</button>
            ))}
          </div>
          {/* Custom from–to */}
          <div className="flex items-center gap-2 rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl px-3 py-2">
            <CalendarDays className="h-4 w-4 text-ab-fg-3" />
            <input type="date" value={state.rangeStart.toISOString().slice(0, 10)} max={state.rangeEnd.toISOString().slice(0, 10)}
              onChange={e => { if (e.target.value) { setActivePreset(""); setState({ ...state, rangeStart: startOfDay(new Date(e.target.value)) }) } }}
              className="bg-transparent text-sm text-ab-fg outline-none [color-scheme:dark]" />
            <span className="text-ab-fg-4 text-sm">→</span>
            <input type="date" value={state.rangeEnd.toISOString().slice(0, 10)} min={state.rangeStart.toISOString().slice(0, 10)} max={startOfDay(new Date()).toISOString().slice(0, 10)}
              onChange={e => { if (e.target.value) { setActivePreset(""); setState({ ...state, rangeEnd: startOfDay(new Date(e.target.value)) }) } }}
              className="bg-transparent text-sm text-ab-fg outline-none [color-scheme:dark]" />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Hero band (from summary.by_status) ──────────────────────────────────────

function HeroBand({ counts, prevTotal, peakLabel, peakIcon }: {
  counts: Record<Status, number>; prevTotal: number; peakLabel: string; peakIcon: string
}) {
  const reduced = useReducedMotion()
  const total = counts.ja + counts.nei + counts.ikke_hjemme
  const jaRate = total > 0 ? (counts.ja / total) * 100 : 0
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
  const up = delta >= 0

  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl px-7 py-6">
      <div className="flex flex-wrap items-center gap-x-9 gap-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ab-fg-4 mb-1">Registreringer</p>
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-5xl font-bold text-ab-fg">{nbFmt.format(total)}</span>
            {prevTotal > 0 && (
              <span className={cn("flex items-center gap-0.5 text-sm font-semibold", up ? "text-emerald-400" : "text-rose-400")}>
                {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(delta).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        <div className="h-14 w-px bg-ab-hover" />

        {STATUS_ORDER.map(s => (
          <div key={s}>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ab-fg-4 mb-1">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold" style={{ color: STATUS_META[s].color }}>{nbFmt.format(counts[s])}</span>
              <span className="font-mono text-sm text-ab-fg-3">{total ? (counts[s] / total * 100).toFixed(0) : 0}%</span>
            </div>
          </div>
        ))}

        <div className="h-14 w-px bg-ab-hover" />

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ab-fg-4 mb-1">Ja-rate</p>
          <span className="font-mono text-3xl font-bold text-emerald-400">{jaRate.toFixed(1)}%</span>
        </div>

        <div className="h-14 w-px bg-ab-hover" />

        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ab-fg-4 mb-1">
            <Zap className="h-3.5 w-3.5 text-amber-400" /> {peakIcon}
          </p>
          <span className="font-mono text-3xl font-bold text-amber-400">{peakLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-emerald-400">Direkte</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Pulse (stacked area by status, from summary.by_hour / by_day) ───────────

function ResponsePulse({ data, mode }: {
  data: { label: string; ja: number; nei: number; ikke_hjemme: number }[]; mode: DateMode
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ab-fg">Aktivitetspuls</h3>
          <p className="mt-0.5 text-sm text-ab-fg-3">{mode === "dag" ? "Registreringer per time, fordelt på status" : "Registreringer per dag, fordelt på status"}</p>
        </div>
        <div className="flex gap-4">
          {STATUS_ORDER.map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-ab-fg-3">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_META[s].color }} /> {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <defs>
            {STATUS_ORDER.map(s => (
              <linearGradient key={s} id={`grad-${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STATUS_META[s].color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={STATUS_META[s].color} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ab-border-default)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--ab-text-tertiary)", fontSize: 12 }} tickLine={false} axisLine={false} interval={mode === "dag" ? 0 : "preserveStartEnd"} minTickGap={20} />
          <YAxis tick={{ fill: "var(--ab-text-quaternary)", fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
          <Tooltip
            cursor={{ stroke: "var(--ab-border-strong)" }}
            contentStyle={{ background: "var(--ab-bg-overlay)", border: "1px solid var(--ab-border-default)", borderRadius: 12, fontSize: 13 }}
            labelFormatter={(l) => mode === "dag" ? `Kl. ${l}:00` : `${l}`}
            formatter={(v: number, name: string) => [`${v}`, STATUS_META[name as Status]?.label ?? name]}
          />
          {STATUS_ORDER.map(s => (
            <Area key={s} type="monotone" dataKey={s} stackId="1" stroke={STATUS_META[s].color} strokeWidth={2} fill={`url(#grad-${s})`} isAnimationActive={!reduced} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

// ─── Status filter chips ─────────────────────────────────────────────────────

function StatusFilter({ active, setActive }: { active: Set<Status>; setActive: (s: Set<Status>) => void }) {
  const toggle = (s: Status) => {
    const n = new Set(active)
    if (n.has(s)) n.delete(s); else n.add(s)
    setActive(n)
  }
  const allOn = active.size === 0
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setActive(new Set())}
        className={cn("cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-all", allOn ? "bg-ab-active text-ab-fg" : "bg-ab-elevated text-ab-fg-3 hover:text-ab-fg-2")}
      >Alle</button>
      {STATUS_ORDER.map(s => {
        const on = active.has(s)
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            className="cursor-pointer flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={on ? { background: `${STATUS_META[s].color}25`, color: STATUS_META[s].color } : undefined}
          >
            <span className={cn("h-2 w-2 rounded-full", !on && "opacity-40")} style={{ background: STATUS_META[s].color }} />
            <span className={cn(!on && "text-ab-fg-3")}>{STATUS_META[s].label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Canvas timeline (beads drawn on <canvas>, not DOM) ──────────────────────

interface CanvasHover { laneName: string; tsMs: number; status: Status; x: number; y: number }

function CanvasTimeline({ lanes, windowStart, windowEnd, rowH, onHover }: {
  lanes: Lane[]; windowStart: number; windowEnd: number; rowH: number
  onHover: (h: CanvasHover | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [w, setW] = useState(0)
  const height = lanes.length * rowH
  const span = Math.max(1, windowEnd - windowStart)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const update = () => setW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !w) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(height * dpr)
    const ctx = cv.getContext("2d"); if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, height)
    lanes.forEach((lane, li) => {
      const y = li * rowH + rowH / 2
      for (const b of lane.beads) {
        const x = Math.min(w - 4, Math.max(4, ((b.tsMs - windowStart) / span) * w))
        const jitter = ((Math.floor(b.tsMs / 1000) % 5) - 2) * 3
        ctx.beginPath()
        ctx.arc(x, y + jitter, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = STATUS_META[b.status].color
        ctx.globalAlpha = 0.9
        ctx.fill()
      }
    })
    ctx.globalAlpha = 1
  }, [lanes, w, height, windowStart, windowEnd, span, rowH])

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current; if (!el || !w) return
    const rect = el.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const li = Math.floor(my / rowH)
    const lane = lanes[li]
    if (!lane) { onHover(null); return }
    // nearest bead by x within ~8px
    let best: Bead | null = null; let bestDx = 9
    for (const b of lane.beads) {
      const x = Math.min(w - 4, Math.max(4, ((b.tsMs - windowStart) / span) * w))
      const dx = Math.abs(x - mx)
      if (dx < bestDx) { bestDx = dx; best = b }
    }
    if (best) onHover({ laneName: lane.name, tsMs: best.tsMs, status: best.status, x: mx, y: li * rowH })
    else onHover(null)
  }, [lanes, w, windowStart, span, rowH, onHover])

  return (
    <div ref={wrapRef} className="relative" style={{ height }} onMouseMove={handleMove} onMouseLeave={() => onHover(null)}>
      <canvas ref={canvasRef} style={{ width: "100%", height }} />
    </div>
  )
}

// ─── Activity panel: Tidslinje (canvas swim lanes) + Liste (lazy) ────────────

type PanelView = "tidslinje" | "liste"

function ActivityPanel({
  lanes, mode, windowStart, windowEnd,
  listRegs, listLoading, listTotal, listHasMore, onLoadList, onLoadMore,
}: {
  lanes: Lane[]; mode: DateMode; windowStart: Date; windowEnd: Date
  listRegs: Reg[]; listLoading: boolean; listTotal: number; listHasMore: boolean
  onLoadList: () => void; onLoadMore: () => void
}) {
  const reduced = useReducedMotion()
  const [view, setView] = useState<PanelView>("tidslinje")
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set())
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<CanvasHover | null>(null)
  const ROW_H = 44

  const toggleDay = (k: string) => setCollapsedDays(prev => {
    const n = new Set(prev)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })

  // Lanes filtered by status (filter the beads, drop empty lanes).
  const shownLanes = useMemo(() => {
    if (statusFilter.size === 0) return lanes
    return lanes
      .map(l => ({ ...l, beads: l.beads.filter(b => statusFilter.has(b.status)) }))
      .filter(l => l.beads.length > 0)
  }, [lanes, statusFilter])

  // Trigger the lazy list fetch the first time the Liste tab is opened.
  useEffect(() => { if (view === "liste") onLoadList() }, [view, onLoadList])

  const filteredList = useMemo(
    () => statusFilter.size === 0 ? listRegs : listRegs.filter(r => statusFilter.has(r.status)),
    [listRegs, statusFilter],
  )

  // Axis ticks
  const winStartMs = windowStart.getTime()
  const winSpan = Math.max(1, windowEnd.getTime() - winStartMs)
  const toPct = (ms: number) => Math.min(100, Math.max(0, ((ms - winStartMs) / winSpan) * 100))
  const ticks = useMemo(() => {
    if (mode === "dag") {
      const arr: { label: string; pct: number }[] = []
      for (let h = HOUR_START; h <= HOUR_END; h++) {
        const d = new Date(windowStart); d.setHours(h, 0, 0, 0)
        arr.push({ label: h % 2 === 0 ? String(h).padStart(2, "0") : "", pct: toPct(d.getTime()) })
      }
      return arr
    }
    const days = Math.round((startOfDay(windowEnd).getTime() - startOfDay(windowStart).getTime()) / 86400000)
    const step = days > 10 ? Math.ceil(days / 8) : 1
    const arr: { label: string; pct: number }[] = []
    for (let i = 0; i <= days; i++) {
      const d = new Date(windowStart); d.setDate(d.getDate() + i)
      arr.push({ label: i % step === 0 ? d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) : "", pct: toPct(startOfDay(d).getTime()) })
    }
    return arr
  }, [mode, windowStart, windowEnd]) // eslint-disable-line

  // Liste groups: day → exact time (HH:MM) → registrations.
  const listGroups = useMemo(() => {
    const sorted = [...filteredList].sort((a, b) => b.ts.getTime() - a.ts.getTime())
    const dayMap = new Map<string, Reg[]>()
    sorted.forEach(r => {
      const k = startOfDay(r.ts).getTime().toString()
      if (!dayMap.has(k)) dayMap.set(k, [])
      dayMap.get(k)!.push(r)
    })
    return Array.from(dayMap.entries()).map(([k, dayRegs]) => {
      const date = new Date(Number(k))
      const counts = { ja: 0, nei: 0, ikke_hjemme: 0 }
      dayRegs.forEach(r => { counts[r.status]++ })
      const timeMap = new Map<string, Reg[]>()
      dayRegs.forEach(r => {
        const t = r.ts.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
        if (!timeMap.has(t)) timeMap.set(t, [])
        timeMap.get(t)!.push(r)
      })
      const times = Array.from(timeMap.entries())
        .map(([time, rs]) => ({ time, regs: rs }))
        .sort((a, b) => b.time.localeCompare(a.time))
      return { key: k, date, total: dayRegs.length, counts, times }
    })
  }, [filteredList])

  const totalBeads = shownLanes.reduce((a, l) => a + l.beads.length, 0)

  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ab-fg">{view === "tidslinje" ? "Lagaktivitet" : "Salgsliste"}</h3>
          <p className="mt-0.5 text-sm text-ab-fg-3">
            {view === "tidslinje"
              ? "Hver registrering på sitt tidspunkt — farge = status"
              : "Alle registreringer kronologisk"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusFilter active={statusFilter} setActive={setStatusFilter} />
          <div className="flex gap-1 rounded-xl bg-ab-elevated border border-ab-line p-1">
            <button onClick={() => setView("tidslinje")} className={cn("cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all", view === "tidslinje" ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>
              <GanttChartSquare className="h-4 w-4" /> Tidslinje
            </button>
            <button onClick={() => setView("liste")} className={cn("cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all", view === "liste" ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>
              <LayoutList className="h-4 w-4" /> Liste
            </button>
          </div>
        </div>
      </div>

      {view === "tidslinje" ? (
        shownLanes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ActivityIcon className="h-8 w-8 text-ab-fg-4 mb-3" />
            <p className="text-sm text-ab-fg-4">Ingen registreringer i dette utvalget</p>
          </div>
        ) : (
          // ── Canvas swim lanes ──
          <div className="relative">
            {/* tick gridlines */}
            <div className="absolute inset-0 left-[150px] pointer-events-none">
              {ticks.map((t, i) => t.label && (
                <div key={i} className="absolute top-0 bottom-7 w-px bg-ab-elevated" style={{ left: `${t.pct}%` }} />
              ))}
            </div>

            <div className="relative max-h-[460px] overflow-y-auto pr-1">
              <div className="flex">
                {/* Employee label column (DOM) */}
                <div className="w-[150px] shrink-0">
                  {shownLanes.map(lane => {
                    const { state } = royForLane(lane.ja, lane.count)
                    return (
                      <div key={lane.id} className="flex items-center gap-2.5 pr-2" style={{ height: ROW_H }}>
                        <RoyMascot state={state} size={30} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ab-fg truncate leading-tight">{lane.name}</p>
                          <p className="text-xs text-ab-fg-3">{lane.capped ? `${lane.count}+` : lane.count} reg · {lane.ja} ja</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Beads on canvas */}
                <div className="relative flex-1">
                  <CanvasTimeline lanes={shownLanes} windowStart={winStartMs} windowEnd={windowEnd.getTime()} rowH={ROW_H} onHover={setHover} />
                </div>
              </div>
            </div>

            {/* Axis */}
            <div className="relative mt-2 ml-[150px] h-5">
              {ticks.map((t, i) => t.label && (
                <span key={i} className="absolute font-mono text-xs text-ab-fg-4 -translate-x-1/2 whitespace-nowrap" style={{ left: `${t.pct}%` }}>{t.label}</span>
              ))}
            </div>

            {/* Hover tooltip */}
            <AnimatePresence>
              {hover && (
                <motion.div initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.96 }} transition={{ duration: 0.12 }}
                  className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full" style={{ left: 150 + hover.x, top: hover.y - 8 }}>
                  <div className="rounded-xl border border-ab-line bg-ab-overlay backdrop-blur-xl px-3.5 py-2.5 shadow-2xl whitespace-nowrap">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-ab-fg">{new Date(hover.tsMs).toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-sm font-semibold text-ab-fg">{hover.laneName}</span>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${STATUS_META[hover.status].color}22`, color: STATUS_META[hover.status].color }}>{STATUS_META[hover.status].label}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Legend */}
            <div className="mt-5 flex items-center justify-between gap-5 text-xs text-ab-fg-3 border-t border-ab-line pt-4">
              <div className="flex items-center gap-5">
                {STATUS_ORDER.map(s => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: STATUS_META[s].color, boxShadow: `0 0 8px ${STATUS_META[s].color}88` }} /> {STATUS_META[s].label}
                  </span>
                ))}
              </div>
              <span className="text-ab-fg-4">{nbFmt.format(totalBeads)} beads vist{shownLanes.some(l => l.capped) ? ` · maks ${LANE_BEAD_CAP}/ansatt` : ""}</span>
            </div>
          </div>
        )
      ) : (
        // ── Liste view: lazy-loaded raw registrations ──
        <div>
          {listLoading && listRegs.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-ab-fg-3"><Loader2 className="h-4 w-4 animate-spin" /> Laster registreringer…</div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ActivityIcon className="h-8 w-8 text-ab-fg-4 mb-3" />
              <p className="text-sm text-ab-fg-4">Ingen registreringer i dette utvalget</p>
            </div>
          ) : (
            <>
              <div className="max-h-[560px] overflow-y-auto -mx-2 px-2">
                {listGroups.map((group) => {
                  const weekday = group.date.toLocaleDateString("nb-NO", { weekday: "long" })
                  const dateStr = group.date.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })
                  const collapsed = collapsedDays.has(group.key)
                  return (
                    <div key={group.key} className="mb-3">
                      <button
                        onClick={() => toggleDay(group.key)}
                        className="cursor-pointer sticky top-0 z-10 -mx-2 w-[calc(100%+1rem)] px-4 py-2.5 mb-1 flex items-center justify-between backdrop-blur-xl bg-ab-overlay border-y border-ab-line hover:bg-ab-hover transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                            <ChevronDown className="h-4 w-4 text-ab-fg-3" />
                          </motion.div>
                          <span className="text-sm font-bold capitalize text-ab-fg">{weekday}</span>
                          <span className="text-xs text-ab-fg-3">{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-ab-fg-3 font-mono">{group.total} reg</span>
                          {STATUS_ORDER.map(s => (
                            <span key={s} className="flex items-center gap-1 font-mono" style={{ color: STATUS_META[s].color }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[s].color }} />
                              {group.counts[s]}
                            </span>
                          ))}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            {group.times.map(({ time, regs }) => {
                              const multi = regs.length > 1
                              return (
                                <div key={time} className="flex gap-3 py-0.5">
                                  <div className="w-[64px] shrink-0 pt-2.5 text-right">
                                    <span className="font-mono text-sm font-semibold text-ab-fg-3">{time}</span>
                                    {multi && <span className="block text-[10px] text-ab-fg-4">{regs.length} samtidig</span>}
                                  </div>
                                  <div className={cn("flex-1 min-w-0", multi && "border-l-2 border-ab-line pl-3")}>
                                    {regs.map((reg, i) => {
                                      const state = reg.status === "ja" ? "win-small" : "ready"
                                      const m = STATUS_META[reg.status]
                                      return (
                                        <motion.div key={reg.id}
                                          initial={reduced ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.02 }}
                                          className="group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-ab-hover transition-colors">
                                          <RoyMascot state={state} size={30} />
                                          <span className="flex-1 min-w-0 text-sm font-medium text-ab-fg-2 truncate">{reg.employee}</span>
                                          <span className="hidden sm:flex items-center gap-1 text-xs text-ab-fg-3 w-[150px]">
                                            <MapPin className="h-3 w-3 shrink-0" /> {reg.city} {reg.postalCode}
                                          </span>
                                          <span className={cn("shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", m.bg)} style={{ color: m.color }}>
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
                                          </span>
                                        </motion.div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex items-center justify-center gap-3 border-t border-ab-line pt-4">
                <span className="text-xs text-ab-fg-4">Viser {nbFmt.format(listRegs.length)} av {nbFmt.format(listTotal)}</span>
                {listHasMore && (
                  <button onClick={onLoadMore} disabled={listLoading} className="cursor-pointer flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-4 py-2 text-sm font-semibold text-ab-fg-2 hover:bg-ab-hover transition-all disabled:opacity-50">
                    {listLoading && <Loader2 className="h-4 w-4 animate-spin" />} Last inn flere
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Top sellers (rank by Ja, from summary lanes — see note) ─────────────────

function TopSellers({ lanes }: { lanes: Lane[] }) {
  const reduced = useReducedMotion()
  const ranked = useMemo(
    () => [...lanes].sort((a, b) => b.ja - a.ja).slice(0, 5),
    [lanes],
  )
  const max = Math.max(...ranked.map(r => r.ja), 1)
  const anyCapped = ranked.some(r => r.capped)
  const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"]

  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ab-fg">Topp selgere</h3>
          <p className="mt-0.5 text-sm text-ab-fg-3">{anyCapped ? "Etter Ja (siste registreringer)" : "Etter antall Ja"}</p>
        </div>
        <Trophy className="h-5 w-5 text-amber-400" />
      </div>
      <div className="space-y-3.5">
        {ranked.map((r, i) => {
          const { state } = royForLane(r.ja, r.count)
          const rate = r.count ? (r.ja / r.count * 100).toFixed(1) : "0"
          return (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-5 text-center font-mono text-sm font-bold" style={{ color: RANK_COLORS[i] ?? "rgba(255,255,255,0.3)" }}>{i + 1}</span>
              <RoyMascot state={state} size={38} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ab-fg truncate">{r.name}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ab-hover">
                  <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${(r.ja / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-lg font-bold text-emerald-400">{r.ja}</p>
                <p className="font-mono text-xs text-ab-fg-3">{rate}% av {r.capped ? `${r.count}+` : r.count}</p>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Heatmap (7 days × hour, from a scoped raw slice) ────────────────────────

function Heatmap({ regs, anchorDate, loading }: { regs: Reg[]; anchorDate: Date; loading: boolean }) {
  const reduced = useReducedMotion()
  const HOURS = Array.from({ length: 13 }, (_, i) => i + 9)
  const DAYS = 7
  const { grid, globalMax, labels } = useMemo(() => {
    const out: number[][] = []; const lbls: string[] = []; let gMax = 1
    const anchorOffset = dayOffsetFromDate(anchorDate)
    for (let d = 0; d < DAYS; d++) {
      const offset = anchorOffset + (DAYS - 1 - d)
      const dt = new Date(); dt.setDate(dt.getDate() - offset)
      const dayKey = ymd(startOfDay(dt))
      const dayRegs = regs.filter(r => ymd(startOfDay(r.ts)) === dayKey)
      const row = HOURS.map(h => { const c = dayRegs.filter(s => s.ts.getHours() === h).length; if (c > gMax) gMax = c; return c })
      out.push(row)
      lbls.push(dt.toLocaleDateString("nb-NO", { weekday: "short" }))
    }
    return { grid: out, globalMax: gMax, labels: lbls }
  }, [regs, anchorDate]) // eslint-disable-line

  const cellColor = (v: number) => {
    if (v === 0) return "rgba(255,255,255,0.04)"
    const t = v / globalMax
    const r = Math.round(59 + t * (245 - 59)), g = Math.round(130 + t * (158 - 130)), b = Math.round(246 + t * (11 - 246))
    return `rgba(${r}, ${g}, ${b}, ${0.3 + t * 0.7})`
  }

  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ab-fg">Aktivitetsmønster</h3>
          <p className="mt-0.5 text-sm text-ab-fg-3">Registreringer per time, 7 dager opp til valgt dag</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-ab-fg-3" />}
      </div>
      <div className="space-y-1">
        <div className="flex gap-1 mb-1.5 ml-12">
          {HOURS.map(h => <div key={h} className="flex-1 text-center font-mono text-[10px] text-ab-fg-4">{h % 3 === 0 ? h : ""}</div>)}
        </div>
        {grid.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <span className="w-11 shrink-0 text-right pr-1.5 font-mono text-xs text-ab-fg-3 capitalize">{labels[d]}</span>
            {row.map((v, h) => (
              <div key={h} className="group relative flex-1 aspect-square rounded-md transition-transform hover:scale-110 cursor-default min-w-[14px]"
                style={{ background: cellColor(v) }} title={`${labels[d]} kl. ${HOURS[h]}:00 — ${v} registreringer`} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="text-xs text-ab-fg-4">Mindre</span>
        {[0.1, 0.35, 0.6, 0.85, 1].map((t, i) => <div key={i} className="h-3 w-3 rounded-[3px]" style={{ background: cellColor(Math.round(t * globalMax)) }} />)}
        <span className="text-xs text-ab-fg-4">Mer</span>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SalesActivityView() {
  const reduced = useReducedMotion()
  const { campaignId: globalCampaignId } = useSelectedCampaign()
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; color: string }[]>([])
  const [campaignId, setCampaignId] = useState<string>("")
  const [ds, setDs] = useState<DateState>(() => {
    const today = startOfDay(new Date())
    const s = new Date(today); s.setDate(s.getDate() - 6)
    return { mode: "dag", day: today, rangeStart: s, rangeEnd: today }
  })

  useEffect(() => {
    let cancelled = false
    fetchCampaignsWithStats()
      .then(list => { if (!cancelled) setCampaigns(list.map(c => ({ id: c.id, name: c.name, color: c.color }))) })
      .catch(() => { /* empty */ })
    return () => { cancelled = true }
  }, [])
  useEffect(() => { if (globalCampaignId) setCampaignId(globalCampaignId) }, [globalCampaignId])

  const campaign = campaigns.find(c => c.id === campaignId) ?? { id: "", name: "", color: "#8b5cf6" }

  const { windowStart, windowEnd } = useMemo(() => {
    if (ds.mode === "dag") {
      const ws = new Date(ds.day); ws.setHours(HOUR_START, 0, 0, 0)
      const we = new Date(ds.day); we.setHours(HOUR_END, 0, 0, 0)
      return { windowStart: ws, windowEnd: we }
    }
    return { windowStart: startOfDay(ds.rangeStart), windowEnd: endOfDay(ds.rangeEnd) }
  }, [ds])
  const anchorDate = ds.mode === "dag" ? ds.day : ds.rangeEnd

  // ── Server-aggregated summary (KPIs, pulse, lanes) ──
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [prevTotal, setPrevTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  // ── Heatmap raw slice (7 days), background ──
  const [heatRegs, setHeatRegs] = useState<Reg[]>([])
  const [heatLoading, setHeatLoading] = useState(false)

  // ── Lazy raw list ──
  const [listRegs, setListRegs] = useState<Reg[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listTotal, setListTotal] = useState(0)
  const [listPage, setListPage] = useState(0)
  const [listPages, setListPages] = useState(1)
  const listLoadedKeyRef = useRef<string>("")

  const startDate = ymd(ds.mode === "dag" ? ds.day : ds.rangeStart)
  const endDate = ymd(ds.mode === "dag" ? ds.day : ds.rangeEnd)
  const loadKey = `${campaignId}|${startDate}|${endDate}`

  const mapReg = useCallback((r: SaleReg): Reg => ({
    id: r.id, ts: new Date(r.ts), employeeId: r.employee_id, employee: r.employee,
    campaignId: r.campaign_id ?? campaignId, status: (isStatus(r.status) ? r.status : "nei"),
    city: r.city ?? "Ukjent", postalCode: r.postal_code ?? "",
  }), [campaignId])

  // Main load: summary (range) + prev-window summary + 7-day heatmap slice.
  const load = useCallback(() => {
    if (!campaignId) return
    // previous comparison window (same length, immediately before)
    const spanDays = ds.mode === "dag" ? 1
      : Math.round((startOfDay(ds.rangeEnd).getTime() - startOfDay(ds.rangeStart).getTime()) / 86400000) + 1
    const prevEnd = new Date(ds.mode === "dag" ? ds.day : ds.rangeStart); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (spanDays - 1))

    // heatmap window: 7 days up to the anchor (selected day / range end)
    const heatEnd = ds.mode === "dag" ? ds.day : ds.rangeEnd
    const heatStart = new Date(heatEnd); heatStart.setDate(heatStart.getDate() - 6)

    setLoading(true); setErrored(false)
    // reset lazy list for the new selection
    setListRegs([]); setListPage(0); setListPages(1); setListTotal(0); listLoadedKeyRef.current = ""

    fetchSalesSummary({ campaignId, startDate, endDate })
      .then(s => setSummary(s))
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))

    fetchSalesSummary({ campaignId, startDate: ymd(prevStart), endDate: ymd(prevEnd) })
      .then(s => setPrevTotal((s.by_status?.ja ?? 0) + (s.by_status?.nei ?? 0) + (s.by_status?.ikke_hjemme ?? 0)))
      .catch(() => setPrevTotal(0))

    setHeatLoading(true)
    fetchAllSales({ campaignId, startDate: ymd(heatStart), endDate: ymd(heatEnd) }, { maxPages: 200 })
      .then(p => setHeatRegs(p.results.map(mapReg)))
      .catch(() => setHeatRegs([]))
      .finally(() => setHeatLoading(false))
  }, [campaignId, ds, startDate, endDate, mapReg])

  // Debounced (date range touches two inputs in quick succession).
  useEffect(() => {
    const t = setTimeout(() => { void load() }, 350)
    return () => clearTimeout(t)
  }, [load])

  // Lazy list: fetch first page on demand, then paginate.
  const loadListPage = useCallback((page: number) => {
    if (!campaignId) return
    setListLoading(true)
    fetchSales({ campaignId, startDate, endDate, page, pageSize: 100 })
      .then(res => {
        const mapped = res.results.map(mapReg)
        setListRegs(prev => page === 1 ? mapped : [...prev, ...mapped])
        setListTotal(res.total_count)
        setListPages(res.total_pages || 1)
        setListPage(page)
      })
      .catch(() => { /* keep what we have */ })
      .finally(() => setListLoading(false))
  }, [campaignId, startDate, endDate, mapReg])

  const onLoadList = useCallback(() => {
    if (listLoadedKeyRef.current === loadKey) return
    listLoadedKeyRef.current = loadKey
    loadListPage(1)
  }, [loadKey, loadListPage])
  const onLoadMore = useCallback(() => { if (!listLoading && listPage < listPages) loadListPage(listPage + 1) }, [listLoading, listPage, listPages, loadListPage])

  // ── Derive panel data from summary ──
  const counts: Record<Status, number> = summary?.by_status ?? { ja: 0, nei: 0, ikke_hjemme: 0 }
  const total = counts.ja + counts.nei + counts.ikke_hjemme

  const chartData = useMemo(() => {
    if (!summary) return []
    if (ds.mode === "dag") {
      const byHour = new Map(summary.by_hour.map(h => [h.hour, h]))
      const arr: { label: string; ja: number; nei: number; ikke_hjemme: number }[] = []
      for (let h = HOUR_START; h <= 21; h++) {
        const v = byHour.get(h)
        arr.push({ label: String(h).padStart(2, "0"), ja: v?.ja ?? 0, nei: v?.nei ?? 0, ikke_hjemme: v?.ikke_hjemme ?? 0 })
      }
      return arr
    }
    return [...summary.by_day]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ label: new Date(d.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }), ja: d.ja, nei: d.nei, ikke_hjemme: d.ikke_hjemme }))
  }, [summary, ds.mode])

  const { peakLabel, peakIcon } = useMemo(() => {
    if (!summary) return { peakLabel: "—", peakIcon: ds.mode === "dag" ? "Topptime" : "Travleste dag" }
    if (ds.mode === "dag") {
      let max = -1, hour = HOUR_START
      summary.by_hour.forEach(h => { const t = h.ja + h.nei + h.ikke_hjemme; if (t > max) { max = t; hour = h.hour } })
      return { peakLabel: max <= 0 ? "—" : `${String(hour).padStart(2, "0")}:00`, peakIcon: "Topptime" }
    }
    let max = -1, best: string | null = null
    summary.by_day.forEach(d => { const t = d.ja + d.nei + d.ikke_hjemme; if (t > max) { max = t; best = d.date } })
    return { peakLabel: best ? new Date(best).toLocaleDateString("nb-NO", { weekday: "short", day: "numeric" }) : "—", peakIcon: "Travleste dag" }
  }, [summary, ds.mode])

  const lanes: Lane[] = useMemo(() => {
    if (!summary) return []
    return summary.by_employee_lane.map(l => {
      const beads: Bead[] = l.beads.map(b => ({ tsMs: new Date(b.ts).getTime(), status: (isStatus(b.status) ? b.status : "nei") }))
      const ja = beads.filter(b => b.status === "ja").length
      return { id: l.employee_id, name: l.employee || "Ukjent", beads, count: beads.length, ja, capped: beads.length >= LANE_BEAD_CAP }
    }).sort((a, b) => b.count - a.count)
  }, [summary])

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full blur-3xl" style={{ background: `${campaign.color}14` }} />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-emerald-600/8 blur-3xl" />
      </div>

      <div className="relative px-4 sm:px-6 py-5 sm:py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-ab-fg-4 mb-1">Salgsaktivitet · Direkte</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-ab-fg">Salg</h1>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-ab-fg-4 font-medium mr-1">Kampanje:</span>
            {campaigns.map(c => (
              <button key={c.id} onClick={() => setCampaignId(c.id)}
                className={cn("cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150", campaignId === c.id ? "text-white shadow-sm" : "bg-ab-elevated text-ab-fg-3 hover:text-ab-fg-2")}
                style={campaignId === c.id ? { background: c.color, boxShadow: `0 0 14px ${c.color}60` } : {}}>
                {c.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Date control */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <DateControl state={ds} setState={setDs} />
        </motion.div>

        {loading ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelLoading label="Laster salgssammendrag…" /></div>
        ) : errored ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelError onRetry={() => void load()} /></div>
        ) : total === 0 ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelEmpty msg="Ingen registreringer i dette utvalget" sub="Prøv en annen kampanje eller dato." /></div>
        ) : (
          <>
            <HeroBand counts={counts} prevTotal={prevTotal} peakLabel={peakLabel} peakIcon={peakIcon} />

            <ResponsePulse data={chartData} mode={ds.mode} />

            <ActivityPanel
              lanes={lanes} mode={ds.mode} windowStart={windowStart} windowEnd={windowEnd}
              listRegs={listRegs} listLoading={listLoading} listTotal={listTotal}
              listHasMore={listPage > 0 && listPage < listPages}
              onLoadList={onLoadList} onLoadMore={onLoadMore}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <TopSellers lanes={lanes} />
              <Heatmap regs={heatRegs} anchorDate={anchorDate} loading={heatLoading} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SalesActivityView
