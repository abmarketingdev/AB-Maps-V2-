"use client"

import { useEffect, useState } from "react"
import { CalendarClock, X } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { useAuth } from "@/lib/auth/AuthContext"
import { fetchTeamGoal, type TeamGoalPayload } from "@/lib/api/teams"

/**
 * Visual "goal not set" nudges (2026-08-12). For the current period, checks the
 * caller's teams and shows a dismissible banner when a DAILY or WEEKLY goal is
 * missing on any team the user can edit. "Sett nå" opens GoalQuickSet focused on
 * that period. Dismissed at most once per calendar day (localStorage).
 */

interface GoalPromptsProps {
  teams: { id: string; name: string }[]
  period: string
  refreshTick?: number
  onSet: (focus: "daily" | "weekly") => void
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function GoalPrompts({ teams, period, refreshTick, onSet }: GoalPromptsProps) {
  const { t } = useLang()
  const { user } = useAuth()
  const [dailyUnset, setDailyUnset] = useState(false)
  const [weeklyUnset, setWeeklyUnset] = useState(false)
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    if (!teams.length) { setDailyUnset(false); setWeeklyUnset(false); return }
    Promise.all(teams.map((tm) => fetchTeamGoal(tm.id, { period }).catch(() => null)))
      .then((rows) => {
        if (!alive) return
        const editable = rows.filter((g): g is TeamGoalPayload => !!g && g.can_edit)
        // Unset = at least one editable team is missing that period's sub-goal.
        setDailyUnset(editable.some((g) => g.doors_daily_goal == null && g.recruited_daily_goal == null))
        setWeeklyUnset(editable.some((g) => g.doors_weekly_goal == null && g.recruited_weekly_goal == null))
      })
    return () => { alive = false }
  }, [teams, period, refreshTick])

  useEffect(() => {
    if (!user?.user_id) return
    const next: Record<string, boolean> = {}
    for (const k of ["daily", "weekly"]) {
      try {
        if (localStorage.getItem(`abmap:goalprompt:${user.user_id}:${k}:${todayIso()}`)) next[k] = true
      } catch { /* private mode */ }
    }
    setDismissed(next)
  }, [user?.user_id])

  function dismiss(k: "daily" | "weekly") {
    setDismissed((prev) => ({ ...prev, [k]: true }))
    if (user?.user_id) {
      try { localStorage.setItem(`abmap:goalprompt:${user.user_id}:${k}:${todayIso()}`, "1") } catch { /* no-op */ }
    }
  }

  const show: Array<{ k: "daily" | "weekly"; label: string; sub: string }> = []
  if (dailyUnset && !dismissed.daily) show.push({ k: "daily", label: t("Dagens mål mangler"), sub: t("Sett et dagsmål for teamet ditt — tar 10 sekunder.") })
  if (weeklyUnset && !dismissed.weekly) show.push({ k: "weekly", label: t("Ukesmål mangler"), sub: t("Sett et ukesmål for teamet ditt.") })
  if (show.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {show.map(({ k, label, sub }) => (
        <div key={k} className="flex items-center gap-3 rounded-xl border border-aurora-amber/30 bg-aurora-amber/[0.06] px-4 py-3">
          <CalendarClock className="h-4 w-4 shrink-0 text-aurora-amber" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ab-fg">{label}</p>
            <p className="text-xs text-ab-fg-3">{sub}</p>
          </div>
          <button type="button" onClick={() => onSet(k)}
            className="shrink-0 rounded-full bg-aurora-amber px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-aurora-amber/90">
            {t("Sett nå")}
          </button>
          <button type="button" onClick={() => dismiss(k)} aria-label={t("Lukk")}
            className="shrink-0 rounded-lg p-1 text-ab-fg-4 hover:text-ab-fg">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
