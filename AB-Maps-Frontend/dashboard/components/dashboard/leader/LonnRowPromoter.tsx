"use client"

import { useEffect, useState } from "react"
import { Users, Coins, Wallet } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { LonnTile } from "./LonnTile"
import { fetchMySalary, currentPeriod, type MySalary } from "@/lib/api/salary"

interface LonnRowPromoterProps {
  /** YYYY-MM. When omitted, defaults to current month. */
  period?: string
  /** When set, backend restricts self-scoped commissions to this campaign. */
  campaignId?: string
  /** Human-readable name of the selected campaign for the scope chip. */
  campaignName?: string
}

// 3-tile LØNN row for the Promotør view. Wired to real /api/hr/salary/me/
// (Phase 2+5, 2026-08-05). Feature-flagged on backend — when off, endpoint
// 503s → fetch throws → we render nothing so parent can hide the section.
export function LonnRowPromoter({ period, campaignId, campaignName }: LonnRowPromoterProps = {}) {
  const { t } = useLang()
  const [summary, setSummary] = useState<MySalary | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchMySalary({ period: period ?? currentPeriod(), campaignId })
      .then((s) => { if (!cancelled) { setSummary(s); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("unavailable") })
    return () => { cancelled = true }
  }, [period, campaignId])

  if (status !== "ok" || !summary) return null

  const sumVervingerNum = parseFloat(summary.sum_vervinger)
  const estimertLonnNum = parseFloat(summary.estimert_lonn)

  const scopeLabel = summary.campaign_scoped
    ? `${t("Deg selv")} · ${campaignName || t("valgt kampanje")}`
    : `${t("Deg selv")} · ${t("alle kampanjer")}`

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pl-4 text-[11px] text-ab-fg-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-ab-line bg-white/[0.04] px-2 py-0.5 font-mono uppercase tracking-[0.12em] text-[10px] text-ab-fg-2">
          {scopeLabel}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <LonnTile
        label={t("Aktive givere")}
        value={summary.aktive_givere.current}
        goal={summary.aktive_givere.goal ?? undefined}
        accent="#3461FF"
        icon={<Users className="h-4 w-4" />}
      />
      <LonnTile
        label={t("Sum vervinger")}
        value={sumVervingerNum}
        suffix={t("kr")}
        accent="#0E9384"
        icon={<Coins className="h-4 w-4" />}
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
