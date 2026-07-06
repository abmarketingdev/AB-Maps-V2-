"use client"

/**
 * Admin Dashboard — user management redesign. Live data via /api/users/* endpoints.
 * Register users, segregate by role (Alle/Admins/Managers/Ansatte), edit,
 * promote/demote, delete. Glassmorphism dark, animated popups. Consistent with
 * the rest of the v2 pages (colors, typography, Framer Motion).
 */

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Plus, Search, Shield, Users, UserCog, MoreHorizontal, Pencil, Trash2,
  ChevronUp, ChevronDown, X, Mail, Phone, Star, Crown, Eye, EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoyMascot, type RoyState } from "@/components/gamification/RoyMascot"
import {
  fetchDirectory, fetchUserStats, registerUser, deleteUser, updateUser,
  promoteEmployeeToManager, promoteManagerToSuperuser, demoteSuperuserToManager,
  type FlatUser, type DirectoryRole, type UserStats,
} from "@/lib/api/users"
import { listTeams, addTeamMember, type TeamListItem } from "@/lib/api/teams"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

// ─── Types & mock data ────────────────────────────────────────────────────────

type Role = "admin" | "manager" | "employee"
type Dept = "maps" | "qc" | "hr"

interface User {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  phone: string
  role: Role
  dept?: Dept            // platform: maps / qc / hr (from employee_type / admin_type)
  abId?: string
  isSalesChief?: boolean
  online: boolean
}

const ROLE_META: Record<Role, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  admin:    { label: "Admin",   color: "#8b5cf6", bg: "bg-purple-500/15",  Icon: Shield },
  manager:  { label: "Manager", color: "#3b82f6", bg: "bg-blue-500/15",    Icon: UserCog },
  employee: { label: "Ansatt",  color: "#10b981", bg: "bg-emerald-500/15", Icon: Users },
}

const ROY_STATES: RoyState[] = ["ready", "idle", "win-small", "greeting", "thinking", "win-big"]
const userRoy = (id: string): RoyState => ROY_STATES[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % ROY_STATES.length]

function flatToUser(f: FlatUser): User {
  const role: Role = (f.user_type === "superuser" || f.user_type === "admin" || f.is_superuser) ? "admin"
    : f.user_type === "manager" ? "manager" : "employee"
  // Platform/department from the auth role tokens (employee_type / admin_type).
  const dept: Dept | undefined =
    (f.employee_type === "qc_emp" || f.admin_type === "qc_admin") ? "qc"
      : f.employee_type === "hr_emp" ? "hr"
        : (f.employee_type === "maps_emp" || f.admin_type === "maps_admin") ? "maps"
          : undefined
  const parts = (f.name || f.username || "").trim().split(/\s+/)
  return {
    id: f.id,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    username: f.username,
    email: f.email ?? "",
    phone: f.phone ?? "",
    role,
    dept,
    abId: f.ab_person_id ?? undefined,
    isSalesChief: f.is_sales_chief,
    online: f.online,
  }
}

const fullName = (u: User) => `${u.firstName} ${u.lastName}`.trim()

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ open, onClose, children, width = "max-w-md" }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 overflow-y-auto"
          style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }} onClick={e => e.stopPropagation()}
            className={cn("w-full rounded-2xl border border-white/12 bg-[#0d1528] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] mb-10", width)}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const inputCls = "w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 transition-all"
function Lbl({ children }: { children: React.ReactNode }) { return <label className="block text-xs font-medium text-white/45 mb-1.5">{children}</label> }

