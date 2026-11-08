"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { DayCell, GridMember } from "@/lib/api/scheduling"
import { cardDate } from "../dates"
import { doorsWord, fmtNum, giversWord } from "../states"
import { Avatar } from "./Avatar"
import { TeamCell, kindOf } from "./TeamCell"

// One week of the team: name + fast mål | 7 day cells | «Uken» totals.
// Column header carries the day's sum (doors for a past week, people on shift
// for a planning week). Scrolls sideways on narrow screens; the name column
// and the header stay put.

// Fits the card on a normal screen (no sideways scroll); below ~1024 px the
// wrapper gets a minimum width and the card scrolls instead.
const GRID: React.CSSProperties = { gridTemplateColumns: "minmax(168px, 200px) repeat(7, minmax(0, 1fr)) 96px" }

export interface RowTotal {
  main: string
  sub: string
  tone: "normal" | "muted" | "warn"
}

export function rowTotal(m: GridMember, dates: string[], today: string, past: boolean): RowTotal {
  let doors = 0, ja = 0, shifts = 0, goal = 0
  for (const c of m.days) {
    if (!dates.includes(c.date)) continue
    if (c.shift_id) shifts++
    if (c.actual) { doors += c.actual.doors; ja += c.actual.ja }
    if (c.shift_id && c.date >= today && c.goals?.doors) goal += c.goals.doors
  }
  if (shifts === 0 && doors === 0) return { main: "Ingen vakter", sub: past ? "" : "Må planlegges", tone: past ? "muted" : "warn" }
  if (past) return { main: `${fmtNum(doors)} ${doorsWord(doors)}`, sub: `${ja} ${giversWord(ja)}, ${shifts} ${shifts === 1 ? "vakt" : "vakter"}`, tone: "normal" }
  return { main: `${shifts} ${shifts === 1 ? "vakt" : "vakter"}`, sub: goal ? `Mål ${fmtNum(goal)} dører` : "Uten mål", tone: "normal" }
}

interface TeamGridProps {
  dates: string[]
  today: string
  members: GridMember[]
  editable: boolean
  selectedKey: string | null
  onOpen: (member: GridMember, cell: DayCell, el: HTMLElement) => void
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

export function TeamGrid({ dates, today, members, editable, selectedKey, onOpen, scrollRef }: TeamGridProps) {
  const past = dates[0] <= today   // current or past week → results in the totals column
  const colSub = dates.map((d) => {
    let doors = 0, on = 0
    for (const m of members) {
      const c = m.days.find((x) => x.date === d)
      if (!c) continue
      if (c.shift_id) on++
      if (c.actual) doors += c.actual.doors
    }
    if (d < today) return doors ? `${fmtNum(doors)} dører` : "Ingen vakter"
    return on ? `${on} på vakt` : "Ingen på vakt"
  })

  return (
    <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain" role="grid" aria-label="Vaktkalender">
      <div className="flex flex-col gap-1.5 px-3.5 pb-4 pt-2 max-lg:min-w-[980px]">
        <div className="sticky top-0 z-10 grid items-end gap-1.5 bg-ab-elevated py-2 pb-1.5" style={GRID} role="row">
          <div className="sticky left-0 z-[6] bg-ab-elevated pl-1.5 text-[12px] text-ab-fg-2" role="columnheader">Promotør og fast mål</div>
          {dates.map((d, i) => {
            const { day, date } = cardDate(d)
            const isToday = d === today
            return (
              <div key={d} className="flex flex-col gap-[3px] px-1" role="columnheader" data-date={d}>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[13px] font-semibold", isToday ? "text-[#2563EB] dark:text-[#7CB8FF]" : "text-ab-fg")}>{day} {date}</span>
                  {isToday && <span className="rounded-[6px] bg-[#3B9EFF] px-1.5 py-[2px] text-[10px] font-bold text-[#06121F]">I DAG</span>}
                </div>
                <span className="text-[11px] text-ab-fg-3">{colSub[i]}</span>
              </div>
            )
          })}
          <div className="pr-1.5 text-right text-[12px] text-ab-fg-2" role="columnheader">Uken</div>
        </div>

        {members.map((m) => {
          const tot = rowTotal(m, dates, today, past)
          return (
            <div key={m.person_id} className="grid items-center gap-1.5" style={GRID} role="row">
              <div className="sticky left-0 z-[5] flex min-w-0 items-center gap-2.5 bg-ab-elevated px-1.5 py-0.5" role="rowheader">
                <Avatar name={m.name} size={34} />
                <div className="flex min-w-0 flex-col gap-[2px]">
                  <span className="truncate text-[14px] font-semibold" title={m.name}>{m.name}</span>
                  <span className="text-[12px] text-ab-fg-3">
                    {m.role_label ? `${m.role_label} · ` : ""}
                    {m.default_goals
                      ? `${fmtNum(m.default_goals.doors)} ${doorsWord(m.default_goals.doors)}, ${fmtNum(m.default_goals.givers)} ${giversWord(m.default_goals.givers)}`
                      : "Uten fast mål"}
                  </span>
                </div>
              </div>
              {dates.map((d) => {
                const cell = m.days.find((x) => x.date === d)
                if (!cell) return <div key={d} />
                return (
                  <div key={d} role="gridcell" className="min-w-0">
                    <TeamCell
                      cell={cell}
                      name={m.name}
                      today={today}
                      editable={editable && (cell.shift_id === null || cell.shift_editable)}
                      selected={selectedKey === `${m.person_id}|${cell.date}`}
                      onOpen={(c, el) => onOpen(m, c, el)}
                    />
                  </div>
                )
              })}
              <div className="flex flex-col items-end gap-[2px] pr-1.5" role="gridcell">
                <span className={cn("text-[14px] font-bold tabular-nums", tot.tone === "muted" ? "text-ab-fg-3" : tot.tone === "warn" ? "text-[#B45309] dark:text-[#F5B54A]" : "text-ab-fg")}>{tot.main}</span>
                <span className="text-[11px] text-ab-fg-3">{tot.sub}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GridSkeleton({ rows = 7 }: { rows?: number }) {
  const bar = "animate-pulse rounded bg-ab-hover motion-reduce:animate-none"
  return (
    <div className="overflow-hidden" aria-busy="true" aria-label="Laster kalender">
      <div className="flex flex-col gap-1.5 px-3.5 pb-4 pt-2 max-lg:min-w-[980px]">
        <div className="grid gap-1.5 py-2" style={GRID}>
          {Array.from({ length: 9 }, (_, i) => <div key={i} className={cn(bar, "h-3 w-16")} />)}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="grid items-center gap-1.5" style={GRID}>
            <div className="flex items-center gap-2.5 px-1.5"><div className={cn(bar, "h-[34px] w-[34px] rounded-full")} /><div className="space-y-1.5"><div className={cn(bar, "h-3 w-28")} /><div className={cn(bar, "h-2.5 w-20")} /></div></div>
            {Array.from({ length: 7 }, (_, i) => <div key={i} className={cn(bar, "h-[80px] rounded-[10px]")} style={{ animationDelay: `${(r * 7 + i) * 15}ms` }} />)}
            <div className={cn(bar, "ml-auto h-3 w-16")} />
          </div>
        ))}
      </div>
    </div>
  )
}

export { kindOf }
