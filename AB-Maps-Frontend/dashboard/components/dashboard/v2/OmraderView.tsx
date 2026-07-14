"use client"

/**
 * Områder — glassmorphism dark redesign. Map kept as-is (AreasMap, MapLibre).
 * Runs entirely on MOCK DATA — no API. Areas, assignees and workload are local
 * state so edit/create/assign/delete are fully interactive for testing.
 */

import React, { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Plus, MapPin, Search, MoreHorizontal, Pencil, Users, Trash2, X, Check,
  ArrowUpDown, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AreasMap, type HeatOverlay } from "@/components/area/AreasMap"
import { getCampaignAreas, setAreaEmployees, type Area } from "@/services/areaService"
import { fetchAllCampaigns } from "@/services/campaignService"
import { fetchAssignable } from "@/lib/api/users"
import { fetchHeatmap, type HeatmapMetric } from "@/lib/api/heatmap"
import { RoyMascot, type RoyState } from "@/components/gamification/RoyMascot"
import { AreaStatsPanel } from "./AreaStatsPanel"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

// Per-area stats date window (mirrors the retired Geografi period filter).
type Period = "uke" | "maaned" | "kvartal" | "alle"
const PERIODS: { key: Period; label: string }[] = [
  { key: "uke", label: "7 dager" }, { key: "maaned", label: "30 dager" },
  { key: "kvartal", label: "90 dager" }, { key: "alle", label: "Alle" },
]
function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function rangeFor(p: Period): { start?: string; end?: string } {
  if (p === "alle") return {}  // all-time → no recorded_at filter (backend default)
  const start = new Date()
  start.setDate(start.getDate() - (p === "uke" ? 6 : p === "maaned" ? 29 : 89))
  return { start: ymd(start), end: ymd(new Date()) }
}

// Cosmetic mascot per person id (deterministic by id hash — not data).
const ROY_STATES: RoyState[] = ["ready", "idle", "win-small", "greeting", "thinking", "win-big"]
const personRoy = (id: string): RoyState => ROY_STATES[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % ROY_STATES.length]

// ─── Filter campaign shape (loaded from the real backend) ──────────────────────

interface FilterCampaign { id: string; name: string; color: string }

// ─── Mock areas (Oslo polygons) ──────────────────────────────────────────────

function box(lng: number, lat: number, w = 0.026, h = 0.014) {
  return { type: "Polygon", coordinates: [[[lng - w, lat - h], [lng + w, lat - h], [lng + w, lat + h], [lng - w, lat + h], [lng - w, lat - h]]] }
}

interface MockArea extends Area { __assignees?: { id: string; name: string }[]; load: number }

const AREA_COLORS = ["#10b981", "#ec4899", "#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#f43f5e"]
const nbFmt = new Intl.NumberFormat("nb-NO")

function loadColor(load: number) {
  if (load >= 0.85) return "#f43f5e"
  if (load >= 0.6) return "#f59e0b"
  if (load > 0) return "#10b981"
  return "rgba(255,255,255,0.2)"
}

// ─── Modal shell (animated popup) ─────────────────────────────────────────────

function Modal({ open, onClose, children, width = "max-w-md" }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
          style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }} onClick={e => e.stopPropagation()}
            className={cn("w-full rounded-2xl border border-ab-line bg-ab-overlay shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)]", width)}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ab-fg-3 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full h-10 rounded-xl border border-ab-line bg-ab-elevated px-3.5 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50 transition-all"

// ─── Main ─────────────────────────────────────────────────────────────────────

type ModalKind = null | { kind: "create" } | { kind: "edit"; area: MockArea } | { kind: "assign"; area: MockArea } | { kind: "delete"; area: MockArea }

