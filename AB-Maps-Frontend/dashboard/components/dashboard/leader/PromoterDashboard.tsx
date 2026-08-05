"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Plus, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useLang } from "@/lib/i18n"
import { useSelectedCampaign } from "@/components/campaign/CampaignGuard"
import { EmployeeTodayProvider } from "./EmployeeTodayContext"
import { EmbeddedPromoterWidgets } from "./EmbeddedPromoterWidgets"
import { SectionHeader } from "./SectionHeader"
import { AuroraBg } from "./AuroraBg"
import { MagneticButton } from "./MagneticButton"
import { LivePulseDot } from "./LivePulseDot"
import { TopplisterRow } from "./TopplisterRow"

// Promotør dashboard — Aurora Nordic redesign.
// Route: /employee/dashbord.
export function PromoterDashboard() {
  const { user } = useAuth()
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "der"
  return (
    <EmployeeTodayProvider firstName={firstName}>
      <PromoterDashboardInner />
    </EmployeeTodayProvider>
  )
}

function PromoterDashboardInner() {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const { selectedCampaign } = useSelectedCampaign()
  const campaignId: string | undefined = selectedCampaign?.id
  const reduced = useReducedMotion()
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 11 ? t("God morgen") :
    hour < 17 ? t("God dag") :
    t("God kveld")
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "der"

  return (
    <div className="min-h-screen bg-ab-base">
      {/* Ambient blob glows for pages without hero */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-aurora-sunrise/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-ab-accent/[0.06] blur-[100px]" />
      </div>

      <div className="relative max-w-[1400px] mx-auto">
        {/* ═════════════════ HERO PANEL — aurora + serif greeting ═════════════════ */}
        <motion.section
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden mx-4 sm:mx-6 mt-6 sm:mt-8 rounded-[28px] border border-ab-line"
        >
          <AuroraBg intensity="normal" />
          <div className="relative px-6 sm:px-10 py-8 sm:py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-ab-fg-3">
                {now.toLocaleDateString(lang === "no" ? "nb-NO" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="mt-2 font-instrument text-4xl sm:text-6xl leading-[1.02] text-ab-fg">
                {greeting}, <span className="italic text-aurora-amber">{firstName}</span> <span className="not-italic">👋</span>
              </h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-ab-fg-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-aurora-amber ring-1 ring-inset ring-aurora-amber/25">
                  <Sparkles className="h-3 w-3" />
                  {t("Promotør")}
                </span>
                <span className="text-ab-fg-3">·</span>
                <span className="text-ab-fg-3">{t("La oss knuse dagen sammen")}</span>
              </p>
            </div>

            {/* Registrer dør → redirect to /emp/ map app (the REAL knock endpoint).
                The old inline modal POSTed to /api/employee/me/registrations/ which
                does not exist in the backend — the emp CRA app owns knock registration
                via PATCH /api/apartments/{id}/. Send the user there instead. */}
            <MagneticButton onClick={() => { window.location.href = "/emp/" }}>
              <Plus className="h-4 w-4" />
              {t("Registrer dør")}
            </MagneticButton>
          </div>
        </motion.section>

        <div className="relative px-4 sm:px-6 py-6 sm:py-8 space-y-8">
          {/* ═════════════════ MÅL MÅNED + MÅL UKE + LØNN + EstimatedSalaryBand ═════════════════
              Hidden until Phase D (goals endpoint) and Phase 2+5 (salary endpoint) ship.
              Per boss constraint 2026-08-05: no fake data. Din dag + Topplister remain
              (both fully real). Components (HeroKpi/GoalTile/LonnRowPromoter/etc.) stay
              in the tree waiting for their endpoints. */}

          {/* ═════════════════ Din dag — live widgets from prod employee view ═════════════════ */}
          <div id="din-dag">
            <SectionHeader label={t("Din dag")} accent="teamleder" right={<LivePulseDot label={t("Live")} />} />
            <p className="pb-2 pl-4 text-[11px] text-ab-fg-3">{t("Sanntid — oppdateres hvert 20. sekund")}</p>
            <EmbeddedPromoterWidgets />
          </div>

          {/* ═════════════════ Topplister ═════════════════ */}
          <div>
            <SectionHeader label={t("Topplister")} accent="teamleder" />
            <TopplisterRow campaignId={campaignId} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromoterDashboard
