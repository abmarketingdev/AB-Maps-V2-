"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Shield, Users as UsersIcon, Building2 } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useLang } from "@/lib/i18n"
import { useSelectedCampaign } from "@/components/campaign/CampaignGuard"
import { EmbeddedManagerWidgets } from "./EmbeddedManagerWidgets"
import { SectionHeader } from "./SectionHeader"
import { AuroraBg } from "./AuroraBg"
import { AvatarStack } from "./Avatar"
import { LivePulseDot } from "./LivePulseDot"
import { MalRow } from "./MalRow"
import { MonthPicker } from "./MonthPicker"
import { SalesChiefPanel, groupTeamsByChief } from "./SalesChiefPanel"
import { TopplisterRow } from "./TopplisterRow"
import { LonnRowSalgsleder } from "./LonnRowSalgsleder"
import { EstimatedSalaryBand } from "./EstimatedSalaryBand"
import { listTeams, getTeam, fetchTeamMemberEarnings } from "@/lib/api/teams"
import { fetchEmployeeDoors } from "@/lib/api/dashboardOverview"
import { type TeamNode } from "./dummyData"

// ─────────────────────────────────────────────────────────────────────────────
// AdminDashboard (2026-08-06) — for admin / superuser only.
// Route: /dashbord (dispatched from app/dashbord/page.tsx when isSuperuser).
// Same MÅL + LØNN + Topplister + Sanntid sections as SalgslederDashboard,
// but the Team section becomes a Salgssjefer grouped hierarchy so an org
// with 20 chiefs / 60 teams is scannable.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

const TEAM_COLOR_PALETTE = [
  "#3461FF", "#0E9384", "#F59E0B", "#F43F5E",
  "#8B5CF6", "#10B981", "#EC4899", "#06B6D4",
]

const CHIEF_ACCENT_PALETTE = [
  "#3461FF", "#0E9384", "#F59E0B", "#F43F5E",
  "#8B5CF6", "#10B981", "#EC4899", "#06B6D4",
]

// ─── DEMO fixtures — used only when NEXT_PUBLIC_DEMO_MODE=true. ────────────
// Boss uses these in client demos to see the hierarchical view richly
// populated. In prod (env unset) we hit real /api/hr/teams/.

interface DemoPromoter { id: string; name: string; doors: number; recruited: number; sumV: number; activePct: number }
interface DemoTeam {
  id: string; name: string; color: string; leader: string;
  goalD: number; goalR: number; wkGoalD: number; wkGoalR: number;
  promoters: DemoPromoter[]
}
interface DemoChief { id: string; name: string; teams: DemoTeam[] }

