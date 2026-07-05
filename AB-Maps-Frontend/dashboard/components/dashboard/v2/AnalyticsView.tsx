"use client"

/**
 * Analytics — LIVE (/api/dashboard/analytics/). Tabs: Oversikt · Ansatte ·
 * Kampanjer · Varsler · Tid & tempo · Terskler. Driven by the analytics `preview`
 * + `work-time-stats` endpoints, the pace/deviations/proximity endpoints, and the
 * thresholds CRUD. No mock data. The preview endpoint caps the range at 90 days.
 *
 * Access: admins/superusers + sales-chiefs only (route-gated in app/analytics/page.tsx).
 *
 * Two DISTINCT time signals are shown, never conflated:
 *   • Arbeidstid = tracked work-session hours (work_time_rollup) — GPS-økter, less precise.
 *   • Tempo      = dører per aktiv time from the first→last knock window (seller_day_metric).
 */

import { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  BarChart, Bar, ComposedChart, Line,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts"
import {
  TrendingUp, TrendingDown, DoorOpen, Users, Percent, Clock, AlertCircle,
  ChevronDown, ChevronRight, Trophy, Target, Activity, Trash2, X, Check, Loader2,
  Download, Send, Pencil, CalendarDays, MapPin, ShieldAlert, Info, Zap,
  ArrowDownRight, SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoyMascot, MOOD_TO_ROY, type RoyState } from "@/components/gamification/RoyMascot"
import { computeMood } from "@/components/gamification/lib/mood"
import {
  fetchAnalyticsPreview, fetchWorkTimeStats, fmtMin, downloadAnalyticsPdf, triggerAnalyticsEmail,
  type AnalyticsPreview, type WorkTimeStats, type AnEmployee, type AnCampaign, type AnAlert,
  type NeiBreakdown,
} from "@/lib/api/analytics"
import { fetchTeamPace, fetchEmployeePaceSeries, type PaceRow, type PaceDay } from "@/lib/api/pace"
import { fetchDeviations, type DeviationTeam } from "@/lib/api/deviations"
import { fetchProximityViolations, type ProximityViolationsResponse } from "@/lib/api/proximity"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"
import { useAuth } from "@/lib/auth/AuthContext"
import { useToast } from "@/hooks/use-toast"
import {
  analyticsService, type Threshold, type ThresholdScope, type CreateThresholdData,
} from "@/services/analyticsService"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

const nbFmt = new Intl.NumberFormat("nb-NO")
const nf1 = (n: number) => n.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const STATUS = [
  { key: "ja" as const, label: "Ja", color: "#10b981" },
  { key: "nei" as const, label: "Nei", color: "#f43f5e" },
  { key: "ikke_hjemme" as const, label: "Ikke hjemme", color: "#f59e0b" },
  { key: "folg_opp" as const, label: "Følg opp", color: "#8b5cf6" },
]
const ymd = (d: Date) => d.toISOString().slice(0, 10)
// Anchor the analytics window. On production this is today (live data). On dev,
// NEXT_PUBLIC_ANALYTICS_ANCHOR_DATE anchors to a date overlapping the seed data.
const anchorEnv = process.env.NEXT_PUBLIC_ANALYTICS_ANCHOR_DATE
const anchorDate = () => (anchorEnv && /^\d{4}-\d{2}-\d{2}$/.test(anchorEnv) ? new Date(`${anchorEnv}T00:00:00Z`) : new Date())
const daysAgo = (n: number) => { const d = anchorDate(); d.setDate(d.getDate() - n); return ymd(d) }

const RANGES = [
  { d: 7, label: "7 dager" }, { d: 14, label: "14 dager" },
  { d: 30, label: "30 dager" }, { d: 90, label: "90 dager" },
]
const WEEKDAY_LABELS = ["man", "tir", "ons", "tor", "fre", "lør", "søn"]

// ISO week key/label for a date (Mon-based).
function isoWeek(d: Date): { key: string; label: string } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return { key: `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`, label: `Uke ${week}` }
}

const fmtClock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }) : "—"

// Mascot mood for an employee from their live ja-rate + volume (approximation).
function empRoy(e: AnEmployee): RoyState {
  const m = computeMood({ jaProsent: e.yes_rate, dorerPerDag: e.doors_per_day, minJaProsent: 3, minDorerPerDag: 70, rankPercentile: 50, daysOnPlatform: 90 })
  return MOOD_TO_ROY[m.mood]
}

