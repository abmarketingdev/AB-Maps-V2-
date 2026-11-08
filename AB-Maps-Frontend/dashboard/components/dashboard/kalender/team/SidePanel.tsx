"use client"

import * as React from "react"
import { Loader2, Minus, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DayCell, GridMember, MoveRequest } from "@/lib/api/scheduling"
import { cardDate, isoWeek, longDate } from "../dates"
import { doorsWord, fmtNum, fmtPct, giversWord } from "../states"
import { Avatar } from "./Avatar"
import { goalLine, goalMet, kindOf } from "./TeamCell"

// Right-hand column of the Teamkalender (client HTML 08 Nov): the selected
// day on top, the team's move requests below. Phone: the selected day opens
// in a bottom sheet instead (handled by the view).

export const BLUE_BTN = "bg-[#2563EB] border-[#2563EB] text-white hover:bg-[#1D4ED8] dark:bg-[#1D4F8A] dark:border-[#2F6FB8] dark:hover:bg-[#245E9F]"
export const GREEN_BTN = "bg-[#16A34A] border-[#16A34A] text-white hover:bg-[#15803D] dark:bg-[#185C3C] dark:border-[#23704C] dark:hover:bg-[#1E6E49]"
export const GREY_BTN = "bg-ab-elevated border-ab-line-2 text-ab-fg hover:bg-ab-hover dark:bg-[#1C1D21] dark:border-[#33363D]"
export const RED_BTN = "bg-transparent border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2] dark:border-[#5A2A2D] dark:text-[#FF8A8F] dark:hover:bg-[#2A1215]"
const BTN = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border px-4 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B9EFF]"

