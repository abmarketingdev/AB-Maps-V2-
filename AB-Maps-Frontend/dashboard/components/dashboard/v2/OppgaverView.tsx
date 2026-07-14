"use client"

/**
 * Oppgaver — unified task page (replaces the split "Mine oppgaver" + "Tildel
 * oppgaver" pages). One page, three perspectives via a switch:
 *   - Mine oppgaver   : tasks assigned TO me (everyone)
 *   - Tildelt av meg  : tasks I delegated, grouped by person (manager/admin)
 *   - Team            : everything across the team (manager/admin)
 *
 * Assignment happens inside the "Ny oppgave" modal with a ROLE-AWARE picker:
 *   - Admin   → admins, managers, employees
 *   - Manager → managers, employees
 *   - Employee→ self only
 *
 * Layouts: Board (Kanban, drag to move) + Liste toggle.
 * Live data: role comes from the authenticated user (useAuth → user_type), the
 * assignee picker from /api/users/assignable/, and tasks from /api/todos/v2/tasks/
 * scoped per perspective. The perspective set and assignee picker are driven strictly
 * by the real role — employees only ever see "Mine oppgaver" and cannot assign.
 */

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Plus, Search, LayoutGrid, List as ListIcon, Calendar as CalIcon, X, Check,
  Flag, Clock, AlertTriangle, CheckCircle2, Circle, CircleDot, Users, ChevronDown,
  Hash, UserPlus, CornerDownLeft, ChevronLeft, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoyMascot, type RoyState } from "@/components/gamification/RoyMascot"
import { useAuth } from "@/lib/auth/AuthContext"
import {
  listTasks, fetchTaskStats, createTask as apiCreateTask, deleteTask as apiDeleteTask,
  startTask, completeTask, patchTask,
  fetchAssignmentUsers, assignTaskToUsers,
  type Task as ApiTask, type Perspective as ApiPerspective,
} from "@/lib/api/tasks"
import { fetchCampaignsWithStats, type CampaignVM } from "@/lib/api/campaigns"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

// ─── People & roles ───────────────────────────────────────────────────────────

type Role = "admin" | "manager" | "employee"

interface Person { id: string; name: string; role: Role; isMaps: boolean }

// Assignable users are loaded live (/api/todos/assignment-users/ — the server already
// enforces the role matrix, so the list only contains valid targets for the caller). A
// module-level registry lets the leaf components (avatars/lookups) resolve names by id
// without prop-drilling; tolerant fallback avoids crashes on unknown ids.
let peopleRegistry: Person[] = []
const byId = (id: string): Person => peopleRegistry.find(p => p.id === id) ?? { id, name: "Bruker", role: "employee", isMaps: true }

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", manager: "Manager", employee: "Ansatt" }
const ROLE_ORDER: Role[] = ["admin", "manager", "employee"]

const ROY_STATES: RoyState[] = ["ready", "idle", "win-small", "greeting", "thinking", "win-big"]
function personRoy(id: string): RoyState {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return ROY_STATES[h % ROY_STATES.length]
}

// who can a role assign to
function assignableRoles(role: Role): Role[] {
  if (role === "admin") return ["admin", "manager", "employee"]
  if (role === "manager") return ["manager", "employee"]
  return []
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

type TaskStatus = "todo" | "in_progress" | "done"
type Priority = "high" | "medium" | "low"

interface Task {
  id: string
  title: string
  description?: string
  assignerId: string
  assigneeIds: string[]
  status: TaskStatus
  priority: Priority
  due: Date
  campaign?: string
}

// What the "Ny oppgave" composer emits — assignees + the campaign *id* (not name), so
// the caller can route to the assignment saga and write the real campaign FK.
interface CreateInput {
  title: string
  description?: string
  priority: Priority
  due: Date | null
  campaignId: string | null
  assigneeIds: string[]
  status: TaskStatus
}

const STATUS_META: Record<TaskStatus, { label: string; color: string; Icon: React.ElementType }> = {
  todo:        { label: "Å gjøre", color: "#60a5fa", Icon: Circle },
  in_progress: { label: "Pågår",   color: "#f59e0b", Icon: CircleDot },
  done:        { label: "Ferdig",  color: "#10b981", Icon: CheckCircle2 },
}
const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"]

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  high:   { label: "Høy",    color: "#f43f5e", bg: "bg-rose-500/15" },
  medium: { label: "Medium", color: "#f59e0b", bg: "bg-amber-500/15" },
  low:    { label: "Lav",    color: "#60a5fa", bg: "bg-blue-500/15" },
}

