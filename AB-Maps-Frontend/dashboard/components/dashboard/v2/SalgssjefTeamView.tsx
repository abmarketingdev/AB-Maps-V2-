"use client"

/**
 * Salgssjef-team — team builder redesign. Live data via sales-chief endpoints.
 * Two columns: Tilgjengelige (available) ↔ I teamet ditt (your team).
 * Flows preserved: search, role filter (Alle/Ledere/Ansatte), bulk-select +
 * bulk add/remove, single add/remove, drag cards between columns, refresh.
 * Glassmorphism dark, Framer Motion, consistent with the rest of the v2 pages.
 */

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Search, Plus, X, Check, Users, RotateCw, GripVertical, UserCog, ArrowRight, ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoyMascot, type RoyState } from "@/components/gamification/RoyMascot"
import { useAuth } from "@/lib/auth/AuthContext"
import {
  fetchMyTeam, fetchAvailablePeople, addTeamMember, removeTeamMember,
  bulkAddTeamMembers, bulkRemoveTeamMembers,
  type TeamMember, type AvailablePerson,
} from "@/services/salesChiefService"
import { PanelLoading, PanelError } from "./_states"

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = "manager" | "employee"
interface Person { id: string; firstName: string; lastName: string; username: string; email: string; abId: string; role: Role; online: boolean; inTeam: boolean }

const ROLE_META: Record<Role, { label: string; color: string; bg: string }> = {
  manager:  { label: "Leder",  color: "#8b5cf6", bg: "bg-purple-500/15" },
  employee: { label: "Ansatt", color: "#3b82f6", bg: "bg-blue-500/15" },
}
const ROY_STATES: RoyState[] = ["ready", "idle", "win-small", "greeting", "thinking", "win-big"]
const personRoy = (id: string): RoyState => ROY_STATES[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % ROY_STATES.length]

function toPerson(m: TeamMember | AvailablePerson, inTeam: boolean): Person {
  const parts = (m.name || m.username || "").trim().split(/\s+/)
  return {
    id: m.user_id, firstName: parts[0] ?? "", lastName: parts.slice(1).join(" "),
    username: m.username, email: m.email ?? "", abId: m.ab_person_id ?? "",
    role: m.role, online: !!m.is_online, inTeam,
  }
}

const fullName = (p: Person) => `${p.firstName} ${p.lastName}`

// ─── Person card ──────────────────────────────────────────────────────────────

