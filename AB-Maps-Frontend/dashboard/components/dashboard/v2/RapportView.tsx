"use client"

/**
 * Rapport — Glassmorphism dark redesign.
 * Runs entirely on MOCK DATA (see MOCK DATA LAYER below). Backend wiring is
 * intentionally removed; reconnect later by swapping the three async fns.
 *
 * Hierarchy: Campaign → User list (leaderboard) → User detail (city → postnr → address)
 * Stats: Single stacked band — NO individual cards.
 * Entry state: Search-first, minimal.
 */

import React, {
  useState, useEffect, useCallback, useMemo, useRef, memo,
} from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  Search, Download, ChevronRight, ChevronDown, X, Loader2,
  MapPin, Clock, BarChart3, FileText, ArrowRight, Users,
} from "lucide-react"
import {
  LineChart, Line, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts"
import { cn } from "@/lib/utils"
import { RoyMascot, MOOD_TO_ROY } from "@/components/gamification/RoyMascot"
import { computeMood } from "@/components/gamification/lib/mood"
import { fetchReportTable, fetchUserAddresses as apiFetchUserAddresses } from "@/lib/api/reports"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"

// ─── Types (unchanged from original) ─────────────────────────────────────────

interface Campaign { id: string; name: string }

interface UserSummary {
  user_id: string
  name: string
  role: "employee" | "manager"
  total_responses: number
  total_cities: number
  ja_percentage: number
  nei_percentage: number
  ikke_hjemme_percentage: number
}

interface SummaryData {
  total_users: number
  total_responses: number
  total_cities: number
  date_range: { start_date: string | null; end_date: string | null }
  campaigns: { campaign_id: string; campaign_name: string }[]
}

interface TableDataResponse { users: UserSummary[]; summary: SummaryData }

interface AddressDetail {
  address_id: string | null
  address_text: string
  base_address: string
  apartment_number: string | null
  status: string
  position: { lat: number; lng: number } | null
  tags: Record<string, string>
  recorded_at: string | null
  campaign_id: string | null
  campaign_name: string | null
}

interface CityDetail {
  city_name: string
  total: number
  ja_count: number
  nei_count: number
  ikke_hjemme_count: number
  ja_percentage: number
  nei_percentage: number
  ikke_hjemme_percentage: number
  addresses: AddressDetail[]
}

interface UserAddressResponse {
  user_id: string
  user_name: string
  user_role: string
  total_responses: number
  cities: CityDetail[]
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const nbFmt = new Intl.NumberFormat("nb-NO")
const pctFmt = (n: number) => `${n.toFixed(1)}%`

function todayISO() { return new Date().toISOString().slice(0, 10) }
function daysAgoISO(d: number) {
  const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10)
}
function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("")
}
// Deterministic 7-point spark derived from a user's real status mix (no random
// mock). Trends from nei% → ikke_hjemme% → ja% so the line reflects the user.
function sparkSeries(u: { ja_percentage: number; nei_percentage: number; ikke_hjemme_percentage: number }): number[] {
  const anchors = [u.nei_percentage, u.ikke_hjemme_percentage, u.ja_percentage]
  const out: number[] = []
  for (let i = 0; i < 7; i++) {
    const pos = (i / 6) * (anchors.length - 1)
    const lo = Math.floor(pos), hi = Math.min(anchors.length - 1, lo + 1)
    const t = pos - lo
    out.push(Math.round(anchors[lo] * (1 - t) + anchors[hi] * t))
  }
  return out
}

// ─── LIVE DATA LAYER (Module 5, §5.4) ─────────────────────────────────────────
// NOTE: the `campaign_ids` param is a CSV and is required on the table endpoint.

async function fetchCampaigns(): Promise<Campaign[]> {
  const list = await fetchCampaignsWithStats()
  return list.map(c => ({ id: c.id, name: c.name }))
}

async function fetchTableData(p: { campaign_ids: string[]; start_date?: string; end_date?: string }): Promise<TableDataResponse> {
  return fetchReportTable({ campaignIds: p.campaign_ids, startDate: p.start_date, endDate: p.end_date })
}

