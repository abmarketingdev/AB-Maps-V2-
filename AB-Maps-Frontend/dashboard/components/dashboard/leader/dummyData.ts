// Single source of truth for every placeholder value in the two new
// role-branched dashboards (Salgsleder + Promotør).
//
// The `teams` array MIRRORS THE REAL HR TEAM MODEL:
//   Salgsleder oversees N teams via Team.sales_chief_id.
//   Each Team has a leader (Manager) via Team.leader_id.
//   Each Team has TeamMembers pointing to promoters (employee_id).
//   chief_rate  = Salgsleder Lederprovisjon rate per team's performance.
//   leader_rate = Team-manager Lederprovisjon rate.
//   own_rate    = Promoter's own commission rate per sale.
//
// When backend ships:
//   - Replace `teams` with GET /api/hr/teams?sales_chief=<me> + rollups
//   - Replace top-level goal + lonn objects with computed totals from that
//   - Remove this file entirely and wire the tree to real state.
//
// Every value from here passes through <Placeholder> which tags the DOM with
// data-placeholder="true" — `grep -rn 'data-placeholder' components/dashboard/leader/`
// enumerates every unresolved backend gap.

// ────────────────────────────────────────────────────────────────────
// Team hierarchy — the primary source. Every LØNN/TEAM value below is
// derived from this so numbers stay internally consistent.
// ────────────────────────────────────────────────────────────────────

export type PromoterInTeam = {
  id: string
  name: string
  doors: number             // current dører banket (period)
  doorsGoal: number
  recruited: number         // current givere recruited (period)
  recruitedGoal: number
  activePercent: number     // % of their recruited givere still active
  sumVervinger: number      // kr — their own_rate × sales so far
}

export type TeamNode = {
  id: string
  name: string              // "Oslo Nord"
  city: string              // "Oslo"
  color: string             // hex — for the team badge
  managerName: string       // the team leader
  chiefContribution: number // kr the salgsleder earns from this team (chief_rate × team perf)
  leaderContribution: number // kr the team manager earns (leader_rate × team perf)
  promoters: PromoterInTeam[]
  // Phase D (2026-08-05) — per-team, per-month goal. 0 = unset (TeamPanel
  // hides the "/N" fraction on team-total chips + progress bar denominator).
  teamDoorsGoal?: number
  teamRecruitedGoal?: number
  // Frontend hint from backend team_goals.can_edit — shows pencil icon when true.
  canEditGoals?: boolean
}

export const teams: TeamNode[] = [
  {
    id: "oslo-nord",
    name: "Oslo Nord",
    city: "Oslo",
    color: "#3461FF",
    managerName: "Kari Nordmann",
    chiefContribution: 5100,
    leaderContribution: 3800,
    promoters: [
      { id: "p1", name: "Ida Solberg",   doors: 380, doorsGoal: 500, recruited: 22, recruitedGoal: 25, activePercent: 91, sumVervinger: 12800 },
      { id: "p2", name: "Erik Hauge",    doors: 290, doorsGoal: 500, recruited: 18, recruitedGoal: 25, activePercent: 84, sumVervinger: 10400 },
      { id: "p3", name: "Nora Berg",     doors: 200, doorsGoal: 500, recruited: 15, recruitedGoal: 25, activePercent: 78, sumVervinger: 8600  },
    ],
  },
  {
    id: "oslo-sør",
    name: "Oslo Sør",
    city: "Oslo",
    color: "#0E9384",
    managerName: "Ola Fjeld",
    chiefContribution: 3800,
    leaderContribution: 2900,
    promoters: [
      { id: "p4", name: "Sara Vik",      doors: 240, doorsGoal: 500, recruited: 16, recruitedGoal: 25, activePercent: 82, sumVervinger: 9200 },
      { id: "p5", name: "Jonas Ås",      doors: 145, doorsGoal: 500, recruited: 8,  recruitedGoal: 25, activePercent: 62, sumVervinger: 4600 },
    ],
  },
  {
    id: "oslo-vest",
    name: "Oslo Vest",
    city: "Oslo",
    color: "#F59E0B",
    managerName: "Mette Lund",
    chiefContribution: 3100,
    leaderContribution: 2400,
    promoters: [
      { id: "p6", name: "Aksel Storm",   doors: 210, doorsGoal: 500, recruited: 14, recruitedGoal: 25, activePercent: 76, sumVervinger: 7800 },
      { id: "p7", name: "Live Krogh",    doors: 175, doorsGoal: 500, recruited: 11, recruitedGoal: 25, activePercent: 69, sumVervinger: 6200 },
    ],
  },
]

// Flat list of all promoters across all teams — used for TOPPLISTER + AKTIVITETSTID.
export const allPromoters = teams.flatMap(t => t.promoters.map(p => ({ ...p, teamName: t.name, teamColor: t.color, managerName: t.managerName })))

// ────────────────────────────────────────────────────────────────────
// LØNN totals — derived from the team tree above so everything stays
// consistent when you change the tree.
// ────────────────────────────────────────────────────────────────────

const totalChiefProv    = teams.reduce((s, t) => s + t.chiefContribution, 0)   // salgsleder lederprovisjon (sum across teams)
const totalSumVervinger = allPromoters.reduce((s, p) => s + p.sumVervinger, 0) // salgsleder view: sum across all promoters
const totalActive       = allPromoters.reduce((s, p) => s + Math.round(p.recruited * p.activePercent / 100), 0)
const totalActiveGoal   = allPromoters.reduce((s, p) => s + p.recruitedGoal, 0)