function PersonCard({ p, side, selected, onToggleSelect, onMove, onDragStart, onDragEnd, dragging }: {
  p: Person; side: "available" | "team"; selected: boolean
  onToggleSelect: () => void; onMove: () => void
  onDragStart: () => void; onDragEnd: () => void; dragging: boolean
}) {
  const m = ROLE_META[p.role]
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border bg-white/[0.035] p-3 transition-all duration-150 cursor-grab active:cursor-grabbing hover:bg-white/[0.06]",
        selected ? "border-blue-500/50 bg-blue-500/[0.06]" : "border-white/[0.08] hover:border-white/20",
        dragging && "opacity-50 rotate-[1deg] shadow-2xl ring-1 ring-blue-500/40"
      )}
    >
      {/* Drag handle + checkbox */}
      <div className="flex items-center gap-1.5 shrink-0">
        <GripVertical className="h-4 w-4 text-white/15 group-hover:text-white/35 transition-colors" />
        <button onClick={onToggleSelect}
          className={cn("cursor-pointer flex h-4 w-4 items-center justify-center rounded border transition-colors", selected ? "bg-blue-600 border-blue-600" : "border-white/20 hover:border-white/40")}>
          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </button>
      </div>

      {/* Avatar */}
      <div className="relative shrink-0">
        <RoyMascot state={personRoy(p.id)} size={38} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1528]", p.online ? "bg-emerald-500" : "bg-white/25")} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/90 truncate">{fullName(p)}</span>
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", m.bg)} style={{ color: m.color }}>
            {p.role === "manager" ? <UserCog className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}{m.label}
          </span>
        </div>
        <p className="text-xs text-white/40 truncate">{p.email}</p>
        <p className="text-[11px] text-white/25">@{p.username} · AB #{p.abId}</p>
      </div>

      {/* Action */}
      <button onClick={onMove}
        className={cn("cursor-pointer shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
          side === "available" ? "bg-blue-600/90 text-white hover:bg-blue-500" : "bg-rose-600/90 text-white hover:bg-rose-500")}>
        {side === "available" ? <><Plus className="h-3.5 w-3.5" /> Legg til</> : <><X className="h-3.5 w-3.5" /> Fjern</>}
      </button>
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({ title, subtitle, count, accent, side, people, selected, onToggleSelect, onMove, onDropMove, onBulk, bulkCount, dragId, setDragId }: {
  title: string; subtitle: string; count: number; accent: string; side: "available" | "team"
  people: Person[]; selected: Set<string>; onToggleSelect: (id: string) => void; onMove: (id: string) => void
  onDropMove: () => void; onBulk: () => void; bulkCount: number
  dragId: string | null; setDragId: (id: string | null) => void
}) {
  const reduced = useReducedMotion()
  const [over, setOver] = useState(false)
  // a card from the OTHER side is being dragged
  const draggedFromOther = dragId !== null && people.every(p => p.id !== dragId)

  return (
    <div
      onDragOver={e => { if (draggedFromOther) { e.preventDefault(); setOver(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false) }}
      onDrop={() => { if (draggedFromOther) onDropMove(); setOver(false) }}
      className={cn("rounded-2xl border bg-white/5 backdrop-blur-xl flex flex-col transition-colors min-h-[560px]",
        over ? "border-blue-500/50 bg-blue-500/[0.04]" : "border-white/10")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <span className="font-mono text-xs font-semibold text-white/50 rounded-full bg-white/10 px-2 py-0.5">{count}</span>
            </div>
            <p className="text-xs text-white/35">{subtitle}</p>
          </div>
        </div>
        {bulkCount > 0 && (
          <button onClick={onBulk}
            className={cn("cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all",
              side === "available" ? "bg-blue-600 hover:bg-blue-500" : "bg-rose-600 hover:bg-rose-500")}>
            {side === "available" ? <><ArrowRight className="h-3.5 w-3.5" /> Legg til {bulkCount}</> : <><ArrowLeft className="h-3.5 w-3.5" /> Fjern {bulkCount}</>}
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {people.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="h-7 w-7 text-white/15 mb-3" />
              <p className="text-sm text-white/30">{side === "available" ? "Ingen tilgjengelige brukere" : "Teamet er tomt"}</p>
              <p className="text-xs text-white/20 mt-1">{side === "team" ? "Dra eller legg til brukere her" : "Prøv å justere søket"}</p>
            </motion.div>
          ) : people.map((p, i) => (
            <motion.div key={p.id} layout
              initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.02 }}>
              <PersonCard p={p} side={side} selected={selected.has(p.id)}
                onToggleSelect={() => onToggleSelect(p.id)} onMove={() => onMove(p.id)}
                onDragStart={() => setDragId(p.id)} onDragEnd={() => setDragId(null)} dragging={dragId === p.id} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type RoleFilter = "all" | "manager" | "employee"

export function SalgssjefTeamView() {
  const reduced = useReducedMotion()
  const { user } = useAuth()
  const chiefName = user?.user_info?.name || user?.username || "deg"
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setErrored(false)
    return Promise.all([fetchMyTeam(), fetchAvailablePeople({ pageSize: 200 }).catch(() => ({ count: 0, next: null, previous: null, results: [] as AvailablePerson[] }))])
      .then(([teamRes, availRes]) => {
        setPeople([
          ...teamRes.team.map(m => toPerson(m, true)),
          ...availRes.results.map(m => toPerson(m, false)),
        ])
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { void load() }, [load])

  const matches = (p: Person) => {
    if (roleFilter !== "all" && p.role !== roleFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return fullName(p).toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.username.toLowerCase().includes(q) || p.abId.includes(q)
  }

  const available = useMemo(() => people.filter(p => !p.inTeam && matches(p)), [people, search, roleFilter])
  const team = useMemo(() => people.filter(p => p.inTeam && matches(p)), [people, search, roleFilter])

  const setInTeam = (id: string, val: boolean) => {
    // Optimistic, then live add/remove + refetch.
    setPeople(prev => prev.map(p => p.id === id ? { ...p, inTeam: val } : p))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    const op = val ? addTeamMember(id) : removeTeamMember(id)
    Promise.resolve(op).then(() => load()).catch(() => load())
  }
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const bulkAvailable = available.filter(p => selected.has(p.id)).length
  const bulkTeam = team.filter(p => selected.has(p.id)).length

  const bulkMove = (toTeam: boolean) => {
    const ids = (toTeam ? available : team).filter(p => selected.has(p.id)).map(p => p.id)
    if (ids.length === 0) return
    setPeople(prev => prev.map(p => ids.includes(p.id) ? { ...p, inTeam: toTeam } : p))
    setSelected(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
    const op = toTeam ? bulkAddTeamMembers(ids.map(id => ({ user_id: id }))) : bulkRemoveTeamMembers(ids)
    Promise.resolve(op).then(() => load()).catch(() => load())
  }

  const reset = () => { setSelected(new Set()); setSearch(""); setRoleFilter("all"); void load() }

  const totalTeam = people.filter(p => p.inTeam).length
  const totalAvail = people.filter(p => !p.inTeam).length

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 60%, #0a0f1e 100%)" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative px-6 py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/30 mb-1">Team · Salgssjef</p>
            <h1 className="text-3xl font-bold text-white">Salgssjef-team</h1>
            <p className="mt-1 text-sm text-white/40">Administrer teamet til {chiefName} — klikk, dra eller velg flere kort for å flytte dem mellom kolonnene.</p>
          </div>
          <button onClick={reset} className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:border-white/20 transition-all">
            <RotateCw className="h-3.5 w-3.5" /> Oppdater
          </button>
        </motion.div>

        {/* Toolbar */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk på navn, e-post, brukernavn eller AB-ID…"
              className="w-full h-11 rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
            {([["all", "Alle"], ["manager", "Ledere"], ["employee", "Ansatte"]] as [RoleFilter, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setRoleFilter(k)} className={cn("cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all", roleFilter === k ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80")}>{l}</button>
            ))}
          </div>
        </motion.div>

        {/* Two columns */}
        <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Column
            title="Tilgjengelige" subtitle={`Brukere du kan legge til · ${totalAvail} totalt`} count={available.length} accent="#3b82f6" side="available"
            people={available} selected={selected} onToggleSelect={toggleSelect} onMove={(id) => setInTeam(id, true)}
            onDropMove={() => { if (dragId) setInTeam(dragId, false) }} onBulk={() => bulkMove(true)} bulkCount={bulkAvailable}
            dragId={dragId} setDragId={setDragId}
          />
          <Column
            title="I teamet ditt" subtitle={`Medlemmer som rapporterer til deg · ${totalTeam} totalt`} count={team.length} accent="#8b5cf6" side="team"
            people={team} selected={selected} onToggleSelect={toggleSelect} onMove={(id) => setInTeam(id, false)}
            onDropMove={() => { if (dragId) setInTeam(dragId, true) }} onBulk={() => bulkMove(false)} bulkCount={bulkTeam}
            dragId={dragId} setDragId={setDragId}
          />
        </motion.div>
      </div>
    </div>
  )
}

export default SalgssjefTeamView
