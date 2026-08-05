"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ChevronDown, DoorOpen, UserPlus, Activity, Trophy, Flame, Pencil, Loader2 } from "lucide-react"
import { Avatar } from "./Avatar"
import { useLang } from "@/lib/i18n"
import { SetTeamGoalModal } from "./SetTeamGoalModal"
import type { TeamNode } from "./dummyData"

interface TeamPanelProps {
  teams: TeamNode[]
  /** Selected month (YYYY-MM). Used when opening SetTeamGoalModal so the
   *  save PUTs against the currently-viewed period. */
  period?: string
  /** Set of team IDs currently being fetched. Cards show a spinner while in
   *  this set. Passed from parent that owns the fetch. */
  loadingTeamIds?: Set<string>
  /** Called the first time a card is expanded — parent fetches detail. */
  onTeamExpand?: (teamId: string) => void
  /** Called after a successful goal save. teamId lets parent refetch just
   *  that one team instead of the whole page. */
  onGoalSaved?: (teamId?: string) => void
}

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
}

export function TeamPanel({ teams, period, loadingTeamIds, onTeamExpand, onGoalSaved }: TeamPanelProps) {
  return (
    <div className="space-y-3">
      {teams.map((team, i) => (
        <TeamCard
          key={team.id}
          team={team}
          index={i}
          period={period}
          loading={loadingTeamIds?.has(team.id) ?? false}
          onExpand={onTeamExpand}
          onGoalSaved={onGoalSaved}
        />
      ))}
    </div>
  )
}

