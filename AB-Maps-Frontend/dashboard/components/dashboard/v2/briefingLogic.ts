/**
 * Briefing (Hjem) logic — pure, reusable, no React.
 * Mascot selection, headline generation, focus cards and the insight pool.
 * Pure logic only — data comes live from the briefing API (BriefingView).
 */

import type { RoyState } from "@/components/gamification/RoyMascot"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefEmp { id: string; name: string; jaProsent: number; dorerPerDag: number; doors: number; consistency: number; hoursOnShift: number; underThreshold: boolean }
export interface BriefCampaign { name: string; jaRate: number; pctComplete: number; daysLeft: number }

export interface BriefingData {
  firstName: string
  weekday: string
  dateStr: string
  timeOfDay: "morgen" | "dag" | "kveld"
  // footer / context
  totalDoors: number
  contactPct: number
  activeCount: number
  totalCount: number
  // signals
  jaRateToday: number
  jaRateDelta7: number          // pp change vs previous week (can be +/-)
  jaSpark: number[]             // 7 points
  underThresholdNames: string[]
  underThresholdDelta: number   // vs previous week (+ = worse)
  topConcentrationPct: number
  topNames: string[]
  concentrationDelta: number
  salesToday: number
  salesAvg: number
  salesStd: number
  salesYesterdayDeltaPct: number
  campaignAtRisk: BriefCampaign | null
  moodGreenPct: number
  moodRedPct: number
  allCampaignsOnTrack: boolean
  withinShift: boolean
  minutesSinceActivity: number
  lastSaleMinutesAgo: number
  dataReady: boolean
  employees: BriefEmp[]
  campaigns: BriefCampaign[]
}

export interface FocusCard {
  kind: "alerts" | "trend" | "concentration"
  severity: "warning" | "danger" | "info"
  label: string
  value: string
  valueSuffix?: string
  context: string
  delta?: string
  deltaTone: "warning" | "danger" | "success" | "neutral"
  sparkline?: number[]
  href: string
}

export interface InsightResult {
  headline: string
  supporting: string
  bars: { label: string; value: string; raw: number }[]
  implikasjon: string
}

// ─── Empty/neutral briefing ─────────────────────────────────────────────────
// Zeroed placeholder used as the initial value while the live briefing loads
// (no mock numbers). The view shows a loader until real data arrives.
export function emptyBriefing(firstName = ""): BriefingData {
  const now = new Date()
  const hour = now.getHours()
  const timeOfDay = hour < 11 ? "morgen" : hour < 17 ? "dag" : "kveld"
  return {
    firstName,
    weekday: now.toLocaleDateString("nb-NO", { weekday: "long" }),
    dateStr: now.toLocaleDateString("nb-NO", { day: "numeric", month: "long" }),
    timeOfDay,
    totalDoors: 0, contactPct: 0, activeCount: 0, totalCount: 0,
    jaRateToday: 0, jaRateDelta7: 0, jaSpark: [0, 0, 0, 0, 0, 0, 0],
    underThresholdNames: [], underThresholdDelta: 0,
    topConcentrationPct: 0, topNames: [], concentrationDelta: 0,
    salesToday: 0, salesAvg: 0, salesStd: 0, salesYesterdayDeltaPct: 0,
    campaignAtRisk: null,
    moodGreenPct: 0, moodRedPct: 0, allCampaignsOnTrack: true,
    withinShift: false,
    minutesSinceActivity: 0, lastSaleMinutesAgo: 0,
    dataReady: false,
    employees: [], campaigns: [],
  }
}

// ─── Mascot selector (reusable — drives sidebar mascot later) ──────────────────

export function selectMascotState(d: BriefingData): RoyState {
  if (!d.withinShift) return "sleeping"                                  // 1
  if (!d.dataReady) return "thinking"                                    // 2
  if (d.campaignAtRisk && d.campaignAtRisk.daysLeft / 30 < 0.25 && d.campaignAtRisk.pctComplete < 75) return "concerned" // 3
  if (d.underThresholdNames.length >= 3) return "concerned"             // 4
  if (d.moodRedPct > 30) return "concerned"                              // 5
  if (d.salesToday > d.salesAvg + d.salesStd) return "win-big"          // 6
  if (d.allCampaignsOnTrack && d.moodGreenPct > 60) return "win-small"  // 7
  if (d.lastSaleMinutesAgo <= 3) return "greeting"                       // 8
  if (d.withinShift) return "ready"                                      // 9
  return "idle"                                                          // 10
}

// ─── Headline generation ───────────────────────────────────────────────────────

export function generateHeadline(d: BriefingData): { headline: string; supporting: string } {
  if (d.underThresholdNames.length >= 3) {
    return {
      headline: `Lagets ja-rate har falt ${Math.abs(d.jaRateDelta7).toFixed(1)}% denne uken. ${d.underThresholdNames.length} ansatte ligger under terskel.`,
      supporting: `Verdt en kort prat med ${d.underThresholdNames.slice(0, 2).join(" og ")} i dag.`,
    }
  }
  if (d.campaignAtRisk && d.campaignAtRisk.daysLeft / 30 < 0.25) {
    return {
      headline: `${d.campaignAtRisk.name} henger etter — ${d.campaignAtRisk.pctComplete}% fullført, ${d.campaignAtRisk.daysLeft} dager igjen.`,
      supporting: "Vurder å flytte kapasitet hit før fristen.",
    }
  }
  if (!d.withinShift) {
    return {
      headline: `God ${d.timeOfDay}. Ingen aktivitet siste ${Math.round(d.minutesSinceActivity / 60) || 1} timer.`,
      supporting: "Laget er av vakt. Vi sees i morgen tidlig.",
    }
  }
  // all on track
  return {
    headline: `Alt går jevnt — ${d.salesToday} salg i dag, +${d.salesYesterdayDeltaPct}% vs i går.`,
    supporting: `${d.activeCount} av ${d.totalCount} er aktive, og ${d.moodGreenPct}% av laget ligger på eller over mål.`,
  }
}

