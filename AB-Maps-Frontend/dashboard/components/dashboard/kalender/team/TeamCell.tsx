"use client"

import * as React from "react"
import { Lock, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DayCell } from "@/lib/api/scheduling"
import { cardDate, longDate } from "../dates"
import { doorsWord, fmtNum, fmtPct, giversWord } from "../states"

// One cell of the team grid, after the client's «Teamkalender» HTML (08 Nov):
//   done   → big door count, givers + Ja %, thin progress bar (doors / goal)
//   plan   → «Vakt» (+ «Justert» when the day has its own goal), goal line
//   swap   → «Ønsker bytte» + target day, dashed amber frame
//   off    → dashed empty box: «+ Vakt» when the chief may add one, else «Fri»
// Our own states on top: no-show (red), today (orange header + doors so far).

export type CellKind = "done" | "plan" | "swap" | "off" | "noshow" | "today"

export function kindOf(cell: DayCell, today: string): CellKind {
  if (cell.state === "no_show") return "noshow"
  if (cell.date === today) return "today"
  const mr = cell.move_request
  if (cell.shift_id && mr?.status === "venter" && mr.from_date === cell.date) return "swap"
  if (cell.shift_id && cell.date > today) return "plan"
  if (cell.date < today && (cell.shift_id || (cell.actual?.doors ?? 0) > 0)) return "done"
  return "off"
}

/** Givers goal reached; without one, the doors goal. null = no goal to judge by. */
export function goalMet(cell: DayCell): boolean | null {
  const g = cell.goals
  const a = cell.actual
  if (!a || !g) return null
  if (g.givers !== null) return a.ja >= g.givers
  if (g.doors !== null) return a.doors >= g.doors
  return null
}

export function goalLine(cell: DayCell): string {
  const g = cell.goals
  if (!g || (g.doors === null && g.givers === null)) return "Uten mål"
  return `${fmtNum(g.doors)} ${doorsWord(g.doors)}, ${fmtNum(g.givers)} ${giversWord(g.givers)}`
}

export function describe(name: string, cell: DayCell, today: string): string {
  const { day, date } = cardDate(cell.date)
  const k = kindOf(cell, today)
  const parts = [name, `${day} ${date}`]
  if (k === "done" && cell.actual) parts.push(`${cell.actual.doors} ${doorsWord(cell.actual.doors)}, ${cell.actual.ja} ${giversWord(cell.actual.ja)}`)
  if (k === "plan") parts.push(cell.shift_editable ? `vakt, mål ${goalLine(cell)}` : `vakt planlagt av ${cell.shift_team_name || "annet team"}`)
  if (k === "swap" && cell.move_request) parts.push(`ønsker bytte til ${longDate(cell.move_request.to_date)}`)
  if (k === "noshow") parts.push(cell.not_worked ? "ikke jobbet, under 50 dører" : "ikke møtt")
  if (k === "today") parts.push(cell.shift_id ? "i dag, på vakt" : "i dag, fri")
  if (k === "off") parts.push("fri")
  return parts.join(", ")
}

interface TeamCellProps {
  cell: DayCell
  name: string
  today: string
  editable: boolean
  selected: boolean
  onOpen: (cell: DayCell, el: HTMLElement) => void
}

