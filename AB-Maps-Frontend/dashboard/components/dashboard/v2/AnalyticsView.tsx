"use client"

/**
 * Analytics — LIVE (/api/dashboard/analytics/). Tabs: Oversikt · Ansatte ·
 * Kampanjer · Varsler · Arbeidstid · Terskler. Driven by the analytics `preview`
 * + `work-time-stats` endpoints and the thresholds CRUD. No mock data.
 * Note: the preview endpoint caps the date range at 90 days.
 */

import { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import {
  TrendingUp, TrendingDown, DoorOpen, Users, Percent, Clock, AlertCircle,
  ChevronDown, Trophy, Flame, Target, Sparkles, Activity, Trash2, Plus, X, Check, Loader2,
  Download, Send, Pencil, CalendarDays,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoyMascot, MOOD_TO_ROY, type RoyState } from "@/components/gamification/RoyMascot"
import { computeMood } from "@/components/gamification/lib/mood"
import {
  fetchAnalyticsPreview, fetchWorkTimeStats, fmtMin, downloadAnalyticsPdf, triggerAnalyticsEmail,
  type AnalyticsPreview, type WorkTimeStats, type AnEmployee, type AnCampaign, type AnAlert,
  type NeiBreakdown,
} from "@/lib/api/analytics"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"
import { useAuth } from "@/lib/auth/AuthContext"
import { useToast } from "@/hooks/use-toast"
import {
  analyticsService, type Threshold, type ThresholdScope, type CreateThresholdData,
} from "@/services/analyticsService"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

const nbFmt = new Intl.NumberFormat("nb-NO")
const STATUS = [
  { key: "ja" as const, label: "Ja", color: "#10b981" },
  { key: "nei" as const, label: "Nei", color: "#f43f5e" },
  { key: "ikke_hjemme" as const, label: "Ikke hjemme", color: "#f59e0b" },
  { key: "folg_opp" as const, label: "Følg opp", color: "#8b5cf6" },
]
const ymd = (d: Date) => d.toISOString().slice(0, 10)
// Anchor the analytics window. On production this is today (live data).
// On dev, the seeded door-knock data ends 2026-03-19, so any window relative to
// the real "today" is empty — set NEXT_PUBLIC_ANALYTICS_ANCHOR_DATE=2026-03-19
// (YYYY-MM-DD) to anchor the window to a date that overlaps the seed data.
const anchorEnv = process.env.NEXT_PUBLIC_ANALYTICS_ANCHOR_DATE
const anchorDate = () => (anchorEnv && /^\d{4}-\d{2}-\d{2}$/.test(anchorEnv) ? new Date(`${anchorEnv}T00:00:00Z`) : new Date())
const daysAgo = (n: number) => { const d = anchorDate(); d.setDate(d.getDate() - n); return ymd(d) }

const RANGES = [
  { d: 7, label: "7 dager" }, { d: 14, label: "14 dager" },
  { d: 30, label: "30 dager" }, { d: 90, label: "90 dager" },
]

// Mascot mood for an employee from their live ja-rate + volume (approximation —
// the analytics API doesn't expose rank/tenure).
function empRoy(e: AnEmployee): RoyState {
  const m = computeMood({ jaProsent: e.yes_rate, dorerPerDag: e.doors_per_day, minJaProsent: 3, minDorerPerDag: 70, rankPercentile: 50, daysOnPlatform: 90 })
  return MOOD_TO_ROY[m.mood]
}

function Glass({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  return <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={cn("rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl", className)}>{children}</motion.div>
}

function KpiTile({ label, value, deltaPct, color, Icon }: { label: string; value: string; deltaPct?: number; color: string; Icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 font-medium">{label}</span>
        <div className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ background: `${color}22` }}><Icon className="h-3.5 w-3.5" style={{ color }} /></div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-mono text-2xl font-bold text-white">{value}</p>
        {deltaPct !== undefined && Number.isFinite(deltaPct) && (
          <span className={cn("flex items-center gap-0.5 text-xs font-semibold", deltaPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(Math.round(deltaPct))}%
          </span>
        )}
      </div>
    </div>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-0.5 h-7">
      {data.map((v, i) => <div key={i} className="w-1 rounded-sm" style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: color, opacity: 0.5 + (i / Math.max(1, data.length)) * 0.5 }} />)}
    </div>
  )
}

