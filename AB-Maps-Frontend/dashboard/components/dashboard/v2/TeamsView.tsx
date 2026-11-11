"use client"

/**
 * Team — team overview, read from the HR microservice (/api/hr/teams/).
 * HR is the only place teams are created, deleted or priced (2026-11-05). Since
 * 11.11 (M-TEAM) a sales chief changes the structure of their OWN teams here
 * (members, «Flytt til team», leader / co-leader) — HR is still the writer and
 * says per team in `can_restructure` whether the caller may. Maps shows them
 * grouped by City → Sales chief → Teams. Access is role-scoped server-side:
 * team-leads see only the team(s) they lead, sales-chiefs their own; only the
 * allow-list (admin_lars, ole_sormbråten, Joseph) sees all (HR `sees_all`);
 * employees never reach this (nav-hidden + backend 403).
 * No provisjon/rates are shown here. Team goals are set elsewhere (Mål).
 */

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Users, Search, X, ChevronDown, Crown, Check, MapPin, Info, MoreVertical, ArrowRightLeft, UserMinus, UserPlus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { useToast } from "@/hooks/use-toast"
import {
  listTeams, getTeam, TEAM_CITIES, fetchAssignablePeople, addTeamMember, removeTeamMember,
  moveTeamMember, setTeamLeaders, type TeamListItem, type TeamDetail, type TeamMember, type AssignablePerson,
} from "@/lib/api/teams"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

const NO_CITY = "Uten by"
const NO_CHIEF = "Uten salgssjef"

interface CampaignVM { id: string; name: string; color: string }
interface ChiefGroup { key: string; name: string; teams: TeamListItem[] }
interface CityGroup { city: string; chiefs: ChiefGroup[]; teamCount: number }

const cityRank = (c: string) => {
  const i = (TEAM_CITIES as readonly string[]).indexOf(c)
  return i === -1 ? TEAM_CITIES.length + (c === NO_CITY ? 1 : 0) : i
}

/** City → sales chief → teams. Cities in HR order then «Uten by»; chiefs alphabetical, «Uten salgssjef» last. */
function groupTeams(teams: TeamListItem[]): CityGroup[] {
  const cities = new Map<string, Map<string, ChiefGroup>>()
  for (const t of teams) {
    const city = t.city || NO_CITY
    const chiefs = cities.get(city) ?? new Map<string, ChiefGroup>()
    const key = t.sales_chief?.id ?? "__none__"
    const g = chiefs.get(key) ?? { key, name: t.sales_chief?.name || NO_CHIEF, teams: [] }
    g.teams.push(t)
    chiefs.set(key, g)
    cities.set(city, chiefs)
  }
  return [...cities.entries()]
    .sort(([a], [b]) => cityRank(a) - cityRank(b) || a.localeCompare(b, "nb", { numeric: true }))
    .map(([city, chiefs]) => {
      const list = [...chiefs.values()]
        .map(g => ({ ...g, teams: [...g.teams].sort((a, b) => a.name.localeCompare(b.name, "nb", { numeric: true })) }))
        .sort((a, b) => (a.key === "__none__" ? 1 : 0) - (b.key === "__none__" ? 1 : 0) || a.name.localeCompare(b.name, "nb", { numeric: true }))
      return { city, chiefs: list, teamCount: list.reduce((n, g) => n + g.teams.length, 0) }
    })
}

