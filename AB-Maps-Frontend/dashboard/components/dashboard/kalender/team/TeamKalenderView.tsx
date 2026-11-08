"use client"

import * as React from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Loader2, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/components/ui/use-mobile"
import {
  schedulingApi,
  type DayCell,
  type DayState,
  type GridMember,
  type MoveRequest,
  type PersonType,
  type ShiftKey,
  type TeamGrid as Grid,
  type TeamsResult,
} from "@/lib/api/scheduling"
import { addDays, isoWeek, mondayOf, osloToday, range } from "../dates"
import { fmtNum, fmtPct } from "../states"
import { GoalsDialog } from "../GoalsDialog"
import { Surface } from "../Surface"
import { TeamPicker } from "../TeamPicker"
import { PlanWeeksDialog } from "./PlanWeeksDialog"
import { BLUE_BTN, Btn2, DayDetail, GREY_BTN, RequestsList, type DayActions } from "./SidePanel"
import { GridSkeleton, TeamGrid, kindOf } from "./TeamGrid"

// Teamkalender for sales chiefs, team leaders and admins, after the client's
// HTML (08 Nov): header with week tabs + «Kopier vaktmønster», four KPI cards
// that follow the week, the team grid (one week), the selected day and the
// move requests on the right. Data and rights are the same as before:
// GET /api/scheduling/teams/ decides who may edit; the backend checks every write.

const TEAM_KEY = "kalender_team"
const DAYS = 7

function readStoredTeam(): string | null {
  try { return localStorage.getItem(TEAM_KEY) } catch { return null }
}
function errMsg(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Noe gikk galt. Prøv igjen."
}
function workState(date: string, today: string, noShow = false): DayState {
  if (noShow) return "no_show"
  return date < today ? "worked" : date === today ? "today" : "planned"
}

