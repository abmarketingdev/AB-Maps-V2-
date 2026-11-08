"use client"

import * as React from "react"
import { ArrowLeftRight, ArrowRight, Check, ChevronLeft, ChevronRight, Minus, Plus, Target, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DayCell } from "@/lib/api/scheduling"
import { addDays, cardDate, isoWeek, longDate, mondayOf, weekLabel } from "../dates"
import { doorsWord, fmtNum, fmtPct, giversWord } from "../states"
import { Btn } from "../Surface"
import { goalText } from "./MinDayCard"

// The right-hand panel of «Min kalender» (a bottom sheet on phones). Four
// modes: day (details + actions), move (ask to move the day), goal (change
// this day's goal), sent (confirmation). Form state lives here; the parent
// talks to the backend and owns the calendar.

export type PanelMode = "day" | "move" | "goal" | "sent"

export const REASONS = ["Skole", "Lege", "Familie", "Annet"] as const
export const MOVE_MAX_AHEAD = 56
const MAX_REASON = 300
const MAX_GOAL = 999

export interface Defaults {
  doors: number | null
  givers: number | null
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/** «Tor 12.11» */
export function dayShort(iso: string): string {
  const { day, date } = cardDate(iso)
  return `${day} ${date}`
}

export function panelHeading(mode: PanelMode, cell: DayCell | null, today: string): { title: string; sub: string } {
  if (mode === "move") return { title: "Bytt vakt", sub: "Velg dagen du tar den igjen" }
  if (mode === "goal") return { title: "Endre dagsmål", sub: cell ? cap(longDate(cell.date)) : "" }
  if (mode === "sent") return { title: "Sendt", sub: "" }
  if (!cell) return { title: "Velg en dag", sub: "" }
  const title = cap(longDate(cell.date))
  const mr = cell.move_request
  if (cell.state === "no_show") return { title, sub: "Ikke møtt" }
  if (cell.state === "worked") return { title, sub: "Gjennomført vakt" }
  if (cell.state === "today") return { title, sub: cell.shift_id ? `I dag, ${goalText(cell).toLowerCase()}` : "Fri i dag" }
  if (cell.state === "planned") {
    if (mr?.status === "venter" && mr.from_date === cell.date) return { title, sub: "Vakt, bytte venter på svar" }
    return { title, sub: `Vakt, ${goalText(cell).toLowerCase()}` }
  }
  if (mr?.status === "venter" && mr.to_date === cell.date) return { title, sub: "Byttedag, venter på svar" }
  return { title, sub: "Fri" }
}

// ── small pieces ────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-ab-subtle px-3 py-2.5">
      <div className="text-[11px] text-ab-fg-2">{label}</div>
      <div className="text-[20px] font-bold tabular-nums text-ab-fg">{value}</div>
    </div>
  )
}

function Note({ tone, title, text }: { tone: "amber" | "red" | "blue"; title: string; text?: string }) {
  const cls = {
    amber: "border-[#F0D28A] bg-[#FFF6E0] text-[#6B4600] dark:border-[#78350F] dark:bg-[#271A05] dark:text-[#FCD34D]",
    red: "border-[#F2BCBC] bg-[#FDECEC] text-[#8F1F1C] dark:border-[#7F1D1D] dark:bg-[#2A1215] dark:text-[#FCA5A5]",
    blue: "border-[#B9D1F7] bg-[#E8F0FD] text-[#1650A8] dark:border-[#1E3A8A] dark:bg-[#0E1A33] dark:text-[#93C5FD]",
  }[tone]
  return (
    <div className={cn("flex flex-col gap-1 rounded-[14px] border px-3.5 py-3", cls)}>
      <span className="text-[14px] font-semibold">{title}</span>
      {text && <span className="text-[13px] opacity-90">{text}</span>}
    </div>
  )
}

function ActionRow({
  icon,
  iconCls,
  title,
  sub,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  iconCls: string
  title: string
  sub: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[60px] w-full items-center gap-3 rounded-[14px] border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-left transition-colors",
        "hover:border-ab-line-2 hover:bg-ab-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span aria-hidden className={cn("flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]", iconCls)}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ab-fg">{title}</span>
        <span className="text-[12px] text-ab-fg-2">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ab-fg-3" aria-hidden />
    </button>
  )
}