function Glass({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  return <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={cn("rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl", className)}>{children}</motion.div>
}

function LineSpark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 26 - 1}`).join(" ")
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-2 w-full h-7">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiTile({ label, value, deltaPct, color, Icon, spark }: { label: string; value: string; deltaPct?: number; color: string; Icon: React.ElementType; spark?: number[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 font-medium">{label}</span>
        <div className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ background: `${color}22` }}><Icon className="h-3.5 w-3.5" style={{ color }} /></div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-mono text-2xl font-bold text-white">{value}</p>
        {deltaPct !== undefined && Number.isFinite(deltaPct) && (
          <span className="flex items-baseline gap-1">
            <span className={cn("flex items-center gap-0.5 text-xs font-semibold", deltaPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(Math.round(deltaPct))}%
            </span>
            <span className="text-[10px] text-white/30">vs forrige</span>
          </span>
        )}
      </div>
      {spark && <LineSpark data={spark} color={color} />}
    </div>
  )
}

// Small labelled bar row list (7-day details, streaks) with optional below-threshold coloring.
function MiniBars({ values, below, threshold, color = "#3b82f6", belowColor = "#f43f5e" }: {
  values: number[]; below?: boolean[]; threshold?: number; color?: string; belowColor?: string
}) {
  const max = Math.max(...values, threshold ?? 0, 1)
  return (
    <div className="relative flex items-end gap-1 h-14">
      {threshold !== undefined && threshold > 0 && (
        <div className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-amber-400/50" style={{ bottom: `${(threshold / max) * 100}%` }} />
      )}
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm min-w-[6px]" title={String(v)}
          style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: below?.[i] ? belowColor : color, opacity: 0.85 }} />
      ))}
    </div>
  )
}

// SVG ring gauge showing active_pct in the centre.
function RingGauge({ pct, color, center, sub }: { pct: number; color: string; center: string; sub: string }) {
  const r = 34, c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold text-white">{center}</span>
        <span className="text-[9px] text-white/40">{sub}</span>
      </div>
    </div>
  )
}

const chartTooltip = { background: "#0d1528", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 } as const

type Tab = "oversikt" | "ansatte" | "kampanjer" | "varsler" | "arbeidstid" | "terskler"

export function AnalyticsView() {
  const reduced = useReducedMotion()
  const { campaignId: globalCampaignId } = useSelectedCampaign()
  const { isAdmin, isSalesChief } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>("oversikt")
  const [startStr, setStartStr] = useState<string>(() => daysAgo(89))
  const [endStr, setEndStr] = useState<string>(() => ymd(anchorDate()))
  const [activePreset, setActivePreset] = useState<number>(90)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; color: string }[]>([])
  const [campaignId, setCampaignId] = useState<string>("")
  const [campOpen, setCampOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  const [data, setData] = useState<AnalyticsPreview | null>(null)
  const [work, setWork] = useState<WorkTimeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  // Lazily-loaded new surfaces.
  const [pace, setPace] = useState<PaceRow[] | null>(null)
  const [paceEff, setPaceEff] = useState<string>("")
  const [paceLoading, setPaceLoading] = useState(false)
  const [deviations, setDeviations] = useState<DeviationTeam[] | null>(null)
  const [proximity, setProximity] = useState<ProximityViolationsResponse | null>(null)

  // Preview/work-time enforce a max 90-day window.
  const spanDays = useMemo(() => Math.round((new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000) + 1, [startStr, endStr])
  const tooLong = spanDays > 90 || spanDays < 1

  const setPreset = (d: number) => { setActivePreset(d); setStartStr(daysAgo(d - 1)); setEndStr(ymd(anchorDate())) }

  useEffect(() => {
    fetchCampaignsWithStats().then(l => setCampaigns(l.map(c => ({ id: c.id, name: c.name, color: c.color })))).catch(() => {})
  }, [])
  useEffect(() => { if (globalCampaignId) setCampaignId(globalCampaignId) }, [globalCampaignId])

  const load = useCallback(() => {
    if (tooLong) { setLoading(false); setErrored(false); return }
    setLoading(true); setErrored(false)
    const params = { startDate: startStr, endDate: endStr, campaignIds: campaignId ? [campaignId] : undefined }
    return Promise.all([
      fetchAnalyticsPreview(params),
      fetchWorkTimeStats(params).catch(() => null),
    ])
      .then(([p, w]) => {
        if (!p || !p.summary) { setErrored(true); return }
        setData(p); setWork(w)
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [startStr, endStr, campaignId, tooLong])
  // Debounced — custom date inputs change start then end in quick succession.
  useEffect(() => { const t = setTimeout(() => { void load() }, 300); return () => clearTimeout(t) }, [load])

  // Tempo/pace — needs a campaign (endpoint requires campaign_id or team_id).
  useEffect(() => {
    if (tab !== "arbeidstid") return
    if (!campaignId) { setPace(null); return }
    let cancelled = false
    setPaceLoading(true)
    fetchTeamPace({ campaignId, date: endStr, pageSize: 200 })
      .then(r => { if (!cancelled) { setPace(r.results); setPaceEff(r.effective_date) } })
      .catch(() => { if (!cancelled) setPace(null) })
      .finally(() => { if (!cancelled) setPaceLoading(false) })
    return () => { cancelled = true }
  }, [tab, campaignId, endStr])

  // Deviations + proximity — for the Varsler tab.
  useEffect(() => {
    if (tab !== "varsler") return
    let cancelled = false
    fetchDeviations({ date: endStr, campaignId: campaignId || undefined, all: false })
      .then(r => { if (!cancelled) setDeviations(r.teams) })
      .catch(() => { if (!cancelled) setDeviations(null) })
    fetchProximityViolations({ campaignId: campaignId || undefined, startDate: startStr, endDate: endStr, pageSize: 100 })
      .then(r => { if (!cancelled) setProximity(r) })
      .catch(() => { if (!cancelled) setProximity(null) })
    return () => { cancelled = true }
  }, [tab, campaignId, startStr, endStr])

  const downloadPdf = async () => {
    if (tooLong) return
    setDownloading(true)
    try {
      const { blob, filename } = await downloadAnalyticsPdf({ startDate: startStr, endDate: endStr, campaignIds: campaignId ? [campaignId] : undefined })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      toast({ title: "PDF lastet ned", description: filename })
    } catch (e) {
      toast({ title: "Nedlasting feilet", description: e instanceof Error ? e.message : "Ukjent feil", variant: "destructive" })
    } finally { setDownloading(false) }
  }

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "oversikt", label: "Oversikt" },
    { key: "ansatte", label: "Ansatte" },
    { key: "kampanjer", label: "Kampanjer" },
    { key: "varsler", label: "Varsler", badge: data?.alerts.length || undefined },
    { key: "arbeidstid", label: "Tid & tempo" },
    { key: "terskler", label: "Terskler" },
  ]

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 60%, #0a0f1e 100%)" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-purple-600/8 blur-3xl" />
      </div>

      <div className="relative px-6 py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/30 mb-1">Analyse · Observabilitet{isSalesChief && !isAdmin ? " · Salgssjef" : ""}</p>
            <h1 className="text-3xl font-bold text-white">Analytics</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Range presets */}
            <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
              {RANGES.map(r => (
                <button key={r.d} onClick={() => setPreset(r.d)}
                  className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", activePreset === r.d ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{r.label}</button>
              ))}
            </div>
            {/* Custom from–to */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-white/40" />
              <input type="date" value={startStr} max={endStr}
                onChange={e => { if (e.target.value) { setActivePreset(0); setStartStr(e.target.value) } }}
                className="bg-transparent text-xs text-white outline-none [color-scheme:dark]" />
              <span className="text-white/30 text-xs">→</span>
              <input type="date" value={endStr} min={startStr} max={ymd(anchorDate())}
                onChange={e => { if (e.target.value) { setActivePreset(0); setEndStr(e.target.value) } }}
                className="bg-transparent text-xs text-white outline-none [color-scheme:dark]" />
            </div>
            {/* Campaign */}
            <div className="relative">
              <button onClick={() => setCampOpen(o => !o)} className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/70 hover:text-white transition-all">
                {campaignId ? (campaigns.find(c => c.id === campaignId)?.name ?? "Kampanje") : "Alle kampanjer"} <ChevronDown className="h-3.5 w-3.5 text-white/40" />
              </button>
              <AnimatePresence>
                {campOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCampOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-full mt-2 z-20 w-56 max-h-72 overflow-y-auto rounded-xl border border-white/12 bg-[#111a2e] shadow-2xl py-1">
                      <button onClick={() => { setCampaignId(""); setCampOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 text-left"><span className="flex-1 text-white/85">Alle kampanjer</span>{!campaignId && <Check className="h-3.5 w-3.5 text-blue-400" />}</button>
                      {campaigns.map(c => (
                        <button key={c.id} onClick={() => { setCampaignId(c.id); setCampOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 text-left">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="flex-1 text-white/85 truncate">{c.name}</span>{campaignId === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            {/* Download PDF */}
            <button onClick={downloadPdf} disabled={downloading || tooLong}
              className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Last ned PDF
            </button>
            {/* Send weekly report (admin only) */}
            {isAdmin && (
              <button onClick={() => setEmailOpen(true)}
                className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.4)] transition-all">
                <Send className="h-4 w-4" /> Send ukentlig rapport
              </button>
            )}
          </div>
        </motion.div>

        {tooLong && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" /> Velg et tidsrom på maks 90 dager (valgt: {spanDays} dager).
          </div>
        )}

        <EmailReportModal open={emailOpen} onClose={() => setEmailOpen(false)} />

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/5 border border-white/8 p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn("cursor-pointer flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap", tab === t.key ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>
              {t.label}{t.badge ? <span className="rounded-full bg-rose-500/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "terskler" ? (
          <TersklerTab campaigns={campaigns} data={data} />
        ) : loading ? (
          <Glass className="min-h-[300px]"><PanelLoading label="Laster analyse…" /></Glass>
        ) : errored ? (
          <Glass className="min-h-[300px]"><PanelError onRetry={() => void load()} /></Glass>
        ) : !data || data.summary.total_doors === 0 ? (
          <Glass className="min-h-[300px]"><PanelEmpty msg="Ingen aktivitet i perioden" sub="Prøv et annet datovindu eller kampanje." /></Glass>
        ) : (
          <AnimatePresence mode="wait">
            {tab === "oversikt" && <OversiktTab key="o" d={data} />}
            {tab === "ansatte" && <AnsatteTab key="a" d={data} startStr={startStr} endStr={endStr} />}
            {tab === "kampanjer" && <KampanjerTab key="k" d={data} />}
            {tab === "varsler" && <VarslerTab key="v" d={data} deviations={deviations} proximity={proximity} />}
            {tab === "arbeidstid" && <TidTempoTab key="w" work={work} campaignSelected={!!campaignId} pace={pace} paceLoading={paceLoading} effDate={paceEff} />}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

// ─── Oversikt ─────────────────────────────────────────────────────────────────
function OversiktTab({ d }: { d: AnalyticsPreview }) {
  const s = d.summary, c = d.comparisons
  const [gran, setGran] = useState<"dag" | "uke">("dag")
  const [seg, setSeg] = useState<Record<string, boolean>>({ ja: true, nei: true, ikke_hjemme: true, folg_opp: true })

  // Day / week aggregation of the activity chart.
  const chart = useMemo(() => {
    const days = (d.daily_breakdown ?? []).filter(x => x.date)
    if (gran === "dag") {
      return days.map(x => ({
        label: new Date(x.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }),
        ja: x.ja, nei: x.nei, ikke_hjemme: x.ikke_hjemme, folg_opp: x.folg_opp,
        total: x.total_doors, yes_rate: x.yes_rate,
      }))
    }
    const byWeek = new Map<string, { label: string; ja: number; nei: number; ikke_hjemme: number; folg_opp: number; total: number }>()
    for (const x of days) {
      const { key, label } = isoWeek(new Date(x.date))
      const w = byWeek.get(key) ?? { label, ja: 0, nei: 0, ikke_hjemme: 0, folg_opp: 0, total: 0 }
      w.ja += x.ja; w.nei += x.nei; w.ikke_hjemme += x.ikke_hjemme; w.folg_opp += x.folg_opp; w.total += x.total_doors
      byWeek.set(key, w)
    }
    return Array.from(byWeek.values()).map(w => ({ ...w, yes_rate: w.total ? (w.ja / w.total) * 100 : 0 }))
  }, [d.daily_breakdown, gran])

  const bestIdx = useMemo(() => chart.reduce((bi, x, i, arr) => (x.total > arr[bi].total ? i : bi), 0), [chart])
  const donut = STATUS.map(st => ({ ...st, value: (s as unknown as Record<string, number>)[st.key] }))

  // Per-KPI sparklines from the daily breakdown.
  const spark = useMemo(() => {
    const days = (d.daily_breakdown ?? []).filter(x => x.date)
    return {
      doors: days.map(x => x.total_doors),
      yes: days.map(x => x.yes_rate),
      contact: days.map(x => (x.total_doors ? ((x.total_doors - x.ikke_hjemme) / x.total_doors) * 100 : 0)),
    }
  }, [d.daily_breakdown])

  // Weekday pattern (avg doors/day).
  const weekday = useMemo(() => {
    const acc = WEEKDAY_LABELS.map(label => ({ label, total: 0, days: 0 }))
    for (const x of (d.daily_breakdown ?? [])) {
      if (!x.date) continue
      const wd = (new Date(x.date).getUTCDay() + 6) % 7
      acc[wd].total += x.total_doors; acc[wd].days += 1
    }
    return acc.map(a => ({ label: a.label, avg: a.days ? a.total / a.days : 0 }))
  }, [d.daily_breakdown])
  const wdMax = Math.max(...weekday.map(w => w.avg), 1)

  const hourly = (d.hourly_breakdown ?? [])
  const bestHour = useMemo(() => hourly.reduce((b, h) => (h.total_doors * h.yes_rate > (b ? b.total_doors * b.yes_rate : -1) ? h : b), hourly[0]), [hourly])

  const tp = d.top_performers
  const topCards = [
    { icon: Trophy, label: "Beste ja-rate", e: tp?.top_yes_rate, suffix: "%", color: "#10b981" },
    { icon: DoorOpen, label: "Flest dører", e: tp?.top_doors, suffix: "", color: "#3b82f6" },
    { icon: TrendingDown, label: "Laveste ja-rate", e: tp?.bottom_yes_rate, suffix: "%", color: "#f43f5e" },
    { icon: ArrowDownRight, label: "Færrest dører", e: tp?.bottom_doors, suffix: "", color: "#f59e0b" },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* KPI row (6) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile label="Totale dører" value={nbFmt.format(s.total_doors)} deltaPct={c.total_doors.change_pct} color="#3b82f6" Icon={DoorOpen} spark={spark.doors} />
        <KpiTile label="Ja-rate" value={`${nf1(s.yes_rate)}%`} deltaPct={c.yes_rate.change_pct} color="#10b981" Icon={Percent} spark={spark.yes} />
        <KpiTile label="Kontaktrate" value={`${nf1(s.contact_rate)}%`} deltaPct={c.contact_rate.change_pct} color="#8b5cf6" Icon={Users} spark={spark.contact} />
        <KpiTile label="Dører / dag" value={nf1(s.doors_per_day)} deltaPct={c.doors_per_day.change_pct} color="#f59e0b" Icon={Activity} spark={spark.doors} />
        <KpiTile label="Unike ansatte" value={nbFmt.format(s.unique_employees)} color="#06b6d4" Icon={Users} />
        <KpiTile label="Snitt dører/ansatt" value={nf1(s.avg_doors_per_employee)} color="#ec4899" Icon={Target} />
      </div>

      {/* Activity + status */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <Glass className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-white">Aktivitet per {gran}</h3>
            <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
              {(["dag", "uke"] as const).map(g => (
                <button key={g} onClick={() => setGran(g)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all", gran === g ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{g}</button>
              ))}
            </div>
          </div>
          {/* segment toggles */}
          <div className="flex flex-wrap gap-2 mb-3">
            {STATUS.map(st => (
              <button key={st.key} onClick={() => setSeg(o => ({ ...o, [st.key]: !o[st.key] }))}
                className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all", seg[st.key] ? "border-white/15 text-white/80" : "border-white/5 text-white/30")}>
                <span className="h-2 w-2 rounded-sm" style={{ background: st.color, opacity: seg[st.key] ? 1 : 0.3 }} />{st.label}
                <span className="font-mono text-white/50">{nbFmt.format((s as unknown as Record<string, number>)[st.key])}</span>
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, "auto"]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={chartTooltip} />
              <ReferenceLine yAxisId="right" y={30} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.6} />
              {STATUS.filter(st => seg[st.key]).map(st => (
                <Bar key={st.key} yAxisId="left" dataKey={st.key} stackId="1" fill={st.color} radius={st.key === "ja" ? [3, 3, 0, 0] : undefined} maxBarSize={28} />
              ))}
              <Line yAxisId="right" type="monotone" dataKey="yes_rate" stroke="#10b981" strokeWidth={2} dot={false} name="Ja-rate %" />
            </ComposedChart>
          </ResponsiveContainer>
          {chart.length > 0 && (
            <p className="mt-2 text-[11px] text-white/40">★ Beste {gran}: <span className="text-white/70">{chart[bestIdx]?.label}</span> · {nbFmt.format(chart[bestIdx]?.total ?? 0)} dører · stiplet linje = ja-rate-terskel 30 %</p>
          )}
        </Glass>

        <Glass className="p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-2">Statusfordeling</h3>
          <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart><Pie data={donut} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value">{donut.map(x => <Cell key={x.key} fill={x.color} />)}</Pie>
              <Tooltip contentStyle={chartTooltip} /></PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-xl font-bold text-white">{nbFmt.format(s.total_doors)}</span><span className="text-[10px] text-white/40">dører</span></div>
          </div>
          <div className="mt-3 space-y-1.5">
            {donut.map(x => <div key={x.key} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-white/60"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />{x.label}</span><span className="font-mono text-white/70">{nbFmt.format(x.value)}</span></div>)}
          </div>
        </Glass>
      </div>

      {/* Beste tidspunkt + Ukedagsmønster */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <Glass className="p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Beste tidspunkt</h3>
          <p className="text-xs text-white/45 mb-3">Dører (søyler) og ja-rate (linje) per time{bestHour ? ` · beste time kl. ${bestHour.hour}:00` : ""}</p>
          {hourly.length === 0 ? <PanelEmpty msg="Ingen timedata" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={hourly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(h) => `${h}`} interval={2} />
                <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={chartTooltip} />
                <Bar yAxisId="left" dataKey="total_doors" name="Dører" radius={[3, 3, 0, 0]} maxBarSize={16}>
                  {hourly.map((h) => <Cell key={h.hour} fill={bestHour && h.hour === bestHour.hour ? "#3b82f6" : "rgba(59,130,246,0.35)"} />)}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="yes_rate" name="Ja-rate %" stroke="#10b981" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Glass>
        <Glass className="p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Ukedagsmønster</h3>
          <div className="space-y-2">
            {weekday.map(w => (
              <div key={w.label} className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-xs text-white/45 capitalize">{w.label}</span>
                <div className="relative flex-1 h-5 rounded-lg bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-lg bg-gradient-to-r from-blue-600/70 to-blue-400/70" style={{ width: `${(w.avg / wdMax) * 100}%` }} />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-xs text-white/70">{nf1(w.avg)}</span>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {/* Topp og bunn */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {topCards.map(tc => (
          <div key={tc.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
            <div className="flex items-center gap-2 mb-2"><tc.icon className="h-4 w-4" style={{ color: tc.color }} /><span className="text-xs text-white/40 font-medium">{tc.label}</span></div>
            <p className="text-sm font-semibold text-white/90 truncate">{tc.e?.employee_name ?? "—"}</p>
            <p className="font-mono text-lg font-bold" style={{ color: tc.color }}>{tc.e ? (tc.suffix === "%" ? nf1(tc.e.value) : nbFmt.format(tc.e.value)) : "—"}{tc.suffix}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Ansatte ──────────────────────────────────────────────────────────────────
function AnsatteTab({ d, startStr, endStr }: { d: AnalyticsPreview; startStr: string; endStr: string }) {
  const [filter, setFilter] = useState<"alle" | "employee" | "manager">("alle")
  const [view, setView] = useState<"tabell" | "spredning">("tabell")
  const [expanded, setExpanded] = useState<string | null>(null)

  const alertsByEmp = useMemo(() => {
    const m = new Map<string, AnAlert[]>()
    for (const a of d.alerts ?? []) { if (!a.employee_id) continue; const l = m.get(a.employee_id) ?? []; l.push(a); m.set(a.employee_id, l) }
    return m
  }, [d.alerts])

  const rows = useMemo(() => {
    const base = filter === "alle" ? d.employees : d.employees.filter(e => e.worker_type === filter)
    return [...base].sort((a, b) => b.total_doors - a.total_doors)
  }, [d.employees, filter])

  if (d.employees.length === 0) return <Glass className="min-h-[200px]"><PanelEmpty msg="Ingen ansatte i perioden" /></Glass>

  const chips: { k: typeof filter; label: string }[] = [
    { k: "alle", label: "Alle" }, { k: "employee", label: "Ansatte" }, { k: "manager", label: "Ledere" },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Glass className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-white">Ansatte ({rows.length})</h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
              {chips.map(c => <button key={c.k} onClick={() => setFilter(c.k)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-all", filter === c.k ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{c.label}</button>)}
            </div>
            <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
              {(["tabell", "spredning"] as const).map(v => <button key={v} onClick={() => setView(v)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all", view === v ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{v}</button>)}
            </div>
          </div>
        </div>

        {view === "spredning" ? (
          <EmployeeScatter rows={rows} />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[1.6fr_70px_70px_70px_80px_90px_70px] gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                <span>Ansatt</span><span className="text-right">Dører</span><span className="text-right">D/dag</span><span className="text-right">Ja %</span><span className="text-right">Kontakt %</span><span className="text-right">Konsist.</span><span className="text-right">Varsler</span>
              </div>
              <div className="divide-y divide-white/5">
                {rows.map(e => {
                  const empAlerts = alertsByEmp.get(e.employee_id) ?? []
                  const worst = empAlerts.some(a => a.severity === "critical") ? "#f43f5e" : empAlerts.length ? "#f59e0b" : "#64748b"
                  const isOpen = expanded === e.employee_id
                  return (
                    <div key={e.employee_id}>
                      <div onClick={() => setExpanded(isOpen ? null : e.employee_id)} className="grid grid-cols-[1.6fr_70px_70px_70px_80px_90px_70px] gap-3 items-center px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] rounded-lg">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChevronRight className={cn("h-3.5 w-3.5 text-white/30 transition-transform", isOpen && "rotate-90")} />
                          <RoyMascot state={empRoy(e)} size={30} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white/90 truncate">{e.employee_name}</p>
                            <p className="text-[10px] text-white/35">{e.worker_type === "manager" ? "Leder" : "Ansatt"} · konsist. {Math.round(e.consistency_score)}%</p>
                          </div>
                        </div>
                        <span className="text-right font-mono text-sm text-white/80">{nbFmt.format(e.total_doors)}</span>
                        <span className="text-right font-mono text-sm text-white/60">{nf1(e.doors_per_day)}</span>
                        <span className="text-right font-mono text-sm" style={{ color: e.yes_rate >= 3 ? "#10b981" : "#f43f5e" }}>{nf1(e.yes_rate)}</span>
                        <span className="text-right font-mono text-sm text-white/60">{e.contact_rate.toFixed(0)}</span>
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-10 h-1.5 rounded-full bg-white/8 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, e.consistency_score)}%`, background: e.consistency_score >= 60 ? "#10b981" : e.consistency_score >= 35 ? "#f59e0b" : "#f43f5e" }} /></div>
                        </div>
                        <div className="flex justify-end">{empAlerts.length ? <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${worst}22`, color: worst }}>{empAlerts.length}</span> : <span className="text-white/20 text-xs">—</span>}</div>
                      </div>
                      <AnimatePresence>
                        {isOpen && <EmployeeDetail e={e} alerts={empAlerts} startStr={startStr} endStr={endStr} />}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Glass>
    </motion.div>
  )
}

function EmployeeScatter({ rows }: { rows: AnEmployee[] }) {
  const emps = rows.filter(e => e.worker_type === "employee").map(e => ({ x: e.doors_per_day, y: e.yes_rate, z: Math.sqrt(Math.max(1, e.total_doors)), name: e.employee_name }))
  const mgrs = rows.filter(e => e.worker_type === "manager").map(e => ({ x: e.doors_per_day, y: e.yes_rate, z: Math.sqrt(Math.max(1, e.total_doors)), name: e.employee_name }))
  return (
    <div>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" dataKey="x" name="Dører/dag" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "Dører / dag →", position: "insideBottom", offset: -4, fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
          <YAxis type="number" dataKey="y" name="Ja-rate" unit="%" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "Ja-rate % →", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
          <ZAxis type="number" dataKey="z" range={[40, 400]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={chartTooltip} formatter={(v: number, n: string) => [n === "Ja-rate" ? `${nf1(v)}%` : nf1(v), n]} />
          <Scatter name="Ansatte" data={emps} fill="#3b82f6" fillOpacity={0.55} />
          <Scatter name="Ledere" data={mgrs} fill="#8b5cf6" fillOpacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 pt-2 text-[11px] text-white/40">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3b82f6" }} /> Ansatte</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#8b5cf6" }} /> Ledere</span>
        <span className="text-white/30">· boblestørrelse = totale dører</span>
      </div>
    </div>
  )
}

function EmployeeDetail({ e, alerts, startStr, endStr }: { e: AnEmployee; alerts: AnAlert[]; startStr: string; endStr: string }) {
  const [series, setSeries] = useState<PaceDay[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchEmployeePaceSeries({ personId: e.employee_id, personKind: e.worker_type, startDate: startStr, endDate: endStr })
      .then(r => { if (!cancelled) setSeries(r.series) })
      .catch(() => { if (!cancelled) setSeries([]) })
    return () => { cancelled = true }
  }, [e.employee_id, startStr, endStr])

  const chart = useMemo(() => (series ?? []).map(s => ({
    label: new Date(s.day).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }),
    doors: s.doors_knocked, window: s.active_window_minutes,
  })), [series])
  const latest = series && series.length ? series[series.length - 1] : null
  const avgPace = useMemo(() => {
    const p = (series ?? []).filter(s => s.pace_doors_per_hour != null)
    return p.length ? p.reduce((a, s) => a + (s.pace_doors_per_hour ?? 0), 0) / p.length : null
  }, [series])

  const status = [
    { label: "Ja", value: e.ja, color: "#10b981" }, { label: "Nei", value: e.nei, color: "#f43f5e" },
    { label: "Ikke hjemme", value: e.ikke_hjemme, color: "#f59e0b" }, { label: "Følg opp", value: e.folg_opp, color: "#8b5cf6" },
  ]
  // First/last knock come from the most recent day the person actually knocked.
  const latestDate = latest ? new Date(latest.day).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) : ""
  const tempo = [
    { label: "Første knock", value: latest ? fmtClock(latest.first_knock_at) : "—", sub: latestDate },
    { label: "Siste knock", value: latest ? fmtClock(latest.last_knock_at) : "—", sub: latestDate },
    { label: "Aktivt vindu", value: latest && latest.active_window_minutes > 0 ? fmtMin(latest.active_window_minutes) : "—", sub: latestDate },
    { label: "Snitt dører/time", value: avgPace != null ? nf1(avgPace) : "—", sub: "hele perioden" },
  ]

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="px-4 pb-4 pt-1 space-y-3">
        {/* Tempo headline — first/last knock are for the person's most recent active day */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tempo.map(t => (
            <div key={t.label} className="rounded-xl border border-cyan-500/12 bg-cyan-500/[0.03] p-2.5">
              <p className="text-[10px] text-white/40 flex items-center gap-1"><Zap className="h-3 w-3 text-cyan-400" />{t.label}</p>
              <p className="font-mono text-base font-bold text-white/90 leading-tight">{t.value}</p>
              {t.sub && <p className="text-[10px] text-white/35 mt-0.5">{t.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4">
          {/* Trend: daily doors (bars) + active window minutes (line). min-w-0 keeps the
              chart from overflowing its grid cell when a person has many active days. */}
          <div className="min-w-0 overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-xs text-white/45 mb-2">Tempo-trend · dører (søyle) og aktivt vindu i min (linje){latest ? ` · siste dag ${latestDate}` : ""}</p>
            {series === null ? <div className="h-[130px] flex items-center justify-center text-xs text-white/35">Laster…</div>
              : chart.length === 0 ? <div className="h-[130px] flex items-center justify-center text-xs text-white/35">Ingen tempodata i perioden</div>
                : (
                  <ResponsiveContainer width="100%" height={130}>
                    <ComposedChart data={chart} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }} tickLine={false} axisLine={false} interval={Math.max(0, Math.ceil(chart.length / 8) - 1)} minTickGap={16} />
                      <YAxis yAxisId="l" width={28} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="r" width={28} orientation="right" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={chartTooltip} />
                      <Bar yAxisId="l" dataKey="doors" name="Dører" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={14} />
                      <Line yAxisId="r" type="monotone" dataKey="window" name="Vindu (min)" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
          </div>
          {/* Status tiles */}
          <div className="grid grid-cols-2 gap-2 content-start">
            {status.map(t => <div key={t.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5"><p className="text-[10px] text-white/40">{t.label}</p><p className="font-mono text-base font-bold" style={{ color: t.color }}>{nbFmt.format(t.value)}</p></div>)}
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-1.5">
            {alerts.map((a, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: a.severity === "critical" ? "#f43f5e22" : "#f59e0b22", color: a.severity === "critical" ? "#f43f5e" : "#f59e0b" }}>{a.severity === "critical" ? "Kritisk" : "Advarsel"}</span><span className="text-white/55">{a.message}</span></div>)}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Nei-årsaker (Talkmore) ───────────────────────────────────────────────────
const NEI_REASON_LABELS: Record<keyof NeiBreakdown, string> = {
  bedrift: "Bedrift", pris: "Pris", ikke_interessert: "Ikke interessert", bindingstid: "Bindingstid",
  darlig_erfaring: "Dårlig erfaring", eksisterende_kunde: "Eksisterende kunde", unspecified: "Uspesifisert",
}

function NeiReasonsPanel({ campaignName, breakdown }: { campaignName: string; breakdown: NeiBreakdown }) {
  const reduced = useReducedMotion()
  const rows = useMemo(() => {
    const entries = (Object.keys(NEI_REASON_LABELS) as (keyof NeiBreakdown)[])
      .map(k => ({ key: k, label: NEI_REASON_LABELS[k], count: breakdown[k] ?? 0 }))
      .filter(r => r.count > 0).sort((a, b) => b.count - a.count)
    const total = entries.reduce((a, r) => a + r.count, 0)
    const unspecPct = total ? ((breakdown.unspecified ?? 0) / total) * 100 : 0
    return { entries, total, unspecPct }
  }, [breakdown])

  return (
    <Glass className="p-5" delay={0.05}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div><h3 className="text-sm font-semibold text-white">Hvorfor nei? ({campaignName})</h3><p className="text-xs text-white/45">Fordeling av avslag etter årsak</p></div>
        {rows.unspecPct > 0 && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">{Math.round(rows.unspecPct)} % av nei mangler årsak</span>}
      </div>
      <div className="mt-4">
        {rows.total === 0 ? <PanelEmpty msg="Ingen registrerte nei-årsaker i perioden" /> : (
          <div className="space-y-3">
            {rows.entries.map((r, i) => {
              const pct = (r.count / rows.total) * 100
              const dim = r.key === "unspecified"
              return (
                <div key={r.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-sm", dim ? "text-white/40" : "text-white/85")}>{r.label}</span>
                    <span className="flex items-baseline gap-2"><span className="font-mono text-sm text-white/50">{nbFmt.format(r.count)}</span><span className={cn("font-mono text-sm font-semibold w-12 text-right", dim ? "text-white/45" : "text-white/90")}>{nf1(pct)}%</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <motion.div className="h-full rounded-full" style={{ background: dim ? "rgba(255,255,255,0.15)" : "#f43f5e" }} initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: i * 0.04 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Glass>
  )
}

// ─── Kampanjer ────────────────────────────────────────────────────────────────
function KampanjerTab({ d }: { d: AnalyticsPreview }) {
  type K = keyof Pick<AnCampaign, "total_doors" | "yes_rate" | "no_rate" | "contact_rate" | "num_employees">
  const [sort, setSort] = useState<K>("total_doors")
  const rows = useMemo(() => [...d.campaigns].sort((a, b) => (b[sort] as number) - (a[sort] as number)), [d.campaigns, sort])
  const talkmore = useMemo(() => d.campaigns.filter(c => c.is_talkmore && c.nei_breakdown), [d.campaigns])
  const s = d.summary
  if (rows.length === 0) return <Glass className="min-h-[200px]"><PanelEmpty msg="Ingen kampanjeaktivitet i perioden" /></Glass>
  const Th = ({ k, label }: { k: K; label: string }) => <button onClick={() => setSort(k)} className={cn("cursor-pointer text-right text-[10px] font-bold uppercase tracking-wider", sort === k ? "text-blue-400" : "text-white/35 hover:text-white/60")}>{label}</button>

  // Conversion funnel from the (campaign-filtered) summary.
  const contact = Math.round(s.total_doors * (s.contact_rate / 100))
  const funnel = [
    { label: "Dører", value: s.total_doors, pct: 100, color: "#3b82f6" },
    { label: "Kontakt", value: contact, pct: s.contact_rate, color: "#8b5cf6" },
    { label: "Ja", value: s.ja, pct: s.yes_rate, color: "#10b981" },
  ]
  const hourlyJa = useMemo(() => (d.hourly_breakdown ?? []).filter(h => h.hour >= 8 && h.hour <= 21), [d.hourly_breakdown])
  const bestJaHour = useMemo(() => hourlyJa.reduce((b, h) => (h.yes_rate > (b ? b.yes_rate : -1) ? h : b), hourlyJa[0]), [hourlyJa])
  const title = rows.length === 1 ? rows[0].campaign_name : `${rows.length} kampanjer`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Wide header card */}
      <Glass className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0"><Target className="h-5 w-5 text-blue-400" /></div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white truncate">{title}</p>
              <p className="text-xs text-white/40">{nbFmt.format(s.unique_employees)} ansatte · {nbFmt.format(s.total_doors)} dører · {d.period.days} dager</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-white/35">Ja-rate</p><p className="font-mono text-xl font-bold text-emerald-400">{nf1(s.yes_rate)}%</p></div>
            <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-white/35">Kontakt</p><p className="font-mono text-xl font-bold text-white">{nf1(s.contact_rate)}%</p></div>
            <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-white/35">Nei-rate</p><p className="font-mono text-xl font-bold text-rose-400">{nf1(s.no_rate)}%</p></div>
          </div>
        </div>
      </Glass>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <Glass className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Kampanjer ({rows.length})</h3>
          <div className="overflow-x-auto"><div className="min-w-[560px]">
            <div className="grid grid-cols-[1.6fr_80px_70px_70px_80px_70px] gap-3 px-3 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Kampanje</span>
              <Th k="total_doors" label="Dører" /><Th k="yes_rate" label="Ja %" /><Th k="no_rate" label="Nei %" /><Th k="contact_rate" label="Kontakt %" /><Th k="num_employees" label="Ansatte" />
            </div>
            <div className="divide-y divide-white/5">
              {rows.map(c => (
                <div key={c.campaign_id} className="grid grid-cols-[1.6fr_80px_70px_70px_80px_70px] gap-3 items-center px-3 py-2.5">
                  <span className="text-sm font-medium text-white/90 truncate flex items-center gap-2">{c.campaign_name}{c.is_talkmore && <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">Talkmore</span>}</span>
                  <span className="text-right font-mono text-sm text-white/80">{nbFmt.format(c.total_doors)}</span>
                  <span className="text-right font-mono text-sm text-emerald-400">{nf1(c.yes_rate)}</span>
                  <span className="text-right font-mono text-sm text-white/60">{nf1(c.no_rate)}</span>
                  <span className="text-right font-mono text-sm text-white/60">{c.contact_rate.toFixed(0)}</span>
                  <span className="text-right font-mono text-sm text-white/70">{c.num_employees}</span>
                </div>
              ))}
            </div>
          </div></div>
        </Glass>

        <div className="space-y-5">
          {/* Funnel */}
          <Glass className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Konverteringstrakt</h3>
            <div className="space-y-3">
              {funnel.map((f, i) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between mb-1 text-xs"><span className="text-white/70">{f.label}</span><span className="font-mono text-white/50">{nbFmt.format(f.value)} · {nf1(f.pct)}%</span></div>
                  <div className="h-6 rounded-lg bg-white/[0.04] overflow-hidden"><div className="h-full rounded-lg" style={{ width: `${Math.max(3, f.pct)}%`, background: f.color }} /></div>
                  {i < funnel.length - 1 && <p className="mt-1 text-[10px] text-white/30">↓ {nf1(f.pct - funnel[i + 1].pct)} % faller fra</p>}
                </div>
              ))}
            </div>
          </Glass>
          {/* Status bar */}
          <Glass className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Statusfordeling</h3>
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {STATUS.map(st => { const v = (s as unknown as Record<string, number>)[st.key]; const pct = s.total_doors ? (v / s.total_doors) * 100 : 0; return <div key={st.key} style={{ width: `${pct}%`, background: st.color }} title={`${st.label}: ${nbFmt.format(v)}`} /> })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {STATUS.map(st => { const v = (s as unknown as Record<string, number>)[st.key]; return <div key={st.key} className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-white/60"><span className="h-2 w-2 rounded-sm" style={{ background: st.color }} />{st.label}</span><span className="font-mono text-white/70">{nbFmt.format(v)}</span></div> })}
            </div>
          </Glass>
        </div>
      </div>

      {/* Ja-rate per time */}
      {hourlyJa.length > 0 && (
        <Glass className="p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white">Ja-rate per time</h3><span className="text-xs text-white/40">Når sier folk ja?{bestJaHour ? ` · beste kl. ${bestJaHour.hour}:00` : ""}</span></div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyJa} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis unit="%" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltip} formatter={(v: number) => [`${nf1(v)}%`, "Ja-rate"]} />
              <Bar dataKey="yes_rate" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {hourlyJa.map(h => <Cell key={h.hour} fill={bestJaHour && h.hour === bestJaHour.hour ? "#10b981" : "rgba(16,185,129,0.35)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Glass>
      )}

      {/* Talkmore-only rejection-reason breakdown */}
      {talkmore.map(c => <NeiReasonsPanel key={c.campaign_id} campaignName={c.campaign_name} breakdown={c.nei_breakdown!} />)}
    </motion.div>
  )
}

// ─── Varsler ──────────────────────────────────────────────────────────────────
const ALERT_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  low_yes_rate: { label: "Lav ja-rate", Icon: TrendingDown, color: "#f43f5e" },
  consecutive_low_yes_rate: { label: "Lav ja-rate (sammenh.)", Icon: TrendingDown, color: "#f43f5e" },
  low_doors_per_day: { label: "Få dører per dag", Icon: DoorOpen, color: "#f59e0b" },
  consecutive_low_doors: { label: "Få dører (sammenh.)", Icon: DoorOpen, color: "#f59e0b" },
  low_contact_rate: { label: "Lav kontaktrate", Icon: Users, color: "#f59e0b" },
  below_target: { label: "Under mål", Icon: Target, color: "#f59e0b" },
  avvik_egen_normal: { label: "Avvik fra egen normal", Icon: Zap, color: "#06b6d4" },
}
const alertMeta = (t: string) => ALERT_META[t] ?? { label: t, Icon: AlertCircle, color: "#f59e0b" }

// Unified alert model — fixed-threshold breaches (preview.alerts) + personal-baseline
// deviation streaks (from /deviations/) merged into one grouped/filterable list.
type USeverity = "critical" | "warning" | "info"
interface UAlert {
  key: string
  personId: string
  personName: string
  alertType: string
  severity: USeverity
  message: string
  current: number
  threshold: number
  source: "terskel" | "avvik"
  daily: { value: number; below: boolean }[]
  baseline?: number
}
const SEV_LABEL: Record<USeverity, string> = { critical: "Kritisk", warning: "Advarsel", info: "Info" }
const sevColor = (s: USeverity) => (s === "critical" ? "#f43f5e" : s === "warning" ? "#f59e0b" : "#3b82f6")

function VarslerTab({ d, deviations, proximity }: { d: AnalyticsPreview; deviations: DeviationTeam[] | null; proximity: ProximityViolationsResponse | null }) {
  const [sev, setSev] = useState<"alle" | USeverity>("alle")
  const [group, setGroup] = useState<"ansatt" | "type">("ansatt")
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [openAlerts, setOpenAlerts] = useState<Set<string>>(new Set())

  // Merge fixed-threshold breaches + personal-baseline deviations into one list.
  const alerts: UAlert[] = useMemo(() => {
    const fixed: UAlert[] = (d.alerts ?? []).map((a, i) => ({
      key: `f-${i}`, personId: a.employee_id || a.employee_name || `x${i}`, personName: a.employee_name || "Ukjent",
      alertType: a.alert_type,
      severity: (a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info") as USeverity,
      message: a.message, current: a.current_value, threshold: a.threshold_value, source: "terskel",
      daily: (a.daily_details ?? []).map(x => ({ value: x.doors ?? x.value ?? 0, below: !!(x.below_doors_threshold || x.below_yes_rate_threshold) })),
    }))
    const dev: UAlert[] = (deviations ?? []).flatMap(t => t.flagged.map((f, i) => ({
      key: `d-${t.team_id}-${f.person_id}-${i}`, personId: f.person_id, personName: f.name,
      alertType: "avvik_egen_normal",
      severity: (f.shortfall_pct >= 35 ? "critical" : "warning") as USeverity,
      message: `${Math.round(f.shortfall_pct)} % under eget snitt (${nf1(f.baseline)}) i ${f.streak_len} dager.`,
      current: f.today_doors, threshold: f.baseline, source: "avvik" as const,
      daily: f.streak_days.map(s => ({ value: s.doors, below: true })), baseline: f.baseline,
    })))
    return [...fixed, ...dev]
  }, [d.alerts, deviations])

  const counts = useMemo(() => ({
    alle: alerts.length,
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
  }), [alerts])
  const filtered = useMemo(() => alerts.filter(a => sev === "alle" || a.severity === sev), [alerts, sev])

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; items: UAlert[] }>()
    for (const a of filtered) {
      const gk = group === "ansatt" ? a.personId : a.alertType
      const gname = group === "ansatt" ? a.personName : alertMeta(a.alertType).label
      const g = m.get(gk) ?? { key: gk, name: gname, items: [] }
      g.items.push(a); m.set(gk, g)
    }
    return [...m.values()].sort((x, y) => {
      const cx = x.items.filter(i => i.severity === "critical").length
      const cy = y.items.filter(i => i.severity === "critical").length
      return cy - cx || y.items.length - x.items.length
    })
  }, [filtered, group])

  const toggleGroup = (k: string) => setOpenGroups(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleAlert = (k: string) => setOpenAlerts(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      <Glass className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-white">Varsler ({alerts.length})</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
              {(["alle", "critical", "warning", "info"] as const).map(s => (
                <button key={s} onClick={() => setSev(s)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-all", sev === s ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>
                  {s === "alle" ? "Alle" : SEV_LABEL[s]} <span className="text-white/40">{counts[s]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/35">Grupper etter</span>
              <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
                {(["ansatt", "type"] as const).map(g => <button key={g} onClick={() => setGroup(g)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all", group === g ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{g}</button>)}
              </div>
            </div>
          </div>
        </div>
        {groups.length === 0 ? <PanelEmpty msg="Ingen varsler" sub="Alt innenfor terskel." /> : (
          <div className="space-y-2">
            {groups.map(g => {
              const crit = g.items.filter(i => i.severity === "critical").length
              const warn = g.items.filter(i => i.severity === "warning").length
              const worst = crit ? "#f43f5e" : warn ? "#f59e0b" : "#3b82f6"
              const gopen = openGroups.has(g.key)
              const sub = [crit && `${crit} kritiske`, warn && `${warn} advarsler`].filter(Boolean).join(" · ") || `${g.items.length} info`
              return (
                <div key={g.key} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                  <button onClick={() => toggleGroup(g.key)} className="cursor-pointer w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] text-left">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: worst }} />
                    <span className="text-sm font-semibold text-white/90 truncate">{g.name}</span>
                    <span className="text-[11px] text-white/35 truncate">{sub}</span>
                    <span className="ml-auto text-[11px] text-white/45 shrink-0">{g.items.length} varsler</span>
                    <ChevronDown className={cn("h-4 w-4 text-white/30 transition-transform shrink-0", gopen && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {gopen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-2 pb-2 space-y-1.5">
                          {g.items.map(a => {
                            const meta = alertMeta(a.alertType)
                            const c = sevColor(a.severity)
                            const aopen = openAlerts.has(a.key)
                            return (
                              <div key={a.key} className="rounded-lg border border-white/6 bg-white/[0.02]">
                                <div onClick={() => a.daily.length && toggleAlert(a.key)} className={cn("flex items-center gap-3 p-2.5", a.daily.length && "cursor-pointer")}>
                                  <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold shrink-0" style={{ background: `${c}22`, color: c }}>{SEV_LABEL[a.severity]}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2"><meta.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} /><span className="text-xs font-semibold text-white/80">{meta.label}</span>{group === "type" && <span className="text-[11px] text-white/40 truncate">{a.personName}</span>}</div>
                                    <p className="text-[11px] text-white/45 truncate mt-0.5">{a.message}</p>
                                  </div>
                                  <span className="font-mono text-xs font-bold shrink-0" style={{ color: c }}>{nf1(a.current)}<span className="text-white/30"> / {nf1(a.threshold)}</span></span>
                                  {a.daily.length > 0 && <ChevronRight className={cn("h-3.5 w-3.5 text-white/25 transition-transform shrink-0", aopen && "rotate-90")} />}
                                </div>
                                <AnimatePresence>
                                  {aopen && a.daily.length > 0 && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                      <div className="px-3 pb-3">
                                        <p className="text-[10px] text-white/40 mb-1">{a.source === "avvik" ? `Strek (${a.daily.length} dager) — søyle = dører, stiplet = baseline` : `Siste ${a.daily.length} dager`}</p>
                                        <MiniBars values={a.daily.map(x => x.value)} below={a.daily.map(x => x.below)} threshold={a.threshold} color={a.source === "avvik" ? "#06b6d4" : "#3b82f6"} />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </Glass>

      {/* GPS proximity violations */}
      <Glass className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div><h3 className="text-sm font-semibold text-white flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-400" /> GPS-avvik / Nærhet{proximity ? ` (${proximity.total_violations})` : ""}</h3><p className="text-[11px] text-white/40">Avviste eller uverifiserte knock-forsøk (for langt fra døra / estimert posisjon)</p></div>
          {proximity && <span className="text-[11px] text-white/45">{proximity.estimated_position_count} estimert posisjon</span>}
        </div>
        {proximity === null ? <PanelLoading label="Laster GPS-avvik…" /> : proximity.results.length === 0 ? <PanelEmpty msg="Ingen GPS-avvik i perioden" /> : (
          <div className="divide-y divide-white/5">
            {proximity.results.slice(0, 30).map(v => (
              <div key={v.id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 bg-amber-500/15"><MapPin className="h-4 w-4 text-amber-400" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm text-white/80 truncate">{v.address_text ?? "Ukjent adresse"}</p><p className="text-[10px] text-white/35">{new Date(v.ts).toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{v.user.estimated && <span className="ml-1.5 rounded bg-white/10 px-1 py-0.5 text-white/50">estimert</span>}</p></div>
                <span className="font-mono text-sm font-bold text-amber-300 shrink-0">{v.distance_m !== null ? `${nbFmt.format(Math.round(v.distance_m))} m` : "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Glass>
    </motion.div>
  )
}

// ─── Tid & tempo (Arbeidstid session-hours + Tempo pace) ──────────────────────
function WorkTimeHistogram({ work }: { work: WorkTimeStats }) {
  const reduced = useReducedMotion()
  const [group, setGroup] = useState<"employees" | "managers">("employees")
  const thrMinRaw = (work.active_threshold_seconds ?? 900) / 60
  const thr = thrMinRaw > 0 && thrMinRaw < 60 ? thrMinRaw : 15
  const thrLabel = Number.isInteger(thr) ? `${thr}` : thr.toFixed(0)

  const buckets = useMemo(() => {
    const people = group === "employees" ? work.employees : work.managers
    const defs: { label: string; test: (v: number) => boolean; inactive: boolean }[] = [
      { label: "0m", test: v => v <= 0, inactive: true },
      { label: `<${thrLabel}m`, test: v => v > 0 && v < thr, inactive: true },
      { label: `${thrLabel}–60m`, test: v => v >= thr && v < 60, inactive: false },
      { label: "1–2t", test: v => v >= 60 && v < 120, inactive: false },
      { label: "2t+", test: v => v >= 120, inactive: false },
    ]
    const out = defs.map(def => ({ ...def, count: 0 }))
    people.forEach(p => { const v = p.avg_daily_minutes ?? 0; const b = out.find(o => o.test(v)); if (b) b.count++ })
    return out
  }, [work, group, thr, thrLabel])

  const total = buckets.reduce((a, b) => a + b.count, 0)
  const max = Math.max(...buckets.map(b => b.count), 1)

  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white">Fordeling av arbeidstid</h3>
        <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
          {(["employees", "managers"] as const).map(gk => (
            <button key={gk} onClick={() => setGroup(gk)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-all", group === gk ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{gk === "employees" ? "Ansatte" : "Ledere"}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-white/45 mb-4">Antall {group === "employees" ? "ansatte" : "ledere"} etter snitt arbeidstid per dag · aktiv-terskel {thrLabel}m</p>
      {total === 0 ? <PanelEmpty msg="Ingen arbeidstid registrert i dette tidsrommet" sub="Arbeidstid krever sporing via GPS-økter. Velg et tidsrom der øktene finnes." /> : (
        <div className="space-y-2.5">
          {buckets.map((b, i) => {
            const pct = (b.count / max) * 100, sharePct = total ? (b.count / total) * 100 : 0
            const color = b.inactive ? "#f43f5e" : "#10b981"
            return (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-right font-mono text-xs text-white/45">{b.label}</span>
                <div className="relative flex-1 h-6 rounded-lg bg-white/[0.04] overflow-hidden"><motion.div className="h-full rounded-lg" style={{ background: `${color}cc` }} initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: i * 0.04 }} /></div>
                <span className="w-20 shrink-0 flex items-baseline justify-end gap-1.5"><span className="font-mono text-sm font-semibold text-white/90">{b.count}</span><span className="font-mono text-[11px] text-white/35">{sharePct.toFixed(0)}%</span></span>
              </div>
            )
          })}
          <div className="flex items-center gap-4 pt-2 text-[11px] text-white/40 border-t border-white/8 mt-1">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#f43f5e" }} /> Under aktiv-terskel</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#10b981" }} /> Aktiv</span>
          </div>
        </div>
      )}
    </Glass>
  )
}

function TidTempoTab({ work, campaignSelected, pace, paceLoading, effDate }: { work: WorkTimeStats | null; campaignSelected: boolean; pace: PaceRow[] | null; paceLoading: boolean; effDate: string }) {
  const w = work?.aggregate
  const people = useMemo(() => [...(work?.employees ?? []), ...(work?.managers ?? [])].sort((a, b) => b.total_minutes - a.total_minutes).slice(0, 50), [work])
  const groups = w ? [
    { label: "Ansatte", g: w.employees, color: "#3b82f6" },
    { label: "Ledere", g: w.managers, color: "#8b5cf6" },
    { label: "Totalt", g: w.combined, color: "#10b981" },
  ] : []

  const paceRows = useMemo(() => [...(pace ?? [])].sort((a, b) => a.doors_knocked - b.doors_knocked), [pace])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* ── Arbeidstid (session hours) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Arbeidstid</h2>
          <span className="flex items-center gap-1 text-[11px] text-white/40"><Info className="h-3 w-3" /> Basert på GPS-økter — mindre presis enn dørtellinger</span>
        </div>
        {!work || !w ? (
          <Glass className="p-5"><PanelEmpty msg="Ingen arbeidstid registrert i dette tidsrommet" sub="Arbeidstid spores via GPS-økter (work_time_rollup). Velg et tidsrom der øktene finnes." /></Glass>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {groups.map(({ label, g, color }) => (
                <div key={label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                  <RingGauge pct={g.active_pct} color={color} center={`${Math.round(g.active_pct)}%`} sub="aktive" />
                  <div><p className="text-xs text-white/40 font-medium">{label}</p><p className="font-mono text-2xl font-bold text-white">{g.active_count}<span className="text-sm text-white/35"> / {g.total}</span></p><p className="text-xs text-white/40 mt-0.5">snitt {fmtMin(g.avg_daily_minutes)}/dag</p></div>
                </div>
              ))}
            </div>
            <WorkTimeHistogram work={work} />
            <Glass className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Mest aktive (arbeidstid)</h3>
              {people.length === 0 ? <PanelEmpty msg="Ingen arbeidstid registrert" /> : (
                <div className="divide-y divide-white/5">
                  {people.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2.5"><span className={cn("h-2 w-2 rounded-full", p.is_active ? "bg-emerald-500" : "bg-white/20")} /><span className="text-sm text-white/85">{p.name}</span></div>
                      <div className="flex items-center gap-4 text-right"><span className="font-mono text-sm text-white/70">{fmtMin(p.total_minutes)}</span><span className="font-mono text-xs text-white/35 w-20">{fmtMin(p.avg_daily_minutes)}/dag</span></div>
                    </div>
                  ))}
                </div>
              )}
            </Glass>
          </>
        )}
      </div>

      {/* ── Tempo (pace) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">Tempo</h2>
          <span className="flex items-center gap-1 text-[11px] text-white/40"><Info className="h-3 w-3" /> Dører per aktiv time (første→siste knock){effDate ? ` · ${new Date(effDate).toLocaleDateString("nb-NO", { day: "numeric", month: "long" })}` : ""}</span>
        </div>
        {!campaignSelected ? (
          <Glass className="p-5"><PanelEmpty msg="Velg en kampanje" sub="Tempo beregnes per kampanje eller team. Velg en kampanje øverst for å se dører/time." /></Glass>
        ) : paceLoading ? (
          <Glass className="p-5"><PanelLoading label="Laster tempo…" /></Glass>
        ) : !paceRows.length ? (
          <Glass className="p-5"><PanelEmpty msg="Ingen tempodata for valgt dag" /></Glass>
        ) : (
          <Glass className="p-5">
            <div className="overflow-x-auto"><div className="min-w-[720px]">
              <div className="grid grid-cols-[1.6fr_80px_90px_110px_90px_90px] gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                <span>Selger</span><span className="text-right">Dører</span><span className="text-right">Dører/time</span><span className="text-right">Aktivt vindu</span><span className="text-right">Snitt</span><span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-white/5">
                {paceRows.map(p => (
                  <div key={`${p.employee_id}-${p.person_kind}`} className="grid grid-cols-[1.6fr_80px_90px_110px_90px_90px] gap-3 items-center px-3 py-2.5">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0" style={{ background: p.person_kind === "manager" ? "#8b5cf622" : "#3b82f622", color: p.person_kind === "manager" ? "#a78bfa" : "#60a5fa" }}>{p.person_kind === "manager" ? "Leder" : "Ansatt"}</span>
                      <div className="min-w-0"><p className="text-sm font-medium text-white/90 truncate">{p.name}</p><p className="text-[10px] text-white/35">{fmtClock(p.first_knock_at)}–{fmtClock(p.last_knock_at)}</p></div>
                    </div>
                    <span className="text-right font-mono text-sm text-white/80">{p.doors_knocked}</span>
                    <span className="text-right font-mono text-sm" style={{ color: "#06b6d4" }}>{p.pace_doors_per_hour !== null ? nf1(p.pace_doors_per_hour) : "—"}</span>
                    <span className="text-right font-mono text-sm text-white/60">{p.active_window_minutes > 0 ? fmtMin(p.active_window_minutes) : "—"}</span>
                    <span className="text-right font-mono text-sm text-white/60">{p.personal_average !== null ? nf1(p.personal_average) : "—"}</span>
                    <div className="flex justify-end">
                      {p.is_alert ? <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">avvik ×{p.streak_len}</span>
                        : p.below_company_standard_today ? <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">under std</span>
                          : <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">ok</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div></div>
          </Glass>
        )}
      </div>
    </motion.div>
  )
}

// ─── Email report modal (admin) ──────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function EmailReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [raw, setRaw] = useState("")
  const [sending, setSending] = useState(false)
  useEffect(() => { if (open) { setRaw(""); setSending(false) } }, [open])

  const emails = useMemo(() => Array.from(new Set(raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean))), [raw])
  const allValid = emails.length > 0 && emails.every(e => EMAIL_RE.test(e))

  const submit = async () => {
    if (!allValid || sending) return
    setSending(true)
    try {
      const res = await triggerAnalyticsEmail(emails)
      toast({ title: "Rapport sendt", description: res.message || "Rapporten ble generert og sendt." })
      onClose()
    } catch (e) {
      toast({ title: "Sending feilet", description: e instanceof Error ? e.message : "Ukjent feil", variant: "destructive" })
    } finally { setSending(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16 }} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0d1528] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8"><h2 className="text-lg font-bold text-white">Send ukentlig rapport</h2><button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8"><X className="h-4 w-4" /></button></div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-white/55">Genererer rapporten for <span className="text-white/80 font-medium">siste 7 dager</span> og sender den som PDF på e-post.</p>
              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Mottaker-e-poster</label>
                <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={3} autoFocus placeholder="navn@firma.no, leder@firma.no" className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 resize-none" />
                <p className="mt-1.5 text-[11px] text-white/35">Skill flere adresser med komma eller mellomrom.</p>
                {emails.length > 0 && !allValid && <p className="mt-1 text-[11px] text-rose-400">Én eller flere e-postadresser er ugyldige.</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
              <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8">Avbryt</button>
              <button onClick={submit} disabled={!allValid || sending} className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">{sending && <Loader2 className="h-4 w-4 animate-spin" />} Send rapport</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Terskler (live thresholds CRUD) ────────────────────────────────────────────
const THRESHOLD_SCOPES: { value: ThresholdScope; label: string }[] = [
  { value: "global", label: "Global (alle)" }, { value: "manager", label: "Leder" },
  { value: "campaign", label: "Kampanje" }, { value: "employee", label: "Ansatt" },
]
// Grouped threshold fields (VOLUM / RATER / TID / AVVIK) — colored bullets per the design.
type TField = { key: keyof CreateThresholdData; label: string; ph?: string }
const TERSKEL_GROUPS: { label: string; color: string; fields: TField[] }[] = [
  { label: "Volum", color: "#3b82f6", fields: [
    { key: "min_doors_per_day", label: "Min dører/dag", ph: "70" },
    { key: "min_doors_per_week", label: "Min dører/uke" },
  ] },
  { label: "Rater", color: "#10b981", fields: [
    { key: "min_yes_rate_percent", label: "Min ja %", ph: "30" },
    { key: "max_no_rate_percent", label: "Maks nei %" },
    { key: "min_contact_rate_percent", label: "Min kontakt %" },
    { key: "performance_drop_alert_percent", label: "Ytelsesfall %" },
  ] },
  { label: "Tid", color: "#8b5cf6", fields: [
    { key: "consecutive_days_threshold", label: "Sammenhengende dager", ph: "3" },
    { key: "max_inactive_hours", label: "Maks inaktive timer" },
  ] },
  { label: "Avvik (personlig baseline)", color: "#06b6d4", fields: [
    { key: "baseline_window_days", label: "Baseline-vindu (dager)", ph: "10" },
    { key: "min_history_days", label: "Min. historikk (dager)", ph: "5" },
    { key: "normal_variation_band_pct", label: "Normal variasjon %", ph: "20" },
    { key: "deviation_threshold_pct", label: "Avviksgrense %", ph: "35" },
  ] },
]
const ALL_TERSKEL_FIELDS: TField[] = TERSKEL_GROUPS.flatMap(g => g.fields)

function TersklerTab({ campaigns, data }: { campaigns: { id: string; name: string; color: string }[]; data: AnalyticsPreview | null }) {
  const { toast } = useToast()
  const [items, setItems] = useState<Threshold[] | null>(null)
  const [errored, setErrored] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<Threshold | null>(null)

  const load = useCallback(() => {
    setErrored(false)
    analyticsService.getThresholds()
      .then((res: unknown) => setItems(Array.isArray(res) ? res as Threshold[] : ((res as { results?: Threshold[] })?.results ?? [])))
      .catch(() => { setErrored(true); setItems([]) })
  }, [])
  useEffect(() => { load() }, [load])

  const remove = async (id: string) => {
    setBusy(id)
    try { await analyticsService.deleteThreshold(id); toast({ title: "Terskel slettet" }); if (editing?.id === id) setEditing(null) }
    catch (e) { toast({ title: "Sletting feilet", description: e instanceof Error ? e.message : "", variant: "destructive" }) }
    setBusy(null); load()
  }
  const toggleActive = async (t: Threshold) => {
    setBusy(t.id)
    try { await analyticsService.updateThreshold(t.id, { is_active: !t.is_active }) } catch { /* ignore */ }
    setBusy(null); load()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
      {/* Left — list / empty state */}
      <Glass className="p-5">
        <div className="mb-4"><h3 className="text-sm font-semibold text-white">Terskler ({items?.length ?? 0})</h3><span className="text-xs text-white/35">Mest spesifikke vinner: ansatt › kampanje › leder › global</span></div>
        {items === null ? <PanelLoading label="Laster terskler…" /> : errored ? <PanelError onRetry={load} /> : items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 flex flex-col items-center text-center">
            <div className="h-11 w-11 rounded-xl bg-white/5 flex items-center justify-center mb-3"><SlidersHorizontal className="h-5 w-5 text-white/40" /></div>
            <p className="text-sm font-semibold text-white/80">Ingen egendefinerte terskler</p>
            <p className="text-xs text-white/40 mb-4">Systemet bruker standardverdier inntil du legger til egne.</p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center"><p className="text-[10px] uppercase tracking-wider text-white/35">Standard dører/dag</p><p className="font-mono text-2xl font-bold text-white">70</p></div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center"><p className="text-[10px] uppercase tracking-wider text-white/35">Standard ja-rate</p><p className="font-mono text-2xl font-bold text-white">30 %</p></div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map(t => (
              <div key={t.id} className={cn("flex items-center gap-2 px-2 py-2.5 rounded-lg", editing?.id === t.id && "bg-white/[0.05]")}>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-white/90 truncate">{t.target_name || (t.scope === "campaign" ? (campaigns.find(c => c.id === t.campaign_id)?.name ?? "Kampanje") : t.scope === "manager" ? "Leder" : t.scope === "employee" ? "Ansatt" : "Global (alle)")}</p><p className="text-[10px] uppercase tracking-wider text-white/35">{t.scope} · {t.min_doors_per_day} d/dag · {t.min_yes_rate_percent}% ja</p></div>
                <button onClick={() => toggleActive(t)} disabled={busy === t.id} className={cn("cursor-pointer relative h-5 w-9 rounded-full transition-colors shrink-0", t.is_active ? "bg-emerald-600" : "bg-white/15")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", t.is_active ? "translate-x-4" : "translate-x-0.5")} /></button>
                <button onClick={() => setEditing(t)} disabled={busy === t.id} className="cursor-pointer h-7 w-7 inline-flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 shrink-0"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(t.id)} disabled={busy === t.id} className="cursor-pointer h-7 w-7 inline-flex items-center justify-center rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 shrink-0">{busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>
              </div>
            ))}
          </div>
        )}
      </Glass>

      {/* Right — always-visible inline form (keyed to reset on edit target change) */}
      <TerskelForm key={editing?.id ?? "new"} editing={editing} campaigns={campaigns} employees={data?.employees ?? []}
        onCancelEdit={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
    </motion.div>
  )
}

// ─── Inline threshold form (VOLUM / RATER / TID / AVVIK) ──────────────────────
function TerskelForm({ editing, campaigns, employees, onCancelEdit, onSaved }: {
  editing: Threshold | null
  campaigns: { id: string; name: string; color: string }[]
  employees: AnEmployee[]
  onCancelEdit: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const [scope, setScope] = useState<ThresholdScope>(editing?.scope ?? "global")
  const [target, setTarget] = useState<string>(editing ? (editing.manager_id || editing.campaign_id || editing.employee_id || "") : "")
  const [nums, setNums] = useState<Record<string, string>>(() => editing
    ? Object.fromEntries(ALL_TERSKEL_FIELDS.map(f => [f.key, String((editing as unknown as Record<string, unknown>)[f.key as string] ?? "")]))
    : {})
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)
  const [people, setPeople] = useState<{ id: string; name: string; user_type: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (scope !== "manager" && scope !== "employee") return
    let cancelled = false
    import("@/lib/api/users").then(({ fetchAssignable }) => fetchAssignable())
      .then(res => { if (!cancelled) setPeople(res.results.map(u => ({ id: u.id, name: u.name || u.username, user_type: u.user_type }))) })
      .catch(() => { if (!cancelled) setPeople([]) })
    return () => { cancelled = true }
  }, [scope])

  const targetOptions = useMemo(() => {
    if (scope === "campaign") return campaigns.map(c => ({ id: c.id, name: c.name }))
    if (scope === "manager") return people.filter(p => p.user_type === "manager" || p.user_type === "superuser" || p.user_type === "admin")
    if (scope === "employee") return people.filter(p => p.user_type === "employee")
    return []
  }, [scope, campaigns, people])

  const needsTarget = scope !== "global"
  const valid = !needsTarget || !!target

  const preview = useMemo(() => {
    const md = Number(nums["min_doors_per_day"]) || 0
    const mj = Number(nums["min_yes_rate_percent"]) || 0
    if (!md && !mj) return null
    let kritisk = 0, advarsel = 0
    for (const e of employees) {
      const critical = (md && e.doors_per_day < md * 0.5) || (mj && e.yes_rate < mj * 0.4)
      const warn = (md && e.doors_per_day < md) || (mj && e.yes_rate < mj)
      if (critical) kritisk++
      else if (warn) advarsel++
    }
    return { kritisk, advarsel }
  }, [nums, employees])

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    const payload: CreateThresholdData = { scope, is_active: isActive }
    if (scope === "manager") payload.manager_id = target
    if (scope === "campaign") payload.campaign_id = target
    if (scope === "employee") payload.employee_id = target
    ALL_TERSKEL_FIELDS.forEach(f => { const v = nums[f.key as string]; if (v !== undefined && v !== "") (payload as unknown as Record<string, unknown>)[f.key as string] = Number(v) })
    try {
      if (editing) await analyticsService.updateThreshold(editing.id, payload)
      else await analyticsService.createThreshold(payload)
      toast({ title: editing ? "Terskel oppdatert" : "Terskel opprettet" })
      onSaved()
    } catch (e) {
      toast({ title: "Lagring feilet", description: e instanceof Error ? e.message : "Ukjent feil", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const NumInput = ({ f }: { f: TField }) => (
    <div>
      <label className="block text-xs font-medium text-white/45 mb-1.5">{f.label}</label>
      <input type="number" min={0} value={nums[f.key as string] ?? ""} onChange={e => setNums(n => ({ ...n, [f.key as string]: e.target.value }))} placeholder={f.ph ?? "—"} className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50" />
    </div>
  )

  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{editing ? "Rediger terskel" : "Ny terskel"}</h3>
        {editing && <button onClick={onCancelEdit} className="cursor-pointer text-xs font-medium text-white/45 hover:text-white">+ Ny i stedet</button>}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Omfang</label>
            <select value={scope} onChange={e => { setScope(e.target.value as ThresholdScope); setTarget("") }} disabled={!!editing} className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50 disabled:opacity-50 [color-scheme:dark]">{THRESHOLD_SCOPES.map(s => <option key={s.value} value={s.value} className="bg-[#0d1528]">{s.label}</option>)}</select>
          </div>
          {needsTarget && (
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">Mål</label>
              <select value={target} onChange={e => setTarget(e.target.value)} className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]"><option value="" className="bg-[#0d1528]">Velg…</option>{targetOptions.map(o => <option key={o.id} value={o.id} className="bg-[#0d1528]">{o.name}</option>)}</select>
            </div>
          )}
        </div>
        {TERSKEL_GROUPS.map(g => (
          <div key={g.label}>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />{g.label}</p>
            <div className="grid grid-cols-2 gap-3">{g.fields.map(f => <NumInput key={f.key as string} f={f} />)}</div>
          </div>
        ))}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5 text-xs text-white/55 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-white/30 mt-0.5" />
          {preview
            ? <span>Med disse verdiene ville <span className="font-semibold text-rose-300">~{preview.kritisk} kritiske</span> · <span className="font-semibold text-amber-300">~{preview.advarsel} advarsler</span> utløses (av {employees.length} ansatte i valgt periode).</span>
            : <span>Fyll inn verdier for å se estimert antall varsler.</span>}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <button type="button" onClick={() => setIsActive(a => !a)} className={cn("relative h-5 w-9 rounded-full transition-colors", isActive ? "bg-emerald-600" : "bg-white/15")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", isActive ? "translate-x-4" : "translate-x-0.5")} /></button>
            <span className="text-sm text-white/70">Aktiv</span>
          </label>
          <button onClick={submit} disabled={!valid || saving} className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Lagre terskel" : "Lagre terskel"}</button>
        </div>
      </div>
    </Glass>
  )
}

export default AnalyticsView
