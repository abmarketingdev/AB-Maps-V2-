"use client"

import { useEffect, useState } from "react"
import { Users, Coins, Crown, Wallet } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { LonnTile } from "./LonnTile"
import { ExpandableLonnCard, type BreakdownRow } from "./ExpandableLonnCard"
import { fetchSalarySummary, currentPeriod, type SalarySummary } from "@/lib/api/salary"

interface LonnRowSalgslederProps {
  /** YYYY-MM. When omitted, defaults to current month. */
  period?: string
  /** When set, backend filters aggregation to this campaign only. */
  campaignId?: string
  /** Human-readable name of the selected campaign for the scope chip. */
  campaignName?: string
}

// 4-tile LØNN row for the Salgsleder view.
// Wired to real /api/hr/salary/summary/ (Phase 2+5, 2026-08-05).
// Feature-flagged on backend — when off, endpoint 503s → fetch throws → we
// render nothing (parent controls whether to show a "coming soon" message).
export function LonnRowSalgsleder({ period, campaignId, campaignName }: LonnRowSalgslederProps = {}) {
  const { t } = useLang()
  const [summary, setSummary] = useState<SalarySummary | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchSalarySummary({ period: period ?? currentPeriod(), campaignId })
      .then((s) => { if (!cancelled) { setSummary(s); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("unavailable") })
    return () => { cancelled = true }
  }, [period, campaignId])

  // While loading / unavailable → render null so parent can decide UX.
  // Parent (SalgslederDashboard) wraps this in the LØNN section which is
  // itself hidden when the endpoint isn't returning anything.
  if (status !== "ok" || !summary) return null

  const sumVervingerNum = parseFloat(summary.sum_vervinger)
  const lederProvisjonNum = parseFloat(summary.leder_provisjon)
  const estimertLonnNum = parseFloat(summary.estimert_lonn)

  // Breakdown for expandable cards — from real per-team data.
  const lederBreakdown: BreakdownRow[] = summary.per_team_breakdown.map((t) => ({
    key: t.team_id,
    label: t.team_name,
    sub: t.team_name,
    value: parseFloat(t.chief_contribution),
    color: "#F59E0B",
  }))
  const vervingerBreakdown: BreakdownRow[] = summary.per_team_breakdown.map((t) => ({
    key: t.team_id,
    label: t.team_name,
    sub: t.team_name,
    value: parseFloat(t.sum_vervinger),
    color: "#0E9384",
  }))

  // Scope label — surfaces WHOSE numbers the user is looking at.
  // Uses backend scope + campaign_scoped signal, with the campaign display
  // name passed from the parent (CampaignGuard has it).
  const scopeLabel = (() => {
    const scopeText = summary.scope === "global"
      ? t("Hele selskapet")
      : summary.scope === "chief_or_lead"
        ? t("Dine team")
        : t("Deg selv")
    const kampanjeText = summary.campaign_scoped
      ? (campaignName || t("valgt kampanje"))
      : t("alle kampanjer")
    return `${scopeText} · ${kampanjeText}`
  })()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pl-4 text-[11px] text-ab-fg-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-ab-line bg-white/[0.04] px-2 py-0.5 font-mono uppercase tracking-[0.12em] text-[10px] text-ab-fg-2">
          {scopeLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <LonnTile
        label={t("Aktive givere")}
        value={summary.aktive_givere.current}
        goal={summary.aktive_givere.goal ?? undefined}
        accent="#3461FF"
        icon={<Users className="h-4 w-4" />}
      />
      <ExpandableLonnCard
        label={t("Sum vervinger")}
        value={sumVervingerNum}
        suffix={t("kr")}
        accent="#0E9384"
        icon={<Coins className="h-4 w-4" />}
        breakdown={vervingerBreakdown}
        breakdownLabel={t("Per team")}
      />
      <ExpandableLonnCard
        label={t("Lederprovisjon")}
        value={lederProvisjonNum}
        suffix={t("kr")}
        accent="#F59E0B"
        icon={<Crown className="h-4 w-4" />}
        breakdown={lederBreakdown}
        breakdownLabel={t("Per team")}
      />
      <LonnTile
        label={t("Estimert lønn")}
        value={estimertLonnNum}
        suffix={t("kr")}
        accent="#F43F5E"
        icon={<Wallet className="h-4 w-4" />}
      />
      </div>
    </div>
  )
}
