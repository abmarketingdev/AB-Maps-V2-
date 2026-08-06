"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Pencil, Target, FolderOpen, Users, Copy, CheckCircle2, Calendar } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { useSelectedCampaign } from "@/components/campaign/CampaignGuard"
import { listTeams, fetchTeamGoal, saveTeamGoal, type TeamListItem, type TeamGoalPayload } from "@/lib/api/teams"
import { fetchCampaignsWithStats, fetchCampaignGoal, saveCampaignGoal, type CampaignVM, type CampaignGoalPayload } from "@/lib/api/campaigns"
import { currentPeriod } from "@/lib/api/salary"
import { SetTeamGoalModal } from "./SetTeamGoalModal"
import { SetCampaignGoalModal } from "./SetCampaignGoalModal"
import { MonthPicker } from "./MonthPicker"
import { SectionHeader } from "./SectionHeader"

// ─────────────────────────────────────────────────────────────────────────────
// Mål-innstillinger (2026-08-06)
// Admin/chief overview page. Segmented view for setting monthly + weekly goals
// across all visible teams (grouped by Sales Chief) + campaigns.
//
// Data sources:
//   * /api/hr/teams/                → team list (auto-scoped by caller role)
//   * /api/hr/teams/{id}/goals/     → per-team goal (parallel fetch per team)
//   * /api/campaigns/campaigns/     → campaign list
//   * /api/hr/campaigns/{id}/goal/  → per-campaign goal
//
// Server enforces write permissions per row via goal.can_edit — we hide the
// Rediger button when it's false (chief sees a "Låst" chip on campaign rows
// they can't set). Campaigns are filtered to those referenced by visible
// teams, so chief doesn't see the full campaign list for the org.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

// Demo fixtures — only used when DEMO_MODE is true. Lets Dana see the full
// segmented layout without needing a live backend. Numbers deliberately match
// AdminDashboard's DEMO_CHIEFS so the two views feel like one org.
const DEMO_TEAMS: TeamListItem[] = [
  { id: "t-1", name: "Oslo Nord",     color: "#3461FF", description: "", icon: "",
    campaign: { id: "c-nrc", name: "NRC" }, owner: { id: "u-kn", name: "Kari Nordmann" },
    sales_chief: { id: "chief-mergim", name: "Mergim Kerelaj" }, member_count: 3,
    created_at: "", updated_at: "" },
  { id: "t-2", name: "Oslo Sør",      color: "#0E9384", description: "", icon: "",
    campaign: { id: "c-nrc", name: "NRC" }, owner: { id: "u-fj", name: "Frida Johansson" },
    sales_chief: { id: "chief-mergim", name: "Mergim Kerelaj" }, member_count: 2,
    created_at: "", updated_at: "" },
  { id: "t-3", name: "Bergen Vest",   color: "#F59E0B", description: "", icon: "",
    campaign: { id: "c-nrc", name: "NRC" }, owner: { id: "u-st", name: "Storm Tretvoll" },
    sales_chief: { id: "chief-mergim", name: "Mergim Kerelaj" }, member_count: 2,
    created_at: "", updated_at: "" },
  { id: "t-4", name: "Trondheim",     color: "#F43F5E", description: "", icon: "",
    campaign: { id: "c-nrc", name: "NRC" }, owner: null,
    sales_chief: { id: "chief-mergim", name: "Mergim Kerelaj" }, member_count: 1,
    created_at: "", updated_at: "" },
  { id: "t-5", name: "Stavanger",     color: "#8B5CF6", description: "", icon: "",
    campaign: { id: "c-nf", name: "Norsk Folkehjelp" }, owner: { id: "u-mh", name: "Marius Holte" },
    sales_chief: { id: "chief-lasse", name: "Lasse Jelmo" }, member_count: 3,
    created_at: "", updated_at: "" },
  { id: "t-6", name: "Kristiansand",  color: "#EC4899", description: "", icon: "",
    campaign: { id: "c-nf", name: "Norsk Folkehjelp" }, owner: { id: "u-st", name: "Storm Tretvoll" },
    sales_chief: { id: "chief-lasse", name: "Lasse Jelmo" }, member_count: 1,
    created_at: "", updated_at: "" },
  { id: "t-7", name: "Tromsø",        color: "#10B981", description: "", icon: "",
    campaign: { id: "c-care", name: "CARE" }, owner: { id: "u-fj", name: "Frida Johansson" },
    sales_chief: { id: "chief-johannes", name: "Johannes Landgraff Høier" }, member_count: 2,
    created_at: "", updated_at: "" },
  { id: "t-8", name: "Alta",          color: "#06B6D4", description: "", icon: "",
    campaign: { id: "c-care", name: "CARE" }, owner: null,
    sales_chief: null, member_count: 1,
    created_at: "", updated_at: "" },
]

