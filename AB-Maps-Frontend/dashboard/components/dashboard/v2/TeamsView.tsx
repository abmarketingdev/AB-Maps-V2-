"use client"

/**
 * Team (Campaign Teams) — campaign-scoped teams, wired to the HR microservice
 * (/api/hr/teams/). HR is the single writer; access is role-scoped server-side:
 * team-leads see only the team(s) they lead, sales-chiefs/admins see all,
 * employees never reach this (nav-hidden + backend 403). Team-leads & sales-chiefs
 * may add/remove members only; create/edit/delete/rates are admin-only (HR staff).
 * Glassmorphism dark, animated.
 */

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Users, Plus, Search, X, Trash2, Pencil, UserPlus, ChevronDown,
  Loader2, Crown, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"
import { useSelectedCampaign } from "@/lib/hooks/useSelectedCampaign"
import { useAuth } from "@/lib/auth/AuthContext"
import { useToast } from "@/hooks/use-toast"
import {
  listTeams, createTeam, getTeam, updateTeam, deleteTeam,
  addTeamMember, removeTeamMember, fetchAssignableMembers, TeamMemberError,
  type TeamListItem, type TeamDetail, type TeamMember, type AssignableMember,
  type PersonType,
} from "@/lib/api/teams"
import { PanelLoading, PanelEmpty, PanelError } from "./_states"

const COLORS = ["#10b981", "#ec4899", "#f59e0b", "#06b6d4", "#3b82f6", "#8b5cf6", "#f43f5e", "#14b8a6"]
const ICONS = ["🚀", "⭐", "🔥", "💪", "🎯", "⚡", "🏆", "🦁", "🐺", "🦅", "💎", "🛡️"]
const nbFmt = new Intl.NumberFormat("nb-NO")

interface CampaignVM { id: string; name: string; color: string }

