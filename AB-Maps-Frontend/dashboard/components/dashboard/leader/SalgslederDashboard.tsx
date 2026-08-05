"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useLang } from "@/lib/i18n"
import { EmbeddedManagerWidgets } from "./EmbeddedManagerWidgets"
import { SectionHeader } from "./SectionHeader"
import { AuroraBg } from "./AuroraBg"
import { AvatarStack } from "./Avatar"
import { LivePulseDot } from "./LivePulseDot"
import { TeamPanel } from "./TeamPanel"
import { TopplisterRow } from "./TopplisterRow"
import { listTeams, getTeam } from "@/lib/api/teams"
import { teams as dummyTeams, type TeamNode } from "./dummyData"

// Adapter: real HR /api/hr/teams/ → dashboard's TeamNode shape (what
// TeamPanel expects). Real data covers team header (name, color, city
// via campaign, managerName via owner) + member NAMES. Per-promoter
// metrics (doors/goals/vervinger/etc) have no matching backend endpoint
// today, so we default to 0 — visually honest ("hasn't started yet")
// rather than fabricated. When a per-member analytics endpoint ships,
// this adapter is the single place to enrich those numbers.
async function fetchTeamsAsNodes(): Promise<TeamNode[]> {
  const list = await listTeams({ pageSize: 50 })
  if (!list.results.length) return []
  const details = await Promise.all(list.results.map((t) => getTeam(t.id).catch(() => null)))
  return details
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((d) => ({
      id: d.id,
      name: d.name,
      city: d.campaign?.name ?? "",
      color: d.color || "#0E9384",
      managerName: d.owner?.name ?? "—",
      chiefContribution: 0,
      leaderContribution: 0,
      promoters: d.members
        .filter((m) => m.person_type === "employee")
        .map((m) => ({
          id: m.id,
          name: m.name,
          doors: 0,
          doorsGoal: 40,
          recruited: 0,
          recruitedGoal: 10,
          activePercent: 0,
          sumVervinger: 0,
        })),
    }))
}

// Salgsleder / Teamleder dashboard — Aurora Nordic redesign.
// Route: /dashbord. Served to ALL non-employee roles (manager / admin /
// superuser / sales_chief) per boss decision 2026-08-05.
export function SalgslederDashboard() {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const reduced = useReducedMotion()
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 11 ? t("God morgen") :
    hour < 17 ? t("God dag") :
    t("God kveld")
  const firstName = (user?.user_info?.name?.split(" ")[0]) || (user?.username?.split(" ")[0]) || "der"

  // Real teams from /api/hr/teams/ (with getTeam for member lists).
  // Falls back to dummy teams if the fetch fails, so the section always
  // renders SOMETHING and never crashes the whole dashboard.
  const [teams, setTeams] = useState<TeamNode[]>(dummyTeams)
  useEffect(() => {
    let cancelled = false
    fetchTeamsAsNodes()
      .then((real) => { if (!cancelled && real.length) setTeams(real) })
      .catch(() => { /* keep dummy fallback silently */ })
    return () => { cancelled = true }
  }, [])

  const totalPromoters = teams.reduce((s, tm) => s + tm.promoters.length, 0)
  const leaderNames = teams.map((tm) => tm.managerName)

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-aurora-amber/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-aurora-sunrise/[0.05] blur-[100px]" />
      </div>

      <div className="relative max-w-[1600px] mx-auto">
        {/* ═════════════════ HERO PANEL ═════════════════ */}
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
                {now.toLocaleDateString(lang === "no" ? "nb-NO" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h1 className="mt-2 font-instrument text-4xl sm:text-6xl leading-[1.02] text-ab-fg">
                {greeting}, <span className="italic text-aurora-amber">{firstName}</span> <span className="not-italic">👋</span>
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ab-fg-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-aurora-amber ring-1 ring-inset ring-aurora-amber/25">
                  <Sparkles className="h-3 w-3" />
                  {t("Salgsleder / Teamleder")}
                </span>
                <span className="text-ab-fg-3">·</span>
                <div className="inline-flex items-center gap-2">
                  <AvatarStack names={leaderNames} size={22} max={4} />
                  <span className="text-ab-fg-3">
                    <span className="font-mono text-ab-fg">{teams.length}</span> {t("team")} ·{" "}
                    <span className="font-mono text-ab-fg">{totalPromoters}</span> {t("promotører")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="relative px-4 sm:px-6 py-6 sm:py-8 space-y-8">
          {/* ═════════════════ MÅL MÅNED + MÅL UKE + LØNN + EstimatedSalaryBand ═════════════════
              These sections are HIDDEN until the corresponding backend endpoints ship
              (Phase 2+5 for LØNN, Phase D for MÅL MÅNED/UKE goals).
              Per boss constraint 2026-08-05: no fake data. Once /api/hr/salary/summary/
              and /api/hr/goals/ ship, these blocks come back — the components are still
              in the tree (LonnRowSalgsleder, EstimatedSalaryBand, MÅL section) waiting
              for their data. Team + Topplister + Sanntid all use real data and stay. */}

          {/* ═════════════════ Team ═════════════════ */}
          <div>
            <SectionHeader label={t("Team")} accent="teamleder" />
            <p className="pb-2 pl-4 text-[11px] text-ab-fg-3">{t("Klikk et team for å se promotørene bak tallene")}</p>
            <TeamPanel teams={teams} />
          </div>

          {/* ═════════════════ Topplister ═════════════════ */}
          <div>
            <SectionHeader label={t("Topplister")} accent="teamleder" />
            <TopplisterRow />
          </div>

          {/* ═════════════════ Sanntid — live widgets from prod manager view ═════════════════ */}
          <div>
            <SectionHeader label={t("Sanntid")} accent="teamleder" right={<LivePulseDot label={t("Live")} />} />
            <p className="pb-2 pl-4 text-[11px] text-ab-fg-3">{t("Live tall og trend for hele teamet ditt")}</p>
            <EmbeddedManagerWidgets />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalgslederDashboard
