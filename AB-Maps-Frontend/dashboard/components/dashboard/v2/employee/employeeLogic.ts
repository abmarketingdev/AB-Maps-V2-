/**
 * Employee day logic — pure, reusable, no React. Types + mascot/milestone
 * selectors + threshold helpers. Data comes live from the employee API; the
 * empty* factories provide zeroed placeholders while it loads.
 */

import type { RoyState } from "@/components/gamification/RoyMascot"

// ─── Types ──────────────────────────────────────────────────────────────────

export type Outcome = "ja" | "nei" | "ikke-hjemme" | "folg-opp"

export interface JourneyEvent { time: string; outcome: Outcome }
export interface FollowUp { name: string; address: string; note: string; time: string }

export interface EmployeeDayData {
  firstName: string
  weekday: string
  dateStr: string
  timeOfDay: "morgen" | "dag" | "kveld"
  withinShift: boolean
  // today's core numbers
  doorsToday: number
  doorGoal: number
  jaToday: number
  neiToday: number
  ikkeHjemmeToday: number
  folgOppToday: number
  salesToday: number
  jaProsent: number
  jaProsentDelta: number        // pp vs own 7-day avg
  // streak + records
  streakDays: number
  streakAtRisk: boolean         // shift active but today's minimum not yet met
  streakMinDoors: number        // doors needed today to keep the streak
  personalBestDoors: number
  isNewBest: boolean            // doorsToday > personalBestDoors
  // pace vs self
  avgDoors7: number             // own recent daily average
  weekActivity: number[]        // 7 points (doors per day, last 7 days incl today)
  weekLabels: string[]
  // goal vs admin-set threshold (replicated from admin's daily-door threshold)
  todayGoal: number | null      // today's door goal; null = none set → fall back to global
  yesterdayDoors: number        // doors knocked yesterday
  yesterdayGoal: number         // yesterday's door goal (admin threshold)
  yesterdayAchieved: boolean    // yesterdayDoors >= yesterdayGoal
  // journey + follow-ups
  journey: JourneyEvent[]
  followUps: FollowUp[]
}

export const OUTCOME_META: Record<Outcome, { label: string; color: string }> = {
  ja:            { label: "Ja",          color: "#10b981" },
  nei:           { label: "Nei",         color: "#f43f5e" },
  "ikke-hjemme": { label: "Ikke hjemme", color: "#64748b" },
  "folg-opp":    { label: "Følg opp",    color: "#f59e0b" },
}

// ─── Admin-set thresholds (mirrors AnalyticsView "Terskler") ────────────────────
// These are configured by the admin. The employee views replicate them so the
// rep is measured against the exact same targets. Per-campaign overrides win
// over the global default.

export interface PerfThreshold {
  doorsDay: number
  doorsWeek: number
  minJa: number          // %
  maxNei: number         // %
  minContact: number     // %
  consecutiveDays: number
  dropAlert: number      // %
  maxInactiveHours: number
}

export const GLOBAL_THRESHOLD: PerfThreshold = {
  doorsDay: 70, doorsWeek: 350, minJa: 3, maxNei: 100,
  minContact: 0, consecutiveDays: 3, dropAlert: 20, maxInactiveHours: 4,
}

export const THRESHOLD_FIELDS: { key: keyof PerfThreshold; label: string; suffix?: string; higherIsBetter: boolean }[] = [
  { key: "doorsDay", label: "Min dører / dag", higherIsBetter: true },
  { key: "doorsWeek", label: "Min dører / uke", higherIsBetter: true },
  { key: "minJa", label: "Min ja-prosent", suffix: "%", higherIsBetter: true },
  { key: "minContact", label: "Min kontaktprosent", suffix: "%", higherIsBetter: true },
]

export const DOOR_GOAL = GLOBAL_THRESHOLD.doorsDay

// ─── Mock generator ───────────────────────────────────────────────────────────

