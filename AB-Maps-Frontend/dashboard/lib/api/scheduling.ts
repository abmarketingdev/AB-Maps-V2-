// Kalender (shift calendar + daily goals) — adapter over maps-service
// /api/scheduling/ (E1). This is the ONLY file that knows the wire format:
// the UI talks to the `SchedulingApi` interface below.
//
// Local mock: `next dev` with NEXT_PUBLIC_KALENDER_MOCK=1 swaps in
// ./scheduling.mock. Never part of a production build (see resolveApi).

import { fetchWithAuth } from "@/lib/auth/fetchWithAuth"

// ── Domain types (UI-facing) ────────────────────────────────────────────────

export type DayState = "no_show" | "worked" | "today" | "planned" | "off"
export type TeamRole = "admin" | "sales_chief" | "leader" | "co_leader"
export type MoveStatus = "venter" | "godkjent" | "avslatt" | "avbrutt"
export type PersonType = "employee" | "manager"

export interface Goals {
  doors: number | null
  givers: number | null
  /** "override" = set for this day only; "default" = the person's default. */
  source: "default" | "override" | "none"
}

export interface Actual {
  doors: number
  ja: number
  ja_pct: number | null
}

export interface MoveRequestRef {
  id: string
  status: MoveStatus
  from_date: string
  to_date: string
}

export interface DayCell {
  date: string
  state: DayState
  shift_id: string | null
  /** false when the shift was planned by another team (read-only here) */
  shift_editable: boolean
  shift_team_name: string | null
  goals: Goals | null
  actual: Actual | null
  move_request: MoveRequestRef | null
}

export interface GridMember {
  person_id: string
  person_kind: PersonType
  name: string
  role_label?: string | null
  default_goals: { doors: number | null; givers: number | null } | null
  days: DayCell[]
}

export interface TeamGrid {
  team_id: string
  from: string
  to: string
  today: string
  can_edit: boolean
  members: GridMember[]
}

export interface TeamSummary {
  id: string
  name: string
  city: string | null
  role: TeamRole
  can_edit: boolean
  member_count: number
  pending_requests: number
}

export interface TeamsResult {
  sees_all: boolean
  teams: TeamSummary[]
}

export interface MoveRequest {
  id: string
  team_id: string
  team_name: string
  person_id: string
  person_name: string
  from_date: string
  to_date: string
  reason: string | null
  status: MoveStatus
  created_at: string
  decided_by_name: string | null
  decline_reason: string | null
}

export interface ShiftKey {
  person_id: string
  person_type: PersonType
  date: string
}

export interface BulkResult {
  created: number
  skipped: number
  skipped_other_team: number
}

export interface SchedulingApi {
  teams(): Promise<TeamsResult>
  grid(teamId: string, from: string, to: string): Promise<TeamGrid>
  createShifts(teamId: string, shifts: ShiftKey[]): Promise<BulkResult>
  deleteShift(shiftId: string): Promise<void>
  setShiftGoals(shiftId: string, goals: { doors: number | null; givers: number | null } | null): Promise<void>
  setNoShow(shiftId: string, noShow: boolean): Promise<void>
  setDefaultGoals(
    teamId: string,
    rows: { person_id: string; person_type: PersonType; doors: number | null; givers: number | null }[],
  ): Promise<void>
  moveRequests(teamId: string, status?: MoveStatus): Promise<MoveRequest[]>
  approveMove(id: string): Promise<void>
  declineMove(id: string, reason: string | null): Promise<void>
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  sales_chief: "Salgssjef",
  leader: "Teamleder",
  co_leader: "Nestleder",
}

// ── Errors ──────────────────────────────────────────────────────────────────

