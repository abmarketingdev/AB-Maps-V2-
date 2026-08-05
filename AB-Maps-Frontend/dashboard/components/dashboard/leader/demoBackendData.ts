/**
 * Demo backend data — used ONLY when NEXT_PUBLIC_DEMO_MODE=true (checked in
 * the Embedded widgets). Simulates what the prod backend returns from
 *   - /api/dashboard/v2/overview  (KPIs + trends + mood + campaigns + activity)
 *   - /api/employee/me/today/     (employee daily snapshot)
 * so the boss can `npm run dev` and see a fully populated dashboard without
 * running the 30-container backend stack locally.
 *
 * In production the env var is unset → these values are never used → prod
 * behaviour is bit-for-bit identical to today.
 */

import type {
  KpiStats, TrendPoint, MoodCount, CampaignHealthItem, ActivityItem,
} from "@/lib/api/dashboardOverview"
import type { EmployeeDayData } from "@/components/dashboard/v2/employee/employeeLogic"

// ─── KPI strip — realistic mid-day snapshot ─────────────────────────────
export const demoKpiStats: KpiStats = {
  online:         { value: 14, total: 54 },
  totalDoors:     { value: 3187, deltaPct: 12.4 },
  yesRate:        { value: 4.2,  deltaPct: 0.3 },
  activeCampaigns:{ value: 8 },
  salesToday:     { value: 118,  deltaPct: 8.7 },
}

// ─── Aktivitetstrend — 7 days ending today (2026-08-02). Realistic curve
// (weekend dip on the last two days, weekday peaks Tue/Wed). ─────────────
export const demoTrend7d: TrendPoint[] = [
  { date: "27.7", doors: 3620, yesRate: 4.1 },
  { date: "28.7", doors: 4180, yesRate: 4.4 },
  { date: "29.7", doors: 4290, yesRate: 4.6 },
  { date: "30.7", doors: 3810, yesRate: 4.3 },
  { date: "31.7", doors: 3960, yesRate: 4.2 },
  { date: "1.8",  doors: 2470, yesRate: 3.8 }, // Sat dip
  { date: "2.8",  doors: 3187, yesRate: 4.2 }, // today (Sun)
]

// 30-day and 90-day: fabricated but plausible shapes
export const demoTrend30d: TrendPoint[] = Array.from({ length: 30 }).map((_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (29 - i))
  const dow = d.getDay()
  const weekend = dow === 0 || dow === 6
  const base = weekend ? 2300 : 3800
  const jitter = Math.sin(i * 0.7) * 350
  return {
    date: `${d.getDate()}.${d.getMonth() + 1}`,
    doors: Math.round(base + jitter + (Math.random() * 400 - 200)),
    yesRate: +(3.9 + Math.cos(i * 0.5) * 0.5 + (Math.random() * 0.4 - 0.2)).toFixed(1),
  }
})

export const demoTrend90d: TrendPoint[] = Array.from({ length: 90 }).map((_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (89 - i))
  const dow = d.getDay()
  const weekend = dow === 0 || dow === 6
  const base = weekend ? 2000 : 3600
  const jitter = Math.sin(i * 0.3) * 450
  return {
    date: `${d.getDate()}.${d.getMonth() + 1}`,
    doors: Math.round(base + jitter + (Math.random() * 500 - 250)),
    yesRate: +(4.0 + Math.cos(i * 0.2) * 0.6 + (Math.random() * 0.4 - 0.2)).toFixed(1),
  }
})

// ─── Stemningsring — mood distribution across 54 ansatte ────────────────
export const demoMood: MoodCount[] = [
  { mood: "flames",    count: 4 },  // I flammer
  { mood: "checked",   count: 43 }, // Sjekk inn
  { mood: "new",       count: 7 },  // Ny på laget
]

// ─── Kampanjestatus — 8 active campaigns (real names from prod screenshot) ─
export const demoCampaigns: CampaignHealthItem[] = [
  { id: "1", name: "Talkmore",                    target: 10000, current: 8707,   employees: 22, color: "#10b981", daysLeft: 12 },
  { id: "2", name: "Strømmestiftelsen",           target: 20000, current: 18848,  employees: 29, color: "#ec4899", daysLeft: 5  },
  { id: "3", name: "Nasjonalforeningen for folkehelsen", target: 70000, current: 62986, employees: 18, color: "#f97316", daysLeft: 22 },
  { id: "4", name: "Norsk Folkehjelp",            target: 250000,current: 228575, employees: 213,color: "#10b981", daysLeft: 40 },
  { id: "5", name: "Blå Kors",                    target: 40000, current: 31954,  employees: 50, color: "#3b82f6", daysLeft: 18 },
  { id: "6", name: "NRC",                         target: 280000,current: 243251, employees: 207,color: "#f97316", daysLeft: 30 },
  { id: "7", name: "CARE",                        target: 30000, current: 24807,  employees: 10, color: "#f59e0b", daysLeft: 9  },
  { id: "8", name: "Homely",                      target: 1500,  current: 898,    employees: 4,  color: "#10b981", daysLeft: 6  },
]