export const TeamCell = React.memo(function TeamCell({ cell, name, today, editable, selected, onOpen }: TeamCellProps) {
  const k = kindOf(cell, today)
  const a = cell.actual
  const met = goalMet(cell)
  const override = cell.goals?.source === "override"
  const canAdd = editable && cell.date >= today && !cell.shift_id
  const clickable = editable || cell.shift_id !== null || (a && a.doors > 0)

  let look = ""
  let body: React.ReactNode
  switch (k) {
    case "done": {
      const d = a?.doors ?? 0
      const ja = a?.ja ?? 0
      const goalDoors = cell.goals?.doors ?? null
      const p = goalDoors ? Math.min(100, Math.round((d / goalDoors) * 100)) : 0
      const ok = met !== false
      look = ok
        ? "bg-[#F0FDF4] border-[#BBF7D0] dark:bg-[#112219] dark:border-[#1E4430]"
        : "bg-[#FFFBEB] border-[#FDE68A] dark:bg-[#211B10] dark:border-[#43341A]"
      body = (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-[18px] font-bold leading-none tabular-nums">{fmtNum(d)}</span>
            <span className="text-[11px] text-ab-fg-2">{doorsWord(d)}</span>
          </div>
          <div className="flex flex-col gap-[5px]">
            <div className="flex justify-between gap-1 text-[12px]">
              <span className={cn("font-semibold", ok ? "text-[#15803D] dark:text-[#5BE0A3]" : "text-[#B45309] dark:text-[#F5B54A]")}>
                {ja} {giversWord(ja)}
              </span>
              <span className="text-ab-fg-2 tabular-nums">{fmtPct(a?.ja_pct ?? 0)}</span>
            </div>
            <div className="h-[3px] rounded-[2px] bg-black/[0.08] dark:bg-white/[0.08]" aria-hidden>
              <div className={cn("h-[3px] rounded-[2px]", ok ? "bg-[#16A34A] dark:bg-[#3ECF8E]" : "bg-[#D97706] dark:bg-[#F5A524]")} style={{ width: `${goalDoors ? p : 100}%` }} />
            </div>
          </div>
        </>
      )
      break
    }
    case "plan":
      look = cell.shift_editable
        ? "bg-ab-subtle border-ab-line-2 dark:bg-[#1C1E22] dark:border-[#34373E]"
        : "bg-transparent border-ab-line-2 dark:border-[#34373E]"
      body = (
        <>
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-[13px] font-semibold">
              {!cell.shift_editable && <Lock className="h-3 w-3 text-ab-fg-3" aria-hidden />}Vakt
            </span>
            {override && <span className="shrink-0 text-[10px] font-semibold text-[#2563EB] dark:text-[#7CB8FF]">Justert</span>}
          </div>
          <div className="truncate text-[11px] leading-[1.35] text-ab-fg-2">
            {cell.shift_editable ? goalLine(cell) : `Planlagt av ${cell.shift_team_name || "annet team"}`}
          </div>
        </>
      )
      break
    case "swap": {
      const to = cell.move_request ? cardDate(cell.move_request.to_date) : null
      look = "border-dashed bg-[#FFFBEB] border-[#D97706] dark:bg-[#211B10] dark:border-[#B07A1C]"
      body = (
        <>
          <span className="text-[12px] font-semibold text-[#B45309] dark:text-[#F5B54A]">Ønsker bytte</span>
          <span className="text-[11px] text-[#92400E] dark:text-[#D8C49C]">til {to ? `${to.day} ${to.date}` : "–"}</span>
        </>
      )
      break
    }
    case "noshow":
      look = "bg-[#FEF2F2] border-[#FCA5A5] dark:bg-[#2A1215] dark:border-[#7F1D1D]"
      body = (
        <>
          <span className="text-[13px] font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">{cell.not_worked ? "Ikke jobbet" : "Ikke møtt"}</span>
          <span className="text-[11px] text-ab-fg-2">{cell.not_worked ? `${a?.doors ?? 0} ${doorsWord(a?.doors ?? 0)}, under 50` : a && a.doors ? `${a.doors} ${doorsWord(a.doors)}` : "Satt av salgssjef"}</span>
        </>
      )
      break
    case "today": {
      const d = a?.doors ?? 0
      look = cell.shift_id
        ? "bg-[#FFF7ED] border-[#EA580C] dark:bg-[#2B1709] dark:border-[#F97316]"
        : "border-dashed bg-transparent border-[#EA580C]/60 dark:border-[#F97316]/60"
      body = cell.shift_id ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#C2410C] dark:text-[#FDBA74]">På vakt</span>
            {override && <span className="text-[10px] font-semibold text-[#2563EB] dark:text-[#7CB8FF]">Justert</span>}
          </div>
          <div className="text-[11px] leading-[1.35] text-ab-fg-2">
            <span className="font-semibold text-ab-fg tabular-nums">{fmtNum(d)}</span> {doorsWord(d)} så langt · mål {goalLine(cell)}
          </div>
        </>
      ) : (
        <>
          <span className="m-auto flex items-center gap-[5px] text-[12px] text-ab-fg-3">
            {canAdd && <Plus className="h-[13px] w-[13px]" strokeWidth={2.2} aria-hidden />}
            {d ? `${d} ${doorsWord(d)} i dag` : canAdd ? "Vakt i dag" : "Fri i dag"}
          </span>
        </>
      )
      break
    }
    default:
      look = "border-dashed bg-transparent border-ab-line-2 dark:border-[#2A2C31]"
      body = (
        <span className="m-auto flex items-center gap-[5px] text-[12px] text-ab-fg-3">
          {canAdd && <Plus className="h-[13px] w-[13px]" strokeWidth={2.2} aria-hidden />}
          {canAdd ? "Vakt" : "Fri"}
        </span>
      )
  }

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={(e) => onOpen(cell, e.currentTarget)}
      aria-label={describe(name, cell, today)}
      aria-pressed={selected || undefined}
      className={cn(
        "flex h-[80px] w-full flex-col justify-between rounded-[10px] border px-[10px] py-[9px] text-left text-[14px] text-ab-fg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B9EFF]",
        clickable ? "cursor-pointer hover:border-ab-line-2 dark:hover:border-[#4A4E57]" : "cursor-default",
        selected && "outline outline-2 outline-offset-1 outline-[#3B9EFF]",
        look,
      )}
    >
      {body}
    </button>
  )
})
