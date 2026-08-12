"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Trophy, DoorOpen, UserPlus, X, Medal } from "lucide-react"
import { fetchLeaderboard, type LeaderItem } from "@/lib/api/dashboardOverview"
import { useLang } from "@/lib/i18n"
import { useAuth } from "@/lib/auth/AuthContext"

// ─────────────────────────────────────────────────────────────────────────────
// DailyLeaderboardPopup (client ask 2026-08-08 — "det første som skal skje er
// at du får en pop up med topplista over rekrutterte + antall dører banket").
//
// Trigger model (revised 2026-08-09 per Dana): fires once per SESSION.
//   - Page refresh inside the same session → NO re-show (sessionStorage flag)
//   - Log out + log back in → sessionStorage cleared by browser → RE-SHOWS
//   - Different tab / private mode → different sessionStorage → shows once each
//
// Falls back to a day-scoped localStorage key as a belt-and-braces safety net:
// if a browser or extension misbehaves and clears sessionStorage between
// refreshes (rare), we still cap at one popup per calendar day per user.
// User dismisses via X, backdrop click, ESC, or the CTA button.
// ─────────────────────────────────────────────────────────────────────────────

const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32", "#f59e0b", "#f59e0b"]

// Session-level dismiss key — cleared automatically when the browser session
// ends (log out → next login = fresh sessionStorage = popup fires again).
const SESSION_KEY = "abmap:leaderboard-popup:seen-this-session"

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Day-level safety-net key — capped to one popup per user per calendar day.
// Belt-and-braces so weird browser states can't spam the popup.
function dayKey(userId: string): string {
  return `abmap:leaderboard-popup:${userId}:${todayIso()}`
}

interface DailyLeaderboardPopupProps {
  campaignId?: string
  /** When true, forces the popup even if already dismissed today. Used by
   *  a "Se dagens topplista" button somewhere in the UI (future). */
  force?: boolean
}