const DEMO_CHIEFS: DemoChief[] = [
  {
    id: "chief-mergim", name: "Mergim Kerelaj",
    teams: [
      { id: "t-1", name: "Oslo Nord", color: "#3461FF", leader: "Kari Nordmann", goalD: 2000, goalR: 100, wkGoalD: 500, wkGoalR: 25, promoters: [
        { id: "p1", name: "Ida Solberg", doors: 380, recruited: 22, sumV: 12800, activePct: 91 },
        { id: "p2", name: "Erik Hauge", doors: 290, recruited: 18, sumV: 10400, activePct: 84 },
        { id: "p3", name: "Selma Nes", doors: 340, recruited: 19, sumV: 11200, activePct: 79 },
      ]},
      { id: "t-2", name: "Oslo Sør", color: "#0E9384", leader: "Frida Johansson", goalD: 1800, goalR: 90, wkGoalD: 450, wkGoalR: 22, promoters: [
        { id: "p4", name: "Marius Holte", doors: 320, recruited: 17, sumV: 9800, activePct: 76 },
        { id: "p5", name: "Anna Kristensen", doors: 260, recruited: 14, sumV: 8100, activePct: 71 },
      ]},
      { id: "t-3", name: "Bergen Vest", color: "#F59E0B", leader: "Storm Tretvoll", goalD: 1500, goalR: 80, wkGoalD: 380, wkGoalR: 20, promoters: [
        { id: "p6", name: "Petter Ås", doors: 210, recruited: 12, sumV: 7000, activePct: 65 },
        { id: "p7", name: "Rikke Larsen", doors: 240, recruited: 15, sumV: 8600, activePct: 82 },
      ]},
      { id: "t-4", name: "Trondheim", color: "#F43F5E", leader: "—", goalD: 1200, goalR: 60, wkGoalD: 300, wkGoalR: 15, promoters: [
        { id: "p8", name: "Sigrid Vik", doors: 180, recruited: 9, sumV: 5300, activePct: 67 },
      ]},
    ],
  },
  {
    id: "chief-lasse", name: "Lasse Jelmo",
    teams: [
      { id: "t-5", name: "Stavanger", color: "#8B5CF6", leader: "Marius Holte", goalD: 1600, goalR: 85, wkGoalD: 400, wkGoalR: 21, promoters: [
        { id: "p9", name: "Nora Berg", doors: 270, recruited: 16, sumV: 9200, activePct: 80 },
        { id: "p10", name: "Kasper Lie", doors: 300, recruited: 20, sumV: 11400, activePct: 88 },
        { id: "p11", name: "Tomas Ruud", doors: 250, recruited: 13, sumV: 7500, activePct: 72 },
      ]},
      { id: "t-6", name: "Kristiansand", color: "#EC4899", leader: "Storm Tretvoll", goalD: 1400, goalR: 70, wkGoalD: 350, wkGoalR: 18, promoters: [
        { id: "p12", name: "Line Nilsen", doors: 220, recruited: 12, sumV: 6900, activePct: 74 },
      ]},
    ],
  },
  {
    id: "chief-johannes", name: "Johannes Landgraff Høier",
    teams: [
      { id: "t-7", name: "Tromsø", color: "#10B981", leader: "Frida Johansson", goalD: 1300, goalR: 65, wkGoalD: 325, wkGoalR: 16, promoters: [
        { id: "p13", name: "Håkon Nilsen", doors: 210, recruited: 11, sumV: 6300, activePct: 68 },
        { id: "p14", name: "Elin Solheim", doors: 280, recruited: 15, sumV: 8800, activePct: 83 },
      ]},
      { id: "t-8", name: "Alta", color: "#06B6D4", leader: "—", goalD: 900, goalR: 45, wkGoalD: 225, wkGoalR: 11, promoters: [
        { id: "p15", name: "Truls Berg", doors: 140, recruited: 7, sumV: 4200, activePct: 60 },
      ]},
    ],
  },
]

function demoTeamsFlat(): TeamNode[] {
  const out: TeamNode[] = []
  for (const chief of DEMO_CHIEFS) {
    for (const tm of chief.teams) {
      const totalDoors = tm.promoters.reduce((s, p) => s + p.doors, 0)
      const totalRec = tm.promoters.reduce((s, p) => s + p.recruited, 0)
      out.push({
        id: tm.id,
        name: tm.name,
        city: "Oslo",
        color: tm.color,
        managerName: tm.leader,
        chiefContribution: 0,
        leaderContribution: 0,
        teamDoorsGoal: tm.goalD,
        teamRecruitedGoal: tm.goalR,
        teamDoorsWeeklyGoal: tm.wkGoalD,
        teamRecruitedWeeklyGoal: tm.wkGoalR,
        canEditGoals: true,
        memberCount: tm.promoters.length,
        salesChiefId: chief.id,
        salesChiefName: chief.name,
        promoters: tm.promoters.map(p => ({
          id: p.id,
          name: p.name,
          doors: p.doors,
          doorsGoal: 0,
          recruited: p.recruited,
          recruitedGoal: 0,
          activePercent: p.activePct,
          sumVervinger: p.sumV,
        })),
      })
    }
  }
  return out
}

// ─── Real-data helpers (identical shape to SalgslederDashboard) ─────────────

async function fetchTeamsShallow(campaignId: string | undefined): Promise<TeamNode[]> {
  const list = await listTeams({ pageSize: 100, campaignId })
  return list.results.map((t, idx) => ({
    id: t.id,
    name: t.name,
    city: t.campaign?.name ?? "",
    color: t.color || TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length],
    managerName: t.owner?.name ?? "—",
    chiefContribution: 0,
    leaderContribution: 0,
    teamDoorsGoal: 0,
    teamRecruitedGoal: 0,
    teamDoorsWeeklyGoal: null,
    teamRecruitedWeeklyGoal: null,
    canEditGoals: false,
    memberCount: t.member_count,
    salesChiefId: t.sales_chief?.id ?? null,
    salesChiefName: t.sales_chief?.name ?? null,
    promoters: [],
  }))
}

