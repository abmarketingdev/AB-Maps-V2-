"use client"

import { useEffect, useState } from "react"
import { DoorOpen, UserPlus, Users, FolderOpen } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { fetchMyGoals, currentPeriod, type MyGoalsPayload } from "@/lib/api/salary"
import { fetchEmployeeDoors } from "@/lib/api/dashboardOverview"
import { GoalCard, makeSparkline } from "./MalCardKit"

// ─────────────────────────────────────────────────────────────────────────────
// PromoterMalRow — MÅL MÅNED + MÅL UKE for the Promotør dashboard.
// Matches boss's sketch (2026-08-06): 4 monthly cards + 4 weekly cards.
//   1. Dører banket    (personal — real; goal via /doors-by-period/ TBD)
//   2. Antall givere   (personal recruits — real; goal = din andel of team goal)
//   3. Antall givere team    (team aggregate — real)
//   4. Antall givere prosjekt (campaign aggregate — real)
// ─────────────────────────────────────────────────────────────────────────────

interface PromoterMalRowProps {
  period?: string
  campaignId?: string
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

export function PromoterMalRow({ period, campaignId }: PromoterMalRowProps) {
  const { t } = useLang()
  const activePeriod = period ?? currentPeriod()

  const [my, setMy] = useState<MyGoalsPayload | null>(null)
  const [personalDoors, setPersonalDoors] = useState<number>(0)
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")

    if (DEMO_MODE) {
      // Mock the sketch numbers exactly so client demo matches.
      setMy({
        period: activePeriod,
        team: { team_id: "demo-team", team_name: "Oslo Nord", member_count: 5 },
        campaign_id: "demo-campaign",
        week_window: { start: "2026-07-31", end: "2026-08-06" },
        personal: {
          recruited_monthly: 60,
          recruited_weekly: 15,
          recruited_goal_share_monthly: 100,
          recruited_goal_share_weekly: 25,
        },
        team_goals: {
          recruited_goal: 700, recruited_actual: 400, doors_goal: 2000,
          recruited_weekly_goal: 175, recruited_weekly_actual: 100, doors_weekly_goal: 500,
        },
        campaign_goals: {
          recruited_goal: 2000, recruited_actual: 1400, doors_goal: 8000,
          recruited_weekly_goal: 500, recruited_weekly_actual: 200, doors_weekly_goal: 2000,
        },
      })
      setPersonalDoors(1400)
      setStatus("ok")
      return
    }

    Promise.all([
      fetchMyGoals({ period: activePeriod }).catch(() => null),
      // Personal doors from analytics — filtered to just this user's ab_id happens
      // server-side (employees are auto-scoped to self on doors-by-period).
      fetchEmployeeDoors({ period: activePeriod, campaignId }).catch(() => null),
    ]).then(([g, d]) => {
      if (cancelled) return
      if (!g) { setStatus("unavailable"); return }
      setMy(g)
      // Employees hitting this endpoint receive only their own row.
      setPersonalDoors((d?.doors_by_employee ?? []).reduce((s, r) => s + r.doors, 0))
      setStatus("ok")
    })

    return () => { cancelled = true }
  }, [activePeriod, campaignId])

  if (status !== "ok" || !my) return null

  const spark = (seed: number, base: number, amp: number) => makeSparkline(seed, 24, base, amp)

  const p = my.personal
  const tg = my.team_goals
  const cg = my.campaign_goals

  // If nothing is set anywhere and no personal activity, hide entirely.
  const anySignal =
    p.recruited_monthly > 0 || p.recruited_weekly > 0 ||
    tg.recruited_goal > 0 || tg.doors_goal > 0 ||
    cg.recruited_goal > 0 || cg.doors_goal > 0 || personalDoors > 0
  if (!anySignal && !DEMO_MODE) return null

  const showWeekly =
    (tg.recruited_weekly_goal ?? 0) > 0 || (tg.doors_weekly_goal ?? 0) > 0 ||
    (cg.recruited_weekly_goal ?? 0) > 0 || (cg.doors_weekly_goal ?? 0) > 0 ||
    p.recruited_weekly > 0 || DEMO_MODE

  return (
    <div className="space-y-6">
      {/* ═════════════════ MÅL MÅNED ═════════════════ */}
      <div className="space-y-3">
        <p className="pl-4 text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål måned")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Personal doors */}
          <GoalCard
            label={t("Dører banket")}
            value={personalDoors}
            goal={0}  /* no personal doors goal — hide the /N until PersonalGoal model exists */
            accent="#8B5CF6"
            icon={<DoorOpen className="h-3.5 w-3.5" />}
            sparkline={spark(11, 55, 25)}
            compact
          />
          {/* Personal recruits — with "din andel" derived goal */}
          <GoalCard
            label={t("Antall givere")}
            value={p.recruited_monthly}
            goal={p.recruited_goal_share_monthly ?? 0}
            accent="#3461FF"
            icon={<UserPlus className="h-3.5 w-3.5" />}
            sparkline={spark(12, 50, 20)}
            compact
            caption={p.recruited_goal_share_monthly ? t("din andel av teamets mål") : undefined}
          />
          {/* Team aggregate */}
          <GoalCard
            label={t("Antall givere team")}
            value={tg.recruited_actual}
            goal={tg.recruited_goal}
            accent="#0E9384"
            icon={<Users className="h-3.5 w-3.5" />}
            sparkline={spark(13, 55, 25)}
            compact
            caption={my.team?.team_name}
          />
          {/* Campaign aggregate */}
          <GoalCard
            label={t("Antall givere prosjekt")}
            value={cg.recruited_actual}
            goal={cg.recruited_goal}
            accent="#F59E0B"
            icon={<FolderOpen className="h-3.5 w-3.5" />}
            sparkline={spark(14, 60, 20)}
            compact
          />
        </div>
      </div>

      {/* ═════════════════ MÅL UKE ═════════════════ */}
      {showWeekly && (
        <div className="space-y-3">
          <p className="pl-4 text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål uke")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <GoalCard
              label={t("Dører banket")}
              value={0}
              goal={0}
              accent="#8B5CF6"
              icon={<DoorOpen className="h-3.5 w-3.5" />}
              sparkline={spark(21, 45, 25)}
              compact
            />
            <GoalCard
              label={t("Antall givere")}
              value={p.recruited_weekly}
              goal={p.recruited_goal_share_weekly ?? 0}
              accent="#3461FF"
              icon={<UserPlus className="h-3.5 w-3.5" />}
              sparkline={spark(22, 50, 20)}
              compact
              caption={p.recruited_goal_share_weekly ? t("din andel av ukesmål") : undefined}
            />
            <GoalCard
              label={t("Antall givere team")}
              value={tg.recruited_weekly_actual}
              goal={tg.recruited_weekly_goal ?? 0}
              accent="#0E9384"
              icon={<Users className="h-3.5 w-3.5" />}
              sparkline={spark(23, 55, 25)}
              compact
            />
            <GoalCard
              label={t("Antall givere prosjekt")}
              value={cg.recruited_weekly_actual}
              goal={cg.recruited_weekly_goal ?? 0}
              accent="#F59E0B"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              sparkline={spark(24, 60, 20)}
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}
