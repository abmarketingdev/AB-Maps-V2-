"use client"

/**
 * Statistikk — geographic door-knock breakdown (Module 8, live).
 * Left: city → postal tree (door counts + ja-rate). Right: status breakdown
 * for the selected city/postal. Driven by GET /api/dashboard/v2/sales/geo/.
 * No money/amount anywhere — purely activity + status (the backend has no revenue).
 */

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { MapPin, ChevronRight, Search, DoorOpen, CheckCircle2, Percent, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchSalesGeo, type GeoCity, type SalesGeoTotals } from "@/lib/api/salesGeo"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

type Period = "uke" | "maaned" | "kvartal" | "alle"
const nbFmt = new Intl.NumberFormat("nb-NO")

const STATUS = [
  { key: "ja" as const,          label: "Ja",          color: "#10b981" },
  { key: "nei" as const,         label: "Nei",         color: "#f43f5e" },
  { key: "ikke_hjemme" as const, label: "Ikke hjemme", color: "#f59e0b" },
]

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function rangeFor(p: Period): { startDate?: string; endDate?: string } {
  const end = new Date()
  // "Alle" = all-time: send a wide range (the backend defaults to ~30d when no
  // dates are given, which would hide older historical data).
  if (p === "alle") return { startDate: "2000-01-01", endDate: ymd(end) }
  const start = new Date()
  start.setDate(start.getDate() - (p === "uke" ? 6 : p === "maaned" ? 29 : 89))
  return { startDate: ymd(start), endDate: ymd(end) }
}

