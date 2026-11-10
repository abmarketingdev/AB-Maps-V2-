"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ArrowRightLeft, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { ownCalendarApi, type DayCell, type OwnCalendarApi, type WeekResult } from "@/lib/api/scheduling"
import { DAY_LONG, DAY_SHORT, WORK_DAYS, addDays, calendarAnchor, isoWeek, mondayOf, osloToday, rangeLabel, weekdayIndex } from "@/components/dashboard/kalender/dates"
import { NOT_WORKED_DOORS, fmtNum, fmtPct } from "@/components/dashboard/kalender/states"
import { goalMet } from "@/components/dashboard/kalender/min/MinDayCard"
import { MinPanel, panelHeading, type Defaults, type PanelMode } from "@/components/dashboard/kalender/min/MinPanel"
import { Surface } from "@/components/dashboard/kalender/Surface"

// «Min uke» on the promoter dashboard (boss 10.11.2026): this week Mon–Sat as a strip of
// day rings, same data (GET /week/) and the same colours as Min kalender in the menu.
// Ring = doors against the day's door goal. Tap a day: a popup (bottom sheet on phones)
// with the day and the same actions as Min kalender (move the day, change the goal),
// built on its MinPanel so the two never drift apart.

const AHEAD = 21   // this week + two: the free days «Bytt til en annen dag» can offer

type Tone = "green" | "amber" | "orange" | "blue" | "red" | "muted"

const TONE: Record<Tone, { ring: string; ink: string; dot: string }> = {
  green: { ring: "#16A34A", ink: "text-[#15803D] dark:text-[#86EFAC]", dot: "bg-[#16A34A]" },
  amber: { ring: "#D97706", ink: "text-[#8A5A00] dark:text-[#FCD34D]", dot: "bg-[#D97706]" },
  orange: { ring: "#EA580C", ink: "text-[#C2410C] dark:text-[#FDBA74]", dot: "bg-[#EA580C]" },
  blue: { ring: "#2563EB", ink: "text-[#1D4ED8] dark:text-[#93C5FD]", dot: "bg-[#2563EB]" },
  red: { ring: "#DC2626", ink: "text-[#B91C1C] dark:text-[#FCA5A5]", dot: "bg-[#DC2626]" },
  muted: { ring: "#9CA3AF", ink: "text-ab-fg-3", dot: "bg-ab-fg-3" },
}

interface View {
  tone: Tone; label: string; center: string; progress: number | null; dashed: boolean; detail: string
  /** card body: a big number with «/ goal dører», or a plain line */
  big: string | null; of: string | null; line: string | null; sub: string | null
}

const mr = (d: DayCell) => d.move_request?.status === "venter" && d.move_request.from_date === d.date
const dm = (iso: string) => `${DAY_SHORT[weekdayIndex(iso)].toLowerCase()} ${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}`