// Zeroed placeholder used while the live /me/today/ data loads (no mock numbers).
export function emptyEmployeeDay(firstName = ""): EmployeeDayData {
  const now = new Date()
  const hour = now.getHours()
  const timeOfDay = hour < 11 ? "morgen" : hour < 17 ? "dag" : "kveld"
  return {
    firstName,
    weekday: now.toLocaleDateString("nb-NO", { weekday: "long" }),
    dateStr: now.toLocaleDateString("nb-NO", { day: "numeric", month: "long" }),
    timeOfDay,
    withinShift: false,
    doorsToday: 0, doorGoal: DOOR_GOAL,
    jaToday: 0, neiToday: 0, ikkeHjemmeToday: 0, folgOppToday: 0,
    salesToday: 0,
    jaProsent: 0, jaProsentDelta: 0,
    streakDays: 0, streakAtRisk: false, streakMinDoors: 0,
    personalBestDoors: 0, isNewBest: false,
    avgDoors7: 0,
    weekActivity: [0, 0, 0, 0, 0, 0, 0],
    weekLabels: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "I dag"],
    todayGoal: DOOR_GOAL,
    yesterdayDoors: 0, yesterdayGoal: DOOR_GOAL, yesterdayAchieved: false,
    journey: [],
    followUps: [],
  }
}

// ─── Mascot mood from the day ──────────────────────────────────────────────────

export function selectEmployeeMood(d: EmployeeDayData): RoyState {
  if (!d.withinShift) return "sleeping"
  if (d.isNewBest || d.doorsToday >= d.doorGoal) return "win-big"     // goal hit / record
  if (d.streakAtRisk) return "concerned"                              // about to lose streak
  const pct = d.doorsToday / d.doorGoal
  if (pct >= 0.7 || d.jaProsentDelta > 0) return "win-small"          // ahead / climbing
  if (pct >= 0.4) return "ready"                                      // steady, working
  return "greeting"                                                   // early in the day
}

// ─── Milestone celebration trigger ──────────────────────────────────────────────

export type Milestone =
  | { kind: "goal"; title: string; sub: string }
  | { kind: "best"; title: string; sub: string }
  | { kind: "streak"; title: string; sub: string }
  | null

export function getMilestone(d: EmployeeDayData): Milestone {
  if (d.isNewBest) return { kind: "best", title: "Ny personlig rekord! 🎉", sub: `${d.doorsToday} dører — best noensinne` }
  if (d.doorsToday >= d.doorGoal) return { kind: "goal", title: "Dagens mål nådd! 🎯", sub: `${d.doorsToday} av ${d.doorGoal} dører` }
  if ([7, 30, 100].includes(d.streakDays)) return { kind: "streak", title: `${d.streakDays} dager på rad! 🔥`, sub: "Streaken lever videre" }
  return null
}

// ─── Briefing mission line ──────────────────────────────────────────────────────