function dShift(days: number) { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(17, 0, 0, 0); return d }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()
const isOverdue = (t: Task) => t.status !== "done" && startOfDay(t.due).getTime() < startOfDay(new Date()).getTime()

// No due date → far-future sentinel so the task is never "overdue"/"today".
const NO_DUE = new Date(4102444800000) // 2100-01-01
function toViewTask(t: ApiTask): Task {
  return {
    id: t.id, title: t.title, description: t.description || undefined,
    assignerId: t.assigner_id ?? "", assigneeIds: t.assignee_ids ?? [],
    status: t.status, priority: t.priority,
    due: t.due ? new Date(t.due) : NO_DUE,
    // Display the human campaign name (backend returns campaign_name); fall back
    // to the id only if a name isn't present.
    campaign: t.campaign_name ?? (t.campaign ?? undefined),
  }
}
const toApiPerspective = (p: Perspective): ApiPerspective => p === "tildelt" ? "assigned_by_me" : p === "team" ? "team" : "mine"

// ─── Small components ─────────────────────────────────────────────────────────

function Avatar({ id, size = 30 }: { id: string; size?: number }) {
  return <RoyMascot state={personRoy(id)} size={size} />
}

function AvatarStack({ ids, size = 26 }: { ids: string[]; size?: number }) {
  return (
    <div className="flex -space-x-2">
      {ids.slice(0, 3).map(id => (
        <div key={id} className="rounded-full ring-2 ring-ab-base" title={byId(id).name}>
          <Avatar id={id} size={size} />
        </div>
      ))}
      {ids.length > 3 && (
        <div className="flex items-center justify-center rounded-full bg-ab-hover ring-2 ring-ab-base text-[10px] font-bold text-ab-fg-2" style={{ width: size, height: size }}>
          +{ids.length - 3}
        </div>
      )}
    </div>
  )
}

function PriorityPill({ p }: { p: Priority }) {
  const m = PRIORITY_META[p]
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.bg)} style={{ color: m.color }}>
      <Flag className="h-2.5 w-2.5" /> {m.label}
    </span>
  )
}

// Compact priority glyph — three signal bars (Linear-style)
function PriorityBars({ p }: { p: Priority }) {
  const m = PRIORITY_META[p]
  const active = p === "high" ? 3 : p === "medium" ? 2 : 1
  return (
    <span className="flex items-end gap-[2px] h-3.5 shrink-0" title={`Prioritet: ${m.label}`}>
      {[0, 1, 2].map(i => (
        <span key={i} className="w-[3px] rounded-[1px]" style={{ height: `${5 + i * 4}px`, background: i < active ? m.color : "rgba(255,255,255,0.15)" }} />
      ))}
    </span>
  )
}

function DueBadge({ due, status }: { due: Date; status: TaskStatus }) {
  const overdue = status !== "done" && startOfDay(due).getTime() < startOfDay(new Date()).getTime()
  const today = isSameDay(due, new Date())
  const label = today ? "I dag" : due.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })
  return (
    <span className={cn("flex items-center gap-1 text-[11px] font-medium",
      overdue ? "text-rose-400" : today ? "text-amber-400" : "text-ab-fg-3")}>
      {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {overdue ? `Forsinket · ${label}` : label}
    </span>
  )
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onDragStart, onDragEnd, showAssignees = true, draggable = false, dragging = false }: {
  task: Task; onDragStart?: () => void; onDragEnd?: () => void; showAssignees?: boolean; draggable?: boolean; dragging?: boolean
}) {
  const overdue = isOverdue(task)
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-lg border bg-ab-elevated p-3 transition-[background,border-color,box-shadow] duration-150 hover:bg-ab-hover hover:border-ab-line",
        draggable && "cursor-grab active:cursor-grabbing",
        overdue ? "border-rose-500/25" : "border-ab-line",
        dragging && "opacity-50 rotate-[1.5deg] shadow-2xl ring-1 ring-blue-500/40"
      )}
    >
      {/* high-priority left accent */}
      {task.priority === "high" && (
        <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-rose-500/70" />
      )}

      {/* Title row */}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5"><PriorityBars p={task.priority} /></span>
        <p className="flex-1 text-[13px] font-medium text-ab-fg leading-snug">{task.title}</p>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.campaign && (
            <span className="truncate rounded-md bg-ab-elevated px-1.5 py-0.5 text-[10px] font-medium text-ab-fg-3">{task.campaign}</span>
          )}
          <DueBadge due={task.due} status={task.status} />
        </div>
        {showAssignees && <AvatarStack ids={task.assigneeIds} size={24} />}
      </div>
    </div>
  )
}

// ─── Board (Kanban, drag to move) ────────────────────────────────────────────

