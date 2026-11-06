"use client"

import * as React from "react"
import { Check, Loader2, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GridMember, ShiftKey } from "@/lib/api/scheduling"
import { DAY_CHIP, DAY_LONG, addDays, isoWeek, mondayOf, rangeLabel } from "./dates"
import { Btn, Surface } from "./Surface"
import { MemberAvatar } from "./WeekGrid"

// «Planlegg»: pick members + weekdays + number of weeks → bulk create.
// Days already planned are skipped by the backend (reported back as skipped).

interface PlanDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  members: GridMember[]
  today: string
  teamName: string
  onSubmit: (shifts: ShiftKey[]) => Promise<void>
}

const MAX_WEEKS = 8

export function PlanDialog({ open, onOpenChange, members, today, teamName, onSubmit }: PlanDialogProps) {
  const thisMonday = mondayOf(today)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [days, setDays] = React.useState<Set<number>>(new Set([0, 1, 2, 3, 4]))
  const [weeks, setWeeks] = React.useState(2)
  const [startOffset, setStartOffset] = React.useState(0) // weeks from this week
  const [busy, setBusy] = React.useState(false)

  const membersRef = React.useRef(members)
  membersRef.current = members
  React.useEffect(() => {
    if (open) {
      setSelected(new Set(membersRef.current.map((m) => m.person_id)))
      setDays(new Set([0, 1, 2, 3, 4]))
      setWeeks(2)
      setStartOffset(0)
    }
  }, [open])

  const start = addDays(thisMonday, startOffset * 7)
  const end = addDays(start, weeks * 7 - 1)

  const shifts = React.useMemo(() => {
    const out: ShiftKey[] = []
    for (let w = 0; w < weeks; w++) {
      for (const d of [...days].sort()) {
        const date = addDays(start, w * 7 + d)
        if (date < today) continue
        for (const m of members) {
          if (selected.has(m.person_id)) out.push({ person_id: m.person_id, person_type: m.person_kind, date })
        }
      }
    }
    return out
  }, [weeks, days, start, today, selected, members])

  const allSelected = selected.size === members.length && members.length > 0
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleDay = (d: number) =>
    setDays((s) => {
      const n = new Set(s)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })

  const submit = async () => {
    setBusy(true)
    try {
      await onSubmit(shifts)
      onOpenChange(false)
    } catch {
      /* toast shown by caller; keep dialog open */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Surface
      open={open}
      onOpenChange={onOpenChange}
      title="Planlegg arbeidsdager"
      description={`Samme ukedager i flere uker for ${teamName}.`}
      size="lg"
      footer={
        <>
          <div className="mr-auto hidden text-[13px] text-ab-fg-2 md:block">
            <b className="tabular-nums text-ab-fg">{shifts.length}</b> {shifts.length === 1 ? "vakt" : "vakter"} ·{" "}
            {rangeLabel(start, end)}
          </div>
          <Btn variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Avbryt
          </Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || shifts.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Opprett {shifts.length} {shifts.length === 1 ? "vakt" : "vakter"}
          </Btn>
        </>
      }
    >
      <div className="space-y-6">
        {/* Weekdays */}
        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">Ukedager</h3>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Ukedager">
            {DAY_CHIP.map((label, i) => {
              const on = days.has(i)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_LONG[i]}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "h-11 cursor-pointer rounded-ab-md border text-[13px] font-semibold transition-colors duration-150 md:h-10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent focus-visible:ring-offset-1",
                    on
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] dark:border-[#3B82F6] dark:bg-[#0E1A33] dark:text-[#93C5FD]"
                      : "border-ab-line bg-ab-elevated text-ab-fg-2 hover:border-ab-line-2 hover:text-ab-fg",
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Period */}
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">Fra uke</h3>
            <div className="grid grid-cols-3 gap-1 rounded-ab-lg border border-ab-line bg-ab-subtle p-1">
              {[0, 1, 2].map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={startOffset === o}
                  onClick={() => setStartOffset(o)}
                  className={cn(
                    "h-11 cursor-pointer rounded-ab-md text-[13px] font-medium md:h-9",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
                    startOffset === o
                      ? "bg-ab-elevated text-ab-fg shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-ab-line"
                      : "text-ab-fg-2 hover:text-ab-fg",
                  )}
                >
                  {o === 0 ? "Denne" : o === 1 ? "Neste" : `Uke ${isoWeek(addDays(thisMonday, o * 7))}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">Antall uker</h3>
            <div className="flex h-[52px] items-center justify-between rounded-ab-lg border border-ab-line bg-ab-elevated px-1 md:h-[44px]">
              <button
                type="button"
                aria-label="Færre uker"
                disabled={weeks <= 1}
                onClick={() => setWeeks((w) => Math.max(1, w - 1))}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-ab-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-center" aria-live="polite">
                <span className="text-[15px] font-semibold tabular-nums">{weeks}</span>{" "}
                <span className="text-[13px] text-ab-fg-2">{weeks === 1 ? "uke" : "uker"}</span>
              </div>
              <button
                type="button"
                aria-label="Flere uker"
                disabled={weeks >= MAX_WEEKS}
                onClick={() => setWeeks((w) => Math.min(MAX_WEEKS, w + 1))}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-ab-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Members */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">
              Personer <span className="tabular-nums">({selected.size}/{members.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(members.map((m) => m.person_id)))}
              className="h-8 cursor-pointer rounded-ab-md px-2 text-[13px] font-medium text-ab-accent-3 hover:bg-ab-hover"
            >
              {allSelected ? "Fjern alle" : "Velg alle"}
            </button>
          </div>
          <ul className="divide-y divide-ab-line-1 overflow-hidden rounded-ab-lg border border-ab-line">
            {members.map((m) => {
              const on = selected.has(m.person_id)
              return (
                <li key={m.person_id}>
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-ab-hover">
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(m.person_id)} />
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-ab-accent peer-focus-visible:ring-offset-1",
                        on ? "border-ab-accent bg-ab-accent text-ab-on-accent" : "border-ab-line-2 bg-ab-elevated",
                      )}
                      aria-hidden
                    >
                      {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <MemberAvatar name={m.name} size={28} />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ab-fg">{m.name}</span>
                    {m.role_label && <span className="shrink-0 text-[12px] text-ab-fg-3">{m.role_label}</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        </section>

        <p className="text-[12px] leading-4 text-ab-fg-3">
          Dager som har vært tas ikke med. Dager som allerede er planlagt beholdes som de er.
        </p>
        <div className="text-[13px] text-ab-fg-2 md:hidden">
          <b className="tabular-nums text-ab-fg">{shifts.length}</b> {shifts.length === 1 ? "vakt" : "vakter"} ·{" "}
          {rangeLabel(start, end)}
        </div>
      </div>
    </Surface>
  )
}
