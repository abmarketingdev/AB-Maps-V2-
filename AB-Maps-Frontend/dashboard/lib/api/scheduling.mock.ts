// LOCAL MOCK for the Kalender — loaded only when NEXT_PUBLIC_KALENDER_MOCK=1
// (see scheduling.ts). Never part of a prod build. In-memory, deterministic,
// fictional people. Role follows the /demo login (localStorage "ab_demo_as"):
//   admin → all teams (editable), chief → own 2 teams (editable),
//   manager → 1 team read-only. localStorage "kalender_mock" = "empty" | "error"
//   forces the empty / error states.

import type {
  Actual,
  DayCell,
  GridMember,
  MoveRequest,
  SchedulingApi,
  TeamGrid,
  TeamsResult,
} from "./scheduling"
import { SchedulingError } from "./scheduling"
import { addDays, daysBetween, mondayOf, osloToday, weekdayIndex } from "@/components/dashboard/kalender/dates"

export const MOCK_MARKER = "kalender-mock-data"

interface MockPerson {
  id: string
  name: string
  kind: "employee" | "manager"
  role?: string
  defDoors: number | null
  defGivers: number | null
}

interface MockShift {
  id: string
  team: string
  person: string
  date: string
  goalDoors: number | null
  goalGivers: number | null
  noShow: boolean
}

const TEAMS: {
  id: string
  name: string
  city: string | null
  campaign_name: string | null
  sales_chief_name: string | null
  members: MockPerson[]
  chief: string
}[] = [
  {
    id: "t-oslo-1", name: "Oslo Øst – Team Fjord", city: "Oslo", campaign_name: "Leger Uten Grenser",
    sales_chief_name: "Andreas Rikstad", chief: "chief",
    members: [
      { id: "m-1", name: "Mathilde Berg", kind: "manager", role: "Teamleder", defDoors: 60, defGivers: 4 },
      { id: "e-1", name: "Jonas Halvorsen", kind: "employee", defDoors: 50, defGivers: 3 },
      { id: "e-2", name: "Sara Lindqvist", kind: "employee", defDoors: 50, defGivers: 3 },
      { id: "e-3", name: "Emil Nakstad", kind: "employee", defDoors: 45, defGivers: 2 },
      { id: "e-4", name: "Nora Aamodt-Strømsheim", kind: "employee", defDoors: 50, defGivers: 3 },
      { id: "e-5", name: "Ali Rahimi", kind: "employee", defDoors: null, defGivers: null },
      { id: "e-6", name: "Thea Mørk", kind: "employee", defDoors: 40, defGivers: 2 },
    ],
  },
  {
    id: "t-oslo-2", name: "Oslo Vest – Team Nord", city: "Oslo", campaign_name: null,
    sales_chief_name: "Andreas Rikstad", chief: "chief",
    members: [
      { id: "m-2", name: "Henrik Dahl", kind: "manager", role: "Teamleder", defDoors: 55, defGivers: 3 },
      { id: "e-7", name: "Ingrid Sæther", kind: "employee", defDoors: 50, defGivers: 3 },
      { id: "e-8", name: "Oskar Bjerke", kind: "employee", defDoors: 50, defGivers: 3 },
    ],
  },
  {
    id: "t-bergen-1", name: "Bergen Sentrum", city: "Bergen", campaign_name: "Kirkens Bymisjon",
    sales_chief_name: "Kristin Vik", chief: "other",
    members: [
      { id: "m-3", name: "Lars Eide", kind: "manager", role: "Teamleder", defDoors: 50, defGivers: 3 },
      { id: "e-9", name: "Maja Fosse", kind: "employee", defDoors: 45, defGivers: 3 },
      { id: "e-10", name: "Sander Hope", kind: "employee", defDoors: 45, defGivers: 3 },
      { id: "e-11", name: "Vilde Rong", kind: "employee", defDoors: 45, defGivers: 3 },
    ],
  },
  {
    id: "t-trd-1", name: "DANA TEST", city: null, campaign_name: null, sales_chief_name: null, chief: "other",
    members: [],
  },
]

// Deterministic pseudo-random from a string.
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  // murmur3 finaliser so similar strings spread out
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

let nextId = 1
const shifts: MockShift[] = []
const requests: MoveRequest[] = []
let seeded = false