// ─── Focus cards ────────────────────────────────────────────────────────────────

export function buildFocusCards(d: BriefingData): FocusCard[] {
  const underN = d.underThresholdNames.length
  return [
    {
      kind: "alerts",
      severity: "warning",
      label: "Under terskel",
      value: String(underN),
      valueSuffix: `av ${d.totalCount}`,
      context: underN > 0 ? d.underThresholdNames.join(", ") : "Ingen — hele laget over terskel",
      delta: d.underThresholdDelta === 0 ? "uendret fra forrige uke"
        : d.underThresholdDelta > 0 ? `+${d.underThresholdDelta} flere enn forrige uke`
        : `${Math.abs(d.underThresholdDelta)} færre enn forrige uke`,
      deltaTone: d.underThresholdDelta > 0 ? "warning" : d.underThresholdDelta < 0 ? "success" : "neutral",
      href: "/analytics?tab=varsler",
    },
    {
      kind: "trend",
      severity: "info",
      label: "Ja-rate denne uken",
      value: `${d.jaRateToday}%`,
      context: "Snitt for hele laget",
      delta: `${d.jaRateDelta7 >= 0 ? "+" : ""}${d.jaRateDelta7.toFixed(1)}pp vs forrige uke`,
      deltaTone: d.jaRateDelta7 >= 0 ? "success" : "danger",
      sparkline: d.jaSpark,
      href: "/analytics?tab=oversikt",
    },
    {
      kind: "concentration",
      severity: "info",
      label: "Konsentrasjon",
      value: `${d.topConcentrationPct}%`,
      context: `av dørene fra ${d.topNames.join(", ")}`,
      delta: d.concentrationDelta === 0 ? "stabilt vs forrige uke"
        : `${d.concentrationDelta > 0 ? "+" : ""}${d.concentrationDelta}pp vs forrige uke`,
      deltaTone: d.concentrationDelta > 8 ? "warning" : "neutral",
      href: "/analytics?tab=ansatte",
    },
  ]
}

// ─── Insight pool ───────────────────────────────────────────────────────────────

export interface Insight {
  id: string
  priority: number
  dataRequired: (d: BriefingData) => boolean
  compute: (d: BriefingData) => InsightResult
}

export const INSIGHTS: Insight[] = [
  {
    id: "konsistens",
    priority: 1,
    dataRequired: d => d.employees.length >= 6,
    compute: d => {
      const buckets = [
        { label: "Under 30%", min: 0, max: 30 },
        { label: "30–60%", min: 30, max: 60 },
        { label: "60–80%", min: 60, max: 80 },
        { label: "Over 80%", min: 80, max: 101 },
      ]
      const bars = buckets.map(b => {
        const inB = d.employees.filter(e => e.consistency >= b.min && e.consistency < b.max)
        const avg = inB.length ? Math.round(inB.reduce((s, e) => s + e.dorerPerDag, 0) / inB.length) : 0
        return { label: b.label, value: `${avg} dører/dag`, raw: avg }
      })
      return {
        headline: "Konsistens forutsier ytelse tydeligere enn erfaring.",
        supporting: "Ansatte som møter jevnt opp banker langt flere dører per dag enn de med ujevn innsats.",
        bars,
        implikasjon: "Coaching bør rettes mot oppmøte og rutine, ikke bare teknikk — de mest konsistente leverer mest.",
      }
    },
  },
  {
    id: "konsentrasjon",
    priority: 2,
    dataRequired: d => d.employees.length >= 4,
    compute: d => {
      const sorted = [...d.employees].sort((a, b) => b.doors - a.doors)
      const top3 = sorted.slice(0, 3)
      const total = d.employees.reduce((s, e) => s + e.doors, 0)
      const rest = total - top3.reduce((s, e) => s + e.doors, 0)
      const bars = [
        ...top3.map(e => ({ label: e.name, value: `${Math.round(e.doors / total * 100)}%`, raw: e.doors })),
        { label: "Alle andre", value: `${Math.round(rest / total * 100)}%`, raw: rest },
      ]
      return {
        headline: `Topp 3 står for ${d.topConcentrationPct}% av alle dører.`,
        supporting: "Resultatene hviler på få skuldre — en stor andel av volumet kommer fra de tre beste.",
        bars,
        implikasjon: "Spre kunnskapen: la toppen dele rutiner, så reduseres risikoen hvis én av dem har en dårlig uke.",
      }
    },
  },
  {
    id: "kampanjeeffektivitet",
    priority: 3,
    dataRequired: d => d.campaigns.length >= 2,
    compute: d => {
      const sorted = [...d.campaigns].sort((a, b) => b.jaRate - a.jaRate)
      const bars = sorted.map(c => ({ label: c.name, value: `${c.jaRate}%`, raw: c.jaRate }))
      return {
        headline: `${sorted[0].name} konverterer best akkurat nå.`,
        supporting: "Ja-raten varierer tydelig mellom kampanjene — noen treffer publikum bedre enn andre.",
        bars,
        implikasjon: "Vurder å vekte mer kapasitet mot kampanjene med høyest ja-rate denne uken.",
      }
    },
  },
]

export function pickInsight(d: BriefingData): InsightResult {
  const candidate = [...INSIGHTS].sort((a, b) => a.priority - b.priority).find(i => i.dataRequired(d)) ?? INSIGHTS[0]
  return candidate.compute(d)
}
