"use client"

import { Users, Coins, Wallet } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { LonnTile } from "./LonnTile"
import { lonn } from "./dummyData"

// 3-tile LØNN row for the Promotør view (Image #4). Same as the Salgsleder row
// minus the LEDERPROVISJON tile — a sales rep earns own-commission and
// vervinger, not team-lead commission.
export function LonnRowPromoter() {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <LonnTile
        label={t("Aktive givere")}
        value={lonn.aktiveGivere.current}
        goal={lonn.aktiveGivere.goal}
        accent="#3461FF"
        icon={<Users className="h-4 w-4" />}
        placeholder
      />
      <LonnTile
        label={t("Sum vervinger")}
        value={lonn.sumVervinger}
        suffix={t("kr")}
        accent="#0E9384"
        icon={<Coins className="h-4 w-4" />}
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