// ─── Live aktivitet — recent knock events, style matches prod ───────────
function tsMinutesAgo(m: number): string {
  const d = new Date(Date.now() - m * 60000)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export const demoActivities: ActivityItem[] = [
  { id: "a1",  time: tsMinutesAgo(2),  agent: "Bjørn Gurvin",   action: "Fikk nei",             location: "Åsveien 37, 9510 Alta",                    campaign: "NRC",     tone: "danger"  },
  { id: "a2",  time: tsMinutesAgo(9),  agent: "Bjørn Gurvin",   action: "Registrerte et salg",  location: "Åsveien 35, 9510 Alta",                    campaign: "NRC",     tone: "success" },
  { id: "a3",  time: tsMinutesAgo(10), agent: "Bjørn Gurvin",   action: "Ingen hjemme",         location: "Åsveien 28, 9510 Alta, leilighet U0101",   campaign: "NRC",     tone: "neutral" },
  { id: "a4",  time: tsMinutesAgo(10), agent: "Bjørn Gurvin",   action: "Fikk nei",             location: "Åsveien 28, 9510 Alta, leilighet H0101",   campaign: "NRC",     tone: "danger"  },
  { id: "a5",  time: tsMinutesAgo(11), agent: "Hanna Hosen",    action: "Ingen hjemme",         location: "Ekornsvingen 23, 9510 Alta",               campaign: "NRC",     tone: "neutral" },
  { id: "a6",  time: tsMinutesAgo(12), agent: "Bjørn Gurvin",   action: "Fikk nei",             location: "Åsveien 31A, 9510 Alta",                   campaign: "NRC",     tone: "danger"  },
  { id: "a7",  time: tsMinutesAgo(12), agent: "Bjørn Gurvin",   action: "Ingen hjemme",         location: "Åsveien 31B, 9510 Alta",                   campaign: "NRC",     tone: "neutral" },
  { id: "a8",  time: tsMinutesAgo(14), agent: "Ida Solberg",    action: "Registrerte et salg",  location: "Kirkeveien 12, 0355 Oslo",                 campaign: "Norsk Folkehjelp", tone: "success" },
  { id: "a9",  time: tsMinutesAgo(15), agent: "Julian Wanner",  action: "Fikk følg opp",        location: "Rådhusgata 5, 0151 Oslo",                  campaign: "Blå Kors", tone: "warn" },
  { id: "a10", time: tsMinutesAgo(17), agent: "Sara Vik",       action: "Ingen hjemme",         location: "Storgata 40, 0182 Oslo",                   campaign: "CARE",    tone: "neutral" },
  { id: "a11", time: tsMinutesAgo(19), agent: "Erik Hauge",     action: "Registrerte et salg",  location: "Torggata 8, 0181 Oslo",                    campaign: "Strømmestiftelsen", tone: "success" },
  { id: "a12", time: tsMinutesAgo(22), agent: "Aksel Storm",    action: "Fikk nei",             location: "Bogstadveien 22, 0355 Oslo",               campaign: "Talkmore", tone: "danger" },
]

// ─── /api/employee/me/today/ — demo employee day ────────────────────────
const NB_WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"]

export function makeDemoEmployeeDay(firstName: string = "der"): EmployeeDayData {
  const now = new Date()
  const dateStr = now.toLocaleDateString("nb-NO", { day: "numeric", month: "long" })
  return {
    firstName,
    weekday: NB_WEEKDAYS[now.getDay()],
    dateStr,
    timeOfDay: now.getHours() < 11 ? "morgen" : now.getHours() < 17 ? "dag" : "kveld",
    withinShift: true,
    // today's core numbers — realistic mid-day promoter snapshot
    doorsToday: 42,
    doorGoal: 70,
    jaToday: 5,
    neiToday: 27,
    ikkeHjemmeToday: 8,
    folgOppToday: 2,
    salesToday: 5,
    jaProsent: 11.9,
    jaProsentDelta: 1.3,
    // streak
    streakDays: 5,
    streakAtRisk: false,
    streakMinDoors: 30,
    personalBestDoors: 96,
    isNewBest: false,
    // pace
    avgDoors7: 51,
    weekActivity: [48, 55, 62, 43, 51, 58, 42],
    weekLabels: ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"],
    todayGoal: 70,
    yesterdayDoors: 58,
    yesterdayGoal: 70,
    yesterdayAchieved: false,
    // journey — plausible day so far
    journey: [
      { time: "16:12", outcome: "nei" },
      { time: "16:18", outcome: "ikke-hjemme" },
      { time: "16:24", outcome: "nei" },
      { time: "16:31", outcome: "ja" },
      { time: "16:38", outcome: "nei" },
      { time: "16:44", outcome: "folg-opp" },
      { time: "16:52", outcome: "nei" },
      { time: "17:01", outcome: "ja" },
      { time: "17:09", outcome: "ikke-hjemme" },
      { time: "17:16", outcome: "nei" },
      { time: "17:24", outcome: "ja" },
      { time: "17:32", outcome: "nei" },
    ],
    followUps: [
      { name: "Petter Aas",   address: "Storgata 12, Alta",   note: "Vil se på det etter lønn",    time: "16:44" },
      { name: "Eva Rønning",  address: "Skoleveien 7, Alta",  note: "Ringes tilbake i morgen",     time: "17:12" },
    ],
  }
}
