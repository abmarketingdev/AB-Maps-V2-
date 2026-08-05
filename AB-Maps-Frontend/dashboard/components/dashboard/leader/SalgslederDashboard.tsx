"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

// LAZY-LOAD ADAPTER (mobile-perf fix, 2026-08-06):
// - fetchTeamsShallow: ONE `/api/hr/teams/` call → returns team headers
//   (name / color / campaign badge / owner / member_count) with EMPTY promoters
//   list. This is all we need to paint the collapsed cards.
// - fetchTeamDetail: per-team `getTeam + fetchTeamMemberEarnings + fetchEmployeeDoors`
//   fired ONLY when the user expands that team card. Adds 3 requests per
//   expansion, vs the previous 3N-per-page-load stampede that made mobile lag.
//
// Result: page-load network drops from ~35 to ~7 requests on a 10-team account.

const TEAM_COLOR_PALETTE = [
  "#3461FF", "#0E9384", "#F59E0B", "#F43F5E",
  "#8B5CF6", "#10B981", "#EC4899", "#06B6D4",
]

async function fetchTeamsShallow(campaignId: string | undefined): Promise<TeamNode[]> {
  const list = await listTeams({ pageSize: 50, campaignId })
  return list.results.map((t, idx) => ({
    id: t.id,
    name: t.name,
    city: t.campaign?.name ?? "",
    color: t.color || TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length],
    managerName: t.owner?.name ?? "—",
    chiefContribution: 0,
    leaderContribution: 0,
    teamDoorsGoal: 0,        // fills in when the card expands
    teamRecruitedGoal: 0,    // fills in when the card expands
    canEditGoals: false,     // fills in when the card expands (from team_goals payload)
    memberCount: t.member_count,  // truthful pre-expansion count from listTeams
    promoters: [],           // empty until expanded
  }))
}

async function fetchTeamDetail(teamId: string, period: string): Promise<{
  promoters: TeamNode["promoters"]
  teamDoorsGoal: number
  teamRecruitedGoal: number
  canEditGoals: boolean
} | null> {
  const [detail, earnings] = await Promise.all([
    getTeam(teamId).catch(() => null),
    fetchTeamMemberEarnings(teamId, { period }).catch(() => null),
  ])
  if (!detail) return null

  // Fetch doors AFTER earnings resolves (we need earnings.members to know the ab_ids).
  const teamCampaignId = detail.campaign?.id
  const abIds = (earnings?.members ?? [])
    .map((m) => m.ab_person_id)
    .filter((x): x is string => Boolean(x))
  const doorsByAb = new Map<string, number>()
  if (teamCampaignId && abIds.length) {
    try {
      const resp = await fetchEmployeeDoors({
        campaignId: teamCampaignId, period, abPersonIds: abIds,
      })
      for (const r of resp.doors_by_employee) doorsByAb.set(r.ab_person_id, r.doors)
    } catch { /* silent — doors falls back to 0 per promoter below */ }
  }

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
  const tg = earnings?.team_goals
  return {
    teamDoorsGoal: tg?.doors_goal ?? 0,
    teamRecruitedGoal: tg?.recruited_goal ?? 0,
    canEditGoals: tg?.can_edit ?? false,
    promoters: detail.members
      .filter((m) => m.person_type === "employee")
      .map((m) => {
        const e = earningsByPerson.get(m.id) ?? { recruited: 0, active_percent: 0, sum_vervinger: 0, ab_person_id: null }
        const doorsCount = e.ab_person_id ? (doorsByAb.get(e.ab_person_id) ?? 0) : 0
        return {
          id: m.id,
          name: m.name,
          doors: doorsCount,
          doorsGoal: 0,
          recruited: e.recruited,
          recruitedGoal: 0,
          activePercent: e.active_percent,
          sumVervinger: Math.round(e.sum_vervinger),
        }
      }),
  }
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

  // Teams from /api/hr/teams/ — SHALLOW on load (just headers), then per-team
  // detail is fetched lazily when a card is expanded. Cut initial network
  // waterfall from ~35 requests to ~7 on a 10-team account (mobile-perf fix).
  const { selectedCampaign } = useSelectedCampaign()
  const campaignId: string | undefined = selectedCampaign?.id
  const [teams, setTeams] = useState<TeamNode[]>([])
  const [loadingTeamIds, setLoadingTeamIds] = useState<Set<string>>(new Set())
  const loadedTeamIdsRef = useRef<Set<string>>(new Set())
  // Bumped after a successful goal save so the effect re-fetches without
  // needing to change campaign or period.
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Reset lazy-load state whenever the filter changes; expanded team detail
    // is period/campaign-specific and stale if the user switches either.
    loadedTeamIdsRef.current = new Set()
    setLoadingTeamIds(new Set())
    fetchTeamsShallow(campaignId)
      .then((shells) => { if (!cancelled) setTeams(shells) })
      .catch(() => { if (!cancelled) setTeams([]) })
    return () => { cancelled = true }
  }, [campaignId, period, refreshTick])

  // Called by TeamPanel when a card is expanded for the first time.
  // Also called after a goal save (to force refresh that specific team).
  const loadTeamDetail = useCallback(async (teamId: string, force = false) => {
    if (!force && loadedTeamIdsRef.current.has(teamId)) return
    loadedTeamIdsRef.current.add(teamId)
    setLoadingTeamIds((prev) => { const n = new Set(prev); n.add(teamId); return n })
    try {
      const detail = await fetchTeamDetail(teamId, period)
      if (!detail) return
      setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, ...detail } : t))
    } catch {
      // On failure, allow retry by removing from loaded set
      loadedTeamIdsRef.current.delete(teamId)
    } finally {
      setLoadingTeamIds((prev) => { const n = new Set(prev); n.delete(teamId); return n })
    }
  }, [period])

  // Use memberCount from the shallow list when promoters haven't been lazy-
  // loaded yet — otherwise pre-expansion the hero would say '0 promotører'.
  const totalPromoters = teams.reduce((s, tm) => s + (tm.memberCount ?? tm.promoters.length), 0)
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
                  {t("Verving av givere / Teamleder")}
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
            <TeamPanel
              teams={teams}
              period={period}
              loadingTeamIds={loadingTeamIds}
              onTeamExpand={loadTeamDetail}
              onGoalSaved={(teamId) => { if (teamId) loadTeamDetail(teamId, true) }}
            />
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