type Tab = "oversikt" | "ansatte" | "kampanjer" | "varsler" | "arbeidstid" | "terskler"

export function AnalyticsView() {
  const reduced = useReducedMotion()
  const { campaignId: globalCampaignId } = useSelectedCampaign()
  const { isAdmin } = useAuth()
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
        if (!p || !p.summary) { setErrored(true); return } // partial response (e.g. range rejected)
        setData(p); setWork(w)
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [startStr, endStr, campaignId, tooLong])
  // Debounced — custom date inputs change start then end in quick succession.
  useEffect(() => { const t = setTimeout(() => { void load() }, 300); return () => clearTimeout(t) }, [load])

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
    { key: "arbeidstid", label: "Arbeidstid" },
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
            <p className="text-xs uppercase tracking-widest text-white/30 mb-1">Analyse · Observabilitet</p>
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
          <TersklerTab campaigns={campaigns} />
        ) : loading ? (
          <Glass className="min-h-[300px]"><PanelLoading label="Laster analyse…" /></Glass>
        ) : errored ? (
          <Glass className="min-h-[300px]"><PanelError onRetry={() => void load()} /></Glass>
        ) : !data || data.summary.total_doors === 0 ? (
          <Glass className="min-h-[300px]"><PanelEmpty msg="Ingen aktivitet i perioden" sub="Prøv et annet datovindu eller kampanje." /></Glass>
        ) : (
          <AnimatePresence mode="wait">
            {tab === "oversikt" && <OversiktTab key="o" d={data} />}
            {tab === "ansatte" && <AnsatteTab key="a" d={data} />}
            {tab === "kampanjer" && <KampanjerTab key="k" d={data} />}
            {tab === "varsler" && <VarslerTab key="v" d={data} />}
            {tab === "arbeidstid" && <ArbeidstidTab key="w" work={work} d={data} />}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

// ─── Oversikt ─────────────────────────────────────────────────────────────────
function OversiktTab({ d }: { d: AnalyticsPreview }) {
  const s = d.summary, c = d.comparisons
  const chart = d.daily_breakdown.map(x => ({ label: new Date(x.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }), ja: x.ja, nei: x.nei, ikke_hjemme: x.ikke_hjemme }))
  const donut = STATUS.map(st => ({ ...st, value: (s as any)[st.key] as number }))
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Totale dører" value={nbFmt.format(s.total_doors)} deltaPct={c.total_doors.change_pct} color="#3b82f6" Icon={DoorOpen} />
        <KpiTile label="Ja-rate" value={`${s.yes_rate.toFixed(1)}%`} deltaPct={c.yes_rate.change_pct} color="#10b981" Icon={Percent} />
        <KpiTile label="Kontaktrate" value={`${s.contact_rate.toFixed(1)}%`} deltaPct={c.contact_rate.change_pct} color="#8b5cf6" Icon={Users} />
        <KpiTile label="Dører / dag" value={s.doors_per_day.toFixed(1)} deltaPct={c.doors_per_day.change_pct} color="#f59e0b" Icon={Activity} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <Glass className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Aktivitet per dag</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>{STATUS.slice(0, 3).map(st => <linearGradient key={st.key} id={`ag-${st.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={st.color} stopOpacity={0.5} /><stop offset="100%" stopColor={st.color} stopOpacity={0.05} /></linearGradient>)}</defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0d1528", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12 }} />
              {STATUS.slice(0, 3).map(st => <Area key={st.key} type="monotone" dataKey={st.key} stackId="1" stroke={st.color} fill={`url(#ag-${st.key})`} strokeWidth={2} />)}
            </AreaChart>
          </ResponsiveContainer>
        </Glass>
        <Glass className="p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-2">Statusfordeling</h3>
          <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart><Pie data={donut} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value">{donut.map(x => <Cell key={x.key} fill={x.color} />)}</Pie>
              <Tooltip contentStyle={{ background: "#0d1528", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12 }} /></PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-xl font-bold text-white">{nbFmt.format(s.total_doors)}</span><span className="text-[10px] text-white/40">dører</span></div>
          </div>
          <div className="mt-3 space-y-1.5">
            {donut.map(x => <div key={x.key} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-white/60"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />{x.label}</span><span className="font-mono text-white/70">{nbFmt.format(x.value)}</span></div>)}
          </div>
        </Glass>
      </div>
    </motion.div>
  )
}

// ─── Ansatte ──────────────────────────────────────────────────────────────────
function AnsatteTab({ d }: { d: AnalyticsPreview }) {
  const rows = useMemo(() => [...d.employees].sort((a, b) => b.total_doors - a.total_doors), [d.employees])
  if (rows.length === 0) return <Glass className="min-h-[200px]"><PanelEmpty msg="Ingen ansatte i perioden" /></Glass>
  return (
    <Glass className="p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Ansatte ({rows.length})</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.6fr_70px_70px_70px_80px_80px] gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
            <span>Ansatt</span><span className="text-right">Dører</span><span className="text-right">D/dag</span><span className="text-right">Ja %</span><span className="text-right">Kontakt %</span><span className="text-right">Trend</span>
          </div>
          <div className="divide-y divide-white/5">
            {rows.map(e => {
              const trend = Object.values(e.daily_door_counts ?? {})
              return (
                <div key={e.employee_id} className="grid grid-cols-[1.6fr_70px_70px_70px_80px_80px] gap-3 items-center px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RoyMascot state={empRoy(e)} size={30} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">{e.employee_name}</p>
                      <p className="text-[10px] text-white/35">{e.worker_type === "manager" ? "Leder" : "Ansatt"} · konsist. {Math.round(e.consistency_score)}%</p>
                    </div>
                  </div>
                  <span className="text-right font-mono text-sm text-white/80">{nbFmt.format(e.total_doors)}</span>
                  <span className="text-right font-mono text-sm text-white/60">{e.doors_per_day.toFixed(1)}</span>
                  <span className="text-right font-mono text-sm" style={{ color: e.yes_rate >= 3 ? "#10b981" : "#f43f5e" }}>{e.yes_rate.toFixed(1)}</span>
                  <span className="text-right font-mono text-sm text-white/60">{e.contact_rate.toFixed(0)}</span>
                  <div className="flex justify-end">{trend.length ? <Sparkline data={trend} color="#3b82f6" /> : <span className="text-white/20 text-xs">—</span>}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Glass>
  )
}

// ─── Nei-årsaker (Talkmore) ───────────────────────────────────────────────────
// Talkmore campaigns return a rejection-reason breakdown (campaign.nei_breakdown).
const NEI_REASON_LABELS: Record<keyof NeiBreakdown, string> = {
  bedrift: "Bedrift",
  pris: "Pris",
  ikke_interessert: "Ikke interessert",
  bindingstid: "Bindingstid",
  darlig_erfaring: "Dårlig erfaring",
  eksisterende_kunde: "Eksisterende kunde",
  unspecified: "Uspesifisert",
}

function NeiReasonsPanel({ campaignName, breakdown }: { campaignName: string; breakdown: NeiBreakdown }) {
  const reduced = useReducedMotion()
  const rows = useMemo(() => {
    const entries = (Object.keys(NEI_REASON_LABELS) as (keyof NeiBreakdown)[])
      .map(k => ({ key: k, label: NEI_REASON_LABELS[k], count: breakdown[k] ?? 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
    const total = entries.reduce((a, r) => a + r.count, 0)
    return { entries, total }
  }, [breakdown])

  return (
    <Glass className="p-5" delay={0.05}>
      <h3 className="text-sm font-semibold text-white">Nei-årsaker ({campaignName})</h3>
      <p className="text-xs text-white/45 mb-4">Fordeling av avslag etter årsak</p>
      {rows.total === 0 ? (
        <PanelEmpty msg="Ingen registrerte nei-årsaker i perioden" />
      ) : (
        <div className="space-y-3">
          {rows.entries.map((r, i) => {
            const pct = (r.count / rows.total) * 100
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/85">{r.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-sm text-white/50">{r.count}</span>
                    <span className="font-mono text-sm font-semibold text-white/90 w-12 text-right">{pct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <motion.div className="h-full rounded-full" style={{ background: "#f43f5e" }}
                    initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: i * 0.04 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Glass>
  )
}

// ─── Kampanjer ────────────────────────────────────────────────────────────────
function KampanjerTab({ d }: { d: AnalyticsPreview }) {
  type K = keyof Pick<AnCampaign, "total_doors" | "yes_rate" | "no_rate" | "contact_rate" | "num_employees">
  const [sort, setSort] = useState<K>("total_doors")
  const rows = useMemo(() => [...d.campaigns].sort((a, b) => (b[sort] as number) - (a[sort] as number)), [d.campaigns, sort])
  const talkmore = useMemo(() => d.campaigns.filter(c => c.is_talkmore && c.nei_breakdown), [d.campaigns])
  if (rows.length === 0) return <Glass className="min-h-[200px]"><PanelEmpty msg="Ingen kampanjeaktivitet i perioden" /></Glass>
  const Th = ({ k, label }: { k: K; label: string }) => <button onClick={() => setSort(k)} className={cn("cursor-pointer text-right text-[10px] font-bold uppercase tracking-wider", sort === k ? "text-blue-400" : "text-white/35 hover:text-white/60")}>{label}</button>
  return (
    <div className="space-y-5">
      <Glass className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Kampanjer ({rows.length})</h3>
        <div className="grid grid-cols-[1.6fr_80px_70px_70px_80px_70px] gap-3 px-3 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Kampanje</span>
          <Th k="total_doors" label="Dører" /><Th k="yes_rate" label="Ja %" /><Th k="no_rate" label="Nei %" /><Th k="contact_rate" label="Kontakt %" /><Th k="num_employees" label="Ansatte" />
        </div>
        <div className="divide-y divide-white/5">
          {rows.map(c => (
            <div key={c.campaign_id} className="grid grid-cols-[1.6fr_80px_70px_70px_80px_70px] gap-3 items-center px-3 py-2.5">
              <span className="text-sm font-medium text-white/90 truncate flex items-center gap-2">
                {c.campaign_name}
                {c.is_talkmore && <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">Talkmore</span>}
              </span>
              <span className="text-right font-mono text-sm text-white/80">{nbFmt.format(c.total_doors)}</span>
              <span className="text-right font-mono text-sm text-emerald-400">{c.yes_rate.toFixed(1)}</span>
              <span className="text-right font-mono text-sm text-white/60">{c.no_rate.toFixed(1)}</span>
              <span className="text-right font-mono text-sm text-white/60">{c.contact_rate.toFixed(0)}</span>
              <span className="text-right font-mono text-sm text-white/70">{c.num_employees}</span>
            </div>
          ))}
        </div>
      </Glass>

      {/* Talkmore-only rejection-reason breakdown */}
      {talkmore.map(c => (
        <NeiReasonsPanel key={c.campaign_id} campaignName={c.campaign_name} breakdown={c.nei_breakdown!} />
      ))}
    </div>
  )
}

// ─── Varsler ──────────────────────────────────────────────────────────────────
const ALERT_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  low_yes_rate: { label: "Lav ja-rate", Icon: TrendingDown, color: "#f43f5e" },
  low_doors_per_day: { label: "Få dører per dag", Icon: DoorOpen, color: "#f59e0b" },
}
function VarslerTab({ d }: { d: AnalyticsPreview }) {
  const [sev, setSev] = useState<"alle" | "critical" | "warning">("alle")
  const filtered = d.alerts.filter(a => sev === "alle" || a.severity === sev)
  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Varsler ({d.alerts.length})</h3>
        <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
          {(["alle", "critical", "warning"] as const).map(s => (
            <button key={s} onClick={() => setSev(s)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all", sev === s ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{s === "alle" ? "Alle" : s === "critical" ? "Kritisk" : "Advarsel"}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? <PanelEmpty msg="Ingen varsler" sub="Alt innenfor terskel." /> : (
        <div className="space-y-2.5">
          {filtered.map((a: AnAlert, i) => {
            const meta = ALERT_META[a.alert_type] ?? { label: a.alert_type, Icon: AlertCircle, color: "#f59e0b" }
            const sevColor = a.severity === "critical" ? "#f43f5e" : "#f59e0b"
            const trend = (a.daily_details ?? []).map(x => x.value)
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="h-9 w-9 flex items-center justify-center rounded-lg shrink-0" style={{ background: `${meta.color}1f` }}><meta.Icon className="h-4 w-4" style={{ color: meta.color }} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white/90 truncate">{a.employee_name}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${sevColor}22`, color: sevColor }}>{a.severity === "critical" ? "Kritisk" : "Advarsel"}</span>
                    <span className="text-[11px] text-white/35">{meta.label}</span>
                  </div>
                  <p className="text-xs text-white/45 truncate mt-0.5">{a.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold" style={{ color: sevColor }}>{a.current_value}<span className="text-white/30 text-xs"> / {a.threshold_value}</span></p>
                </div>
                {trend.length > 0 && <div className="shrink-0"><Sparkline data={trend} color={sevColor} /></div>}
              </motion.div>
            )
          })}
        </div>
      )}
    </Glass>
  )
}

// ─── Arbeidstid ───────────────────────────────────────────────────────────────
// Distribution of avg daily work time across people, bucketed; buckets at/below
// the active threshold are flagged so the admin sees how many barely log in.
function WorkTimeHistogram({ work }: { work: WorkTimeStats }) {
  const reduced = useReducedMotion()
  const [group, setGroup] = useState<"employees" | "managers">("employees")
  const thrMinRaw = (work.active_threshold_seconds ?? 900) / 60
  const thr = thrMinRaw > 0 && thrMinRaw < 60 ? thrMinRaw : 15
  const thrLabel = Number.isInteger(thr) ? `${thr}` : thr.toFixed(0)

  const buckets = useMemo(() => {
    const people = group === "employees" ? work.employees : work.managers
    // [label, test, inactive(below active threshold)]
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
            <button key={gk} onClick={() => setGroup(gk)} className={cn("cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-all", group === gk ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>
              {gk === "employees" ? "Ansatte" : "Ledere"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-white/45 mb-4">Antall {group === "employees" ? "ansatte" : "ledere"} etter snitt arbeidstid per dag · aktiv-terskel {thrLabel}m</p>
      {total === 0 ? (
        <PanelEmpty msg="Ingen arbeidstid registrert i perioden" />
      ) : (
        <div className="space-y-2.5">
          {buckets.map((b, i) => {
            const pct = (b.count / max) * 100
            const sharePct = total ? (b.count / total) * 100 : 0
            const color = b.inactive ? "#f43f5e" : "#10b981"
            return (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-right font-mono text-xs text-white/45">{b.label}</span>
                <div className="relative flex-1 h-6 rounded-lg bg-white/[0.04] overflow-hidden">
                  <motion.div className="h-full rounded-lg" style={{ background: `${color}cc` }}
                    initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: i * 0.04 }} />
                </div>
                <span className="w-20 shrink-0 flex items-baseline justify-end gap-1.5">
                  <span className="font-mono text-sm font-semibold text-white/90">{b.count}</span>
                  <span className="font-mono text-[11px] text-white/35">{sharePct.toFixed(0)}%</span>
                </span>
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

function ArbeidstidTab({ work, d }: { work: WorkTimeStats | null; d: AnalyticsPreview }) {
  const w = work?.aggregate ?? d.work_time_summary
  const people = useMemo(() => {
    const all = [...(work?.employees ?? []), ...(work?.managers ?? [])]
    return all.sort((a, b) => b.total_minutes - a.total_minutes).slice(0, 50)
  }, [work])
  const groups = [
    { label: "Ansatte", g: w.employees, color: "#3b82f6" },
    { label: "Ledere", g: w.managers, color: "#8b5cf6" },
    { label: "Totalt", g: w.combined, color: "#10b981" },
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {groups.map(({ label, g, color }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
            <div className="flex items-center justify-between mb-2"><span className="text-xs text-white/40 font-medium">{label}</span><Clock className="h-4 w-4" style={{ color }} /></div>
            <p className="font-mono text-2xl font-bold text-white">{g.active_count}<span className="text-sm text-white/35"> / {g.total} aktive</span></p>
            <p className="text-xs text-white/40 mt-0.5">{g.active_pct.toFixed(1)}% · snitt {fmtMin(g.avg_daily_minutes)}/dag</p>
          </div>
        ))}
      </div>
      {work && <WorkTimeHistogram work={work} />}
      <Glass className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Mest aktive (arbeidstid)</h3>
        {people.length === 0 ? <PanelEmpty msg="Ingen arbeidstid registrert" /> : (
          <div className="divide-y divide-white/5">
            {people.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2.5"><span className={cn("h-2 w-2 rounded-full", p.is_active ? "bg-emerald-500" : "bg-white/20")} /><span className="text-sm text-white/85">{p.name}</span></div>
                <div className="flex items-center gap-4 text-right">
                  <span className="font-mono text-sm text-white/70">{fmtMin(p.total_minutes)}</span>
                  <span className="font-mono text-xs text-white/35 w-20">{fmtMin(p.avg_daily_minutes)}/dag</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Glass>
    </div>
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
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16 }} onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0d1528] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="text-lg font-bold text-white">Send ukentlig rapport</h2>
              <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8"><X className="h-4 w-4" /></button>
            </div>
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
              <button onClick={submit} disabled={!allValid || sending} className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
                {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send rapport
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Terskler (live thresholds CRUD) ────────────────────────────────────────────
function TersklerTab({ campaigns }: { campaigns: { id: string; name: string; color: string }[] }) {
  const { toast } = useToast()
  const [items, setItems] = useState<Threshold[] | null>(null)
  const [errored, setErrored] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; t: Threshold } | null>(null)

  const load = useCallback(() => {
    setErrored(false)
    // The endpoint may return a bare array or a DRF paginated envelope.
    analyticsService.getThresholds()
      .then((res: any) => setItems(Array.isArray(res) ? res : (res?.results ?? [])))
      .catch(() => { setErrored(true); setItems([]) })
  }, [])
  useEffect(() => { load() }, [load])

  const remove = async (id: string) => {
    setBusy(id)
    try { await analyticsService.deleteThreshold(id); toast({ title: "Terskel slettet" }) }
    catch (e) { toast({ title: "Sletting feilet", description: e instanceof Error ? e.message : "", variant: "destructive" }) }
    setBusy(null); load()
  }
  const toggleActive = async (t: Threshold) => {
    setBusy(t.id)
    try { await analyticsService.updateThreshold(t.id, { is_active: !t.is_active }) } catch { /* ignore */ }
    setBusy(null); load()
  }

  if (items === null) return <Glass className="min-h-[200px]"><PanelLoading label="Laster terskler…" /></Glass>
  if (errored) return <Glass className="min-h-[200px]"><PanelError onRetry={load} /></Glass>

  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Terskler ({items.length})</h3>
          <span className="text-xs text-white/35">Mest spesifikke vinner: ansatt &gt; kampanje &gt; leder &gt; global</span>
        </div>
        <button onClick={() => setModal({ mode: "create" })} className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-all shrink-0">
          <Plus className="h-4 w-4" /> Ny terskel
        </button>
      </div>
      {items.length === 0 ? <PanelEmpty msg="Ingen terskler definert" sub="Globale standardverdier brukes." /> : (
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[1.4fr_90px_90px_90px_90px_90px_70px] gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
              <span>Omfang</span><span className="text-right">Dører/dag</span><span className="text-right">Dører/uke</span><span className="text-right">Min ja %</span><span className="text-right">Maks nei %</span><span className="text-right">Aktiv</span><span className="text-right"></span>
            </div>
            <div className="divide-y divide-white/5">
              {items.map(t => (
                <div key={t.id} className="grid grid-cols-[1.4fr_90px_90px_90px_90px_90px_70px] gap-3 items-center px-3 py-2.5">
                  <div className="min-w-0"><p className="text-sm font-medium text-white/90 truncate">{t.target_name || t.scope_display || t.scope}</p><p className="text-[10px] uppercase tracking-wider text-white/35">{t.scope}</p></div>
                  <span className="text-right font-mono text-sm text-white/70">{t.min_doors_per_day}</span>
                  <span className="text-right font-mono text-sm text-white/70">{t.min_doors_per_week}</span>
                  <span className="text-right font-mono text-sm text-white/70">{t.min_yes_rate_percent}</span>
                  <span className="text-right font-mono text-sm text-white/70">{t.max_no_rate_percent}</span>
                  <div className="flex justify-end">
                    <button onClick={() => toggleActive(t)} disabled={busy === t.id} className={cn("cursor-pointer relative h-5 w-9 rounded-full transition-colors", t.is_active ? "bg-emerald-600" : "bg-white/15")}>
                      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", t.is_active ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setModal({ mode: "edit", t })} disabled={busy === t.id} className="cursor-pointer h-7 w-7 inline-flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(t.id)} disabled={busy === t.id} className="cursor-pointer h-7 w-7 inline-flex items-center justify-center rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10">
                      {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <ThresholdModal
        modal={modal} campaigns={campaigns}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); load() }}
      />
    </Glass>
  )
}

// ─── Threshold create / edit modal ───────────────────────────────────────────
const THRESHOLD_SCOPES: { value: ThresholdScope; label: string }[] = [
  { value: "global", label: "Global (alle)" },
  { value: "manager", label: "Leder" },
  { value: "campaign", label: "Kampanje" },
  { value: "employee", label: "Ansatt" },
]
const NUM_FIELDS: { key: keyof CreateThresholdData; label: string }[] = [
  { key: "min_doors_per_day", label: "Min dører/dag" },
  { key: "min_doors_per_week", label: "Min dører/uke" },
  { key: "min_yes_rate_percent", label: "Min ja %" },
  { key: "max_no_rate_percent", label: "Maks nei %" },
  { key: "min_contact_rate_percent", label: "Min kontakt %" },
  { key: "consecutive_days_threshold", label: "Sammenhengende dager" },
  { key: "performance_drop_alert_percent", label: "Ytelsesfall %" },
  { key: "max_inactive_hours", label: "Maks inaktive timer" },
]

function ThresholdModal({ modal, campaigns, onClose, onSaved }: {
  modal: { mode: "create" } | { mode: "edit"; t: Threshold } | null
  campaigns: { id: string; name: string; color: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const editing = modal?.mode === "edit" ? modal.t : null
  const [scope, setScope] = useState<ThresholdScope>("global")
  const [target, setTarget] = useState<string>("")
  const [nums, setNums] = useState<Record<string, string>>({})
  const [isActive, setIsActive] = useState(true)
  const [people, setPeople] = useState<{ id: string; name: string; user_type: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!modal) return
    if (editing) {
      setScope(editing.scope)
      setTarget(editing.manager || editing.campaign || editing.employee || "")
      setIsActive(editing.is_active)
      setNums(Object.fromEntries(NUM_FIELDS.map(f => [f.key, String((editing as any)[f.key] ?? "")])))
    } else {
      setScope("global"); setTarget(""); setIsActive(true); setNums({})
    }
  }, [modal]) // eslint-disable-line

  // Load assignable users for manager/employee scope targets.
  useEffect(() => {
    if (!modal || (scope !== "manager" && scope !== "employee")) return
    let cancelled = false
    import("@/lib/api/users").then(({ fetchAssignable }) => fetchAssignable())
      .then(res => { if (!cancelled) setPeople(res.results.map(u => ({ id: u.id, name: u.name || u.username, user_type: u.user_type }))) })
      .catch(() => { if (!cancelled) setPeople([]) })
    return () => { cancelled = true }
  }, [modal, scope])

  const targetOptions = useMemo(() => {
    if (scope === "campaign") return campaigns.map(c => ({ id: c.id, name: c.name }))
    if (scope === "manager") return people.filter(p => p.user_type === "manager" || p.user_type === "superuser" || p.user_type === "admin")
    if (scope === "employee") return people.filter(p => p.user_type === "employee")
    return []
  }, [scope, campaigns, people])

  const needsTarget = scope !== "global"
  const valid = !needsTarget || !!target

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    const payload: CreateThresholdData = { scope, is_active: isActive }
    if (scope === "manager") payload.manager = target
    if (scope === "campaign") payload.campaign = target
    if (scope === "employee") payload.employee = target
    NUM_FIELDS.forEach(f => {
      const v = nums[f.key as string]
      if (v !== undefined && v !== "") (payload as any)[f.key] = Number(v)
    })
    try {
      if (editing) await analyticsService.updateThreshold(editing.id, payload)
      else await analyticsService.createThreshold(payload)
      toast({ title: editing ? "Terskel oppdatert" : "Terskel opprettet" })
      onSaved()
    } catch (e) {
      toast({ title: "Lagring feilet", description: e instanceof Error ? e.message : "Ukjent feil", variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      {modal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 overflow-y-auto" style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16 }} onClick={e => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-white/12 bg-[#0d1528] shadow-2xl mb-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="text-lg font-bold text-white">{editing ? "Rediger terskel" : "Ny terskel"}</h2>
              <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5">Omfang</label>
                  <select value={scope} onChange={e => { setScope(e.target.value as ThresholdScope); setTarget("") }} disabled={!!editing}
                    className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50 disabled:opacity-50 [color-scheme:dark]">
                    {THRESHOLD_SCOPES.map(s => <option key={s.value} value={s.value} className="bg-[#0d1528]">{s.label}</option>)}
                  </select>
                </div>
                {needsTarget && (
                  <div>
                    <label className="block text-xs font-medium text-white/45 mb-1.5">Mål</label>
                    <select value={target} onChange={e => setTarget(e.target.value)}
                      className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]">
                      <option value="" className="bg-[#0d1528]">Velg…</option>
                      {targetOptions.map(o => <option key={o.id} value={o.id} className="bg-[#0d1528]">{o.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {NUM_FIELDS.map(f => (
                  <div key={f.key as string}>
                    <label className="block text-xs font-medium text-white/45 mb-1.5">{f.label}</label>
                    <input type="number" min={0} value={nums[f.key as string] ?? ""} onChange={e => setNums(n => ({ ...n, [f.key as string]: e.target.value }))}
                      placeholder="—" className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50" />
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <button type="button" onClick={() => setIsActive(a => !a)} className={cn("relative h-5 w-9 rounded-full transition-colors", isActive ? "bg-emerald-600" : "bg-white/15")}>
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", isActive ? "translate-x-4" : "translate-x-0.5")} />
                </button>
                <span className="text-sm text-white/70">Aktiv</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
              <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8">Avbryt</button>
              <button onClick={submit} disabled={!valid || saving} className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Lagre" : "Opprett"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AnalyticsView
