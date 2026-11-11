"use client"

/**
 * Team detail sheet (M-TEAM, kunden 11.11): read-only team view plus the sales chief's
 * structure controls on their OWN teams (members, «Flytt til team», leader /
 * co-leader). Opened from Salgsorganisasjon (S-ORG). HR is the writer and says per
 * team in `can_restructure` whether the caller may; the buttons only show then.
 */

import React, { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, X, MoreVertical, ArrowRightLeft, UserMinus, UserPlus, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  listTeams, fetchAssignablePeople, addTeamMember, removeTeamMember,
  moveTeamMember, setTeamLeaders, type TeamListItem, type TeamDetail, type TeamMember, type AssignablePerson,
} from "@/lib/api/teams"
import { PanelLoading } from "./_states"

const NO_CITY = "Uten by"
const NO_CHIEF = "Uten salgssjef"

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

export function TeamDetailSheet({ team, onClose, onChanged }: { team: TeamDetail | null; onClose: () => void; onChanged: (teamId: string) => Promise<void> }) {
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
          .map(m => ({ id: m.id, name: m.name, sub: "Medlem av teamet", hint: undefined as string | undefined })),
        ...(people ?? []).filter(p => p.type === "manager")
          .map(p => {
            const foreign = p.teams.find(t => !t.owned)
            return { id: p.id, name: p.name, sub: p.teams.length ? p.teams.map(t => t.name).join(", ") : "Ikke i noe team",
              hint: foreign ? `Med i ${foreign.name} – kontakt HR/admin` : undefined }
          }),
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
              leadRows.slice(0, 60).map(r => <Row key={r.id} name={r.name} sub={r.sub} hint={r.hint} disabled={!!r.hint} onClick={() => onPick({ kind: "lead", field: picker.field, person: { id: r.id, name: r.name } })} />)
          ))}
        </div>
      )}
    </Modal>
  )
}