/** Free days grouped per week: «Neste uke, uke 46», «Uke 47» … */
function groupWeeks(days: DayCell[], today: string): { monday: string; label: string; days: DayCell[] }[] {
  const out: { monday: string; label: string; days: DayCell[] }[] = []
  for (const c of days) {
    const monday = mondayOf(c.date)
    let g = out.find((x) => x.monday === monday)
    if (!g) {
      const rel = weekLabel(monday, today)
      g = { monday, label: rel.startsWith("Uke") ? rel : `${rel}, uke ${isoWeek(monday)}`, days: [] }
      out.push(g)
    }
    g.days.push(c)
  }
  return out
}

function Chip({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-[40px] rounded-[20px] border px-3.5 text-[13px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
        on ? "border-ab-fg bg-ab-fg text-ab-base" : "border-ab-line-2 bg-ab-elevated text-ab-fg hover:bg-ab-hover",
        className,
      )}
    >
      {children}
    </button>
  )
}

function Stepper({
  label,
  value,
  step,
  onChange,
  id,
}: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  id: string
}) {
  // Typed value mirrors `value`; the − / + buttons and a typed number both end in onChange.
  const [text, setText] = React.useState(String(value))
  React.useEffect(() => { setText((t) => (t === "" || Number(t) === value ? t : String(value))) }, [value])
  return (
    <div className="flex items-center justify-between gap-2 rounded-[14px] bg-ab-subtle py-1.5 pl-4 pr-1.5">
      <span id={id} className="text-[14px] font-semibold text-ab-fg">{label}</span>
      <div className="flex items-center gap-1.5" role="group" aria-labelledby={id}>
        <button
          type="button"
          aria-label={`Færre ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, value - step))}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-ab-line-2 bg-ab-elevated text-ab-fg hover:bg-ab-hover"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-labelledby={id}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            // digits only, max 3; empty while typing is fine, it becomes 0 on blur
            const raw = e.target.value.replace(/\D/g, "").slice(0, 3)
            setText(raw)
            if (raw !== "") onChange(Math.min(MAX_GOAL, Number(raw)))
          }}
          onBlur={() => { if (text === "") { setText("0"); onChange(0) } }}
          className="h-11 w-[64px] rounded-[12px] border border-transparent bg-transparent text-center text-[20px] font-bold tabular-nums text-ab-fg focus:border-ab-accent focus:bg-ab-elevated focus:outline-none"
        />
        <button
          type="button"
          aria-label={`Flere ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(MAX_GOAL, value + step))}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-ab-line-2 bg-ab-elevated text-ab-fg hover:bg-ab-hover"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── the panel body ──────────────────────────────────────────────────────────

export interface MinPanelProps {
  mode: PanelMode
  cell: DayCell | null
  today: string
  cells: DayCell[]
  defaults: Defaults
  busy: boolean
  error: string | null
  sentText: string
  /** new day chosen (by a grid click on desktop or a chip here) */
  chosen: string | null
  onChoose: (date: string | null) => void
  onStartMove: () => void
  onStartGoal: () => void
  onSendMove: (toDate: string, reason: string) => void
  onCancelPending: (requestId: string) => void
  onSaveGoal: (goals: { doors: number; givers: number } | null) => void
  onBack: () => void
  onClose: () => void
  /** phone: the sheet has its own header; desktop renders one here */
  withHeader: boolean
}

export function MinPanel(p: MinPanelProps) {
  const { mode, cell, today } = p
  const heading = panelHeading(mode, cell, today)
  const showBack = mode === "move" || mode === "goal"

  return (
    <div className="flex flex-col gap-3.5">
      {p.withHeader && (
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              type="button"
              aria-label="Tilbake"
              onClick={p.onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-ab-line bg-ab-elevated text-ab-fg hover:bg-ab-hover"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-display text-[17px] font-bold leading-6 text-ab-fg">{heading.title}</span>
            {heading.sub && <span className="text-[13px] text-ab-fg-2">{heading.sub}</span>}
          </div>
          {(cell || mode !== "day") && (
            <button
              type="button"
              aria-label="Lukk"
              onClick={p.onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-ab-line bg-ab-elevated text-ab-fg hover:bg-ab-hover"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {!p.withHeader && showBack && (
        <button type="button" onClick={p.onBack} className="-mt-1 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-ab-accent">
          <ChevronLeft className="h-4 w-4" /> Tilbake
        </button>
      )}

      {mode === "day" && <DayBody {...p} />}
      {mode === "move" && <MoveBody {...p} />}
      {mode === "goal" && <GoalBody {...p} />}
      {mode === "sent" && (
        <>
          <div className="flex flex-col items-center gap-2.5 px-0 pb-1 pt-2 text-center">
            <span aria-hidden className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#E6F5EE] text-[#157A4A] dark:bg-[#0F2417] dark:text-[#86EFAC]">
              <Check className="h-6 w-6" strokeWidth={2.6} />
            </span>
            <span className="text-[14px] leading-[1.5] text-ab-fg-2">{p.sentText}</span>
          </div>
          <Btn variant="primary" className="h-12 md:h-12" onClick={p.onClose}>
            Ferdig
          </Btn>
        </>
      )}
      {p.error && (
        <div role="alert" className="rounded-[12px] border border-[#F2BCBC] bg-[#FDECEC] px-3 py-2 text-[13px] text-[#8F1F1C] dark:border-[#7F1D1D] dark:bg-[#2A1215] dark:text-[#FCA5A5]">
          {p.error}
        </div>
      )}
    </div>
  )
}

function DayBody(p: MinPanelProps) {
  const { cell, today } = p
  if (!cell) {
    return (
      <span className="text-[13px] leading-[1.5] text-ab-fg-2">
        Klikk på en vakt i kalenderen for å bytte dag eller endre dagsmålet. Tidligere dager viser hvordan det gikk.
      </span>
    )
  }
  const mr = cell.move_request
  const pending = mr?.status === "venter" && mr.from_date === cell.date ? mr : null
  const pendingTo = mr?.status === "venter" && mr.to_date === cell.date && mr.from_date !== cell.date ? mr : null
  const declined = mr?.status === "avslatt" && mr.from_date === cell.date ? mr : null
  const hasShift = cell.shift_id !== null
  const canAct = hasShift && cell.date >= today && cell.state !== "no_show" && !pending
  const canMove = canAct && cell.date >= today
  const a = cell.actual

  return (
    <>
      {(cell.state === "worked" || cell.state === "today" || cell.state === "no_show") && a && (hasShift || a.doors > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Dører" value={fmtNum(a.doors)} />
          <Stat label="Givere" value={fmtNum(a.ja)} />
          <Stat label="Ja %" value={fmtPct(a.ja_pct ?? 0)} />
        </div>
      )}
      {cell.state === "no_show" && <Note tone="red" title="Markert som ikke møtt" text="Salgssjefen har satt dette. Snakk med salgssjefen hvis det er feil." />}
      {cell.state === "worked" && cell.goals && (
        <span className="text-[13px] text-ab-fg-2">{goalText(cell)}</span>
      )}
      {pending && (
        <>
          <Note
            tone="amber"
            title={`Du har bedt om å bytte til ${longDate(pending.to_date)}`}
            text="Venter på svar fra salgssjefen. Til da står vakten som før."
          />
          {pending.reason && <span className="text-[13px] text-ab-fg-2">Din grunn: «{pending.reason}»</span>}
          <Btn className="h-[46px] md:h-[46px]" disabled={p.busy} onClick={() => p.onCancelPending(pending.id)}>
            {p.busy ? "Trekker tilbake…" : "Trekk tilbake forespørselen"}
          </Btn>
        </>
      )}
      {pendingTo && (
        <Note tone="amber" title={`Byttedag for ${dayShort(pendingTo.from_date)}`} text="Blir en vakt når salgssjefen godkjenner byttet." />
      )}
      {declined && (
        <Note
          tone="red"
          title={`Forrige bytte (til ${dayShort(declined.to_date)}) ble avslått`}
          text={declined.decline_reason ? `Grunn: ${declined.decline_reason}` : undefined}
        />
      )}
      {cell.state === "off" && !pendingTo && (
        <span className="text-[13px] leading-[1.5] text-ab-fg-2">Fridag. Vil du jobbe denne dagen i stedet for en annen? Åpne vakten du vil flytte og velg «Bytt til en annen dag».</span>
      )}
      {canAct && (
        <div className="flex flex-col gap-2">
          {canMove && (
            <ActionRow
              icon={<ArrowLeftRight className="h-[19px] w-[19px]" />}
              iconCls="bg-[#E8F0FD] text-[#1F6FE0] dark:bg-[#0E1A33] dark:text-[#93C5FD]"
              title="Bytt til en annen dag"
              sub="Kan ikke jobbe denne dagen, tar den igjen senere"
              onClick={p.onStartMove}
              disabled={p.busy}
            />
          )}
          <ActionRow
            icon={<Target className="h-[19px] w-[19px]" />}
            iconCls="bg-[#E6F5EE] text-[#157A4A] dark:bg-[#0F2417] dark:text-[#86EFAC]"
            title="Endre dagsmål"
            sub={`Nå: ${goalText(cell).replace(/^Mål /, "").replace(/ \(justert\)$/, "")}${cell.goals?.source === "override" ? " (justert)" : ""}`}
            onClick={p.onStartGoal}
            disabled={p.busy}
          />
        </div>
      )}
    </>
  )
}

function MoveBody(p: MinPanelProps) {
  const { cell, today, cells, chosen } = p
  const [reason, setReason] = React.useState<string | null>(null)
  const [text, setText] = React.useState("")
  const [other, setOther] = React.useState("")

  const minDate = addDays(today, 1)
  const maxDate = addDays(today, MOVE_MAX_AHEAD)
  const pendingTargets = React.useMemo(
    () => new Set(cells.filter((c) => c.move_request?.status === "venter").map((c) => c.move_request!.to_date)),
    [cells],
  )
  const workDates = React.useMemo(() => new Set(cells.filter((c) => c.shift_id).map((c) => c.date)), [cells])
  const free = React.useMemo(
    () => cells.filter((c) => c.date > today && c.date <= maxDate && !c.shift_id && !pendingTargets.has(c.date)),
    [cells, today, maxDate, pendingTargets],
  )
  const otherBad = other !== "" && (other < minDate || other > maxDate || workDates.has(other) || pendingTargets.has(other))
  const to = chosen
  const reasonText = reason === "Annet" ? text.trim() : reason ?? ""
  const ok = !!to && !p.busy
  if (!cell) return null

  return (
    <>
      <div className="flex items-center gap-2.5">
        <div className="flex flex-1 flex-col gap-0.5 rounded-[12px] bg-ab-subtle px-3 py-2.5">
          <span className="text-[11px] text-ab-fg-2">Fra</span>
          <span className="text-[15px] font-bold text-ab-fg-2 line-through">{dayShort(cell.date)}</span>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-ab-fg-3" aria-hidden />
        <div
          className={cn(
            "flex flex-1 flex-col gap-0.5 rounded-[12px] border px-3 py-2.5",
            to ? "border-[#B9D1F7] bg-[#E8F0FD] dark:border-[#1E3A8A] dark:bg-[#0E1A33]" : "border-dashed border-ab-line-2 bg-ab-elevated",
          )}
        >
          <span className="text-[11px] text-ab-fg-2">Til</span>
          <span className="text-[15px] font-bold text-ab-fg">{to ? dayShort(to) : "Velg dag"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {free.length ? (
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Ledige dager">
            {groupWeeks(free.slice(0, 21), today).map((g) => (
              <div key={g.monday} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ab-fg-2">{g.label}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {g.days.map((c) => {
                    const { day, date } = cardDate(c.date)
                    const on = to === c.date
                    return (
                      <button
                        key={c.date}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => p.onChoose(on ? null : c.date)}
                        className={cn(
                          "flex min-h-[52px] flex-col items-center justify-center rounded-[12px] border transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
                          on ? "border-ab-accent bg-ab-accent text-ab-on-accent" : "border-ab-line-2 bg-ab-elevated text-ab-fg hover:bg-ab-hover",
                        )}
                      >
                        <span className="text-[13px] font-bold">{day}</span>
                        <span className={cn("text-[11px]", on ? "opacity-85" : "text-ab-fg-2")}>{date}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[13px] text-ab-fg-2">Ingen ledige dager i de neste ukene.</span>
        )}
        <span className="hidden text-[13px] text-[#1650A8] dark:text-[#93C5FD] lg:block">Du kan også klikke på en ledig dag i kalenderen.</span>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-ab-fg-2">Annen dato</span>
          <input
            type="date"
            min={minDate}
            max={maxDate}
            value={other}
            aria-invalid={otherBad || undefined}
            onChange={(e) => {
              const v = e.target.value
              setOther(v)
              const bad = v !== "" && (v < minDate || v > maxDate || workDates.has(v) || pendingTargets.has(v))
              p.onChoose(v && !bad ? v : null)
            }}
            className="h-11 rounded-[12px] border border-ab-line-2 bg-ab-elevated px-3 text-[14px] text-ab-fg focus:border-ab-accent focus:outline-none"
          />
          {otherBad && (
            <span className="text-[12px] text-[#B91C1C] dark:text-[#FCA5A5]">
              {workDates.has(other) ? "Du jobber allerede den dagen." : pendingTargets.has(other) ? "Du har allerede bedt om den dagen." : "Velg en dato fra i morgen og 8 uker frem."}
            </span>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ab-fg-2">
          Hvorfor? <span className="font-normal text-ab-fg-3">(valgfritt)</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <Chip key={r} on={reason === r} onClick={() => setReason(reason === r ? null : r)}>
              {r}
            </Chip>
          ))}
        </div>
        {reason === "Annet" && (
          <input
            type="text"
            value={text}
            maxLength={MAX_REASON}
            onChange={(e) => setText(e.target.value)}
            placeholder="F.eks. legetime torsdag formiddag"
            className="h-11 rounded-[12px] border border-ab-line-2 bg-ab-elevated px-3 text-[14px] text-ab-fg placeholder:text-ab-fg-4 focus:border-ab-accent focus:outline-none"
          />
        )}
      </div>
      <span className="text-[12px] leading-[1.5] text-ab-fg-2">Salgssjefen må godkjenne byttet. Til da står den opprinnelige vakten.</span>
      <Btn variant="primary" className="h-12 md:h-12" disabled={!ok} onClick={() => to && p.onSendMove(to, reasonText)}>
        {p.busy ? "Sender…" : ok ? "Send bytte til salgssjef" : "Velg ny dag først"}
      </Btn>
    </>
  )
}

function GoalBody(p: MinPanelProps) {
  const { cell, defaults } = p
  const [doors, setDoors] = React.useState<number>(cell?.goals?.doors ?? defaults.doors ?? 0)
  const [givers, setGivers] = React.useState<number>(cell?.goals?.givers ?? defaults.givers ?? 0)
  if (!cell) return null
  const fast =
    defaults.doors === null && defaults.givers === null
      ? "Salgssjefen har ikke satt et fast mål."
      : `Fast mål er ${fmtNum(defaults.doors)} ${doorsWord(defaults.doors)} og ${fmtNum(defaults.givers)} ${giversWord(defaults.givers)}.`
  return (
    <>
      <Stepper id="min-goal-doors" label="Dører" value={doors} step={10} onChange={setDoors} />
      <Stepper id="min-goal-givers" label="Givere" value={givers} step={1} onChange={setGivers} />
      <span className="text-[12px] text-ab-fg-2">{fast} Endringen gjelder bare denne dagen.</span>
      <Btn variant="primary" className="h-12 md:h-12" disabled={p.busy} onClick={() => p.onSaveGoal({ doors, givers })}>
        {p.busy ? "Lagrer…" : "Lagre dagsmål"}
      </Btn>
      <button
        type="button"
        disabled={p.busy || cell.goals?.source !== "override"}
        onClick={() => p.onSaveGoal(null)}
        className="min-h-[44px] text-[14px] font-semibold text-ab-accent disabled:opacity-40"
      >
        Bruk fast mål
      </button>
    </>
  )
}
