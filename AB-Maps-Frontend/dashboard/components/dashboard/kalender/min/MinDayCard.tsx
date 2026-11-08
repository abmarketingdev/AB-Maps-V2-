"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { DayCell } from "@/lib/api/scheduling"
import { cardDate, longDate } from "../dates"
import { doorsWord, fmtNum, fmtPct, giversWord } from "../states"

// One day box in «Min kalender». Layout follows the client's HTML (06 Nov):
// weekday + date on top, a 4 px left stripe in the state colour, title line,
// sub line, «I DAG» badge on today. On phones the box is a row (date | text)
// so a week is a readable list instead of seven squeezed squares.
//
// Tones (client legend): blue = vakt, green = nådde mål, amber = under mål
// eller bytte, red = ikke møtt, orange = i dag, muted = fri. «pick» / «picked»
// are the dashed / solid blue states while choosing a new day for a move.

export type Tone = "blue" | "green" | "amber" | "orange" | "red" | "muted" | "pick" | "picked"

export interface CardModel {
  tone: Tone
  title: string
  sub: string
  badge?: string
  /** click opens the day (or picks it as the new day) */
  clickable: boolean
}

interface ToneStyle {
  card: string
  stripe: string
  title: string
  day: string
  dot: string
  label: string
}

export const TONES: Record<Tone, ToneStyle> = {
  blue: {
    card: "border-ab-line bg-ab-elevated",
    stripe: "bg-[#2563EB] dark:bg-[#3B82F6]",
    title: "text-ab-fg",
    day: "text-ab-fg",
    dot: "bg-[#2563EB]",
    label: "Vakt",
  },
  green: {
    card: "border-ab-line bg-ab-elevated",
    stripe: "bg-[#16A34A] dark:bg-[#22C55E]",
    title: "text-ab-fg",
    day: "text-ab-fg",
    dot: "bg-[#16A34A]",
    label: "Nådde mål",
  },
  amber: {
    card: "border-[#F0D28A] bg-[#FFFAF0] dark:border-[#78350F] dark:bg-[#271A05]",
    stripe: "bg-[#D97706] dark:bg-[#F59E0B]",
    title: "text-[#8A5A00] dark:text-[#FCD34D]",
    day: "text-ab-fg",
    dot: "bg-[#D97706]",
    label: "Under mål eller bytte",
  },
  orange: {
    card: "border-[#EA580C] bg-[#FFF7ED] dark:border-[#F97316] dark:bg-[#2B1709]",
    stripe: "bg-[#EA580C] dark:bg-[#F97316]",
    title: "text-[#C2410C] dark:text-[#FDBA74]",
    day: "text-[#C2410C] dark:text-[#FDBA74]",
    dot: "bg-[#EA580C]",
    label: "I dag",
  },
  red: {
    card: "border-[#F2BCBC] bg-[#FFF7F7] dark:border-[#7F1D1D] dark:bg-[#2A1215]",
    stripe: "bg-[#DC2626] dark:bg-[#EF4444]",
    title: "text-[#B91C1C] dark:text-[#FCA5A5]",
    day: "text-ab-fg",
    dot: "bg-[#DC2626]",
    label: "Ikke møtt",
  },
  muted: {
    card: "border-ab-line-1 bg-ab-subtle",
    stripe: "bg-transparent",
    title: "text-ab-fg-3",
    day: "text-ab-fg",
    dot: "bg-[#1F2328] dark:bg-[#9CA3AF]",
    label: "Fri",
  },
  pick: {
    card: "border-dashed border-[#2563EB] bg-[#F5F9FF] dark:border-[#3B82F6] dark:bg-[#0E1A33]",
    stripe: "bg-transparent",
    title: "text-[#1D4ED8] dark:text-[#93C5FD]",
    day: "text-ab-fg",
    dot: "bg-[#2563EB]",
    label: "Ledig dag",
  },
  picked: {
    card: "border-[#2563EB] bg-[#2563EB] dark:border-[#3B82F6] dark:bg-[#3B82F6]",
    stripe: "bg-transparent",
    title: "text-white",
    day: "text-white",
    dot: "bg-[#2563EB]",
    label: "Ny dag",
  },
}

export const LEGEND: Tone[] = ["blue", "green", "amber", "orange", "red", "muted"]

/** Goal reached = givers goal met; without a givers goal, doors goal met. */
export function goalMet(cell: DayCell): boolean | null {
  if (!cell.actual || !cell.goals) return null
  if (cell.goals.givers !== null) return cell.actual.ja >= cell.goals.givers
  if (cell.goals.doors !== null) return cell.actual.doors >= cell.goals.doors
  return null
}

export function goalText(cell: DayCell): string {
  const g = cell.goals
  if (!g || (g.doors === null && g.givers === null)) return "Mål ikke satt"
  const parts: string[] = []
  if (g.doors !== null) parts.push(`${fmtNum(g.doors)} ${doorsWord(g.doors)}`)
  if (g.givers !== null) parts.push(`${fmtNum(g.givers)} ${giversWord(g.givers)}`)
  return `Mål ${parts.join(", ")}${g.source === "override" ? " (justert)" : ""}`
}

export function actualText(cell: DayCell): string {
  const a = cell.actual
  if (!a) return ""
  return `${fmtNum(a.ja)} ${giversWord(a.ja)}, ja ${fmtPct(a.ja_pct ?? 0)}`
}

