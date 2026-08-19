"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Repeat, Check, Ban } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { listTeams, getTeam, type TeamListItem, type TeamMember } from "@/lib/api/teams"
import {
  listShifts, createShift, deleteShift,
  listSwapRequests, requestSwap, reviewSwap,
  type Shift, type SwapRequest,
} from "@/lib/api/scheduling"

/**
 * Promoter scheduling calendar (Aug-2026 meeting). Month grid of whole-day shifts.
 * Chiefs / team leaders (teams they manage) assign promoters to days; promoters see their
 * own + team schedule read-only and can propose trading a shift with a teammate (accept/reject).
 * Clones the TodoCalendar grid; backed by the maps `scheduling` app.
 */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function ShiftCalendar() {
  const { user } = useAuth()
  const user_id = user?.user_id
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [teams, setTeams] = useState<TeamListItem[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>("")
  const [members, setMembers] = useState<TeamMember[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [addDay, setAddDay] = useState<string | null>(null)
  const [swapFor, setSwapFor] = useState<Shift | null>(null)
  const [err, setErr] = useState<string>("")

  const isEditor = teams.length > 0
  const monthRange = useMemo(() => {
    const from = new Date(cursor.y, cursor.m, 1)
    const to = new Date(cursor.y, cursor.m + 1, 0)
    return { date_from: ymd(from), date_to: ymd(to) }
  }, [cursor])

  // Load manageable teams once.
  useEffect(() => {
    let alive = true
    listTeams({}).then((r) => { if (alive) setTeams(r.results || []) }).catch(() => { if (alive) setTeams([]) })
    return () => { alive = false }
  }, [])

  // Load the selected team's roster (editor add-picker).
  useEffect(() => {
    if (!selectedTeam) { setMembers([]); return }
    let alive = true
    getTeam(selectedTeam).then((t) => { if (alive) setMembers(t.members || []) }).catch(() => { if (alive) setMembers([]) })
    return () => { alive = false }
  }, [selectedTeam])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [sh, sw] = await Promise.all([
        listShifts({ ...monthRange, team_id: selectedTeam || undefined }),
        listSwapRequests(),
      ])
      setShifts(sh); setSwaps(sw)
    } catch { setShifts([]); setSwaps([]) } finally { setLoading(false) }
  }, [monthRange, selectedTeam])

  useEffect(() => { reload() }, [reload])

  const byDay = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const s of shifts) (map[s.date] ||= []).push(s)
    return map
  }, [shifts])

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startDow = (first.getDay() + 6) % 7
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const arr: Array<Date | null> = []
    for (let i = 0; i < startDow; i++) arr.push(null)
    for (let d = 1; d <= days; d++) arr.push(new Date(cursor.y, cursor.m, d))
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [cursor])

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("nb-NO", { month: "long", year: "numeric" })
  const todayStr = ymd(new Date())
  const dow = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"]

  async function addShift(memberId: string) {
    if (!addDay || !selectedTeam) return
    const m = members.find((x) => x.id === memberId)
    if (!m) return
    setBusy(true); setErr("")
    try {
      await createShift({
        team_id: selectedTeam, date: addDay,
        ...(m.person_type === "employee" ? { employee_id: m.id } : { manager_id: m.id }),
      })
      setAddDay(null); await reload()
    } catch (e: any) { setErr("Kunne ikke legge til vakt (kanskje allerede planlagt).") } finally { setBusy(false) }
  }

  async function removeShift(s: Shift) {
    setBusy(true); setErr("")
    try { await deleteShift(s.id); await reload() } catch { setErr("Kunne ikke slette vakten.") } finally { setBusy(false) }
  }

  // Swap: candidate teammate shifts = same team, different day, not mine.
  const swapCandidates = useMemo(() => {
    if (!swapFor) return []
    return shifts.filter((s) => s.team_id === swapFor.team_id && s.date !== swapFor.date && !s.mine && s.person?.resolved)
  }, [swapFor, shifts])

  async function proposeSwap(toShift: Shift) {
    if (!swapFor) return
    setBusy(true); setErr("")
    try { await requestSwap({ from_shift: swapFor.id, to_shift: toShift.id }); setSwapFor(null); await reload() }
    catch (e: any) { setErr("Kunne ikke sende byttet.") } finally { setBusy(false) }
  }

  async function review(s: SwapRequest, action: "accept" | "decline" | "cancel") {
    setBusy(true); setErr("")
    try { await reviewSwap(s.id, action); await reload() } catch { setErr("Handlingen mislyktes.") } finally { setBusy(false) }
  }

  const incoming = swaps.filter((s) => String(s.target_id) === String(user_id) && s.status === "pending")
  const outgoing = swaps.filter((s) => String(s.requested_by_id) === String(user_id))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ab-line bg-ab-elevated/40 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-instrument text-xl text-ab-fg capitalize">Vaktplan · {monthLabel}</h3>
          <div className="flex items-center gap-2">
            {isEditor && (
              <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
                className="h-8 rounded-lg border border-ab-line bg-ab-elevated px-2 text-sm text-ab-fg">
                <option value="">Alle mine team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button className="rounded-lg p-1.5 text-ab-fg-3 hover:bg-white/[0.06]" aria-label="Forrige"
              onClick={() => setCursor((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m } })}><ChevronLeft className="h-4 w-4" /></button>
            <button className="rounded-lg p-1.5 text-ab-fg-3 hover:bg-white/[0.06]" aria-label="Neste"
              onClick={() => setCursor((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m } })}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {err && <div className="mb-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">{err}</div>}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ab-fg-3" /></div>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-mono uppercase tracking-wider text-ab-fg-4">
              {dow.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, i) => {
                if (!date) return <div key={i} className="min-h-[76px] rounded-lg" />
                const ds = ymd(date)
                const items = byDay[ds] || []
                const isToday = ds === todayStr
                return (
                  <div key={i} className={`min-h-[76px] rounded-lg border p-1 ${isToday ? "border-aurora-amber/50 bg-aurora-amber/[0.05]" : "border-ab-line-1 bg-white/[0.02]"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-mono ${isToday ? "text-aurora-amber" : "text-ab-fg-3"}`}>{date.getDate()}</span>
                      {isEditor && selectedTeam && (
                        <button className="text-ab-fg-4 hover:text-aurora-amber" aria-label="Legg til vakt" onClick={() => setAddDay(ds)}><Plus className="h-3 w-3" /></button>
                      )}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {items.slice(0, 4).map((s) => (
                        <div key={s.id} className={`group flex items-center gap-1 rounded px-1 py-0.5 text-[10px] ${s.mine ? "bg-aurora-amber/15 text-aurora-amber" : "bg-white/[0.04] text-ab-fg-2"}`}>
                          <span className="flex-1 truncate">{s.person?.name || "—"}</span>
                          {s.mine && (
                            <button onClick={() => setSwapFor(s)} title="Be om bytte" className="shrink-0 opacity-70 hover:opacity-100"><Repeat className="h-3 w-3" /></button>
                          )}
                          {isEditor && (
                            <button onClick={() => removeShift(s)} title="Slett" className="shrink-0 text-ab-fg-4 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                          )}
                        </div>
                      ))}
                      {items.length > 4 && <div className="text-[9px] text-ab-fg-4">+{items.length - 4}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Add-shift picker */}
        {addDay && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ab-line bg-white/[0.02] px-3 py-2">
            <span className="text-[11px] text-ab-fg-3">{addDay} — legg til promotør:</span>
            <select disabled={busy} onChange={(e) => e.target.value && addShift(e.target.value)} defaultValue=""
              className="h-8 rounded-lg border border-ab-line bg-ab-elevated px-2 text-sm text-ab-fg">
              <option value="" disabled>Velg person…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={() => setAddDay(null)} className="text-xs text-ab-fg-4 hover:text-ab-fg">Avbryt</button>
          </div>
        )}
      </div>

      {/* Swap requests inbox */}
      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="rounded-2xl border border-ab-line bg-ab-elevated/40 p-4 sm:p-5">
          <h3 className="mb-3 font-instrument text-lg text-ab-fg">Vaktbytter</h3>
          {incoming.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[11px] font-mono uppercase tracking-wider text-ab-fg-4">Til godkjenning</div>
              <div className="space-y-1.5">
                {incoming.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ab-line bg-white/[0.02] px-3 py-2 text-sm">
                    <span className="text-ab-fg-2">
                      {s.from_shift_detail?.person?.name} vil bytte <b>{s.from_shift_detail?.date}</b> mot din <b>{s.to_shift_detail?.date}</b>
                    </span>
                    <div className="flex gap-2">
                      <button disabled={busy} onClick={() => review(s, "accept")} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"><Check className="h-3 w-3" /> Godta</button>
                      <button disabled={busy} onClick={() => review(s, "decline")} className="flex items-center gap-1 rounded-lg border border-ab-line px-2.5 py-1 text-xs text-ab-fg-2 hover:bg-white/[0.06]"><Ban className="h-3 w-3" /> Avslå</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {outgoing.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-mono uppercase tracking-wider text-ab-fg-4">Mine forespørsler</div>
              <div className="space-y-1.5">
                {outgoing.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ab-line bg-white/[0.02] px-3 py-2 text-sm">
                    <span className="text-ab-fg-2">Bytt <b>{s.from_shift_detail?.date}</b> mot {s.to_shift_detail?.person?.name} <b>{s.to_shift_detail?.date}</b></span>
                    <div className="flex items-center gap-2">
                      <StatusPill status={s.status} />
                      {s.status === "pending" && <button disabled={busy} onClick={() => review(s, "cancel")} className="rounded-lg border border-ab-line px-2.5 py-1 text-xs text-ab-fg-2 hover:bg-white/[0.06]">Avbryt</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Swap picker modal */}
      {swapFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setSwapFor(null)}>
          <div className="w-full max-w-md rounded-2xl border border-ab-line bg-ab-overlay p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-ab-fg">Be om vaktbytte</h3>
            <p className="mb-3 text-sm text-ab-fg-3">Din vakt <b>{swapFor.date}</b> — velg en lagkameratsvakt å bytte med:</p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {swapCandidates.length === 0 && <div className="text-sm text-ab-fg-4">Ingen tilgjengelige vakter å bytte med.</div>}
              {swapCandidates.map((c) => (
                <button key={c.id} disabled={busy} onClick={() => proposeSwap(c)}
                  className="flex w-full items-center justify-between rounded-lg border border-ab-line bg-white/[0.02] px-3 py-2 text-left text-sm text-ab-fg-2 hover:border-aurora-amber/50">
                  <span>{c.person?.name}</span><span className="font-mono text-xs text-ab-fg-4">{c.date}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => setSwapFor(null)} className="rounded-xl border border-ab-line px-4 py-2 text-sm text-ab-fg-2 hover:bg-white/[0.06]">Lukk</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300", accepted: "bg-emerald-500/15 text-emerald-300",
    declined: "bg-rose-500/15 text-rose-300", cancelled: "bg-white/[0.06] text-ab-fg-4",
  }
  const label: Record<string, string> = { pending: "Venter", accepted: "Godtatt", declined: "Avslått", cancelled: "Avbrutt" }
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status] || map.cancelled}`}>{label[status] || status}</span>
}
