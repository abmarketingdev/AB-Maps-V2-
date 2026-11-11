"use client"

/**
 * Salgsorganisasjon on maps (S-ORG, kunden 11.11) — replaces the old /teams list.
 * Port of the HR «Salgsorganisasjon» page (City → Salgssjef → Team → Teamleder +
 * selgere) in the maps dark look, from the same HR endpoint (/api/hr/teams/org/).
 *
 * Access is decided by HR, never guessed here: super admins see the whole org, a
 * sales chief (by team data) only their own teams; team leaders / employees get 403
 * → «Ingen tilgang». No provisjon on maps, and no create/delete/rename/city/chief/
 * rates — those stay in HR. Structure changes go through the M-TEAM sheet, which
 * only shows its buttons when HR says `can_restructure`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, ChevronDown, Crown, MapPin, Info, Lock, Pencil, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  fetchOrg, getTeam, OrgNoAccessError, ORG_AVVIK, ORG_UTEN_BY, ORG_WARNING_LABEL,
  type OrgChief, type OrgMember, type OrgTeam, type OrgTree, type OrgWarning, type TeamDetail,
} from "@/lib/api/teams"
import { TeamDetailSheet } from "./TeamDetailSheet"
import { PanelLoading, PanelError } from "./_states"

const ALLE = "alle"

const isAvvik = (t: OrgTeam) => t.warnings.some(w => ORG_AVVIK.includes(w))
const sortWarn = (w: OrgWarning[]) => [...w.filter(x => ORG_AVVIK.includes(x)), ...w.filter(x => !ORG_AVVIK.includes(x))]
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n
const initials = (n: string | null | undefined) =>
  (n ?? "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?"

/** Stable avatar tint per name (maps palette). */
const TINTS = [
  "bg-blue-500/15 text-blue-300", "bg-emerald-500/15 text-emerald-300", "bg-purple-500/15 text-purple-300",
  "bg-amber-500/15 text-amber-300", "bg-pink-500/15 text-pink-300", "bg-cyan-500/15 text-cyan-300",
]
const tint = (n: string | null | undefined) => {
  const s = n ?? "?"
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

function Avatar({ name, size = "md" }: { name: string | null | undefined; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full font-bold",
      size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs", tint(name))}>
      {initials(name)}
    </span>
  )
}

export function SalgsorgView() {
  const { toast } = useToast()
  const [city, setCity] = useState<string>(ALLE)
  const [onlyWarn, setOnlyWarn] = useState(false)
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [state, setState] = useState<"loading" | "ok" | "error" | "denied">("loading")
  const [closedS, setClosedS] = useState<Record<string, boolean>>({}) // chiefs start open
  const [openT, setOpenT] = useState<Record<string, boolean>>({})     // teams start closed
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    const id = ++reqId.current
    try {
      const data = await fetchOrg({ city: city === ALLE ? undefined : city, search: q || undefined, onlyWarnings: onlyWarn })
      if (id !== reqId.current) return
      setTree(data); setState("ok")
    } catch (e) {
      if (id !== reqId.current) return
      setState(e instanceof OrgNoAccessError ? "denied" : "error")
    }
  }, [city, q, onlyWarn])
  useEffect(() => { void load() }, [load])

  const openTeam = async (id: string) => {
    try { setDetail(await getTeam(id)) }
    catch { toast({ title: "Kunne ikke åpne team", variant: "destructive" }) }
  }
  /** After a structure change in the sheet: reload the tree and the open sheet. */
  const afterChange = async (teamId: string) => {
    void load()
    try { setDetail(await getTeam(teamId)) } catch { setDetail(null) }
  }

  const chips = useMemo(() => {
    const counts = tree?.city_counts ?? []
    const total = counts.reduce((a, c) => a + (c.count || 0), 0)
    const list = [{ key: ALLE, label: "Alle byer", count: total }, ...counts.map(c => ({ key: c.city, label: c.label, count: c.count }))]
    if (!counts.some(c => c.city === ORG_UTEN_BY)) list.push({ key: ORG_UTEN_BY, label: "Uten by", count: 0 })
    return list
  }, [tree])

  const cards = useMemo(() => {
    if (!tree) return []
    const out: { key: string; cityLabel: string; chief: OrgChief; teams: OrgTeam[] }[] = []
    for (const c of tree.cities) {
      for (const ch of c.chiefs) {
        const teams = onlyWarn ? ch.teams.filter(isAvvik) : ch.teams
        if (onlyWarn && !teams.length) continue
        out.push({ key: `${c.city}|${ch.chief_id ?? "none"}`, cityLabel: c.label, chief: ch, teams })
      }
    }
    return out
  }, [tree, onlyWarn])

  if (state === "denied") {
    return (
      <div className="min-h-screen bg-ab-base px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-ab-line bg-ab-elevated p-8 text-center" data-testid="org-no-access">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ab-hover border border-ab-line"><Lock className="h-5 w-5 text-ab-fg-3" /></div>
          <h1 className="text-xl font-bold text-ab-fg">Ingen tilgang</h1>
          <p className="mt-2 text-sm text-ab-fg-3">Bare salgssjefer og admin har tilgang til salgsorganisasjonen.</p>
        </div>
      </div>
    )
  }

  const kpi = tree?.kpi ?? { sjefer: 0, team: 0, selgere: 0, avvik: 0 }
  const anyEditable = !!tree?.cities.some(c => c.chiefs.some(ch => ch.teams.some(t => t.can_restructure)))

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1180px] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-ab-fg-4">Organisasjon</p>
            <h1 className="text-2xl font-bold text-ab-fg sm:text-3xl">Salgsorganisasjon</h1>
            <p className="text-sm text-ab-fg-3">
              {tree && !tree.sees_all ? "Dine team, fordelt på byer" : "Salgssjefer, team og selgere fordelt på byer"}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ab-fg-4" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Navn eller AB ID"
              aria-label="Søk"
              className="h-10 w-full rounded-xl border border-ab-line bg-ab-elevated pl-8 pr-3 text-sm text-ab-fg outline-none placeholder:text-ab-fg-4 focus:border-blue-500/50" />
          </div>
        </div>

        {/* City chips + only avvik */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer på by">
            {chips.map(c => {
              const on = city === c.key
              return (
                <button key={c.key} onClick={() => setCity(c.key)} aria-pressed={on}
                  className={cn("flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    on ? "border-blue-500/60 bg-blue-500/15 text-ab-fg" : "border-ab-line bg-ab-elevated text-ab-fg-2 hover:bg-ab-hover")}>
                  {c.label}<span className="text-xs opacity-70">{c.count}</span>
                </button>
              )
            })}
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ab-fg-2">
            <input type="checkbox" checked={onlyWarn} onChange={() => setOnlyWarn(v => !v)} className="h-4 w-4 accent-amber-500" />
            Vis bare team med avvik
          </label>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([["Salgssjefer", kpi.sjefer], ["Team", kpi.team], ["Selgere", kpi.selgere]] as const).map(([l, v]) => (
            <div key={l} className="rounded-xl border border-ab-line bg-ab-elevated p-4">
              <p className="text-xs text-ab-fg-3">{l}</p>
              <p className="mt-1 text-2xl font-bold text-ab-fg">{tree ? v : "–"}</p>
            </div>
          ))}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-xs text-amber-300">Team med avvik</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{tree ? kpi.avvik : "–"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm text-ab-fg-3">
          <Info className="h-4 w-4 shrink-0 text-blue-400" />
          {anyEditable
            ? "Endringer i medlemmer og teamledere lagres i HR. Nye team, satser og salgssjef endres i HR-systemet."
            : "Team administreres i HR-systemet."}
        </div>

        {state === "loading" && !tree ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated"><PanelLoading label="Laster salgsorganisasjonen…" /></div>
        ) : state === "error" ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated"><PanelError onRetry={() => void load()} /></div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ab-line bg-ab-elevated p-8 text-center text-sm text-ab-fg-3">
            {onlyWarn ? "Ingen team med avvik her. Alt ser ryddig ut." : q ? `Ingen treff på «${q}».` : "Ingen team her ennå."}
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map(({ key, cityLabel, chief, teams }) => (
              <ChiefCard key={key} cityLabel={cityLabel} chief={chief} teams={teams}
                open={!closedS[key]} onToggle={() => setClosedS(s => ({ ...s, [key]: !s[key] }))}
                openT={openT} onToggleTeam={id => setOpenT(s => ({ ...s, [id]: !s[id] }))}
                onEdit={openTeam} />
            ))}
          </div>
        )}
      </div>

      <TeamDetailSheet team={detail} onClose={() => setDetail(null)} onChanged={afterChange} />
    </div>
  )
}

