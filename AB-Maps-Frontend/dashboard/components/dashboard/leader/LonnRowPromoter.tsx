"use client"

import { useEffect, useState } from "react"
import { Users, Coins, Wallet } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { LonnTile } from "./LonnTile"
import { fetchMySalary, currentPeriod, type MySalary } from "@/lib/api/salary"

// 3-tile LØNN row for the Promotør view. Wired to real /api/hr/salary/me/
// (Phase 2+5, 2026-08-05). Feature-flagged on backend — when off, endpoint
// 503s → fetch throws → we render nothing so parent can hide the section.
export function LonnRowPromoter() {
  const { t } = useLang()
  const [summary, setSummary] = useState<MySalary | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading")

  useEffect(() => {
    let cancelled = false
    fetchMySalary({ period: currentPeriod() })
      .then((s) => { if (!cancelled) { setSummary(s); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("unavailable") })
    return () => { cancelled = true }
  }, [])

  if (status !== "ok" || !summary) return null

  const sumVervingerNum = parseFloat(summary.sum_vervinger)
  const estimertLonnNum = parseFloat(summary.estimert_lonn)

  return (
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
  )
}
