"use client"

/**
 * CampaignPicker — sidebar "Velg kampanje" trigger + redesigned animated modal.
 * MOCK DATA. Persists the chosen campaign (incl. color) to localStorage
 * ("ab:selectedCampaign") per user and dispatches "ab:campaign-changed" so the
 * shell can paint a subtle campaign-colored accent in the chrome.
 */

import React, { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { MapPin, ChevronDown, Search, X, Check, Users, Hash, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchCampaignsWithStats } from "@/lib/api/campaigns"

export interface PickCampaign {
  id: string; name: string; color: string; description: string
  status: "active" | "paused" | "ended"
  pctComplete: number; employees: number; daysLeft: number
}

const STORAGE_KEY = "ab:selectedCampaign"
const STATUS_LABEL: Record<PickCampaign["status"], string> = { active: "Aktiv", paused: "På pause", ended: "Avsluttet" }

export function getStoredCampaign(): PickCampaign | null {
  if (typeof window === "undefined") return null
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") } catch { return null }
}

export function CampaignPicker({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<PickCampaign | null>(null)
  const [mounted, setMounted] = useState(false)
  const [campaigns, setCampaigns] = useState<PickCampaign[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { setMounted(true); setSelected(getStoredCampaign()) }, [])
  useEffect(() => { if (open) setSearch("") }, [open])

  // Keep every CampaignPicker instance (sidebar + mobile header) in sync when one changes it.
  useEffect(() => {
    const onChange = () => setSelected(getStoredCampaign())
    window.addEventListener("ab:campaign-changed", onChange)
    return () => window.removeEventListener("ab:campaign-changed", onChange)
  }, [])

  // Lock background scroll while the modal is open (the list has its own scroll).
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Load real campaigns when the modal opens (Module 6).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetchCampaignsWithStats()
      .then((list) => {
        if (cancelled) return
        setCampaigns(list.map((c) => ({
          id: c.id, name: c.name, color: c.color, description: c.description,
          status: c.status, pctComplete: Math.round(c.pctComplete),
          employees: c.employeeIds.length, daysLeft: 0,
        })))
      })
      .catch(() => { if (!cancelled) setCampaigns([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open])

  const filtered = useMemo(() => campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())
  ), [search, campaigns])

  const choose = (c: PickCampaign) => {
    setSelected(c)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
    // also keep the app's existing keys roughly in sync
    try { localStorage.setItem("currentCampaign", JSON.stringify({ id: c.id, name: c.name, description: c.description })) } catch {}
    window.dispatchEvent(new CustomEvent("ab:campaign-changed", { detail: { id: c.id, name: c.name, color: c.color } }))
    setOpen(false)
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "group flex items-center gap-2 rounded-xl border border-ab-line px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
          "bg-ab-elevated text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg",
          className,
        )}
        style={selected ? { borderColor: `${selected.color}66`, boxShadow: `inset 0 0 0 1px ${selected.color}22, 0 0 16px -6px ${selected.color}` } : undefined}
      >
        {selected
          ? <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: selected.color, boxShadow: `0 0 8px ${selected.color}` }} />
          : <MapPin className="h-4 w-4 shrink-0 text-ab-fg-3" />}
        <span className="flex-1 truncate text-left">{selected ? selected.name : "Velg kampanje"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ab-fg-3 transition-transform group-hover:translate-y-0.5" />
      </button>

      {/* Modal (portal) */}
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              // pointer-events-auto: a modal opened while another portal (e.g. a Radix Sheet)
              // set body pointer-events:none would otherwise let taps fall through to the page.
              className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 pointer-events-auto"
              style={{ background: "rgba(5,8,16,0.7)", backdropFilter: "blur(4px)" }}
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={reduced ? false : { opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 14 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border border-ab-line bg-ab-overlay shadow-[0_32px_90px_-12px_rgba(0,0,0,0.7)] overflow-hidden"
              >
                {/* Header */}
                <div className="relative px-6 pt-5 pb-4 border-b border-ab-line">
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-30"
                    style={{ background: `linear-gradient(90deg, ${(selected?.color ?? "#3b82f6")}33, transparent 70%)` }} />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-ab-fg">Velg kampanje</h2>
                      <p className="text-sm text-ab-fg-3 mt-0.5">Fargen følger deg gjennom hele dashbordet.</p>
                    </div>
                    <button onClick={() => setOpen(false)} className="cursor-pointer h-8 w-8 flex items-center justify-center rounded-xl text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-all"><X className="h-4 w-4" /></button>
                  </div>
                  {/* Search */}
                  <div className="relative mt-4">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ab-fg-4" />
                    <input value={search} onChange={e => setSearch(e.target.value)} autoFocus placeholder="Søk kampanje…"
                      className="w-full h-11 rounded-xl border border-ab-line bg-ab-elevated pl-10 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50 transition-all" />
                  </div>
                </div>

                {/* List */}
                <div className="max-h-[52vh] overflow-y-auto p-3 space-y-2">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center"><Loader2 className="h-6 w-6 text-ab-fg-4 mb-2 animate-spin" /><p className="text-sm text-ab-fg-4">Laster kampanjer…</p></div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center"><Hash className="h-7 w-7 text-ab-fg-4 mb-2" /><p className="text-sm text-ab-fg-4">Ingen kampanjer funnet</p></div>
                  ) : filtered.map((c, i) => {
                    const isSel = selected?.id === c.id
                    return (
                      <motion.button
                        key={c.id} onClick={() => choose(c)}
                        initial={reduced ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        whileHover={reduced ? {} : { x: 2 }}
                        className={cn("group/card relative w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer overflow-hidden",
                          isSel ? "bg-ab-hover" : "border-ab-line bg-ab-elevated hover:bg-ab-hover")}
                        style={isSel ? { borderColor: `${c.color}66` } : undefined}
                      >
                        {/* left color rail */}
                        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: c.color }} />
                        <div className="flex items-center gap-3 pl-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ background: `${c.color}22` }}>
                            <Hash className="h-4 w-4" style={{ color: c.color }} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-ab-fg truncate">{c.name}</span>
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
                                style={{ background: c.status === "active" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: c.status === "active" ? "#10b981" : "#f59e0b" }}>
                                {STATUS_LABEL[c.status]}
                              </span>
                            </div>
                            <p className="text-xs text-ab-fg-3 truncate mt-0.5">{c.description}</p>
                            {/* progress + meta */}
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-ab-hover">
                                <motion.div className="h-full rounded-full" style={{ background: c.color }}
                                  initial={reduced ? false : { width: 0 }} animate={{ width: `${c.pctComplete}%` }} transition={{ delay: 0.1 + i * 0.04, duration: 0.6 }} />
                              </div>
                              <span className="text-[10px] font-mono text-ab-fg-3 shrink-0">{c.pctComplete}%</span>
                              <span className="flex items-center gap-1 text-[10px] text-ab-fg-4 shrink-0"><Users className="h-3 w-3" />{c.employees}</span>
                            </div>
                          </div>
                          {isSel && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: c.color }}>
                              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                            </motion.span>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-ab-line">
                  <p className="text-xs text-ab-fg-4 text-center">Du kan når som helst bytte kampanje fra menyen.</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export default CampaignPicker
