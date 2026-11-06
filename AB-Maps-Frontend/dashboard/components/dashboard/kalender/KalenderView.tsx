"use client"

import * as React from "react"
import { AlertTriangle, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Eye, Inbox, Target, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { PageHeader } from "@/components/ui-ab"
import {
  schedulingApi,
  type DayCell,
  type DayState,
  type GridMember,
  type MoveRequest,
  type PersonType,
  type ShiftKey,
  type TeamGrid,
  type TeamsResult,
} from "@/lib/api/scheduling"
import { addDays, isoWeek, mondayOf, osloToday, range, rangeLabel } from "./dates"
import { DayEditor, type EditorActions } from "./DayEditor"
import { GoalsDialog } from "./GoalsDialog"
import { PlanDialog } from "./PlanDialog"
import { RequestsPanel } from "./RequestsPanel"
import { LEGEND_ORDER, STATE_STYLES } from "./states"
import { Btn } from "./Surface"
import { TeamPicker } from "./TeamPicker"
import { GridSkeleton, WeekGrid } from "./WeekGrid"

const TEAM_KEY = "kalender_team"
const DAYS = 14

function readStoredTeam(): string | null {
  try {
    return localStorage.getItem(TEAM_KEY)
  } catch {
    return null
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Noe gikk galt. Prøv igjen."
}

/** State a work day gets on the client after an optimistic change. */
function workState(date: string, today: string, noShow = false): DayState {
  if (noShow) return "no_show"
  return date < today ? "worked" : date === today ? "today" : "planned"
}

export function KalenderView() {
  const { toast } = useToast()
  const today = React.useMemo(() => osloToday(), [])

  // ── Teams ────────────────────────────────────────────────────────────────
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
        // Prefer a team the user can edit, then the one with most people.
        const best = [...sorted].sort(
          (a, b) => Number(b.can_edit) - Number(a.can_edit) || b.member_count - a.member_count,
        )[0]
        return best?.id ?? null
      })
    } catch (e) {
      setTeamsError(errMsg(e))
    }
  }, [])

  React.useEffect(() => {
    loadTeams()
  }, [loadTeams])

  const team = teams?.teams.find((t) => t.id === teamId) ?? null
  const canEdit = Boolean(team?.can_edit)

  const pickTeam = (id: string) => {
    setTeamId(id)
    try {
      localStorage.setItem(TEAM_KEY, id)
    } catch {
      /* private mode */
    }
  }

  // ── Grid ─────────────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(today))
  const [direction, setDirection] = React.useState(0)
  const [grid, setGrid] = React.useState<TeamGrid | null>(null)
  const [gridLoading, setGridLoading] = React.useState(false)
  const [gridError, setGridError] = React.useState<string | null>(null)
  const cache = React.useRef(new Map<string, TeamGrid>())
  const reqSeq = React.useRef(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const dates = React.useMemo(() => range(weekStart, DAYS), [weekStart])
  const to = dates[DAYS - 1]

  const fetchGrid = React.useCallback(
    async (tid: string, from: string, opts: { silent?: boolean } = {}) => {
      const key = `${tid}|${from}`
      const seq = ++reqSeq.current
      const cached = cache.current.get(key)
      if (cached) setGrid(cached)
      if (!cached && !opts.silent) setGridLoading(true)
      setGridError(null)
      try {
        const g = await schedulingApi.grid(tid, from, addDays(from, DAYS - 1))
        cache.current.set(key, g)
        if (seq === reqSeq.current) setGrid(g)
      } catch (e) {
        if (seq === reqSeq.current && !cached) setGridError(errMsg(e))
      } finally {
        if (seq === reqSeq.current) setGridLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    if (!teamId) return
    fetchGrid(teamId, weekStart)
  }, [teamId, weekStart, fetchGrid])

  // Prefetch neighbouring ranges so ‹ › feel instant.
  React.useEffect(() => {
    if (!teamId || !grid) return
    const t = setTimeout(() => {
      for (const off of [-7, 7]) {
        const from = addDays(weekStart, off)
        const key = `${teamId}|${from}`
        if (!cache.current.has(key)) {
          schedulingApi
            .grid(teamId, from, addDays(from, DAYS - 1))
            .then((g) => cache.current.set(key, g))
            .catch(() => {})
        }
      }
    }, 400)
    return () => clearTimeout(t)
  }, [teamId, weekStart, grid])

  const invalidate = (tid: string) => {
    for (const k of [...cache.current.keys()]) if (k.startsWith(`${tid}|`)) cache.current.delete(k)
  }
  const reloadGrid = () => {
    if (!teamId) return
    invalidate(teamId)
    fetchGrid(teamId, weekStart, { silent: true })
  }

  const go = (weeks: number) => {
    setDirection(Math.sign(weeks))
    setWeekStart((w) => addDays(w, weeks * 7))
  }
  const goToday = () => {
    const m = mondayOf(today)
    setDirection(m > weekStart ? 1 : -1)
    setWeekStart(m)
  }

  // Phone: scroll today's column into view after load.
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el || !grid || !dates.includes(today)) return
    if (window.innerWidth >= 768) return
    const head = el.querySelector<HTMLElement>(`[data-date="${today}"]`)
    if (!head) return
    const nameCol = parseFloat(getComputedStyle(el).getPropertyValue("--kal-name")) || 116
    el.scrollTo({ left: Math.max(0, head.offsetLeft - nameCol - 4), behavior: "auto" })
  }, [grid, dates, today])

  // ── Optimistic helpers ──────────────────────────────────────────────────
  const patchCell = (personId: string, date: string, fn: (c: DayCell, m: GridMember) => DayCell) => {
    setGrid((g) =>
      g
        ? {
            ...g,
            members: g.members.map((m) =>
              m.person_id !== personId ? m : { ...m, days: m.days.map((c) => (c.date === date ? fn(c, m) : c)) },
            ),
          }
        : g,
    )
  }

  /** Apply `optimistic`, run `remote`; on failure restore the snapshot and toast. */
  const mutate = async (optimistic: () => void, remote: () => Promise<unknown>, ok?: string) => {
    const snapshot = grid
    optimistic()
    try {
      await remote()
      if (ok) toast({ title: ok })
      reloadGrid()
    } catch (e) {
      setGrid(snapshot)
      toast({ title: "Endringen ble ikke lagret", description: errMsg(e), variant: "destructive" })
      throw e
    }
  }

  // ── Editor ──────────────────────────────────────────────────────────────
  const [editor, setEditor] = React.useState<{ personId: string; date: string; anchor: HTMLElement } | null>(null)
  const editMember = editor ? grid?.members.find((m) => m.person_id === editor.personId) ?? null : null
  const editCell = editor && editMember ? editMember.days.find((c) => c.date === editor.date) ?? null : null

  const actions: EditorActions = {
    createShift: (m, date) =>
      mutate(
        () =>
          patchCell(m.person_id, date, (c) => ({
            ...c,
            state: workState(date, today),
            shift_id: "pending",
            shift_editable: true,
            goals: m.default_goals ? { ...m.default_goals, source: "default" } : { doors: null, givers: null, source: "none" },
          })),
        () => schedulingApi.createShifts(teamId!, [{ person_id: m.person_id, person_type: m.person_kind, date }]),
        "Arbeidsdag lagt til",
      ).catch(() => {}),
    deleteShift: (m, cell) =>
      mutate(
        () =>
          patchCell(m.person_id, cell.date, (c) => ({
            ...c,
            state: c.date === today ? "today" : c.date < today && (c.actual?.doors ?? 0) > 0 ? "worked" : "off",
            shift_id: null,
            goals: null,
            move_request: null,
          })),
        () => schedulingApi.deleteShift(cell.shift_id!),
        "Vakten er slettet",
      ),
    setGoals: (m, cell, goals) =>
      mutate(
        () =>
          patchCell(m.person_id, cell.date, (c) => ({
            ...c,
            goals: goals
              ? { ...goals, source: "override" }
              : m.default_goals
                ? { ...m.default_goals, source: "default" }
                : { doors: null, givers: null, source: "none" },
          })),
        () => schedulingApi.setShiftGoals(cell.shift_id!, goals),
        goals ? "Dagsmål lagret" : "Bruker standardmålet",
      ).catch(() => {}),
    setNoShow: (m, cell, value) =>
      mutate(
        () => patchCell(m.person_id, cell.date, (c) => ({ ...c, state: workState(c.date, today, value) })),
        () => schedulingApi.setNoShow(cell.shift_id!, value),
        value ? "Markert som ikke møtt" : "«Ikke møtt» fjernet",
      ).catch(() => {}),
    openRequests: () => {
      setEditor(null)
      setRequestsOpen(true)
    },
  }

  // ── Plan + goals dialogs ───────────────────────────────────────────────
  const [planOpen, setPlanOpen] = React.useState(false)
  const [goalsOpen, setGoalsOpen] = React.useState(false)

  const submitPlan = async (shifts: ShiftKey[]) => {
    try {
      const res = await schedulingApi.createShifts(teamId!, shifts)
      const notes = [
        res.skipped ? `${res.skipped} var allerede planlagt og ble beholdt.` : "",
        res.skipped_other_team ? `${res.skipped_other_team} er planlagt av et annet team.` : "",
      ].filter(Boolean)
      toast({
        title: `${res.created} ${res.created === 1 ? "vakt" : "vakter"} opprettet`,
        description: notes.length ? notes.join(" ") : undefined,
      })
      reloadGrid()
    } catch (e) {
      toast({ title: "Kunne ikke planlegge", description: errMsg(e), variant: "destructive" })
      throw e
    }
  }

  const submitGoals = async (
    rows: { person_id: string; person_type: PersonType; doors: number | null; givers: number | null }[],
  ) => {
    if (rows.length === 0) return
    const snapshot = grid
    setGrid((g) =>
      g
        ? {
            ...g,
            members: g.members.map((m) => {
              const r = rows.find((x) => x.person_id === m.person_id)
              if (!r) return m
              const def = r.doors === null && r.givers === null ? null : { doors: r.doors, givers: r.givers }
              return {
                ...m,
                default_goals: def,
                days: m.days.map((c) =>
                  c.goals && c.goals.source !== "override"
                    ? { ...c, goals: def ? { ...def, source: "default" } : { doors: null, givers: null, source: "none" } }
                    : c,
                ),
              }
            }),
          }
        : g,
    )
    try {
      await schedulingApi.setDefaultGoals(teamId!, rows)
      toast({ title: "Standardmål lagret" })
      reloadGrid()
    } catch (e) {
      setGrid(snapshot)
      toast({ title: "Kunne ikke lagre mål", description: errMsg(e), variant: "destructive" })
      throw e
    }
  }

  // ── Move requests ──────────────────────────────────────────────────────
  const [requestsOpen, setRequestsOpen] = React.useState(false)
  const [requests, setRequests] = React.useState<MoveRequest[] | null>(null)
  const [reqLoading, setReqLoading] = React.useState(false)
  const [reqError, setReqError] = React.useState<string | null>(null)

  // Requests are listed per team (GET move-requests/?team=); the header badge
  // sums `pending_move_requests` over every team the user sees.
  const loadRequests = React.useCallback(async () => {
    if (!teamId) return
    setReqLoading(true)
    setReqError(null)
    try {
      setRequests(await schedulingApi.moveRequests(teamId))
    } catch (e) {
      setReqError(errMsg(e))
    } finally {
      setReqLoading(false)
    }
  }, [teamId])

  React.useEffect(() => {
    setRequests(null)
    if (requestsOpen) loadRequests()
  }, [requestsOpen, loadRequests])

  const pendingCount = (teams?.teams ?? []).reduce((n, t) => n + t.pending_requests, 0)
  const otherPending = (teams?.teams ?? [])
    .filter((t) => t.id !== teamId && t.pending_requests > 0)
    .map((t) => ({ id: t.id, name: t.name, count: t.pending_requests }))
  const teamEditable = React.useCallback(
    (id: string) => Boolean(teams?.teams.find((t) => t.id === id)?.can_edit),
    [teams],
  )

  const decide = async (r: MoveRequest, kind: "approve" | "decline", reason: string | null = null) => {
    if (kind === "approve") await schedulingApi.approveMove(r.id)
    else await schedulingApi.declineMove(r.id, reason)
    setRequests((rs) =>
      (rs ?? []).map((x) =>
        x.id === r.id
          ? { ...x, status: kind === "approve" ? "godkjent" : "avslatt", decline_reason: reason, decided_by_name: "deg" }
          : x,
      ),
    )
    toast({
      title: kind === "approve" ? "Forespørsel godkjent" : "Forespørsel avslått",
      description: kind === "approve" ? `${r.person_name} er flyttet.` : undefined,
    })
    invalidate(r.team_id)
    if (r.team_id === teamId) fetchGrid(r.team_id, weekStart, { silent: true })
    loadTeams()
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const weekA = isoWeek(weekStart)
  const weekB = isoWeek(addDays(weekStart, 7))
  const isCurrent = weekStart === mondayOf(today)

  const header = (
    <PageHeader
      eyebrow="Team"
      title="Kalender"
      description="Arbeidsdager, dagsmål og oppmøte for teamet."
      action={
        teams && teams.teams.length > 0 ? (
          <Btn onClick={() => setRequestsOpen(true)} className="relative" aria-label={`Forespørsler, ${pendingCount} venter`}>
            <Inbox className="h-4 w-4" />
            <span>Forespørsler</span>
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F59E0B] px-1.5 text-[11px] font-semibold tabular-nums text-white">
                {pendingCount}
              </span>
            )}
          </Btn>
        ) : null
      }
    />
  )

  if (teamsError) {
    return (
      <div>
        {header}
        <div className="px-4 pt-4 md:px-6 md:pt-5">
          <StateCard
            icon={<AlertTriangle className="h-6 w-6 text-[#DC2626]" />}
            title="Kunne ikke laste kalenderen"
            sub={teamsError}
            action={<Btn onClick={loadTeams}>Prøv igjen</Btn>}
          />
        </div>
      </div>
    )
  }

  if (teams && teams.teams.length === 0) {
    return (
      <div>
        {header}
        <div className="px-4 pt-4 md:px-6 md:pt-5">
          <StateCard
            icon={<Users className="h-6 w-6 text-ab-fg-4" />}
            title="Du har ingen team å vise"
            sub="Kalenderen viser team der du er salgssjef, teamleder eller nestleder."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-10">
      {header}

      <div className="space-y-3 px-4 pt-4 md:px-6 md:pt-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          <div className="min-w-0 lg:flex-1">
            {teams ? (
              <TeamPicker teams={teams.teams} value={teamId} onChange={pickTeam} />
            ) : (
              <div className="h-11 w-full animate-pulse rounded-ab-md bg-ab-hover md:h-9 md:w-[280px]" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-11 flex-1 items-center rounded-ab-md border border-ab-line bg-ab-elevated md:h-9 lg:flex-none">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Forrige uke"
                className="flex h-full w-11 cursor-pointer items-center justify-center rounded-l-ab-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ab-accent md:w-9"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div
                className="flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 border-x border-ab-line px-3 text-[13px] lg:w-[200px] lg:flex-none"
                aria-live="polite"
              >
                <span className="font-semibold tabular-nums text-ab-fg">
                  Uke {weekA}–{weekB}
                </span>
                <span className="truncate text-ab-fg-3">· {rangeLabel(weekStart, to)}</span>
              </div>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Neste uke"
                className="flex h-full w-11 cursor-pointer items-center justify-center rounded-r-ab-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ab-accent md:w-9"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Btn onClick={goToday} disabled={isCurrent} className="shrink-0">
              <CalendarDays className="h-4 w-4" />
              I dag
            </Btn>
          </div>

          {canEdit && (
            <div className="grid grid-cols-2 gap-2 lg:flex">
              <Btn onClick={() => setGoalsOpen(true)} disabled={!grid || grid.members.length === 0}>
                <Target className="h-4 w-4" />
                Mål
              </Btn>
              <Btn variant="primary" onClick={() => setPlanOpen(true)} disabled={!grid || grid.members.length === 0}>
                <CalendarPlus className="h-4 w-4" />
                Planlegg
              </Btn>
            </div>
          )}
        </div>

        {team && !canEdit && (
          <div className="flex items-center gap-2 rounded-ab-md border border-ab-line bg-ab-subtle px-3 py-2 text-[13px] text-ab-fg-2">
            <Eye className="h-4 w-4 shrink-0 text-ab-fg-3" aria-hidden />
            Du ser teamets kalender. Salgssjefen planlegger dager og mål.
          </div>
        )}

        {/* Grid */}
        {gridError && !grid ? (
          <StateCard
            icon={<AlertTriangle className="h-6 w-6 text-[#DC2626]" />}
            title="Kunne ikke laste kalenderen"
            sub={gridError}
            action={<Btn onClick={() => teamId && fetchGrid(teamId, weekStart)}>Prøv igjen</Btn>}
          />
        ) : !grid || (gridLoading && grid.team_id !== teamId) ? (
          <GridSkeleton rows={Math.min(team?.member_count || 6, 8)} />
        ) : grid.members.length === 0 ? (
          <StateCard
            icon={<Users className="h-6 w-6 text-ab-fg-4" />}
            title="Ingen personer i teamet"
            sub="Medlemmer legges til i HR-systemet."
          />
        ) : (
          <div className={cn("transition-opacity duration-150", gridLoading && "opacity-60")}>
            <WeekGrid
              dates={dates}
              today={today}
              members={grid.members}
              editable={canEdit}
              selectedKey={editor ? `${editor.personId}|${editor.date}` : null}
              onOpen={(m, c, el) => setEditor({ personId: m.person_id, date: c.date, anchor: el })}
              direction={direction}
              scrollRef={scrollRef}
            />
          </div>
        )}

        {/* Legend */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1" aria-label="Forklaring">
          {LEGEND_ORDER.map((s) => {
            const st = STATE_STYLES[s]
            return (
              <li key={s} className="flex items-center gap-1.5 text-[12px] text-ab-fg-2">
                <span className={cn("h-3 w-3 rounded-[4px] border-2", st.card)} aria-hidden />
                {st.label}
              </li>
            )
          })}
          <li className="flex items-center gap-1.5 text-[12px] text-ab-fg-2">
            <span className="h-3 w-3 rounded-full bg-[#F59E0B]" aria-hidden />
            Ber om flytting
          </li>
        </ul>
      </div>

      {canEdit && (
        <DayEditor
          member={editMember}
          cell={editCell}
          today={today}
          anchor={editor?.anchor ?? null}
          onClose={() => setEditor(null)}
          actions={actions}
        />
      )}
      {canEdit && grid && team && (
        <>
          <PlanDialog
            open={planOpen}
            onOpenChange={setPlanOpen}
            members={grid.members}
            today={today}
            teamName={team.name}
            onSubmit={submitPlan}
          />
          <GoalsDialog
            open={goalsOpen}
            onOpenChange={setGoalsOpen}
            members={grid.members}
            teamName={team.name}
            onSubmit={submitGoals}
          />
        </>
      )}
      <RequestsPanel
        open={requestsOpen}
        onOpenChange={setRequestsOpen}
        requests={requests}
        loading={reqLoading}
        error={reqError}
        onRetry={loadRequests}
        canEditTeam={teamEditable}
        teamName={team?.name ?? ""}
        otherTeams={otherPending}
        onPickTeam={(id) => pickTeam(id)}
        onApprove={(r) => decide(r, "approve")}
        onDecline={(r, reason) => decide(r, "decline", reason)}
      />
    </div>
  )
}

function StateCard({
  icon,
  title,
  sub,
  action,
}: {
  icon: React.ReactNode
  title: string
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-ab-xl border border-ab-line bg-ab-elevated px-6 py-14 text-center md:mx-6 md:mt-5">
      {icon}
      <p className="mt-1 text-[15px] font-semibold text-ab-fg">{title}</p>
      {sub && <p className="max-w-sm text-[13px] text-ab-fg-2">{sub}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