async function fetchTeamDetail(teamId: string, period: string) {
  const [detail, earnings] = await Promise.all([
    getTeam(teamId).catch(() => null),
    fetchTeamMemberEarnings(teamId, { period }).catch(() => null),
  ])
  if (!detail) return null
  const teamCampaignId = detail.campaign?.id
  const abIds = (earnings?.members ?? [])
    .map((m) => m.ab_person_id)
    .filter((x): x is string => Boolean(x))
  const doorsByAb = new Map<string, number>()
  if (teamCampaignId && abIds.length) {
    try {
      const resp = await fetchEmployeeDoors({ campaignId: teamCampaignId, period, abPersonIds: abIds })
      for (const r of resp.doors_by_employee) doorsByAb.set(r.ab_person_id, r.doors)
    } catch { /* silent */ }
  }
  const earningsByPerson = new Map<string, { recruited: number; active_percent: number; sum_vervinger: number; ab_person_id: string | null }>()
  if (earnings) for (const m of earnings.members) {
    earningsByPerson.set(m.person_id, { recruited: m.recruited, active_percent: m.active_percent, sum_vervinger: m.sum_vervinger, ab_person_id: m.ab_person_id })
  }
  const tg = earnings?.team_goals
  return {
    teamDoorsGoal: tg?.doors_goal ?? 0,
    teamRecruitedGoal: tg?.recruited_goal ?? 0,
    teamDoorsWeeklyGoal: tg?.doors_weekly_goal ?? null,
    teamRecruitedWeeklyGoal: tg?.recruited_weekly_goal ?? null,
    canEditGoals: tg?.can_edit ?? false,
    promoters: detail.members
      .filter((m) => m.person_type === "employee")
      .map((m) => {
        const e = earningsByPerson.get(m.id) ?? { recruited: 0, active_percent: 0, sum_vervinger: 0, ab_person_id: null }
        const doorsCount = e.ab_person_id ? (doorsByAb.get(e.ab_person_id) ?? 0) : 0
        return {
          id: m.id, name: m.name, doors: doorsCount, doorsGoal: 0,
          recruited: e.recruited, recruitedGoal: 0, activePercent: e.active_percent,
          sumVervinger: Math.round(e.sum_vervinger),
        }
      }),
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminDashboard() {
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

  const { selectedCampaign } = useSelectedCampaign()
  const campaignId: string | undefined = selectedCampaign?.id
  const [teams, setTeams] = useState<TeamNode[]>([])
  const [loadingTeamIds, setLoadingTeamIds] = useState<Set<string>>(new Set())
  const loadedTeamIdsRef = useRef<Set<string>>(new Set())
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadedTeamIdsRef.current = new Set()
    setLoadingTeamIds(new Set())
    if (DEMO_MODE) {
      setTeams(demoTeamsFlat())
      return
    }
    fetchTeamsShallow(campaignId)
      .then((shells) => { if (!cancelled) setTeams(shells) })
      .catch(() => { if (!cancelled) setTeams([]) })
    return () => { cancelled = true }
  }, [campaignId, period, refreshTick])

  const loadTeamDetail = useCallback(async (teamId: string, force = false) => {
    if (DEMO_MODE) return  // demo mocks are already fully populated
    if (!force && loadedTeamIdsRef.current.has(teamId)) return
    loadedTeamIdsRef.current.add(teamId)
    setLoadingTeamIds((prev) => { const n = new Set(prev); n.add(teamId); return n })
    try {
      const detail = await fetchTeamDetail(teamId, period)
      if (!detail) return
      setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, ...detail } : t))
    } catch {
      loadedTeamIdsRef.current.delete(teamId)
    } finally {
      setLoadingTeamIds((prev) => { const n = new Set(prev); n.delete(teamId); return n })
    }
  }, [period])

  // Group by Sales Chief for the hierarchical section.
  const chiefGroups = useMemo(() => groupTeamsByChief(teams), [teams])
  const totalPromoters = teams.reduce((s, tm) => s + (tm.memberCount ?? tm.promoters.length), 0)
  const totalChiefs = chiefGroups.filter((g) => g.chiefId !== null).length

  const onChiefExpand = (chiefId: string | null) => {
    const g = chiefGroups.find((cg) => cg.chiefId === chiefId)
    if (!g) return
    for (const tm of g.teams) loadTeamDetail(tm.id)
  }

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-aurora-amber/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-aurora-sunrise/[0.05] blur-[100px]" />
      </div>

      <div className="relative max-w-[1600px] mx-auto">
        {/* HERO — admin variant: shield chip, chief count, promoter count */}
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
                  <Shield className="h-3 w-3" />
                  {t("Adminoversikt")}
                </span>
                <span className="text-ab-fg-3">·</span>
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="h-3.5 w-3.5 text-ab-fg-4" />
                  <span className="font-mono text-ab-fg">{totalChiefs}</span> {t("salgssjefer")}
                </span>
                <span className="text-ab-fg-3">·</span>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-ab-fg-4" />
                  <span className="font-mono text-ab-fg">{teams.length}</span> {t("team")}
                </span>
                <span className="text-ab-fg-3">·</span>
                <span>
                  <span className="font-mono text-ab-fg">{totalPromoters}</span> {t("promotører")}
                </span>
                <span className="text-ab-fg-3">·</span>
                <MonthPicker value={period} onChange={setPeriod} />
              </div>
            </div>
          </div>
        </motion.section>

        <div className="relative px-4 sm:px-6 py-6 sm:py-8 space-y-8">
          {/* MÅL — org-wide aggregate (already sums across all teams for admin) */}
          <div>
            <SectionHeader label={t("Mål")} accent="teamleder" />
            <MalRow period={period} />
          </div>

          {/* SALGSSJEFER — hierarchical grouping */}
          <div>
            <SectionHeader label={t("Salgssjefer")} accent="teamleder" />
            <p className="pb-2 pl-4 text-[11px] text-ab-fg-3">
              {t("Klikk en salgssjef for å se teamene deres — klikk et team for å se promotørene")}
            </p>
            <div className="space-y-3">
              {chiefGroups.length === 0 && (
                <div className="rounded-2xl border border-dashed border-ab-line-1 bg-white/[0.02] px-6 py-8 text-center text-xs text-ab-fg-3">
                  {t("Ingen team synlige akkurat nå.")}
                </div>
              )}
              {chiefGroups.map((group, i) => (
                <SalesChiefPanel
                  key={group.chiefId ?? "no-chief"}
                  group={group}
                  period={period}
                  loadingTeamIds={loadingTeamIds}
                  onTeamExpand={loadTeamDetail}
                  onGoalSaved={(teamId) => { if (teamId) loadTeamDetail(teamId, true) }}
                  onExpand={onChiefExpand}
                  accent={CHIEF_ACCENT_PALETTE[i % CHIEF_ACCENT_PALETTE.length]}
                />
              ))}
            </div>
          </div>

          {/* LØNN — global scope for admin (all teams) */}
          <div className="space-y-3">
            <SectionHeader label={t("Lønn")} accent="teamleder" />
            <p className="pl-4 text-[11px] text-ab-fg-3">{t("Klikk Sum vervinger eller Lederprovisjon for team-fordeling")}</p>
            <LonnRowSalgsleder period={period} campaignId={campaignId} campaignName={selectedCampaign?.name} />
            <EstimatedSalaryBand period={period} campaignId={campaignId} />
          </div>

          <div>
            <SectionHeader label={t("Topplister")} accent="teamleder" />
            <TopplisterRow campaignId={campaignId} />
          </div>

          <div>
            <SectionHeader label={t("Sanntid")} accent="teamleder" right={<LivePulseDot label={t("Live")} />} />
            <p className="pb-2 pl-4 text-[11px] text-ab-fg-3">{t("Live tall og trend for hele organisasjonen")}</p>
            <EmbeddedManagerWidgets />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
