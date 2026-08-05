"use client"

/**
 * The prod DashboardV2 widgets, rendered inline inside SalgslederDashboard
 * WITHOUT the outer greeting header / ambient glow blobs / full-page wrapper.
 *
 * DEMO MODE: when `process.env.NEXT_PUBLIC_DEMO_MODE === "true"` (set in
 * .env.local for boss's local run), we skip the real fetch and use dummy
 * data from `demoBackendData.ts`. On prod this env var is unset → the
 * behaviour is IDENTICAL to DashboardV2: same fetchOverview / fetchTrends /
 * fetchActivities calls, same 30s polling.
 */

import { useCallback, useEffect, useState } from "react"
import { KPIStrip } from "@/components/dashboard/v2/KPIStrip"
import { TrendChart } from "@/components/dashboard/v2/TrendChart"
import { MoodRing } from "@/components/dashboard/v2/MoodRing"
import { CampaignHealthBar } from "@/components/dashboard/v2/CampaignHealthBar"
import { ActivityFeed } from "@/components/dashboard/v2/ActivityFeed"
import {
  fetchOverview, fetchTrends, fetchActivities,
  type DashRange, type DashboardOverview,
} from "@/lib/api/dashboardOverview"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"
import {
  demoKpiStats, demoTrend7d, demoTrend30d, demoTrend90d,
  demoMood, demoCampaigns, demoActivities,
} from "./demoBackendData"

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

// Build a full DashboardOverview shape from demo data (leaderboard left empty —
// we don't render classic Toppliste here, our TOPPLISTER row handles that).
function demoDashboard(range: DashRange): DashboardOverview {
  const trends = range === "30d" ? demoTrend30d : range === "90d" ? demoTrend90d : demoTrend7d
  return {
    kpis: demoKpiStats,
    trends,
    mood: demoMood,
    campaigns: demoCampaigns,
    leaderboard: [],
    activities: demoActivities,
  }
}

export function EmbeddedManagerWidgets() {
  const { campaignId } = useSelectedCampaign()
  const [range, setRange] = useState<DashRange>("7d")
  const [data, setData] = useState<DashboardOverview | null>(DEMO ? demoDashboard("7d") : null)

  useEffect(() => {
    if (DEMO) { setData(demoDashboard(range)); return }
    let cancelled = false
    fetchOverview(range, campaignId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const onRangeChange = useCallback((r: DashRange) => {
    setRange(r)
    if (DEMO) { setData(demoDashboard(r)); return }
    fetchTrends(r, campaignId).then(trends => setData(d => (d ? { ...d, trends } : d))).catch(() => {})
  }, [campaignId])

  useEffect(() => {
    if (DEMO) return  // no polling in demo mode — data is static
    const id = window.setInterval(() => {
      fetchActivities(50, campaignId).then(activities => setData(d => (d ? { ...d, activities } : d))).catch(() => {})
    }, 30000)
    return () => window.clearInterval(id)
  }, [campaignId])

  return (
    <div className="space-y-6">
      <KPIStrip stats={data?.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <TrendChart points={data?.trends} range={range} onRangeChange={onRangeChange} />
        <MoodRing segments={data?.mood} />
      </div>

      <CampaignHealthBar campaigns={data?.campaigns} />

      <ActivityFeed rows={data?.activities} />
    </div>
  )
}

export default EmbeddedManagerWidgets
