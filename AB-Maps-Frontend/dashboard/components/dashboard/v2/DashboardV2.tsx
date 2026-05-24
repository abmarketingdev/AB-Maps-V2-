"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useAuth } from "@/lib/auth/AuthContext"
import { KPIStrip } from "./KPIStrip"
import { TrendChart } from "./TrendChart"
import { MoodRing } from "./MoodRing"
import { CampaignHealthBar } from "./CampaignHealthBar"
import { LeaderboardPanel } from "./LeaderboardPanel"
import { ActivityFeed } from "./ActivityFeed"
import {
  fetchOverview, fetchTrends, fetchLeaderboard, fetchActivities,
  type DashRange, type LeaderMetric, type DashboardOverview,
} from "@/lib/api/dashboardOverview"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"

export function DashboardV2() {
  const { user, isAdmin } = useAuth()
  const { campaignId } = useSelectedCampaign()
  const reduced = useReducedMotion()

  // Live data (Module 3, guide §5.2). Undefined buckets → widgets show mock.
  // campaign_id is left unset for now (team-scoped); the global campaign picker
  // isn't wired to real campaign UUIDs yet.
  const [range, setRange] = useState<DashRange>("7d")
  const [metric, setMetric] = useState<LeaderMetric>("ja_rate")
  const [data, setData] = useState<DashboardOverview | null>(null)

  // First paint / campaign change → one composite call (guide §0), scoped to
  // the selected campaign (undefined = team-wide).
  useEffect(() => {
    let cancelled = false
    fetchOverview(range, campaignId)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { /* empty/error → widgets show empty states */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  // Range change → refetch trends only.
  const onRangeChange = useCallback((r: DashRange) => {
    setRange(r)
    fetchTrends(r, campaignId).then((trends) => setData((d) => (d ? { ...d, trends } : d))).catch(() => {})
  }, [campaignId])

  // Metric change → refetch leaderboard only.
  const onMetricChange = useCallback((m: LeaderMetric) => {
    setMetric(m)
    fetchLeaderboard(m, 5, campaignId).then((leaderboard) => setData((d) => (d ? { ...d, leaderboard } : d))).catch(() => {})
  }, [campaignId])

  // Poll the live activity feed (~30s) until SSE ships (guide §6).
  useEffect(() => {
    const id = window.setInterval(() => {
      fetchActivities(50, campaignId).then((activities) => setData((d) => (d ? { ...d, activities } : d))).catch(() => {})
    }, 30000)
    return () => window.clearInterval(id)
  }, [campaignId])

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 11 ? "God morgen" :
    hour < 17 ? "God dag" :
    "God kveld"
  const firstName = user?.username ?? "der"

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 50%, #0a0f1e 100%)" }}>
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/2 -right-32 h-80 w-80 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-600/6 blur-3xl" />
      </div>

      <div className="relative px-6 py-8 space-y-6 max-w-[1600px] mx-auto">

        {/* Page header */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-white">
              {greeting}, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-white/40">
              {now.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {isAdmin && <span className="ml-2 rounded-full bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400 font-medium">Admin</span>}
            </p>
          </div>
        </motion.div>

        {/* KPI strip — always visible */}
        <KPIStrip stats={data?.kpis} />

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <TrendChart points={data?.trends} range={range} onRangeChange={onRangeChange} />
          <MoodRing segments={data?.mood} />
        </div>

        {/* Campaign health — always visible */}
        <CampaignHealthBar campaigns={data?.campaigns} />

        {/* Leaderboard + Activity feed */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
          <LeaderboardPanel entries={data?.leaderboard} metric={metric} onMetricChange={onMetricChange} />
          <ActivityFeed rows={data?.activities} />
        </div>

      </div>
    </div>
  )
}

export default DashboardV2
