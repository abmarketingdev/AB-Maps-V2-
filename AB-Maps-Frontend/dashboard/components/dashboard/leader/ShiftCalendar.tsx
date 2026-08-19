"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import {
  ChevronLeft, ChevronRight, Loader2, Repeat, Check, Ban, X, Plus, Search,
  CalendarDays, Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { listTeams, getTeam, type TeamListItem, type TeamMember } from "@/lib/api/teams"
import {
  listShifts, createShift, deleteShift,
  listSwapRequests, requestSwap, reviewSwap,
  type Shift, type SwapRequest,
} from "@/lib/api/scheduling"

/**
 * Vaktplan — promoter scheduling calendar. Month grid of whole-day shifts. Chiefs/leaders click a
 * day to open a roster editor (search + click promoters to add/remove); promoters see their own +
 * team schedule and can propose trading a shift with a teammate.
 */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function initials(name?: string): string {
  const p = (name || "").trim().split(/\s+/).filter(Boolean)
  if (!p.length) return "?"
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase()
}
const AV_COLORS = ["bg-sky-500/25 text-sky-200", "bg-emerald-500/25 text-emerald-200", "bg-violet-500/25 text-violet-200",
  "bg-amber-500/25 text-amber-200", "bg-rose-500/25 text-rose-200", "bg-teal-500/25 text-teal-200", "bg-indigo-500/25 text-indigo-200"]