export function Btn2({ tone, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone: string }) {
  return <button type="button" className={cn(BTN, tone, className)} {...p} />
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface DayActions {
  createShift: (m: GridMember, date: string) => Promise<void>
  deleteShift: (m: GridMember, cell: DayCell) => Promise<void>
  setGoals: (m: GridMember, cell: DayCell, goals: { doors: number | null; givers: number | null } | null) => Promise<void>
  setNoShow: (m: GridMember, cell: DayCell, value: boolean) => Promise<void>
  approve: (r: MoveRequest) => Promise<void>
  decline: (r: MoveRequest, reason: string | null) => Promise<void>
}

// ── goal stepper with a typeable number ─────────────────────────────────────
function Stepper({ id, label, value, step, onChange }: { id: string; label: string; value: number; step: number; onChange: (v: number) => void }) {
  const [text, setText] = React.useState(String(value))
  React.useEffect(() => { setText((t) => (t === "" || Number(t) === value ? t : String(value))) }, [value])
  const btn = "flex h-11 w-11 items-center justify-center rounded-[10px] border border-ab-line-2 bg-ab-elevated text-ab-fg hover:bg-ab-hover dark:border-[#2F3238] dark:bg-[#24262B]"
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-[12px] bg-ab-subtle py-2 pl-3.5 pr-2 dark:bg-[#1C1D21]">
      <span id={id} className="text-[13px] text-ab-fg-2">{label}</span>
      <div className="flex items-center gap-1.5" role="group" aria-labelledby={id}>
        <button type="button" className={btn} aria-label={`Færre ${label.toLowerCase()}`} onClick={() => onChange(Math.max(0, value - step))}><Minus className="h-4 w-4" /></button>
        <input
          type="text" inputMode="numeric" pattern="[0-9]*" aria-labelledby={id} value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => { const raw = e.target.value.replace(/\D/g, "").slice(0, 3); setText(raw); if (raw !== "") onChange(Math.min(999, Number(raw))) }}
          onBlur={() => { if (text === "") { setText("0"); onChange(0) } }}
          className="h-11 w-[60px] rounded-[10px] border border-transparent bg-transparent text-center text-[18px] font-bold tabular-nums text-ab-fg focus:border-[#3B9EFF] focus:outline-none"
        />
        <button type="button" className={btn} aria-label={`Flere ${label.toLowerCase()}`} onClick={() => onChange(Math.min(999, value + step))}><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

// ── selected day ────────────────────────────────────────────────────────────
export function DayDetail({
  member, cell, today, editable, requests, actions, onClose, withHeader = true,
}: {
  member: GridMember | null
  cell: DayCell | null
  today: string
  editable: boolean
  requests: MoveRequest[]
  actions: DayActions
  onClose: () => void
  withHeader?: boolean
}) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState(false)
  const k = member && cell ? kindOf(cell, today) : null
  const def = member?.default_goals ?? null
  const [doors, setDoors] = React.useState(0)
  const [givers, setGivers] = React.useState(0)
  React.useEffect(() => {
    setDoors(cell?.goals?.doors ?? def?.doors ?? 0)
    setGivers(cell?.goals?.givers ?? def?.givers ?? 0)
    setConfirm(false)
  }, [cell?.shift_id, cell?.date, cell?.goals?.doors, cell?.goals?.givers, def?.doors, def?.givers])

  if (!member || !cell) {
    return (
      <>
        <div className="text-[15px] font-semibold">Velg en dag</div>
        <div className="text-[13px] leading-[1.5] text-ab-fg-2">Klikk på en celle i kalenderen for å se resultat, justere dagsmål, markere ikke møtt eller fjerne vakten.</div>
      </>
    )
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn() } catch { /* toast by the view */ } finally { setBusy(null) }
  }
  const req = requests.find((r) => r.person_id === member.person_id && r.status === "venter" && r.from_date === cell.date) ?? null
  const a = cell.actual
  const met = goalMet(cell)
  const override = cell.goals?.source === "override"
  const dirty = doors !== (cell.goals?.doors ?? 0) || givers !== (cell.goals?.givers ?? 0)
  const { day, date } = cardDate(cell.date)

  return (
    <>
      {withHeader && (
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={member.name} size={38} />
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="truncate text-[15px] font-semibold">{member.name}</span>
              <span className="text-[13px] text-ab-fg-2">{cap(longDate(cell.date))}, uke {isoWeek(cell.date)}</span>
            </div>
          </div>
          <button type="button" aria-label="Lukk" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-ab-line-2 text-ab-fg-2 hover:bg-ab-hover dark:border-[#2A2C31]"><X className="h-4 w-4" /></button>
        </div>
      )}

      {(k === "done" || k === "noshow" || (k === "today" && cell.shift_id)) && a && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[["Dører", fmtNum(a.doors)], ["Givere", String(a.ja)], ["Ja %", fmtPct(a.ja_pct ?? 0)]].map(([l, v]) => (
              <div key={l} className="rounded-[10px] bg-ab-subtle px-3 py-2.5 dark:bg-[#1C1D21]"><div className="text-[11px] text-ab-fg-2">{l}</div><div className="text-[20px] font-bold tabular-nums">{v}</div></div>
            ))}
          </div>
          {k === "done" && cell.goals && met !== null && (
            <div className={cn("text-[13px]", met ? "text-[#15803D] dark:text-[#5BE0A3]" : "text-[#B45309] dark:text-[#F5B54A]")}>
              {met ? "Nådde" : "Under"} {cell.goals.givers !== null ? `givermålet på ${cell.goals.givers}` : `dørmålet på ${cell.goals.doors}`}.
            </div>
          )}
          {k === "today" && <div className="text-[13px] text-ab-fg-2">På vakt i dag, mål {goalLine(cell)}.</div>}
        </>
      )}

      {k === "noshow" && <div className="rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-3 text-[13px] text-[#B91C1C] dark:border-[#7F1D1D] dark:bg-[#2A1215] dark:text-[#FCA5A5]">Markert som ikke møtt. Dagen vises rød for promotøren også.</div>}

      {req && (
        <>
          <div className="flex flex-col gap-1.5 rounded-[12px] border border-dashed border-[#D97706] bg-[#FFFBEB] px-3.5 py-3 dark:border-[#B07A1C] dark:bg-[#211B10]">
            <span className="text-[13px] font-semibold text-[#B45309] dark:text-[#F5B54A]">Ber om å bytte til {longDate(req.to_date)}</span>
            {req.reason && <span className="text-[13px] text-[#92400E] dark:text-[#D8C49C]">«{req.reason}»</span>}
          </div>
          {editable && (
            <div className="flex gap-2">
              <Btn2 tone={GREEN_BTN} className="flex-1" disabled={busy !== null} onClick={() => run("approve", () => actions.approve(req))}>{busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Godkjenn bytte"}</Btn2>
              <Btn2 tone={GREY_BTN} className="flex-1" disabled={busy !== null} onClick={() => run("decline", () => actions.decline(req, null))}>Avslå</Btn2>
            </div>
          )}
        </>
      )}

      {k === "off" && !cell.shift_id && (
        <>
          <div className="text-[13px] text-ab-fg-2">{cell.date < today ? "Ingen vakt denne dagen." : "Ingen vakt planlagt."}</div>
          {editable && cell.date >= today && (
            <Btn2 tone={BLUE_BTN} disabled={busy !== null} onClick={() => run("create", () => actions.createShift(member, cell.date))}>{busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Legg til vakt"}</Btn2>
          )}
        </>
      )}
      {k === "today" && !cell.shift_id && editable && (
        <Btn2 tone={BLUE_BTN} disabled={busy !== null} onClick={() => run("create", () => actions.createShift(member, cell.date))}>{busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Legg til vakt i dag"}</Btn2>
      )}

      {cell.shift_id && editable && k !== "noshow" && (k === "plan" || k === "today" || k === "swap") && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold">Dagsmål</span><span className="text-[12px] text-ab-fg-3">{def ? `Fast mål ${fmtNum(def.doors)} / ${fmtNum(def.givers)}` : "Uten fast mål"}</span></div>
          <Stepper id={`sd-${cell.date}`} label="Dører" value={doors} step={10} onChange={setDoors} />
          <Stepper id={`sg-${cell.date}`} label="Givere" value={givers} step={1} onChange={setGivers} />
          <div className="flex items-center gap-3">
            {dirty && <Btn2 tone={BLUE_BTN} className="min-h-[40px]" disabled={busy !== null} onClick={() => run("goals", () => actions.setGoals(member, cell, { doors, givers }))}>{busy === "goals" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lagre dagsmål"}</Btn2>}
            {override && <button type="button" disabled={busy !== null} onClick={() => run("reset", () => actions.setGoals(member, cell, null))} className="min-h-[40px] text-[13px] font-medium text-[#2563EB] dark:text-[#7CB8FF]">Tilbakestill til fast mål</button>}
          </div>
        </div>
      )}

      {cell.shift_id && editable && cell.date <= today && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-ab-subtle px-3.5 py-2.5 dark:bg-[#1C1D21]">
          <div><div className="text-[13px] font-semibold">Ikke møtt</div><div className="text-[12px] text-ab-fg-2">{k === "noshow" ? "Slå av hvis det var feil" : `Marker hvis ${member.name.split(" ")[0]} ikke jobbet`}</div></div>
          <button
            type="button" role="switch" aria-checked={k === "noshow"} aria-label="Ikke møtt" disabled={busy !== null}
            onClick={() => run("noshow", () => actions.setNoShow(member, cell, k !== "noshow"))}
            className={cn("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors", k === "noshow" ? "bg-[#DC2626]" : "bg-ab-line-2 dark:bg-[#34373E]")}
          >
            <span className={cn("absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left]", k === "noshow" ? "left-[19px]" : "left-[3px]")} />
          </button>
        </div>
      )}

      {cell.shift_id && editable && cell.date >= today && (
        <Btn2 tone={RED_BTN} disabled={busy !== null} onClick={() => { if (!confirm) { setConfirm(true); return } run("delete", () => actions.deleteShift(member, cell)) }}>
          {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : confirm ? `Ja, fjern vakten ${day} ${date}` : "Fjern vakt"}
        </Btn2>
      )}
      {!editable && cell.shift_id && <div className="text-[12px] text-ab-fg-3">Kun lesing. Salgssjefen for teamet endrer kalenderen.</div>}
    </>
  )
}

// ── requests ────────────────────────────────────────────────────────────────
export function RequestsList({ requests, loading, editable, actions, onPickTeam, otherTeams }: {
  requests: MoveRequest[] | null
  loading: boolean
  editable: boolean
  actions: Pick<DayActions, "approve" | "decline">
  otherTeams: { id: string; name: string; count: number }[]
  onPickTeam: (id: string) => void
}) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const [declining, setDeclining] = React.useState<string | null>(null)
  const [reason, setReason] = React.useState("")
  const open = (requests ?? []).filter((r) => r.status === "venter")
  const done = (requests ?? []).filter((r) => r.status !== "venter").slice(0, 5)
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn() } catch { /* toast by the view */ } finally { setBusy(null) } }

  const item = (r: MoveRequest) => {
    const f = cardDate(r.from_date), t = cardDate(r.to_date)
    const isOpen = r.status === "venter"
    return (
      <div key={r.id} className={cn("flex flex-col gap-2.5 rounded-[12px] border border-ab-line p-3", isOpen ? "bg-ab-subtle dark:bg-[#1A1B1F]" : "opacity-75")}>
        <div className="flex items-center gap-2.5">
          <Avatar name={r.person_name} size={30} />
          <div className="flex min-w-0 flex-col gap-[2px]">
            <span className="truncate text-[13px] font-semibold">{r.person_name}</span>
            <span className="text-[12px] text-ab-fg-2">{f.day} {f.date} <span aria-label="til">→</span> {t.day} {t.date}</span>
          </div>
        </div>
        {r.reason && <span className="text-[12px] text-ab-fg-2">«{r.reason}»</span>}
        {isOpen && editable && declining !== r.id && (
          <div className="flex gap-2">
            <Btn2 tone={GREEN_BTN} className="flex-1" disabled={busy !== null} onClick={() => run(r.id, () => actions.approve(r))}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Godkjenn"}</Btn2>
            <Btn2 tone={GREY_BTN} className="flex-1" disabled={busy !== null} onClick={() => { setDeclining(r.id); setReason("") }}>Avslå</Btn2>
          </div>
        )}
        {isOpen && editable && declining === r.id && (
          <div className="flex flex-col gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} placeholder="Grunn (valgfritt), promotøren ser den" aria-label="Grunn for avslag" className="h-11 rounded-[10px] border border-ab-line-2 bg-ab-elevated px-3 text-[13px] text-ab-fg placeholder:text-ab-fg-4 focus:border-[#3B9EFF] focus:outline-none dark:bg-[#1C1D21]" />
            <div className="flex gap-2">
              <Btn2 tone={RED_BTN} className="flex-1 min-h-[40px]" disabled={busy !== null} onClick={() => run(r.id, async () => { await actions.decline(r, reason.trim() || null); setDeclining(null) })}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Avslå byttet"}</Btn2>
              <Btn2 tone={GREY_BTN} className="min-h-[40px]" disabled={busy !== null} onClick={() => setDeclining(null)}>Angre</Btn2>
            </div>
          </div>
        )}
        {isOpen && !editable && <span className="text-[12px] text-ab-fg-3">Venter på salgssjefen</span>}
        {!isOpen && (
          <span className={cn("text-[12px] font-semibold", r.status === "godkjent" ? "text-[#15803D] dark:text-[#5BE0A3]" : "text-ab-fg-2")}>
            {r.status === "godkjent" ? "Godkjent, vakten er flyttet" : r.status === "avslatt" ? `Avslått${r.decline_reason ? `: ${r.decline_reason}` : ", vakten står"}` : "Trukket tilbake"}
            {r.decided_by_name ? ` · ${r.decided_by_name}` : ""}
          </span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold">Bytteforespørsler</span>
        {open.length > 0 && <span className="rounded-[10px] bg-[#FEF3C7] px-2.5 py-[3px] text-[12px] font-bold text-[#92400E] dark:bg-[#3A2A0F] dark:text-[#F5B54A]">{open.length} åpne</span>}
      </div>
      {loading && requests === null && <div className="text-[13px] text-ab-fg-2">Laster…</div>}
      {requests && open.length === 0 && done.length === 0 && <div className="text-[13px] text-ab-fg-2">Ingen forespørsler for dette teamet.</div>}
      {open.map(item)}
      {done.length > 0 && <div className="pt-1 text-[12px] font-semibold text-ab-fg-3">Behandlet</div>}
      {done.map(item)}
      {otherTeams.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-ab-line-1 pt-3 text-[12px] text-ab-fg-2">
          <span>Venter i andre team:</span>
          {otherTeams.map((t) => <button key={t.id} type="button" onClick={() => onPickTeam(t.id)} className="text-left font-semibold text-[#2563EB] hover:underline dark:text-[#7CB8FF]">{t.name} · {t.count}</button>)}
        </div>
      )}
    </>
  )
}
