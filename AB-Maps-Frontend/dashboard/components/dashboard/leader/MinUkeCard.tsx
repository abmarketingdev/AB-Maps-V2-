"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { ownCalendarApi, type DayCell, type OwnCalendarApi, type WeekResult } from "@/lib/api/scheduling"
import { DAY_SHORT, mondayOf, osloToday, rangeLabel, isoWeek, addDays, weekdayIndex } from "@/components/dashboard/kalender/dates"
import { STATE_STYLES, fmtNum } from "@/components/dashboard/kalender/states"

// «Min uke» on the promoter dashboard (boss 10.11.2026): this week Mon–Sat at a glance,
// same data and colours as Min kalender, with a link to the full page. A planned day
// with fewer than NOT_WORKED_DOORS doors is shown as «Ikke jobbet» (set automatically).

export const NOT_WORKED_DOORS = 50

function dayState(d: DayCell) {
  return STATE_STYLES[d.state] ?? STATE_STYLES.off
}

export function MinUkeCard({ api = ownCalendarApi }: { api?: OwnCalendarApi }) {
  const [week, setWeek] = React.useState<WeekResult | null>(null)
  const [error, setError] = React.useState(false)
  const today = osloToday()
  const mon = mondayOf(today)

  React.useEffect(() => {
    let live = true
    api.week(mon, 6).then((w) => { if (live) setWeek(w) }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [api, mon])

  const days = (week?.days ?? []).filter((d) => d.date >= mon && d.date <= addDays(mon, 5))
  const planned = days.filter((d) => d.shift_id)
  const goal = planned.reduce((s, d) => s + (d.goals?.doors ?? 0), 0)
  const done = days.reduce((s, d) => s + (d.actual?.doors ?? 0), 0)
  const missed = days.filter((d) => d.not_worked).length
  const pct = goal ? Math.min(100, Math.round((100 * done) / goal)) : 0

  return (
    <section id="min-uke" aria-label="Min uke" className="rounded-2xl border border-ab-line bg-ab-elevated p-4 sm:p-5 short:px-4 short:py-3 dark:border-[#25272C] dark:bg-[#16171A]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#1D4ED8] dark:bg-[#0E1A33] dark:text-[#93C5FD]">
            <CalendarDays className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ab-fg">Min uke</h3>
            <p className="text-[12px] text-ab-fg-3">Uke {isoWeek(mon)} · {rangeLabel(mon, addDays(mon, 5))}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-[12px] text-ab-fg-3">Dører denne uken</div>
            <div className="text-[15px] font-semibold tabular-nums text-ab-fg">{fmtNum(done)} <span className="font-normal text-ab-fg-3">av {fmtNum(goal)}</span></div>
          </div>
          <Link href="/employee/kalender" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[10px] border border-ab-line px-3 text-[13px] font-semibold text-ab-fg hover:bg-ab-hover">
            Se hele kalenderen <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="mt-3 short:mt-2 h-1.5 overflow-hidden rounded-full bg-ab-hover" aria-hidden>
        <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${pct}%` }} />
      </div>

      {error && <p className="mt-4 text-[13px] text-ab-fg-2">Kunne ikke hente uken. Åpne kalenderen for å prøve igjen.</p>}
      {!week && !error && (
        <div className="mt-4 short:mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[96px] short:h-[78px] animate-pulse rounded-[12px] bg-ab-hover motion-reduce:animate-none" />)}
        </div>
      )}
      {week && (
        <ol className="mt-4 short:mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {days.map((d) => {
            const s = dayState(d)
            const Icon = s.icon
            const g = d.goals?.doors ?? null
            const a = d.actual?.doors ?? null
            const auto = !!d.not_worked
            return (
              <li key={d.date} className={cn("relative overflow-hidden rounded-[12px] border-2 p-2.5 pl-3.5 short:py-2", s.card)}>
                <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", s.stripe)} />
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[13px] font-semibold text-ab-fg">{DAY_SHORT[weekdayIndex(d.date)]}</span>
                  <span className="text-[11px] tabular-nums text-ab-fg-3">{Number(d.date.slice(8))}.</span>
                </div>
                <div className={cn("mt-1 flex items-center gap-1 text-[11px] font-semibold", s.ink)}>
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{auto ? "Ikke jobbet" : s.label}</span>
                </div>
                {d.shift_id ? (
                  <div className="mt-2 short:mt-1 text-[12px] tabular-nums text-ab-fg">
                    {a !== null && d.date <= today
                      ? <><span className="text-[15px] font-semibold">{fmtNum(a)}</span><span className="text-ab-fg-3"> / {fmtNum(g)} dører</span></>
                      : <span className="text-ab-fg-2">Mål {fmtNum(g)} dører</span>}
                  </div>
                ) : (
                  <div className="mt-2 short:mt-1 text-[12px] text-ab-fg-3">Ingen vakt</div>
                )}
                {auto && <div className="mt-1 text-[10px] leading-tight text-ab-fg-3">Under {NOT_WORKED_DOORS} dører</div>}
              </li>
            )
          })}
        </ol>
      )}

      {week && (
        <p className="mt-3 short:mt-2 flex items-start gap-1.5 text-[11px] text-ab-fg-3">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            En planlagt dag med under {NOT_WORKED_DOORS} dører blir satt som «Ikke jobbet» automatisk etter dagen er over.
            {missed > 0 && <> Denne uken: <b className="font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">{missed} {missed === 1 ? "dag" : "dager"} ikke jobbet</b>.</>}
          </span>
        </p>
      )}
    </section>
  )
}