function view(d: DayCell): View {
  const doors = d.actual?.doors ?? 0
  const goal = d.goals?.doors ?? null
  const prog = goal ? Math.min(1, doors / goal) : doors > 0 ? 1 : 0
  const of = goal !== null ? ` av ${fmtNum(goal)}` : ""
  const ofGoal = goal !== null ? `/ ${fmtNum(goal)} dører` : "dører"
  const mr = d.move_request?.status === "venter" ? d.move_request : null
  const ja = d.actual?.ja ?? 0
  const givers = `${fmtNum(ja)} ${ja === 1 ? "giver" : "givere"}`
  if (d.state === "no_show") {
    return d.not_worked
      ? { tone: "red", label: "Ikke jobbet", center: fmtNum(doors), progress: prog, dashed: false, detail: `${fmtNum(doors)}${of} dører · under ${NOT_WORKED_DOORS}`, big: fmtNum(doors), of: ofGoal, line: null, sub: `Under ${NOT_WORKED_DOORS} dører` }
      : { tone: "red", label: "Ikke møtt", center: "✕", progress: 1, dashed: false, detail: "Satt av salgssjefen", big: null, of: null, line: "Satt av salgssjefen", sub: null }
  }
  if (d.state === "today") {
    const left = goal !== null ? Math.max(0, goal - doors) : null
    return d.shift_id
      ? { tone: "orange", label: "I dag", center: fmtNum(doors), progress: prog, dashed: false, detail: `${fmtNum(doors)}${of} dører så langt`, big: fmtNum(doors), of: ofGoal, line: null, sub: mr && mr.from_date === d.date ? `Bytte til ${dm(mr.to_date)} venter` : left === null ? "så langt" : left === 0 ? "Mål nådd!" : `${fmtNum(left)} igjen` }
      : { tone: "muted", label: "Fri i dag", center: doors ? fmtNum(doors) : "–", progress: null, dashed: false, detail: doors ? `${fmtNum(doors)} dører` : "Ingen vakt", big: doors ? fmtNum(doors) : null, of: doors ? "dører" : null, line: doors ? null : "Ingen vakt", sub: null }
  }
  if (d.state === "worked") {
    const met = goalMet(d)
    return { tone: met === false ? "amber" : "green", label: met === false ? "Under mål" : d.shift_id ? "Nådde mål" : "Jobbet", center: fmtNum(doors), progress: d.shift_id ? prog : 1, dashed: false, detail: `${fmtNum(doors)}${of} dører`, big: fmtNum(doors), of: ofGoal, line: null, sub: givers }
  }
  if (d.state === "planned") {
    return mr
      ? { tone: "amber", label: "Bytte venter", center: goal !== null ? fmtNum(goal) : "•", progress: null, dashed: true, detail: `Til ${dm(mr.to_date)}, venter på svar`, big: null, of: null, line: `Til ${dm(mr.to_date)}`, sub: "Venter på svar" }
      : { tone: "blue", label: "Planlagt", center: goal !== null ? fmtNum(goal) : "•", progress: null, dashed: true, detail: goal !== null ? `Mål ${fmtNum(goal)} dører` : "Vakt", big: null, of: null, line: goal !== null ? `Mål ${fmtNum(goal)} dører` : "Mål ikke satt", sub: d.goals?.source === "override" ? "Justert" : null }
  }
  if (mr && mr.to_date === d.date) {
    return { tone: "amber", label: "Byttedag", center: "•", progress: null, dashed: true, detail: `Fra ${dm(mr.from_date)}, venter på svar`, big: null, of: null, line: `Fra ${dm(mr.from_date)}`, sub: "Venter på svar" }
  }
  return { tone: "muted", label: "Fri", center: "–", progress: null, dashed: false, detail: "Ingen vakt", big: doors ? fmtNum(doors) : null, of: doors ? "dører" : null, line: doors ? null : "Ingen vakt", sub: null }
}

function Ring({ v, size, sw = 3.5 }: { v: View; size: number; sw?: number }) {
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const col = TONE[v.tone].ring
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
        stroke={v.dashed ? col : "currentColor"} className={v.dashed ? "" : "text-ab-line dark:text-[#2A2D33]"}
        strokeDasharray={v.dashed ? (size > 60 ? "4 6" : "3 4") : undefined} strokeOpacity={v.dashed ? 0.7 : 1} />
      {v.progress !== null && v.progress > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${c * v.progress} ${c}`} />
      )}
    </svg>
  )
}

export function MinUkeCard({ api = ownCalendarApi }: { api?: OwnCalendarApi }) {
  const [week, setWeek] = React.useState<WeekResult | null>(null)
  const [error, setError] = React.useState(false)
  const [today, setToday] = React.useState(() => osloToday())
  const mon = mondayOf(calendarAnchor(today))   // Sunday → the coming week, like Min kalender
  const rowRef = React.useRef<HTMLOListElement>(null)
  // popup
  const [openDate, setOpenDate] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<PanelMode>("day")
  const [chosen, setChosen] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [sentText, setSentText] = React.useState("")

  const load = React.useCallback(() => {
    const t = osloToday()
    setToday(t)
    return api.week(mondayOf(calendarAnchor(t)), AHEAD).then((w) => { setWeek(w); setError(false) }).catch(() => setError(true))
  }, [api])
  // same rhythm as Din dag: reload every minute and when the tab comes back
  React.useEffect(() => {
    load()
    const id = window.setInterval(load, 60_000)
    const vis = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", vis)
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", vis) }
  }, [load])

  const days = week?.person ? week.days.filter((d) => d.date >= mon && d.date <= addDays(mon, WORK_DAYS - 1)) : []
  const goal = days.reduce((s, d) => s + (d.shift_id ? d.goals?.doors ?? 0 : 0), 0)
  const done = days.reduce((s, d) => s + (d.actual?.doors ?? 0), 0)
  const missed = days.filter((d) => d.not_worked).length

  const hasWeek = !!week?.person
  React.useEffect(() => {
    const row = rowRef.current
    const el = row?.querySelector<HTMLElement>("[data-today]")
    if (row && el && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, el.offsetLeft - 16)
  }, [hasWeek])

  const all = week?.person ? week.days : []
  const cell = all.find((d) => d.date === openDate) ?? null
  const defaults = React.useMemo<Defaults>(() => {
    const d = all.find((x) => x.goals?.source === "default")
    return d?.goals ? { doors: d.goals.doors, givers: d.goals.givers } : { doors: null, givers: null }
  }, [all])
  const openDay = (date: string) => { setOpenDate(date); setMode("day"); setChosen(null); setErr(null) }
  const close = () => { setOpenDate(null); setMode("day"); setChosen(null); setErr(null) }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr(e instanceof Error && e.message ? e.message : "Noe gikk galt. Prøv igjen.") } finally { setBusy(false) }
  }
  const heading = panelHeading(mode, cell, today)

  return (
    <section id="min-uke" aria-label="Min uke" className="min-w-0 overflow-hidden [contain:inline-size] rounded-2xl border border-ab-line bg-ab-elevated px-4 py-3.5 sm:px-5 dark:border-[#25272C] dark:bg-[#16171A]">
      {/* header: title + week · total + link */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[15px] font-semibold leading-tight text-ab-fg">Min uke</h3>
          <span className="truncate text-[12px] text-ab-fg-3">Uke {isoWeek(mon)} · {rangeLabel(mon, addDays(mon, WORK_DAYS - 1))}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {week?.person && (
            <div className="hidden items-center gap-2.5 sm:flex">
              {missed > 0 && <span className="rounded-full bg-[#DC2626]/10 px-2 py-0.5 text-[11px] font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">{missed} {missed === 1 ? "dag" : "dager"} ikke jobbet</span>}
              <span className="text-[13px] tabular-nums text-ab-fg"><b className="font-semibold">{fmtNum(done)}</b><span className="text-ab-fg-3"> av {fmtNum(goal)} dører</span></span>
              <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-ab-hover md:block" aria-hidden>
                <span className="block h-full rounded-full bg-[#2563EB]" style={{ width: `${goal ? Math.min(100, (100 * done) / goal) : 0}%` }} />
              </span>
            </div>
          )}
          <Link href="/employee/kalender" className="inline-flex min-h-[32px] items-center gap-1 rounded-[10px] text-[13px] font-semibold text-[#2563EB] hover:underline sm:border sm:border-ab-line sm:px-2.5 sm:text-ab-fg sm:hover:bg-ab-hover sm:hover:no-underline dark:text-[#7CB8FF] sm:dark:text-ab-fg">
            Kalender <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
      {week?.person && (
        <div className="mt-1 flex items-center gap-2 text-[12px] sm:hidden">
          <span className="tabular-nums text-ab-fg"><b className="font-semibold">{fmtNum(done)}</b><span className="text-ab-fg-3"> av {fmtNum(goal)} dører</span></span>
          {missed > 0 && <span className="font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">· {missed} {missed === 1 ? "dag" : "dager"} ikke jobbet</span>}
        </div>
      )}

      {/* days */}
      {error && !week && <p className="mt-3 text-[13px] text-ab-fg-2">Kunne ikke hente uken.</p>}
      {!week && !error && (
        <div className="mt-3 flex gap-2 overflow-hidden md:grid md:grid-cols-6" aria-busy>
          {Array.from({ length: WORK_DAYS }).map((_, i) => <div key={i} className="h-[92px] w-[132px] shrink-0 animate-pulse rounded-xl bg-ab-hover motion-reduce:animate-none md:w-auto" />)}
        </div>
      )}
      {week && !week.person && (
        <p className="mt-3 text-[13px] text-ab-fg-2">Ingen vakter planlagt ennå. Salgssjefen legger inn arbeidsdagene dine.</p>
      )}
      {week?.person && (
        <ol ref={rowRef} className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:scroll-px-5 sm:px-5 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
          {days.map((d) => {
            const v = view(d)
            const t = TONE[v.tone]
            const isToday = d.date === today
            return (
              <li key={d.date} data-today={isToday || undefined} className="w-[136px] shrink-0 snap-start md:w-auto">
                <button type="button" onClick={() => openDay(d.date)} aria-haspopup="dialog"
                  aria-label={`${DAY_LONG[weekdayIndex(d.date)]} ${Number(d.date.slice(8))}.: ${v.label}, ${v.detail}`}
                  style={v.tone === "muted" ? undefined : { backgroundColor: `${t.ring}${isToday ? "1F" : "12"}`, borderColor: `${t.ring}${isToday ? "B3" : "4D"}` }}
                  className={cn("group relative flex h-full w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-[transform,box-shadow,border-color] duration-150",
                    "hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.5)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                    v.tone === "muted" && "border-ab-line bg-ab-subtle/40 dark:border-[#2A2D33] dark:bg-transparent",
                    isToday && "shadow-[0_0_0_3px_rgba(234,88,12,0.12)]")}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex items-baseline gap-1.5 leading-none">
                      <span className="text-[13px] font-semibold text-ab-fg">{DAY_SHORT[weekdayIndex(d.date)]}</span>
                      <span className="text-[11px] text-ab-fg-3">{Number(d.date.slice(8))}.</span>
                    </span>
                    <span className="relative -mr-0.5 -mt-0.5 flex items-center justify-center">
                      <Ring v={v} size={26} sw={3} />
                      {mr(d) && <ArrowRightLeft className="absolute h-3 w-3 text-[#D97706]" aria-hidden />}
                    </span>
                  </span>
                  <span className={cn("flex items-center gap-1 text-[11px] font-semibold leading-none", t.ink)}>
                    <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", v.tone === "muted" ? "bg-ab-fg-3" : t.dot)} />
                    <span className="truncate">{v.label}</span>
                  </span>
                  <span className="mt-0.5 min-w-0 truncate text-[12px] leading-tight text-ab-fg-2">
                    {v.big !== null
                      ? <><b className="text-[18px] font-bold tabular-nums tracking-tight text-ab-fg">{v.big}</b> <span className="text-ab-fg-3">{v.of}</span></>
                      : <span className="text-[13px] font-medium text-ab-fg">{v.line}</span>}
                  </span>
                  {v.sub && <span className={cn("truncate text-[11px] leading-none", v.tone === "red" ? t.ink : "text-ab-fg-3")}>{v.sub}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <Surface open={!!cell} onOpenChange={(o) => { if (!o) close() }} size="sm" title={heading.title} description={heading.sub || undefined}>
        {cell && (
          <div className="flex flex-col gap-4">
            {mode === "day" && <DayHero days={days} cell={cell} today={today} onPick={openDay} />}
            <MinPanel
              mode={mode} cell={cell} today={today} cells={all} defaults={defaults} busy={busy} error={err} sentText={sentText}
              chosen={chosen} onChoose={setChosen} withHeader={false} hideStats
              onStartMove={() => { setErr(null); setChosen(null); setMode("move") }}
              onStartGoal={() => { setErr(null); setMode("goal") }}
              onSendMove={(to, reason) => run(async () => {
                if (!cell.shift_id) return
                await api.requestMove(cell.shift_id, to, reason)
                setSentText(`Forespørselen er sendt. Du får svar fra salgssjefen i kalenderen. ${DAY_LONG[weekdayIndex(to)]} ${Number(to.slice(8))}.${Number(to.slice(5, 7))} vises som byttedag.`)
                setMode("sent"); setChosen(null)
                await load()
              })}
              onCancelPending={(id) => run(async () => {
                await api.cancelMove(id)
                setSentText("Forespørselen er trukket tilbake. Vakten står som før.")
                setMode("sent")
                await load()
              })}
              onSaveGoal={(goals) => run(async () => {
                if (!cell.shift_id) return
                const fresh = await api.setOwnGoals(cell.shift_id, goals)
                setWeek((w) => (w ? { ...w, days: w.days.map((d) => (d.date === fresh.date ? fresh : d)) } : w))
                setMode("day")
              })}
              onBack={() => { setMode("day"); setChosen(null); setErr(null) }}
              onClose={close}
            />
          </div>
        )}
      </Surface>
    </section>
  )
}

/** Top of the popup: hop between the week's days, a big ring and the day's numbers. */
function DayHero({ days, cell, today, onPick }: { days: DayCell[]; cell: DayCell; today: string; onPick: (date: string) => void }) {
  const v = view(cell)
  const t = TONE[v.tone]
  const a = cell.actual
  const goal = cell.goals?.doors ?? null
  const shiftToday = cell.date === today && cell.shift_id !== null
  const showNums = !!a && (cell.shift_id !== null || a.doors > 0) && cell.date <= today
  return (
    <>
      <div className="grid grid-cols-6 gap-1 rounded-[14px] bg-ab-subtle p-1 dark:bg-[#1C1D21]" role="tablist" aria-label="Dager denne uken">
        {days.map((d) => {
          const dv = view(d)
          const on = d.date === cell.date
          return (
            <button key={d.date} type="button" role="tab" aria-selected={on} onClick={() => onPick(d.date)}
              className={cn("flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[10px] text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
                on ? "bg-ab-elevated text-ab-fg shadow-[0_1px_3px_rgba(16,24,40,0.12)] dark:bg-[#2A2D33]" : "text-ab-fg-2 hover:text-ab-fg")}>
              <span className="leading-none">{DAY_SHORT[weekdayIndex(d.date)]}<span className="font-normal text-ab-fg-3"> {Number(d.date.slice(8))}</span></span>
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dv.tone === "muted" ? "bg-ab-line-2" : TONE[dv.tone].dot, d.date === today && "ring-2 ring-[#EA580C]/30")} />
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4">
        <span className="relative flex shrink-0 items-center justify-center">
          <Ring v={v} size={92} sw={7} />
          <span className="absolute flex flex-col items-center leading-none">
            <span className={cn("text-[26px] font-bold tabular-nums tracking-tight", v.tone === "muted" ? "text-ab-fg-3" : v.dashed ? t.ink : "text-ab-fg")}>{v.center}</span>
            {goal !== null && !v.dashed && cell.shift_id && <span className="mt-1 text-[11px] text-ab-fg-3">av {fmtNum(goal)}</span>}
            {v.dashed && goal !== null && <span className="mt-1 text-[11px] text-ab-fg-3">mål</span>}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", t.ink)} style={{ backgroundColor: `${t.ring}1A` }}>
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />{v.label}
          </span>
          <span className="text-[13px] leading-snug text-ab-fg-2">{v.detail}</span>
          {showNums && a && (
            <div className="flex gap-4 pt-0.5 text-[12px] text-ab-fg-3">
              <span><b className="text-[15px] font-semibold tabular-nums text-ab-fg">{fmtNum(a.ja)}</b> givere</span>
              <span><b className="text-[15px] font-semibold tabular-nums text-ab-fg">{fmtPct(a.ja_pct ?? 0)}</b> ja</span>
            </div>
          )}
        </div>
      </div>

      {shiftToday && (
        <button type="button" onClick={() => { window.location.href = "/emp/" }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#EA580C] to-[#F59E0B] text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(234,88,12,0.7)] transition-transform hover:brightness-105 active:scale-[0.99] motion-reduce:transition-none">
          <Plus className="h-4 w-4" /> Registrer dør
        </button>
      )}
    </>
  )
}
