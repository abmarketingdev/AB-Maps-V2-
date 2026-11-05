"use client"

/**
 * Team — VIEW-ONLY team overview, read from the HR microservice (/api/hr/teams/).
 * HR is the only place teams are created or edited (2026-11-05); Maps shows them
 * grouped by City → Sales chief → Teams. Access is role-scoped server-side:
 * team-leads see only the team(s) they lead, sales-chiefs their own, admins all;
 * employees never reach this (nav-hidden + backend 403).
 * No provisjon/rates are shown here. Team goals are set elsewhere (Mål).
 */

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Users, Search, X, ChevronDown, Crown, Check, MapPin, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"
import { useAuth } from "@/lib/auth/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { listTeams, getTeam, TEAM_CITIES, type TeamListItem, type TeamDetail } from "@/lib/api/teams"
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
  const { user, isAdmin } = useAuth()
  const { campaignId: globalCampaignId } = useSelectedCampaign()
  // Only admin sees ALL teams; a sales-chief / team-lead is scoped to their own
  // team(s) by HR (no "Mine team" / chief filter for them).
  const seesAll = isAdmin
  const myId = user?.user_info?.id || user?.user_id || ""

  const [campaigns, setCampaigns] = useState<CampaignVM[]>([])
  const [campaignFilter, setCampaignFilter] = useState<string>("")
  const [campOpen, setCampOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [mineOnly, setMineOnly] = useState(false)
  // Admin-only: filter by sales chief.
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
  useEffect(() => { if (globalCampaignId) setCampaignFilter(globalCampaignId) }, [globalCampaignId])

  const load = useCallback(() => {
    setLoading(true); setErrored(false)
    return listTeams({
      campaignId: campaignFilter || undefined,
      salesChiefId: isAdmin ? (salesChiefFilter || undefined) : undefined,
      createdBy: mineOnly && seesAll ? myId : undefined,
      search: search || undefined,
      pageSize: 200,
    })
      .then(res => {
        setTeams(res.results)
        // Populate the sales-chief filter from the full (chief-unfiltered) set so
        // picking one chief doesn't shrink the dropdown.
        if (isAdmin && !salesChiefFilter) {
          const seen = new Map<string, string>()
          res.results.forEach(t => { if (t.sales_chief) seen.set(t.sales_chief.id, t.sales_chief.name) })
          setChiefOptions([...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "nb", { numeric: true })))
        }
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [campaignFilter, salesChiefFilter, mineOnly, seesAll, isAdmin, myId, search])
  useEffect(() => { const t = setTimeout(() => { void load() }, 250); return () => clearTimeout(t) }, [load])

  const openDetail = async (id: string) => {
    try { setDetail(await getTeam(id)) }
    catch { toast({ title: "Kunne ikke åpne team", variant: "destructive" }) }
  }

  const campaignName = (id: string | undefined) => campaigns.find(c => c.id === id)?.name ?? "Kampanje"
  const chiefName = (id: string) => chiefOptions.find(c => c.id === id)?.name ?? "Salgssjef"

  const groups = useMemo(() => groupTeams(teams), [teams])

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
            {/* Sales-chief filter (admin only) */}
            {isAdmin && chiefOptions.length > 0 && (
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
            {seesAll && (
              <button onClick={() => setMineOnly(m => !m)} className={cn("cursor-pointer rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all", mineOnly ? "border-blue-500/40 bg-blue-600/15 text-blue-200" : "border-ab-line bg-ab-elevated text-ab-fg-2 hover:text-ab-fg")}>
                Mine team
              </button>
            )}
          </div>
        </motion.div>

        {/* Read-only note */}
        <div className="flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm text-ab-fg-3">
          <Info className="h-4 w-4 shrink-0 text-blue-400" />
          Team administreres i HR-systemet.
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

      <TeamDetailSheet team={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

// ─── Detail sheet (read-only: names only) ────────────────────────────────────
function TeamDetailSheet({ team, onClose }: { team: TeamDetail | null; onClose: () => void }) {
  const members = useMemo(
    () => (team?.members ?? []).slice().sort((a, b) => (a.name || "￿").localeCompare(b.name || "￿", "nb", { numeric: true })),
    [team],
  )
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ab-line bg-ab-elevated px-3 py-2">
      <span className="text-xs text-ab-fg-4">{label}</span>
      <span className="text-sm font-medium text-ab-fg truncate">{value}</span>
    </div>
  )

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
                <Field label="Teamleder" value={team.owner?.name || "Ingen teamleder"} />
                <Field label="Nestleder" value={team.co_leader?.name || "Ingen nestleder"} />
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ab-fg-3">Medlemmer ({members.length})</p>
                {members.length === 0 ? <p className="text-sm text-ab-fg-4">Ingen medlemmer.</p> : (
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 rounded-xl border border-ab-line bg-ab-elevated px-3 py-2">
                        <p className="min-w-0 flex-1 text-sm font-medium text-ab-fg truncate">{m.name || "Ukjent person"}</p>
                        {m.person_type === "manager" && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">Leder</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-ab-fg-4">Endringer i team gjøres i HR-systemet.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default TeamsView