export function OmraderView() {
  const reduced = useReducedMotion()
  // Areas are scoped to the selected campaign and only loaded after one is
  // picked (a campaign can have thousands of areas — never load them all).
  const [areas, setAreas] = useState<MockArea[]>([])
  const [areasLoading, setAreasLoading] = useState(false)
  const [areasTotal, setAreasTotal] = useState(0)
  const [areasPage, setAreasPage] = useState(1)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null)
  const [highlightedAreaIds, setHighlightedAreaIds] = useState<string[] | null>(null)
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null)
  const [campOpen, setCampOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<FilterCampaign[]>([])
  const [heatMetric, setHeatMetric] = useState<HeatmapMetric | null>(null)
  const [heat, setHeat] = useState<HeatOverlay | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<Period>("alle")
  const isMobile = useIsMobile()
  const range = useMemo(() => rangeFor(period), [period])

  // Load real campaigns for the filter (tiles + scoped fetches need real UUIDs).
  // `Campaign` has no color, so assign one from the palette by index.
  useEffect(() => {
    let cancelled = false
    fetchAllCampaigns()
      .then((cs) => {
        if (cancelled) return
        setCampaigns(cs.map((c, i) => ({ id: c.id, name: c.name, color: AREA_COLORS[i % AREA_COLORS.length] })))
      })
      .catch(() => { /* leave empty */ })
    return () => { cancelled = true }
  }, [])

  // The backend returns a campaign's FULL area list in one call, so fetch it ONCE
  // per campaign and paginate/search CLIENT-SIDE. (A campaign can have thousands of
  // areas — rendering all of them as animated rows froze the browser; we now render
  // only the current page. The map draws all polygons via MVT tiles regardless.)
  const PAGE_SIZE = 10
  const decorate = (a: Area): MockArea => ({ ...a, load: 0, __assignees: [] })

  useEffect(() => {
    if (!campaignFilter) { setAreas([]); setAreasTotal(0); setAreasLoading(false); return }
    let cancelled = false
    setAreasLoading(true)
    getCampaignAreas(campaignFilter, 1, 10000)
      .then((res) => {
        if (cancelled) return
        setAreas(res.results.map(decorate))
        setAreasTotal(res.count)
      })
      .catch(() => { if (!cancelled) { setAreas([]); setAreasTotal(0) } })
      .finally(() => { if (!cancelled) setAreasLoading(false) })
    return () => { cancelled = true }
  }, [campaignFilter])

  // Reset to page 1 whenever the working set changes.
  useEffect(() => { setAreasPage(1) }, [campaignFilter, search])

  // Heatmap overlay: color areas by metric (ja-rate/doors), joined on area_id.
  useEffect(() => {
    if (!campaignFilter || !heatMetric) { setHeat(null); return }
    let cancelled = false
    fetchHeatmap(heatMetric, campaignFilter)
      .then((cells) => {
        if (cancelled) return
        const values: Record<string, number> = {}
        let max = 0
        cells.forEach((c) => { values[c.area_id] = c.value; if (c.value > max) max = c.value })
        setHeat({ metric: heatMetric, values, max })
      })
      .catch(() => { if (!cancelled) setHeat(null) })
    return () => { cancelled = true }
  }, [campaignFilter, heatMetric])

  // Areas are campaign-scoped server-side; filter by the search box client-side
  // (the backend returns the campaign's full area list in one call).
  const filteredAreas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? areas.filter(a => (a.name || "").toLowerCase().includes(q)) : areas
  }, [areas, search])
  const totalPages = Math.max(1, Math.ceil(filteredAreas.length / PAGE_SIZE))
  // Only the current page is rendered — thousands of animated rows froze the tab.
  const pagedAreas = useMemo(
    () => filteredAreas.slice((areasPage - 1) * PAGE_SIZE, areasPage * PAGE_SIZE),
    [filteredAreas, areasPage],
  )
  const selectedArea = useMemo(
    () => areas.find(a => a.id === selectedAreaId) ?? null,
    [areas, selectedAreaId],
  )

  // mutations
  const upsertArea = (area: MockArea) => setAreas(prev => prev.some(a => a.id === area.id) ? prev.map(a => a.id === area.id ? area : a) : [area, ...prev])
  const removeArea = (id: string) => setAreas(prev => prev.filter(a => a.id !== id))

  const campaignName = campaignFilter ? (campaigns.find(c => c.id === campaignFilter)?.name ?? "Kampanje") : "Velg kampanje"

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-emerald-600/8 blur-3xl" />
      </div>

      <div className="relative px-4 sm:px-6 py-5 sm:py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-ab-fg-4 mb-1">Geografisk fordeling · Kapasitet</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-ab-fg">Områder</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Stats period (drives the area-detail panel window) */}
            <div className="hidden sm:flex gap-1 rounded-xl bg-ab-elevated border border-ab-line p-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={cn("cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all",
                    period === p.key ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Campaign filter */}
            <div className="relative">
              <button onClick={() => setCampOpen(o => !o)}
                className="cursor-pointer flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm font-medium text-ab-fg-2 hover:text-ab-fg hover:border-ab-line transition-all">
                <MapPin className="h-3.5 w-3.5" /> {campaignName}
                <ChevronDown className="h-3.5 w-3.5 text-ab-fg-3" />
              </button>
              <AnimatePresence>
                {campOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCampOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}
                      className="absolute right-0 top-full mt-2 z-20 w-56 max-h-80 overflow-y-auto rounded-xl border border-ab-line bg-ab-overlay shadow-2xl py-1">
                      {campaigns.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-ab-fg-3">Ingen kampanjer</div>
                      ) : campaigns.map(c => (
                        <button key={c.id} onClick={() => { setCampaignFilter(c.id); setAreasPage(1); setSelectedAreaId(null); setCampOpen(false) }}
                          className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-ab-hover text-left">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="flex-1 text-ab-fg-2 truncate">{c.name}</span>
                          {campaignFilter === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => setModal({ kind: "create" })}
              className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:bg-blue-500 transition-all">
              <Plus className="h-4 w-4" /> Nytt område
            </button>
          </div>
        </motion.div>

        {/* List + Map */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,440px)_1fr] gap-5" style={{ minHeight: 540 }}>
          {/* Left: area list ↔ area-stats panel (desktop swaps in place; mobile uses a Sheet) */}
          {selectedAreaId && !isMobile ? (
            <AreaStatsPanel
              areaId={selectedAreaId}
              campaign={campaignFilter ?? undefined}
              fallbackName={selectedArea?.name}
              accent={selectedArea?.color}
              start={range.start}
              end={range.end}
              onBack={() => setSelectedAreaId(null)}
            />
          ) : (
          <motion.div initial={reduced ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl overflow-hidden flex flex-col">
            {/* Search */}
            {campaignFilter && (
              <div className="px-3 pt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-4" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk område…"
                    className="w-full h-9 rounded-xl border border-ab-line bg-ab-elevated pl-8 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" />
                </div>
              </div>
            )}
            <div className="px-4 py-3 border-b border-ab-line grid grid-cols-[1fr_auto_auto] gap-3 items-center text-[10px] font-bold uppercase tracking-wider text-ab-fg-3">
              <span>Område</span><span className="text-right pr-2">Dører · Last</span><span className="text-right">Tildelt</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-ab-line">
              {filteredAreas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MapPin className="h-7 w-7 text-ab-fg-4 mb-3" />
                  {!campaignFilter ? (
                    <>
                      <p className="text-sm text-ab-fg-3">Velg en kampanje</p>
                      <p className="text-xs text-ab-fg-4 mt-1">Områdene lastes når du velger en kampanje</p>
                    </>
                  ) : areasLoading ? (
                    <p className="text-sm text-ab-fg-3">Laster områder…</p>
                  ) : (
                    <>
                      <p className="text-sm text-ab-fg-3">Ingen områder i denne kampanjen</p>
                      <p className="text-xs text-ab-fg-4 mt-1">Prøv en annen kampanje</p>
                    </>
                  )}
                </div>
              ) : pagedAreas.map((area, i) => {
                const selected = selectedAreaId === area.id
                return (
                  <motion.div key={area.id}
                    initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}
                    onMouseEnter={() => setHoveredAreaId(area.id)} onMouseLeave={() => setHoveredAreaId(null)}
                    onClick={() => setSelectedAreaId(selected ? null : area.id)}
                    className={cn("group relative cursor-pointer px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center transition-colors",
                      selected ? "bg-ab-hover" : "hover:bg-ab-hover")}>
                    {selected && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: area.color }} />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: area.color }} />
                        <span className="text-sm font-semibold text-ab-fg truncate">{area.name}</span>
                      </div>
                      <span className="text-xs text-ab-fg-3 ml-4.5">{area.campaign?.name ?? "Uten kampanje"}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-semibold text-ab-fg-2">{nbFmt.format(area.doors ?? area.house_count ?? 0)}</span>
                      <div className="mt-1 h-1 w-16 ml-auto overflow-hidden rounded-full bg-ab-hover">
                        <div className="h-full rounded-full" style={{ width: `${(area.load) * 100}%`, background: loadColor(area.load) }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {area.__assignees && area.__assignees.length > 0 ? (
                        <div className="flex -space-x-2">
                          {area.__assignees.slice(0, 3).map(as => (
                            <div key={as.id} className="rounded-full ring-2 ring-ab-base" title={as.name}><RoyMascot state={personRoy(as.id)} size={24} /></div>
                          ))}
                        </div>
                      ) : <span className="text-xs text-ab-fg-4">—</span>}
                      {/* row menu */}
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === area.id ? null : area.id) }}
                          className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-ab-fg-4 hover:text-ab-fg hover:bg-ab-hover opacity-0 group-hover:opacity-100 transition-all">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <AnimatePresence>
                          {menuFor === area.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuFor(null) }} />
                              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.12 }}
                                className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-ab-line bg-ab-overlay shadow-2xl py-1"
                                onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setModal({ kind: "edit", area }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ab-fg-2 hover:bg-ab-hover text-left"><Pencil className="h-3.5 w-3.5" /> Rediger</button>
                                <button onClick={() => { setModal({ kind: "assign", area }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ab-fg-2 hover:bg-ab-hover text-left"><Users className="h-3.5 w-3.5" /> Tildel ansatte</button>
                                <button onClick={() => { setModal({ kind: "delete", area }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 text-left"><Trash2 className="h-3.5 w-3.5" /> Slett</button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            {/* Pagination footer (client-side over the filtered set) */}
            {campaignFilter && filteredAreas.length > 0 && (
              <div className="px-4 py-3 border-t border-ab-line flex items-center justify-between gap-3">
                <span className="text-[11px] text-ab-fg-3">
                  Side {areasPage} av {totalPages} · {nbFmt.format(filteredAreas.length)} områder
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setAreasPage(p => Math.max(1, p - 1))} disabled={areasLoading || areasPage <= 1}
                    className="cursor-pointer rounded-lg border border-ab-line bg-ab-elevated px-3 py-1.5 text-xs font-medium text-ab-fg-2 hover:text-ab-fg hover:border-ab-line transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    Forrige
                  </button>
                  <button onClick={() => setAreasPage(p => Math.min(totalPages, p + 1))} disabled={areasLoading || areasPage >= totalPages}
                    className="cursor-pointer rounded-lg border border-ab-line bg-ab-elevated px-3 py-1.5 text-xs font-medium text-ab-fg-2 hover:text-ab-fg hover:border-ab-line transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    {areasLoading ? "Laster…" : "Neste"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
          )}

          {/* Map (kept as-is) */}
          <motion.div initial={reduced ? false : { opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-ab-line overflow-hidden relative min-h-[60vh] xl:min-h-0">
            {/* Heatmap metric toggle */}
            {campaignFilter && (
              <div className="absolute top-3 left-3 z-[2] flex gap-1 rounded-xl border border-ab-line bg-ab-overlay backdrop-blur-md p-1 shadow-lg">
                {([["", "Ingen"], ["doors", "Dører"], ["ja_rate", "Ja-rate"]] as const).map(([key, label]) => {
                  const active = (heatMetric ?? "") === key
                  return (
                    <button key={label} onClick={() => setHeatMetric(key === "" ? null : key)}
                      className={cn("cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all", active ? "bg-blue-600 text-white" : "text-ab-fg-3 hover:text-ab-fg")}>
                      {label}
                    </button>
                  )
                })}
                {heat && heat.max > 0 && (
                  <span className="flex items-center gap-1 px-2 text-[10px] text-ab-fg-3">
                    <span className="h-2 w-10 rounded-full" style={{ background: "linear-gradient(90deg, rgb(37,99,235), rgb(14,165,165), rgb(16,185,129))" }} />
                    {heatMetric === "ja_rate" ? `0–${heat.max.toFixed(0)}%` : `0–${nbFmt.format(heat.max)}`}
                  </span>
                )}
              </div>
            )}
            <AreasMap
              campaignId={campaignFilter}
              areas={areas}
              selectedAreaId={selectedAreaId}
              hoveredAreaId={hoveredAreaId}
              highlightedAreaIds={highlightedAreaIds}
              onAreaSelect={setSelectedAreaId}
              onAreaHover={setHoveredAreaId}
              onOpenEdit={(area) => setModal({ kind: "edit", area: area as MockArea })}
              heat={heat}
            />
          </motion.div>
        </div>

      </div>

      {/* Mobile: area stats slide up over the map instead of pushing it off-screen */}
      <Sheet open={isMobile && !!selectedAreaId} onOpenChange={(o) => { if (!o) setSelectedAreaId(null) }}>
        <SheetContent side="bottom" className="h-[86vh] p-0 border-ab-line bg-transparent">
          {isMobile && selectedAreaId && (
            <div className="h-full p-2">
              <AreaStatsPanel
                areaId={selectedAreaId}
                fallbackName={selectedArea?.name}
                accent={selectedArea?.color}
                start={range.start}
                end={range.end}
                onBack={() => setSelectedAreaId(null)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modals */}
      <AreaModals modal={modal} campaigns={campaigns} onClose={() => setModal(null)} onSave={upsertArea} onDelete={removeArea} />
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AreaModals({ modal, campaigns, onClose, onSave, onDelete }: {
  modal: ModalKind; campaigns: FilterCampaign[]; onClose: () => void; onSave: (a: MockArea) => void; onDelete: (id: string) => void
}) {
  // Create / Edit form state
  const editing = modal && modal.kind === "edit" ? modal.area : null
  const [name, setName] = useState("")
  const [color, setColor] = useState(AREA_COLORS[0])
  const [campaignId, setCampaignId] = useState<string>("")
  const [assignSel, setAssignSel] = useState<string[]>([])
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [assignSaving, setAssignSaving] = useState(false)

  React.useEffect(() => {
    if (!modal) return
    if (modal.kind === "edit") { setName(modal.area.name); setColor(modal.area.color) }
    else if (modal.kind === "create") { setName(""); setColor(AREA_COLORS[Math.floor(Math.random() * AREA_COLORS.length)]); setCampaignId(campaigns[0]?.id ?? "") }
    else if (modal.kind === "assign") {
      setAssignSel((modal.area.__assignees ?? []).map(a => a.id))
      // Live assignable users for the picker.
      fetchAssignable().then(({ results }) => setPeople(results.map(u => ({ id: u.id, name: u.name || u.username })))).catch(() => setPeople([]))
    }
  }, [modal, campaigns])

  // Persist area-employee assignment to the backend, then close + refresh list.
  const saveAssign = async (areaId: string) => {
    setAssignSaving(true)
    try { await setAreaEmployees(areaId, assignSel) } catch { /* surfaced on reload */ }
    setAssignSaving(false)
    onSave({ ...(modal as any).area, __assignees: assignSel.map(id => ({ id, name: people.find(p => p.id === id)?.name ?? "" })) })
    onClose()
  }

  if (!modal) return <Modal open={false} onClose={onClose}><div /></Modal>

  if (modal.kind === "delete") {
    return (
      <Modal open onClose={onClose} width="max-w-sm">
        <div className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 mb-4"><Trash2 className="h-5 w-5 text-rose-400" /></div>
          <h2 className="text-lg font-bold text-ab-fg mb-1">Slett område</h2>
          <p className="text-sm text-ab-fg-3 mb-5">Er du sikker på at du vil slette <span className="text-ab-fg-2 font-medium">{modal.area.name}</span>? Dette kan ikke angres.</p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-all">Avbryt</button>
            <button onClick={() => { onDelete(modal.area.id); onClose() }} className="cursor-pointer rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition-all">Slett</button>
          </div>
        </div>
      </Modal>
    )
  }

  if (modal.kind === "assign") {
    const area = modal.area
    return (
      <Modal open onClose={onClose}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ab-line">
          <div><h2 className="text-lg font-bold text-ab-fg">Tildel ansatte</h2><p className="text-xs text-ab-fg-3">{area.name}</p></div>
          <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3 max-h-80 overflow-y-auto">
          {people.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ab-fg-3">Laster ansatte…</p>
          ) : people.map(p => {
            const on = assignSel.includes(p.id)
            return (
              <button key={p.id} onClick={() => setAssignSel(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])}
                className="cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-ab-hover text-left transition-colors">
                <RoyMascot state={personRoy(p.id)} size={30} />
                <span className="flex-1 text-sm text-ab-fg-2">{p.name}</span>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border transition-colors", on ? "bg-blue-600 border-blue-600" : "border-ab-line")}>{on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ab-line">
          <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover">Avbryt</button>
          <button onClick={() => saveAssign(area.id)} disabled={assignSaving}
            className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">{assignSaving ? "Lagrer…" : `Lagre (${assignSel.length})`}</button>
        </div>
      </Modal>
    )
  }

  // create / edit
  const isCreate = modal.kind === "create"
  const submit = () => {
    if (!name.trim()) return
    if (isCreate) {
      const camp = campaigns.find(c => c.id === campaignId)
      onSave({ id: `a${Date.now()}`, name: name.trim(), color, house_count: 200 + Math.floor(Math.random() * 400),
        polygon_geometry: box(10.70 + Math.random() * 0.1, 59.90 + Math.random() * 0.05),
        campaign: camp ? { id: camp.id, name: camp.name, description: "" } : null,
        load: 0, __assignees: [], created_at: "", updated_at: "" })
    } else if (editing) {
      onSave({ ...editing, name: name.trim(), color })
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-ab-line">
        <h2 className="text-lg font-bold text-ab-fg">{isCreate ? "Nytt område" : "Rediger område"}</h2>
        <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-5 space-y-4">
        <Field label="Navn"><input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Områdenavn" className={inputCls} onKeyDown={e => e.key === "Enter" && submit()} /></Field>
        <Field label="Farge">
          <div className="flex gap-2">
            {AREA_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={cn("cursor-pointer h-8 w-8 rounded-lg transition-transform hover:scale-110", color === c && "ring-2 ring-ab-line ring-offset-2 ring-offset-ab-base")} style={{ background: c }} />
            ))}
          </div>
        </Field>
        {isCreate && (
          <Field label="Kampanje">
            <div className="flex flex-wrap gap-1.5">
              {campaigns.map(c => (
                <button key={c.id} onClick={() => setCampaignId(c.id)}
                  className={cn("cursor-pointer flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all", campaignId === c.id ? "bg-ab-active text-ab-fg" : "bg-ab-elevated text-ab-fg-3 hover:text-ab-fg-2")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ab-line">
        <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover">Avbryt</button>
        <button onClick={submit} disabled={!name.trim()} className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">{isCreate ? "Opprett" : "Lagre"}</button>
      </div>
    </Modal>
  )
}

export default OmraderView
