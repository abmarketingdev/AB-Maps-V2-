"use client"

/**
 * Kampanjer — glassmorphism dark redesign. Live data via /lib/api/campaigns.
 * List ↔ Grid toggle, search, sort, animated detail side-sheet, create/edit modal.
 * Employee/manager assignment uses the live drag-and-drop AssignEmployeesModal
 * (POST/DELETE /api/campaigns/campaigns/{id}/add_employee|remove_employee/).
 */

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Plus, Search, LayoutGrid, List as ListIcon, X, ArrowUpDown, MapPin, Users,
  TrendingUp, Pencil, Trash2, Check, Hash, ChevronDown, UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoyMascot, type RoyState } from "@/components/gamification/RoyMascot"
import { fetchCampaignsWithStats, updateCampaignStatus } from "@/lib/api/campaigns"
import { createCampaign, updateCampaign, deleteCampaign } from "@/services/campaignService"
import { fetchWithAuth } from "@/lib/auth/fetchWithAuth"
import { buildApiUrl } from "@/lib/config/apiConfig"
import EnhancedAssignEmployeesModal from "@/components/campaign/AssignEmployeesModal"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

const ROY_STATES: RoyState[] = ["ready", "idle", "win-small", "greeting", "thinking", "win-big"]
const personRoy = (id: string): RoyState => ROY_STATES[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % ROY_STATES.length]

type CampStatus = "active" | "paused" | "ended"
const STATUS_META: Record<CampStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Aktiv", color: "#10b981", bg: "bg-emerald-500/15" },
  paused: { label: "På pause", color: "#f59e0b", bg: "bg-amber-500/15" },
  ended:  { label: "Avsluttet", color: "#6b7280", bg: "bg-ab-hover" },
}

interface Campaign {
  id: string; name: string; description: string; color: string; status: CampStatus
  areas: number; employeeIds: string[]; salesWeek: number; salesLifetime: number; created: Date
  availableDoors: number; knocked: number; pctComplete: number; totalJa: number
}

const COLORS = ["#10b981", "#ec4899", "#f59e0b", "#06b6d4", "#3b82f6", "#8b5cf6", "#f43f5e"]
const nbFmt = new Intl.NumberFormat("nb-NO")

type SortKey = "active" | "name" | "newest" | "sales" | "employees"
const SORTS: { key: SortKey; label: string }[] = [
  { key: "active", label: "Sist aktiv" }, { key: "name", label: "Navn A–Å" },
  { key: "newest", label: "Nyeste" }, { key: "sales", label: "Antall salg" }, { key: "employees", label: "Antall ansatte" },
]

function AvatarStack({ ids, size = 24 }: { ids: string[]; size?: number }) {
  if (ids.length === 0) return <span className="text-xs text-ab-fg-4">—</span>
  return (
    <div className="flex -space-x-2">
      {ids.slice(0, 3).map(id => <div key={id} className="rounded-full ring-2 ring-ab-base"><RoyMascot state={personRoy(id)} size={size} /></div>)}
      {ids.length > 3 && <div className="flex items-center justify-center rounded-full bg-ab-hover ring-2 ring-ab-base text-[10px] font-bold text-ab-fg-2" style={{ width: size, height: size }}>+{ids.length - 3}</div>}
    </div>
  )
}