function TeamCard({ team, index, period, loading, onExpand, onGoalSaved }:
  { team: TeamNode; index: number; period?: string; loading: boolean;
    onExpand?: (id: string) => void; onGoalSaved?: (id?: string) => void }) {
  const { t } = useLang()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [goalModalOpen, setGoalModalOpen] = useState(false)

  // Fire the lazy fetch the first time the card is opened.
  useEffect(() => {
    if (open && onExpand) onExpand(team.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const totalDoors     = team.promoters.reduce((s, p) => s + p.doors, 0)
  const totalRec       = team.promoters.reduce((s, p) => s + p.recruited, 0)
  const totalVervinger = team.promoters.reduce((s, p) => s + p.sumVervinger, 0)
  const avgActive      = team.promoters.length
    ? Math.round(team.promoters.reduce((s, p) => s + p.activePercent, 0) / team.promoters.length)
    : 0
  // Phase D — team-level goals from backend (unset → 0 → chip/bar hidden).
  const totalDoorsGoal = team.teamDoorsGoal ?? 0
  const totalRecGoal   = team.teamRecruitedGoal ?? 0
  const doorsPct       = totalDoorsGoal ? Math.min(100, Math.round((totalDoors / totalDoorsGoal) * 100)) : 0

  // Rank promoters by sumVervinger — top 3 get medals
  const ranked = [...team.promoters].sort((a, b) => b.sumVervinger - a.sumVervinger)
  const rankById = new Map(ranked.map((p, i) => [p.id, i + 1]))

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated transition-[box-shadow] duration-300"
      style={{
        boxShadow: open
          ? `0 0 0 1px ${hexAlpha(team.color, 0.3)}, 0 24px 60px -24px ${hexAlpha(team.color, 0.5)}`
          : `inset 0 24px 48px -32px ${hexAlpha(team.color, 0.22)}`,
      }}
    >
      {/* Premium top-strip: thicker gradient bar + soft radial glow bleeding into the card */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, transparent, ${team.color} 25%, ${team.color} 75%, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -top-2 left-0 right-0 h-20 opacity-70"
        style={{ background: `radial-gradient(ellipse 55% 100% at 10% 0%, ${hexAlpha(team.color, 0.35)} 0%, transparent 60%)` }}
      />

      {/* Header — clickable */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="group relative flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        {/* Team badge — chunkier, glassier */}
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-mono text-sm font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${team.color}, ${hexAlpha(team.color, 0.65)})`,
            boxShadow: `0 8px 24px -8px ${hexAlpha(team.color, 0.7)}, inset 0 1px 0 0 ${hexAlpha("#ffffff", 0.15)}`,
          }}
        >
          {team.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-ab-fg">{team.name}</h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ background: hexAlpha(team.color, 0.12), color: team.color }}
            >
              {team.city}
            </span>
            {team.canEditGoals && (
              <span
                role="button"
                tabIndex={0}
                title={t("Sett mål for måneden")}
                onClick={(e) => { e.stopPropagation(); setGoalModalOpen(true) }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setGoalModalOpen(true) } }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-ab-fg-3 transition-colors hover:bg-white/[0.06] hover:text-aurora-amber cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-ab-fg-3">
            {t("Leder")}: <span className="font-medium text-ab-fg-2">{team.managerName}</span>
            <span className="mx-1.5 text-ab-fg-4">·</span>
            {team.memberCount ?? team.promoters.length} {t("promotører")}
          </p>
          {/* Team-level progress bar for the primary metric (Dører) — reads at a glance */}
          <div className="mt-2 hidden sm:flex items-center gap-2">
            <div className="h-1 flex-1 max-w-[220px] rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="race-fill h-full rounded-full"
                style={{
                  width: `${doorsPct}%`,
                  background: `linear-gradient(90deg, ${hexAlpha(team.color, 0.7)}, ${team.color})`,
                  boxShadow: `0 0 8px ${hexAlpha(team.color, 0.55)}`,
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-ab-fg-4 tabular-nums">{doorsPct}%</span>
          </div>
        </div>

        {/* Summary chips — hidden until the team card has been expanded once
            (promoters + earnings + doors loaded). Otherwise pre-expansion the
            chips would misleadingly show 0/0/0%. */}
        {team.promoters.length > 0 && (
          <div className="hidden md:flex items-center gap-2">
            <SummaryChip icon={<DoorOpen className="h-3 w-3" />} label={t("Dører")} value={totalDoorsGoal ? `${totalDoors}/${totalDoorsGoal}` : `${totalDoors}`} accent="#8B5CF6" />
            <SummaryChip icon={<UserPlus className="h-3 w-3" />} label={t("Rekrutt.")} value={totalRecGoal ? `${totalRec}/${totalRecGoal}` : `${totalRec}`} accent="#0E9384" />
            <SummaryChip icon={<Activity className="h-3 w-3" />} label={t("Aktive")} value={`${avgActive}%`} accent="#F43F5E" />
          </div>
        )}

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="ml-2 flex h-8 w-8 items-center justify-center rounded-xl text-ab-fg-3 transition-colors group-hover:bg-white/[0.04] group-hover:text-ab-fg"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.3, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="relative border-t border-ab-line-1 py-4 md:px-5">
              {/* Subtle bleed from the top strip color into the expanded body */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-25"
                style={{ background: `radial-gradient(ellipse 50% 100% at 20% 0%, ${hexAlpha(team.color, 0.5)} 0%, transparent 65%)` }}
              />

              {/* Loading skeleton — only shown when the team was just opened
                  and its member/earnings/doors haven't arrived yet. */}
              {loading && team.promoters.length === 0 && (
                <div className="relative flex items-center justify-center gap-2 py-8 text-xs text-ab-fg-3">
                  <Loader2 className="h-4 w-4 animate-spin text-aurora-amber" />
                  <span>{t("Laster teamdata…")}</span>
                </div>
              )}

              {/* Empty state — data arrived but there are no employee-type members. */}
              {!loading && team.promoters.length === 0 && (
                <div className="relative text-center py-6 text-xs text-ab-fg-4">
                  {t("Ingen promotører i dette teamet ennå.")}
                </div>
              )}

              {team.promoters.length > 0 && (
              <div className="relative overflow-x-auto overscroll-x-contain px-5 md:px-0 md:overflow-x-visible">
                <div className="min-w-[620px] md:min-w-0">
                  {/* Column headers */}
                  <div className="mb-2 grid grid-cols-[28px_1fr_140px_140px_82px_100px] items-center gap-4 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
                    <span />
                    <span>{t("Promotør")}</span>
                    <span>{t("Dører")}</span>
                    <span>{t("Rekruttert")}</span>
                    <span className="text-right">{t("Aktive")}</span>
                    <span className="text-right">{t("Vervinger")}</span>
                  </div>

                  <div className="space-y-1">
                    {team.promoters.map((p, pi) => {
                      const rank        = rankById.get(p.id) ?? 0
                      const isTop3      = rank >= 1 && rank <= 3
                      const isTop1      = rank === 1
                      const doorsPctP   = Math.min(100, Math.round((p.doors / Math.max(1, p.doorsGoal)) * 100))
                      const recPctP     = Math.min(100, Math.round((p.recruited / Math.max(1, p.recruitedGoal)) * 100))
                      const activeColor = p.activePercent >= 90 ? "#10b981"
                                        : p.activePercent >= 80 ? "#4ADE80"
                                        : p.activePercent >= 65 ? "#F59E0B"
                                        :                          "#F43F5E"

                      return (
                        <motion.div
                          key={p.id}
                          initial={reduced ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: pi * 0.04, duration: 0.25 }}
                          className="group grid grid-cols-[28px_1fr_140px_140px_82px_100px] items-center gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
                        >
                          {/* Rank medal */}
                          <div className="grid h-6 w-6 place-items-center">
                            {isTop3 ? (
                              <span
                                className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-mono font-bold text-black/85"
                                style={{
                                  background:
                                    isTop1 ? "linear-gradient(135deg,#FCD34D,#F59E0B)" :
                                    rank === 2 ? "linear-gradient(135deg,#E5E7EB,#9CA3AF)" :
                                                 "linear-gradient(135deg,#FDBA74,#C2410C)",
                                  boxShadow: isTop1 ? "0 0 12px rgba(245,158,11,0.45)" : undefined,
                                }}
                              >
                                {rank}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-ab-fg-4">{rank}</span>
                            )}
                          </div>

                          {/* Avatar + name */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={p.name} color={team.color} size={26} />
                            <span className="truncate text-sm text-ab-fg">{p.name}</span>
                            {p.activePercent >= 90 && (
                              <Flame className="h-3 w-3 shrink-0 text-aurora-amber" />
                            )}
                          </div>

                          {/* Dører — mini progress bar + count */}
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                              <div
                                className="race-fill h-full rounded-full"
                                style={{
                                  width: `${doorsPctP}%`,
                                  background: `linear-gradient(90deg, ${hexAlpha("#8B5CF6", 0.7)}, #8B5CF6)`,
                                  boxShadow: `0 0 6px ${hexAlpha("#8B5CF6", 0.5)}`,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[11px] tabular-nums shrink-0">
                              <span className="font-semibold text-ab-fg">{p.doors}</span>
                              {p.doorsGoal > 0 && <span className="text-ab-fg-4">/{p.doorsGoal}</span>}
                            </span>
                          </div>

                          {/* Rekruttert — mini progress bar + count */}
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                              <div
                                className="race-fill h-full rounded-full"
                                style={{
                                  width: `${recPctP}%`,
                                  background: `linear-gradient(90deg, ${hexAlpha("#0E9384", 0.7)}, #0E9384)`,
                                  boxShadow: `0 0 6px ${hexAlpha("#0E9384", 0.5)}`,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[11px] tabular-nums shrink-0">
                              <span className="font-semibold text-ab-fg">{p.recruited}</span>
                              {p.recruitedGoal > 0 && <span className="text-ab-fg-4">/{p.recruitedGoal}</span>}
                            </span>
                          </div>

                          {/* Aktive — colored pill */}
                          <div className="flex justify-end">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-mono font-semibold"
                              style={{ background: hexAlpha(activeColor, 0.15), color: activeColor }}
                            >
                              {p.activePercent}%
                            </span>
                          </div>

                          {/* Vervinger — mono kr, highlighted for top-1 */}
                          <div className="text-right font-mono text-[11px] tabular-nums">
                            <span className={isTop1 ? "font-bold text-aurora-amber" : "font-semibold text-ab-fg"}>
                              {p.sumVervinger.toLocaleString("nb-NO")}
                            </span>
                            <span className="ml-0.5 text-ab-fg-4">kr</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Team totals footer */}
                  <div
                    className="mt-3 grid grid-cols-[28px_1fr_140px_140px_82px_100px] items-center gap-4 rounded-xl px-2 py-3"
                    style={{
                      background: `linear-gradient(90deg, ${hexAlpha(team.color, 0.08)}, ${hexAlpha(team.color, 0.02)})`,
                      border: `1px solid ${hexAlpha(team.color, 0.18)}`,
                    }}
                  >
                    <span className="grid h-6 w-6 place-items-center">
                      <Trophy className="h-3.5 w-3.5" style={{ color: team.color }} />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-ab-fg-2">{t("Team totalt")}</span>
                    <span className="font-mono text-xs font-bold text-ab-fg tabular-nums">{totalDoors}</span>
                    <span className="font-mono text-xs font-bold text-ab-fg tabular-nums">{totalRec}</span>
                    <span className="text-right font-mono text-xs font-bold tabular-nums" style={{ color: avgActive >= 80 ? "#10b981" : avgActive >= 65 ? "#F59E0B" : "#F43F5E" }}>
                      {avgActive}%
                    </span>
                    <span className="text-right font-mono text-xs font-bold text-ab-fg tabular-nums">
                      {totalVervinger.toLocaleString("nb-NO")}<span className="ml-0.5 text-ab-fg-4"> kr</span>
                    </span>
                  </div>
                </div>
              </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase D — Set-goal modal. Rendered here so it lives inside the team
          card component and gets team.id + current period automatically. */}
      {goalModalOpen && (
        <SetTeamGoalModal
          teamId={team.id}
          teamName={team.name}
          period={period}
          initialDoorsGoal={totalDoorsGoal}
          initialRecruitedGoal={totalRecGoal}
          onClose={() => setGoalModalOpen(false)}
          onSaved={() => {
            setGoalModalOpen(false)
            onGoalSaved?.(team.id)
          }}
        />
      )}
    </motion.div>
  )
}

function SummaryChip({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-ab-line-1 bg-white/[0.02] px-3 py-1.5">
      <div className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: hexAlpha(accent, 0.15), color: accent }}>
        {icon}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-ab-fg-3">{label}</span>
        <span className="font-mono text-xs font-semibold text-ab-fg">{value}</span>
      </div>
    </div>
  )
}