const DEMO_TEAM_GOALS: Record<string, TeamGoalPayload> = {
  "t-1": { team_id: "t-1", period: "2026-08", doors_goal: 2000, recruited_goal: 100, doors_weekly_goal: 500, recruited_weekly_goal: 25, can_edit: true, updated_at: null, updated_by_id: null },
  "t-2": { team_id: "t-2", period: "2026-08", doors_goal: 1800, recruited_goal: 90, doors_weekly_goal: 450, recruited_weekly_goal: 22, can_edit: true, updated_at: null, updated_by_id: null },
  "t-3": { team_id: "t-3", period: "2026-08", doors_goal: 1500, recruited_goal: 80, doors_weekly_goal: null, recruited_weekly_goal: null, can_edit: true, updated_at: null, updated_by_id: null },
  "t-4": { team_id: "t-4", period: "2026-08", doors_goal: 0,    recruited_goal: 0,  doors_weekly_goal: null, recruited_weekly_goal: null, can_edit: true, updated_at: null, updated_by_id: null },
  "t-5": { team_id: "t-5", period: "2026-08", doors_goal: 1600, recruited_goal: 85, doors_weekly_goal: 400, recruited_weekly_goal: 21, can_edit: true, updated_at: null, updated_by_id: null },
  "t-6": { team_id: "t-6", period: "2026-08", doors_goal: 0,    recruited_goal: 0,  doors_weekly_goal: null, recruited_weekly_goal: null, can_edit: true, updated_at: null, updated_by_id: null },
  "t-7": { team_id: "t-7", period: "2026-08", doors_goal: 1300, recruited_goal: 65, doors_weekly_goal: 325, recruited_weekly_goal: 16, can_edit: true, updated_at: null, updated_by_id: null },
  "t-8": { team_id: "t-8", period: "2026-08", doors_goal: 0,    recruited_goal: 0,  doors_weekly_goal: null, recruited_weekly_goal: null, can_edit: true, updated_at: null, updated_by_id: null },
}

const DEMO_CAMPAIGNS: CampaignVM[] = [
  { id: "c-nrc",  name: "NRC",              description: "", color: "#3461FF", status: "active", areas: 12, employeeIds: [], salesWeek: 0, salesLifetime: 0, pctComplete: 0, availableDoors: 0, knocked: 0, totalJa: 0, created: new Date() },
  { id: "c-nf",   name: "Norsk Folkehjelp", description: "", color: "#F59E0B", status: "active", areas: 8,  employeeIds: [], salesWeek: 0, salesLifetime: 0, pctComplete: 0, availableDoors: 0, knocked: 0, totalJa: 0, created: new Date() },
  { id: "c-care", name: "CARE",             description: "", color: "#0E9384", status: "active", areas: 6,  employeeIds: [], salesWeek: 0, salesLifetime: 0, pctComplete: 0, availableDoors: 0, knocked: 0, totalJa: 0, created: new Date() },
]

const DEMO_CAMPAIGN_GOALS: Record<string, CampaignGoalPayload> = {
  "c-nrc":  { campaign_id: "c-nrc",  period: "2026-08", doors_goal: 8000, recruited_goal: 200, doors_weekly_goal: 2000, recruited_weekly_goal: 50, can_edit: true, updated_at: null, updated_by_id: null },
  "c-nf":   { campaign_id: "c-nf",   period: "2026-08", doors_goal: 5000, recruited_goal: 150, doors_weekly_goal: null, recruited_weekly_goal: null, can_edit: true, updated_at: null, updated_by_id: null },
  "c-care": { campaign_id: "c-care", period: "2026-08", doors_goal: 0,    recruited_goal: 0,   doors_weekly_goal: null, recruited_weekly_goal: null, can_edit: true, updated_at: null, updated_by_id: null },
}

