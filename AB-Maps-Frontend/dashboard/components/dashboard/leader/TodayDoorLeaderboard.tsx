"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { DoorOpen, UserPlus, Zap, Medal } from "lucide-react"
import { fetchLeaderboard, type LeaderItem, type LeaderMetric } from "@/lib/api/dashboardOverview"
import { useLang } from "@/lib/i18n"

// ─────────────────────────────────────────────────────────────────────────────
// TodayLeaderboardCard (client ask 2026-08-08 — "Hvem har banka flest dører
// i dag"). 2026-08-09: single card, metric-configurable, sits in a 2-col grid
// on the dashboard (paired with the "recruits today" variant) so the row
// isn't half-empty. Same medal styling as TopplisterRow + login popup.
// Kept file name for import stability across dashboards.
// ─────────────────────────────────────────────────────────────────────────────

const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32", "#f59e0b", "#f59e0b"]

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Visual variant per metric. Keeps the two cards visually distinct while the
// layout / medals stay identical so leaders read them as siblings.
const VARIANTS = {
  doors: {
    icon: <DoorOpen className="h-4 w-4" />,
    unit: "dør",
    accent: "#f59e0b",
    accentBg: "bg-amber-500/15",
    accentText: "text-amber-400",
  },
  recruited: {
    icon: <UserPlus className="h-4 w-4" />,
    unit: "rekrutt",
    accent: "#10b981",
    accentBg: "bg-emerald-500/15",
    accentText: "text-emerald-400",
  },
} satisfies Record<Exclude<LeaderMetric, "ja_rate" | "consistency">, {
  icon: React.ReactNode; unit: string; accent: string; accentBg: string; accentText: string
}>

interface TodayLeaderboardCardProps {
  campaignId?: string
  /** Which metric to lead today's rankings by. Defaults to doors. */
  metric?: "doors" | "recruited"
  /** Override the header label. Defaults to a Norwegian per-metric string. */
  title?: string
  subtitle?: string
}

export function TodayLeaderboardCard({ campaignId, metric = "doors", title, subtitle }: TodayLeaderboardCardProps) {
  const { t } = useLang()
  const reduced = useReducedMotion()
  const [rows, setRows] = useState<LeaderItem[]>([])
  const [status, setStatus] = useState<"loading" | "ok" | "empty">("loading")
  // True when we fell back to yesterday's data because today was empty
  // (midnight / start-of-day). Drives the subtitle so users know why they
  // see yesterday's names (2026-08-10 fix — was silently hiding the card).
  const [usingYesterday, setUsingYesterday] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchLeaderboard(metric, 5, campaignId, todayIso())
      .then(async (entries) => {
        if (cancelled) return
        if ((entries?.length ?? 0) > 0) {
          setRows(entries ?? [])
          setUsingYesterday(false)
          setStatus("ok")
          return
        }
        // Today is empty → try yesterday so the card is still useful mid-shift.
        const yEntries = await fetchLeaderboard(metric, 5, campaignId, yesterdayIso()).catch(() => [])
        if (cancelled) return
        setRows(yEntries ?? [])
        setUsingYesterday(true)
        setStatus((yEntries?.length ?? 0) > 0 ? "ok" : "empty")
      })
      .catch(() => {
        if (cancelled) return
        setRows([])
        setStatus("empty")
      })
    return () => { cancelled = true }
  }, [campaignId, metric])

  if (status !== "ok") return null

  const variant = VARIANTS[metric]
  const resolvedTitle = title ?? (usingYesterday ? t("Toppene i går") : t("Toppene i dag"))
  const resolvedSubtitle = subtitle ?? (usingYesterday
    ? t("Ingen data i dag ennå — viser gårsdagens topp")
    : metric === "doors"
      ? t("Flest dører banket akkurat nå")
      : t("Flest rekrutterte givere i dag"))

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="relative rounded-2xl border border-ab-line bg-ab-elevated p-4 sm:p-5"
      style={{ boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 2px 0 rgba(0,0,0,0.25)` }}
    >
      {/* Metric-tinted accent stripe on top edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${variant.accent} 25%, ${variant.accent} 75%, transparent)` }}
      />

      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3 flex items-center gap-1.5">
            <Zap className="h-3 w-3" style={{ color: variant.accent }} />
            {resolvedTitle}
          </p>
          <p className="mt-0.5 text-[11px] text-ab-fg-4">{resolvedSubtitle}</p>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${variant.accentBg} ${variant.accentText}`}>
          {variant.icon}
        </div>
      </div>

      {/* Rows */}
      <ol className="space-y-1">
        {rows.map((r, i) => {
          const color = MEDAL_COLORS[i] ?? "rgba(255,255,255,0.3)"
          const isTop3 = i < 3
          return (
            <motion.li
              key={r.name + i}
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.02] transition-colors"
            >
              <span
                className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-black"
                style={{
                  background: color,
                  boxShadow: isTop3 ? `0 0 8px ${color}55, inset 0 1px 0 rgba(255,255,255,0.3)` : `inset 0 1px 0 rgba(255,255,255,0.15)`,
                }}
                title={`Plass ${r.rank}`}
              >
                {isTop3 && (
                  <Medal className="absolute -top-1 -right-1 h-3 w-3" style={{ color, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} aria-hidden />
                )}
                {r.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-ab-fg">{r.name}</p>
                {r.region && <p className="truncate text-[10px] text-ab-fg-4">{r.region}</p>}
              </div>
              <span className="font-mono text-sm font-bold tabular-nums text-ab-fg">
                {/* Use `score` (the metric's actual sort value — recruit
                    count for metric=recruited, doors count for metric=doors)
                    rounded to an integer. `dorerPerDag` was always the same
                    doors-per-day field regardless of metric, so recruits
                    used to show door counts labelled as "rekrutt" (2026-08-10 fix). */}
                {Math.round(r.score)}
                <span className="ml-1 text-[10px] font-normal text-ab-fg-4">{variant.unit}</span>
              </span>
            </motion.li>
          )
        })}
      </ol>
    </motion.div>
  )
}

// Back-compat named export (old imports still work).
export const TodayDoorLeaderboard = (props: Omit<TodayLeaderboardCardProps, "metric">) => (
  <TodayLeaderboardCard {...props} metric="doors" />
)