// ─── Status breakdown (right panel) ───────────────────────────────────────────
function StatusBreakdown({ node, title, subtitle, employeeCount }: {
  node: { total: number; ja: number; nei: number; ikke_hjemme: number; ja_rate: number }
  title: string; subtitle: string; employeeCount?: number
}) {
  const reduced = useReducedMotion()
  const total = node.total || 1
  return (
    <div className="flex flex-col h-full">
      <div className="mb-5 flex items-start justify-between shrink-0">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>
        </div>
        <div className="flex gap-5 text-right">
          <div><p className="font-mono text-lg font-bold text-white">{nbFmt.format(node.total)}</p><p className="text-[10px] text-white/30">dører</p></div>
          <div><p className="font-mono text-lg font-bold text-emerald-400">{node.ja_rate.toFixed(1)}%</p><p className="text-[10px] text-white/30">ja-rate</p></div>
          {employeeCount != null && <div><p className="font-mono text-lg font-bold text-white/80">{employeeCount}</p><p className="text-[10px] text-white/30">ansatte</p></div>}
        </div>
      </div>

      {/* Stacked bar */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/8 flex">
        {STATUS.map(s => (
          <motion.div key={s.key} className="h-full" style={{ background: s.color }}
            initial={reduced ? false : { width: 0 }} animate={{ width: `${(node[s.key] / total) * 100}%` }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }} />
        ))}
      </div>

      {/* Status tiles */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {STATUS.map(s => (
          <div key={s.key} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-xs text-white/45 font-medium">{s.label}</span>
            </div>
            <p className="font-mono text-2xl font-bold" style={{ color: s.color }}>{nbFmt.format(node[s.key])}</p>
            <p className="font-mono text-xs text-white/35 mt-0.5">{((node[s.key] / total) * 100).toFixed(0)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function StatistikkView() {
  const reduced = useReducedMotion()
  const { campaignId: globalCampaignId } = useSelectedCampaign()
  const [period, setPeriod] = useState<Period>("alle")
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; color: string }[]>([])
  const [campaignId, setCampaignId] = useState<string | "">("")  // "" = all
  const [search, setSearch] = useState("")
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [selectedPostal, setSelectedPostal] = useState<string | null>(null)

  const [cities, setCities] = useState<GeoCity[]>([])
  const [totals, setTotals] = useState<SalesGeoTotals>({ total: 0, ja: 0, nei: 0, ikke_hjemme: 0, ja_rate: 0 })
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    fetchCampaignsWithStats().then(list => setCampaigns(list.map(c => ({ id: c.id, name: c.name, color: c.color })))).catch(() => {})
  }, [])
  useEffect(() => { if (globalCampaignId) setCampaignId(globalCampaignId) }, [globalCampaignId])

  const load = () => {
    setLoading(true); setErrored(false)
    const { startDate, endDate } = rangeFor(period)
    return fetchSalesGeo({ campaignId: campaignId || undefined, startDate, endDate })
      .then(g => { setCities(g.cities); setTotals(g.totals) })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [campaignId, period]) // eslint-disable-line

  const PERIODS: { key: Period; label: string }[] = [
    { key: "uke", label: "7 dager" }, { key: "maaned", label: "30 dager" },
    { key: "kvartal", label: "90 dager" }, { key: "alle", label: "Alle" },
  ]

  const filteredCities = useMemo(() => {
    if (!search) return cities
    const q = search.toLowerCase()
    return cities
      .map(c => ({ ...c, postals: c.postals.filter(p => p.postal_code.includes(q)) }))
      .filter(c => c.city.toLowerCase().includes(q) || c.postals.length > 0)
  }, [cities, search])

  const maxTotal = useMemo(() => Math.max(...filteredCities.map(c => c.total), 1), [filteredCities])

  const handleSelectCity = (city: string) => {
    if (selectedCity === city && !selectedPostal) setSelectedCity(null)
    else { setSelectedCity(city); setSelectedPostal(null) }
  }
  const handleSelectPostal = (city: string, postal: string) => {
    setSelectedCity(city); setSelectedPostal(prev => prev === postal ? null : postal)
  }

  // Resolve the right-panel node from selection.
  const cityNode = selectedCity ? cities.find(c => c.city === selectedCity) ?? null : null
  const postalNode = cityNode && selectedPostal ? cityNode.postals.find(p => p.postal_code === selectedPostal) ?? null : null
  const rightNode = postalNode ?? cityNode
  const rightTitle = postalNode ? `${selectedCity} · ${selectedPostal}` : selectedCity ?? "Velg et område"
  const rightSub = postalNode ? "Statusfordeling for postnummer" : cityNode ? `${cityNode.postals.length} postnumre` : "Velg by eller postnummer i listen"

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 60%, #0a0f1e 100%)" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-600/8 blur-3xl" />
      </div>

      <div className="relative px-6 py-8 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Statistikk · Geografisk visning</p>
            <h1 className="text-2xl font-bold text-white">Aktivitet etter geografi</h1>
          </div>
        </motion.div>

        {/* KPI strip */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Totale dører", value: nbFmt.format(totals.total), accent: "#3b82f6", Icon: DoorOpen },
            { label: "Ja", value: nbFmt.format(totals.ja), accent: "#10b981", Icon: CheckCircle2 },
            { label: "Ja-rate", value: `${totals.ja_rate.toFixed(1)}%`, accent: "#f59e0b", Icon: Percent },
            { label: "Aktive byer", value: nbFmt.format(cities.length), accent: "#8b5cf6", Icon: MapPin },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40 font-medium">{kpi.label}</span>
                <div className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ background: `${kpi.accent}22` }}><kpi.Icon className="h-3.5 w-3.5" style={{ color: kpi.accent }} /></div>
              </div>
              <p className="font-mono text-xl font-bold text-white">{kpi.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter strip */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-white/5 p-1 border border-white/8">
            {PERIODS.map(({ key, label }) => (
              <button key={key} onClick={() => setPeriod(key)}
                className={cn("cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all", period === key ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/70")}>{label}</button>
            ))}
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-white/25 font-medium mr-1">Kampanje:</span>
            <button onClick={() => setCampaignId("")}
              className={cn("cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all", campaignId === "" ? "bg-white/15 text-white" : "bg-white/5 text-white/40 hover:text-white/70")}>Alle</button>
            {campaigns.map(c => (
              <button key={c.id} onClick={() => setCampaignId(c.id)}
                className={cn("cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all", campaignId === c.id ? "text-white shadow-sm" : "bg-white/5 text-white/40 hover:text-white/70")}
                style={campaignId === c.id ? { background: c.color, boxShadow: `0 0 12px ${c.color}60` } : {}}>{c.name}</button>
            ))}
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
            <input type="text" placeholder="Søk by eller postnr…" value={search} onChange={e => setSearch(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 transition-all w-52" />
          </div>
        </motion.div>

        {/* Two-panel layout */}
        <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5" style={{ minHeight: 560 }}>
          {/* Left: geo tree */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Geografisk visning</h3>
                <p className="mt-0.5 text-xs text-white/35">{cities.length} byer · {nbFmt.format(totals.total)} dører</p>
              </div>
              <MapPin className="h-4 w-4 text-blue-400/60" />
            </div>
            {loading ? <PanelLoading label="Laster geografi…" />
              : errored ? <PanelError onRetry={() => void load()} />
              : filteredCities.length === 0 ? <PanelEmpty msg="Ingen aktivitet funnet" sub="Prøv en annen kampanje eller periode." />
              : (
              <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                {filteredCities.map(city => {
                  const isOpen = selectedCity === city.city
                  return (
                    <div key={city.city}>
                      <button onClick={() => handleSelectCity(city.city)}
                        className={cn("cursor-pointer w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all", isOpen ? "bg-white/10 border border-white/15" : "hover:bg-white/5 border border-transparent")}>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn("text-sm font-semibold", isOpen ? "text-white" : "text-white/75")}>{city.city}</span>
                            <span className="font-mono text-xs font-bold text-white/50">{nbFmt.format(city.total)} · <span className="text-emerald-400/80">{city.ja_rate.toFixed(1)}%</span></span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-white/10">
                            <motion.div className="h-full rounded-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${(city.total / maxTotal) * 100}%` }} transition={{ duration: 0.6 }} />
                          </div>
                        </div>
                        <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }}><ChevronRight className="h-3.5 w-3.5 text-white/30" /></motion.div>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="overflow-hidden ml-4 border-l border-white/10 pl-3 mt-1 space-y-0.5">
                            {city.postals.map(pc => {
                              const active = selectedPostal === pc.postal_code
                              const max = city.postals[0]?.total || 1
                              return (
                                <button key={pc.postal_code} onClick={() => handleSelectPostal(city.city, pc.postal_code)}
                                  className={cn("cursor-pointer w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all", active ? "bg-blue-600/20 border border-blue-500/30" : "hover:bg-white/5 border border-transparent")}>
                                  <span className={cn("font-mono text-xs font-bold tabular-nums w-10 shrink-0", active ? "text-blue-300" : "text-white/40")}>{pc.postal_code}</span>
                                  <div className="flex-1 min-w-0"><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className={cn("h-full rounded-full", active ? "bg-blue-400" : "bg-white/25")} style={{ width: `${(pc.total / max) * 100}%` }} /></div></div>
                                  <span className={cn("font-mono text-xs font-semibold shrink-0", active ? "text-blue-300" : "text-white/50")}>{nbFmt.format(pc.total)}</span>
                                  <span className="text-[10px] text-white/25 shrink-0 flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{pc.employee_count}</span>
                                </button>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: status breakdown */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
            {rightNode ? (
              <StatusBreakdown node={rightNode} title={rightTitle} subtitle={rightSub} employeeCount={postalNode?.employee_count} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <MapPin className="h-8 w-8 text-white/15 mb-3" />
                <p className="text-sm text-white/30">Velg by eller postnummer</p>
                <p className="text-xs text-white/20 mt-1">for å se statusfordelingen</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default StatistikkView
