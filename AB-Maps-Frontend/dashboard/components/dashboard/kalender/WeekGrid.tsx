"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { stringToHsl } from "@/lib/stringToHsl"
import type { DayCell, GridMember } from "@/lib/api/scheduling"
import { cardDate, isoWeek, weekLabel } from "./dates"
import { DayCard } from "./DayCard"
import { fmtNum, initials } from "./states"

// Team week grid: members down the side, 14 days across (two weeks).
// Sticky name column + sticky two-row header inside one scroll box, so both
// stick on desktop and on a 390 px phone (horizontal scroll, snap per day).

const GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: "var(--kal-name) repeat(7, minmax(var(--kal-cell), 1fr))",
  minWidth: "calc(var(--kal-name) + 7 * var(--kal-cell))",
}

const COLS = "[--kal-name:120px] md:[--kal-name:208px] [--kal-cell:116px] md:[--kal-cell:112px]"

export function MemberAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const { resolvedTheme } = useTheme()
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-ab-fg"
      style={{
        width: size,
        height: size,
        fontSize: size <= 28 ? 10 : 11,
        background: stringToHsl(name, { dark: resolvedTheme === "dark" }),
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

interface WeekGridProps {
  dates: string[] // 14 consecutive dates, starting on a Monday
  today: string
  members: GridMember[]
  editable: boolean
  selectedKey: string | null
  onOpen: (member: GridMember, cell: DayCell, el: HTMLElement) => void
  direction: number
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

export function WeekGrid({ dates, today, members, editable, selectedKey, onOpen, direction, scrollRef }: WeekGridProps) {
  const reduce = useReducedMotion()
  const weeks = [dates.slice(0, 7), dates.slice(7, 14)]

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label="Vaktkalender"
      className={cn(
        COLS,
        "relative max-h-[calc(100dvh-236px)] min-h-[240px] overflow-auto overscroll-x-contain rounded-ab-xl border border-ab-line bg-ab-elevated",
        "snap-x snap-mandatory scroll-pl-[var(--kal-name)] md:snap-none",
      )}
    >
      <div className="grid w-full" style={GRID_STYLE}>
        {weeks.map((week, wi) => (
          <React.Fragment key={week[0]}>
            {/* Week header: label in the corner + day names (sticky) */}
            <div
              role="columnheader"
              className={cn(
                "sticky left-0 top-0 z-30 flex h-10 items-center gap-2 border-b border-r border-ab-line bg-ab-elevated px-3 md:px-4",
                wi > 0 && "border-t-4 border-t-ab-subtle",
              )}
            >
              <span className="truncate text-[13px] font-semibold text-ab-fg">{weekLabel(week[0], today)}</span>
              <span className="hidden text-[12px] tabular-nums text-ab-fg-3 md:inline">Uke {isoWeek(week[0])}</span>
            </div>
            {week.map((d) => {
              const { day, date } = cardDate(d)
              const isToday = d === today
              return (
                <div
                  key={d}
                  role="columnheader"
                  data-date={d}
                  className={cn(
                    "sticky top-0 z-20 flex h-10 snap-start items-center gap-1.5 border-b border-ab-line bg-ab-elevated px-3 text-[12px]",
                    wi > 0 && "border-t-4 border-t-ab-subtle",
                  )}
                >
                  <span className={cn("font-semibold", isToday ? "text-[#C2410C] dark:text-[#FDBA74]" : "text-ab-fg-2")}>
                    {day}
                  </span>
                  <span className={cn("tabular-nums", isToday ? "text-[#C2410C] dark:text-[#FDBA74]" : "text-ab-fg-3")}>
                    {date}
                  </span>
                  {isToday && (
                    <>
                      <span className="ml-0.5 hidden rounded-full bg-[#EA580C] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white md:inline">
                        I dag
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#EA580C] md:hidden" aria-label="i dag" />
                    </>
                  )}
                </div>
              )
            })}

            {members.map((m, ri) => (
              <React.Fragment key={m.person_id}>
                <div
                  role="rowheader"
                  className={cn(
                    "sticky left-0 z-10 flex items-center gap-2.5 border-r border-ab-line bg-ab-elevated px-3 md:px-4",
                    ri > 0 && "border-t border-t-ab-line-1",
                  )}
                >
                  <MemberAvatar name={m.name} size={28} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold leading-[18px] text-ab-fg" title={m.name}>
                      <span className="md:hidden">{m.name.split(" ")[0]}</span>
                      <span className="hidden md:inline">{m.name}</span>
                    </div>
                    <div className="truncate text-[11px] leading-4 text-ab-fg-3">
                      {m.role_label ? <span className="hidden md:inline">{m.role_label} · </span> : null}
                      {m.default_goals
                        ? `Mål ${fmtNum(m.default_goals.doors)}/${fmtNum(m.default_goals.givers)}`
                        : "Uten mål"}
                    </div>
                  </div>
                </div>
                {m.days.slice(wi * 7, wi * 7 + 7).map((cell, i) => (
                  <motion.div
                    key={cell.date}
                    initial={reduce ? false : { opacity: 0, x: direction * 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : i * 0.012 }}
                    className={cn("min-w-0 snap-start p-1", ri > 0 && "border-t border-ab-line-1", i === 0 && "pl-2", i === 6 && "pr-2")}
                  >
                    <DayCard
                      cell={cell}
                      editable={editable && (cell.shift_id !== null || cell.date >= today)}
                      selected={selectedKey === `${m.person_id}|${cell.date}`}
                      onOpen={(c, el) => onOpen(m, c, el)}
                    />
                  </motion.div>
                ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export function GridSkeleton({ rows = 6 }: { rows?: number }) {
  const bar = "animate-pulse rounded bg-ab-hover motion-reduce:animate-none"
  return (
    <div
      className={cn(COLS, "max-h-[calc(100dvh-236px)] overflow-hidden rounded-ab-xl border border-ab-line bg-ab-elevated")}
      aria-busy="true"
      aria-label="Laster kalender"
    >
      <div className="grid w-full" style={GRID_STYLE}>
        {[0, 1].map((w) => (
          <React.Fragment key={w}>
            <div className={cn("flex h-10 items-center border-b border-r border-ab-line px-3 md:px-4", w > 0 && "border-t-4 border-t-ab-subtle")}>
              <div className={cn(bar, "h-3 w-20")} />
            </div>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={cn("flex h-10 items-center border-b border-ab-line px-3", w > 0 && "border-t-4 border-t-ab-subtle")}>
                <div className={cn(bar, "h-2.5 w-14")} />
              </div>
            ))}
            {Array.from({ length: rows }, (_, r) => (
              <React.Fragment key={r}>
                <div className={cn("flex items-center gap-2.5 border-r border-ab-line px-3 md:px-4", r > 0 && "border-t border-t-ab-line-1")}>
                  <div className={cn(bar, "h-7 w-7 shrink-0 rounded-full")} />
                  <div className="space-y-1.5">
                    <div className={cn(bar, "h-2.5 w-16 md:w-28")} />
                    <div className={cn(bar, "h-2 w-12")} />
                  </div>
                </div>
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className={cn("p-1", r > 0 && "border-t border-ab-line-1", i === 0 && "pl-2", i === 6 && "pr-2")}>
                    <div className={cn(bar, "h-[76px] rounded-ab-lg")} style={{ animationDelay: `${(r * 7 + i) * 15}ms` }} />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