export function TeamKalenderView() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const today = React.useMemo(() => osloToday(), [])
  const thisMon = mondayOf(today)

  // ── teams ────────────────────────────────────────────────────────────────
  const [teams, setTeams] = React.useState<TeamsResult | null>(null)
  const [teamsError, setTeamsError] = React.useState<string | null>(null)
  const [teamId, setTeamId] = React.useState<string | null>(null)
  const loadTeams = React.useCallback(async () => {
    setTeamsError(null)
    try {
      const res = await schedulingApi.teams()
      const sorted = [...res.teams].sort((a, b) => a.name.localeCompare(b.name, "nb"))
      setTeams({ ...res, teams: sorted })
      setTeamId((cur) => {
        const stored = cur ?? readStoredTeam()
        if (stored && sorted.some((t) => t.id === stored)) return stored
        const best = [...sorted].sort((a, b) => Number(b.can_edit) - Number(a.can_edit) || b.member_count - a.member_count)[0]
        return best?.id ?? null
      })
    } catch (e) { setTeamsError(errMsg(e)) }
  }, [])
  React.useEffect(() => { loadTeams() }, [loadTeams])
  const team = teams?.teams.find((t) => t.id === teamId) ?? null
  const canEdit = Boolean(team?.can_edit)
  const pickTeam = (id: string) => { setTeamId(id); try { localStorage.setItem(TEAM_KEY, id) } catch { /* private mode */ } }

  // ── week + grid ──────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = React.useState(thisMon)
  const [grid, setGrid] = React.useState<Grid | null>(null)
  const [gridLoading, setGridLoading] = React.useState(false)
  const [gridError, setGridError] = React.useState<string | null>(null)
  const cache = React.useRef(new Map<string, Grid>())
  const seq = React.useRef(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const dates = React.useMemo(() => range(weekStart, DAYS), [weekStart])
  const past = dates[6] < today          // week finished
  const results = dates[0] <= today      // current or past week: show results, not plans

  const fetchGrid = React.useCallback(async (tid: string, from: string, opts: { silent?: boolean } = {}) => {
    const key = `${tid}|${from}`
    const my = ++seq.current
    const cached = cache.current.get(key)
    if (cached) setGrid(cached)
    if (!cached && !opts.silent) setGridLoading(true)
    setGridError(null)
    try {
      const g = await schedulingApi.grid(tid, from, addDays(from, DAYS - 1))
      cache.current.set(key, g)
      if (my === seq.current) setGrid(g)
    } catch (e) {
      if (my === seq.current && !cached) setGridError(errMsg(e))
    } finally {
      if (my === seq.current) setGridLoading(false)
    }
  }, [])
  React.useEffect(() => { if (teamId) fetchGrid(teamId, weekStart) }, [teamId, weekStart, fetchGrid])
  React.useEffect(() => {
    // neighbours, so the tabs feel instant and «Kopier vaktmønster» has last week
    if (!teamId || !grid) return
    const t = setTimeout(() => {
      for (const off of [-7, 7, 14]) {
        const from = addDays(weekStart, off)
        const key = `${teamId}|${from}`
        if (!cache.current.has(key)) schedulingApi.grid(teamId, from, addDays(from, DAYS - 1)).then((g) => cache.current.set(key, g)).catch(() => {})
      }
    }, 300)
    return () => clearTimeout(t)
  }, [teamId, weekStart, grid])
  const invalidate = (tid: string) => { for (const k of [...cache.current.keys()]) if (k.startsWith(`${tid}|`)) cache.current.delete(k) }
  const reload = () => { if (teamId) { invalidate(teamId); fetchGrid(teamId, weekStart, { silent: true }) } }

  const [onlyActive, setOnlyActive] = React.useState(false)
  const members = React.useMemo(() => {
    const all = grid?.members ?? []
    if (!onlyActive) return all
    return all.filter((m) => m.days.some((c) => dates.includes(c.date) && (c.shift_id || (c.actual?.doors ?? 0) > 0)))
  }, [grid, onlyActive, dates])

  // ── optimistic edits ─────────────────────────────────────────────────────
  const patchCell = (pid: string, date: string, fn: (c: DayCell, m: GridMember) => DayCell) =>
    setGrid((g) => g ? { ...g, members: g.members.map((m) => m.person_id !== pid ? m : { ...m, days: m.days.map((c) => c.date === date ? fn(c, m) : c) }) } : g)
  const mutate = async (optimistic: () => void, remote: () => Promise<unknown>, ok?: string) => {
    const snap = grid
    optimistic()
    try { await remote(); if (ok) toast({ title: ok }); reload() }
    catch (e) { setGrid(snap); toast({ title: "Endringen ble ikke lagret", description: errMsg(e), variant: "destructive" }); throw e }
  }

  // ── selected day ─────────────────────────────────────────────────────────
  const [sel, setSel] = React.useState<{ pid: string; date: string } | null>(null)
  const selMember = sel ? grid?.members.find((m) => m.person_id === sel.pid) ?? null : null
  const selCell = sel && selMember ? selMember.days.find((c) => c.date === sel.date) ?? null : null
  React.useEffect(() => { setSel(null) }, [teamId, weekStart])

  // ── requests ─────────────────────────────────────────────────────────────
  const [requests, setRequests] = React.useState<MoveRequest[] | null>(null)
  const [reqLoading, setReqLoading] = React.useState(false)
  const loadRequests = React.useCallback(async () => {
    if (!teamId) return
    setReqLoading(true)
    try { setRequests(await schedulingApi.moveRequests(teamId)) } catch { /* list stays */ } finally { setReqLoading(false) }
  }, [teamId])
  React.useEffect(() => { setRequests(null); loadRequests() }, [loadRequests])
  const otherPending = (teams?.teams ?? []).filter((t) => t.id !== teamId && t.pending_requests > 0).map((t) => ({ id: t.id, name: t.name, count: t.pending_requests }))

  const actions: DayActions = {
    createShift: (m, date) => mutate(
      () => patchCell(m.person_id, date, (c) => ({ ...c, state: workState(date, today), shift_id: "pending", shift_editable: true, goals: m.default_goals ? { ...m.default_goals, source: "default" } : { doors: null, givers: null, source: "none" } })),
      () => schedulingApi.createShifts(teamId!, [{ person_id: m.person_id, person_type: m.person_kind, date }]), "Vakt lagt til").catch(() => {}),
    deleteShift: (m, cell) => mutate(
      () => patchCell(m.person_id, cell.date, (c) => ({ ...c, state: c.date === today ? "today" : c.date < today && (c.actual?.doors ?? 0) > 0 ? "worked" : "off", shift_id: null, goals: null, move_request: null })),
      () => schedulingApi.deleteShift(cell.shift_id!), "Vakten er fjernet").then(() => setSel(null)).catch(() => {}),
    setGoals: (m, cell, goals) => mutate(
      () => patchCell(m.person_id, cell.date, (c) => ({ ...c, goals: goals ? { ...goals, source: "override" } : m.default_goals ? { ...m.default_goals, source: "default" } : { doors: null, givers: null, source: "none" } })),
      () => schedulingApi.setShiftGoals(cell.shift_id!, goals), goals ? "Dagsmål lagret" : "Bruker fast mål").catch(() => {}),
    setNoShow: (m, cell, value) => mutate(
      () => patchCell(m.person_id, cell.date, (c) => ({ ...c, state: workState(c.date, today, value) })),
      () => schedulingApi.setNoShow(cell.shift_id!, value), value ? "Markert som ikke møtt" : "«Ikke møtt» fjernet").catch(() => {}),
    approve: async (r) => {
      try { await schedulingApi.approveMove(r.id) } catch (e) { toast({ title: "Kunne ikke godkjenne", description: errMsg(e), variant: "destructive" }); throw e }
      setRequests((rs) => (rs ?? []).map((x) => x.id === r.id ? { ...x, status: "godkjent", decided_by_name: "deg" } : x))
      toast({ title: "Bytte godkjent", description: `${r.person_name} er flyttet.` })
      invalidate(r.team_id); if (r.team_id === teamId) fetchGrid(r.team_id, weekStart, { silent: true }); loadTeams()
    },
    decline: async (r, reason) => {
      try { await schedulingApi.declineMove(r.id, reason) } catch (e) { toast({ title: "Kunne ikke avslå", description: errMsg(e), variant: "destructive" }); throw e }
      setRequests((rs) => (rs ?? []).map((x) => x.id === r.id ? { ...x, status: "avslatt", decline_reason: reason, decided_by_name: "deg" } : x))
      toast({ title: "Bytte avslått" })
      invalidate(r.team_id); if (r.team_id === teamId) fetchGrid(r.team_id, weekStart, { silent: true }); loadTeams()
    },
  }

  // ── plan / goals / copy ──────────────────────────────────────────────────
  const [planOpen, setPlanOpen] = React.useState(false)
  const [goalsOpen, setGoalsOpen] = React.useState(false)
  const [copying, setCopying] = React.useState(false)
  // Planned days the view knows about: the cached weeks plus whatever the Planlegg
  // dialog asked for (its whole period, in 42-day chunks = the API's maximum).
  const [extraKnown, setExtraKnown] = React.useState<Set<string>>(new Set())
  const loadedRanges = React.useRef(new Set<string>())
  const ensureLoaded = React.useCallback((start: string, end: string) => {
    if (!teamId) return
    const tid = teamId
    const chunks: [string, string][] = []
    for (let from = mondayOf(start); from <= end; from = addDays(from, 42)) chunks.push([from, addDays(from, 41) < end ? addDays(from, 41) : addDays(mondayOf(end), 6)])
    for (const [from, to] of chunks) {
      const key = `${tid}|${from}|${to}`
      if (loadedRanges.current.has(key)) continue
      loadedRanges.current.add(key)
      schedulingApi.grid(tid, from, to).then((g) => {
        setExtraKnown((prev) => {
          const n = new Set(prev)
          for (const m of g.members) for (const c of m.days) if (c.shift_id) n.add(`${m.person_id}|${c.date}`)
          return n
        })
      }).catch(() => loadedRanges.current.delete(key))
    }
  }, [teamId])
  React.useEffect(() => { loadedRanges.current.clear(); setExtraKnown(new Set()) }, [teamId])
  const known = React.useMemo(() => {
    const s = new Set<string>(extraKnown)
    for (const g of cache.current.values()) for (const m of g.members) for (const c of m.days) if (c.shift_id) s.add(`${m.person_id}|${c.date}`)
    return s
  }, [grid, planOpen, extraKnown]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitPlan = async (shifts: ShiftKey[], goal: { doors: number | null; givers: number | null } | null) => {
    try {
      const res = await schedulingApi.createShifts(teamId!, shifts)
      if (goal && res.created > 0) {
        // the same goal on every new day: read the grid back and patch the new shifts
        invalidate(teamId!)
        const byWeek = new Map<string, ShiftKey[]>()
        for (const k of shifts) { const mon = mondayOf(k.date); if (!byWeek.has(mon)) byWeek.set(mon, []); byWeek.get(mon)!.push(k) }
        for (const [mon] of byWeek) {
          const g = await schedulingApi.grid(teamId!, mon, addDays(mon, 6))
          cache.current.set(`${teamId}|${mon}`, g)
          for (const m of g.members) for (const c of m.days) if (c.shift_id && shifts.some((k) => k.person_id === m.person_id && k.date === c.date) && c.goals?.source !== "override") await schedulingApi.setShiftGoals(c.shift_id, goal)
        }
      }
      const notes = [res.skipped ? `${res.skipped} var allerede planlagt og ble beholdt.` : "", res.skipped_other_team ? `${res.skipped_other_team} er planlagt av et annet team.` : ""].filter(Boolean)
      toast({ title: `${res.created} ${res.created === 1 ? "vakt" : "vakter"} opprettet`, description: notes.join(" ") || undefined })
      loadedRanges.current.clear(); setExtraKnown(new Set())
      reload()
    } catch (e) { toast({ title: "Kunne ikke planlegge", description: errMsg(e), variant: "destructive" }); throw e }
  }

  const submitGoals = async (rows: { person_id: string; person_type: PersonType; doors: number | null; givers: number | null }[]) => {
    if (!rows.length) return
    try { await schedulingApi.setDefaultGoals(teamId!, rows); toast({ title: "Fast mål lagret" }); reload() }
    catch (e) { toast({ title: "Kunne ikke lagre mål", description: errMsg(e), variant: "destructive" }); throw e }
  }

  const copyPrev = async () => {
    if (!teamId || !grid) return
    const prevMon = addDays(weekStart, -7)
    setCopying(true)
    try {
      let prev = cache.current.get(`${teamId}|${prevMon}`)
      if (!prev) { prev = await schedulingApi.grid(teamId, prevMon, addDays(prevMon, 6)); cache.current.set(`${teamId}|${prevMon}`, prev) }
      const shifts: ShiftKey[] = []
      for (const m of prev.members) for (const c of m.days) {
        if (!c.shift_id) continue
        const date = addDays(c.date, 7)
        if (date < today) continue
        const cur = grid.members.find((x) => x.person_id === m.person_id)?.days.find((x) => x.date === date)
        if (cur?.shift_id) continue
        shifts.push({ person_id: m.person_id, person_type: m.person_kind, date })
      }
      if (!shifts.length) { toast({ title: "Ingenting å kopiere", description: `Uke ${isoWeek(weekStart)} har allerede alle vaktene fra uke ${isoWeek(prevMon)}.` }); return }
      const res = await schedulingApi.createShifts(teamId, shifts)
      toast({ title: `${res.created} ${res.created === 1 ? "vakt" : "vakter"} kopiert fra uke ${isoWeek(prevMon)}` })
      reload()
    } catch (e) { toast({ title: "Kunne ikke kopiere", description: errMsg(e), variant: "destructive" }) }
    finally { setCopying(false) }
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    const ms = grid?.members ?? []
    let done = 0, doors = 0, ja = 0, plan = 0, goal = 0, adjusted = 0
    const empty: string[] = []
    const worked = new Set<string>()
    for (const m of ms) {
      let any = false
      for (const c of m.days) {
        if (!dates.includes(c.date)) continue
        const k = kindOf(c, today)
        if (k === "done" || k === "noshow" || (k === "today" && c.shift_id)) { done++; any = true; if (c.actual) { doors += c.actual.doors; ja += c.actual.ja; if (c.actual.doors) worked.add(m.person_id) } }
        if (c.shift_id && c.date >= today) { plan++; any = true; goal += c.goals?.doors ?? 0; if (c.goals?.source === "override") adjusted++ }
      }
      if (!any) empty.push(m.name.split(" ")[0])
    }
    const open = (requests ?? []).filter((r) => r.status === "venter").length
    const n = ms.length
    if (results) return [
      { k: "Vakter gjennomført", v: String(done), s: `av ${n} promotører, ${worked.size} jobbet`, tone: "" },
      { k: "Dører banket", v: fmtNum(doors), s: `Snitt ${done ? Math.round(doors / done) : 0} per vakt`, tone: "" },
      { k: "Nye givere", v: String(ja), s: "Hele teamet denne uken", tone: "text-[#15803D] dark:text-[#5BE0A3]" },
      { k: "Ja %", v: doors ? fmtPct((100 * ja) / doors) : "0 %", s: "Givere delt på dører", tone: "" },
    ]
    return [
      { k: "Planlagte vakter", v: String(plan), s: `Mål ${fmtNum(goal)} dører totalt`, tone: "" },
      { k: "Uten vakter", v: String(empty.length), s: empty.length ? empty.join(", ") : "Alle har minst en vakt", tone: empty.length ? "text-[#B45309] dark:text-[#F5B54A]" : "text-[#15803D] dark:text-[#5BE0A3]" },
      { k: "Åpne bytteforespørsler", v: String(open), s: open ? "Svar før uken starter" : "Alt er behandlet", tone: open ? "text-[#B45309] dark:text-[#F5B54A]" : "text-[#15803D] dark:text-[#5BE0A3]" },
      { k: "Justerte dagsmål", v: String(adjusted), s: "Avvik fra fast mål", tone: "text-[#2563EB] dark:text-[#7CB8FF]" },
    ]
  }, [grid, dates, today, results, requests])

  // ── week tabs ────────────────────────────────────────────────────────────
  const tabOffsets = React.useMemo(() => {
    const cur = Math.round((new Date(weekStart).getTime() - new Date(thisMon).getTime()) / 6048e5)
    const base = Math.min(Math.max(cur - 1, -1), cur)
    return [base, base + 1, base + 2].filter((o) => o >= -4)
  }, [weekStart, thisMon])
  const tabLabel = (o: number) => o === 0 ? "denne uken" : o === 1 ? "neste uke" : o === -1 ? "forrige uke" : o > 1 ? `om ${o} uker` : `${-o} uker siden`

  const detailProps = { member: selMember, cell: selCell, today, editable: canEdit, requests: requests ?? [], actions, onClose: () => setSel(null) }
  const title = team ? `Team ${team.name}${team.city ? `, ${team.city}` : ""}` : "Team"

  return (
    <div className="min-h-screen bg-ab-base px-4 pb-14 pt-5 text-[14px] text-ab-fg md:px-8 md:pt-7">
      <div className="mx-auto flex max-w-[1640px] flex-col gap-5">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ab-fg-3">{title}</div>
            <h1 className="font-display text-[24px] font-bold leading-tight tracking-tight md:text-[28px]">Teamkalender</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {teams && teams.teams.length > 1 && <TeamPicker teams={teams.teams} value={teamId} onChange={pickTeam} />}
            <div className="flex items-center gap-1 rounded-[12px] border border-ab-line bg-ab-elevated p-1 dark:border-[#26282D] dark:bg-[#17181B]" role="tablist" aria-label="Velg uke">
              <button type="button" aria-label="Forrige uke" onClick={() => setWeekStart((w) => addDays(w, -7))} className="flex h-10 w-9 items-center justify-center rounded-[9px] text-ab-fg-2 hover:bg-ab-hover"><ChevronLeft className="h-4 w-4" /></button>
              {tabOffsets.map((o) => {
                const mon = addDays(thisMon, o * 7)
                const on = mon === weekStart
                return (
                  <button key={o} type="button" role="tab" aria-selected={on} onClick={() => setWeekStart(mon)}
                    className={cn("min-h-[40px] rounded-[9px] px-3 text-[14px] font-semibold md:px-4", on ? "bg-ab-subtle text-ab-fg dark:bg-[#2A2D33] dark:text-white" : "text-ab-fg-2 hover:bg-ab-hover")}>
                    Uke {isoWeek(mon)} <span className="hidden font-normal opacity-75 lg:inline">{tabLabel(o)}</span>
                  </button>
                )
              })}
              <button type="button" aria-label="Neste uke" onClick={() => setWeekStart((w) => addDays(w, 7))} className="flex h-10 w-9 items-center justify-center rounded-[9px] text-ab-fg-2 hover:bg-ab-hover"><ChevronRight className="h-4 w-4" /></button>
            </div>
            {canEdit && !past && (
              <Btn2 tone={BLUE_BTN} onClick={copyPrev} disabled={copying || !grid}>
                {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                <span className="hidden sm:inline">Kopier vaktmønster fra uke {isoWeek(addDays(weekStart, -7))}</span><span className="sm:hidden">Kopier uke {isoWeek(addDays(weekStart, -7))}</span>
              </Btn2>
            )}
            {canEdit && <Btn2 tone={GREY_BTN} onClick={() => setPlanOpen(true)} disabled={!grid}>Planlegg</Btn2>}
            {canEdit && <Btn2 tone={GREY_BTN} onClick={() => setGoalsOpen(true)} disabled={!grid} aria-label="Fast mål"><Target className="h-4 w-4" /><span className="hidden sm:inline">Fast mål</span></Btn2>}
          </div>
        </div>

        {teamsError && <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-ab-line bg-ab-elevated p-4 text-[13px]"><AlertTriangle className="h-4 w-4 text-[#B91C1C]" /> {teamsError} <Btn2 tone={GREY_BTN} className="min-h-[36px]" onClick={loadTeams}>Prøv igjen</Btn2></div>}
        {teams && teams.teams.length === 0 && <div className="rounded-[14px] border border-ab-line bg-ab-elevated p-5 text-[13px] text-ab-fg-2">Du er ikke salgssjef eller teamleder for noe team ennå. Teamene settes i HR.</div>}

        {/* KPIs */}
        {(grid || gridLoading) && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((x) => (
              <div key={x.k} className="flex flex-col gap-1.5 rounded-[14px] border border-ab-line bg-ab-elevated px-[18px] py-4 dark:border-[#25272C] dark:bg-[#16171A]">
                <div className="text-[13px] text-ab-fg-2">{x.k}</div>
                <div className={cn("text-[26px] font-bold leading-none tracking-tight tabular-nums", x.tone)}>{gridLoading && !grid ? "–" : x.v}</div>
                <div className="truncate text-[12px] text-ab-fg-3" title={x.s}>{x.s}</div>
              </div>
            ))}
          </div>
        )}

        {/* main + side */}
        {teamId && (
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex min-w-0 flex-[999_1_960px] flex-col rounded-[16px] border border-ab-line bg-ab-elevated dark:border-[#25272C] dark:bg-[#131416]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ab-line-1 px-[18px] py-3.5 dark:border-[#222428]">
                <div className="flex flex-wrap items-center gap-4 text-[12px] text-ab-fg-2">
                  {[["bg-[#16A34A] dark:bg-[#3ECF8E]", "Nådde givermål"], ["bg-[#D97706] dark:bg-[#F5A524]", "Under givermål"], ["bg-ab-subtle border border-ab-line-2 dark:bg-[#2A2D33] dark:border-[#4A4E57]", "Planlagt vakt"], ["border border-dashed border-[#D97706] dark:border-[#F5A524]", "Ønsker bytte"], ["bg-[#DC2626] dark:bg-[#EF4444]", "Ikke møtt"]].map(([c, l]) => (
                    <span key={l} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-[3px]", c)} aria-hidden />{l}</span>
                  ))}
                </div>
                <button type="button" aria-pressed={onlyActive} onClick={() => setOnlyActive((v) => !v)} className="flex min-h-[40px] items-center gap-2.5 px-1 text-[13px] text-ab-fg-2">
                  <span aria-hidden className={cn("relative block h-5 w-[34px] rounded-full transition-colors", onlyActive ? "bg-[#3B9EFF]" : "bg-ab-line-2 dark:bg-[#34373E]")}><span className={cn("absolute top-[2px] h-4 w-4 rounded-full bg-white transition-[left]", onlyActive ? "left-4" : "left-[2px]")} /></span>
                  Vis bare promotører med vakter
                </button>
              </div>
              {gridError && !grid && <div className="flex flex-wrap items-center gap-3 p-5 text-[13px]"><AlertTriangle className="h-4 w-4 text-[#B91C1C]" /> {gridError} <Btn2 tone={GREY_BTN} className="min-h-[36px]" onClick={() => fetchGrid(teamId, weekStart)}>Prøv igjen</Btn2></div>}
              {!grid && !gridError && <GridSkeleton />}
              {grid && (
                <TeamGrid
                  dates={dates}
                  today={today}
                  members={members}
                  editable={canEdit}
                  selectedKey={sel ? `${sel.pid}|${sel.date}` : null}
                  onOpen={(m, c) => setSel({ pid: m.person_id, date: c.date })}
                  scrollRef={scrollRef}
                />
              )}
              <div className="border-t border-ab-line-1 px-[18px] py-3 text-[12px] text-ab-fg-3 dark:border-[#222428]">
                {past ? `Uke ${isoWeek(weekStart)} er gjennomført. Klikk en dag for å se resultatet${canEdit ? " eller markere ikke møtt" : ""}.` : canEdit ? "Klikk en tom dag for å legge inn vakt. Klikk en vakt for å justere dagsmålet eller fjerne den." : "Kun lesing: salgssjefen for teamet planlegger."}
              </div>
            </div>

            <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
              {!isMobile && (
                <div className="flex flex-col gap-3.5 rounded-[16px] border border-ab-line bg-ab-elevated p-[18px] dark:border-[#25272C] dark:bg-[#16171A]">
                  <DayDetail {...detailProps} />
                </div>
              )}
              <div className="flex flex-col gap-3 rounded-[16px] border border-ab-line bg-ab-elevated p-[18px] dark:border-[#25272C] dark:bg-[#16171A]">
                <RequestsList requests={requests} loading={reqLoading} editable={canEdit} actions={actions} otherTeams={otherPending} onPickTeam={pickTeam} />
              </div>
            </aside>
          </div>
        )}
      </div>

      {isMobile && (
        <Surface open={Boolean(selMember && selCell)} onOpenChange={(o) => { if (!o) setSel(null) }} title={selMember?.name ?? ""} description={selCell ? `${isoWeek(selCell.date) ? `Uke ${isoWeek(selCell.date)}` : ""}` : undefined}>
          <div className="flex flex-col gap-3.5"><DayDetail {...detailProps} withHeader={false} /></div>
        </Surface>
      )}

      {grid && (
        <>
          <PlanWeeksDialog open={planOpen} onOpenChange={setPlanOpen} members={grid.members} today={today} known={known} ensureLoaded={ensureLoaded} onSubmit={submitPlan} />
          <GoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} members={grid.members} teamName={team?.name ?? ""} onSubmit={submitGoals} />
        </>
      )}
    </div>
  )
}