export function getTodaysMission(d: EmployeeDayData): { headline: string; supporting: string } {
  const remaining = Math.max(0, d.doorGoal - d.doorsToday)
  if (d.timeOfDay === "morgen") {
    return {
      headline: `God morgen, ${d.firstName}. Klar for ${d.doorGoal} dører i dag?`,
      supporting: `Du er inne i en streak på ${d.streakDays} dager. Hold den i live — bank minst ${d.streakMinDoors} dører.`,
    }
  }
  if (remaining > 0) {
    return {
      headline: `${remaining} dører igjen til dagens mål.`,
      supporting: `Du ligger ${d.jaProsentDelta >= 0 ? "foran" : "bak"} ditt eget snitt. Streak: ${d.streakDays} dager.`,
    }
  }
  return {
    headline: `Målet er nådd, ${d.firstName}. Sterk dag!`,
    supporting: `${d.doorsToday} dører og ${d.salesToday} salg. Streaken din er nå ${d.streakDays} dager.`,
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Briefing: yesterday recap + today's goal (vs the admin daily-door threshold)
// ════════════════════════════════════════════════════════════════════════════

export interface GoalStatus {
  yesterdayDoors: number
  yesterdayGoal: number
  yesterdayAchieved: boolean
  yesterdayPct: number          // 0..1+ (doors / goal)
  todayGoal: number             // resolved goal (falls back to global if none set)
  hasTodayGoal: boolean         // false → using the global fallback
  globalDefault: number
}

export function getGoalStatus(d: EmployeeDayData): GoalStatus {
  const resolvedToday = d.todayGoal ?? GLOBAL_THRESHOLD.doorsDay
  return {
    yesterdayDoors: d.yesterdayDoors,
    yesterdayGoal: d.yesterdayGoal,
    yesterdayAchieved: d.yesterdayAchieved,
    yesterdayPct: d.yesterdayGoal > 0 ? d.yesterdayDoors / d.yesterdayGoal : 0,
    todayGoal: resolvedToday,
    hasTodayGoal: d.todayGoal != null,
    globalDefault: GLOBAL_THRESHOLD.doorsDay,
  }
}

/** Briefing mascot is driven by YESTERDAY's achievement: happy if the admin
 *  threshold was reached, sad if not. */
export function selectBriefingMascot(g: GoalStatus): RoyState {
  if (g.yesterdayPct >= 1.2) return "win-big"      // smashed it
  if (g.yesterdayAchieved) return "win-small"      // reached the goal
  if (g.yesterdayPct >= 0.75) return "ready"       // just short — encouraging
  return "concerned"                               // missed by a lot
}

export function getYesterdayHeadline(g: GoalStatus, firstName: string): { headline: string; supporting: string } {
  if (g.yesterdayAchieved) {
    return {
      headline: `Bra jobba i går, ${firstName}! Du nådde målet 🎯`,
      supporting: `${g.yesterdayDoors} dører mot et mål på ${g.yesterdayGoal}. I dag er målet ${g.todayGoal} dører.`,
    }
  }
  return {
    headline: `I går nådde du ikke helt målet, ${firstName}.`,
    supporting: `${g.yesterdayDoors} av ${g.yesterdayGoal} dører. I dag er en ny sjanse — målet er ${g.todayGoal} dører.`,
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Statistikk: per-campaign performance for ONE employee (mirrors admin metrics)
// ════════════════════════════════════════════════════════════════════════════

export interface CampaignPerf {
  id: string
  name: string
  color: string
  threshold: PerfThreshold      // applicable threshold (campaign override or global)
  thresholdScope: "global" | "kampanje"
  // volume
  doors: number
  daysWorked: number
  dorerPerDag: number
  weekDoors: number
  // statuses
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number
  jaProsent: number; neiProsent: number; contactPct: number
  // quality / timing
  consistency: number           // %
  totalMin: number              // total work minutes on this campaign
  avgDailyMin: number
  // 14-day door history for charts
  daily: { date: string; doors: number; ja: number }[]
}

export interface EmployeeStats {
  firstName: string
  periodLabel: string
  // aggregate (all campaigns)
  totalDoors: number
  dorerPerDag: number
  jaProsent: number
  contactPct: number
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number
  consistency: number
  totalMin: number
  avgDailyMin: number
  activeDays: number
  appliedThreshold: PerfThreshold   // the global threshold for the aggregate
  campaigns: CampaignPerf[]
  weekActivity: { label: string; doors: number; ja: number }[]
}

// Zeroed placeholder used while live /me/stats/ loads (no mock numbers).
export function emptyEmployeeStats(firstName = ""): EmployeeStats {
  return {
    firstName,
    periodLabel: "Siste 30 dager",
    totalDoors: 0, dorerPerDag: 0, jaProsent: 0, contactPct: 0,
    ja: 0, nei: 0, ikkeHjemme: 0, folgOpp: 0,
    consistency: 0, totalMin: 0, avgDailyMin: 0, activeDays: 0,
    appliedThreshold: GLOBAL_THRESHOLD,
    campaigns: [],
    weekActivity: [],
  }
}

/** Evaluate a measured value against a threshold field; returns pass + how far. */
export function evalThreshold(value: number, target: number, higherIsBetter: boolean): { ok: boolean; pct: number } {
  const ok = higherIsBetter ? value >= target : value <= target
  const pct = target > 0 ? Math.round((value / target) * 100) : 100
  return { ok, pct }
}

export function fmtMins(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}t ${m}m` : `${m}m`
}