interface GoalCellsProps {
  monthly: number
  weekly: number | null
  goalTotal: number
  weeklyTotal: number | null
}

function GoalCells({ monthly, weekly, goalTotal, weeklyTotal }: GoalCellsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
      <div>
        <p className="text-[9px] font-sans uppercase tracking-wider text-ab-fg-4">Måned</p>
        <p className="text-ab-fg">
          {monthly > 0 ? monthly.toLocaleString("nb-NO") : <span className="text-ab-fg-4">—</span>}
        </p>
      </div>
      <div>
        <p className="text-[9px] font-sans uppercase tracking-wider text-ab-fg-4">Uke</p>
        <p className="text-ab-fg">
          {weekly != null && weekly > 0 ? weekly.toLocaleString("nb-NO") : <span className="text-ab-fg-4">—</span>}
        </p>
      </div>
    </div>
  )
}

interface TeamRowProps {
  team: TeamListItem
  goal: TeamGoalPayload | null
  loading: boolean
  onEdit: () => void
}

function TeamRow({ team, goal, loading, onEdit }: TeamRowProps) {
  const dGoal = goal?.doors_goal ?? 0
  const rGoal = goal?.recruited_goal ?? 0
  const dWk = goal?.doors_weekly_goal ?? null
  const rWk = goal?.recruited_weekly_goal ?? null
  const anyMonthly = dGoal > 0 || rGoal > 0
  // Show Rediger only when the server said the caller can write this row.
  // We surface the pill "Låst" instead of a dead pencil so the row still
  // reads clearly for viewers who lack permission.
  const canEdit = goal?.can_edit ?? false
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[minmax(0,1fr)_120px_120px_160px_100px] items-center gap-3 rounded-2xl border border-ab-line bg-ab-elevated px-4 py-3 hover:bg-white/[0.02] transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold text-white"
            style={{ background: team.color || "#3461FF" }}
          >
            {team.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ab-fg">{team.name}</p>
            <p className="truncate text-[10px] text-ab-fg-4">
              {team.campaign?.name ?? <span className="italic">Ingen prosjekt</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Dører */}
      <div>
        <p className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#8B5CF6]">Dører</p>
        <GoalCells monthly={dGoal} weekly={dWk} goalTotal={dGoal} weeklyTotal={dWk} />
      </div>

      {/* Rekruttert */}
      <div>
        <p className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#0E9384]">Rekruttert</p>
        <GoalCells monthly={rGoal} weekly={rWk} goalTotal={rGoal} weeklyTotal={rWk} />
      </div>

      {/* Status pill */}
      <div>
        {loading ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-ab-fg-4">Laster…</span>
        ) : anyMonthly ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" /> Satt
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-300 ring-1 ring-inset ring-rose-500/30">
            Ikke satt
          </span>
        )}
      </div>

      <div className="text-right">
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full border border-ab-line px-3 py-1.5 text-[11px] font-semibold text-ab-fg-2 transition-colors hover:border-aurora-amber/40 hover:text-ab-fg"
          >
            <Pencil className="h-3 w-3" />
            Rediger
          </button>
        ) : loading ? null : (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-ab-fg-4 ring-1 ring-inset ring-white/[0.08]">
            Låst
          </span>
        )}
      </div>
    </motion.div>
  )
}

interface CampaignRowProps {
  campaign: CampaignVM
  goal: CampaignGoalPayload | null
  loading: boolean
  onEdit: () => void
}