function seed() {
  if (seeded) return
  seeded = true
  const today = osloToday()
  const start = addDays(mondayOf(today), -14)
  for (const t of TEAMS) {
    for (const p of t.members) {
      for (let i = 0; i < 42; i++) {
        const date = addDays(start, i)
        const wd = weekdayIndex(date)
        if (wd >= 5) continue // weekend off
        if (hash(p.id + date) < 0.22) continue // some days off
        const override = hash(date + p.id + "o") < 0.08
        shifts.push({
          id: String(nextId++), team: t.id, person: p.id, date,
          goalDoors: override ? 70 : null, goalGivers: override ? 5 : null,
          noShow: date < today && hash(p.id + date + "n") < 0.08,
        })
      }
    }
  }
  const mk = (team: string, person: string, offset: number, toOffset: number, reason: string | null, status: MoveRequest["status"] = "venter"): void => {
    const t = TEAMS.find((x) => x.id === team)!
    const p = t.members.find((m) => m.id === person)!
    const from = addDays(today, offset)
    const to = addDays(today, toOffset)
    // make sure there is a shift on from, none on to
    const s = shifts.find((x) => x.person === person && x.date === to)
    if (s) shifts.splice(shifts.indexOf(s), 1)
    if (!shifts.find((x) => x.person === person && x.date === from)) {
      shifts.push({ id: String(nextId++), team, person, date: from, goalDoors: null, goalGivers: null, noShow: false })
    }
    requests.push({
      id: String(nextId++), team_id: team, team_name: t.name, person_id: person, person_name: p.name,
      from_date: from, to_date: to, reason, status, created_at: new Date().toISOString(),
      decided_by_name: null, decline_reason: null,
    })
  }
  mk("t-oslo-1", "e-2", 2, 8, "Legetime torsdag, kan jobbe onsdag neste uke i stedet.")
  mk("t-oslo-1", "e-5", 4, 9, null)
  mk("t-oslo-2", "e-8", 3, 5, "Eksamen")
  mk("t-bergen-1", "e-10", 1, 6, "Bryllup i familien")
}

function role(): "admin" | "chief" | "manager" {
  if (typeof window === "undefined") return "admin"
  const r = localStorage.getItem("ab_demo_as")
  return r === "chief" || r === "manager" ? r : "admin"
}

function flag(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("kalender_mock")
}

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms))

function visibleTeams() {
  const r = role()
  if (flag() === "empty") return []
  if (r === "admin") return TEAMS
  if (r === "chief") return TEAMS.filter((t) => t.chief === "chief")
  return TEAMS.slice(0, 1)
}

function canEdit(): boolean {
  return role() !== "manager"
}

function actualFor(person: string, date: string, goalDoors: number | null): Actual {
  const base = goalDoors ?? 50
  const doors = Math.round(base * (0.55 + hash(person + date + "d") * 0.75))
  const ja = Math.round(doors * (0.03 + hash(person + date + "j") * 0.07))
  return { doors, ja, ja_pct: doors ? Math.round((ja / doors) * 1000) / 10 : null }
}

function cell(t: (typeof TEAMS)[number], p: MockPerson, date: string, today: string): DayCell {
  const s = shifts.find((x) => x.person === p.id && x.date === date && x.team === t.id)
  const req = requests.find((r) => r.person_id === p.id && (r.from_date === date || r.to_date === date) && r.status === "venter")
  if (!s) {
    const actual = date < today ? { doors: 0, ja: 0, ja_pct: null } : null
    return { date, state: date === today ? "today" : "off", shift_id: null, shift_editable: true, shift_team_name: null, goals: null, actual, move_request: null }
  }
  const override = s.goalDoors !== null || s.goalGivers !== null
  const goals = {
    doors: override ? s.goalDoors : p.defDoors,
    givers: override ? s.goalGivers : p.defGivers,
    source: override ? ("override" as const) : p.defDoors === null && p.defGivers === null ? ("none" as const) : ("default" as const),
  }
  const state = s.noShow ? "no_show" : date < today ? "worked" : date === today ? "today" : "planned"
  const actual =
    date < today && !s.noShow ? actualFor(p.id, date, goals.doors)
      : date === today ? { doors: Math.round((goals.doors ?? 50) * 0.4), ja: 1, ja_pct: 4.5 }
      : null
  return {
    date, state, shift_id: s.id, shift_editable: true, shift_team_name: t.name, goals, actual,
    move_request: req ? { id: req.id, status: req.status, from_date: req.from_date, to_date: req.to_date } : null,
  }
}

function findShift(id: string): MockShift {
  const s = shifts.find((x) => x.id === id)
  if (!s) throw new SchedulingError(404, "Fant ikke vakten. Den kan være slettet.")
  return s
}