export function DailyLeaderboardPopup({ campaignId, force = false }: DailyLeaderboardPopupProps) {
  const { t } = useLang()
  const { user } = useAuth()
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [doors, setDoors] = useState<LeaderItem[]>([])
  const [recruits, setRecruits] = useState<LeaderItem[]>([])
  // True when today's data was empty on BOTH metrics and we fell back to
  // yesterday's leaderboard so the popup isn't just "Ingen data ennå" at
  // midnight / start-of-day (2026-08-10 fix).
  const [usingYesterday, setUsingYesterday] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // On mount, decide whether to show.
  // PRIMARY gate — SESSION dismiss. Session ends on tab close / log out, so
  // a re-login naturally reopens the popup even on the same day.
  //   Page refresh mid-session → don't re-show (SESSION_KEY still set)
  //   Log out + log back in    → SESSION_KEY gone → SHOW
  // Force=true bypasses (future "Se topplista igjen" button).
  //
  // Note: no localStorage day-cap here — that would swallow the second
  // login same-day case, which is exactly what Dana wants to fire on.
  // localStorage IS still stamped on dismiss (audit / analytics only).
  useEffect(() => {
    if (!user?.user_id) return
    if (typeof window === "undefined") return
    if (!force) {
      try {
        if (window.sessionStorage.getItem(SESSION_KEY)) return
      } catch { /* private mode / disabled — fall through and show */ }
    }
    // Fetch today's data BEFORE opening — no flash of empty modal.
    // If today is completely empty (both metrics), fall back to yesterday so
    // the popup is still motivating instead of "Ingen data ennå" (2026-08-10).
    const today = todayIso()
    Promise.all([
      fetchLeaderboard("doors", 5, campaignId, today).catch(() => []),
      fetchLeaderboard("recruited", 5, campaignId, today).catch(() => []),
    ]).then(async ([d, r]) => {
      const dArr = d ?? []
      const rArr = r ?? []
      if (dArr.length === 0 && rArr.length === 0) {
        const yesterday = yesterdayIso()
        const [dy, ry] = await Promise.all([
          fetchLeaderboard("doors", 5, campaignId, yesterday).catch(() => []),
          fetchLeaderboard("recruited", 5, campaignId, yesterday).catch(() => []),
        ])
        setDoors(dy ?? [])
        setRecruits(ry ?? [])
        setUsingYesterday(true)
      } else {
        setDoors(dArr)
        setRecruits(rArr)
        setUsingYesterday(false)
      }
      setOpen(true)
    })
  }, [user?.user_id, campaignId, force])

  // ESC key to close (matches SetTeamGoalModal pattern).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function dismiss() {
    setOpen(false)
    // Set BOTH gates on dismiss:
    //   sessionStorage — quiets it for the rest of this session (refresh-safe).
    //   localStorage    — day-level safety cap so bad session state can't spam.
    try { window.sessionStorage.setItem(SESSION_KEY, "1") } catch { /* no-op */ }
    if (user?.user_id) {
      try { window.localStorage.setItem(dayKey(String(user.user_id)), "1") }
      catch { /* private mode — no-op, sessionStorage still gates the session */ }
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={dismiss}
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            className="bg-black/60 backdrop-blur-sm"
          />
          <div
            key="wrap"
            style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}
            className="flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              key="popup"
              initial={reduced ? false : { opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              style={{ pointerEvents: "auto" }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-ab-line bg-ab-elevated shadow-2xl"
            >
              {/* Amber accent stripe — "today" vibe */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                style={{ background: "linear-gradient(90deg, transparent, #f59e0b, transparent)" }}
              />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-ab-fg-3 flex items-center gap-1.5">
                    <Trophy className="h-3 w-3 text-aurora-amber" />
                    {t("Dagens topplista")}
                  </p>
                  <h3 className="mt-0.5 font-instrument text-2xl leading-tight text-ab-fg">
                    {t("Hvem leder i dag?")}
                  </h3>
                  <p className="mt-1 text-xs text-ab-fg-3">
                    {usingYesterday
                      ? t("Ingen aktivitet registrert i dag ennå — viser gårsdagens topplista.")
                      : t("Toppene av rekrutterte givere og dører banket akkurat nå.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ab-fg-3 transition-colors hover:bg-white/[0.06] hover:text-ab-fg"
                  aria-label={t("Lukk")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Two columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 pb-4">
                <Column title={t("Rekrutterte")} icon={<UserPlus className="h-3.5 w-3.5 text-emerald-400" />} rows={recruits} unit="rekrutt" />
                <Column title={t("Dører banket")} icon={<DoorOpen className="h-3.5 w-3.5 text-purple-400" />} rows={doors}    unit="dør" />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-ab-line-1 bg-white/[0.02] px-6 py-3">
                <p className="text-[10px] text-ab-fg-4">
                  {t("Denne popup vises én gang per dag.")}
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-full bg-aurora-amber px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-aurora-amber/90"
                >
                  {t("La oss knuse dagen")}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Column({ title, icon, rows, unit }: { title: string; icon: React.ReactNode; rows: LeaderItem[]; unit: string }) {
  return (
    <div className="rounded-xl border border-ab-line bg-white/[0.02] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ab-fg-3">
        {icon}{title}
      </p>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-ab-fg-4">Ingen data ennå</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const color = MEDAL_COLORS[i] ?? "rgba(255,255,255,0.3)"
            const isTop3 = i < 3
            return (
              <li key={r.name + i} className="flex items-center gap-2.5">
                <span
                  className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold text-black"
                  style={{
                    background: color,
                    boxShadow: isTop3 ? `0 0 6px ${color}55, inset 0 1px 0 rgba(255,255,255,0.3)` : `inset 0 1px 0 rgba(255,255,255,0.15)`,
                  }}
                >
                  {isTop3 && (
                    <Medal className="absolute -top-1 -right-1 h-2.5 w-2.5" style={{ color, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} aria-hidden />
                  )}
                  {r.rank}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-ab-fg">{r.name}</span>
                <span className="font-mono text-sm font-bold tabular-nums text-ab-fg">
                  {/* `score` = metric's actual sort value (recruit count for
                      "recruited", door count for "doors"). `dorerPerDag` was
                      always doors-per-day regardless of metric — meant
                      recruits used to show door counts (2026-08-10 fix). */}
                  {Math.round(r.score)}
                  <span className="ml-0.5 text-[9px] font-normal text-ab-fg-4">{unit}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
