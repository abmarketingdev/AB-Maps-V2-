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
import { WeekPicker, LIVE_WEEK, defaultWeekForPeriod } from "./WeekPicker"

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
  // Week selection lives with MalRow — it only affects the weekly section,
  // no need to plumb through the whole dashboard. Defaults to "denne uken"
  // (rolling last-7-days) for the current month, or the last overlapping ISO
  // week for past months.
  const [week, setWeek] = useState<string>(() => defaultWeekForPeriod(activePeriod))
  // When the period changes (user picks a different month), reset the week
  // selection so it stays sensible (denne uken for current, last ISO week
  // for past — see defaultWeekForPeriod).
  useEffect(() => { setWeek(defaultWeekForPeriod(activePeriod)) }, [activePeriod])

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

    // Weekly `week` — empty string when LIVE_WEEK so backend falls back to
    // rolling last-7-days (its existing default), else pass the ISO week id.
    const weekParam = week === LIVE_WEEK ? undefined : week

    Promise.all([
      fetchGoalsSummary({ period: monthPeriod, week: weekParam }).catch(() => null),
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
  }, [activePeriod, campaignId, week, reloadTick])

  if (status !== "ok" || !goals) return null

  const monthly = goals.monthly
  const weekly = goals.weekly
  const campaignMonthly = goals.campaign_monthly
  const campaignWeekly = goals.campaign_weekly
  // Note: previously we hid the whole section behind an "any goal set" empty
  // state. Removed 2026-08-06 per user ask — always render cards; "?" fills
  // any missing goal so leaders see honestly what's known vs. unset.

  // Sparkline data — real trend endpoint TBD. In DEMO we generate smooth waves
  // per card. In real mode we skip (undefined) — card just doesn't draw one.
  const spark = (seed: number, base: number, amp: number) => DEMO_MODE ? makeSparkline(seed, 24, base, amp) : undefined

  // Cards always render now — GoalCard handles null goal / null value as
  // "?", so no conditional-show gymnastics here.

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
            the 4 small cards fill the remaining 2×2 area on the right. Cards
            always render — where a goal isn't set we pass null to GoalCard so
            it renders "value/?" instead of hiding the slot. */}
        <div className="grid grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 gap-3">
          {/* Hero — Antall givere team (2×2) */}
          <GoalCard
            label={t("Antall givere team")}
            value={monthly.recruited_actual}
            goal={monthly.recruited_goal > 0 ? monthly.recruited_goal : null}
            accent="#0E9384"
            icon={<Users className="h-3.5 w-3.5" />}
            sparkline={spark(1, 50, 30)}
            hero
            caption={goals.team_count > 0 ? t("Sum for alle") + ` ${goals.team_count} ` + t("teamene — månedens hovedmål") : undefined}
          />
          <GoalCard
            label={t("Dører banket")}
            value={doorsMonth}
            goal={monthly.doors_goal > 0 ? monthly.doors_goal : null}
            accent="#8B5CF6"
            icon={<DoorOpen className="h-3.5 w-3.5" />}
            sparkline={spark(2, 60, 20)}
          />
          {/* Prosjekt (campaign) monthly recruits */}
          <GoalCard
            label={t("Givere prosjekt")}
            value={campaignMonthly.recruited_actual}
            goal={campaignMonthly.recruited_goal > 0 ? campaignMonthly.recruited_goal : null}
            accent="#F59E0B"
            icon={<FolderOpen className="h-3.5 w-3.5" />}
            sparkline={spark(4, 55, 25)}
          />
          {/* Prosjekt doors — actuals from analytics not wired yet, so value=null → "?" */}
          <GoalCard
            label={t("Dører prosjekt")}
            value={null}
            goal={campaignMonthly.doors_goal > 0 ? campaignMonthly.doors_goal : null}
            accent="#3461FF"
            icon={<UserPlus className="h-3.5 w-3.5" />}
            sparkline={spark(3, 50, 25)}
          />
          {/* Team i dag — pure count, no goal slot (goal=0 hides the /N) */}
          <GoalCard
            label={t("Team i dag")}
            value={doorsToday}
            goal={0}
            suffix={t("dører")}
            accent="#F43F5E"
            icon={<Zap className="h-3.5 w-3.5" />}
            sparkline={spark(5, 45, 30)}
          />
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

      {/* ═════════════════ MÅL UKE ═════════════════
          Now week-selectable via WeekPicker — works for any month, not just
          current. Cards always render, "?" fills any missing number so
          leaders see honestly what's known vs. unknown. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 pl-4 pr-1 flex-wrap">
          <p className="text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål uke")}</p>
          <WeekPicker period={activePeriod} value={week} onChange={setWeek} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Dører banket (team) — doors weekly actual not computed yet
              (analytics owns knock data); render "?" so it's honest. */}
          <GoalCard
            label={t("Dører banket")}
            value={null}
            goal={weekly.doors_goal ?? null}
            accent="#8B5CF6"
            icon={<DoorOpen className="h-3.5 w-3.5" />}
            sparkline={spark(6, 45, 25)}
          />
          <GoalCard
            label={t("Givere team")}
            value={weekly.recruited_actual}
            goal={weekly.recruited_goal ?? null}
            accent="#0E9384"
            icon={<Users className="h-3.5 w-3.5" />}
            sparkline={spark(8, 55, 25)}
          />
          <GoalCard
            label={t("Dører prosjekt")}
            value={null}
            goal={campaignWeekly.doors_goal ?? null}
            accent="#3461FF"
            icon={<UserPlus className="h-3.5 w-3.5" />}
            sparkline={spark(7, 50, 20)}
          />
          <GoalCard
            label={t("Givere prosjekt")}
            value={campaignWeekly.recruited_actual}
            goal={campaignWeekly.recruited_goal ?? null}
            accent="#F59E0B"
            icon={<FolderOpen className="h-3.5 w-3.5" />}
            sparkline={spark(9, 60, 20)}
          />
        </div>
      </div>
    </div>
  )
}