function guardEdit() {
  if (!canEdit()) throw new SchedulingError(403, "Du har ikke tilgang til å endre dette teamet.")
}

export const mockApi: SchedulingApi = {
  async teams(): Promise<TeamsResult> {
    seed()
    await wait()
    if (flag() === "error") throw new SchedulingError(500, "Serverfeil. Prøv igjen om litt.")
    const r = role()
    return {
      sees_all: r === "admin",
      teams: visibleTeams().map((t) => ({
        id: t.id, name: t.name, city: t.city,
        role: r === "admin" ? "admin" : r === "chief" ? "sales_chief" : "leader",
        can_edit: canEdit(),
        member_count: t.members.length,
        pending_requests: requests.filter((q) => q.team_id === t.id && q.status === "venter").length,
      })),
    }
  },

  async grid(teamId, from, to): Promise<TeamGrid> {
    seed()
    await wait(450)
    const t = TEAMS.find((x) => x.id === teamId)
    if (!t) throw new SchedulingError(404, "Fant ikke teamet.")
    const today = osloToday()
    const n = daysBetween(from, to) + 1
    const members: GridMember[] = t.members.map((p) => ({
      person_id: p.id, person_kind: p.kind, name: p.name, role_label: p.role ?? null,
      default_goals: p.defDoors === null && p.defGivers === null ? null : { doors: p.defDoors, givers: p.defGivers },
      days: Array.from({ length: n }, (_, i) => cell(t, p, addDays(from, i), today)),
    }))
    return { team_id: teamId, from, to, today, can_edit: canEdit(), members }
  },

  async createShifts(teamId, list) {
    guardEdit()
    await wait()
    let created = 0
    let skipped = 0
    for (const k of list) {
      if (shifts.find((x) => x.person === k.person_id && x.date === k.date)) { skipped++; continue }
      shifts.push({ id: String(nextId++), team: teamId, person: k.person_id, date: k.date, goalDoors: null, goalGivers: null, noShow: false })
      created++
    }
    return { created, skipped, skipped_other_team: 0 }
  },

  async deleteShift(id) {
    guardEdit()
    await wait()
    const s = findShift(id)
    shifts.splice(shifts.indexOf(s), 1)
    for (const r of requests) if (r.status === "venter" && r.from_date === s.date && r.person_id === s.person) r.status = "avbrutt"
  },

  async setShiftGoals(id, goals) {
    guardEdit()
    await wait()
    const s = findShift(id)
    s.goalDoors = goals?.doors ?? null
    s.goalGivers = goals?.givers ?? null
  },

  async setNoShow(id, noShow) {
    guardEdit()
    await wait()
    const s = findShift(id)
    if (s.date > osloToday()) throw new SchedulingError(400, "«Ikke møtt» kan bare settes på dager som har vært.")
    s.noShow = noShow
  },

  async setDefaultGoals(teamId, rows) {
    guardEdit()
    await wait()
    const t = TEAMS.find((x) => x.id === teamId)!
    for (const r of rows) {
      const p = t.members.find((m) => m.id === r.person_id)
      if (p) { p.defDoors = r.doors; p.defGivers = r.givers }
    }
  },

  async moveRequests(teamId, status) {
    seed()
    await wait()
    const ids = new Set(visibleTeams().map((t) => t.id))
    return requests
      .filter((r) => ids.has(r.team_id) && r.team_id === teamId && (!status || r.status === status))
      .map((r) => ({ ...r }))
  },

  async approveMove(id) {
    guardEdit()
    await wait()
    const r = requests.find((x) => x.id === id)
    if (!r || r.status !== "venter") throw new SchedulingError(409, "Forespørselen er allerede behandlet.")
    if (shifts.find((x) => x.person === r.person_id && x.date === r.to_date)) {
      throw new SchedulingError(409, "Promotøren har allerede en vakt på den nye datoen.")
    }
    const s = shifts.find((x) => x.person === r.person_id && x.date === r.from_date)
    if (s) s.date = r.to_date
    r.status = "godkjent"
    r.decided_by_name = "Deg"
  },

  async declineMove(id, reason) {
    guardEdit()
    await wait()
    const r = requests.find((x) => x.id === id)
    if (!r || r.status !== "venter") throw new SchedulingError(409, "Forespørselen er allerede behandlet.")
    r.status = "avslatt"
    r.decline_reason = reason
    r.decided_by_name = "Deg"
  },
}
