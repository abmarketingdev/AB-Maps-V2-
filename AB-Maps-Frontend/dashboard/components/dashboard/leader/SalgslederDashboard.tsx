"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useLang } from "@/lib/i18n"
import { useSelectedCampaign } from "@/components/campaign/CampaignGuard"
import { EmbeddedManagerWidgets } from "./EmbeddedManagerWidgets"
import { SectionHeader } from "./SectionHeader"
import { AuroraBg } from "./AuroraBg"
import { AvatarStack } from "./Avatar"
import { LivePulseDot } from "./LivePulseDot"
import { MonthPicker } from "./MonthPicker"
import { TeamPanel } from "./TeamPanel"
import { TopplisterRow } from "./TopplisterRow"
import { LonnRowSalgsleder } from "./LonnRowSalgsleder"
import { EstimatedSalaryBand } from "./EstimatedSalaryBand"
import { listTeams, getTeam, fetchTeamMemberEarnings } from "@/lib/api/teams"
import { fetchEmployeeDoors } from "@/lib/api/dashboardOverview"
import { type TeamNode } from "./dummyData"

// Adapter: real HR /api/hr/teams/ → dashboard's TeamNode shape (what
// TeamPanel expects). Real data covers team header (name, color, city
// via campaign, managerName via owner) + member NAMES + per-member
// RECRUITED / ACTIVE% / SUM_VERVINGER via the Phase 3 hr-service endpoint,
// and per-member DOORS via the Phase 3.5 analytics-service endpoint
// (2026-08-05). doorsGoal/recruitedGoal remain 0 for now — no goals
// endpoint yet (Phase D — boss confirmed per-team scope, pending impl).
//
// Scoped to the currently-selected campaign via CampaignGuard context —
// without this, admin/superuser sees every team across every campaign.
// `period` (YYYY-MM) comes from the MonthPicker; without it we'd always
// query current month (Aug 5 2026 problem: no data uploaded yet → 0s).
async function fetchTeamsAsNodes(campaignId: string | undefined, period: string): Promise<TeamNode[]> {
  const list = await listTeams({ pageSize: 50, campaignId })
  if (!list.results.length) return []

  // Fetch full team detail + per-member earnings in parallel, per team.
  // Each pair fetches independently so a single team's earnings failure
  // (403 for a non-chief on that specific team, or 500) doesn't tank the
  // whole page — we just fall back to zeros for that team's members.
  const results = await Promise.all(list.results.map(async (t) => {
    const [detail, earnings] = await Promise.all([
      getTeam(t.id).catch(() => null),
      fetchTeamMemberEarnings(t.id, { period }).catch(() => null),
    ])
    return { detail, earnings }
  }))

  // One parallel batch fetch for all doors across all team members. Analytics
  // endpoint takes a comma-separated ab_person_ids list, so it's ONE request
  // regardless of team count. Keyed by ab_person_id for merge below.
  const allAbIds = new Set<string>()
  for (const { earnings } of results) {
    if (!earnings) continue
    for (const m of earnings.members) {
      if (m.ab_person_id) allAbIds.add(m.ab_person_id)
    }
  }
  const doorsByAb = new Map<string, number>()
  if (allAbIds.size && campaignId) {
    try {
      const resp = await fetchEmployeeDoors({
        campaignId, period, abPersonIds: Array.from(allAbIds),
      })
      for (const r of resp.doors_by_employee) doorsByAb.set(r.ab_person_id, r.doors)
    } catch { /* silent — doors falls back to 0 per promoter below */ }
  }

  // Distinct color palette for teams whose backend `color` field is null.
  // Cycles through 8 aurora-friendly shades so 2+ teams don't all look teal.
  const TEAM_COLOR_PALETTE = [
    "#3461FF", "#0E9384", "#F59E0B", "#F43F5E",
    "#8B5CF6", "#10B981", "#EC4899", "#06B6D4",
  ]

  // Build lookup: person_id → earnings row (fast merge in the map below)
  return results
    .filter((r): r is { detail: NonNullable<typeof r.detail>; earnings: typeof r.earnings } => r.detail !== null)
    .map(({ detail, earnings }, idx) => {
      const earningsByPerson = new Map<string, { recruited: number; active_percent: number; sum_vervinger: number; ab_person_id: string | null }>()
      if (earnings) {
        for (const m of earnings.members) {
          earningsByPerson.set(m.person_id, {
            recruited: m.recruited,
            active_percent: m.active_percent,
            sum_vervinger: m.sum_vervinger,
            ab_person_id: m.ab_person_id,
          })
        }
      }
      return {
        id: detail.id,
        name: detail.name,
        city: detail.campaign?.name ?? "",
        color: detail.color || TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length],
        managerName: detail.owner?.name ?? "—",
        chiefContribution: 0,
        leaderContribution: 0,
        promoters: detail.members
          .filter((m) => m.person_type === "employee")
          .map((m) => {
            const e = earningsByPerson.get(m.id) ?? { recruited: 0, active_percent: 0, sum_vervinger: 0, ab_person_id: null }
            const doorsCount = e.ab_person_id ? (doorsByAb.get(e.ab_person_id) ?? 0) : 0
            return {
              id: m.id,
              name: m.name,
              doors: doorsCount,               // REAL from /employees/doors-by-period/ (Phase 3.5)
              doorsGoal: 0,                    // Phase D — team-level goal, not per-promoter
              recruited: e.recruited,          // REAL from /member-earnings/
              recruitedGoal: 0,                // Phase D — team-level goal, not per-promoter
              activePercent: e.active_percent, // REAL
              sumVervinger: Math.round(e.sum_vervinger), // REAL (nearest kroner)
            }
          }),
      }
    })
}

