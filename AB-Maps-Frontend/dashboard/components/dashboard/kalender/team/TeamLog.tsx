"use client"

import * as React from "react"
import { History, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { schedulingApi, type LogEntry } from "@/lib/api/scheduling"
import { Avatar } from "./Avatar"

// «Logg» under the Teamkalender (client 2026-11-09): every change in the team's calendar,
// newest first, with who did it. Filter: everything / promoters / leaders. Text comes
// ready-made from the backend; this only lays it out.

const KIND: Record<string, { label: string; cls: string }> = {
  promotor: { label: "Promotør", cls: "bg-[#EFF6FF] text-[#1D4ED8] dark:bg-[#0E1A33] dark:text-[#93C5FD]" },
  salgssjef: { label: "Salgssjef", cls: "bg-[#ECFDF5] text-[#047857] dark:bg-[#0F2417] dark:text-[#86EFAC]" },
  admin: { label: "Admin", cls: "bg-[#F5F3FF] text-[#6D28D9] dark:bg-[#1E1A3A] dark:text-[#C4B5FD]" },
  leder: { label: "Teamleder", cls: "bg-ab-subtle text-ab-fg-2" },
}

const DOT: Record<string, string> = {
  "goal.changed": "bg-[#2563EB]", "goal.reset": "bg-[#2563EB]", "goal_defaults.changed": "bg-[#2563EB]",
  "shift.created": "bg-[#16A34A]", "shift.planned": "bg-[#16A34A]",
  "shift.deleted": "bg-[#DC2626]", "shift.bulk_deleted": "bg-[#DC2626]",
  "no_show.on": "bg-[#DC2626]", "no_show.off": "bg-ab-fg-3",
  "absence.on": "bg-[#DB2777]", "absence.off": "bg-ab-fg-3",
  "move.requested": "bg-[#D97706]", "move.cancelled": "bg-ab-fg-3", "move.approved": "bg-[#16A34A]", "move.declined": "bg-[#DC2626]",
}

const rel = new Intl.RelativeTimeFormat("nb-NO", { numeric: "auto" })
const full = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const hm = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" })

function when(iso: string, now: number): string {
  const t = new Date(iso).getTime()
  const min = Math.round((t - now) / 60000)
  if (Math.abs(min) < 1) return "nå nettopp"
  if (Math.abs(min) < 60) return rel.format(min, "minute")
  const h = Math.round(min / 60)
  if (Math.abs(h) < 24) return `${rel.format(h, "hour")}, ${hm.format(t)}`
  return full.format(t)
}

export function TeamLog({ teamId, version, canSeeAll }: { teamId: string | null; version: number; canSeeAll: boolean }) {
  const [kind, setKind] = React.useState<"" | "promotor" | "leder">("")
  const [rows, setRows] = React.useState<LogEntry[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [limit, setLimit] = React.useState(20)
  const [now, setNow] = React.useState(() => Date.now())
  const seq = React.useRef(0)

  const load = React.useCallback(async () => {
    if (!teamId) return
    const my = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const r = await schedulingApi.teamLog(teamId, kind || undefined)
      if (my === seq.current) { setRows(r); setNow(Date.now()) }
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : "Kunne ikke hente loggen.")
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [teamId, kind])

  React.useEffect(() => { setRows(null); setLimit(20); load() }, [load, version])

  const shown = (rows ?? []).slice(0, limit)
  const chips: { k: "" | "promotor" | "leder"; label: string }[] = [
    { k: "", label: "Alt" }, { k: "promotor", label: "Promotører" }, { k: "leder", label: "Ledere" },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-ab-line bg-ab-elevated p-[18px] dark:border-[#25272C] dark:bg-[#16171A]" aria-label="Logg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-ab-fg-3" aria-hidden />
          <h2 className="text-[15px] font-semibold">Logg</h2>
          <span className="text-[12px] text-ab-fg-3">siste endringer i teamets kalender</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1 rounded-[10px] border border-ab-line bg-ab-elevated p-0.5 dark:bg-[#1C1D21]" role="tablist" aria-label="Filter">
            {chips.map((c) => (
              <button key={c.k} type="button" role="tab" aria-selected={kind === c.k} onClick={() => setKind(c.k)}
                className={cn("min-h-[30px] rounded-[8px] px-2.5 text-[12px] font-semibold", kind === c.k ? "bg-ab-subtle text-ab-fg dark:bg-[#2A2D33] dark:text-white" : "text-ab-fg-2 hover:bg-ab-hover")}>
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Oppdater loggen" onClick={load} disabled={loading} className="flex h-[32px] w-[32px] items-center justify-center rounded-[10px] border border-ab-line text-ab-fg-2 hover:bg-ab-hover disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && <div className="text-[13px] text-[#B91C1C] dark:text-[#FCA5A5]">{error}</div>}
      {rows === null && !error && (
        <div className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-[10px] bg-ab-hover motion-reduce:animate-none" />)}
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="py-4 text-center text-[13px] text-ab-fg-2">Ingen endringer ennå{kind ? " fra " + (kind === "promotor" ? "promotører" : "ledere") : ""}.</div>
      )}
      {shown.length > 0 && (
        <ol className="relative flex flex-col">
          <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-ab-line-1" />
          {shown.map((r) => {
            const k = KIND[r.actor.kind] ?? KIND.leder
            return (
              <li key={r.id} className="relative flex items-start gap-3 py-2 pl-0">
                <span className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center">
                  {r.actor.name ? <Avatar name={r.actor.name} size={28} /> : <span className="h-7 w-7 rounded-full bg-ab-subtle" />}
                  <span aria-hidden className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-ab-elevated dark:ring-[#16171A]", DOT[r.action] ?? "bg-ab-fg-3")} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[13px] text-ab-fg">{r.text}</span>
                    <span className={cn("rounded-[6px] px-1.5 py-px text-[10px] font-semibold", k.cls)}>{k.label}</span>
                  </div>
                  <span className="text-[11px] text-ab-fg-3" title={full.format(new Date(r.at))}>{when(r.at, now)}</span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {rows && rows.length > shown.length && (
        <button type="button" onClick={() => setLimit((n) => n + 20)} className="self-start text-[13px] font-semibold text-[#2563EB] dark:text-[#7CB8FF]">
          Vis flere ({rows.length - shown.length} til)
        </button>
      )}
      {!canSeeAll && <p className="m-0 text-[11px] text-ab-fg-3">Loggen viser endringer for dette teamet.</p>}
    </section>
  )
}