function CampaignRow({ campaign, goal, loading, onEdit }: CampaignRowProps) {
  const dGoal = goal?.doors_goal ?? 0
  const rGoal = goal?.recruited_goal ?? 0
  const dWk = goal?.doors_weekly_goal ?? null
  const rWk = goal?.recruited_weekly_goal ?? null
  const anyMonthly = dGoal > 0 || rGoal > 0
  const canEdit = goal?.can_edit ?? false
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[minmax(0,1fr)_120px_120px_160px_100px] items-center gap-3 rounded-2xl border border-ab-line bg-ab-elevated px-4 py-3 hover:bg-white/[0.02] transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: `linear-gradient(135deg, ${campaign.color}, ${campaign.color}88)` }}
          >
            <FolderOpen className="h-3.5 w-3.5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ab-fg">{campaign.name}</p>
            <p className="truncate text-[10px] text-ab-fg-4">
              {campaign.status === "active" ? "Aktiv" : campaign.status === "paused" ? "Pauset" : "Avsluttet"} · {campaign.employeeIds.length} promotør
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#8B5CF6]">Dører</p>
        <GoalCells monthly={dGoal} weekly={dWk} goalTotal={dGoal} weeklyTotal={dWk} />
      </div>

      <div>
        <p className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#0E9384]">Rekruttert</p>
        <GoalCells monthly={rGoal} weekly={rWk} goalTotal={rGoal} weeklyTotal={rWk} />
      </div>

      <div>
        {loading ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-ab-fg-4">Laster…</span>
        ) : anyMonthly ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" /> Satt
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-300 ring-1 ring-inset ring-rose-500/30">
            Ikke satt
          </span>
        )}
      </div>

      <div className="text-right">
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full border border-ab-line px-3 py-1.5 text-[11px] font-semibold text-ab-fg-2 transition-colors hover:border-aurora-amber/40 hover:text-ab-fg"
          >
            <Pencil className="h-3 w-3" />
            Rediger
          </button>
        ) : loading ? null : (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-ab-fg-4 ring-1 ring-inset ring-white/[0.08]">
            Låst
          </span>
        )}
      </div>
    </motion.div>
  )
}

