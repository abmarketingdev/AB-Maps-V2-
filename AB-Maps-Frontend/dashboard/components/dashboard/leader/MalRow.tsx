"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Users, DoorOpen, Zap, UserPlus } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { useSelectedCampaign } from "@/components/campaign/CampaignGuard"
import { fetchGoalsSummary, currentPeriod, type GoalsSummary } from "@/lib/api/salary"
import { fetchEmployeeDoors } from "@/lib/api/dashboardOverview"

// ─────────────────────────────────────────────────────────────────────────────
// MÅL MÅNED + MÅL UKE (2026-08-06)
// Backed by:
//   /api/hr/salary/goals-summary/          — team goals + recruited actual (hr-service)
//   /api/dashboard/v2/employees/doors-by-period/  — actual doors (analytics-service)
// Weekly figures = monthly ÷ 4 for the goal; actual = last-7-days doors slice.
// Cards HIDE themselves gracefully when no goals are set (empty state) rather
// than showing 0/0.
// ─────────────────────────────────────────────────────────────────────────────

interface MalRowProps {
  /** YYYY-MM. When omitted, defaults to current month. */
  period?: string
}

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

// Simple SVG sparkline — 0 dependencies, mobile-friendly.
function Sparkline({ points, color, height = 32 }: { points: number[]; color: string; height?: number }) {
  if (points.length < 2) return null
  const width = 100
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const path = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(" ")
  const area = `${path} L ${width} ${height} L 0 ${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
      <path d={area} fill={hexAlpha(color, 0.15)} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

interface GoalCardProps {
  label: string
  value: number
  goal: number
  suffix?: string
  accent: string
  icon: React.ReactNode
  sparkline?: number[]
  hero?: boolean  // bigger card with more room
}

function GoalCard({ label, value, goal, suffix, accent, icon, sparkline, hero }: GoalCardProps) {
  const reduced = useReducedMotion()
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  const remaining = Math.max(0, goal - value)
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-5 sm:p-6 sm:transition-transform sm:duration-300 sm:hover:-translate-y-0.5 ${hero ? "sm:col-span-2 sm:row-span-2 min-h-[220px] flex flex-col" : ""}`}
      style={{
        boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 2px 0 rgba(0,0,0,0.25)`,
      }}
      whileHover={reduced ? {} : { boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.06), 0 0 0 1px ${accent}22, 0 12px 32px -12px ${accent}55` }}
    >
      {/* Persistent radial glow (desktop-only via sm: — mobile CSS override kills all blurs anyway) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-0 sm:opacity-70"
        style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)` }}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">{label}</p>
        <div
          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${accent}22, ${accent}0a)`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}22, 0 4px 12px -6px ${accent}55`,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value + goal fraction */}
      <div className={`relative mt-3 sm:mt-4 font-mono ${hero ? "text-4xl sm:text-6xl" : "text-2xl sm:text-[2rem]"} sm:leading-none font-bold tracking-tight`}>
        <span className="text-ab-fg">{value.toLocaleString("nb-NO")}</span>
        <span className="ml-1 text-lg sm:text-xl font-semibold text-ab-fg-4">/ {goal.toLocaleString("nb-NO")}</span>
        {suffix && <span className="ml-1 text-sm font-medium text-ab-fg-3">{suffix}</span>}
      </div>

      {/* Progress bar */}
      <div className="relative mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <motion.div
          initial={reduced ? false : { width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${hexAlpha(accent, 0.55)}, ${accent})`,
            boxShadow: `0 0 8px ${hexAlpha(accent, 0.5)}`,
          }}
        />
      </div>
      <div className="relative mt-1 flex justify-between text-[10px] font-mono tabular-nums text-ab-fg-4">
        <span>{pct}%</span>
        <span>{remaining.toLocaleString("nb-NO")} igjen</span>
      </div>

      {/* Sparkline at bottom — only when data available */}
      {sparkline && sparkline.length > 1 && (
        <div className={`relative mt-auto pt-3 ${hero ? "h-16" : "h-8"}`}>
          <Sparkline points={sparkline} color={accent} height={hero ? 60 : 32} />
        </div>
      )}
    </motion.div>
  )
}

// Simple stat tile with no goal (e.g., "Team i dag")
function StatCard({ label, value, suffix, accent, icon }: {
  label: string; value: number; suffix?: string; accent: string; icon: React.ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-5 sm:p-6 sm:transition-transform sm:duration-300 sm:hover:-translate-y-0.5"
      style={{ boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 2px 0 rgba(0,0,0,0.25)` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-0 sm:opacity-70"
        style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)` }}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">{label}</p>
        <div
          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${accent}22, ${accent}0a)`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}22, 0 4px 12px -6px ${accent}55`,
          }}
        >
          {icon}
        </div>
      </div>
      <div className="relative mt-3 sm:mt-4 font-mono text-2xl sm:text-[2rem] sm:leading-none font-bold tracking-tight">
        <span className="text-ab-fg">{value.toLocaleString("nb-NO")}</span>
        {suffix && <span className="ml-1 text-sm font-medium text-ab-fg-3">{suffix}</span>}
      </div>
    </motion.div>
  )
}

export function MalRow({ period }: MalRowProps) {
  const { t } = useLang()
  const { selectedCampaign } = useSelectedCampaign()
  const campaignId = selectedCampaign?.id
  const activePeriod = period ?? currentPeriod()

  const [goals, setGoals] = useState<GoalsSummary | null>(null)
  const [doorsMonth, setDoorsMonth] = useState<number>(0)
  const [doorsWeek, setDoorsWeek] = useState<number>(0)
  const [doorsToday, setDoorsToday] = useState<number>(0)
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")

    // Compute date windows for the actual-doors fetches.
    const [y, m] = activePeriod.split("-").map(Number)
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === y && (today.getMonth() + 1) === m
    const monthPeriod = `${y}-${String(m).padStart(2, "0")}`
    // For week + today figures we only use REAL live data when viewing the
    // current month — for past months, "this week" and "today" don't apply,
    // so we show 0 and let the UI hide those cards.

    Promise.all([
      fetchGoalsSummary({ period: monthPeriod }).catch(() => null),
      fetchEmployeeDoors({ period: monthPeriod, campaignId }).catch(() => null),
    ]).then(([g, d]) => {
      if (cancelled) return
      if (!g) { setStatus("unavailable"); return }
      setGoals(g)
      const monthDoors = (d?.doors_by_employee ?? []).reduce((s, r) => s + r.doors, 0)
      setDoorsMonth(monthDoors)
      setStatus("ok")
    })

    // Today's + this week's doors — only relevant when browsing current month.
    // Analytics doors endpoint accepts YYYY-MM (whole month), so we approximate
    // weekly = last 7 days by asking for the whole month then estimating; the
    // true "week/today" data would need a new endpoint. For now: weekly is
    // fraction of month doors proportional to elapsed days into the week.
    if (isCurrentMonth) {
      // Simple approximation: divide month total by (days elapsed) × 7 for week
      // Actual per-day slice would need a new backend param. Deferred.
      setDoorsToday(0)  // TODO: needs a per-day endpoint. Hidden below when 0.
      setDoorsWeek(0)   // TODO: needs a 7-day window endpoint. Hidden below when 0.
    } else {
      setDoorsToday(0)
      setDoorsWeek(0)
    }

    return () => { cancelled = true }
  }, [activePeriod, campaignId])

  if (status !== "ok" || !goals) return null

  const monthly = goals.monthly
  const anyMonthlyGoal = monthly.doors_goal > 0 || monthly.recruited_goal > 0
  if (!anyMonthlyGoal) {
    // No team leader has set goals for this period yet — show a soft hint.
    return (
      <div className="space-y-3">
        <p className="pl-4 text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål måned")}</p>
        <div className="rounded-2xl border border-dashed border-ab-line-1 bg-white/[0.02] px-6 py-8 text-center text-xs text-ab-fg-3">
          {t("Ingen team-mål satt for denne måneden.")} <br />
          <span className="text-ab-fg-4">{t("Klikk blyanten på et team-kort i seksjonen under for å sette mål.")}</span>
        </div>
      </div>
    )
  }

  // Weekly = monthly ÷ 4 (approximation until we get a per-week goal model).
  const weeklyRecruitedGoal = Math.round(monthly.recruited_goal / 4)
  const weeklyDoorsGoal = Math.round(monthly.doors_goal / 4)

  return (
    <div className="space-y-6">
      {/* ═════════════════ MÅL MÅNED ═════════════════ */}
      <div className="space-y-3">
        <p className="pl-4 text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål måned")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 gap-3">
          {/* Hero: Antall givere team (spans 2×2) */}
          <GoalCard
            label={t("Antall givere team")}
            value={monthly.recruited_actual}
            goal={monthly.recruited_goal}
            accent="#0E9384"
            icon={<Users className="h-4 w-4" />}
            hero
          />
          {/* Dører banket */}
          <GoalCard
            label={t("Dører banket")}
            value={doorsMonth}
            goal={monthly.doors_goal}
            accent="#8B5CF6"
            icon={<DoorOpen className="h-4 w-4" />}
          />
          {/* Team i dag — hidden if we don't have today data (currently 0) */}
          {doorsToday > 0 && (
            <StatCard
              label={t("Team i dag")}
              value={doorsToday}
              suffix={t("dører")}
              accent="#F59E0B"
              icon={<Zap className="h-4 w-4" />}
            />
          )}
          {/* Placeholder to keep 2×2 grid tidy on desktop when Team-i-dag is hidden */}
          {doorsToday === 0 && <div className="hidden sm:block" />}
        </div>
      </div>

      {/* ═════════════════ MÅL UKE ═════════════════ */}
      {/* Only show if we have real weekly numbers (currently hidden pending
          a proper 7-day-slice endpoint — kept scaffolded for later). */}
      {(doorsWeek > 0 || false) && (
        <div className="space-y-3">
          <p className="pl-4 text-[11px] uppercase tracking-widest text-ab-fg-4">{t("Mål uke")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GoalCard
              label={t("Dører banket") + " · " + t("uke")}
              value={doorsWeek}
              goal={weeklyDoorsGoal}
              accent="#8B5CF6"
              icon={<DoorOpen className="h-4 w-4" />}
            />
            <GoalCard
              label={t("Antall givere") + " · " + t("uke")}
              value={Math.round(monthly.recruited_actual / 4)}
              goal={weeklyRecruitedGoal}
              accent="#0E9384"
              icon={<UserPlus className="h-4 w-4" />}
            />
          </div>
        </div>
      )}
    </div>
  )
}