function Board({ tasks, onMove, onQuickAdd }: {
  tasks: Task[]; onMove: (id: string, status: TaskStatus) => void; onQuickAdd: (status: TaskStatus) => void
}) {
  const reduced = useReducedMotion()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {STATUS_ORDER.map((status, ci) => {
        const colTasks = tasks.filter(t => t.status === status)
        const m = STATUS_META[status]
        const isOver = overCol === status && dragId !== null
        return (
          <motion.div
            key={status}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.05 }}
            onDragOver={(e) => { e.preventDefault(); if (overCol !== status) setOverCol(status) }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(c => c === status ? null : c) }}
            onDrop={() => { if (dragId) onMove(dragId, status); setDragId(null); setOverCol(null) }}
            className={cn(
              "rounded-2xl border bg-ab-elevated p-3 transition-colors min-h-[320px]",
              isOver ? "border-blue-500/40 bg-blue-500/[0.04]" : "border-ab-line"
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                <h3 className="text-[13px] font-semibold text-ab-fg">{m.label}</h3>
                <span className="font-mono text-xs text-ab-fg-4">{colTasks.length}</span>
              </div>
              <button
                onClick={() => onQuickAdd(status)}
                className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-md text-ab-fg-4 hover:text-ab-fg hover:bg-ab-hover transition-colors"
                title="Legg til oppgave"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Cards (capped height + scroll so a long column never sprawls the page) */}
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              {colTasks.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  draggable
                  dragging={dragId === t.id}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null) }}
                />
              ))}

              {/* Drop placeholder */}
              {isOver && (
                <div className="rounded-lg border border-dashed border-blue-500/50 bg-blue-500/[0.06] h-10 flex items-center justify-center text-[11px] font-medium text-blue-300/70">
                  Slipp her
                </div>
              )}

              {colTasks.length === 0 && !isOver && (
                <button
                  onClick={() => onQuickAdd(status)}
                  className="cursor-pointer w-full rounded-lg border border-dashed border-ab-line py-6 text-center text-xs text-ab-fg-4 hover:text-ab-fg-3 hover:border-ab-line transition-colors"
                >
                  + Legg til oppgave
                </button>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────

function TaskList({ tasks }: { tasks: Task[] }) {
  const reduced = useReducedMotion()
  if (tasks.length === 0) return <EmptyState />
  return (
    <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl divide-y divide-ab-line overflow-hidden">
      {tasks.map((t, i) => {
        const m = STATUS_META[t.status]
        return (
          <motion.div key={t.id}
            initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
            className="flex items-center gap-4 px-4 py-3 hover:bg-ab-hover transition-colors">
            <m.Icon className="h-4 w-4 shrink-0" style={{ color: m.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ab-fg truncate">{t.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {t.campaign && <span className="text-[10px] text-ab-fg-4">{t.campaign}</span>}
                <DueBadge due={t.due} status={t.status} />
              </div>
            </div>
            <PriorityPill p={t.priority} />
            <AvatarStack ids={t.assigneeIds} />
          </motion.div>
        )
      })}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl flex flex-col items-center justify-center py-20 text-center">
      <CheckCircle2 className="h-8 w-8 text-ab-fg-4 mb-3" />
      <p className="text-sm text-ab-fg-4">Ingen oppgaver i denne visningen</p>
    </div>
  )
}

// ─── Pagination ─────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, from, to, onPage }: {
  page: number; totalPages: number; total: number; from: number; to: number; onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const btn = "cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-ab-line bg-ab-elevated text-ab-fg-2 hover:text-ab-fg hover:border-ab-line transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
  return (
    <div className="mt-3 flex items-center justify-between px-1">
      <span className="text-xs text-ab-fg-3">Viser <span className="text-ab-fg-2 font-medium">{from}–{to}</span> av {total}</span>
      <div className="flex items-center gap-1.5">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} title="Forrige"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2 text-xs font-medium text-ab-fg-2 tabular-nums">{page} / {totalPages}</span>
        <button className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} title="Neste"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

// ─── Delegation view (grouped by person) ─────────────────────────────────────

function DelegationView({ tasks, currentUserId }: { tasks: Task[]; currentUserId: string }) {
  const reduced = useReducedMotion()
  // Tasks I assigned to others → group by each assignee (excluding myself)
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach(t => {
      t.assigneeIds.forEach(aid => {
        if (aid === currentUserId) return
        if (!map.has(aid)) map.set(aid, [])
        map.get(aid)!.push(t)
      })
    })
    return Array.from(map.entries())
      .map(([id, ts]) => ({
        id, tasks: ts,
        done: ts.filter(t => t.status === "done").length,
        overdue: ts.filter(isOverdue).length,
      }))
      .sort((a, b) => b.tasks.length - a.tasks.length)
  }, [tasks, currentUserId])

  if (groups.length === 0) return (
    <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl flex flex-col items-center justify-center py-20 text-center">
      <Users className="h-8 w-8 text-ab-fg-4 mb-3" />
      <p className="text-sm text-ab-fg-4">Du har ikke tildelt oppgaver til andre ennå</p>
      <p className="text-xs text-ab-fg-4 mt-1">Bruk "Ny oppgave" for å delegere</p>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {groups.map((g, gi) => {
        const person = byId(g.id)
        const pct = Math.round(g.done / g.tasks.length * 100)
        return (
          <motion.div key={g.id}
            initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05 }}
            className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5">
            {/* Person header */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar id={g.id} size={42} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ab-fg">{person.name}</p>
                <p className="text-xs text-ab-fg-3">{ROLE_LABEL[person.role]} · {g.tasks.length} oppgaver</p>
              </div>
              {g.overdue > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-400">
                  <AlertTriangle className="h-3 w-3" /> {g.overdue} forsinket
                </span>
              )}
            </div>
            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-ab-fg-3">Fremdrift</span>
                <span className="font-mono text-ab-fg-2">{g.done}/{g.tasks.length} ferdig</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ab-hover">
                <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: gi * 0.05 }} />
              </div>
            </div>
            {/* Their tasks */}
            <div className="space-y-2">
              {g.tasks.map(t => (
                <TaskCard key={t.id} task={t} showAssignees={false} />
              ))}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Ny oppgave modal (role-aware assignee picker) ───────────────────────────

// Small inline property pill used in the composer's bottom toolbar.
function PropPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer flex items-center gap-1.5 rounded-lg border h-8 px-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
        active ? "border-ab-line bg-ab-hover text-ab-fg" : "border-ab-line bg-ab-elevated text-ab-fg-3 hover:text-ab-fg hover:border-ab-line"
      )}
    >
      {children}
    </button>
  )
}

