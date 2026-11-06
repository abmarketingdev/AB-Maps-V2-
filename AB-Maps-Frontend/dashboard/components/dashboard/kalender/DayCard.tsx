"use client"

import * as React from "react"
import { ArrowRightLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DayCell } from "@/lib/api/scheduling"
import { cardDate, shortDate } from "./dates"
import { STATE_STYLES, fmtNum, fmtPct } from "./states"

// One day box. Always: date on top («Tor 12.11»), state colour as outlined
// card + left stripe + icon. Body by state:
//   planned → Mål X dører / Y givere     worked → doors + Ja %
//   today   → doors so far / goal          no_show → IKKE MØTT     off → Fri

function Ring({ value, goal, className }: { value: number; goal: number; className?: string }) {
  const r = 7
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, goal > 0 ? value / goal : 0))
  return (
    <svg viewBox="0 0 18 18" className={cn("h-[18px] w-[18px] -rotate-90", className)} aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
      <circle
        cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
      />
    </svg>
  )
}

export function describeCell(cell: DayCell): string {
  const { day, date } = cardDate(cell.date)
  const s = STATE_STYLES[cell.state].label
  const parts = [`${day} ${date}`, s]
  if (cell.goals && (cell.state === "planned" || cell.state === "today")) {
    parts.push(`mål ${fmtNum(cell.goals.doors)} dører, ${fmtNum(cell.goals.givers)} givere`)
  }
  if (cell.actual && (cell.state === "worked" || cell.state === "today")) {
    parts.push(`${cell.actual.doors} dører, Ja ${fmtPct(cell.actual.ja_pct)}`)
  }
  const mr = cell.move_request
  if (mr?.status === "venter") {
    parts.push(
      mr.to_date === cell.date
        ? `ønsket ny arbeidsdag (flytting fra ${shortDate(mr.from_date)})`
        : `ber om flytting til ${shortDate(mr.to_date)}`,
    )
  }
  if (cell.shift_id && !cell.shift_editable && cell.shift_team_name) parts.push(`planlagt av ${cell.shift_team_name}`)
  return parts.join(", ")
}

interface DayCardProps {
  cell: DayCell
  editable: boolean
  selected?: boolean
  onOpen?: (cell: DayCell, el: HTMLElement) => void
}

export const DayCard = React.memo(function DayCard({ cell, editable, selected, onOpen }: DayCardProps) {
  const st = STATE_STYLES[cell.state]
  const Icon = st.icon
  const { day, date } = cardDate(cell.date)
  const pending = cell.move_request?.status === "venter"
  const override = cell.goals?.source === "override"

  let main: React.ReactNode
  let sub: React.ReactNode = null
  switch (cell.state) {
    case "planned":
      main = cell.goals && (cell.goals.doors !== null || cell.goals.givers !== null) ? (
        <>
          <span className="mr-1 hidden text-[11px] font-medium text-ab-fg-2 md:inline">Mål</span>
          <span className="tabular-nums">{fmtNum(cell.goals.doors)}</span>
          <span className="ml-1 text-[11px] font-medium text-ab-fg-2">dører</span>
        </>
      ) : (
        <span className="text-[12px] font-medium text-ab-fg-3">Uten mål</span>
      )
      sub = cell.goals && cell.goals.givers !== null ? <>{fmtNum(cell.goals.givers)} givere</> : null
      break
    case "worked":
      main = (
        <>
          <span className="tabular-nums">{fmtNum(cell.actual?.doors ?? 0)}</span>
          <span className="ml-1 text-[11px] font-medium text-ab-fg-2">dører</span>
        </>
      )
      sub = <>Ja {fmtPct(cell.actual?.ja_pct)}</>
      break
    case "today":
      if (!cell.shift_id && !cell.actual?.doors) {
        main = <span className="text-[12px] font-medium text-ab-fg-2">Fri i dag</span>
        break
      }
      main = (
        <>
          <span className="tabular-nums">{fmtNum(cell.actual?.doors ?? 0)}</span>
          {cell.goals?.doors != null && (
            <span className="text-[11px] font-medium text-ab-fg-2 tabular-nums">/{fmtNum(cell.goals.doors)}</span>
          )}
          <span className="ml-1 text-[11px] font-medium text-ab-fg-2">dører</span>
        </>
      )
      sub = cell.goals?.givers != null ? <>Mål {fmtNum(cell.goals.givers)} givere</> : <>Ja {fmtPct(cell.actual?.ja_pct)}</>
      break
    case "no_show":
      main = <span className={cn("text-[11px] font-bold uppercase tracking-[0.06em]", st.ink)}>Ikke møtt</span>
      break
    case "off":
      main = <span className="text-[12px] font-medium text-ab-fg-3">Fri</span>
      break
  }

  const ring =
    (cell.state === "worked" || cell.state === "today") && cell.goals?.doors ? (
      <Ring value={cell.actual?.doors ?? 0} goal={cell.goals.doors} className={cn("hidden shrink-0 md:block", st.ink)} />
    ) : null

  const body = (
    <>
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", st.stripe)} aria-hidden />
      <span className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] leading-4">
          <span className="font-semibold text-ab-fg">{day}</span>{" "}
          <span className="tabular-nums text-ab-fg-2">{date}</span>
        </span>
        {pending ? (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-white"
            title={
              cell.move_request!.to_date === cell.date
                ? `Ønsket ny arbeidsdag (fra ${shortDate(cell.move_request!.from_date)})`
                : `Ber om flytting til ${shortDate(cell.move_request!.to_date)}`
            }
          >
            <ArrowRightLeft className="h-2.5 w-2.5" strokeWidth={2.5} />
          </span>
        ) : (
          <Icon className={cn("h-3.5 w-3.5 shrink-0", st.ink)} strokeWidth={2.25} aria-hidden />
        )}
      </span>
      <span className="mt-auto flex items-end justify-between gap-1">
        <span className="min-w-0">
          <span className="flex items-baseline overflow-hidden whitespace-nowrap text-[15px] font-semibold leading-5 text-ab-fg">
            {main}
            {override && cell.state !== "worked" && (
              <span className={cn("ml-1 h-1.5 w-1.5 shrink-0 self-center rounded-full", st.stripe)} title="Dagsmål" />
            )}
          </span>
          <span className="block h-4 truncate text-[11px] leading-4 text-ab-fg-2">{sub}</span>
        </span>
        {ring}
      </span>
    </>
  )

  const base = cn(
    "relative flex h-[76px] w-full flex-col overflow-hidden rounded-ab-lg border-2 py-1.5 pl-[11px] pr-2 text-left",
    st.card,
  )

  const foreign = Boolean(cell.shift_id && !cell.shift_editable)
  if (!editable || foreign) {
    return (
      <div
        className={cn(base, foreign && "border-dashed")}
        role="gridcell"
        aria-label={describeCell(cell)}
        title={foreign && cell.shift_team_name ? `Planlagt av ${cell.shift_team_name}` : undefined}
      >
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={`${describeCell(cell)}. Rediger`}
      aria-haspopup="dialog"
      aria-selected={selected || undefined}
      onClick={(e) => onOpen?.(cell, e.currentTarget)}
      className={cn(
        base,
        "cursor-pointer transition-[transform,box-shadow] duration-150 ease-out-cubic",
        "hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(16,24,40,0.18)] motion-reduce:hover:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ab-elevated",
        selected && "ring-2 ring-ab-accent ring-offset-2 ring-offset-ab-elevated",
      )}
    >
      {body}
    </button>
  )
})