export function TeamsView() {
  const reduced = useReducedMotion()
  const { toast } = useToast()
  // HR decides who sees ALL teams (allow-list, Dana 05.11) and says so in `sees_all`;
  // everyone else gets only the team(s) they chief/lead, with no chief filter.
  const [seesAll, setSeesAll] = useState(false)

  const [campaigns, setCampaigns] = useState<CampaignVM[]>([])
  const [campaignFilter, setCampaignFilter] = useState<string>("")
  const [campOpen, setCampOpen] = useState(false)
  const [search, setSearch] = useState("")
  // Sees-all only: filter by sales chief.
  const [salesChiefFilter, setSalesChiefFilter] = useState<string>("")
  const [chiefOpen, setChiefOpen] = useState(false)
  const [chiefOptions, setChiefOptions] = useState<{ id: string; name: string }[]>([])

  const [teams, setTeams] = useState<TeamListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  const [detail, setDetail] = useState<TeamDetail | null>(null)

  useEffect(() => {
    fetchCampaignsWithStats().then(l => setCampaigns(l.map(c => ({ id: c.id, name: c.name, color: c.color })))).catch(() => {})
  }, [])
  // Teams are not campaign-based (Dana, 2026-11-05): most have no campaign, so the page
  // starts on «Alle kampanjer» and does NOT follow the globally selected campaign.

  const load = useCallback(() => {
    setLoading(true); setErrored(false)
    return listTeams({
      campaignId: campaignFilter || undefined,
      salesChiefId: salesChiefFilter || undefined,
      search: search || undefined,
      pageSize: 200,
    })
      .then(res => {
        setTeams(res.results)
        setSeesAll(res.sees_all)
        // Populate the sales-chief filter from the full (chief-unfiltered) set so
        // picking one chief doesn't shrink the dropdown.
        if (res.sees_all && !salesChiefFilter) {
          const seen = new Map<string, string>()
          res.results.forEach(t => { if (t.sales_chief) seen.set(t.sales_chief.id, t.sales_chief.name) })
          setChiefOptions([...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "nb", { numeric: true })))
        }
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [campaignFilter, salesChiefFilter, search])
  useEffect(() => { const t = setTimeout(() => { void load() }, 250); return () => clearTimeout(t) }, [load])

  const openDetail = async (id: string) => {
    try { setDetail(await getTeam(id)) }
    catch { toast({ title: "Kunne ikke åpne team", variant: "destructive" }) }
  }

  const campaignName = (id: string | undefined) => campaigns.find(c => c.id === id)?.name ?? "Kampanje"
  const chiefName = (id: string) => chiefOptions.find(c => c.id === id)?.name ?? "Salgssjef"

  const groups = useMemo(() => groupTeams(teams), [teams])
  const anyOwned = teams.some(t => t.can_restructure)

  /** After a structure change: refresh the list and the open sheet. */
  const afterChange = async (teamId: string) => {
    void load()
    try { setDetail(await getTeam(teamId)) } catch { setDetail(null) }
  }

  const renderTeamCard = (t: TeamListItem, i: number) => (
    <motion.button key={t.id} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
      onClick={() => openDetail(t.id)}
      className="cursor-pointer text-left rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5 hover:bg-ab-hover transition-all">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ab-hover border border-ab-line"><Users className="h-5 w-5 text-ab-fg-3" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-ab-fg truncate">{t.name}</p>
          <p className="text-xs text-ab-fg-3 truncate">{t.campaign?.name ?? "Ingen kampanje"}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-ab-fg-3 shrink-0"><Users className="h-3.5 w-3.5" /> {t.member_count} medlem{t.member_count === 1 ? "" : "mer"}</span>
        <span className="flex items-center gap-1.5 text-ab-fg-4 min-w-0">
          <Crown className="h-3 w-3 shrink-0 text-amber-400/70" />
          <span className="truncate">{t.owner?.name || "Ingen teamleder"}</span>
        </span>
      </div>
    </motion.button>
  )

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative px-4 sm:px-6 py-5 sm:py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-ab-fg-4 mb-1">Lag · Salgsorganisasjon</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-ab-fg">Team</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-4" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk team…" className="h-10 w-48 rounded-xl border border-ab-line bg-ab-elevated pl-8 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" />
            </div>
            {/* Campaign filter */}
            <div className="relative">
              <button onClick={() => setCampOpen(o => !o)} className="cursor-pointer flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm font-medium text-ab-fg-2 hover:text-ab-fg transition-all">
                {campaignFilter ? campaignName(campaignFilter) : "Alle kampanjer"} <ChevronDown className="h-3.5 w-3.5 text-ab-fg-3" />
              </button>
              <AnimatePresence>
                {campOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCampOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-full mt-2 z-20 w-56 max-h-72 overflow-y-auto rounded-xl border border-ab-line bg-ab-overlay shadow-2xl py-1">
                      <button onClick={() => { setCampaignFilter(""); setCampOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-ab-hover text-left"><span className="flex-1 text-ab-fg-2">Alle kampanjer</span>{!campaignFilter && <Check className="h-3.5 w-3.5 text-blue-400" />}</button>
                      {campaigns.map(c => (
                        <button key={c.id} onClick={() => { setCampaignFilter(c.id); setCampOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-ab-hover text-left">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="flex-1 text-ab-fg-2 truncate">{c.name}</span>{campaignFilter === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            {/* Sales-chief filter (only for callers who see every team) */}
            {seesAll && chiefOptions.length > 0 && (
              <div className="relative">
                <button onClick={() => setChiefOpen(o => !o)} className="cursor-pointer flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm font-medium text-ab-fg-2 hover:text-ab-fg transition-all">
                  {salesChiefFilter ? chiefName(salesChiefFilter) : "Alle salgssjefer"} <ChevronDown className="h-3.5 w-3.5 text-ab-fg-3" />
                </button>
                <AnimatePresence>
                  {chiefOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setChiefOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-full mt-2 z-20 w-56 max-h-72 overflow-y-auto rounded-xl border border-ab-line bg-ab-overlay shadow-2xl py-1">
                        <button onClick={() => { setSalesChiefFilter(""); setChiefOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-ab-hover text-left"><span className="flex-1 text-ab-fg-2">Alle salgssjefer</span>{!salesChiefFilter && <Check className="h-3.5 w-3.5 text-blue-400" />}</button>
                        {chiefOptions.map(c => (
                          <button key={c.id} onClick={() => { setSalesChiefFilter(c.id); setChiefOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-ab-hover text-left">
                            <Crown className="h-3 w-3 text-amber-400/70" /><span className="flex-1 text-ab-fg-2 truncate">{c.name}</span>{salesChiefFilter === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        {/* Read-only note */}
        <div className="flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm text-ab-fg-3">
          <Info className="h-4 w-4 shrink-0 text-blue-400" />
          {anyOwned
            ? "Du kan endre medlemmer og teamledere i dine egne team. Nye team, satser og salgssjef endres i HR-systemet."
            : "Team administreres i HR-systemet."}
        </div>

        {/* Teams: City → Sales chief → Teams */}
        {loading ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelLoading label="Laster team…" /></div>
        ) : errored ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelError onRetry={() => void load()} /></div>
        ) : teams.length === 0 ? (
          <div className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl"><PanelEmpty msg="Ingen team" sub="Team opprettes i HR-systemet." /></div>
        ) : (
          <div className="space-y-8">
            {groups.map(cg => (
              <section key={cg.city} className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-400" />
                  <h2 className="text-lg font-bold text-ab-fg">{cg.city}</h2>
                  <span className="text-xs text-ab-fg-4">· {cg.teamCount} team</span>
                  <div className="ml-2 h-px flex-1 bg-ab-line" />
                </div>
                {cg.chiefs.map(g => (
                  <div key={g.key} className="sm:pl-6">
                    <div className="mb-3 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-400/70" />
                      <h3 className="text-sm font-semibold text-ab-fg-2">{g.name}</h3>
                      <span className="text-xs text-ab-fg-4">· {g.teams.length} team</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {g.teams.map((t, i) => renderTeamCard(t, i))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      <TeamDetailSheet team={detail} onClose={() => setDetail(null)} onChanged={afterChange} />
    </div>
  )
}

// ─── Detail sheet ────────────────────────────────────────────────────────────
// Read-only for everyone, plus structure controls when HR says `can_restructure`
// (the team's own sales chief, or an admin). Every change is confirmed first.

type Pending =
  | { kind: "remove"; member: TeamMember }
  | { kind: "move"; member: TeamMember; to: TeamListItem }
  | { kind: "add"; person: AssignablePerson }
  | { kind: "lead"; field: "leader_id" | "co_leader_id"; person: { id: string; name: string } | null }

type Picker =
  | { kind: "move"; member: TeamMember }
  | { kind: "add" }
  | { kind: "lead"; field: "leader_id" | "co_leader_id" }

const ROLE_LABEL = { leader_id: "teamleder", co_leader_id: "nestleder" } as const

function TeamDetailSheet({ team, onClose, onChanged }: { team: TeamDetail | null; onClose: () => void; onChanged: (teamId: string) => Promise<void> }) {
  const { toast } = useToast()
  const members = useMemo(
    () => (team?.members ?? []).slice().sort((a, b) => (a.name || "￿").localeCompare(b.name || "￿", "nb", { numeric: true })),
    [team],
  )
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [picker, setPicker] = useState<Picker | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setMenuFor(null); setPicker(null); setPending(null) }, [team?.id])

  const canEdit = !!team?.can_restructure
  const leadIds = new Set([team?.owner?.id, team?.co_leader?.id].filter(Boolean) as string[])

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ab-line bg-ab-elevated px-3 py-2">
      <span className="text-xs text-ab-fg-4">{label}</span>
      <span className="text-sm font-medium text-ab-fg truncate">{value}</span>
    </div>
  )

  const LeadField = ({ field, label, person }: { field: "leader_id" | "co_leader_id"; label: string; person: { id: string; name: string } | null | undefined }) => (
    <div className="rounded-xl border border-ab-line bg-ab-elevated px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ab-fg-4">{label}</span>
        <span className="text-sm font-medium text-ab-fg truncate">{person?.name || `Ingen ${ROLE_LABEL[field]}`}</span>
      </div>
      {canEdit && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button onClick={() => setPicker({ kind: "lead", field })} className="cursor-pointer rounded-lg border border-ab-line px-2.5 py-1 text-xs font-medium text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg">
            {person ? `Endre ${ROLE_LABEL[field]}` : `Velg ${ROLE_LABEL[field]}`}
          </button>
          {person && (
            <button onClick={() => setPending({ kind: "lead", field, person: null })} className="cursor-pointer rounded-lg border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10">
              Fjern {ROLE_LABEL[field]}
            </button>
          )}
        </div>
      )}
    </div>
  )

  const confirmText = (p: Pending): { title: string; body: string; cta: string; danger?: boolean } => {
    const t = team?.name ?? ""
    switch (p.kind) {
      case "remove": return { title: "Fjern fra team?", body: `${p.member.name || "Personen"} fjernes fra ${t}. Personen er da ikke lenger med i teamet.`, cta: "Fjern fra team", danger: true }
      case "move": return { title: "Flytt til team?", body: `${p.member.name || "Personen"} flyttes fra ${t} til ${p.to.name}.`, cta: "Flytt" }
      case "add": return { title: "Legg til medlem?", body: `${p.person.name} legges til i ${t}.`, cta: "Legg til" }
      case "lead": return p.person
        ? { title: `Endre ${ROLE_LABEL[p.field]}?`, body: `${p.person.name} blir ${ROLE_LABEL[p.field]} for ${t}.`, cta: "Lagre" }
        : { title: `Fjern ${ROLE_LABEL[p.field]}?`, body: `${t} får ingen ${ROLE_LABEL[p.field]}. Personen blir værende i teamet som medlem.`, cta: `Fjern ${ROLE_LABEL[p.field]}`, danger: true }
    }
  }

  const run = async () => {
    if (!team || !pending) return
    setBusy(true)
    try {
      if (pending.kind === "remove") await removeTeamMember(team.id, pending.member.id)
      else if (pending.kind === "move") await moveTeamMember(team.id, pending.member.id, pending.to.id)
      else if (pending.kind === "add") await addTeamMember(team.id, pending.person.id, pending.person.type)
      else await setTeamLeaders(team.id, { [pending.field]: pending.person?.id ?? null })
      toast({ title: "Lagret" })
      setPending(null)
      await onChanged(team.id)
    } catch (e) {
      toast({ title: "Kunne ikke lagre", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally { setBusy(false) }
  }

  return (
    <AnimatePresence>
      {team && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] bg-ab-overlay border-l border-ab-line overflow-y-auto">
            {/* Header */}
            <div className="relative p-6 border-b border-ab-line">
              <button onClick={onClose} aria-label="Lukk" className="cursor-pointer absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover"><X className="h-4 w-4" /></button>
              <div className="flex items-center gap-3 pr-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ab-hover border border-ab-line"><Users className="h-5 w-5 text-ab-fg-3" /></div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-ab-fg truncate">{team.name}</h2>
                  <p className="text-xs text-ab-fg-3">{team.city || NO_CITY} · {team.member_count} medlem{team.member_count === 1 ? "" : "mer"}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Field label="Kampanje" value={team.campaign?.name || "Ingen kampanje"} />
                <Field label="Salgssjef" value={team.sales_chief?.name || NO_CHIEF} />
                <LeadField field="leader_id" label="Teamleder" person={team.owner} />
                <LeadField field="co_leader_id" label="Nestleder" person={team.co_leader} />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ab-fg-3">Medlemmer ({members.length})</p>
                  {canEdit && (
                    <button onClick={() => setPicker({ kind: "add" })} className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-ab-line px-2.5 py-1 text-xs font-medium text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg">
                      <UserPlus className="h-3.5 w-3.5" /> Legg til medlem
                    </button>
                  )}
                </div>
                {members.length === 0 ? <p className="text-sm text-ab-fg-4">Ingen medlemmer.</p> : (
                  <div className="space-y-2">
                    {members.map(m => {
                      const isLead = leadIds.has(m.id)
                      return (
                        <div key={m.id} className="relative flex items-center gap-3 rounded-xl border border-ab-line bg-ab-elevated px-3 py-2">
                          <p className="min-w-0 flex-1 text-sm font-medium text-ab-fg truncate">{m.name || "Ukjent person"}</p>
                          {m.id === team.owner?.id ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Teamleder</span>
                            : m.id === team.co_leader?.id ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300/80">Nestleder</span>
                            : m.person_type === "manager" && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">Leder</span>}
                          {canEdit && (
                            <button aria-label={`Handlinger for ${m.name}`} onClick={() => setMenuFor(f => (f === m.id ? null : m.id))}
                              className="cursor-pointer h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-ab-fg-3 hover:bg-ab-hover hover:text-ab-fg">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                          {menuFor === m.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                              <div className="absolute right-2 top-full mt-1 z-20 w-56 rounded-xl border border-ab-line bg-ab-overlay shadow-2xl py-1">
                                <button disabled={isLead} onClick={() => { setMenuFor(null); setPicker({ kind: "move", member: m }) }}
                                  className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-ab-fg-2 hover:bg-ab-hover disabled:cursor-not-allowed disabled:opacity-50">
                                  <ArrowRightLeft className="h-3.5 w-3.5" /> Flytt til team
                                </button>
                                <button disabled={isLead} onClick={() => { setMenuFor(null); setPending({ kind: "remove", member: m }) }}
                                  className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                                  <UserMinus className="h-3.5 w-3.5" /> Fjern fra team
                                </button>
                                {isLead && <p className="px-3 pb-2 pt-1 text-[11px] text-ab-fg-4">Bytt eller fjern teamleder/nestleder først.</p>}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <p className="text-xs text-ab-fg-4">
                {canEdit ? "Nye team, satser og salgssjef endres i HR-systemet." : "Endringer i team gjøres i HR-systemet."}
              </p>
            </div>
          </motion.div>

          {picker && (
            <PickerModal team={team} members={members} picker={picker} onClose={() => setPicker(null)}
              onPick={p => { setPicker(null); setPending(p) }} />
          )}
          {pending && (() => {
            const c = confirmText(pending)
            return (
              <Modal title={c.title} onClose={() => !busy && setPending(null)}>
                <p className="text-sm text-ab-fg-2">{c.body}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button disabled={busy} onClick={() => setPending(null)} className="cursor-pointer rounded-lg border border-ab-line px-3.5 py-2 text-sm font-medium text-ab-fg-2 hover:bg-ab-hover">Avbryt</button>
                  <button disabled={busy} onClick={() => void run()}
                    className={cn("cursor-pointer flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60", c.danger ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500")}>
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{c.cta}
                  </button>
                </div>
              </Modal>
            )
          })()}
        </>
      )}
    </AnimatePresence>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[420px] max-h-[85vh] overflow-y-auto rounded-2xl border border-ab-line bg-ab-overlay p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-ab-fg">{title}</h3>
          <button onClick={onClose} aria-label="Lukk" className="cursor-pointer h-7 w-7 -mr-1 -mt-1 flex items-center justify-center rounded-lg text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Choose a target team (move), a new member (add) or a manager (leader / co-leader). */
function PickerModal({ team, members, picker, onClose, onPick }: {
  team: TeamDetail; members: TeamMember[]; picker: Picker; onClose: () => void; onPick: (p: Pending) => void
}) {
  const [q, setQ] = useState("")
  const [people, setPeople] = useState<AssignablePerson[] | null>(null)
  const [targets, setTargets] = useState<TeamListItem[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (picker.kind !== "move") return
    listTeams({ pageSize: 200 })
      .then(r => setTargets(r.results.filter(t => t.can_restructure && t.id !== team.id)
        .sort((a, b) => a.name.localeCompare(b.name, "nb", { numeric: true }))))
      .catch(() => setErr(true))
  }, [picker.kind, team.id])

  useEffect(() => {
    if (picker.kind === "move") return
    const t = setTimeout(() => {
      fetchAssignablePeople(team.id, q.trim() || undefined).then(setPeople).catch(() => setErr(true))
    }, 250)
    return () => clearTimeout(t)
  }, [picker.kind, team.id, q])

  const title = picker.kind === "move" ? `Flytt ${picker.member.name || "person"} til team`
    : picker.kind === "add" ? "Legg til medlem" : `Velg ${ROLE_LABEL[picker.field]}`

  // Leader candidates: managers only (as in HR) — current managers in the team first.
  const leadRows = picker.kind === "lead"
    ? [
        ...members.filter(m => m.person_type === "manager" && (!q || m.name.toLowerCase().includes(q.toLowerCase())))
          .map(m => ({ id: m.id, name: m.name, sub: "Medlem av teamet" })),
        ...(people ?? []).filter(p => p.type === "manager")
          .map(p => ({ id: p.id, name: p.name, sub: p.teams.length ? p.teams.map(t => t.name).join(", ") : "Ikke i noe team" })),
      ].filter(r => r.id !== team.owner?.id && r.id !== team.co_leader?.id)   // same person can't hold both
    : []

  const Row = ({ name, sub, disabled, hint, onClick }: { name: string; sub?: string; disabled?: boolean; hint?: string; onClick: () => void }) => (
    <button disabled={disabled} onClick={onClick}
      className="cursor-pointer w-full rounded-xl border border-ab-line bg-ab-elevated px-3 py-2 text-left hover:bg-ab-hover disabled:cursor-not-allowed disabled:opacity-55">
      <p className="text-sm font-medium text-ab-fg truncate">{name || "Ukjent person"}</p>
      {(hint || sub) && <p className={cn("text-[11px] truncate", hint ? "text-amber-300/90" : "text-ab-fg-4")}>{hint || sub}</p>}
    </button>
  )

  return (
    <Modal title={title} onClose={onClose}>
      {picker.kind !== "move" && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-4" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Søk navn…" className="h-10 w-full rounded-xl border border-ab-line bg-ab-elevated pl-8 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" />
        </div>
      )}
      {err ? <p className="text-sm text-red-400">Kunne ikke laste listen.</p> : (
        <div className="space-y-2">
          {picker.kind === "move" && (targets === null ? <PanelLoading label="Laster team…" /> : (
            <>
              {targets.length === 0 && <p className="text-sm text-ab-fg-4">Du har ingen andre team å flytte til.</p>}
              {targets.map(t => <Row key={t.id} name={t.name} sub={`${t.city || NO_CITY} · ${t.member_count} medlemmer`} onClick={() => onPick({ kind: "move", member: picker.member, to: t })} />)}
              <p className="pt-1 text-[11px] text-ab-fg-4">Skal personen til et team du ikke styrer? Kontakt HR/admin.</p>
            </>
          ))}
          {picker.kind === "add" && (people === null ? <PanelLoading label="Laster personer…" /> : (
            people.length === 0 ? <p className="text-sm text-ab-fg-4">Ingen treff.</p> :
              people.slice(0, 60).map(p => {
                const foreign = p.teams.find(t => !t.owned)
                const own = p.teams.find(t => t.owned)
                const hint = foreign ? `Med i ${foreign.name} – kontakt HR/admin`
                  : own ? `I ${own.name} – bruk «Flytt til team» der` : undefined
                return <Row key={p.id} name={p.name} sub={p.type === "manager" ? "Leder" : "Selger"} hint={hint} disabled={!!hint}
                  onClick={() => onPick({ kind: "add", person: p })} />
              })
          ))}
          {picker.kind === "lead" && (people === null ? <PanelLoading label="Laster ledere…" /> : (
            leadRows.length === 0 ? <p className="text-sm text-ab-fg-4">Ingen ledere funnet. Bare ledere (lederkonto) kan være {ROLE_LABEL[picker.field]}.</p> :
              leadRows.slice(0, 60).map(r => <Row key={r.id} name={r.name} sub={r.sub} onClick={() => onPick({ kind: "lead", field: picker.field, person: { id: r.id, name: r.name } })} />)
          ))}
        </div>
      )}
    </Modal>
  )
}

export default TeamsView