export class SchedulingError extends Error {
  status: number
  code: string | null
  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.name = "SchedulingError"
    this.status = status
    this.code = code
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: "Ugyldig forespørsel.",
  403: "Du har ikke tilgang til å endre dette teamet.",
  404: "Fant ikke vakten. Den kan være slettet.",
  409: "Dagen er allerede tatt, eller forespørselen er behandlet.",
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithAuth(`/api/scheduling/${path}`, init)
  if (!res.ok) {
    let body: { detail?: string; error?: string; code?: string } = {}
    try {
      body = await res.json()
    } catch {
      /* non-JSON error page */
    }
    const msg =
      body.detail ||
      body.error ||
      FALLBACK_MESSAGES[res.status] ||
      (res.status >= 500 ? "Serverfeil. Prøv igjen om litt." : `Noe gikk galt (${res.status}).`)
    throw new SchedulingError(res.status, msg, body.code ?? null)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

// ── Wire format (maps-service /api/scheduling/, contract «API CONTRACT E1») ──

interface WireDay {
  date: string
  state: DayState
  shift: { id: string; team_id: string; team_name: string; no_show: boolean; can_edit: boolean } | null
  goals: { doors: number | null; givers: number | null; source: "override" | "default" } | null
  actual: Actual | null
  move_request: { id: string; status: MoveStatus; from_date: string; to_date: string } | null
}

interface WireMember {
  person_type: PersonType
  person_id: string
  name: string
  role?: string | null
  default_goals: { doors: number | null; givers: number | null } | null
  days: WireDay[]
}

interface WireTeam {
  team_id: string
  name: string
  city: string | null
  role: TeamRole
  can_edit: boolean
  member_count: number
  pending_move_requests: number
}

interface WireRequest {
  id: string
  status: MoveStatus
  person: { person_type: PersonType; person_id: string; name: string }
  team_id: string
  team_name: string
  from_date: string
  to_date: string
  reason: string | null
  decline_reason: string | null
  requested_at: string
  decided_by_name: string | null
}

function mapDay(d: WireDay): DayCell {
  return {
    date: d.date,
    state: d.state,
    shift_id: d.shift?.id ?? null,
    shift_editable: d.shift ? d.shift.can_edit : true,
    shift_team_name: d.shift?.team_name ?? null,
    goals: d.goals ? { doors: d.goals.doors, givers: d.goals.givers, source: d.goals.source } : null,
    actual: d.actual,
    move_request: d.move_request
      ? {
          id: d.move_request.id,
          status: d.move_request.status,
          from_date: d.move_request.from_date,
          to_date: d.move_request.to_date,
        }
      : null,
  }
}

const MEMBER_ROLE: Record<string, string> = { leader: "Teamleder", co_leader: "Nestleder", sales_chief: "Salgssjef" }

// ── Live adapter ────────────────────────────────────────────────────────────

const liveApi: SchedulingApi = {
  teams: async () => {
    const rows = await call<WireTeam[]>("teams/")
    return {
      sees_all: rows.some((t) => t.role === "admin"),
      teams: rows.map((t) => ({
        id: t.team_id,
        name: t.name,
        city: t.city,
        role: t.role,
        can_edit: t.can_edit,
        member_count: t.member_count,
        pending_requests: t.pending_move_requests ?? 0,
      })),
    }
  },

  grid: async (teamId, from, to) => {
    const g = await call<{
      team: { team_id: string; can_edit: boolean }
      today: string
      from: string
      to: string
      members: WireMember[]
    }>(`teams/${encodeURIComponent(teamId)}/grid/?from=${from}&to=${to}`)
    return {
      team_id: g.team.team_id,
      from: g.from,
      to: g.to,
      today: g.today,
      can_edit: g.team.can_edit,
      members: g.members.map((m) => ({
        person_id: m.person_id,
        person_kind: m.person_type,
        name: m.name,
        role_label: (m.role && MEMBER_ROLE[m.role]) || null,
        default_goals: m.default_goals,
        days: m.days.map(mapDay),
      })),
    }
  },

  createShifts: async (teamId, shifts) => {
    // Body A of POST teams/<id>/shifts/ creates persons × dates. Group the
    // requested cells by date set so each call is an exact cross product.
    const byPerson = new Map<string, { person_type: PersonType; person_id: string; dates: string[] }>()
    for (const k of shifts) {
      const key = `${k.person_type}:${k.person_id}`
      if (!byPerson.has(key)) byPerson.set(key, { person_type: k.person_type, person_id: k.person_id, dates: [] })
      byPerson.get(key)!.dates.push(k.date)
    }
    const groups = new Map<string, { persons: { person_type: PersonType; person_id: string }[]; dates: string[] }>()
    for (const p of byPerson.values()) {
      const dates = [...p.dates].sort()
      const key = dates.join(",")
      if (!groups.has(key)) groups.set(key, { persons: [], dates })
      groups.get(key)!.persons.push({ person_type: p.person_type, person_id: p.person_id })
    }
    const out: BulkResult = { created: 0, skipped: 0, skipped_other_team: 0 }
    for (const g of groups.values()) {
      // Backend caps one call at 400 person-days (too_many): chunk the dates.
      const per = Math.max(1, Math.floor(400 / g.persons.length))
      for (let i = 0; i < g.dates.length; i += per) {
        const r = await call<{ created: unknown[]; skipped: { reason: string }[] }>(
          `teams/${encodeURIComponent(teamId)}/shifts/`,
          json("POST", { persons: g.persons, dates: g.dates.slice(i, i + per) }),
        )
        out.created += r.created.length
        for (const sk of r.skipped) {
          if (sk.reason === "other_team") out.skipped_other_team++
          else out.skipped++
        }
      }
    }
    return out
  },

  deleteShift: (id) => call<void>(`shifts/${encodeURIComponent(id)}/`, { method: "DELETE" }),

  setShiftGoals: (id, goals) =>
    call<void>(
      `shifts/${encodeURIComponent(id)}/`,
      json("PATCH", { goal_doors: goals?.doors ?? null, goal_givers: goals?.givers ?? null }),
    ),

  setNoShow: (id, noShow) => call<void>(`shifts/${encodeURIComponent(id)}/`, json("PATCH", { no_show: noShow })),

  setDefaultGoals: (teamId, rows) =>
    call<void>(
      `teams/${encodeURIComponent(teamId)}/goal-defaults/`,
      json("PUT", {
        items: rows.map((r) => ({
          person_type: r.person_type,
          person_id: r.person_id,
          goal_doors: r.doors,
          goal_givers: r.givers,
        })),
      }),
    ),

  moveRequests: async (teamId, status) => {
    const q = new URLSearchParams({ team: teamId })
    if (status) q.set("status", status)
    const rows = await call<WireRequest[]>(`move-requests/?${q}`)
    return rows.map((r) => ({
      id: r.id,
      team_id: r.team_id,
      team_name: r.team_name,
      person_id: r.person.person_id,
      person_name: r.person.name,
      from_date: r.from_date,
      to_date: r.to_date,
      reason: r.reason || null,
      status: r.status,
      created_at: r.requested_at,
      decided_by_name: r.decided_by_name,
      decline_reason: r.decline_reason || null,
    }))
  },

  approveMove: (id) => call<void>(`move-requests/${encodeURIComponent(id)}/approve/`, { method: "POST" }),

  declineMove: (id, reason) =>
    call<void>(`move-requests/${encodeURIComponent(id)}/decline/`, json("POST", { decline_reason: reason ?? "" })),
}

let mockPromise: Promise<SchedulingApi> | null = null

function resolveApi(): Promise<SchedulingApi> {
  // NODE_ENV is a compile-time constant, so in `next build` webpack drops this
  // branch (and the mock chunk) entirely; the mock only exists in `next dev`.
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_KALENDER_MOCK === "1") {
    mockPromise ??= import("./scheduling.mock").then((m) => m.mockApi)
    return mockPromise
  }
  return Promise.resolve(liveApi)
}

/** Lazily-resolved API; every method returns a promise either way. */
export const schedulingApi: SchedulingApi = new Proxy({} as SchedulingApi, {
  get(_t, prop: keyof SchedulingApi) {
    return (...args: unknown[]) =>
      resolveApi().then((api) => (api[prop] as (...a: unknown[]) => Promise<unknown>)(...args))
  },
})