// QC/HR are the segregated platforms worth flagging; MAPS is the default (no suffix noise).
const DEPT_STYLE: Record<Dept, { label: string; color: string; bg: string }> = {
  maps: { label: "MAPS", color: "#3b82f6", bg: "bg-blue-500/15" },
  qc: { label: "QC", color: "#06b6d4", bg: "bg-cyan-500/15" },
  hr: { label: "HR", color: "#f59e0b", bg: "bg-amber-500/15" },
}
function RoleBadge({ role, dept, salesChief }: { role: Role; dept?: Dept; salesChief?: boolean }) {
  const m = ROLE_META[role]
  const showDept = dept && dept !== "maps"
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", m.bg)} style={{ color: m.color }}>
        <m.Icon className="h-3 w-3" />{m.label}
      </span>
      {showDept && <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", DEPT_STYLE[dept!].bg)} style={{ color: DEPT_STYLE[dept!].color }}>{DEPT_STYLE[dept!].label}</span>}
      {salesChief && <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400"><Star className="h-3 w-3" /> Salgssjef</span>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Filter = "all" | Role | "qc" | "hr"
type ModalKind =
  | null
  | { kind: "register" }
  | { kind: "edit"; user: User }
  | { kind: "delete"; user: User }
  | { kind: "promote"; user: User; to: Role }

const PAGE_SIZE = 20
const ROLE_PARAM: Record<Role, DirectoryRole> = {
  admin: "superuser", manager: "manager", employee: "employee",
}

export function AdminDashboardView() {
  const reduced = useReducedMotion()
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalKind>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  // Debounce search input → query param.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  // Reset to page 1 when role filter changes.
  useEffect(() => { setPage(1) }, [filter])

  const load = useCallback(() => {
    setLoading(true); setErrored(false)
    const role = (filter === "admin" || filter === "manager" || filter === "employee") ? ROLE_PARAM[filter] : undefined
    const dept = (filter === "qc" || filter === "hr") ? filter : undefined
    return Promise.all([
      fetchDirectory({ role, dept, search: debounced || undefined, page, pageSize: PAGE_SIZE }),
      fetchUserStats().catch(() => null),
    ])
      .then(([dir, st]) => {
        setUsers(dir.results.map(flatToUser))
        setTotal(dir.total_count)
        setTotalPages(Math.max(1, dir.total_pages))
        if (st) setStats(st)
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [filter, debounced, page])

  useEffect(() => { void load() }, [load])

  const filtered = users // server already filters/searches/paginates

  // Write ops → live endpoints, then refresh the grid + counters.
  const refresh = () => { void load() }
  const remove = async (u: User) => {
    try { await deleteUser(u.role === "manager" ? "manager" : "employee", u.id) } catch { /* surfaced by reload */ }
    refresh()
  }
  const changeRole = async (u: User, to: Role) => {
    try {
      if (u.role === "employee" && to === "manager") await promoteEmployeeToManager(u.id)
      else if (u.role === "manager" && to === "admin") await promoteManagerToSuperuser(u.id)
      else if (u.role === "admin" && to === "manager") await demoteSuperuserToManager(u.id)
    } catch { /* surfaced by reload */ }
    refresh()
  }

  const counts = {
    all: stats?.total ?? total,
    admin: stats?.superusers ?? 0,
    manager: stats?.managers ?? 0,
    employee: stats?.employees ?? 0,
    qc: stats?.by_dept?.qc ?? 0,
    hr: stats?.by_dept?.hr ?? 0,
  }

  const TABS: { key: Filter; label: string; count: number; color?: string }[] = [
    { key: "all", label: "Alle", count: counts.all },
    { key: "admin", label: "Admins", count: counts.admin, color: ROLE_META.admin.color },
    { key: "manager", label: "Managers", count: counts.manager, color: ROLE_META.manager.color },
    { key: "employee", label: "Ansatte", count: counts.employee, color: ROLE_META.employee.color },
    { key: "qc", label: "QC", count: counts.qc, color: DEPT_STYLE.qc.color },
    { key: "hr", label: "HR", count: counts.hr, color: DEPT_STYLE.hr.color },
  ]

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 60%, #0a0f1e 100%)" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative px-6 py-6 max-w-[1500px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/30 mb-1">Admin · Brukeradministrasjon</p>
            <h1 className="text-3xl font-bold text-white">Brukere</h1>
          </div>
          <button onClick={() => setModal({ kind: "register" })}
            className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:bg-blue-500 transition-all">
            <Plus className="h-4 w-4" /> Registrer bruker
          </button>
        </motion.div>

        {/* KPI tiles */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Totalt", value: counts.all, color: "#3b82f6", Icon: Users },
            { label: "Admins", value: counts.admin, color: ROLE_META.admin.color, Icon: Shield },
            { label: "Managers", value: counts.manager, color: ROLE_META.manager.color, Icon: UserCog },
            { label: "Ansatte", value: counts.employee, color: ROLE_META.employee.color, Icon: Users },
            { label: "QC", value: counts.qc, color: DEPT_STYLE.qc.color, Icon: Shield },
            { label: "HR", value: counts.hr, color: DEPT_STYLE.hr.color, Icon: Users },
          ].map((k, i) => (
            <motion.div key={k.label} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40 font-medium">{k.label}</span>
                <div className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ background: `${k.color}22` }}><k.Icon className="h-3.5 w-3.5" style={{ color: k.color }} /></div>
              </div>
              <p className="font-mono text-2xl font-bold text-white">{k.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter tabs + search */}
        <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl bg-white/5 border border-white/8 p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setFilter(t.key)}
                className={cn("cursor-pointer flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all", filter === t.key ? "bg-white/12 text-white" : "text-white/45 hover:text-white/75")}>
                {t.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />}
                {t.label}<span className="font-mono text-xs text-white/35">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk navn, e-post, brukernavn…"
              className="h-9 w-64 rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50" />
          </div>
        </motion.div>

        {/* User list */}
        <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          {loading ? (
            <PanelLoading label="Laster brukere…" />
          ) : errored ? (
            <PanelError onRetry={refresh} />
          ) : filtered.length === 0 ? (
            <PanelEmpty msg="Ingen brukere funnet" />
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((u, i) => (
                <motion.div key={u.id} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
                  className="group flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                  <div className="relative shrink-0">
                    <RoyMascot state={userRoy(u.id)} size={38} />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1528]", u.online ? "bg-emerald-500" : "bg-white/25")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/90 truncate">{fullName(u)}</span>
                      {u.abId && <span className="font-mono text-[10px] text-white/30">#{u.abId}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                      <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" /> {u.email}</span>
                      <span className="hidden md:flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span>
                    </div>
                  </div>
                  <RoleBadge role={u.role} dept={u.dept} salesChief={u.isSalesChief} />
                  {/* Row menu */}
                  <div className="relative">
                    <button onClick={() => setMenuFor(menuFor === u.id ? null : u.id)}
                      className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <AnimatePresence>
                      {menuFor === u.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.12 }}
                            className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-white/12 bg-[#111a2e] shadow-2xl py-1">
                            <button onClick={() => { setModal({ kind: "edit", user: u }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:bg-white/5 text-left"><Pencil className="h-3.5 w-3.5" /> Rediger</button>
                            {u.role === "employee" && <button onClick={() => { setModal({ kind: "promote", user: u, to: "manager" }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:bg-white/5 text-left"><ChevronUp className="h-3.5 w-3.5 text-blue-400" /> Forfrem til Manager</button>}
                            {u.role === "manager" && <button onClick={() => { setModal({ kind: "promote", user: u, to: "admin" }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:bg-white/5 text-left"><Crown className="h-3.5 w-3.5 text-purple-400" /> Forfrem til Admin</button>}
                            {u.role === "admin" && <button onClick={() => { setModal({ kind: "promote", user: u, to: "manager" }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:bg-white/5 text-left"><ChevronDown className="h-3.5 w-3.5 text-amber-400" /> Degrader til Manager</button>}
                            <button onClick={() => { setModal({ kind: "delete", user: u }); setMenuFor(null) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 text-left"><Trash2 className="h-3.5 w-3.5" /> Slett</button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {!loading && !errored && total > 0 && (
            <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/35">Side {page} av {totalPages} · {total} brukere</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Forrige</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Neste</button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <UserModals modal={modal} onClose={() => setModal(null)} onChangeRole={changeRole} onDelete={remove} onChanged={refresh} />
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function pwScore(pw: string) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

function UserModals({ modal, onClose, onChangeRole, onDelete, onChanged }: {
  modal: ModalKind; onClose: () => void; onChangeRole: (u: User, to: Role) => void; onDelete: (u: User) => void; onChanged: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const editing = modal && modal.kind === "edit" ? modal.user : null
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<Role>("employee")
  const [dept, setDept] = useState<Dept>("maps")
  const [abId, setAbId] = useState("")
  const [salesChief, setSalesChief] = useState(false)
  const [pw, setPw] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [welcome, setWelcome] = useState(true)
  const [reason, setReason] = useState("")
  // Optional team appointment on register (Feature 9).
  const [teamId, setTeamId] = useState("")
  const [teamName, setTeamName] = useState("")
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)

  React.useEffect(() => {
    if (!modal) return
    if (modal.kind === "edit") {
      const u = modal.user
      setFirstName(u.firstName); setLastName(u.lastName); setUsername(u.username); setEmail(u.email); setPhone(u.phone)
      setRole(u.role); setDept(u.dept ?? "maps"); setAbId(u.abId ?? ""); setSalesChief(!!u.isSalesChief)
    } else if (modal.kind === "register") {
      setFirstName(""); setLastName(""); setUsername(""); setEmail(""); setPhone(""); setRole("employee"); setDept("maps"); setAbId(""); setSalesChief(false); setPw(""); setWelcome(true)
      setTeamId(""); setTeamName("")
    } else if (modal.kind === "promote") { setReason("") }
  }, [modal])

  if (!modal) return null

  if (modal.kind === "delete") {
    return (
      <Modal open onClose={onClose} width="max-w-sm">
        <div className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 mb-4"><Trash2 className="h-5 w-5 text-rose-400" /></div>
          <h2 className="text-lg font-bold text-white mb-1">Slett bruker</h2>
          <p className="text-sm text-white/50 mb-5">Slette <span className="text-white/80 font-medium">{fullName(modal.user)}</span>? Dette kan ikke angres.</p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8">Avbryt</button>
            <button onClick={() => { onDelete(modal.user); onClose() }} className="cursor-pointer rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500">Slett</button>
          </div>
        </div>
      </Modal>
    )
  }

  if (modal.kind === "promote") {
    const m = ROLE_META[modal.to]
    const demote = modal.user.role === "admin" && modal.to === "manager"
    return (
      <Modal open onClose={onClose} width="max-w-md">
        <div className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4" style={{ background: `${m.color}22` }}>{demote ? <ChevronDown className="h-5 w-5" style={{ color: m.color }} /> : <ChevronUp className="h-5 w-5" style={{ color: m.color }} />}</div>
          <h2 className="text-lg font-bold text-white mb-1">{demote ? "Degrader" : "Forfrem"} bruker</h2>
          <p className="text-sm text-white/50 mb-4">{fullName(modal.user)} → <span className="font-semibold" style={{ color: m.color }}>{m.label}</span></p>
          <Lbl>Begrunnelse</Lbl>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Hvorfor?" className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 resize-none mb-5" />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8">Avbryt</button>
            <button onClick={() => { onChangeRole(modal.user, modal.to); onClose() }} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all" style={{ background: m.color }}>{demote ? "Degrader" : "Forfrem"}</button>
          </div>
        </div>
      </Modal>
    )
  }

  // register / edit
  const isReg = modal.kind === "register"
  const score = pwScore(pw)
  const valid = firstName.trim() && lastName.trim() && email.trim() && (!isReg || (username.trim() && score === 4))
  const submit = async () => {
    if (!valid || saving) return
    setSaving(true); setErr("")
    try {
      if (isReg) {
        // Platform role token: employees carry employee_type, admins carry admin_type
        // (HR has no admin tier, so an admin's dept is clamped to maps/qc).
        const body: Record<string, unknown> = {
          username: username.trim(), email: email.trim(),
          password: pw, password_confirm: pw,
          first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(),
          user_type: role === "admin" ? "superuser" : role,
          ab_person_id: abId.trim() || undefined,
          // Only managers can be sales chiefs.
          is_sales_chief: role === "manager" ? salesChief : false,
          send_welcome_email: welcome,
        }
        if (role === "employee") body.employee_type = `${dept}_emp`
        if (role === "admin") body.admin_type = `${dept === "hr" ? "maps" : dept}_admin`
        // Team appointment: auth names the team in the welcome email; the actual HR
        // membership (which auto-assigns the campaign) is done right after create.
        if (teamId) { body.team_id = teamId; body.team_name = teamName }
        const res = await registerUser(body)
        if (!res.ok) {
          const data = await res.json().catch(() => ({} as Record<string, unknown>))
          const detail = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ")
          throw new Error(detail || `Feil ${res.status}`)
        }
        if (teamId) {
          const created = await res.json().catch(() => ({} as Record<string, unknown>))
          const person = (created.manager || created.employee) as { id?: string } | undefined
          if (person?.id) {
            try { await addTeamMember(teamId, { id: String(person.id), person_type: role === "employee" ? "employee" : "manager" }) }
            catch { /* user is created; appointment can be redone from Team if it failed */ }
          }
        }
      } else if (editing) {
        const res = await updateUser(editing.role === "manager" ? "manager" : "employee", editing.id, {
          first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(),
          phone: phone.trim(), ab_person_id: abId.trim() || undefined,
          is_sales_chief: editing.role !== "admin" ? salesChief : false,
        })
        if (!res.ok) throw new Error(String(res.status))
      }
      onChanged()
      onClose()
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Kunne ikke lagre. Sjekk feltene og prøv igjen.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 sticky top-0 bg-[#0d1528] z-10 rounded-t-2xl">
        <h2 className="text-lg font-bold text-white">{isReg ? "Registrer ny bruker" : "Rediger bruker"}</h2>
        <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-5 space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div><Lbl>Fornavn</Lbl><input value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus className={inputCls} placeholder="Fornavn" /></div>
          <div><Lbl>Etternavn</Lbl><input value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} placeholder="Etternavn" /></div>
        </div>
        {/* Contact */}
        <div className="grid grid-cols-2 gap-3">
          <div><Lbl>E-post</Lbl><input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="navn@abmarketing.no" /></div>
          <div><Lbl>Telefon</Lbl><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+47 …" /></div>
        </div>
        {isReg && (
          <div className="grid grid-cols-2 gap-3">
            <div><Lbl>Brukernavn</Lbl><input value={username} onChange={e => setUsername(e.target.value)} className={inputCls} placeholder="bruker.navn" /></div>
            <div><Lbl>AB Person-ID <span className="text-white/20">(valgfritt)</span></Lbl><input value={abId} onChange={e => setAbId(e.target.value.replace(/\D/g, "").slice(0, 16))} className={inputCls} placeholder="AB Person-ID" /></div>
          </div>
        )}
        {!isReg && (
          <div><Lbl>AB Person-ID</Lbl><input value={abId} onChange={e => setAbId(e.target.value.replace(/\D/g, "").slice(0, 16))} className={inputCls} placeholder="AB Person-ID" /></div>
        )}

        {/* Password (register only) */}
        {isReg && (
          <div>
            <Lbl>Passord</Lbl>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} className={inputCls + " pr-10"} placeholder="Min. 8 tegn, stor bokstav, tall, symbol" />
              <button onClick={() => setShowPw(s => !s)} className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            <div className="mt-2 flex gap-1">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < score ? (score <= 2 ? "#f43f5e" : score === 3 ? "#f59e0b" : "#10b981") : "rgba(255,255,255,0.1)" }} />)}
            </div>
          </div>
        )}

        {/* Role */}
        <div>
          <Lbl>Rolle</Lbl>
          <div className="flex gap-1.5">
            {(["employee", "manager", "admin"] as Role[]).map(r => {
              const m = ROLE_META[r]; const on = role === r
              const disabled = !isReg // role change only via promote in edit
              return (
                <button key={r} disabled={disabled} onClick={() => { setRole(r); if (r === "admin" && dept === "hr") setDept("maps") }}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition-all", on ? m.bg : "bg-white/5 text-white/40", !disabled && "cursor-pointer hover:text-white/70", disabled && "opacity-50 cursor-not-allowed")}
                  style={on ? { color: m.color } : undefined}>
                  <m.Icon className="h-3.5 w-3.5" />{m.label}
                </button>
              )
            })}
          </div>
          {!isReg && <p className="mt-1.5 text-[11px] text-white/30">Endre rolle via "Forfrem / Degrader" i radmenyen.</p>}
        </div>

        {/* Dept — employees: maps/qc/hr; admins: maps/qc (no HR admin tier). Managers have no platform. */}
        {isReg && role !== "manager" && (
          <div>
            <Lbl>Avdeling</Lbl>
            <div className="flex gap-1.5">
              {((role === "employee" ? ["maps", "qc", "hr"] : ["maps", "qc"]) as Dept[]).map(d => (
                <button key={d} onClick={() => setDept(d)} className={cn("cursor-pointer flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition-all", dept === d ? "bg-white/15 text-white" : "bg-white/5 text-white/40 hover:text-white/70")}>{d.toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}

        {/* Team appointment (register, non-admin) */}
        {isReg && role !== "admin" && (
          <div>
            <Lbl>Team <span className="text-white/20">(valgfritt)</span></Lbl>
            <div className={inputCls + " flex items-center justify-between gap-2 !py-0 !pr-1"}>
              <button type="button" onClick={() => setTeamPickerOpen(true)} className="cursor-pointer flex-1 text-left py-2.5">
                <span className={teamName ? "text-white" : "text-white/25"}>{teamName || "Velg team…"}</span>
              </button>
              {teamName
                ? <button type="button" onClick={() => { setTeamId(""); setTeamName("") }} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8"><X className="h-3.5 w-3.5" /></button>
                : <ChevronDown className="h-4 w-4 text-white/40 mr-2" />}
            </div>
            <p className="mt-1.5 text-[11px] text-white/30">Legges automatisk til i teamet og teamets kampanje.</p>
          </div>
        )}

        {/* Toggles */}
        <div className="space-y-2.5">
          {role === "manager" && (
            <label className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-white/75"><Star className="h-3.5 w-3.5 text-amber-400" /> Salgssjef</span>
              <button onClick={() => setSalesChief(s => !s)} className={cn("cursor-pointer relative h-5 w-9 rounded-full transition-colors", salesChief ? "bg-blue-600" : "bg-white/15")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", salesChief ? "translate-x-4" : "translate-x-0.5")} /></button>
            </label>
          )}
          {isReg && (
            <label className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-white/75"><Mail className="h-3.5 w-3.5 text-blue-400" /> Send velkomst-e-post</span>
              <button onClick={() => setWelcome(s => !s)} className={cn("cursor-pointer relative h-5 w-9 rounded-full transition-colors", welcome ? "bg-blue-600" : "bg-white/15")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", welcome ? "translate-x-4" : "translate-x-0.5")} /></button>
            </label>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8 sticky bottom-0 bg-[#0d1528] rounded-b-2xl">
        {err && <span className="mr-auto text-xs text-rose-400">{err}</span>}
        <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8">Avbryt</button>
        <button onClick={submit} disabled={!valid || saving} className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Lagrer…" : isReg ? "Registrer bruker" : "Lagre endringer"}</button>
      </div>
    </Modal>
    {teamPickerOpen && (
      <TeamPickerModal
        onClose={() => setTeamPickerOpen(false)}
        onSelect={(t) => { setTeamId(t.id); setTeamName(t.name); setTeamPickerOpen(false) }}
      />
    )}
    </>
  )
}

// Select-Team popup (Feature 9): filter teams by campaign / sales chief, pick one.
function TeamPickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (t: { id: string; name: string }) => void }) {
  const [teams, setTeams] = useState<TeamListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [campaignFilter, setCampaignFilter] = useState("")
  const [chiefFilter, setChiefFilter] = useState("")
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [chiefs, setChiefs] = useState<{ id: string; name: string }[]>([])

  useEffect(() => { fetchCampaignsWithStats().then(l => setCampaigns(l.map(c => ({ id: c.id, name: c.name })))).catch(() => {}) }, [])
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      listTeams({ campaignId: campaignFilter || undefined, salesChiefId: chiefFilter || undefined, search: search || undefined, pageSize: 200 })
        .then(r => {
          setTeams(r.results)
          if (!chiefFilter) {
            const m = new Map<string, string>()
            r.results.forEach(x => { if (x.sales_chief) m.set(x.sales_chief.id, x.sales_chief.name) })
            setChiefs([...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
          }
        })
        .catch(() => setTeams([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [campaignFilter, chiefFilter, search])

  const selCls = "h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]"
  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <h2 className="text-base font-bold text-white">Velg team</h2>
        <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)} className={selCls}>
            <option value="" className="bg-[#0d1528]">Alle kampanjer</option>
            {campaigns.map(c => <option key={c.id} value={c.id} className="bg-[#0d1528]">{c.name}</option>)}
          </select>
          <select value={chiefFilter} onChange={e => setChiefFilter(e.target.value)} className={selCls}>
            <option value="" className="bg-[#0d1528]">Alle salgssjefer</option>
            {chiefs.map(c => <option key={c.id} value={c.id} className="bg-[#0d1528]">{c.name}</option>)}
          </select>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk team…" className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50" />
        <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {loading ? <p className="py-6 text-center text-sm text-white/35">Laster team…</p>
            : teams.length === 0 ? <p className="py-6 text-center text-sm text-white/35">Ingen team funnet.</p>
              : teams.map(t => (
                <button key={t.id} onClick={() => onSelect({ id: t.id, name: t.name })} className="cursor-pointer w-full flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: `${t.color || "#3b82f6"}22`, border: `1px solid ${t.color || "#3b82f6"}55` }}>{t.icon || "👥"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white truncate">{t.name}</span>
                    <span className="block text-[11px] text-white/40 truncate">{t.campaign?.name ?? "Ingen kampanje"}{t.sales_chief ? ` · ${t.sales_chief.name}` : ""}</span>
                  </span>
                </button>
              ))}
        </div>
      </div>
    </Modal>
  )
}

export default AdminDashboardView