function avatarColor(seed?: string): string {
  const s = seed || ""; let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AV_COLORS[h % AV_COLORS.length]
}
function Avatar({ name, size = 22 }: { name?: string; size?: number }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(name)}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}>{initials(name)}</span>
  )
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
  const [dayOpen, setDayOpen] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [swapFor, setSwapFor] = useState<Shift | null>(null)
  const [err, setErr] = useState<string>("")

  const isEditor = teams.length > 0
  const monthRange = useMemo(() => ({
    date_from: ymd(new Date(cursor.y, cursor.m, 1)),
    date_to: ymd(new Date(cursor.y, cursor.m + 1, 0)),
  }), [cursor])

  useEffect(() => {
    let alive = true
    listTeams({}).then((r) => { if (alive) { const list = r.results || []; setTeams(list); if (list.length && !selectedTeam) setSelectedTeam(list[0].id) } })
      .catch(() => { if (alive) setTeams([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function addShift(m: TeamMember, day: string) {
    if (!selectedTeam) return
    setBusy(true); setErr("")
    try {
      const s = await createShift({
        team_id: selectedTeam, date: day,
        ...(m.person_type === "employee" ? { employee_id: m.id } : { manager_id: m.id }),
      })
      setShifts((prev) => [...prev, s])
    } catch { setErr("Kunne ikke legge til (kanskje allerede planlagt).") } finally { setBusy(false) }
  }
  async function removeShift(s: Shift) {
    setBusy(true); setErr("")
    try { await deleteShift(s.id); setShifts((prev) => prev.filter((x) => x.id !== s.id)) }
    catch { setErr("Kunne ikke slette vakten.") } finally { setBusy(false) }
  }

  const swapCandidates = useMemo(() => {
    if (!swapFor) return []
    return shifts.filter((s) => s.team_id === swapFor.team_id && s.date !== swapFor.date && !s.mine && s.person?.resolved)
  }, [swapFor, shifts])
  async function proposeSwap(toShift: Shift) {
    if (!swapFor) return
    setBusy(true); setErr("")
    try { await requestSwap({ from_shift: swapFor.id, to_shift: toShift.id }); setSwapFor(null); await reload() }
    catch { setErr("Kunne ikke sende byttet.") } finally { setBusy(false) }
  }
  async function review(s: SwapRequest, action: "accept" | "decline" | "cancel") {
    setBusy(true); setErr("")
    try { await reviewSwap(s.id, action); await reload() } catch { setErr("Handlingen mislyktes.") } finally { setBusy(false) }
  }

  const incoming = swaps.filter((s) => String(s.target_id) === String(user_id) && s.status === "pending")
  const outgoing = swaps.filter((s) => String(s.requested_by_id) === String(user_id))

  // ── day editor data ──
  const dayShifts = dayOpen ? (byDay[dayOpen] || []) : []
  const scheduledIds = new Set(dayShifts.map((s) => s.person?.id))
  const roster = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members
      .filter((m) => !scheduledIds.has(m.id))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.ab_person_id || "").includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, search, dayOpen, shifts])
  const dayLabel = dayOpen ? new Date(dayOpen + "T12:00:00").toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" }) : ""

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ab-line bg-ab-elevated/40 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-aurora-amber/15 text-aurora-amber"><CalendarDays className="h-4 w-4" /></span>
            <div>
              <h3 className="font-instrument text-xl leading-none text-ab-fg capitalize">{monthLabel}</h3>
              <span className="text-[11px] text-ab-fg-4">{shifts.length} vakter</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditor && (
              <div className="relative">
                <Users className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ab-fg-4" />
                <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
                  className="h-9 appearance-none rounded-xl border border-ab-line bg-ab-elevated pl-8 pr-8 text-sm text-ab-fg outline-none focus:border-aurora-amber/40">
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-ab-fg-4" />
              </div>
            )}
            <div className="flex items-center rounded-xl border border-ab-line">
              <button className="rounded-l-xl p-2 text-ab-fg-3 hover:bg-white/[0.06]" aria-label="Forrige"
                onClick={() => setCursor((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m } })}><ChevronLeft className="h-4 w-4" /></button>
              <button className="rounded-r-xl p-2 text-ab-fg-3 hover:bg-white/[0.06]" aria-label="Neste"
                onClick={() => setCursor((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m } })}><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {err && <div className="mb-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">{err}</div>}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-ab-fg-3" /></div>
        ) : (
          <>
            <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono uppercase tracking-wider text-ab-fg-4">
              {dow.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((date, i) => {
                if (!date) return <div key={i} className="min-h-[84px] rounded-xl" />
                const ds = ymd(date)
                const items = byDay[ds] || []
                const isToday = ds === todayStr
                return (
                  <button key={i} onClick={() => { setSearch(""); setDayOpen(ds) }}
                    className={`group min-h-[84px] rounded-xl border p-1.5 text-left transition-colors cursor-pointer
                      ${isToday ? "border-aurora-amber/50 bg-aurora-amber/[0.06]" : "border-ab-line-1 bg-white/[0.02]"}
                      hover:border-aurora-amber/40 hover:bg-white/[0.04]`}>
                    <div className="flex items-center justify-between">
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-mono ${isToday ? "bg-aurora-amber text-black" : "text-ab-fg-3"}`}>{date.getDate()}</span>
                      {isEditor && <Plus className="h-3.5 w-3.5 text-ab-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {items.slice(0, 5).map((s) => (
                        <span key={s.id} title={s.person?.name}
                          className={`ring-1 ${s.mine ? "ring-aurora-amber" : "ring-transparent"} rounded-full`}>
                          <Avatar name={s.person?.name} size={20} />
                        </span>
                      ))}
                      {items.length > 5 && <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-[9px] text-ab-fg-3">+{items.length - 5}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
        {!isEditor && !loading && (
          <p className="mt-3 text-center text-xs text-ab-fg-4">Du ser din egen og teamets plan. Trykk ⇄ på din egen vakt for å be om bytte.</p>
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
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ab-line bg-white/[0.02] px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-ab-fg-2"><Avatar name={s.from_shift_detail?.person?.name} />
                      {s.from_shift_detail?.person?.name} vil bytte <b>{s.from_shift_detail?.date}</b> mot din <b>{s.to_shift_detail?.date}</b></span>
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
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ab-line bg-white/[0.02] px-3 py-2 text-sm">
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

      {/* ── Day editor ── */}
      {dayOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setDayOpen(null)}>
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-ab-line bg-ab-overlay shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-ab-line px-5 py-3.5">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-ab-fg-4">Planlegg dag</div>
                <h3 className="text-lg font-bold capitalize text-ab-fg">{dayLabel}</h3>
              </div>
              <button onClick={() => setDayOpen(null)} className="rounded-lg p-1.5 text-ab-fg-4 hover:bg-white/[0.06] hover:text-ab-fg"><X className="h-4 w-4" /></button>
            </div>

            {/* Scheduled */}
            <div className="px-5 pt-4">
              <div className="mb-2 text-[11px] font-mono uppercase tracking-wider text-ab-fg-4">På vakt · {dayShifts.length}</div>
              {dayShifts.length === 0 ? (
                <p className="mb-2 text-sm text-ab-fg-4">{isEditor ? "Ingen planlagt ennå. Velg fra listen under." : "Ingen planlagt denne dagen."}</p>
              ) : (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {dayShifts.map((s) => (
                    <span key={s.id} className={`group flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-sm ${s.mine ? "border-aurora-amber/50 bg-aurora-amber/[0.08] text-aurora-amber" : "border-ab-line bg-white/[0.03] text-ab-fg-2"}`}>
                      <Avatar name={s.person?.name} size={22} />
                      <span className="truncate max-w-[140px]">{s.person?.name}</span>
                      {isEditor
                        ? <button disabled={busy} onClick={() => removeShift(s)} className="text-ab-fg-4 hover:text-rose-400" title="Fjern"><X className="h-3.5 w-3.5" /></button>
                        : s.mine && <button disabled={busy} onClick={() => { setDayOpen(null); setSwapFor(s) }} className="text-aurora-amber/80 hover:text-aurora-amber" title="Be om bytte"><Repeat className="h-3.5 w-3.5" /></button>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Roster picker (editors only) */}
            {isEditor && (
              <>
                <div className="px-5 pb-2 pt-3">
                  <div className="mb-2 text-[11px] font-mono uppercase tracking-wider text-ab-fg-4">Legg til promotør</div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ab-fg-4" />
                    <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søk promotør…"
                      className="h-9 w-full rounded-xl border border-ab-line bg-ab-elevated pl-9 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-aurora-amber/40" />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                  {members.length === 0 && <p className="px-2 py-4 text-sm text-ab-fg-4">Ingen medlemmer i dette teamet.</p>}
                  {members.length > 0 && roster.length === 0 && <p className="px-2 py-4 text-sm text-ab-fg-4">Alle er planlagt eller ingen treff.</p>}
                  <div className="space-y-0.5">
                    {roster.map((m) => (
                      <button key={m.id} disabled={busy} onClick={() => addShift(m, dayOpen)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.05] disabled:opacity-50">
                        <Avatar name={m.name} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ab-fg">{m.name}</div>
                          <div className="truncate text-[11px] text-ab-fg-4">{m.ab_person_id ? `#${m.ab_person_id}` : m.email}</div>
                        </div>
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-aurora-amber/15 text-aurora-amber"><Plus className="h-3.5 w-3.5" /></span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {!isEditor && <div className="px-5 pb-5" />}
          </div>
        </div>
      )}

      {/* ── Swap picker ── */}
      {swapFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setSwapFor(null)}>
          <div className="w-full max-w-md rounded-2xl border border-ab-line bg-ab-overlay p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-ab-fg"><Repeat className="h-4 w-4 text-aurora-amber" /> Be om vaktbytte</h3>
            <p className="mb-3 text-sm text-ab-fg-3">Din vakt <b>{swapFor.date}</b> — velg en lagkameratsvakt å bytte med:</p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {swapCandidates.length === 0 && <div className="py-4 text-sm text-ab-fg-4">Ingen tilgjengelige vakter å bytte med.</div>}
              {swapCandidates.map((c) => (
                <button key={c.id} disabled={busy} onClick={() => proposeSwap(c)}
                  className="flex w-full items-center gap-3 rounded-xl border border-ab-line bg-white/[0.02] px-3 py-2 text-left hover:border-aurora-amber/50">
                  <Avatar name={c.person?.name} size={28} />
                  <span className="flex-1 text-sm text-ab-fg-2">{c.person?.name}</span>
                  <span className="font-mono text-xs text-ab-fg-4">{c.date}</span>
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