async function fetchUserAddresses(p: { user_id: string; campaign_ids: string[]; start_date?: string; end_date?: string }): Promise<UserAddressResponse> {
  return apiFetchUserAddresses({ userId: p.user_id, campaignIds: p.campaign_ids, startDate: p.start_date, endDate: p.end_date })
}

// ─── Stat band (NOT cards) ───────────────────────────────────────────────────

function StatBand({ tableData }: { tableData: TableDataResponse }) {
  const reduced = useReducedMotion()
  const total = tableData.summary.total_responses

  let ja = 0, nei = 0, ih = 0
  tableData.users.forEach(u => {
    ja  += Math.round(u.total_responses * u.ja_percentage / 100)
    nei += Math.round(u.total_responses * u.nei_percentage / 100)
    ih  += Math.round(u.total_responses * u.ikke_hjemme_percentage / 100)
  })

  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0
  const jaPct = pct(ja), neiPct = pct(nei), ihPct = pct(ih)

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-5"
    >
      {/* Stacked bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full gap-0.5 mb-4">
        <motion.div
          className="h-full rounded-l-full bg-emerald-500"
          initial={{ width: "0%" }}
          animate={{ width: `${jaPct}%` }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        />
        <motion.div
          className="h-full bg-rose-500"
          initial={{ width: "0%" }}
          animate={{ width: `${neiPct}%` }}
          transition={{ duration: 1, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
        />
        <motion.div
          className="h-full rounded-r-full bg-amber-500"
          initial={{ width: "0%" }}
          animate={{ width: `${ihPct}%` }}
          transition={{ duration: 1, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>

      {/* Inline numbers — no cards */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Totale registreringer</span>
          <span className="font-mono text-2xl font-bold text-white">{nbFmt.format(total)}</span>
        </div>
        <div className="h-8 w-px bg-white/10 self-center hidden sm:block" />
        {[
          { label: "Ja",          n: ja,  pct: jaPct,  color: "#10b981" },
          { label: "Nei",         n: nei, pct: neiPct, color: "#f43f5e" },
          { label: "Ikke hjemme", n: ih,  pct: ihPct,  color: "#f59e0b" },
        ].map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <div className="h-8 w-px bg-white/10 self-center hidden sm:block" />}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{s.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-white">{nbFmt.format(s.n)}</span>
                <span className="font-mono text-xs text-white/40">{s.pct.toFixed(1)}%</span>
              </div>
            </div>
          </React.Fragment>
        ))}
        <div className="h-8 w-px bg-white/10 self-center hidden lg:block" />
        <div className="hidden lg:flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Byer</span>
          <span className="font-mono text-2xl font-bold text-white">{tableData.summary.total_cities}</span>
        </div>
        <div className="h-8 w-px bg-white/10 self-center hidden lg:block" />
        <div className="hidden lg:flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Ansatte</span>
          <span className="font-mono text-2xl font-bold text-white">{tableData.summary.total_users}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Entry state ──────────────────────────────────────────────────────────────