export function TeamsView() {
  const reduced = useReducedMotion()
  const { toast } = useToast()
  const { user, isAdmin } = useAuth()
  const { campaignId: globalCampaignId } = useSelectedCampaign()
  // Only admin sees ALL teams; a sales-chief / team-lead is scoped to their own
  // team(s) by HR, so they get a flat own-teams list (no "Mine team" / chief filter).
  const seesAll = isAdmin
  // Structural team CRUD + provisjon (create/edit/delete) is HR-staff/admin only.
  // Team-leads and sales-chiefs may manage members only (enforced by HR too).
  const canManageStructural = isAdmin
  const myId = user?.user_info?.id || user?.user_id || ""

  const [campaigns, setCampaigns] = useState<CampaignVM[]>([])
  const [campaignFilter, setCampaignFilter] = useState<string>("")
  const [campOpen, setCampOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [mineOnly, setMineOnly] = useState(false)
  // Admin-only: filter/group teams by sales chief.
  const [salesChiefFilter, setSalesChiefFilter] = useState<string>("")
  const [chiefOpen, setChiefOpen] = useState(false)
  const [chiefOptions, setChiefOptions] = useState<{ id: string; name: string }[]>([])

  const [teams, setTeams] = useState<TeamListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [modal, setModal] = useState<null | { kind: "create" } | { kind: "edit"; t: TeamListItem | TeamDetail }>(null)
  const [confirmDel, setConfirmDel] = useState<TeamListItem | null>(null)

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
          setChiefOptions([...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
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

  // Admin, no chief filter → group the cards by sales chief. Otherwise a flat grid.
  const groupsByChief = useMemo(() => {
    if (!(isAdmin && !salesChiefFilter)) return null
    const m = new Map<string, { name: string; teams: TeamListItem[] }>()
    for (const t of teams) {
      const key = t.sales_chief?.id ?? "__none__"
      const g = m.get(key) ?? { name: t.sales_chief?.name ?? "Uten salgssjef", teams: [] }
      g.teams.push(t); m.set(key, g)
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [teams, isAdmin, salesChiefFilter])

  const renderTeamCard = (t: TeamListItem, i: number) => (
    <motion.button key={t.id} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
      onClick={() => openDetail(t.id)}
      className="cursor-pointer text-left rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:border-white/20 hover:bg-white/[0.07] transition-all">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${t.color}22`, border: `1px solid ${t.color}55` }}>{t.icon || "👥"}</div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-white truncate">{t.name}</p>
          <p className="text-xs text-white/40 truncate">{t.campaign?.name ?? "Ingen kampanje"}</p>
        </div>
      </div>
      {t.description && <p className="mt-3 text-sm text-white/55 line-clamp-2">{t.description}</p>}
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-white/50"><Users className="h-3.5 w-3.5" /> {t.member_count} medlem{t.member_count === 1 ? "" : "mer"}</span>
        {t.owner && <span className="flex items-center gap-1.5 text-white/35"><Crown className="h-3 w-3 text-amber-400/70" /> {t.owner.name}</span>}
      </div>
    </motion.button>
  )

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1528 60%, #0a0f1e 100%)" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative px-6 py-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/30 mb-1">Lag · Kampanje-team</p>
            <h1 className="text-3xl font-bold text-white">Team</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk team…" className="h-10 w-48 rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50" />
            </div>
            {/* Campaign filter */}
            <div className="relative">
              <button onClick={() => setCampOpen(o => !o)} className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-white/70 hover:text-white transition-all">
                {campaignFilter ? campaignName(campaignFilter) : "Alle kampanjer"} <ChevronDown className="h-3.5 w-3.5 text-white/40" />
              </button>
              <AnimatePresence>
                {campOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCampOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-full mt-2 z-20 w-56 max-h-72 overflow-y-auto rounded-xl border border-white/12 bg-[#111a2e] shadow-2xl py-1">
                      <button onClick={() => { setCampaignFilter(""); setCampOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 text-left"><span className="flex-1 text-white/85">Alle kampanjer</span>{!campaignFilter && <Check className="h-3.5 w-3.5 text-blue-400" />}</button>
                      {campaigns.map(c => (
                        <button key={c.id} onClick={() => { setCampaignFilter(c.id); setCampOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 text-left">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="flex-1 text-white/85 truncate">{c.name}</span>{campaignFilter === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
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
                <button onClick={() => setChiefOpen(o => !o)} className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-white/70 hover:text-white transition-all">
                  {salesChiefFilter ? chiefName(salesChiefFilter) : "Alle salgssjefer"} <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                </button>
                <AnimatePresence>
                  {chiefOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setChiefOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-full mt-2 z-20 w-56 max-h-72 overflow-y-auto rounded-xl border border-white/12 bg-[#111a2e] shadow-2xl py-1">
                        <button onClick={() => { setSalesChiefFilter(""); setChiefOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 text-left"><span className="flex-1 text-white/85">Alle salgssjefer</span>{!salesChiefFilter && <Check className="h-3.5 w-3.5 text-blue-400" />}</button>
                        {chiefOptions.map(c => (
                          <button key={c.id} onClick={() => { setSalesChiefFilter(c.id); setChiefOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 text-left">
                            <Crown className="h-3 w-3 text-amber-400/70" /><span className="flex-1 text-white/85 truncate">{c.name}</span>{salesChiefFilter === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            {seesAll && (
              <button onClick={() => setMineOnly(m => !m)} className={cn("cursor-pointer rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all", mineOnly ? "border-blue-500/40 bg-blue-600/15 text-blue-200" : "border-white/10 bg-white/5 text-white/60 hover:text-white")}>
                Mine team
              </button>
            )}
            {canManageStructural && (
              <button onClick={() => setModal({ kind: "create" })} className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:bg-blue-500 transition-all">
                <Plus className="h-4 w-4" /> Nytt team
              </button>
            )}
          </div>
        </motion.div>

        {/* Teams grid */}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"><PanelLoading label="Laster team…" /></div>
        ) : errored ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"><PanelError onRetry={() => void load()} /></div>
        ) : teams.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"><PanelEmpty msg="Ingen team ennå" sub="Opprett et team for å komme i gang." /></div>
        ) : groupsByChief ? (
          // Admin view — grouped by sales chief.
          <div className="space-y-6">
            {groupsByChief.map(g => (
              <div key={g.name}>
                <div className="mb-3 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400/70" />
                  <h2 className="text-sm font-semibold text-white/80">{g.name}</h2>
                  <span className="text-xs text-white/35">· {g.teams.length} team</span>
                  <div className="ml-2 h-px flex-1 bg-white/10" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.teams.map((t, i) => renderTeamCard(t, i))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((t, i) => renderTeamCard(t, i))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <TeamDetailSheet
        team={detail} canManageStructural={canManageStructural}
        onClose={() => setDetail(null)}
        onChanged={() => { void load() }}
        onReload={async (id) => { try { setDetail(await getTeam(id)) } catch { /* ignore */ } }}
        onEdit={(t) => { setDetail(null); setModal({ kind: "edit", t }) }}
        onDelete={(t) => { setDetail(null); setConfirmDel(t) }}
      />

      {/* Create / edit modal */}
      <TeamModal modal={modal} campaigns={campaigns} onClose={() => setModal(null)} onSaved={() => { setModal(null); void load() }} />

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={() => setConfirmDel(null)}>
            <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#0d1528] p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-1">Slett team?</h2>
              <p className="text-sm text-white/55 mb-5">«{confirmDel.name}» slettes permanent. Medlemmene beholdes, men teamet forsvinner.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDel(null)} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8">Avbryt</button>
                <button onClick={async () => { const t = confirmDel; setConfirmDel(null); try { await deleteTeam(t.id); toast({ title: "Team slettet" }); void load() } catch (e) { toast({ title: "Sletting feilet", description: e instanceof Error ? e.message : "", variant: "destructive" }) } }}
                  className="cursor-pointer rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500">Slett</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────
function TeamDetailSheet({ team, canManageStructural, onClose, onChanged, onReload, onEdit, onDelete }: {
  team: TeamDetail | null
  canManageStructural: boolean
  onClose: () => void
  onChanged: () => void
  onReload: (id: string) => Promise<void>
  onEdit: (t: TeamDetail) => void
  onDelete: (t: TeamDetail) => void
}) {
  const { toast } = useToast()
  const [manageOpen, setManageOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const reloadAll = async (id: string) => {
    await onReload(id)
    onChanged()
  }

  const remove = async (memberId: string, personType: "employee" | "manager") => {
    if (!team) return
    setBusy(memberId)
    try { await removeTeamMember(team.id, { id: memberId, person_type: personType }); await reloadAll(team.id) }
    catch (e) { toast({ title: "Kunne ikke fjerne", description: e instanceof TeamMemberError ? e.message : "", variant: "destructive" }) }
    finally { setBusy(null) }
  }

  return (
    <AnimatePresence>
      {team && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] bg-[#0d1528] border-l border-white/10 overflow-y-auto">
            {/* Header */}
            <div className="relative p-6 border-b border-white/8">
              <button onClick={onClose} className="cursor-pointer absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8"><X className="h-4 w-4" /></button>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: `${team.color}22`, border: `1px solid ${team.color}55` }}>{team.icon || "👥"}</div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">{team.name}</h2>
                  <p className="text-xs text-white/45">{team.campaign?.name ?? "Ingen kampanje"} · {team.member_count} medlemmer</p>
                </div>
              </div>
              {team.description && <p className="mt-3 text-sm text-white/55">{team.description}</p>}
              {team.owner && <p className="mt-2 flex items-center gap-1.5 text-xs text-white/35"><Crown className="h-3 w-3 text-amber-400/70" /> Opprettet av {team.owner.name}</p>}
            </div>

            <div className="p-6 space-y-6">
              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Medlemmer ({team.members.length})</p>
                </div>
                {team.members.length === 0 ? <p className="text-sm text-white/30">Ingen medlemmer ennå.</p> : (
                  <div className="space-y-2">
                    {team.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <span className={cn("h-2 w-2 rounded-full", m.online ? "bg-emerald-500" : "bg-white/20")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/90 truncate">{m.name}</p>
                          <p className="text-[11px] text-white/35 truncate">{m.email}</p>
                        </div>
                        {m.person_type === "manager" && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">Leder</span>}
                        {team.can_edit && (
                          <button onClick={() => remove(m.id, m.person_type)} disabled={busy === m.id} className="cursor-pointer h-7 w-7 inline-flex items-center justify-center rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10">
                            {busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manage members */}
              {team.can_edit && (
                <button onClick={() => setManageOpen(true)} className="cursor-pointer flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/15 px-3.5 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-600/25 transition-all w-full justify-center">
                  <UserPlus className="h-4 w-4" /> Legg til / administrer medlemmer
                </button>
              )}
            </div>

            {team.can_edit && (
              <ManageMembersModal open={manageOpen} team={team} onClose={() => setManageOpen(false)} onChanged={() => reloadAll(team.id)} />
            )}

            {/* Actions — structural edit/delete is HR-staff/admin only */}
            {canManageStructural && (
              <div className="sticky bottom-0 flex gap-2 p-4 border-t border-white/8 bg-[#0d1528]">
                <button onClick={() => onEdit(team)} className="cursor-pointer flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 transition-all"><Pencil className="h-4 w-4" /> Rediger</button>
                <button onClick={() => onDelete(team)} className="cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Create / edit modal ──────────────────────────────────────────────────────
function TeamModal({ modal, campaigns, onClose, onSaved }: {
  modal: null | { kind: "create" } | { kind: "edit"; t: TeamListItem | TeamDetail }
  campaigns: CampaignVM[]
  onClose: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const editing = modal?.kind === "edit" ? modal.t : null
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])
  const [campaign, setCampaign] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!modal) return
    if (editing) { setName(editing.name); setDesc(editing.description || ""); setColor(editing.color || COLORS[0]); setIcon(editing.icon || ICONS[0]); setCampaign(editing.campaign?.id || "") }
    else { setName(""); setDesc(""); setColor(COLORS[Math.floor(Math.random() * COLORS.length)]); setIcon(ICONS[Math.floor(Math.random() * ICONS.length)]); setCampaign("") }
  }, [modal]) // eslint-disable-line

  if (!modal) return null
  const isCreate = modal.kind === "create"
  const valid = name.trim() && (!isCreate || campaign)

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      if (isCreate) await createTeam({ name: name.trim(), campaign_id: campaign, description: desc.trim(), color, icon })
      else if (editing) await updateTeam(editing.id, { name: name.trim(), description: desc.trim(), color, icon })
      toast({ title: isCreate ? "Team opprettet" : "Team oppdatert" })
      onSaved()
    } catch (e) {
      toast({ title: "Lagring feilet", description: e instanceof Error ? e.message : "Ukjent feil", variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      {modal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16 }} onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0d1528] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="text-lg font-bold text-white">{isCreate ? "Nytt team" : "Rediger team"}</h2>
              <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="block text-xs font-medium text-white/45 mb-1.5">Navn</label><input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Teamnavn" className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50" /></div>
              <div><label className="block text-xs font-medium text-white/45 mb-1.5">Beskrivelse</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Kort beskrivelse…" className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 resize-none" /></div>
              {isCreate && (
                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5">Kampanje</label>
                  <select value={campaign} onChange={e => setCampaign(e.target.value)} className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]">
                    <option value="" className="bg-[#0d1528]">Velg kampanje…</option>
                    {campaigns.map(c => <option key={c.id} value={c.id} className="bg-[#0d1528]">{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5">Farge</label>
                  <div className="flex flex-wrap gap-1.5">{COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={cn("cursor-pointer h-7 w-7 rounded-lg transition-transform hover:scale-110", color === c && "ring-2 ring-white/60 ring-offset-2 ring-offset-[#0d1528]")} style={{ background: c }} />)}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5">Ikon</label>
                  <div className="flex flex-wrap gap-1">{ICONS.map(ic => <button key={ic} onClick={() => setIcon(ic)} className={cn("cursor-pointer h-7 w-7 rounded-lg text-base flex items-center justify-center transition-transform hover:scale-110", icon === ic ? "bg-white/15 ring-1 ring-white/40" : "bg-white/5")}>{ic}</button>)}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
              <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8">Avbryt</button>
              <button onClick={submit} disabled={!valid || saving} className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {isCreate ? "Opprett" : "Lagre"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Manage members modal (searchable add/remove) ───────────────────────────
function ManageMembersModal({ open, team, onClose, onChanged }: {
  open: boolean; team: TeamDetail; onClose: () => void; onChanged: () => void
}) {
  const { toast } = useToast()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [available, setAvailable] = useState<AssignableMember[] | null>(null)
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(() => {
    getTeam(team.id).then(t => setMembers(t.members)).catch(() => {})
    fetchAssignableMembers(team.id).then(r => setAvailable(r.results)).catch(() => setAvailable([]))
  }, [team.id])

  useEffect(() => {
    if (!open) return
    setSearch(""); setMembers(team.members); setAvailable(null)
    refresh()
  }, [open, team.members, refresh])

  const match = (n: string, e: string) => { const q = search.trim().toLowerCase(); return !q || n.toLowerCase().includes(q) || (e ?? "").toLowerCase().includes(q) }
  const shownMembers = useMemo(() => members.filter(m => match(m.name, m.email)), [members, search])
  const shownAvail = useMemo(() => (available ?? []).filter(m => match(m.name, m.email)), [available, search])

  const add = async (m: AssignableMember) => {
    setBusy(m.id)
    try { await addTeamMember(team.id, { id: m.id, person_type: m.person_type }); refresh(); onChanged() }
    catch (e) { toast({ title: "Kunne ikke legge til", description: e instanceof TeamMemberError ? e.message : "", variant: "destructive" }) }
    finally { setBusy(null) }
  }
  const remove = async (m: TeamMember) => {
    setBusy(m.id)
    try { await removeTeamMember(team.id, { id: m.id, person_type: m.person_type }); refresh(); onChanged() }
    catch (e) { toast({ title: "Kunne ikke fjerne", description: e instanceof TeamMemberError ? e.message : "", variant: "destructive" }) }
    finally { setBusy(null) }
  }

  const Row = ({ name, email, online, personType, action }: { name: string; email: string; online: boolean; personType: PersonType; action: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className={cn("h-2 w-2 rounded-full shrink-0", online ? "bg-emerald-500" : "bg-white/20")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white/90 truncate">{name}</p>
        <p className="text-[11px] text-white/35 truncate">{email}</p>
      </div>
      {personType === "manager" && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300 shrink-0">Leder</span>}
      {action}
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-start justify-center pt-[8vh] px-4" style={{ background: "rgba(5,8,16,0.7)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16 }} onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-white/12 bg-[#0d1528] shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-lg shrink-0" style={{ background: `${team.color}22`, border: `1px solid ${team.color}55` }}>{team.icon || "👥"}</div>
                <div className="min-w-0"><h2 className="text-base font-bold text-white truncate">Medlemmer · {team.name}</h2><p className="text-[11px] text-white/40 truncate">{team.campaign?.name ?? "Ingen kampanje"}</p></div>
              </div>
              <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8 shrink-0"><X className="h-4 w-4" /></button>
            </div>

            {/* Search */}
            <div className="px-5 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)} autoFocus placeholder="Søk navn eller e-post…" className="w-full h-10 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50" />
              </div>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-hidden flex-1">
              {/* On team */}
              <div className="flex flex-col min-h-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-emerald-400" /> På teamet ({members.length})</p>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                  {shownMembers.length === 0 ? <p className="text-xs text-white/30 py-6 text-center">{members.length === 0 ? "Ingen medlemmer ennå." : "Ingen treff."}</p> : shownMembers.map(m => (
                    <Row key={m.id} name={m.name} email={m.email} online={m.online} personType={m.person_type}
                      action={<button onClick={() => remove(m)} disabled={busy === m.id} className="cursor-pointer h-7 w-7 inline-flex items-center justify-center rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 shrink-0">{busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}</button>} />
                  ))}
                </div>
              </div>
              {/* Available */}
              <div className="flex flex-col min-h-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-blue-400" /> Tilgjengelige ({available?.length ?? 0})</p>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                  {available === null ? <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div>
                    : shownAvail.length === 0 ? <p className="text-xs text-white/30 py-6 text-center">{(available?.length ?? 0) === 0 ? "Ingen tilgjengelige — alle i kampanjen er på et team." : "Ingen treff."}</p>
                    : shownAvail.map(m => (
                      <Row key={m.id} name={m.name} email={m.email} online={m.online} personType={m.person_type}
                        action={<button onClick={() => add(m)} disabled={busy === m.id} className="cursor-pointer h-7 w-7 inline-flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 shrink-0">{busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}</button>} />
                    ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-white/8 flex justify-end">
              <button onClick={onClose} className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15">Ferdig</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default TeamsView
