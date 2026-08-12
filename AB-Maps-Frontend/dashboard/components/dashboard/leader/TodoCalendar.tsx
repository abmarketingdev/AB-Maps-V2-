"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, Check, Loader2 } from "lucide-react"
import { useLang } from "@/lib/i18n"
import { fetchTodos, createTodo, completeTodo, deleteTodo } from "@/services/todoService"
import type { Todo } from "@/types/todo"

/**
 * Personal, calendar-based to-do (2026-08-12). Month grid of the logged-in
 * user's own todos, bucketed by `deadline`. Click a day's + to add; the check
 * completes; × deletes. Reuses the maps `todos` backend (perspective=mine by
 * default). Frontend-only — no new endpoints.
 */

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function TodoCalendar() {
  const { t, lang } = useLang()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [addDay, setAddDay] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchTodos()
      .then((res: any) => {
        if (!alive) return
        const list: Todo[] = Array.isArray(res) ? res : (res?.results ?? [])
        setTodos(list)
        setLoading(false)
      })
      .catch(() => { if (alive) { setTodos([]); setLoading(false) } })
    return () => { alive = false }
  }, [tick])

  const byDay = useMemo(() => {
    const map: Record<string, Todo[]> = {}
    for (const td of todos) {
      const d = td.deadline ? td.deadline.slice(0, 10) : null
      if (d) (map[d] ||= []).push(td)
    }
    return map
  }, [todos])

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startDow = (first.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const arr: Array<Date | null> = []
    for (let i = 0; i < startDow; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cursor.y, cursor.m, d))
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [cursor])

  const monthLabel = new Date(cursor.y, cursor.m, 1)
    .toLocaleDateString(lang === "no" ? "nb-NO" : "en-GB", { month: "long", year: "numeric" })
  const todayStr = ymd(new Date())
  const dow = lang === "no"
    ? ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  async function addTodo() {
    if (!addDay || !addTitle.trim()) return
    setBusy(true)
    try {
      await createTodo({ title: addTitle.trim(), deadline: `${addDay}T12:00:00`, priority: "medium" })
      setAddTitle(""); setAddDay(null); setTick((n) => n + 1)
    } catch { /* surfaced by absence of the new item */ } finally { setBusy(false) }
  }
  async function toggle(td: Todo) {
    if (td.status === "completed") return
    setBusy(true)
    try { await completeTodo(td.id); setTick((n) => n + 1) } catch { /* no-op */ } finally { setBusy(false) }
  }
  async function remove(td: Todo) {
    setBusy(true)
    try { await deleteTodo(td.id); setTick((n) => n + 1) } catch { /* no-op */ } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-ab-line bg-ab-elevated/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-instrument text-xl text-ab-fg capitalize">{t("Min to-do")} · {monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1.5 text-ab-fg-3 hover:bg-white/[0.06]" aria-label={t("Forrige")}
            onClick={() => setCursor((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m } })}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-1.5 text-ab-fg-3 hover:bg-white/[0.06]" aria-label={t("Neste")}
            onClick={() => setCursor((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m } })}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ab-fg-3" /></div>
      ) : (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-mono uppercase tracking-wider text-ab-fg-4">
            {dow.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} className="min-h-[64px] rounded-lg" />
              const ds = ymd(date)
              const items = byDay[ds] || []
              const isToday = ds === todayStr
              return (
                <div key={i}
                  className={`min-h-[64px] rounded-lg border p-1 ${isToday ? "border-aurora-amber/50 bg-aurora-amber/[0.05]" : "border-ab-line-1 bg-white/[0.02]"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-mono ${isToday ? "text-aurora-amber" : "text-ab-fg-3"}`}>{date.getDate()}</span>
                    <button className="text-ab-fg-4 hover:text-aurora-amber" aria-label={t("Legg til")}
                      onClick={() => { setAddDay(ds); setAddTitle("") }}>
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {items.slice(0, 3).map((td) => (
                      <div key={td.id}
                        className={`group flex items-center gap-1 rounded bg-white/[0.03] px-1 py-0.5 text-[10px] ${td.status === "completed" ? "text-ab-fg-4 line-through" : "text-ab-fg-2"}`}>
                        <button onClick={() => toggle(td)} className="shrink-0" title={t("Fullfør")}>
                          <Check className={`h-3 w-3 ${td.status === "completed" ? "text-emerald-400" : "text-ab-fg-4 hover:text-emerald-400"}`} />
                        </button>
                        <span className="flex-1 truncate">{td.title}</span>
                        <button onClick={() => remove(td)} title={t("Slett")}
                          className="shrink-0 text-ab-fg-4 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100">×</button>
                      </div>
                    ))}
                    {items.length > 3 && <div className="text-[9px] text-ab-fg-4">+{items.length - 3}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {addDay && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-ab-line bg-white/[0.02] px-3 py-2">
          <span className="text-[11px] text-ab-fg-3">{addDay}</span>
          <input autoFocus value={addTitle} onChange={(e) => setAddTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTodo(); if (e.key === "Escape") setAddDay(null) }}
            placeholder={t("Ny oppgave…")}
            className="flex-1 bg-transparent text-sm text-ab-fg placeholder:text-ab-fg-4 focus:outline-none" />
          <button disabled={busy || !addTitle.trim()} onClick={addTodo}
            className="rounded-full bg-aurora-amber px-3 py-1 text-xs font-semibold text-black disabled:opacity-50">{t("Legg til")}</button>
          <button onClick={() => setAddDay(null)} className="text-xs text-ab-fg-4 hover:text-ab-fg">{t("Avbryt")}</button>
        </div>
      )}
    </div>
  )
}