function EntryState({
  campaigns,
  loading,
  searchQuery,
  setSearchQuery,
  activeCampaignIds,
  toggleCampaign,
  period,
  setPeriod,
  onLoad,
}: {
  campaigns: Campaign[]
  loading: boolean
  searchQuery: string
  setSearchQuery: (s: string) => void
  activeCampaignIds: Set<string>
  toggleCampaign: (id: string) => void
  period: string
  setPeriod: (p: string) => void
  onLoad: () => void
}) {
  const reduced = useReducedMotion()
  const PERIODS = [
    { key: "1D", label: "I dag" }, { key: "1W", label: "7 dager" },
    { key: "1M", label: "30 dager" }, { key: "YTD", label: "I år" },
  ]

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-6"
    >
      <div className="w-full max-w-xl text-center">
        {/* Heading */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-2">Analyse · Salgsaktivitet</p>
        <h1 className="text-4xl font-bold text-white mb-2">Rapport</h1>
        <p className="text-sm text-white/35 mb-10">
          Velg kampanje og periode, deretter klikk "Last inn rapport" — søk er valgfritt
        </p>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Valgfritt: filtrer på navn…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-12 rounded-2xl border border-white/15 bg-white/8 pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all duration-150 backdrop-blur-xl"
          />
        </div>

        {/* Campaign pills */}
        {campaigns.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Kampanje</p>
            <div className="flex flex-wrap justify-center gap-2">
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCampaign(c.id)}
                  className={cn(
                    "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-150",
                    activeCampaignIds.has(c.id)
                      ? "bg-blue-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.4)]"
                      : "bg-white/8 text-white/50 border border-white/10 hover:text-white/80 hover:bg-white/12"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Period */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Periode</p>
          <div className="flex justify-center gap-1 rounded-2xl bg-white/5 p-1 border border-white/8">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={cn(
                  "cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150",
                  period === key ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Load button */}
        <button
          onClick={onLoad}
          disabled={loading}
          className="cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.35)] hover:bg-blue-500 transition-all duration-150 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? "Laster…" : "Last inn rapport"}
        </button>
      </div>
    </motion.div>
  )
}

// ─── User list row ────────────────────────────────────────────────────────────

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"]

const UserRow = memo(function UserRow({
  user, rank, selected, onClick,
}: {
  user: UserSummary; rank: number; selected: boolean; onClick: () => void
}) {
  const moodOut = computeMood({
    jaProsent: user.ja_percentage,
    dorerPerDag: Math.round(user.total_responses / 7),
    minJaProsent: 3,
    minDorerPerDag: 70,
    rankPercentile: rank <= 3 ? rank * 3 : Math.min(rank * 5, 80),
    daysOnPlatform: 30,
  })
  const royState = MOOD_TO_ROY[moodOut.mood]

  const ja  = Math.round(user.total_responses * user.ja_percentage / 100)
  const nei = Math.round(user.total_responses * user.nei_percentage / 100)
  const ih  = Math.round(user.total_responses * user.ikke_hjemme_percentage / 100)

  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150",
        selected
          ? "bg-blue-600/15 border-l-2 border-blue-500"
          : "border-l-2 border-transparent hover:bg-white/5"
      )}
    >
      {/* Rank */}
      <span
        className="w-6 shrink-0 text-center font-mono text-xs font-bold"
        style={{ color: RANK_COLORS[rank - 1] ?? "rgba(255,255,255,0.3)" }}
      >
        {rank}
      </span>

      {/* Roy mascot */}
      <div className="shrink-0">
        <RoyMascot state={royState} size={32} />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 truncate">{user.name}</p>
        <p className="text-[10px] text-white/35 uppercase tracking-wider">
          {user.role === "manager" ? "Manager" : "Ansatt"} · {user.total_cities} {user.total_cities === 1 ? "by" : "byer"}
        </p>
      </div>

      {/* Ja/Nei/IH mini pills */}
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <div className="flex gap-1">
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">{ja} ja</span>
          <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">{nei} nei</span>
          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">{ih} ih</span>
        </div>
        <span className="font-mono text-[10px] text-white/35">{nbFmt.format(user.total_responses)} dører</span>
      </div>

      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-colors", selected ? "text-blue-400" : "text-white/20")} />
    </button>
  )
})

// ─── Address row in detail panel ──────────────────────────────────────────────

function statusStyle(raw: string) {
  const s = raw.toLowerCase().replace(/\s/g, "_")
  if (s === "ja") return { label: "Ja", color: "#10b981", bg: "bg-emerald-500/15" }
  if (s === "nei") return { label: "Nei", color: "#f43f5e", bg: "bg-rose-500/15" }
  return { label: "Ikke hjemme", color: "#f59e0b", bg: "bg-amber-500/15" }
}

// ─── City accordion in detail panel ──────────────────────────────────────────