// Salgsleder / Teamleder dashboard — Aurora Nordic redesign.
// Route: /dashbord. Served to ALL non-employee roles (manager / admin /
// superuser / sales_chief) per boss decision 2026-08-05.
export function SalgslederDashboard() {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const reduced = useReducedMotion()
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 11 ? t("God morgen") :
    hour < 17 ? t("God dag") :
    t("God kveld")
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "der"

  // Selected month for LØNN + TeamPanel. Defaults to current month; user
  // can pick any of the last 12 via MonthPicker in the hero. Persisted in
  // URL as ?period=YYYY-MM so refresh/bookmarks preserve it. Sanntid +
  // Topplister ignore this — they're inherently "now" / rolling window.
  const [period, setPeriod] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("period")
      if (p && /^\d{4}-\d{2}$/.test(p)) return p
    }
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.searchParams.set("period", period)
    window.history.replaceState({}, "", url.toString())
  }, [period])

  // Real teams from /api/hr/teams/ (with getTeam + member-earnings per team).
  // Scoped to the currently-selected campaign via CampaignGuard context.
  // Refetches when the user switches campaigns OR picks a different month.
  const { selectedCampaign } = useSelectedCampaign()
  const campaignId: string | undefined = selectedCampaign?.id
  const [teams, setTeams] = useState<TeamNode[]>([])
  useEffect(() => {
    let cancelled = false
    fetchTeamsAsNodes(campaignId, period)
      .then((real) => { if (!cancelled) setTeams(real) })
      .catch(() => { if (!cancelled) setTeams([]) })
    return () => { cancelled = true }
  }, [campaignId, period])

  const totalPromoters = teams.reduce((s, tm) => s + tm.promoters.length, 0)
  const leaderNames = teams.map((tm) => tm.managerName)

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-aurora-amber/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-aurora-sunrise/[0.05] blur-[100px]" />
      </div>

      <div className="relative max-w-[1600px] mx-auto">
        {/* ═════════════════ HERO PANEL ═════════════════ */}
        <motion.section
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden mx-4 sm:mx-6 mt-6 sm:mt-8 rounded-[28px] border border-ab-line"
        >
          <AuroraBg intensity="normal" />
          <div className="relative px-6 sm:px-10 py-8 sm:py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-ab-fg-3">
                {now.toLocaleDateString(lang === "no" ? "nb-NO" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h1 className="mt-2 font-instrument text-4xl sm:text-6xl leading-[1.02] text-ab-fg">
                {greeting}, <span className="italic text-aurora-amber">{firstName}</span> <span className="not-italic">👋</span>
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ab-fg-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-aurora-amber ring-1 ring-inset ring-aurora-amber/25">
                  <Sparkles className="h-3 w-3" />
                  {t("Salgsleder / Teamleder")}
                </span>
                <span className="text-ab-fg-3">·</span>
                <div className="inline-flex items-center gap-2">
                  <AvatarStack names={leaderNames} size={22} max={4} />
                  <span className="text-ab-fg-3">
                    <span className="font-mono text-ab-fg">{teams.length}</span> {t("team")} ·{" "}
                    <span className="font-mono text-ab-fg">{totalPromoters}</span> {t("promotører")}
                  </span>
                </div>
                <span className="text-ab-fg-3">·</span>
                <MonthPicker value={period} onChange={setPeriod} />
              </div>
            </div>
          </div>
        </motion.section>

        <div className="relative px-4 sm:px-6 py-6 sm:py-8 space-y-8">
          {/* MÅL MÅNED + MÅL UKE remain hidden until Phase D (Goals endpoint).
              LØNN + EstimatedSalaryBand were unhidden Phase 2+5 (2026-08-05):
              components self-hide (render null) when the salary endpoint
              feature-flag is OFF or returns unavailable — never fake data. */}

          {/* ═════════════════ Team ═════════════════ */}
          <div>
            <SectionHeader label={t("Team")} accent="teamleder" />
            <p className="pb-2 pl-4 text-[11px] text-ab-fg-3">{t("Klikk et team for å se promotørene bak tallene")}</p>
            <TeamPanel teams={teams} />
          </div>

          {/* ═════════════════ Lønn (Phase 2+5 — feature-flagged real data) ═════════════════ */}
          <div className="space-y-3">
            <SectionHeader label={t("Lønn")} accent="teamleder" />
            <p className="pl-4 text-[11px] text-ab-fg-3">{t("Klikk Sum vervinger eller Lederprovisjon for team-fordeling")}</p>
            <LonnRowSalgsleder period={period} campaignId={campaignId} campaignName={selectedCampaign?.name} />
            <EstimatedSalaryBand period={period} campaignId={campaignId} />
          </div>

          {/* ═════════════════ Topplister ═════════════════ */}
          <div>
            <SectionHeader label={t("Topplister")} accent="teamleder" />
            <TopplisterRow campaignId={campaignId} />
          </div>

          {/* ═════════════════ Sanntid — live widgets from prod manager view ═════════════════ */}
          <div>
            <SectionHeader label={t("Sanntid")} accent="teamleder" right={<LivePulseDot label={t("Live")} />} />
            <p className="pb-2 pl-4 text-[11px] text-ab-fg-3">{t("Live tall og trend for hele teamet ditt")}</p>
            <EmbeddedManagerWidgets />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalgslederDashboard
