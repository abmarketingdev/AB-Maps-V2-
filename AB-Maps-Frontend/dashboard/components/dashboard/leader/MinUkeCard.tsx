"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ArrowRightLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { ownCalendarApi, type DayCell, type OwnCalendarApi, type WeekResult } from "@/lib/api/scheduling"
import { DAY_LONG, DAY_SHORT, WORK_DAYS, addDays, calendarAnchor, isoWeek, mondayOf, osloToday, rangeLabel, weekdayIndex } from "@/components/dashboard/kalender/dates"
import { NOT_WORKED_DOORS, fmtNum } from "@/components/dashboard/kalender/states"
import { goalMet } from "@/components/dashboard/kalender/min/MinDayCard"

// «Min uke» on the promoter dashboard (boss 10.11.2026): this week Mon–Sat as a strip of
// day rings, same data (GET /week/) and the same colours as Min kalender in the menu.
// Ring = doors against the day's door goal. Phone: tap a day for its details.

type Tone = "green" | "amber" | "orange" | "blue" | "red" | "muted"

const TONE: Record<Tone, { ring: string; ink: string; dot: string }> = {
  green: { ring: "#16A34A", ink: "text-[#15803D] dark:text-[#86EFAC]", dot: "bg-[#16A34A]" },
  amber: { ring: "#D97706", ink: "text-[#8A5A00] dark:text-[#FCD34D]", dot: "bg-[#D97706]" },
  orange: { ring: "#EA580C", ink: "text-[#C2410C] dark:text-[#FDBA74]", dot: "bg-[#EA580C]" },
  blue: { ring: "#2563EB", ink: "text-[#1D4ED8] dark:text-[#93C5FD]", dot: "bg-[#2563EB]" },
  red: { ring: "#DC2626", ink: "text-[#B91C1C] dark:text-[#FCA5A5]", dot: "bg-[#DC2626]" },
  muted: { ring: "#9CA3AF", ink: "text-ab-fg-3", dot: "bg-ab-fg-3" },
}

interface View { tone: Tone; label: string; center: string; progress: number | null; dashed: boolean; detail: string }

function view(d: DayCell): View {
  const doors = d.actual?.doors ?? 0
  const goal = d.goals?.doors ?? null
  const prog = goal ? Math.min(1, doors / goal) : doors > 0 ? 1 : 0
  const of = goal !== null ? ` av ${fmtNum(goal)}` : ""
  if (d.state === "no_show") {
    return d.not_worked
      ? { tone: "red", label: "Ikke jobbet", center: fmtNum(doors), progress: prog, dashed: false, detail: `${fmtNum(doors)}${of} dører · under ${NOT_WORKED_DOORS}` }
      : { tone: "red", label: "Ikke møtt", center: "✕", progress: 1, dashed: false, detail: "Satt av salgssjefen" }
  }
  if (d.state === "today") {
    return d.shift_id
      ? { tone: "orange", label: "I dag", center: fmtNum(doors), progress: prog, dashed: false, detail: `${fmtNum(doors)}${of} dører så langt` }
      : { tone: "muted", label: "Fri i dag", center: doors ? fmtNum(doors) : "–", progress: null, dashed: false, detail: doors ? `${fmtNum(doors)} dører` : "Ingen vakt" }
  }
  if (d.state === "worked") {
    const met = goalMet(d)
    return { tone: met === false ? "amber" : "green", label: met === false ? "Under mål" : d.shift_id ? "Nådde mål" : "Jobbet", center: fmtNum(doors), progress: d.shift_id ? prog : 1, dashed: false, detail: `${fmtNum(doors)}${of} dører` }
  }
  if (d.state === "planned") {
    const moving = d.move_request?.status === "venter"
    return { tone: moving ? "amber" : "blue", label: moving ? "Bytte venter" : "Vakt", center: goal !== null ? fmtNum(goal) : "•", progress: null, dashed: true, detail: moving && d.move_request ? `Til ${DAY_SHORT[weekdayIndex(d.move_request.to_date)].toLowerCase()} ${Number(d.move_request.to_date.slice(8))}.${Number(d.move_request.to_date.slice(5, 7))}, venter på svar` : goal !== null ? `Mål ${fmtNum(goal)} dører` : "Vakt" }
  }
  return { tone: "muted", label: "Fri", center: "–", progress: null, dashed: false, detail: "Ingen vakt" }
}

