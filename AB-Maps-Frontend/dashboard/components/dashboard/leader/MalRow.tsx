"use client"

import { useEffect, useState } from "react"
import { Users, DoorOpen, Zap, UserPlus, FolderOpen, Pencil } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { useSelectedCampaign } from "@/components/campaign/CampaignGuard"
import { fetchGoalsSummary, currentPeriod, type GoalsSummary } from "@/lib/api/salary"
import { fetchEmployeeDoors } from "@/lib/api/dashboardOverview"
import { fetchCampaignGoal, type CampaignGoalPayload } from "@/lib/api/campaigns"
import { SetCampaignGoalModal } from "./SetCampaignGoalModal"
import { GoalCard, makeSparkline } from "./MalCardKit"

// ─────────────────────────────────────────────────────────────────────────────
// MÅL MÅNED + MÅL UKE — Salgsleder version (2026-08-06)
// Aggregated across all teams the caller can see. See PromoterMalRow for the
// employee-scoped variant matching the Promotør sketch.
// ─────────────────────────────────────────────────────────────────────────────

interface MalRowProps {
  period?: string
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

export function MalRow({ period }: MalRowProps) {
  const { t } = useLang()
  const { selectedCampaign } = useSelectedCampaign()
  const campaignId = selectedCampaign?.id
  const activePeriod = period ?? currentPeriod()

  const [goals, setGoals] = useState<GoalsSummary | null>(null)
  const [doorsMonth, setDoorsMonth] = useState<number>(0)
  const [doorsToday, setDoorsToday] = useState<number>(0)
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading")
  const [campaignGoal, setCampaignGoal] = useState<CampaignGoalPayload | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    const [y, m] = activePeriod.split("-").map(Number)
    const monthPeriod = `${y}-${String(m).padStart(2, "0")}`

    if (DEMO_MODE) {
      // Mock EXACTLY the design's headline numbers so the client demo matches.
      setGoals({
        period: monthPeriod,
        team_count: 3,
        campaign_count: 1,
        monthly: { recruited_goal: 700, recruited_actual: 104, doors_goal: 2000 },
        weekly: { recruited_goal: 175, recruited_actual: 24, doors_goal: 500 },
        campaign_monthly: { recruited_goal: 2000, recruited_actual: 1400, doors_goal: 8000 },
        campaign_weekly: { recruited_goal: 500, recruited_actual: 200, doors_goal: 2000 },
        per_team: [],
        per_campaign: [],
      })
      setDoorsMonth(1640)
      setDoorsToday(273)
      setStatus("ok")
      return
    }

    Promise.all([
      fetchGoalsSummary({ period: monthPeriod }).catch(() => null),
      fetchEmployeeDoors({ period: monthPeriod, campaignId }).catch(() => null),
      campaignId
        ? fetchCampaignGoal(campaignId, { period: monthPeriod }).catch(() => null)
        : Promise.resolve(null),
    ]).then(([g, d, cg]) => {
      if (cancelled) return
      if (!g) { setStatus("unavailable"); return }
      setGoals(g)
      setDoorsMonth((d?.doors_by_employee ?? []).reduce((s, r) => s + r.doors, 0))
      setCampaignGoal(cg)
      setStatus("ok")
    })

    return () => { cancelled = true }
  }, [activePeriod, campaignId, reloadTick])

  if (status !== "ok" || !goals) return null

  const monthly = goals.monthly
  const weekly = goals.weekly
  const campaignMonthly = goals.campaign_monthly
  const campaignWeekly = goals.campaign_weekly
  const anyTeamGoal = monthly.doors_goal > 0 || monthly.recruited_goal > 0
  const anyCampaignMonthly =
    campaignMonthly.doors_goal > 0 || campaignMonthly.recruited_goal > 0
  const anyMonthlyGoal = anyTeamGoal || anyCampaignMonthly

  if (!anyMonthlyGoal && !DEMO_MODE) {
    return (
      <div className="space-y-3">
        <p className="pl-4 text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål måned")}</p>
        <div className="rounded-2xl border border-dashed border-ab-line-1 bg-white/[0.02] px-6 py-8 text-center text-xs text-ab-fg-3">
          {t("Ingen team- eller prosjektmål satt for denne måneden.")} <br />
          <span className="text-ab-fg-4">
            {t("Klikk blyanten på et team eller prosjekt for å sette mål.")}
          </span>
        </div>
      </div>
    )
  }

  // Sparkline data — real trend endpoint TBD. In DEMO we generate smooth waves
  // per card. In real mode we skip (undefined) — card just doesn't draw one.
  const spark = (seed: number, base: number, amp: number) => DEMO_MODE ? makeSparkline(seed, 24, base, amp) : undefined

  // Show a weekly card whenever the goal is set OR there's meaningful actual
  // activity in the last 7 days. Goal-less cards render as pure "X i uken"
  // counters without the /N fraction.
  const showTeamWeeklyDoors = (weekly.doors_goal ?? 0) > 0
  const showTeamWeeklyRecruited = (weekly.recruited_goal ?? 0) > 0 || weekly.recruited_actual > 0
  const showCampaignWeeklyDoors = (campaignWeekly.doors_goal ?? 0) > 0
  const showCampaignWeeklyRecruited =
    (campaignWeekly.recruited_goal ?? 0) > 0 || campaignWeekly.recruited_actual > 0
  const anyWeeklyCard =
    showTeamWeeklyDoors || showTeamWeeklyRecruited || showCampaignWeeklyDoors || showCampaignWeeklyRecruited

  return (
    <div className="space-y-6">
      {/* ═════════════════ MÅL MÅNED ═════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pl-4 pr-1">
          <p className="text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål måned")}</p>
          {campaignGoal?.can_edit && campaignId && selectedCampaign?.name && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-ab-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ab-fg-3 transition-colors hover:border-aurora-amber/40 hover:text-ab-fg"
              title={t("Sett prosjekt-mål")}
            >
              <Pencil className="h-3 w-3" />
              {t("Prosjekt-mål")}
            </button>
          )}
        </div>
        {/* 4-column × 2-row grid on desktop: hero fills cols 1-2 (both rows),
            the 4 small cards fill the remaining 2×2 area on the right. Collapses
            to a single column on mobile. Cards render only when their data
            source is real — no fake numbers in prod. */}
        <div className="grid grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 gap-3">
          {/* Hero — Antall givere team (2×2) */}
          <GoalCard
            label={t("Antall givere team")}
            value={monthly.recruited_actual}
            goal={monthly.recruited_goal}
            accent="#0E9384"
            icon={<Users className="h-3.5 w-3.5" />}
            sparkline={spark(1, 50, 30)}
            hero
            caption={goals.team_count > 0 ? t("Sum for alle") + ` ${goals.team_count} ` + t("teamene — månedens hovedmål") : undefined}
          />
          <GoalCard
            label={t("Dører banket")}
            value={doorsMonth}
            goal={monthly.doors_goal}
            accent="#8B5CF6"
            icon={<DoorOpen className="h-3.5 w-3.5" />}
            sparkline={spark(2, 60, 20)}
          />
          {/* Prosjekt (campaign) monthly recruits — real from CampaignGoal */}
          {(anyCampaignMonthly || DEMO_MODE) && (
            <GoalCard
              label={t("Givere prosjekt")}
              value={campaignMonthly.recruited_actual}
              goal={campaignMonthly.recruited_goal}
              accent="#F59E0B"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              sparkline={spark(4, 55, 25)}
            />
          )}
          {/* Prosjekt doors — real from CampaignGoal */}
          {(campaignMonthly.doors_goal > 0 || DEMO_MODE) && (
            <GoalCard
              label={t("Dører prosjekt")}
              value={0}
              goal={campaignMonthly.doors_goal}
              accent="#3461FF"
              icon={<UserPlus className="h-3.5 w-3.5" />}
              sparkline={spark(3, 50, 25)}
            />
          )}
          {/* Today card — real once we have the today endpoint; hidden if 0 in prod */}
          {(DEMO_MODE || doorsToday > 0) && (
            <GoalCard
              label={t("Team i dag")}
              value={doorsToday}
              goal={0}
              suffix={t("dører")}
              accent="#F43F5E"
              icon={<Zap className="h-3.5 w-3.5" />}
              sparkline={spark(5, 45, 30)}
            />
          )}
        </div>
      </div>

      {/* Campaign-goal editor modal — HR-staff only (server enforces via can_edit) */}
      {modalOpen && campaignId && selectedCampaign?.name && (
        <SetCampaignGoalModal
          campaignId={campaignId}
          campaignName={selectedCampaign.name}
          period={activePeriod}
          initialDoorsGoal={campaignGoal?.doors_goal ?? 0}
          initialRecruitedGoal={campaignGoal?.recruited_goal ?? 0}
          initialDoorsWeeklyGoal={campaignGoal?.doors_weekly_goal ?? null}
          initialRecruitedWeeklyGoal={campaignGoal?.recruited_weekly_goal ?? null}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            setReloadTick((n) => n + 1)  // refresh goals summary + campaign goal
          }}
        />
      )}

      {/* ═════════════════ MÅL UKE ═════════════════ */}
      {(anyWeeklyCard || DEMO_MODE) && (
        <div className="space-y-3">
          <p className="pl-4 text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål uke")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {(showTeamWeeklyDoors || DEMO_MODE) && (
              <GoalCard
                label={t("Dører banket")}
                value={0}
                goal={weekly.doors_goal ?? 0}
                accent="#8B5CF6"
                icon={<DoorOpen className="h-3.5 w-3.5" />}
                sparkline={spark(6, 45, 25)}
              />
            )}
            {(showTeamWeeklyRecruited || DEMO_MODE) && (
              <GoalCard
                label={t("Givere team")}
                value={weekly.recruited_actual}
                goal={weekly.recruited_goal ?? 0}
                accent="#0E9384"
                icon={<Users className="h-3.5 w-3.5" />}
                sparkline={spark(8, 55, 25)}
              />
            )}
            {(showCampaignWeeklyDoors || DEMO_MODE) && (
              <GoalCard
                label={t("Dører prosjekt")}
                value={0}
                goal={campaignWeekly.doors_goal ?? 0}
                accent="#3461FF"
                icon={<UserPlus className="h-3.5 w-3.5" />}
                sparkline={spark(7, 50, 20)}
              />
            )}
            {(showCampaignWeeklyRecruited || DEMO_MODE) && (
              <GoalCard
                label={t("Givere prosjekt")}
                value={campaignWeekly.recruited_actual}
                goal={campaignWeekly.recruited_goal ?? 0}
                accent="#F59E0B"
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                sparkline={spark(9, 60, 20)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