/** What the box says, by state and move request. `picking` = choosing a new day. */
export function modelFor(
  cell: DayCell,
  today: string,
  picking: { from: string; chosen: string | null; allowed: (d: string) => boolean } | null,
): CardModel {
  const mr = cell.move_request
  const pendingFrom = mr?.status === "venter" && mr.from_date === cell.date
  const pendingTo = mr?.status === "venter" && mr.to_date === cell.date && mr.from_date !== cell.date
  const hasShift = cell.shift_id !== null
  const future = cell.date > today

  if (picking) {
    if (cell.date === picking.from) {
      return { tone: "amber", title: "Flyttes", sub: "Dagen du bytter fra", clickable: false }
    }
    if (!hasShift && !pendingTo && future && picking.allowed(cell.date)) {
      return picking.chosen === cell.date
        ? { tone: "picked", title: "Ny dag", sub: "Valgt", clickable: true }
        : { tone: "pick", title: "Velg", sub: "Ledig dag", clickable: true }
    }
  }

  if (cell.state === "no_show") {
    return { tone: "red", title: "Ikke møtt", sub: cell.actual ? `${fmtNum(cell.actual.doors)} ${doorsWord(cell.actual.doors)}` : "Satt av salgssjefen", clickable: !picking }
  }
  if (cell.state === "today") {
    if (!hasShift) {
      return { tone: "orange", title: "Fri i dag", sub: cell.actual && cell.actual.doors > 0 ? `${fmtNum(cell.actual.doors)} ${doorsWord(cell.actual.doors)} så langt` : "", badge: "I DAG", clickable: !picking }
    }
    const d = cell.actual?.doors ?? 0
    return { tone: "orange", title: `${fmtNum(d)} ${doorsWord(d)} så langt`, sub: goalText(cell), badge: "I DAG", clickable: !picking }
  }
  if (cell.state === "worked") {
    const d = cell.actual?.doors ?? 0
    const met = goalMet(cell)
    return { tone: met === false ? "amber" : "green", title: `${fmtNum(d)} ${doorsWord(d)}`, sub: actualText(cell), clickable: !picking }
  }
  if (cell.state === "planned") {
    if (pendingFrom && mr) {
      const t = cardDate(mr.to_date)
      return { tone: "amber", title: "Bytte venter", sub: `Til ${t.day} ${t.date}`, clickable: !picking }
    }
    return { tone: "blue", title: "Vakt", sub: goalText(cell), clickable: !picking }
  }
  // off
  if (pendingTo && mr) {
    const f = cardDate(mr.from_date)
    return { tone: "amber", title: "Byttedag", sub: `Venter, fra ${f.day} ${f.date}`, clickable: !picking }
  }
  return { tone: "muted", title: "Fri", sub: "", clickable: !picking }
}

interface MinDayCardProps {
  cell: DayCell
  model: CardModel
  selected: boolean
  dimmed: boolean
  onClick: (cell: DayCell) => void
}

export const MinDayCard = React.memo(function MinDayCard({ cell, model, selected, dimmed, onClick }: MinDayCardProps) {
  const t = TONES[model.tone]
  const { day, date } = cardDate(cell.date)
  const aria = `${longDate(cell.date)}, ${model.title}${model.sub ? `, ${model.sub}` : ""}`
  return (
    <button
      type="button"
      disabled={!model.clickable}
      onClick={() => onClick(cell)}
      aria-label={aria}
      aria-pressed={selected || undefined}
      className={cn(
        "relative flex min-h-[60px] w-full items-center gap-3 overflow-hidden rounded-[12px] border px-3 py-2 text-left transition-colors",
        "md:min-h-[104px] md:flex-col md:items-stretch md:justify-between md:gap-1.5 md:px-3 md:py-2.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent focus-visible:ring-offset-1 focus-visible:ring-offset-ab-base",
        model.clickable ? "cursor-pointer hover:border-ab-line-2" : "cursor-default",
        selected && "ring-2 ring-ab-accent ring-offset-2 ring-offset-ab-base",
        dimmed && "opacity-55",
        t.card,
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", t.stripe)} />
      <span className="flex w-[64px] shrink-0 flex-col leading-tight md:w-auto md:flex-row md:items-center md:justify-between md:gap-1">
        <span className={cn("text-[13px] font-bold", t.day)}>
          {day} <span className={cn("font-medium", model.tone === "picked" ? "text-white/80" : "text-ab-fg-2")}>{date}</span>
        </span>
        {model.badge && (
          <span className="hidden rounded-[6px] bg-[#EA580C] px-1.5 py-0.5 text-[10px] font-bold text-white md:inline dark:bg-[#F97316]">
            {model.badge}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-[14px] font-semibold leading-5", t.title)}>{model.title}</span>
        {model.sub && (
          <span className={cn("text-[12px] leading-[1.35]", model.tone === "picked" ? "text-white/80" : "text-ab-fg-2")}>
            {model.sub}
          </span>
        )}
      </span>
      {model.badge && (
        <span className="shrink-0 rounded-[6px] bg-[#EA580C] px-1.5 py-0.5 text-[10px] font-bold text-white md:hidden dark:bg-[#F97316]">
          {model.badge}
        </span>
      )}
    </button>
  )
})
