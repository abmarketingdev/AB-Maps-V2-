"use client"

import * as React from "react"
import { Check, Loader2, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GridMember, ShiftKey } from "@/lib/api/scheduling"
import { DAY_CHIP, addDays, isoWeek, mondayOf, shortDate } from "../dates"
import { Surface } from "../Surface"
import { Avatar } from "./Avatar"
import { BLUE_BTN, Btn2, GREY_BTN } from "./SidePanel"

// «Planlegg arbeidsdager» after the client's dialog (08 Nov): 1 period (start
// week + number of weeks), 2 who works which days (presets + one row per
// person with seven toggles), 3 goal (fast mål or one goal for all).
// Days already planned are left alone by the backend and reported as skipped.

const MAX_WEEKS = 8

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  members: GridMember[]
  today: string
  /** dates already planned, "person|date" (what the view has loaded) */
  known: Set<string>
  onSubmit: (shifts: ShiftKey[], goal: { doors: number | null; givers: number | null } | null) => Promise<void>
}

export function PlanWeeksDialog({ open, onOpenChange, members, today, known, onSubmit }: Props) {
  const thisMon = mondayOf(today)
  const [startOff, setStartOff] = React.useState(1)
  const [weeks, setWeeks] = React.useState(2)
  const [on, setOn] = React.useState<Set<string>>(new Set())
  const [days, setDays] = React.useState<Map<string, Set<number>>>(new Map())
  const [goalMode, setGoalMode] = React.useState<"fast" | "same">("fast")
  const [gDoors, setGDoors] = React.useState("")
  const [gGivers, setGGivers] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const ref = React.useRef(members)
  ref.current = members
  React.useEffect(() => {
    if (!open) return
    setStartOff(1)
    setWeeks(2)
    setOn(new Set(ref.current.map((m) => m.person_id)))
    setDays(new Map(ref.current.map((m) => [m.person_id, new Set([0, 1, 2, 3, 4, 5])])))
    setGoalMode("fast")
    setGDoors("")
    setGGivers("")
  }, [open])

  const start = addDays(thisMon, startOff * 7)
  const end = addDays(start, weeks * 7 - 1)

  const setAllDays = (set: number[]) => setDays(new Map(members.map((m) => [m.person_id, new Set(set)])))
  const toggleDay = (pid: string, d: number) =>
    setDays((prev) => { const n = new Map(prev); const s = new Set(n.get(pid) ?? []); s.has(d) ? s.delete(d) : s.add(d); n.set(pid, s); return n })
  const toggleCol = (d: number) => {
    const every = members.every((m) => days.get(m.person_id)?.has(d))
    setDays((prev) => { const n = new Map(prev); for (const m of members) { const s = new Set(n.get(m.person_id) ?? []); every ? s.delete(d) : s.add(d); n.set(m.person_id, s) } return n })
  }
  const togglePerson = (pid: string) => setOn((s) => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n })

  const { shifts, skipped, people } = React.useMemo(() => {
    const out: ShiftKey[] = []
    let skip = 0
    const ppl = new Set<string>()
    for (const m of members) {
      if (!on.has(m.person_id)) continue
      const set = days.get(m.person_id) ?? new Set<number>()
      for (let w = 0; w < weeks; w++) for (const d of set) {
        const date = addDays(start, w * 7 + d)
        if (date < today) continue
        if (known.has(`${m.person_id}|${date}`)) { skip++; continue }
        out.push({ person_id: m.person_id, person_type: m.person_kind, date })
        ppl.add(m.person_id)
      }
    }
    return { shifts: out, skipped: skip, people: ppl.size }
  }, [members, on, days, weeks, start, today, known])

  const submit = async () => {
    setBusy(true)
    try {
      const goal = goalMode === "same" && (gDoors !== "" || gGivers !== "") ? { doors: gDoors === "" ? null : Number(gDoors), givers: gGivers === "" ? null : Number(gGivers) } : null
      await onSubmit(shifts, goal)
      onOpenChange(false)
    } catch { /* toast by the view */ } finally { setBusy(false) }
  }

  const num = (v: string) => v.replace(/\D/g, "").slice(0, 3)
  const stepBtn = "flex h-10 w-10 items-center justify-center rounded-[10px] border border-ab-line-2 bg-ab-elevated hover:bg-ab-hover dark:border-[#2F3238] dark:bg-[#24262B]"
  const Num = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-[13px] font-semibold"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-ab-subtle text-[11px] text-ab-fg-2 dark:bg-[#24262B]">{n}</span>{children}</div>
  )
  const presets: [string, number[]][] = [["Hverdager", [0, 1, 2, 3, 4]], ["Man til lør", [0, 1, 2, 3, 4, 5]], ["Helg", [5, 6]], ["Tøm", []]]

  return (
    <Surface
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Planlegg arbeidsdager"
      description="Legg inn faste vaktdager for teamet ditt, flere uker om gangen."
      footer={
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col">
            <span className="text-[14px] font-bold">{shifts.length} nye {shifts.length === 1 ? "vakt" : "vakter"} for {people} av {members.length} promotører</span>
            {skipped > 0 && <span className="text-[12px] text-[#B45309] dark:text-[#F5B54A]">{skipped} {skipped === 1 ? "vakt" : "vakter"} finnes allerede og hoppes over</span>}
          </div>
          <div className="flex gap-2">
            <Btn2 tone={GREY_BTN} onClick={() => onOpenChange(false)} disabled={busy}>Avbryt</Btn2>
            <Btn2 tone={BLUE_BTN} onClick={submit} disabled={busy || shifts.length === 0}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Opprett ${shifts.length || ""} ${shifts.length === 1 ? "vakt" : "vakter"}`}</Btn2>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between"><Num n={1}>Periode</Num><span className="text-[12px] font-medium text-[#2563EB] dark:text-[#7CB8FF]">Uke {isoWeek(start)}{weeks > 1 ? ` til ${isoWeek(end)}` : ""}, {shortDate(start)} til {shortDate(end)}</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 gap-1.5" role="radiogroup" aria-label="Startuke">
              {[0, 1, 2, 3].map((o) => {
                const mon = addDays(thisMon, o * 7)
                const passed = o === 0 && addDays(mon, 6) < today
                const sub = o === 0 ? (passed ? "Passert" : `Denne uken, fra ${shortDate(mon)}`) : o === 1 ? `Neste uke, fra ${shortDate(mon)}` : `fra ${shortDate(mon)}`
                return (
                  <button key={o} type="button" role="radio" aria-checked={startOff === o} disabled={passed} onClick={() => setStartOff(o)}
                    className={cn("flex min-h-[48px] flex-1 flex-col items-start justify-center rounded-[10px] border px-3 text-left disabled:opacity-50", startOff === o ? "border-[#2563EB] bg-[#EFF6FF] dark:border-[#3B82F6] dark:bg-[#0E1A33]" : "border-ab-line bg-ab-elevated hover:bg-ab-hover dark:bg-[#1C1D21]")}>
                    <span className="text-[13px] font-semibold">Uke {isoWeek(mon)}</span><span className="text-[11px] text-ab-fg-3">{sub}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-1.5 rounded-[12px] border border-ab-line bg-ab-elevated p-1 dark:bg-[#1C1D21]">
              <button type="button" className={stepBtn} aria-label="Færre uker" onClick={() => setWeeks((w) => Math.max(1, w - 1))}><Minus className="h-4 w-4" /></button>
              <span className="min-w-[64px] text-center text-[13px] font-semibold">{weeks} {weeks === 1 ? "uke" : "uker"}</span>
              <button type="button" className={stepBtn} aria-label="Flere uker" onClick={() => setWeeks((w) => Math.min(MAX_WEEKS, w + 1))}><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Num n={2}>Hvem jobber hvilke dager</Num>
            <div className="flex flex-wrap gap-1.5">{presets.map(([l, set]) => <button key={l} type="button" onClick={() => setAllDays(set)} className="min-h-[32px] rounded-[8px] border border-ab-line bg-ab-elevated px-2.5 text-[12px] font-medium hover:bg-ab-hover dark:bg-[#1C1D21]">{l}</button>)}</div>
          </div>
          <p className="m-0 text-[12px] text-ab-fg-3">Klikk en ukedag for å slå den av eller på for alle. Klikk en rute for å lage unntak for én person.</p>
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid items-center gap-1" style={{ gridTemplateColumns: "minmax(160px, 1fr) repeat(7, 36px) 64px" }}>
                <button type="button" onClick={() => setOn(on.size === members.length ? new Set() : new Set(members.map((m) => m.person_id)))} className="text-left text-[12px] font-medium text-[#2563EB] dark:text-[#7CB8FF]">{on.size === members.length ? "Fjern alle" : "Velg alle"}</button>
                {DAY_CHIP.map((d, i) => {
                  const every = members.every((m) => days.get(m.person_id)?.has(i))
                  return <button key={d} type="button" onClick={() => toggleCol(i)} aria-pressed={every} className={cn("h-8 rounded-[8px] text-[12px] font-semibold", every ? "bg-[#2563EB] text-white dark:bg-[#1D4F8A]" : "bg-ab-subtle text-ab-fg-2 dark:bg-[#24262B]")}>{d}</button>
                })}
                <span className="text-right text-[11px] text-ab-fg-3">Per uke</span>
                {members.map((m) => {
                  const set = days.get(m.person_id) ?? new Set<number>()
                  const active = on.has(m.person_id)
                  return (
                    <React.Fragment key={m.person_id}>
                      <label className={cn("flex min-h-[36px] min-w-0 cursor-pointer items-center gap-2", !active && "opacity-50")}>
                        <input type="checkbox" checked={active} onChange={() => togglePerson(m.person_id)} className="h-4 w-4 accent-[#2563EB]" aria-label={`Ta med ${m.name}`} />
                        <Avatar name={m.name} size={24} />
                        <span className="truncate text-[13px] font-medium">{m.name}</span>
                      </label>
                      {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                        <button key={d} type="button" disabled={!active} aria-pressed={set.has(d)} aria-label={`${m.name}, ${DAY_CHIP[d]}`} onClick={() => toggleDay(m.person_id, d)}
                          className={cn("flex h-8 w-8 items-center justify-center rounded-[8px] border transition-colors disabled:opacity-40", set.has(d) ? "border-[#2563EB] bg-[#2563EB] text-white dark:border-[#2F6FB8] dark:bg-[#1D4F8A]" : "border-ab-line bg-transparent text-transparent hover:bg-ab-hover")}>
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </button>
                      ))}
                      <span className="text-right text-[11px] text-ab-fg-3">{active ? `${set.size} ${set.size === 1 ? "dag" : "dager"}` : "–"}</span>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <Num n={3}>Dagsmål</Num>
          <div className="grid gap-2 md:grid-cols-2" role="radiogroup" aria-label="Dagsmål">
            {([["fast", "Bruk fast mål", "Hver promotør får sitt eget faste mål"], ["same", "Samme mål for alle", "Overstyrer fast mål for disse vaktene"]] as const).map(([k, t, s]) => (
              <button key={k} type="button" role="radio" aria-checked={goalMode === k} onClick={() => setGoalMode(k)}
                className={cn("flex min-h-[52px] flex-col items-start justify-center rounded-[10px] border px-3.5 text-left", goalMode === k ? "border-[#2563EB] bg-[#EFF6FF] dark:border-[#3B82F6] dark:bg-[#0E1A33]" : "border-ab-line bg-ab-elevated hover:bg-ab-hover dark:bg-[#1C1D21]")}>
                <span className="text-[13px] font-semibold">{t}</span><span className="text-[11px] text-ab-fg-3">{s}</span>
              </button>
            ))}
          </div>
          {goalMode === "same" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[12px] text-ab-fg-2">Dører<input inputMode="numeric" value={gDoors} onChange={(e) => setGDoors(num(e.target.value))} placeholder="–" className="h-10 rounded-[10px] border border-ab-line-2 bg-ab-elevated px-3 text-center text-[15px] font-semibold text-ab-fg focus:border-[#3B9EFF] focus:outline-none dark:bg-[#1C1D21]" /></label>
              <label className="flex flex-col gap-1 text-[12px] text-ab-fg-2">Givere<input inputMode="numeric" value={gGivers} onChange={(e) => setGGivers(num(e.target.value))} placeholder="–" className="h-10 rounded-[10px] border border-ab-line-2 bg-ab-elevated px-3 text-center text-[15px] font-semibold text-ab-fg focus:border-[#3B9EFF] focus:outline-none dark:bg-[#1C1D21]" /></label>
            </div>
          )}
        </section>
      </div>
    </Surface>
  )
}