const CityBlock = memo(function CityBlock({ city }: { city: CityDetail }) {
  const [open, setOpen] = useState(false)

  // Group addresses by postal code
  const byPostal = useMemo(() => {
    const map = new Map<string, AddressDetail[]>()
    city.addresses.forEach(a => {
      const pnr = a.tags?.postnr ?? "—"
      if (!map.has(pnr)) map.set(pnr, [])
      map.get(pnr)!.push(a)
    })
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [city.addresses])

  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="cursor-pointer w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />
        </motion.div>
        <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
        <span className="flex-1 text-sm font-semibold text-white/80">{city.city_name}</span>
        <div className="flex gap-1.5">
          <span className="text-[10px] font-mono text-emerald-400">{city.ja_count}j</span>
          <span className="text-[10px] font-mono text-rose-400">{city.nei_count}n</span>
          <span className="text-[10px] font-mono text-amber-400">{city.ikke_hjemme_count}ih</span>
        </div>
        <span className="font-mono text-xs text-white/35">{city.total}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {byPostal.map(([postal, addrs]) => (
              <div key={postal} className="ml-4 border-l border-white/8 pl-3">
                {/* Postal code row */}
                <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/40">
                  <span className="font-mono font-bold text-white/50">{postal}</span>
                  <span className="text-white/25">·</span>
                  <span>{addrs.length} registreringer</span>
                </div>
                {/* Address rows */}
                {addrs.map((a, i) => {
                  const s = statusStyle(a.status)
                  const display = a.apartment_number
                    ? `${a.base_address}, leil. ${a.apartment_number}`
                    : a.base_address || a.address_text
                  const time = a.recorded_at
                    ? new Date(a.recorded_at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
                    : null
                  return (
                    <div key={a.address_id ?? i} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/4 transition-colors">
                      <span className="flex-1 truncate text-xs text-white/60">{display}</span>
                      {time && <span className="font-mono text-[10px] text-white/25 shrink-0">{time}</span>}
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.bg)} style={{ color: s.color }}>
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

// ─── Employee detail panel (right side) ──────────────────────────────────────

type DetailTab = "lokasjoner" | "tidslinje" | "profil"

function EmployeeDetail({
  user,
  addressData,
  loading,
  onClose,
}: {
  user: UserSummary
  addressData: UserAddressResponse | null
  loading: boolean
  onClose: () => void
}) {
  const reduced = useReducedMotion()
  const [tab, setTab] = useState<DetailTab>("lokasjoner")

  const moodOut = computeMood({
    jaProsent: user.ja_percentage,
    dorerPerDag: Math.round(user.total_responses / 7),
    minJaProsent: 3,
    minDorerPerDag: 70,
    rankPercentile: 20,
    daysOnPlatform: 30,
  })
  const royState = MOOD_TO_ROY[moodOut.mood]

  const ja  = Math.round(user.total_responses * user.ja_percentage / 100)
  const nei = Math.round(user.total_responses * user.nei_percentage / 100)
  const ih  = Math.round(user.total_responses * user.ikke_hjemme_percentage / 100)

  // Trend derived from the user's real status mix.
  const sparkData = sparkSeries(user)
  const trendData = sparkData.map((v, i) => ({ dag: `Dag ${i + 1}`, verdi: v }))
  const trendAvg  = sparkData.reduce((a, b) => a + b, 0) / sparkData.length

  // Status bar chart data
  const statusChartData = [
    { name: "Ja",           verdi: ja,  fill: "#10b981" },
    { name: "Nei",          verdi: nei, fill: "#f43f5e" },
    { name: "Ikke hjemme",  verdi: ih,  fill: "#f59e0b" },
  ]

  const TABS: { key: DetailTab; label: string; icon: React.ElementType }[] = [
    { key: "lokasjoner", label: "Lokasjoner", icon: MapPin       },
    { key: "tidslinje",  label: "Aktivitet",  icon: BarChart3    },
    { key: "profil",     label: "Profil",     icon: FileText     },
  ]

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <RoyMascot state={royState} size={52} />
            <div>
              <h3 className="text-lg font-bold text-white">{user.name}</h3>
              <span className={cn("mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", moodOut.bgClass, moodOut.colorClass)}>
                {moodOut.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer h-8 w-8 flex items-center justify-center rounded-xl text-white/30 hover:text-white hover:bg-white/8 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status strip — NO cards, just inline numbers with dividers */}
        <div className="flex items-center gap-4 flex-wrap">
          {[
            { label: "Dører",       value: nbFmt.format(user.total_responses), color: "#3b82f6" },
            { label: "Ja",          value: `${ja} (${user.ja_percentage.toFixed(1)}%)`,          color: "#10b981" },
            { label: "Nei",         value: `${nei} (${user.nei_percentage.toFixed(1)}%)`,         color: "#f43f5e" },
            { label: "Ikke hjemme", value: `${ih} (${user.ikke_hjemme_percentage.toFixed(1)}%)`,  color: "#f59e0b" },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className="h-6 w-px bg-white/10" />}
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">{s.label}</p>
                <p className="font-mono text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full gap-0.5">
          <div className="h-full rounded-l-full bg-emerald-500" style={{ width: `${user.ja_percentage}%` }} />
          <div className="h-full bg-rose-500"                   style={{ width: `${user.nei_percentage}%` }} />
          <div className="h-full rounded-r-full bg-amber-500"   style={{ width: `${user.ikke_hjemme_percentage}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-white/8 px-3">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "cursor-pointer flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all duration-150",
              tab === key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-white/35 hover:text-white/60"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* Lokasjoner: City → PostalCode → Address */}
        {tab === "lokasjoner" && (
          <div>
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              </div>
            )}
            {!loading && !addressData && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MapPin className="h-6 w-6 text-white/15 mb-2" />
                <p className="text-xs text-white/30">Ingen lokasjonsdata funnet</p>
              </div>
            )}
            {!loading && addressData && addressData.cities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MapPin className="h-6 w-6 text-white/15 mb-2" />
                <p className="text-xs text-white/30">Ingen byer registrert</p>
              </div>
            )}
            {!loading && addressData && addressData.cities.length > 0 && (
              <div>
                {/* City summary header */}
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">
                    {addressData.cities.length} {addressData.cities.length === 1 ? "by" : "byer"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {addressData.cities.map(c => (
                      <div key={c.city_name} className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/8 px-3 py-1.5">
                        <span className="text-xs font-medium text-white/75">{c.city_name}</span>
                        <span className="font-mono text-[10px] text-white/35">{c.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* City accordions */}
                {addressData.cities.map(city => (
                  <CityBlock key={city.city_name} city={city} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tidslinje: Activity chart */}
        {tab === "tidslinje" && (
          <div className="p-4 space-y-5">
            {/* Status bar chart */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Svarfordeling</p>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ top: 0, right: 0, left: -32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0d1528", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="verdi" radius={[4, 4, 0, 0]} isAnimationActive={true}>
                      {statusChartData.map((entry, i) => (
                        <rect key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 7-day trend */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Aktivitet siste 7 dager</p>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="dag" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <ReferenceLine y={trendAvg} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 5" />
                    <Tooltip
                      contentStyle={{ background: "#0d1528", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                      cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                      formatter={(v: number) => [v, "Aktivitet"]}
                    />
                    <Line type="monotone" dataKey="verdi" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "#3b82f6" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status by city (if address data available) */}
            {addressData && addressData.cities.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Per by</p>
                <div className="space-y-2">
                  {addressData.cities.map(city => (
                    <div key={city.city_name} className="rounded-xl bg-white/4 border border-white/8 px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white/75">{city.city_name}</span>
                        <span className="font-mono text-[10px] text-white/35">{city.total} totalt</span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full gap-0.5 mb-1.5">
                        <div className="h-full rounded-l-full bg-emerald-500" style={{ width: `${city.ja_percentage}%` }} />
                        <div className="h-full bg-rose-500" style={{ width: `${city.nei_percentage}%` }} />
                        <div className="h-full rounded-r-full bg-amber-500" style={{ width: `${city.ikke_hjemme_percentage}%` }} />
                      </div>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-emerald-400 font-mono">{city.ja_count} ja</span>
                        <span className="text-rose-400 font-mono">{city.nei_count} nei</span>
                        <span className="text-amber-400 font-mono">{city.ikke_hjemme_count} ih</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profil */}
        {tab === "profil" && (
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-white/4 border border-white/8 divide-y divide-white/8">
              {[
                { label: "Navn",       value: user.name },
                { label: "Rolle",      value: user.role === "manager" ? "Manager" : "Ansatt" },
                { label: "Byer dekket", value: `${user.total_cities}` },
                { label: "Ja-prosent", value: pctFmt(user.ja_percentage) },
                { label: "Nei-prosent", value: pctFmt(user.nei_percentage) },
                { label: "Ikke hjemme %", value: pctFmt(user.ikke_hjemme_percentage) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-white/40">{label}</span>
                  <span className="text-xs font-semibold text-white/80">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RapportView() {
  const reduced = useReducedMotion()

  // Filter state
  const [period, setPeriod]                     = useState("1W")
  const [startDate, setStartDate]               = useState(daysAgoISO(7))
  const [endDate, setEndDate]                   = useState(todayISO())
  const [activeCampaignIds, setActiveCampaignIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery]           = useState("")
  const [minDoors, setMinDoors]                 = useState(0)

  // Data state
  const [campaigns, setCampaigns]               = useState<Campaign[]>([])
  const [tableData, setTableData]               = useState<TableDataResponse | null>(null)
  const [addressCache, setAddressCache]         = useState<Map<string, UserAddressResponse>>(new Map())
  const [loadingAddresses, setLoadingAddresses] = useState<Set<string>>(new Set())

  // UI state
  const [hasLoaded, setHasLoaded]               = useState(false)
  const [loadingTable, setLoadingTable]         = useState(false)
  const [selectedUser, setSelectedUser]         = useState<UserSummary | null>(null)
  const filtersRef = useRef({ campaign_ids: [] as string[], start_date: startDate, end_date: endDate })
  const detailRef = useRef<HTMLDivElement>(null)

  // On mobile the detail panel stacks BELOW the (tall) user list, so selecting a person
  // would otherwise require scrolling all the way down. Auto-scroll the detail into view.
  useEffect(() => {
    if (!selectedUser) return
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      const id = setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80)
      return () => clearTimeout(id)
    }
  }, [selectedUser])

  // Load campaigns on mount
  useEffect(() => {
    fetchCampaigns().then(setCampaigns)
  }, [])

  const toggleCampaign = (id: string) => {
    setActiveCampaignIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handlePeriodChange = (key: string) => {
    setPeriod(key)
    const today = todayISO()
    if      (key === "1D")  { setStartDate(daysAgoISO(1));  setEndDate(today) }
    else if (key === "1W")  { setStartDate(daysAgoISO(7));  setEndDate(today) }
    else if (key === "1M")  { setStartDate(daysAgoISO(30)); setEndDate(today) }
    else if (key === "YTD") { setStartDate(`${new Date().getFullYear()}-01-01`); setEndDate(today) }
  }

  const loadReport = useCallback(async () => {
    setLoadingTable(true)
    const ids = activeCampaignIds.size > 0 ? Array.from(activeCampaignIds) : campaigns.map(c => c.id)
    filtersRef.current = { campaign_ids: ids, start_date: startDate, end_date: endDate }
    setAddressCache(new Map())
    setSelectedUser(null)
    try {
      const data = await fetchTableData({ campaign_ids: ids, start_date: startDate, end_date: endDate })
      setTableData(data)
      setHasLoaded(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTable(false)
    }
  }, [activeCampaignIds, campaigns, startDate, endDate])

  // Export the loaded report table as CSV (Feature 10). Semicolon-separated + UTF-8
  // BOM so Norwegian Excel opens it correctly.
  const exportCsv = useCallback(() => {
    if (!tableData || tableData.users.length === 0) return
    const esc = (v: unknown) => {
      const s = String(v ?? "")
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const headers = ["Navn", "Rolle", "Totalt svar", "Byer", "Ja %", "Nei %", "Ikke hjemme %"]
    const rows = tableData.users.map(u => [
      u.name, u.role, u.total_responses, u.total_cities,
      u.ja_percentage, u.nei_percentage, u.ikke_hjemme_percentage,
    ])
    const csv = [headers, ...rows].map(r => r.map(esc).join(";")).join("\r\n")
    const campNames = campaigns.filter(c => activeCampaignIds.has(c.id)).map(c => c.name).join("-") || "alle"
    const fname = `rapport_${campNames}_${startDate}_${endDate}.csv`.replace(/[^\w.\-]+/g, "_")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = fname
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }, [tableData, campaigns, activeCampaignIds, startDate, endDate])

  const handleSelectUser = useCallback(async (user: UserSummary) => {
    setSelectedUser(user)
    if (addressCache.has(user.user_id)) return

    setLoadingAddresses(prev => { const n = new Set(prev); n.add(user.user_id); return n })
    try {
      const f = filtersRef.current
      const data = await fetchUserAddresses({ user_id: user.user_id, campaign_ids: f.campaign_ids, start_date: f.start_date, end_date: f.end_date })
      setAddressCache(prev => { const n = new Map(prev); n.set(user.user_id, data); return n })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAddresses(prev => { const n = new Set(prev); n.delete(user.user_id); return n })
    }
  }, [addressCache])

  // Filtered + sorted user list
  const filteredUsers = useMemo(() => {
    if (!tableData) return []
    return tableData.users
      .filter(u => {
        if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (minDoors > 0 && u.total_responses < minDoors) return false
        return true
      })
      .sort((a, b) => b.total_responses - a.total_responses)
  }, [tableData, searchQuery, minDoors])

  const PERIODS = [
    { key: "1D", label: "I dag" }, { key: "1W", label: "7 dager" },
    { key: "1M", label: "30 dager" }, { key: "YTD", label: "I år" },
  ]

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 60%, #0a0f1e 100%)" }}>
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-purple-600/8 blur-3xl" />
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          {!hasLoaded ? (
            /* ── Entry state ─────────────────── */
            <EntryState
              key="entry"
              campaigns={campaigns}
              loading={loadingTable}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeCampaignIds={activeCampaignIds}
              toggleCampaign={toggleCampaign}
              period={period}
              setPeriod={handlePeriodChange}
              onLoad={loadReport}
            />
          ) : (
            /* ── Active state ────────────────── */
            <motion.div
              key="active"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 py-6 max-w-[1600px] mx-auto space-y-5"
            >
              {/* Page header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1">Analyse · Drill-down</p>
                  <h1 className="text-2xl font-bold text-white">Rapport</h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setHasLoaded(false); setTableData(null) }}
                    className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 hover:text-white hover:border-white/20 transition-all"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Endre søk
                  </button>
                  <button onClick={exportCsv} disabled={!tableData || tableData.users.length === 0} className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    <Download className="h-3.5 w-3.5" />
                    Eksporter
                  </button>
                </div>
              </div>

              {/* Stat band */}
              {tableData && <StatBand tableData={tableData} />}

              {/* Filter row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
                  {PERIODS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { handlePeriodChange(key); loadReport() }}
                      className={cn(
                        "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                        period === key ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Campaign pills */}
                <div className="flex flex-wrap gap-1.5">
                  {campaigns.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { toggleCampaign(c.id) }}
                      className={cn(
                        "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                        activeCampaignIds.has(c.id)
                          ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.35)]"
                          : "bg-white/5 text-white/40 border border-white/10 hover:text-white/70"
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-px bg-white/10" />

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Søk ansatt…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-9 rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 transition-all w-48"
                  />
                </div>
              </div>

              {/* Main two-panel */}
              <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5" style={{ minHeight: 600 }}>

                {/* Left: User list (capped on mobile so it scrolls internally instead of
                    pushing the detail panel far down the page) */}
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col max-h-[55vh] xl:max-h-none">
                  <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Ansatte</h3>
                      <p className="text-[10px] text-white/35 mt-0.5">{filteredUsers.length} ansatte · klikk for detaljer</p>
                    </div>
                    <Users className="h-4 w-4 text-white/20" />
                  </div>

                  {loadingTable ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <Search className="h-6 w-6 text-white/15 mb-2" />
                      <p className="text-xs text-white/30">Ingen ansatte funnet</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                      {filteredUsers.map((user, idx) => (
                        <UserRow
                          key={user.user_id}
                          user={user}
                          rank={idx + 1}
                          selected={selectedUser?.user_id === user.user_id}
                          onClick={() => handleSelectUser(user)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Employee detail or placeholder */}
                <div ref={detailRef} className="scroll-mt-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
                  <AnimatePresence mode="wait">
                    {selectedUser ? (
                      <EmployeeDetail
                        key={selectedUser.user_id}
                        user={selectedUser}
                        addressData={addressCache.get(selectedUser.user_id) ?? null}
                        loading={loadingAddresses.has(selectedUser.user_id)}
                        onClose={() => setSelectedUser(null)}
                      />
                    ) : (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-full py-20 text-center"
                      >
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                          <Users className="h-6 w-6 text-white/20" />
                        </div>
                        <p className="text-sm text-white/30 font-medium">Velg en ansatt</p>
                        <p className="text-xs text-white/20 mt-1">for å se detaljer, lokasjoner og aktivitet</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default RapportView