export const lonn = {
  aktiveGivere: { current: totalActive, goal: totalActiveGoal },
  sumVervinger: totalSumVervinger,
  lederProvisjon: totalChiefProv,
  estimertLonn: totalChiefProv + Math.round(totalSumVervinger * 0.08), // rough own-cut + lederprov
  estimertLonnVedMal: 48000, // aspirational target if all promoters hit goal
}

// ────────────────────────────────────────────────────────────────────
// MÅL — team-scoped for salgsleder, personal for promotør. Both use the
// same tile shape; goals are the ONLY hardcoded piece (no goals model in
// backend yet — first thing to build server-side per the plan).
// ────────────────────────────────────────────────────────────────────

export const teamGoalsMonthly = {
  dorerBanket:          { current: teams.reduce((s,t) => s + t.promoters.reduce((ss,p) => ss + p.doors, 0), 0), goal: 2000 },
  antallGivere:         { current: 60,   goal: 100 },
  antallGivereTeam:     { current: allPromoters.reduce((s,p) => s + p.recruited, 0), goal: 700 },
  antallGivereProsjekt: { current: 1400, goal: 2000 },
}

export const teamGoalsWeekly = {
  dorerBanket:          { current: 200,  goal: 500 },
  antallGivere:         { current: 15,   goal: 25  },
  antallGivereTeam:     { current: 100,  goal: 250 },
  antallGivereProsjekt: { current: 200,  goal: 500 },
}

// Promotør view goals — personal (matches promoter #1 for demo consistency)
export const personalGoalsMonthly = {
  dorerBanket:          { current: 380, goal: 500 },
  antallGivere:         { current: 22,  goal: 25  },
  antallGivereTeam:     { current: teams[0].promoters.reduce((s,p) => s + p.recruited, 0), goal: 60 },
  antallGivereProsjekt: { current: 380, goal: 500 },
}
export const personalGoalsWeekly = {
  dorerBanket:          { current: 95,  goal: 125 },
  antallGivere:         { current: 6,   goal: 8   },
  antallGivereTeam:     { current: 15,  goal: 20  },
  antallGivereProsjekt: { current: 95,  goal: 125 },
}

// ────────────────────────────────────────────────────────────────────
// AKTIVITETSTID — hourly rollup 16:00 → 21:00, one line per team.
// (Backend serves team-aggregate hourly; per-promoter grouping is
//  future work. Here we roll a per-team line by fake-summing promoters.)
// ────────────────────────────────────────────────────────────────────

const hourShape = [0.12, 0.34, 0.58, 0.71, 0.42, 0.18] // ratio at 16-21
export const activityByHour = ["16:00","17:00","18:00","19:00","20:00","21:00"].map((h, i) => {
  const row: Record<string, string | number> = { hour: h }
  for (const t of teams) {
    const teamDoors = t.promoters.reduce((s, p) => s + p.doors, 0)
    row[t.name] = Math.round(teamDoors * hourShape[i] / hourShape.reduce((a,b) => a+b, 0))
  }
  return row
})

export const activityTeams = teams.map(t => ({ name: t.name, color: t.color }))

// ────────────────────────────────────────────────────────────────────
// TOPPLISTER — 3 leaderboards. Shape MATCHES the real LeaderItem type
// (lib/api/dashboardOverview.ts) so LeaderboardPanel can render them
// identically to the admin view — same RoyMascot, same mood badge,
// same score line, same online dot. Only difference vs the real API:
// column 1 (doors) is fed by the real /api/dashboard/v2/leaderboard?metric=doors
// endpoint at runtime; columns 2 & 3 use these placeholder rows because
// backend has no "recruited" or "active-%" metric yet.
// ────────────────────────────────────────────────────────────────────

import type { LeaderItem } from "@/lib/api/dashboardOverview"

// Turn a promoter into a LeaderItem-shaped row. Uses real doors/recruited/active
// to keep the numbers internally consistent with the team panel.
function toLeaderItem(p: typeof allPromoters[number], rank: number, scoreField: "doors" | "recruited" | "active"): LeaderItem {
  const score = scoreField === "doors" ? p.doors : scoreField === "recruited" ? p.recruited : p.activePercent
  const jaProsent = Math.round(p.activePercent * 0.7 * 10) / 10   // reasonable synthetic ja-rate
  const dorerPerDag = Math.round((p.doors / 22) * 10) / 10        // period doors / ~22 workdays
  return {
    rank,
    name: p.name,
    region: p.teamName,
    dorerPerDag,
    jaProsent,
    minJaProsent: 3.0,     // team floor — used by computeMood
    minDorerPerDag: 40,    // team floor — used by computeMood
    rankPercentile: Math.max(0, 100 - rank * 15),
    daysOnPlatform: 120,   // "veteran" so mood band doesn't get "Ny på laget" for everyone
    score,
    online: rank <= 2,
  }
}

// Sorted + rank-numbered — matches how the real API returns leaderboard rows.
export const topplisterRecruited: LeaderItem[] = [...allPromoters]
  .sort((a, b) => b.recruited - a.recruited)
  .map((p, i) => toLeaderItem(p, i + 1, "recruited"))

export const topplisterActive: LeaderItem[] = [...allPromoters]
  .sort((a, b) => b.activePercent - a.activePercent)
  .map((p, i) => toLeaderItem(p, i + 1, "active"))

// Fallback doors leaderboard — used ONLY if the real API call fails on mount.
// Component tries real API first; falls back to this if the fetch rejects.
export const topplisterDoorsFallback: LeaderItem[] = [...allPromoters]
  .sort((a, b) => b.doors - a.doors)
  .map((p, i) => toLeaderItem(p, i + 1, "doors"))
