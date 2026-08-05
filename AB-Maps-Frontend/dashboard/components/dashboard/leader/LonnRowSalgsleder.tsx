"use client"

import { Users, Coins, Crown, Wallet } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { LonnTile } from "./LonnTile"
import { ExpandableLonnCard, type BreakdownRow } from "./ExpandableLonnCard"
import { lonn, teams } from "./dummyData"

// 4-tile LØNN row for the Salgsleder view.
// LEDERPROVISJON and SUM VERVINGER are expandable — click reveals a
// per-team breakdown (mirrors the HR Team model, where salgsleder
// earns chief_rate from each team he oversees).
export function LonnRowSalgsleder() {
  const { t } = useLang()

  // Lederprovisjon breakdown = per-team chief_contribution
  const lederBreakdown: BreakdownRow[] = teams.map(team => ({
    key: team.id,
    label: team.name,
    sub: `${t("Leder")}: ${team.managerName}`,
    value: team.chiefContribution,
    color: team.color,
  }))

  // Sum vervinger breakdown = per-team total (sum of all promoters' vervinger)
  const vervingerBreakdown: BreakdownRow[] = teams.map(team => ({
    key: team.id,
    label: team.name,
    sub: `${team.promoters.length} ${t("promotører")} · ${team.managerName}`,
    value: team.promoters.reduce((s, p) => s + p.sumVervinger, 0),
    color: team.color,
  }))

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <LonnTile
        label={t("Aktive givere")}
        value={lonn.aktiveGivere.current}
        goal={lonn.aktiveGivere.goal}
        accent="#3461FF"
        icon={<Users className="h-4 w-4" />}
        placeholder
      />
      <ExpandableLonnCard
        label={t("Sum vervinger")}
        value={lonn.sumVervinger}
        suffix={t("kr")}
        accent="#0E9384"
        icon={<Coins className="h-4 w-4" />}
        breakdown={vervingerBreakdown}
        breakdownLabel={t("Per team")}
        placeholder
      />
      <ExpandableLonnCard
        label={t("Lederprovisjon")}
        value={lonn.lederProvisjon}
        suffix={t("kr")}
        accent="#F59E0B"
        icon={<Crown className="h-4 w-4" />}
        breakdown={lederBreakdown}
        breakdownLabel={t("Per team")}
        placeholder
      />
      <LonnTile
        label={t("Estimert lønn")}
        value={lonn.estimertLonn}
        suffix={t("kr")}
        accent="#F43F5E"
        icon={<Wallet className="h-4 w-4" />}
        placeholder
      />
    </div>
  )
}