export function MalInnstillinger() {
  const { t } = useLang()
  const { selectedCampaign } = useSelectedCampaign()

  const [period, setPeriod] = useState<string>(currentPeriod())
  const [teams, setTeams] = useState<TeamListItem[]>([])
  const [teamGoals, setTeamGoals] = useState<Record<string, TeamGoalPayload | null>>({})
  const [campaigns, setCampaigns] = useState<CampaignVM[]>([])
  const [campaignGoals, setCampaignGoals] = useState<Record<string, CampaignGoalPayload | null>>({})
  const [loading, setLoading] = useState(true)
  const [editTeam, setEditTeam] = useState<TeamListItem | null>(null)
  const [editCampaign, setEditCampaign] = useState<CampaignVM | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  // Optional: narrow by current selectedCampaign — hidden by default so admin
  // sees everything, but if the app has a campaign selected, we default to that.
  const [filterCurrentCampaignOnly, setFilterCurrentCampaignOnly] = useState(false)

  // Load teams + campaigns
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    if (DEMO_MODE) {
      const ts = filterCurrentCampaignOnly && selectedCampaign?.id
        ? DEMO_TEAMS.filter((t) => t.campaign?.id === selectedCampaign.id)
        : DEMO_TEAMS
      setTeams(ts)
      setCampaigns(DEMO_CAMPAIGNS)
      setLoading(false)
      return
    }
    Promise.all([
      listTeams({ pageSize: 100, campaignId: filterCurrentCampaignOnly ? selectedCampaign?.id : undefined })
        .then((r) => r.results)
        .catch(() => [] as TeamListItem[]),
      fetchCampaignsWithStats("active").catch(() => [] as CampaignVM[]),
    ]).then(([ts, cs]) => {
      if (cancelled) return
      setTeams(ts)
      setCampaigns(cs)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [filterCurrentCampaignOnly, selectedCampaign?.id, reloadTick])

  // Load team goals per team (parallel)
  useEffect(() => {
    if (teams.length === 0) { setTeamGoals({}); return }
    let cancelled = false
    if (DEMO_MODE) {
      setTeamGoals(Object.fromEntries(teams.map((t) => [t.id, DEMO_TEAM_GOALS[t.id] ?? null])))
      return
    }
    Promise.all(teams.map((t) =>
      fetchTeamGoal(t.id, { period }).then((g) => [t.id, g] as const).catch(() => [t.id, null] as const)
    )).then((rows) => {
      if (cancelled) return
      setTeamGoals(Object.fromEntries(rows))
    })
    return () => { cancelled = true }
  }, [teams, period, reloadTick])

  // Load campaign goals per campaign (parallel)
  useEffect(() => {
    if (campaigns.length === 0) { setCampaignGoals({}); return }
    let cancelled = false
    if (DEMO_MODE) {
      setCampaignGoals(Object.fromEntries(campaigns.map((c) => [c.id, DEMO_CAMPAIGN_GOALS[c.id] ?? null])))
      return
    }
    Promise.all(campaigns.map((c) =>
      fetchCampaignGoal(c.id, { period }).then((g) => [c.id, g] as const).catch(() => [c.id, null] as const)
    )).then((rows) => {
      if (cancelled) return
      setCampaignGoals(Object.fromEntries(rows))
    })
    return () => { cancelled = true }
  }, [campaigns, period, reloadTick])

  // Filter campaigns to those referenced by the caller's visible teams.
  // For admin this is a no-op (they see all teams → all campaigns end up in
  // the set); for a chief with 4 teams on 1 campaign, only that one shows.
  const visibleCampaigns = useMemo(() => {
    const visibleIds = new Set(teams.map((t) => t.campaign?.id).filter((x): x is string => Boolean(x)))
    if (visibleIds.size === 0) return [] as CampaignVM[]
    return campaigns.filter((c) => visibleIds.has(c.id))
  }, [teams, campaigns])

  // Group teams by sales chief
  const groupedTeams = useMemo(() => {
    const groups = new Map<string, { chiefName: string; chiefId: string; teams: TeamListItem[] }>()
    const noChief: TeamListItem[] = []
    for (const t of teams) {
      const chief = t.sales_chief
      if (chief && chief.id) {
        const key = chief.id
        if (!groups.has(key)) groups.set(key, { chiefName: chief.name || "—", chiefId: key, teams: [] })
        groups.get(key)!.teams.push(t)
      } else {
        noChief.push(t)
      }
    }
    // Sort chief groups by name, teams within a group by name.
    const sorted = Array.from(groups.values())
      .map((g) => ({ ...g, teams: [...g.teams].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.chiefName.localeCompare(b.chiefName))
    return { groups: sorted, noChief: noChief.sort((a, b) => a.name.localeCompare(b.name)) }
  }, [teams])

  const totalTeams = teams.length
  const setTeams_ = teams.filter((t) => {
    const g = teamGoals[t.id]
    return g && (g.doors_goal > 0 || g.recruited_goal > 0)
  }).length
  const totalCampaigns = visibleCampaigns.length
  const setCampaigns_ = visibleCampaigns.filter((c) => {
    const g = campaignGoals[c.id]
    return g && (g.doors_goal > 0 || g.recruited_goal > 0)
  }).length

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-aurora-amber/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-aurora-sunrise/[0.05] blur-[100px]" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-ab-line bg-ab-elevated px-6 sm:px-8 py-6"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-ab-fg-3 flex items-center gap-2">
                <Target className="h-3 w-3 text-aurora-amber" />
                {t("Mål-innstillinger")}
              </p>
              <h1 className="mt-2 font-instrument text-3xl sm:text-5xl leading-[1.02] text-ab-fg">
                Sett mål for <span className="italic text-aurora-amber">alle team og prosjekter</span>
              </h1>
              <p className="mt-2 text-sm text-ab-fg-3">
                {t("Månedlige og ukentlige mål — grupperte per salgssjef, med separat seksjon for prosjekter.")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-ab-fg-3" />
              <MonthPicker value={period} onChange={setPeriod} />
            </div>
          </div>

          {/* Summary strip */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryPill label="Team totalt" value={totalTeams} />
            <SummaryPill label="Team med mål" value={setTeams_} accent="ok" />
            <SummaryPill label="Prosjekter totalt" value={totalCampaigns} />
            <SummaryPill label="Prosjekter med mål" value={setCampaigns_} accent="ok" />
          </div>

          {/* Filter */}
          {selectedCampaign?.id && (
            <div className="mt-4 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-ab-fg-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterCurrentCampaignOnly}
                  onChange={(e) => setFilterCurrentCampaignOnly(e.target.checked)}
                  className="rounded border-ab-line bg-white/[0.03] text-aurora-amber focus:ring-aurora-amber/40"
                />
                Vis kun teams i valgt prosjekt ({selectedCampaign.name})
              </label>
            </div>
          )}
        </motion.div>

        {/* Teams — grouped by sales chief */}
        <div className="space-y-8">
          <SectionHeader label={t("Teams — gruppert per salgssjef")} accent="teamleder" />

          {loading && (
            <div className="rounded-2xl border border-dashed border-ab-line-1 bg-white/[0.02] px-6 py-12 text-center text-xs text-ab-fg-3">
              Laster team og mål…
            </div>
          )}

          {!loading && teams.length === 0 && (
            <div className="rounded-2xl border border-dashed border-ab-line-1 bg-white/[0.02] px-6 py-12 text-center text-xs text-ab-fg-3">
              Ingen team synlige for deg.
            </div>
          )}

          {!loading && groupedTeams.groups.map((group) => (
            <div key={group.chiefId} className="space-y-3">
              <div className="flex items-center gap-2 pl-4">
                <Users className="h-3.5 w-3.5 text-aurora-amber" />
                <p className="text-[11px] uppercase tracking-widest text-ab-fg-2 font-semibold">
                  {group.chiefName}
                </p>
                <span className="text-[10px] text-ab-fg-4">
                  · {group.teams.length} {group.teams.length === 1 ? "team" : "team"}
                </span>
              </div>
              <div className="space-y-2">
                {group.teams.map((tm) => (
                  <TeamRow
                    key={tm.id}
                    team={tm}
                    goal={teamGoals[tm.id] ?? null}
                    loading={!(tm.id in teamGoals)}
                    onEdit={() => setEditTeam(tm)}
                  />
                ))}
              </div>
            </div>
          ))}

          {!loading && groupedTeams.noChief.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pl-4">
                <Users className="h-3.5 w-3.5 text-ab-fg-4" />
                <p className="text-[11px] uppercase tracking-widest text-ab-fg-3 font-semibold">
                  Ingen salgssjef
                </p>
                <span className="text-[10px] text-ab-fg-4">· {groupedTeams.noChief.length}</span>
              </div>
              <div className="space-y-2">
                {groupedTeams.noChief.map((tm) => (
                  <TeamRow
                    key={tm.id}
                    team={tm}
                    goal={teamGoals[tm.id] ?? null}
                    loading={!(tm.id in teamGoals)}
                    onEdit={() => setEditTeam(tm)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Campaigns — filtered to those the caller's teams actually run on */}
        <div className="space-y-3">
          <SectionHeader label={t("Prosjekter")} accent="teamleder" />
          {loading && visibleCampaigns.length === 0 ? null : visibleCampaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ab-line-1 bg-white/[0.02] px-6 py-8 text-center text-xs text-ab-fg-3">
              Ingen prosjekter knyttet til teamene dine.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleCampaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  goal={campaignGoals[c.id] ?? null}
                  loading={!(c.id in campaignGoals)}
                  onEdit={() => setEditCampaign(c)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team edit modal */}
      {editTeam && (
        <SetTeamGoalModal
          teamId={editTeam.id}
          teamName={editTeam.name}
          period={period}
          initialDoorsGoal={teamGoals[editTeam.id]?.doors_goal ?? 0}
          initialRecruitedGoal={teamGoals[editTeam.id]?.recruited_goal ?? 0}
          initialDoorsWeeklyGoal={teamGoals[editTeam.id]?.doors_weekly_goal ?? null}
          initialRecruitedWeeklyGoal={teamGoals[editTeam.id]?.recruited_weekly_goal ?? null}
          onClose={() => setEditTeam(null)}
          onSaved={() => {
            setEditTeam(null)
            setReloadTick((n) => n + 1)
          }}
        />
      )}

      {/* Campaign edit modal */}
      {editCampaign && (
        <SetCampaignGoalModal
          campaignId={editCampaign.id}
          campaignName={editCampaign.name}
          period={period}
          initialDoorsGoal={campaignGoals[editCampaign.id]?.doors_goal ?? 0}
          initialRecruitedGoal={campaignGoals[editCampaign.id]?.recruited_goal ?? 0}
          initialDoorsWeeklyGoal={campaignGoals[editCampaign.id]?.doors_weekly_goal ?? null}
          initialRecruitedWeeklyGoal={campaignGoals[editCampaign.id]?.recruited_weekly_goal ?? null}
          onClose={() => setEditCampaign(null)}
          onSaved={() => {
            setEditCampaign(null)
            setReloadTick((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function SummaryPill({ label, value, accent }: { label: string; value: number; accent?: "ok" }) {
  return (
    <div className="rounded-2xl border border-ab-line bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ab-fg-4">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold tracking-tight ${accent === "ok" ? "text-emerald-300" : "text-ab-fg"}`}>
        {value.toLocaleString("nb-NO")}
      </p>
    </div>
  )
}