function StatusBadge({ s }: { s: CampStatus }) {
  const m = STATUS_META[s]
  return <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit", m.bg)} style={{ color: m.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}</span>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function KampanjeView() {
  const reduced = useReducedMotion()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const [view, setView] = useState<"list" | "grid">("list")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("active")
  const [sortOpen, setSortOpen] = useState(false)
  const [detail, setDetail] = useState<Campaign | null>(null)
  const [modal, setModal] = useState<null | { kind: "create" } | { kind: "edit"; c: Campaign }>(null)
  const [confirmDel, setConfirmDel] = useState<Campaign | null>(null)
  const [assignFor, setAssignFor] = useState<Campaign | null>(null)

  const filtered = useMemo(() => {
    let out = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()))
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "name": return a.name.localeCompare(b.name)
        case "newest": return b.created.getTime() - a.created.getTime()
        case "sales": return b.salesLifetime - a.salesLifetime
        case "employees": return b.employeeIds.length - a.employeeIds.length
        default: return b.salesWeek - a.salesWeek
      }
    })
    return out
  }, [campaigns, search, sort])

  const load = useCallback(() => {
    setLoading(true); setErrored(false)
    return fetchCampaignsWithStats()
      .then((list) => setCampaigns(list))
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { void load() }, [load])

  // Create/edit/delete → live campaign endpoints, then refetch.
  const upsert = async (c: Campaign, isCreate: boolean) => {
    try {
      if (isCreate) {
        await createCampaign({ name: c.name, description: c.description, areaIds: [] })
      } else {
        await updateCampaign(c.id, { name: c.name, description: c.description, brand_color_hex: c.color } as any)
        await updateCampaignStatus(c.id, c.status)
      }
    } catch { /* surfaced by reload */ }
    setDetail(null)
    void load()
  }
  const remove = async (id: string) => {
    try { await deleteCampaign(id) } catch { /* surfaced by reload */ }
    setDetail(null)
    void load()
  }

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative px-4 sm:px-6 py-5 sm:py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-ab-fg-4 mb-1">Arbeidsflate · Kampanjer</p>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-ab-fg">Kampanjer</h1>
              <span className="rounded-full bg-ab-hover px-2.5 py-0.5 text-sm font-mono font-semibold text-ab-fg-2">{campaigns.length}</span>
            </div>
            <p className="mt-1 text-sm text-ab-fg-3">Administrer kampanjer på tvers av regionen</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-ab-elevated border border-ab-line p-1">
              <button onClick={() => setView("list")} className={cn("cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg transition-all", view === "list" ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}><ListIcon className="h-4 w-4" /></button>
              <button onClick={() => setView("grid")} className={cn("cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg transition-all", view === "grid" ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}><LayoutGrid className="h-4 w-4" /></button>
            </div>
            <button onClick={() => setModal({ kind: "create" })}
              className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:bg-blue-500 transition-all">
              <Plus className="h-4 w-4" /> Opprett kampanje
            </button>
          </div>
        </motion.div>

        {/* Toolbar */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ab-fg-4" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk kampanjer…"
              className="w-full h-10 rounded-xl border border-ab-line bg-ab-elevated pl-9 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <div className="relative">
            <button onClick={() => setSortOpen(o => !o)} className="cursor-pointer flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm font-medium text-ab-fg-2 hover:text-ab-fg hover:border-ab-line transition-all">
              <ArrowUpDown className="h-3.5 w-3.5" /> Sortér: {SORTS.find(s => s.key === sort)!.label} <ChevronDown className="h-3.5 w-3.5 text-ab-fg-3" />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}
                    className="absolute left-0 top-full mt-2 z-20 w-48 rounded-xl border border-ab-line bg-ab-overlay shadow-2xl py-1">
                    {SORTS.map(s => (
                      <button key={s.key} onClick={() => { setSort(s.key); setSortOpen(false) }} className="cursor-pointer w-full flex items-center px-3 py-2 text-sm hover:bg-ab-hover text-left">
                        <span className="flex-1 text-ab-fg-2">{s.label}</span>{sort === s.key && <Check className="h-3.5 w-3.5 text-blue-400" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <span className="ml-auto text-sm text-ab-fg-4">Vis: {filtered.length} / {campaigns.length}</span>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelLoading label="Laster kampanjer…" /></div>
        ) : errored ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelError onRetry={() => void load()} /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelEmpty msg="Ingen kampanjer funnet" /></div>
        ) : view === "list" ? (
          <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-ab-line grid grid-cols-[1fr_90px_120px_120px_110px] gap-4 items-center text-[10px] font-bold uppercase tracking-wider text-ab-fg-4">
              <span>Kampanje</span><span className="text-center">Områder</span><span>Ansatte</span><span className="text-right">Salg · uken</span><span className="text-right">Opprettet</span>
            </div>
            <div className="divide-y divide-ab-line">
              {filtered.map((c, i) => (
                <motion.button key={c.id} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  onClick={() => setDetail(c)} className="cursor-pointer w-full px-5 py-4 grid grid-cols-[1fr_90px_120px_120px_110px] gap-4 items-center hover:bg-ab-hover transition-colors text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-sm font-semibold text-ab-fg truncate">{c.name}</span>
                      <StatusBadge s={c.status} />
                    </div>
                    <p className="text-xs text-ab-fg-4 truncate mt-0.5 ml-5">{c.description}</p>
                  </div>
                  <span className="text-center font-mono text-sm text-ab-fg-2">{c.areas}</span>
                  <AvatarStack ids={c.employeeIds} />
                  <span className="text-right font-mono text-sm font-semibold text-emerald-400">{nbFmt.format(c.salesWeek)}</span>
                  <span className="text-right text-xs text-ab-fg-3">{c.created.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c, i) => (
              <motion.button key={c.id} initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setDetail(c)}
                className="group cursor-pointer text-left rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5 hover:border-ab-line transition-all duration-200"
                style={{ ['--c' as any]: c.color }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: `${c.color}22` }}><Hash className="h-5 w-5" style={{ color: c.color }} /></div>
                  <StatusBadge s={c.status} />
                </div>
                <h3 className="text-base font-bold text-ab-fg mb-1">{c.name}</h3>
                <p className="text-xs text-ab-fg-3 line-clamp-2 mb-4 min-h-[2rem]">{c.description}</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[{ Icon: MapPin, v: c.areas, l: "Områder" }, { Icon: Users, v: c.employeeIds.length, l: "Ansatte" }, { Icon: TrendingUp, v: c.salesWeek, l: "Salg/uke" }].map((m, j) => (
                    <div key={j} className="rounded-xl bg-ab-inset px-2 py-2 text-center">
                      <m.Icon className="h-3.5 w-3.5 mx-auto mb-1 text-ab-fg-4" />
                      <p className="font-mono text-sm font-bold text-ab-fg">{m.v}</p><p className="text-[9px] text-ab-fg-4">{m.l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <AvatarStack ids={c.employeeIds} />
                  <span className="text-[10px] text-ab-fg-4">{c.created.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}</span>
                </div>
                <div className="mt-3 h-[2px] w-full opacity-0 group-hover:opacity-100 transition-opacity rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }} />
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <DetailSheet campaign={detail} onClose={() => setDetail(null)} onEdit={(c) => { setDetail(null); setModal({ kind: "edit", c }) }} onDelete={(c) => { setDetail(null); setConfirmDel(c) }} onAssign={(c) => setAssignFor(c)} />

      {/* Create/Edit modal */}
      <CampaignModal modal={modal} onClose={() => setModal(null)} onSave={upsert} />

      <EnhancedAssignEmployeesModal
        open={!!assignFor}
        campaign={assignFor}
        onClose={() => setAssignFor(null)}
        onSuccess={() => { void load() }}
      />

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh] px-4" style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={() => setConfirmDel(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-ab-line bg-ab-overlay shadow-2xl p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 mb-4"><Trash2 className="h-5 w-5 text-rose-400" /></div>
              <h2 className="text-lg font-bold text-ab-fg mb-1">Slett kampanje</h2>
              <p className="text-sm text-ab-fg-3 mb-5">Slette <span className="text-ab-fg-2 font-medium">{confirmDel.name}</span>? Dette kan ikke angres.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDel(null)} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover">Avbryt</button>
                <button onClick={() => { remove(confirmDel.id); setConfirmDel(null) }} className="cursor-pointer rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500">Slett</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Detail side-sheet ────────────────────────────────────────────────────────

interface AssignedPerson { id: string; name: string; person_type?: string }

function DetailSheet({ campaign, onClose, onEdit, onDelete, onAssign }: {
  campaign: Campaign | null; onClose: () => void; onEdit: (c: Campaign) => void; onDelete: (c: Campaign) => void; onAssign: (c: Campaign) => void
}) {
  const [assigned, setAssigned] = useState<AssignedPerson[]>([])
  useEffect(() => {
    let cancelled = false
    if (!campaign) { setAssigned([]); return }
    fetchWithAuth(buildApiUrl(`/api/campaigns/campaigns/${campaign.id}/assigned_employees/`))
      .then(r => (r.ok ? r.json() : []))
      .then((rows) => { if (!cancelled) setAssigned(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (!cancelled) setAssigned([]) })
    return () => { cancelled = true }
  }, [campaign])
  return (
    <AnimatePresence>
      {campaign && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] bg-ab-overlay border-l border-ab-line overflow-y-auto">
            {/* Header */}
            <div className="relative p-6 border-b border-ab-line" style={{ background: `linear-gradient(135deg, ${campaign.color}18, transparent)` }}>
              <button onClick={onClose} className="cursor-pointer absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover"><X className="h-4 w-4" /></button>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `${campaign.color}22` }}><Hash className="h-6 w-6" style={{ color: campaign.color }} /></div>
                <div><h2 className="text-xl font-bold text-ab-fg">{campaign.name}</h2><StatusBadge s={campaign.status} /></div>
              </div>
              <p className="text-sm text-ab-fg-3">{campaign.description}</p>
            </div>

            {/* Metrics */}
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { Icon: MapPin, v: campaign.areas, l: "Områder", c: "#3b82f6" },
                  { Icon: Users, v: campaign.employeeIds.length, l: "Ansatte", c: "#8b5cf6" },
                  { Icon: TrendingUp, v: nbFmt.format(campaign.salesWeek), l: "Salg denne uken", c: "#10b981" },
                  { Icon: Check, v: nbFmt.format(campaign.totalJa), l: "Total Ja", c: "#f59e0b" },
                ].map((m, i) => (
                  <div key={i} className="rounded-xl border border-ab-line bg-ab-elevated p-4">
                    <div className="flex items-center gap-2 mb-2"><div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${m.c}22` }}><m.Icon className="h-3.5 w-3.5" style={{ color: m.c }} /></div></div>
                    <p className="font-mono text-2xl font-bold text-ab-fg">{m.v}</p><p className="text-xs text-ab-fg-3">{m.l}</p>
                  </div>
                ))}
              </div>

              {/* Doors knocked vs total (aggregated across the campaign's areas) */}
              <div className="rounded-xl border border-ab-line bg-ab-elevated p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ab-fg-3">Dører banket</p>
                  <p className="font-mono text-sm text-ab-fg-2">
                    <span className="text-ab-fg font-bold">{nbFmt.format(campaign.knocked)}</span>
                    <span className="text-ab-fg-3"> / {nbFmt.format(campaign.availableDoors)}</span>
                    <span className="ml-2 text-blue-300 font-bold">{campaign.pctComplete}%</span>
                  </p>
                </div>
                <div className="h-2 w-full rounded-full bg-ab-hover overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, campaign.pctComplete)}%`, background: `linear-gradient(90deg, ${campaign.color}, ${campaign.color}aa)` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-ab-fg-4">Oppdateres når områder legges til eller fjernes</p>
              </div>

              {/* Team */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ab-fg-3">Tildelte ansatte</p>
                  <button onClick={() => onAssign(campaign)} className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-600/15 px-2.5 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-600/25 transition-all"><UserPlus className="h-3.5 w-3.5" /> Tildel ansatte</button>
                </div>
                {assigned.length === 0 ? <p className="text-sm text-ab-fg-4">Ingen tildelt</p> : (
                  <div className="space-y-2">
                    {assigned.map(p => (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl bg-ab-elevated border border-ab-line px-3 py-2">
                        <RoyMascot state={personRoy(p.id)} size={32} />
                        <span className="text-sm font-medium text-ab-fg-2">{p.name}</span>
                        {p.person_type === "manager" && <span className="ml-auto rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">Leder</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-ab-fg-4">Opprettet {campaign.created.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 flex gap-2 p-4 border-t border-ab-line bg-ab-overlay">
              <button onClick={() => onEdit(campaign)} className="cursor-pointer flex-1 flex items-center justify-center gap-2 rounded-xl border border-ab-line bg-ab-elevated py-2.5 text-sm font-semibold text-ab-fg-2 hover:bg-ab-hover transition-all"><Pencil className="h-4 w-4" /> Rediger</button>
              <button onClick={() => onDelete(campaign)} className="cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"><Trash2 className="h-4 w-4" /></button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

function CampaignModal({ modal, onClose, onSave }: {
  modal: null | { kind: "create" } | { kind: "edit"; c: Campaign }; onClose: () => void; onSave: (c: Campaign, isCreate: boolean) => void
}) {
  const editing = modal && modal.kind === "edit" ? modal.c : null
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const [status, setStatus] = useState<CampStatus>("active")

  React.useEffect(() => {
    if (!modal) return
    if (modal.kind === "edit") { setName(modal.c.name); setDesc(modal.c.description); setColor(modal.c.color); setStatus(modal.c.status) }
    else { setName(""); setDesc(""); setColor(COLORS[Math.floor(Math.random() * COLORS.length)]); setStatus("active") }
  }, [modal])

  if (!modal) return null
  const isCreate = modal.kind === "create"
  const submit = () => {
    if (!name.trim()) return
    if (isCreate) onSave({ id: `c${Date.now()}`, name: name.trim(), description: desc.trim(), color, status, areas: 0, employeeIds: [], salesWeek: 0, salesLifetime: 0, availableDoors: 0, knocked: 0, pctComplete: 0, totalJa: 0, created: new Date() }, true)
    else if (editing) onSave({ ...editing, name: name.trim(), description: desc.trim(), color, status }, false)
    onClose()
  }

  return (
    <AnimatePresence>
      {modal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }} onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-ab-line bg-ab-overlay shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ab-line">
              <h2 className="text-lg font-bold text-ab-fg">{isCreate ? "Opprett kampanje" : "Rediger kampanje"}</h2>
              <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-ab-fg-4 hover:text-ab-fg hover:bg-ab-hover"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ab-fg-3 mb-1.5">Navn</label>
                <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Kampanjenavn" className="w-full h-10 rounded-xl border border-ab-line bg-ab-elevated px-3.5 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" onKeyDown={e => e.key === "Enter" && submit()} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ab-fg-3 mb-1.5">Beskrivelse</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Kort beskrivelse…" className="w-full rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ab-fg-3 mb-1.5">Farge</label>
                  <div className="flex flex-wrap gap-1.5">{COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={cn("cursor-pointer h-7 w-7 rounded-lg transition-transform hover:scale-110", color === c && "ring-2 ring-ab-line ring-offset-2 ring-offset-ab-base")} style={{ background: c }} />)}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ab-fg-3 mb-1.5">Status</label>
                  <div className="flex gap-1.5">{(["active", "paused", "ended"] as CampStatus[]).map(s => <button key={s} onClick={() => setStatus(s)} className={cn("cursor-pointer flex-1 rounded-lg px-1 py-2 text-xs font-semibold transition-all", status === s ? STATUS_META[s].bg : "bg-ab-elevated text-ab-fg-3 hover:text-ab-fg-2")} style={status === s ? { color: STATUS_META[s].color } : undefined}>{STATUS_META[s].label}</button>)}</div>
                </div>
              </div>
              <p className="text-xs text-ab-fg-4">Ansatte og ledere tildeles via «Tildel ansatte» i kampanjedetaljene.</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ab-line">
              <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover">Avbryt</button>
              <button onClick={submit} disabled={!name.trim()} className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">{isCreate ? "Opprett" : "Lagre"}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default KampanjeView