function ChiefCard({ cityLabel, chief, teams, open, onToggle, openT, onToggleTeam, onEdit }: {
  cityLabel: string; chief: OrgChief; teams: OrgTeam[]; open: boolean; onToggle: () => void
  openT: Record<string, boolean>; onToggleTeam: (id: string) => void; onEdit: (id: string) => void
}) {
  const real = !!chief.chief_id
  return (
    <section className="overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl" data-testid="org-chief">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3.5">
          {real ? <Avatar name={chief.name} size="lg" /> : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ab-hover text-base font-bold text-ab-fg-3">?</span>
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-ab-fg">{chief.name}</span>
              {real && <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300"><Crown className="h-3 w-3" />Salgssjef</span>}
              <span className="flex items-center gap-1 rounded-full bg-ab-hover px-2.5 py-0.5 text-xs font-semibold text-ab-fg-2"><MapPin className="h-3 w-3" />{cityLabel}</span>
            </div>
            <p className="text-xs text-ab-fg-3">{real ? `AB ID ${chief.ab_id ?? "mangler"}` : "Team som ikke har fått en salgssjef ennå"}</p>
          </div>
        </div>
        <div className="flex gap-7">
          <Stat label="Team" value={chief.team_count} />
          <Stat label="Selgere" value={chief.seller_count} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chief.warning_count > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
              {chief.warning_count === 1 ? "1 team med avvik" : `${chief.warning_count} team med avvik`}
            </span>
          )}
          <button onClick={onToggle} aria-expanded={open}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-ab-line bg-ab-base/40 px-3 text-sm font-medium text-ab-fg-2 hover:bg-ab-hover">
            {open ? "Skjul team" : `Vis ${chief.team_count} team`}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col border-t border-ab-line bg-ab-base/30 px-3 pb-4 pt-1 sm:pl-10 sm:pr-5">
          {teams.map((t, idx) => (
            <div key={t.id} className="flex">
              <div aria-hidden="true" className="relative hidden w-7 shrink-0 sm:block">
                <div className="absolute left-0 top-0 w-0.5 bg-ab-line" style={{ height: idx === teams.length - 1 ? 38 : "100%" }} />
                <div className="absolute left-0 top-[37px] h-0.5 w-5 bg-ab-line" />
              </div>
              <div className="min-w-0 flex-1 pt-2.5">
                <TeamRow team={t} chief={chief} open={!!openT[t.id]} onToggle={() => onToggleTeam(t.id)} onEdit={() => onEdit(t.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ab-fg-3">{label}</span>
      <span className="text-lg font-semibold text-ab-fg">{value}</span>
    </div>
  )
}

function TeamRow({ team: t, chief, open, onToggle, onEdit }: {
  team: OrgTeam; chief: OrgChief; open: boolean; onToggle: () => void; onEdit: () => void
}) {
  const warns = sortWarn(t.warnings)
  const avvik = isAvvik(t)
  const warnShort = warns.length > 1 ? `${ORG_WARNING_LABEL[warns[0]]} +${warns.length - 1}` : warns[0] ? ORG_WARNING_LABEL[warns[0]] : ""
  // The leader / co-leader show in their own cards; everyone else in the list.
  const members = t.members.filter(m => !(m.is_leader || m.is_co_leader) || m.is_chief_duplicate)

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-ab-elevated", avvik ? "border-amber-500/40" : "border-ab-line")} data-testid="org-team">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3.5 py-2.5">
        <button onClick={onToggle} aria-expanded={open}
          className="flex min-h-[44px] min-w-0 flex-[1_1_240px] cursor-pointer items-center gap-3 text-left">
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-ab-fg-3 transition-transform", !open && "-rotate-90")} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold text-ab-fg">{t.name}</span>
            {t.leader ? (
              <span className="truncate text-xs text-blue-300">Teamleder {t.leader.name ?? "Ukjent person"}</span>
            ) : (
              <span className="truncate text-xs text-amber-300">
                {t.sales_chief_id ? `Ingen teamleder, rapporterer direkte til ${firstName(chief.name)}` : "Ingen teamleder og ingen salgssjef"}
              </span>
            )}
          </span>
        </button>
        <span className="text-xs text-ab-fg-3"><strong className="text-[15px] text-ab-fg">{t.count}</strong> selgere</span>
        <span className="text-xs text-ab-fg-3 truncate max-w-[180px]">{t.campaign?.name ?? "Ingen kampanje"}</span>
        <div className="ml-auto flex items-center gap-2">
          {warns.length > 0 ? (
            <span title={warns.map(w => ORG_WARNING_LABEL[w]).join(", ")} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">{warnShort}</span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">I orden</span>
          )}
          <button onClick={onEdit} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-ab-line px-3 text-sm font-medium text-ab-fg-2 hover:bg-ab-hover">
            {t.can_restructure ? <><Pencil className="h-3.5 w-3.5" />Rediger</> : <><Users className="h-3.5 w-3.5" />Åpne</>}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-ab-line p-3.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <LeadCard role="Teamleder" person={t.leader} empty="Ingen teamleder ennå" warn />
            <LeadCard role="Nestleder" person={t.co_leader} empty="Valgfritt" />
          </div>
          {members.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ab-line p-3 text-center text-sm text-ab-fg-3">Ingen selgere i teamet ennå.</p>
          ) : (
            <ul className="divide-y divide-ab-line rounded-lg border border-ab-line">
              {members.map(m => <MemberRow key={m.person_id} m={m} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function LeadCard({ role, person, empty, warn }: { role: string; person: OrgTeam["leader"]; empty: string; warn?: boolean }) {
  if (!person) {
    return (
      <div className={cn("flex flex-col gap-0.5 rounded-lg border border-dashed px-3.5 py-3",
        warn ? "border-amber-500/40 bg-amber-500/5" : "border-ab-line")}>
        <span className={cn("text-xs font-semibold", warn ? "text-amber-300" : "text-ab-fg-3")}>{role}</span>
        <span className={cn("text-sm", warn ? "text-amber-300" : "text-ab-fg-3")}>{empty}</span>
      </div>
    )
  }
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg border px-3.5 py-3",
      role === "Teamleder" ? "border-blue-500/30 bg-blue-500/5" : "border-ab-line")}>
      <Avatar name={person.name} />
      <div className="min-w-0">
        <p className={cn("text-xs font-semibold", role === "Teamleder" ? "text-blue-300" : "text-ab-fg-3")}>{role}</p>
        <p className="truncate text-sm font-semibold text-ab-fg">{person.name ?? "Ukjent person"}</p>
        <p className="text-xs text-ab-fg-4">AB ID {person.ab_id ?? "mangler"}</p>
      </div>
    </div>
  )
}

function MemberRow({ m }: { m: OrgMember }) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <Avatar name={m.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ab-fg">{m.name ?? "Ukjent person"}</p>
        <p className="text-xs text-ab-fg-4">AB ID {m.ab_id ?? "mangler"}</p>
      </div>
      {m.is_chief_duplicate && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Salgssjef</span>}
      {m.type === "leder" && !m.is_chief_duplicate && <span className="rounded-full bg-ab-hover px-2 py-0.5 text-[11px] font-semibold text-ab-fg-3">Leder</span>}
    </li>
  )
}

export default SalgsorgView