function Ring({ v, size }: { v: View; size: number }) {
  const sw = 3.5
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const col = TONE[v.tone].ring
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
        stroke={v.dashed ? col : "currentColor"} className={v.dashed ? "" : "text-ab-line dark:text-[#2A2D33]"}
        strokeDasharray={v.dashed ? "3 4" : undefined} strokeOpacity={v.dashed ? 0.7 : 1} />
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
  const [picked, setPicked] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    const t = osloToday()
    setToday(t)
    api.week(mondayOf(calendarAnchor(t)), WORK_DAYS).then((w) => { setWeek(w); setError(false) }).catch(() => setError(true))
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
  const sel = days.find((d) => d.date === picked) ?? days.find((d) => d.date === today) ?? days[0]
  const selView = sel ? view(sel) : null

  return (
    <section id="min-uke" aria-label="Min uke" className="min-w-0 overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated px-4 py-3.5 sm:px-5 dark:border-[#25272C] dark:bg-[#16171A]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        {/* header: title + week + total */}
        <div className="flex items-center justify-between gap-3 lg:w-[210px] lg:shrink-0 lg:flex-col lg:items-start lg:gap-1.5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight text-ab-fg">Min uke</h3>
            <p className="text-[12px] text-ab-fg-3">Uke {isoWeek(mon)} · {rangeLabel(mon, addDays(mon, WORK_DAYS - 1))}</p>
          </div>
          {week?.person && (
            <div className="text-right lg:w-full lg:text-left">
              <div className="text-[13px] tabular-nums text-ab-fg"><b className="font-semibold">{fmtNum(done)}</b><span className="text-ab-fg-3"> / {fmtNum(goal)} dører</span></div>
              <div className="mt-1 hidden h-1 w-full overflow-hidden rounded-full bg-ab-hover lg:block" aria-hidden>
                <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${goal ? Math.min(100, (100 * done) / goal) : 0}%` }} />
              </div>
              {missed > 0 && <div className="mt-0.5 text-[11px] font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">{missed} {missed === 1 ? "dag" : "dager"} ikke jobbet</div>}
            </div>
          )}
        </div>

        {/* days */}
        {error && !week && <p className="flex-1 text-[13px] text-ab-fg-2">Kunne ikke hente uken.</p>}
        {!week && !error && (
          <div className="grid flex-1 grid-cols-6 gap-1.5" aria-busy>
            {Array.from({ length: WORK_DAYS }).map((_, i) => <div key={i} className="h-[74px] animate-pulse rounded-xl bg-ab-hover motion-reduce:animate-none" />)}
          </div>
        )}
        {week && !week.person && (
          <p className="flex-1 text-[13px] text-ab-fg-2">Ingen vakter planlagt ennå. Salgssjefen legger inn arbeidsdagene dine.</p>
        )}
        {week?.person && (
          <ol className="grid flex-1 grid-cols-6 gap-1 sm:gap-1.5">
            {days.map((d) => {
              const v = view(d)
              const isToday = d.date === today
              const isSel = sel?.date === d.date
              return (
                <li key={d.date}>
                  <button type="button" onClick={() => setPicked(d.date)} aria-pressed={isSel}
                    aria-label={`${DAY_LONG[weekdayIndex(d.date)]} ${Number(d.date.slice(8))}.: ${v.label}, ${v.detail}`}
                    className={cn("flex w-full flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-colors sm:cursor-default",
                      isToday ? "bg-[#FFF7ED] ring-1 ring-inset ring-[#EA580C]/40 dark:bg-[#2B1709]/70" : "hover:bg-ab-hover sm:hover:bg-transparent",
                      isSel && !isToday && "bg-ab-hover sm:bg-transparent")}>
                    <span className={cn("text-[11px] font-semibold leading-none", isToday ? TONE.orange.ink : "text-ab-fg-2")}>
                      {DAY_SHORT[weekdayIndex(d.date)]} <span className="font-normal text-ab-fg-3">{Number(d.date.slice(8))}.</span>
                    </span>
                    <span className="relative flex items-center justify-center">
                      <Ring v={v} size={40} />
                      <span className={cn("absolute text-[12px] font-semibold tabular-nums", v.tone === "muted" ? "text-ab-fg-3" : v.dashed ? TONE[v.tone].ink : "text-ab-fg")}>{v.center}</span>
                      {d.move_request?.status === "venter" && <ArrowRightLeft className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-ab-elevated p-[1px] text-[#D97706] dark:bg-[#16171A]" aria-hidden />}
                    </span>
                    <span className={cn("hidden max-w-full truncate px-0.5 text-[11px] font-medium leading-none sm:block", TONE[v.tone].ink)}>{v.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        <Link href="/employee/kalender" className="hidden min-h-[36px] shrink-0 items-center gap-1.5 self-center rounded-[10px] border border-ab-line px-3 text-[13px] font-semibold text-ab-fg hover:bg-ab-hover lg:inline-flex">
          Kalender <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* phone + tablet: the picked day in one line, and the link */}
      {week?.person && sel && selView && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ab-line pt-2.5 lg:hidden dark:border-[#25272C]">
          <div className="flex min-w-0 flex-1 items-start gap-2 text-[13px] leading-snug" aria-live="polite">
            <span className={cn("mt-[6px] h-2 w-2 shrink-0 rounded-full", TONE[selView.tone].dot)} aria-hidden />
            <span className="min-w-0"><b className="font-semibold text-ab-fg">{DAY_LONG[weekdayIndex(sel.date)]}</b> <span className={TONE[selView.tone].ink}>{selView.label}</span><span className="text-ab-fg-2"> · {selView.detail}</span></span>
          </div>
          <Link href="/employee/kalender" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[#2563EB] dark:text-[#7CB8FF]">
            Kalender <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  )
}