function PopPanel({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <div className={cn("absolute bottom-full mb-2 z-20 rounded-xl border border-ab-line bg-ab-overlay shadow-2xl overflow-hidden", align === "left" ? "left-0" : "right-0")}>
      {children}
    </div>
  )
}

type PropKey = "priority" | "assignee" | "due" | "campaign"

function NewTaskModal({ open, onClose, role, currentUserId, initialStatus, onCreate, people, campaigns }: {
  open: boolean; onClose: () => void; role: Role; currentUserId: string
  initialStatus: TaskStatus; onCreate: (t: CreateInput) => void; people: Person[]; campaigns: CampaignVM[]
}) {
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [due, setDue] = useState<Date | null>(null)
  const [campaignId, setCampaignId] = useState<string>("")
  const [assignees, setAssignees] = useState<string[]>([])
  const [openProp, setOpenProp] = useState<PropKey | null>(null)
  const [search, setSearch] = useState("")
  const canAssignOthers = assignableRoles(role).length > 0
  const campaignName = campaigns.find(c => c.id === campaignId)?.name

  const grouped = useMemo(() => {
    const roles = assignableRoles(role)
    // Only maps-owned users are pickable here — a task is created in the assignee's own
    // service and the maps saga can only create maps rows (qc/hr assignment lands in Phase 2).
    const targets = people.filter(p => p.isMaps && roles.includes(p.role) && p.name.toLowerCase().includes(search.toLowerCase()))
    const g: Record<Role, Person[]> = { admin: [], manager: [], employee: [] }
    targets.forEach(p => g[p.role].push(p))
    return g
  }, [role, search, people])

  const toggle = (id: string) => setAssignees(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id])
  const reset = () => { setTitle(""); setDesc(""); setPriority("medium"); setDue(null); setCampaignId(""); setAssignees([]); setSearch(""); setOpenProp(null) }
  const submit = () => {
    if (!title.trim()) return
    const finalAssignees = assignees.length > 0 ? assignees : [currentUserId]
    onCreate({
      title: title.trim(), description: desc.trim() || undefined,
      assigneeIds: finalAssignees,
      status: initialStatus, priority, due: due ?? null, campaignId: campaignId || null,
    })
    reset(); onClose()
  }
  const close = () => { reset(); onClose() }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); if (openProp) setOpenProp(null); else close() }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
  }

  // Quick due options
  const dueOptions: { label: string; date: Date }[] = [
    { label: "I dag", date: dShift(0) },
    { label: "I morgen", date: dShift(1) },
    { label: "Om 3 dager", date: dShift(3) },
    { label: "Neste uke", date: dShift(7) },
  ]
  const dueLabel = due
    ? (isSameDay(due, new Date()) ? "I dag" : due.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }))
    : "Frist"

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
          style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            onClick={e => e.stopPropagation()}
            onKeyDown={onKeyDown}
            className="w-full max-w-[560px] rounded-2xl border border-ab-line bg-ab-overlay shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] overflow-visible"
          >
            {/* Top strip */}
            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-md bg-ab-elevated px-2 py-1 text-xs font-medium text-ab-fg-3">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[initialStatus].color }} />
                  {STATUS_META[initialStatus].label}
                </span>
                <span className="text-xs text-ab-fg-4">Ny oppgave</span>
              </div>
              <button onClick={close} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-ab-fg-4 hover:text-ab-fg hover:bg-ab-hover transition-all"><X className="h-4 w-4" /></button>
            </div>

            {/* Title + description (borderless, Linear-style) */}
            <div className="px-5 pt-2 pb-4">
              <input
                value={title} onChange={e => setTitle(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); submit() } }}
                placeholder="Oppgavetittel"
                className="w-full bg-transparent text-lg font-semibold text-ab-fg placeholder:text-ab-fg-4 outline-none"
              />
              <textarea
                value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="Legg til beskrivelse…"
                className="mt-2 w-full bg-transparent text-sm text-ab-fg-2 placeholder:text-ab-fg-4 outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Property toolbar */}
            <div className="relative px-5 pb-4">
              {/* outside-click backdrop for popovers */}
              {openProp && <div className="fixed inset-0 z-10" onClick={() => setOpenProp(null)} />}

              <div className="flex flex-wrap gap-2">
                {/* Priority */}
                <div className="relative">
                  <PropPill active={openProp === "priority"} onClick={() => setOpenProp(openProp === "priority" ? null : "priority")}>
                    <Flag className="h-3.5 w-3.5" style={{ color: PRIORITY_META[priority].color }} />
                    {PRIORITY_META[priority].label}
                  </PropPill>
                  {openProp === "priority" && (
                    <PopPanel>
                      <div className="w-44 py-1">
                        {(["high", "medium", "low"] as Priority[]).map(p => (
                          <button key={p} onClick={() => { setPriority(p); setOpenProp(null) }}
                            className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-ab-hover transition-colors text-left">
                            <Flag className="h-3.5 w-3.5" style={{ color: PRIORITY_META[p].color }} />
                            <span className="flex-1 text-ab-fg-2">{PRIORITY_META[p].label}</span>
                            {priority === p && <Check className="h-3.5 w-3.5 text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    </PopPanel>
                  )}
                </div>

                {/* Assignee */}
                <div className="relative">
                  <PropPill active={openProp === "assignee"} onClick={() => setOpenProp(openProp === "assignee" ? null : "assignee")}>
                    {assignees.length === 0 ? (
                      <><UserPlus className="h-3.5 w-3.5" /> Tildel</>
                    ) : (
                      <><AvatarStack ids={assignees} size={18} /> {assignees.length === 1 ? byId(assignees[0]).name.split(" ")[0] : `${assignees.length} personer`}</>
                    )}
                  </PropPill>
                  {openProp === "assignee" && (
                    <PopPanel>
                      <div className="w-64">
                        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                          <span className="text-[11px] font-semibold text-ab-fg-3">Tildel til</span>
                          <button onClick={() => toggle(currentUserId)} className="cursor-pointer text-[11px] font-medium text-blue-400 hover:text-blue-300">
                            {assignees.includes(currentUserId) ? "Fjern meg" : "Meg selv"}
                          </button>
                        </div>
                        {!canAssignOthers ? (
                          <p className="px-3 py-3 text-xs text-ab-fg-3">Ansatte kan kun tildele seg selv.</p>
                        ) : (
                          <>
                            <div className="px-2 pb-2">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-4" />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk…"
                                  className="w-full h-8 rounded-lg border border-ab-line bg-ab-elevated pl-8 pr-2 text-[13px] text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" />
                              </div>
                            </div>
                            <div className="max-h-56 overflow-y-auto pb-1">
                              {ROLE_ORDER.filter(r => assignableRoles(role).includes(r) && grouped[r].length > 0).map(r => (
                                <div key={r}>
                                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ab-fg-4">{ROLE_LABEL[r]}</p>
                                  {grouped[r].map(p => {
                                    const on = assignees.includes(p.id)
                                    return (
                                      <button key={p.id} onClick={() => toggle(p.id)}
                                        className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-ab-hover transition-colors text-left">
                                        <Avatar id={p.id} size={24} />
                                        <span className="flex-1 text-[13px] text-ab-fg-2 truncate">{p.name}</span>
                                        <span className={cn("flex h-4 w-4 items-center justify-center rounded border transition-colors", on ? "bg-blue-600 border-blue-600" : "border-ab-line")}>
                                          {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </PopPanel>
                  )}
                </div>

                {/* Due */}
                <div className="relative">
                  <PropPill active={openProp === "due"} onClick={() => setOpenProp(openProp === "due" ? null : "due")}>
                    <CalIcon className="h-3.5 w-3.5" /> {dueLabel}
                  </PropPill>
                  {openProp === "due" && (
                    <PopPanel>
                      <div className="w-52 py-1">
                        {dueOptions.map(o => (
                          <button key={o.label} onClick={() => { setDue(o.date); setOpenProp(null) }}
                            className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-ab-hover transition-colors text-left">
                            <CalIcon className="h-3.5 w-3.5 text-ab-fg-3" />
                            <span className="flex-1 text-ab-fg-2">{o.label}</span>
                            <span className="text-[11px] text-ab-fg-4">{o.date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}</span>
                          </button>
                        ))}
                        <div className="border-t border-ab-line mt-1 px-3 py-2">
                          <input type="date" value={due ? due.toISOString().slice(0, 10) : ""}
                            onChange={e => { if (e.target.value) { const d = new Date(e.target.value); d.setHours(17, 0, 0, 0); setDue(d); setOpenProp(null) } }}
                            className="w-full h-8 rounded-lg border border-ab-line bg-ab-elevated px-2 text-[13px] text-ab-fg outline-none focus:border-blue-500/50 [color-scheme:dark]" />
                        </div>
                      </div>
                    </PopPanel>
                  )}
                </div>

                {/* Campaign (live) */}
                <div className="relative">
                  <PropPill active={openProp === "campaign"} onClick={() => setOpenProp(openProp === "campaign" ? null : "campaign")}>
                    <Hash className="h-3.5 w-3.5" style={{ color: campaignId ? (campaigns.find(c => c.id === campaignId)?.color ?? undefined) : undefined }} />
                    {campaignName || "Kampanje"}
                  </PropPill>
                  {openProp === "campaign" && (
                    <PopPanel>
                      <div className="w-60 py-1">
                        {campaigns.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-ab-fg-3">Ingen kampanjer</p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto">
                            {campaignId && (
                              <button onClick={() => { setCampaignId(""); setOpenProp(null) }}
                                className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-ab-hover transition-colors text-left text-ab-fg-3">
                                <X className="h-3.5 w-3.5" /> Fjern kampanje
                              </button>
                            )}
                            {campaigns.map(c => (
                              <button key={c.id} onClick={() => { setCampaignId(campaignId === c.id ? "" : c.id); setOpenProp(null) }}
                                className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-ab-hover transition-colors text-left">
                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                                <span className="flex-1 text-ab-fg-2 truncate">{c.name}</span>
                                {campaignId === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopPanel>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-ab-line">
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-ab-fg-4">
                <kbd className="rounded bg-ab-hover px-1.5 py-0.5 font-mono">⌘</kbd>
                <CornerDownLeft className="h-3 w-3" />
                for å opprette
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={close} className="cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-all">Avbryt</button>
                <button onClick={submit} disabled={!title.trim()}
                  className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  Opprett oppgave
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Perspective = "mine" | "tildelt" | "team"
type StatusTab = "aktive" | "idag" | "forsinket" | "ferdig" | "alle"
type LayoutMode = "board" | "liste"

export function OppgaverView() {
  const reduced = useReducedMotion()
  const { user, isAdmin } = useAuth()
  const role: Role = isAdmin ? "admin" : user?.user_type === "employee" ? "employee" : "manager"
  const currentUserId = user?.user_info?.id ?? ""

  const [tasks, setTasks] = useState<Task[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState({ aktive: 0, idag: 0, forsinket: 0, ferdig: 0, alle: 0 })
  const [people, setPeople] = useState<Person[]>([])
  const [campaigns, setCampaigns] = useState<CampaignVM[]>([])
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const perspectives: { key: Perspective; label: string }[] = role === "employee"
    ? [{ key: "mine", label: "Mine oppgaver" }]
    : [
        { key: "mine", label: "Mine oppgaver" },
        { key: "tildelt", label: "Tildelt av meg" },
        { key: "team", label: "Team" },
      ]

  const [perspective, setPerspective] = useState<Perspective>("mine")
  const [statusTab, setStatusTab] = useState<StatusTab>("alle")
  const [layout, setLayout] = useState<LayoutMode>("board")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")            // debounced → drives the server query
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12
  const isTildelt = perspective === "tildelt"
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStatus, setModalStatus] = useState<TaskStatus>("todo")
  const openModal = (status: TaskStatus = "todo") => { setModalStatus(status); setModalOpen(true) }

  // Auto-dismiss the toast.
  React.useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

  // Reset perspective if role change makes it invalid
  React.useEffect(() => {
    if (!perspectives.find(p => p.key === perspective)) setPerspective("mine")
  }, [role]) // eslint-disable-line

  // Load assignable users (server already applies the role matrix; each row is platform-tagged).
  // Employees get a 403 here (they can't assign) — the catch simply leaves the list empty.
  React.useEffect(() => {
    fetchAssignmentUsers()
      .then(({ results }) => {
        const mapped: Person[] = results.map(u => ({
          id: u.user_id, name: u.name || u.username,
          // sales-chiefs are manager-level for display grouping.
          role: u.role === "admin" ? "admin" : u.role === "employee" ? "employee" : "manager",
          isMaps: u.is_maps_user,
        }))
        peopleRegistry = mapped
        setPeople(mapped)
      })
      .catch(() => { /* leave empty */ })
  }, [])

  // Load campaigns for the composer's campaign picker (dynamic, not hardcoded).
  React.useEffect(() => {
    fetchCampaignsWithStats()
      .then(setCampaigns)
      .catch(() => { /* leave empty */ })
  }, [])

  // Debounce the search box → server query.
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(id)
  }, [searchInput])

  // Reset to page 1 whenever the query basis changes.
  React.useEffect(() => { setPage(1) }, [perspective, statusTab, search])

  // Load a page of tasks (server-scoped, server-filtered by tab/search, server-paginated) plus
  // perspective-level counts for the tabs. The delegation view ("tildelt") groups ALL of my
  // delegated rows by person, so it fetches unpaginated (bounded — only tasks I assigned).
  const loadTasks = React.useCallback(() => {
    setLoading(true); setErrored(false)
    const p = toApiPerspective(perspective)
    const tabParam = statusTab === "alle" ? undefined : statusTab
    const listP = listTasks({
      perspective: p,
      tab: isTildelt ? undefined : tabParam,
      search: isTildelt ? undefined : (search || undefined),
      page, pageSize: PAGE_SIZE, paginate: !isTildelt,
    })
    const statsP = fetchTaskStats(p).catch(() => null)
    return Promise.all([listP, statsP]).then(([pg, s]) => {
      setTasks(pg.results.map(toViewTask))
      setTotalCount(pg.total_count)
      setTotalPages(pg.total_pages)
      if (s) setCounts({ alle: s.total, aktive: s.pending + s.in_progress, idag: s.today, forsinket: s.overdue, ferdig: s.completed })
    }).catch(() => setErrored(true)).finally(() => setLoading(false))
  }, [perspective, statusTab, search, page, isTildelt])
  React.useEffect(() => { void loadTasks() }, [loadTasks])

  // If the current page fell past the end (e.g. after completing the last item on it), step back.
  React.useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  // The server returns exactly the rows to render for this page.
  const pageTasks = tasks
  const pageFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageTo = (page - 1) * PAGE_SIZE + tasks.length

  // Optimistic move + live status transition, then refetch.
  const moveTask = (id: string, status: TaskStatus) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t))
    const op = status === "in_progress" ? startTask(id) : status === "done" ? completeTask(id) : patchTask(id, { status: "todo" })
    Promise.resolve(op).then(() => loadTasks()).catch(() => loadTasks())
  }
  const createTask = (i: CreateInput) => {
    const dueIso = i.due && i.due.getTime() !== NO_DUE.getTime() ? i.due.toISOString() : null
    const onlySelf = i.assigneeIds.length === 1 && i.assigneeIds[0] === currentUserId
    if (onlySelf) {
      // Personal todo — stays is_admin_assigned=false, shows under "Mine oppgaver".
      apiCreateTask({
        title: i.title, description: i.description, priority: i.priority,
        due: dueIso, campaign: i.campaignId, status: i.status, assignee_ids: [currentUserId],
      }).then(() => loadTasks()).catch(() => { /* surfaced by reload */ })
      return
    }
    // Delegated — fan out to the assignees' own service (one shared assignment_group_id).
    assignTaskToUsers({
      title: i.title, description: i.description, priority: i.priority,
      due: dueIso, campaign: i.campaignId, userIds: i.assigneeIds,
    }).then(res => {
      if (res.skipped_cross_platform.length > 0) {
        setNotice(`${res.assigned_count} tildelt. ${res.skipped_cross_platform.length} QC-bruker(e) støttes ikke ennå og ble hoppet over.`)
      } else {
        setNotice(`Oppgave tildelt ${res.assigned_count} person(er).`)
      }
      loadTasks()
    }).catch(() => setNotice("Kunne ikke tildele oppgaven."))
  }
  const deleteTaskById = (id: string) => { apiDeleteTask(id).then(() => loadTasks()).catch(() => loadTasks()) }
  void deleteTaskById

  const TABS: { key: StatusTab; label: string; color?: string }[] = [
    { key: "aktive", label: "Aktive" },
    { key: "idag", label: "I dag", color: "#60a5fa" },
    { key: "forsinket", label: "Forsinket", color: "#f43f5e" },
    { key: "ferdig", label: "Ferdig", color: "#10b981" },
    { key: "alle", label: "Alle" },
  ]

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-purple-600/8 blur-3xl" />
      </div>

      <div className="relative px-4 sm:px-6 py-5 sm:py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-ab-fg-4 mb-1 truncate">Oppgaver · {ROLE_LABEL[role]}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-ab-fg">Oppgaver</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => openModal("todo")}
              className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-3 sm:px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:bg-blue-500 transition-all">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Ny oppgave</span><span className="sm:hidden">Ny</span>
            </button>
          </div>
        </motion.div>

        {/* Perspective switch (scrolls horizontally on narrow screens) */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex gap-1 rounded-2xl bg-ab-elevated border border-ab-line p-1 w-full sm:w-fit overflow-x-auto no-scrollbar">
          {perspectives.map(p => (
            <button key={p.key} onClick={() => setPerspective(p.key)}
              className={cn("cursor-pointer whitespace-nowrap shrink-0 rounded-xl px-4 sm:px-5 py-2.5 text-sm font-semibold transition-all", perspective === p.key ? "bg-ab-active text-ab-fg shadow-sm" : "text-ab-fg-3 hover:text-ab-fg-2")}>
              {p.label}
            </button>
          ))}
        </motion.div>

        {/* Toolbar */}
        {perspective !== "tildelt" && (
          <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center justify-between gap-3">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setStatusTab(t.key)}
                  className={cn("cursor-pointer flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
                    statusTab === t.key ? "bg-ab-hover text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>
                  {t.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />}
                  {t.label}
                  <span className="font-mono text-xs text-ab-fg-4">{counts[t.key]}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-4" />
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Søk i oppgaver…"
                  className="h-9 w-48 rounded-xl border border-ab-line bg-ab-elevated pl-8 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50 transition-all" />
              </div>
              {/* Layout toggle */}
              <div className="flex gap-1 rounded-xl bg-ab-elevated border border-ab-line p-1">
                <button onClick={() => setLayout("board")} className={cn("cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all", layout === "board" ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>
                  <LayoutGrid className="h-4 w-4" /> Tavle
                </button>
                <button onClick={() => setLayout("liste")} className={cn("cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all", layout === "liste" ? "bg-ab-active text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg-2")}>
                  <ListIcon className="h-4 w-4" /> Liste
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Content */}
        <div>
          {loading ? (
            <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelLoading label="Laster oppgaver…" /></div>
          ) : errored ? (
            <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelError onRetry={() => void loadTasks()} /></div>
          ) : totalCount === 0 && !isTildelt ? (
            <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelEmpty msg="Ingen oppgaver" sub="Opprett en ny oppgave for å komme i gang." /></div>
          ) : isTildelt ? (
            <DelegationView tasks={pageTasks} currentUserId={currentUserId} />
          ) : (
            <>
              {layout === "board"
                ? <Board tasks={pageTasks} onMove={moveTask} onQuickAdd={(s) => openModal(s)} />
                : <TaskList tasks={pageTasks} />}
              <Pagination page={page} totalPages={totalPages} total={totalCount} from={pageFrom} to={pageTo} onPage={setPage} />
            </>
          )}
        </div>
      </div>

      <NewTaskModal open={modalOpen} onClose={() => setModalOpen(false)} role={role} currentUserId={currentUserId} initialStatus={modalStatus} onCreate={createTask} people={people} campaigns={campaigns} />

      {/* Toast */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-xl border border-ab-line bg-ab-overlay px-4 py-3 shadow-2xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-sm text-ab-fg-2">{notice}</span>
            <button onClick={() => setNotice(null)} className="cursor-pointer text-ab-fg-4 hover:text-ab-fg"><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default OppgaverView
