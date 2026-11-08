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
  /** phone: the day whose column is shown as a list */
  phoneDay: string
  onPhoneDay: (date: string) => void
}

const DOT: Record<string, string> = {
  done: "bg-[#16A34A] dark:bg-[#3ECF8E]", plan: "bg-[#2563EB] dark:bg-[#3B82F6]", swap: "bg-[#D97706] dark:bg-[#F5A524]",
  noshow: "bg-[#DC2626] dark:bg-[#EF4444]", today: "bg-[#EA580C] dark:bg-[#F97316]",
}

export function TeamGrid({ dates, today, members, editable, selectedKey, onOpen, scrollRef, phoneDay, onPhoneDay }: TeamGridProps) {
  const past = dates[0] <= today   // current or past week → results in the totals column
  const colSub = dates.map((d) => {
    let doors = 0, on = 0
    for (const m of members) {
      const c = m.days.find((x) => x.date === d)
      if (!c) continue
      if (c.shift_id) on++
      if (c.actual) doors += c.actual.doors
    }
    if (d < today) return doors ? `${fmtNum(doors)} dører` : on ? "0 dører" : "Ingen vakter"
    return on ? `${on} på vakt` : "Ingen på vakt"
  })

  return (
    <>
    {/* phone: one day at a time, every person as a row */}
    <div className="flex flex-col gap-2 px-3 pb-4 pt-3 md:hidden">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Velg dag">
        {dates.map((d, i) => {
          const { day } = cardDate(d)
          const on = d === phoneDay
          const dots = members.map((m) => { const c = m.days.find((x) => x.date === d); if (!c) return null; const k = kindOf(c, today); return k === "off" || (k === "today" && !c.shift_id) ? null : k }).filter(Boolean).slice(0, 5) as string[]
          return (
            <button key={d} type="button" role="tab" aria-selected={on} onClick={() => onPhoneDay(d)}
              className={cn("flex min-h-[62px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] border", on ? "border-ab-fg bg-ab-fg text-ab-base" : d === today ? "border-[#EA580C] bg-ab-elevated dark:border-[#F97316]" : "border-ab-line bg-ab-elevated")}>
              <span className={cn("text-[11px] font-semibold", on ? "opacity-80" : "text-ab-fg-2")}>{day}</span>
              <span className="text-[15px] font-bold">{Number(d.slice(8, 10))}</span>
              <span className="flex h-1 gap-[2px]">{dots.map((k, j) => <i key={j} className={cn("block h-1 w-1 rounded-full", on ? "bg-ab-base/70" : DOT[k])} />)}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-baseline justify-between px-0.5 text-[12px] text-ab-fg-2">
        <span className="font-semibold text-ab-fg">{cardDate(phoneDay).day} {cardDate(phoneDay).date}{phoneDay === today ? " · I dag" : ""}</span>
        <span>{colSub[dates.indexOf(phoneDay)] ?? ""}</span>
      </div>
      {members.map((m) => {
        const cell = m.days.find((x) => x.date === phoneDay)
        if (!cell) return null
        return (
          <div key={m.person_id} className="flex items-stretch gap-2.5">
            <div className="flex w-[118px] shrink-0 items-center gap-2 overflow-hidden">
              <Avatar name={m.name} size={30} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold" title={m.name}>{m.name.split(" ")[0]}</span>
                <span className="truncate text-[11px] text-ab-fg-3">{m.default_goals ? `${fmtNum(m.default_goals.doors)}/${fmtNum(m.default_goals.givers)}` : "Uten mål"}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <TeamCell cell={cell} name={m.name} today={today} editable={editable && (cell.shift_id === null || cell.shift_editable)} selected={selectedKey === `${m.person_id}|${cell.date}`} onOpen={(c, el) => onOpen(m, c, el)} />
            </div>
          </div>
        )
      })}
      {members.length === 0 && <div className="py-6 text-center text-[13px] text-ab-fg-2">Ingen på teamet.</div>}
    </div>

    <div ref={scrollRef} className="hidden overflow-x-auto overscroll-x-contain md:block" role="grid" aria-label="Vaktkalender">
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
    </>
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
