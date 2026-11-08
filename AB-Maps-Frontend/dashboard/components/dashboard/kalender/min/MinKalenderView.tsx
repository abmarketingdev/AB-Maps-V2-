"use client"

import * as React from "react"
import { AlertTriangle, CalendarDays, ChevronRight, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/components/ui/use-mobile"
import { ownCalendarApi, type DayCell, type MoveRequest, type OwnCalendarApi } from "@/lib/api/scheduling"
import { addDays, cardDate, isoWeek, longDate, mondayOf, osloToday, weekLabel } from "../dates"
import { doorsWord, fmtNum, giversWord, initials } from "../states"
import { Btn, Surface } from "../Surface"
import { LEGEND, MinDayCard, TONES, goalText, modelFor } from "./MinDayCard"
import { MOVE_MAX_AHEAD, MinPanel, dayShort, panelHeading, type Defaults, type PanelMode } from "./MinPanel"

// «Min kalender» — the promoter's own calendar (client HTML, 06 Nov): header
// with initials + legend, three top cards (next shift, doors this week,
// givers this week), three weeks of day boxes, a side panel for the chosen
// day and the list of own move requests. Data: /api/scheduling/week/ (own
// days), own move requests, own-day goal (PATCH shifts/<id>/).
//
// Phones: cards stack, every week is a list, the side panel is a bottom sheet.

const WEEKS = 3
const REFRESH_MS = 5 * 60 * 1000

function errMsg(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Noe gikk galt. Prøv igjen."
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  venter: { label: "Venter", cls: "bg-[#FFF1CF] text-[#6B4600] dark:bg-[#271A05] dark:text-[#FCD34D]" },
  godkjent: { label: "Godkjent", cls: "bg-[#E6F5EE] text-[#135E3B] dark:bg-[#0F2417] dark:text-[#86EFAC]" },
  avslatt: { label: "Avslått", cls: "bg-[#FDECEC] text-[#8F1F1C] dark:bg-[#2A1215] dark:text-[#FCA5A5]" },
  avbrutt: { label: "Avbrutt", cls: "bg-ab-subtle text-ab-fg-3" },
}

interface MinKalenderViewProps {
  /** preview / tests pass a fake; production uses the live adapter */
  api?: OwnCalendarApi
  /** name shown when the week has no person name */
  fallbackName?: string
}

export function MinKalenderView({ api = ownCalendarApi, fallbackName = "" }: MinKalenderViewProps) {
  const isMobile = useIsMobile()
  const [today, setToday] = React.useState(() => osloToday())
  const monday = mondayOf(today)

  const [days, setDays] = React.useState<DayCell[] | null>(null)
  const [person, setPerson] = React.useState<{ name: string } | null | undefined>(undefined)
  const [teams, setTeams] = React.useState<{ team_id: string; name: string }[]>([])
  const [requests, setRequests] = React.useState<MoveRequest[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [selected, setSelected] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<PanelMode>("day")
  const [chosen, setChosen] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sentText, setSentText] = React.useState("")
  const seq = React.useRef(0)

  const load = React.useCallback(async () => {
    const my = ++seq.current
    const t = osloToday()
    setToday(t)
    setLoading(true)
    setLoadError(null)
    try {
      const [w, r] = await Promise.all([
        api.week(mondayOf(t), WEEKS * 7),
        api.myRequests().catch(() => null),
      ])
      if (my !== seq.current) return
      if (w.today && w.today !== t) setToday(w.today)
      setDays(w.days)
      setPerson(w.person ? { name: w.person.name } : null)
      setTeams(w.teams)
      setRequests(r)
    } catch (e) {
      if (my !== seq.current) return
      setLoadError(errMsg(e))
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [api])

  React.useEffect(() => {
    load()
    const id = setInterval(() => {
      if (!document.hidden) load()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  // ── derived ──────────────────────────────────────────────────────────────
  const byDate = React.useMemo(() => new Map((days ?? []).map((d) => [d.date, d])), [days])
  const cell = selected ? byDate.get(selected) ?? null : null

  const defaults = React.useMemo<Defaults>(() => {
    const d = (days ?? []).find((x) => x.goals?.source === "default")
    return d?.goals ? { doors: d.goals.doors, givers: d.goals.givers } : { doors: null, givers: null }
  }, [days])

  const weekDays = (days ?? []).filter((d) => d.date >= monday && d.date < addDays(monday, 7))
  const shiftsThisWeek = weekDays.filter((d) => d.shift_id !== null).length
  const doorsThisWeek = weekDays.reduce((n, d) => n + (d.actual?.doors ?? 0), 0)
  const giversThisWeek = weekDays.reduce((n, d) => n + (d.actual?.ja ?? 0), 0)

  const todayCell = byDate.get(today) ?? null
  const nextShift =
    (days ?? []).find(
      (d) => d.date > today && d.shift_id !== null && !(d.move_request?.status === "venter" && d.move_request.from_date === d.date),
    ) ?? null
  const hero = React.useMemo(() => {
    if (todayCell?.shift_id) {
      const d = todayCell.actual?.doors ?? 0
      return {
        label: "Du har vakt i dag",
        date: cap(longDate(today)),
        sub: `${goalText(todayCell)} · ${fmtNum(d)} ${doorsWord(d)} så langt`,
        open: today,
        goals: todayCell.goals,
      }
    }
    if (nextShift) {
      return { label: "Du er fri i dag, neste vakt", date: cap(longDate(nextShift.date)), sub: goalText(nextShift), open: nextShift.date, goals: nextShift.goals }
    }
    return { label: "Ingen planlagte vakter", date: "Ingen vakt", sub: "Salgssjefen legger inn arbeidsdagene dine.", open: null, goals: null }
  }, [todayCell, nextShift, today])
  const [mobWeek, setMobWeek] = React.useState(0)

  const picking = mode === "move" && cell
    ? { from: cell.date, chosen, allowed: (d: string) => d <= addDays(today, MOVE_MAX_AHEAD) }
    : null

  const weeks = React.useMemo(
    () =>
      Array.from({ length: WEEKS }, (_, i) => {
        const start = addDays(monday, 7 * i)
        const end = addDays(start, 6)
        const label = i === 2 ? "Om to uker" : weekLabel(start, today)
        const a = cardDate(start).date
        const b = cardDate(end).date
        return { start, label, sub: `Uke ${isoWeek(start)}, ${a} til ${b}`, cells: (days ?? []).filter((d) => d.date >= start && d.date <= end) }
      }),
    [days, monday, today],
  )

  // ── actions ──────────────────────────────────────────────────────────────
  const open = (d: DayCell) => {
    if (picking) {
      // grid click while choosing the new day
      const m = modelFor(d, today, picking)
      if (m.tone === "pick") setChosen(d.date)
      else if (m.tone === "picked") setChosen(null)
      return
    }
    setError(null)
    setSelected(d.date)
    setMode("day")
  }
  const close = () => {
    setSelected(null)
    setMode("day")
    setChosen(null)
    setError(null)
  }
  const back = () => {
    setMode("day")
    setChosen(null)
    setError(null)
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const sendMove = (toDate: string, reason: string) =>
    run(async () => {
      if (!cell?.shift_id) return
      await api.requestMove(cell.shift_id, toDate, reason)
      setSentText(`Forespørselen er sendt. Du får svar fra salgssjefen her. ${cap(longDate(toDate))} vises som byttedag i kalenderen.`)
      setMode("sent")
      setChosen(null)
      await load()
    })

  const cancelPending = (id: string) =>
    run(async () => {
      await api.cancelMove(id)
      setSentText("Forespørselen er trukket tilbake. Vakten står som før.")
      setMode("sent")
      await load()
    })

  const saveGoal = (goals: { doors: number; givers: number } | null) =>
    run(async () => {
      if (!cell?.shift_id) return
      const fresh = await api.setOwnGoals(cell.shift_id, goals)
      setDays((prev) => (prev ? prev.map((d) => (d.date === fresh.date ? fresh : d)) : prev))
      setMode("day")
    })

  // ── render ───────────────────────────────────────────────────────────────
  const name = person?.name || fallbackName || "Min kalender"
  const teamText = teams.length ? teams.map((t) => t.name).join(", ") : ""
  const fixedDays = React.useMemo(() => {
    // weekdays that are a shift in every shown week → «Faste dager mandag, tirsdag»
    if (!days?.length) return ""
    const names = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"]
    const out: string[] = []
    for (let wd = 0; wd < 7; wd++) {
      const all = weeks.every((w) => w.cells[wd]?.shift_id || (w.cells[wd] && w.cells[wd].date < today && w.cells[wd].state !== "off"))
      if (all && weeks.length === WEEKS) out.push(names[wd])
    }
    if (!out.length) return ""
    return `Faste dager ${out.length > 1 ? `${out.slice(0, -1).join(", ")} og ${out[out.length - 1]}` : out[0]}`
  }, [days, weeks, today])

  const panelProps = {
    mode,
    cell,
    today,
    cells: days ?? [],
    defaults,
    busy,
    error,
    sentText,
    chosen,
    onChoose: setChosen,
    onStartMove: () => {
      setError(null)
      setChosen(null)
      setMode("move")
    },
    onStartGoal: () => {
      setError(null)
      setMode("goal")
    },
    onSendMove: sendMove,
    onCancelPending: cancelPending,
    onSaveGoal: saveGoal,
    onBack: back,
    onClose: close,
  }
  const heading = panelHeading(mode, cell, today)
  const panelOpen = selected !== null

  return (
    <div className="min-h-screen bg-ab-base px-4 pb-14 pt-5 text-ab-fg md:px-8 md:pt-7 lg:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex w-full items-center gap-3.5 md:w-auto">
            <span
              aria-hidden
              className="order-2 ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1F4A3A] text-[15px] font-bold text-white dark:bg-[#2D6A52] md:order-none md:ml-0"
            >
              {initials(name)}
            </span>
            <div className="flex flex-col gap-0.5">
              <h1 className="font-display text-[22px] font-bold leading-tight tracking-tight md:text-[26px]">Min kalender</h1>
              <span className="text-[13px] text-ab-fg-2">
                {[name, teamText, fixedDays].filter(Boolean).join(". ")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ab-fg-2">
            {LEGEND.map((k) => (
              <span key={k} className="hidden items-center gap-1.5 rounded-[16px] border border-ab-line bg-ab-elevated px-2.5 py-1.5 md:flex">
                <span aria-hidden className={cn("h-2.5 w-2.5 rounded-[3px]", TONES[k].dot)} />
                {TONES[k].label}
              </span>
            ))}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              aria-label="Oppdater"
              className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-ab-line bg-ab-elevated text-ab-fg-2 hover:bg-ab-hover disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {loadError && !days && (
          <div className="flex flex-col items-start gap-3 rounded-[16px] border border-ab-line bg-ab-elevated p-5">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">
              <AlertTriangle className="h-4 w-4" /> Kunne ikke hente kalenderen
            </span>
            <span className="text-[13px] text-ab-fg-2">{loadError}</span>
            <Btn variant="primary" onClick={load}>Prøv igjen</Btn>
          </div>
        )}

        {person === null && (
          <div className="flex flex-col items-start gap-2 rounded-[16px] border border-ab-line bg-ab-elevated p-5">
            <span className="flex items-center gap-2 text-[14px] font-semibold"><CalendarDays className="h-4 w-4" /> Ingen kalender ennå</span>
            <span className="text-[13px] text-ab-fg-2">Kontoen din er ikke koblet til en ansatt. Ta kontakt med salgssjefen din.</span>
          </div>
        )}

        {/* Top cards */}
        {(days || loading) && person !== null && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="col-span-2 flex flex-col gap-3 rounded-[16px] border border-ab-line bg-ab-elevated px-[18px] py-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-[12px] font-semibold text-ab-fg-2">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-[#2563EB] dark:bg-[#3B82F6]" />
                  {hero.label}
                </span>
                <span className="text-[22px] font-bold leading-tight tracking-tight">{hero.date}</span>
                <span className="hidden text-[13px] text-ab-fg-2 md:block">{hero.sub}</span>
              </div>
              {/* phone: the two goals as tiles (client screen) */}
              {hero.open && (
                <div className="grid grid-cols-2 gap-2 md:hidden">
                  <div className="rounded-[12px] bg-ab-subtle px-3.5 py-2.5"><div className="text-[12px] text-ab-fg-2">Mål dører</div><div className="text-[22px] font-bold tabular-nums">{fmtNum(hero.goals?.doors ?? null)}</div></div>
                  <div className="rounded-[12px] bg-ab-subtle px-3.5 py-2.5"><div className="text-[12px] text-ab-fg-2">Mål givere</div><div className="text-[22px] font-bold tabular-nums">{fmtNum(hero.goals?.givers ?? null)}</div></div>
                </div>
              )}
              {hero.open && (
                <Btn className="h-12 w-full md:h-11 md:w-auto md:px-4 md:text-[14px]" onClick={() => { const d = byDate.get(hero.open!); if (d) open(d) }}>
                  <span className="md:hidden">Bytt dag eller endre mål</span><span className="hidden md:inline">Åpne vakten</span>
                </Btn>
              )}
            </div>
            <div className="hidden flex-col gap-1 rounded-[16px] border border-ab-line bg-ab-elevated px-[18px] py-4 md:flex">
              <span className="text-[12px] text-ab-fg-2">Dører uke {isoWeek(monday)}</span>
              <span className="text-[24px] font-bold tabular-nums">{fmtNum(doorsThisWeek)}</span>
              <span className="text-[12px] text-ab-fg-2">{shiftsThisWeek} {shiftsThisWeek === 1 ? "vakt" : "vakter"}</span>
            </div>
            <div className="hidden flex-col gap-1 rounded-[16px] border border-ab-line bg-ab-elevated px-[18px] py-4 md:flex">
              <span className="text-[12px] text-ab-fg-2">Givere uke {isoWeek(monday)}</span>
              <span className="text-[24px] font-bold tabular-nums">{fmtNum(giversThisWeek)}</span>
              <span className="text-[12px] text-ab-fg-2">
                {defaults.givers !== null ? `Mål ${fmtNum(defaults.givers)} per vakt` : "Mål ikke satt"}
              </span>
            </div>
            {/* phone: three small numbers */}
            <div className="col-span-2 grid grid-cols-3 gap-2 md:hidden">
              {[[`Vakter uke ${isoWeek(monday)}`, String(shiftsThisWeek)], ["Dører", fmtNum(doorsThisWeek)], ["Givere", fmtNum(giversThisWeek)]].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 rounded-[14px] border border-ab-line bg-ab-elevated px-3 py-2.5"><span className="truncate text-[12px] text-ab-fg-2">{k}</span><span className="text-[20px] font-bold tabular-nums">{v}</span></div>
              ))}
            </div>
          </div>
        )}

        {/* phone: week tabs + the days that matter (client screen) */}
        {person !== null && days && (
          <div className="flex flex-col gap-3 md:hidden">
            <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-ab-line bg-ab-subtle p-1" role="tablist" aria-label="Velg uke">
              {weeks.map((w, i) => (
                <button key={w.start} type="button" role="tab" aria-selected={mobWeek === i} onClick={() => setMobWeek(i)}
                  className={cn("flex min-h-[48px] flex-col items-center justify-center rounded-[11px] px-1", mobWeek === i ? "bg-ab-elevated text-ab-fg shadow-sm" : "text-ab-fg-2")}>
                  <span className="text-[13px] font-semibold">{w.label}</span>
                  <span className="text-[11px] text-ab-fg-3">{w.sub.replace(/^Uke \d+, /, "")}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {(() => {
                const w = weeks[mobWeek]
                const rows = w ? w.cells.filter((c) => c.shift_id || (c.actual?.doors ?? 0) > 0 || c.move_request?.status === "venter" || c.date === today) : []
                if (!rows.length) return <div className="rounded-[14px] border border-ab-line bg-ab-elevated px-4 py-5 text-center text-[13px] text-ab-fg-2">Ingen vakter denne uken.</div>
                return rows.map((c) => {
                  const m = modelFor(c, today, null)
                  const { day, date } = cardDate(c.date)
                  const t = TONES[m.tone]
                  return (
                    <button key={c.date} type="button" disabled={!m.clickable} onClick={() => open(c)} aria-label={`${longDate(c.date)}, ${m.title}${m.sub ? `, ${m.sub}` : ""}`}
                      className={cn("flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left", t.card, m.clickable ? "active:bg-ab-hover" : "")}>
                      <span className="flex w-[48px] shrink-0 flex-col leading-tight"><span className="text-[14px] font-bold">{day}</span><span className="text-[12px] text-ab-fg-2">{date}</span></span>
                      <span aria-hidden className={cn("h-9 w-1 shrink-0 rounded-full", t.stripe, m.tone === "muted" && "bg-ab-line-2")} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className={cn("truncate text-[14px] font-semibold", t.title)}>{m.title}</span>{m.sub && <span className="text-[12px] text-ab-fg-2">{m.sub}</span>}</span>
                      {m.badge && <span className="rounded-[6px] bg-[#EA580C] px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-[#F97316]">{m.badge}</span>}
                      {m.clickable && <ChevronRight className="h-4 w-4 shrink-0 text-ab-fg-3" aria-hidden />}
                    </button>
                  )
                })
              })()}
            </div>
            <p className="m-0 px-1 text-[12px] leading-[1.5] text-ab-fg-2">{fixedDays ? `${fixedDays}. ` : ""}Trykk på en vakt for å bytte dag eller endre dagsmålet.</p>
          </div>
        )}

        {person !== null && (
          <div className="flex flex-wrap items-start gap-5">
            {/* Calendar */}
            <div className="hidden min-w-0 flex-[999_1_640px] flex-col rounded-[18px] border border-ab-line bg-ab-elevated px-3 pb-4 pt-2 md:flex md:px-[18px] md:pb-[18px]">
              {picking && (
                <div className="mt-2.5 hidden rounded-[12px] border border-[#B9D1F7] bg-[#E8F0FD] px-3.5 py-2.5 text-[13px] font-semibold text-[#1650A8] lg:block dark:border-[#1E3A8A] dark:bg-[#0E1A33] dark:text-[#93C5FD]">
                  Velg den nye dagen direkte i kalenderen. Ledige dager er markert med stiplet blå ramme.
                </div>
              )}
              {loadError && days && (
                <div role="status" className="mt-2.5 flex items-center gap-2 rounded-[12px] border border-[#F0D28A] bg-[#FFF6E0] px-3.5 py-2 text-[13px] text-[#6B4600] dark:border-[#78350F] dark:bg-[#271A05] dark:text-[#FCD34D]">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Viser sist hentede data. {loadError}
                </div>
              )}
              {!days ? (
                <div className="flex flex-col gap-3 pt-3.5" aria-hidden>
                  {Array.from({ length: WEEKS }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-ab-subtle" />
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <div key={j} className="h-[60px] animate-pulse rounded-[12px] bg-ab-subtle md:h-[104px]" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                weeks.map((w) => (
                  <section key={w.start} aria-label={`${w.label}, ${w.sub}`} className="flex flex-col gap-2 pt-3.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[15px] font-bold">{w.label}</span>
                      <span className="text-[12px] text-ab-fg-2">{w.sub}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                      {w.cells.map((c) => {
                        const m = modelFor(c, today, picking)
                        return (
                          <MinDayCard
                            key={c.date}
                            cell={c}
                            model={m}
                            selected={!isMobile && selected === c.date && !picking}
                            dimmed={!!picking && !m.clickable && c.date !== picking.from}
                            onClick={open}
                          />
                        )
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>

            {/* Side panel (desktop) */}
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
              {!isMobile && (
                <div className="flex flex-col gap-3.5 rounded-[18px] border border-ab-line bg-ab-elevated p-[18px]">
                  {panelOpen ? (
                    <MinPanel {...panelProps} withHeader />
                  ) : (
                    <>
                      <span className="text-[16px] font-bold">Velg en dag</span>
                      <span className="text-[13px] leading-[1.5] text-ab-fg-2">
                        Klikk på en vakt i kalenderen for å bytte dag eller endre dagsmålet. Tidligere dager viser hvordan det gikk.
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Requests */}
              <div className="flex flex-col gap-2.5 rounded-[18px] border border-ab-line bg-ab-elevated p-[18px]">
                <span className="text-[16px] font-bold">Mine forespørsler</span>
                {requests === null ? (
                  <span className="text-[13px] text-ab-fg-2">Laster…</span>
                ) : requests.length === 0 ? (
                  <span className="text-[13px] text-ab-fg-2">Ingen forespørsler ennå. Åpne en vakt og velg «Bytt til en annen dag».</span>
                ) : (
                  requests.slice(0, 6).map((r) => {
                    const pill = STATUS_PILL[r.status] ?? STATUS_PILL.avbrutt
                    const sub =
                      r.status === "avslatt" && r.decline_reason
                        ? `Avslått: ${r.decline_reason}`
                        : `Bytte av vakt${r.reason ? `, ${r.reason}` : ""}`
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2.5 rounded-[12px] border border-ab-line-1 px-3 py-2.5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[14px] font-semibold">{dayShort(r.from_date)} → {dayShort(r.to_date)}</span>
                          <span className="truncate text-[12px] text-ab-fg-2">{sub}</span>
                        </div>
                        <span className={cn("shrink-0 rounded-[10px] px-2.5 py-1 text-[12px] font-bold", pill.cls)}>{pill.label}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phone: the panel is a bottom sheet */}
      {isMobile && (
        <Surface open={panelOpen} onOpenChange={(o) => { if (!o) close() }} title={heading.title} description={heading.sub || undefined}>
          <MinPanel {...panelProps} withHeader={false} />
        </Surface>
      )}
    </div>
  )
}
