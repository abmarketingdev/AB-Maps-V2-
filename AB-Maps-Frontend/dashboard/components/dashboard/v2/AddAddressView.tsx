"use client"

/**
 * Legg til adresse — redesign. Wired to the live backend:
 *  - Campaigns:  fetchAllCampaigns()
 *  - Address list: fetchUploadedAddresses(campaignId)
 *  - Bulk CSV:   generateBatchId() → uploadFile() → poll getUploadProgress()
 *  - History:    fetchUploadHistory()  (my-uploads)
 *  - Single add: createUploadedAddress()
 *  - Inline edit: updateAddressText()
 * Glassmorphism dark, animated.
 */

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Plus, MapPin, FileText, Check, X, ChevronDown, Pencil, Search,
  CheckCircle2, Loader2, AlertTriangle, FileUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchAllCampaigns } from "@/services/campaignService"
import {
  fetchUploadedAddresses,
  fetchUploadHistory,
  generateBatchId,
  uploadFile,
  getUploadProgress,
  createUploadedAddress,
  updateAddressText,
  type UploadedAddress,
  type BatchHistoryItem,
} from "@/services/uploadedAddressesService"

// ─── View models ───────────────────────────────────────────────────────────────

interface CampaignVM { id: string; name: string; color: string }
interface Addr { id: string; text: string; geocoded: boolean; lat?: number; lng?: number; added: Date }
interface Batch { id: string; file: string; campaign: string; status: "completed" | "processing" | "failed"; total: number; geocoded: number; failed: number; created: Date }

const CAMPAIGN_COLORS = ["#10b981", "#ec4899", "#f59e0b", "#06b6d4", "#8b5cf6", "#3b82f6", "#f43f5e", "#14b8a6"]
const nbFmt = new Intl.NumberFormat("nb-NO")

// Map backend batch status → UI status bucket
function batchStatus(s: string): Batch["status"] {
  const v = (s || "").toLowerCase()
  if (v === "completed" || v === "complete" || v === "success") return "completed"
  if (v === "failed" || v === "cancelled" || v === "canceled" || v === "error") return "failed"
  return "processing"
}

function toAddr(a: UploadedAddress): Addr {
  return {
    id: a.id,
    text: a.address_text,
    geocoded: a.is_geocoded,
    lat: a.latitude ?? undefined,
    lng: a.longitude ?? undefined,
    added: a.added_at ? new Date(a.added_at) : new Date(),
  }
}

function toBatch(b: BatchHistoryItem): Batch {
  return {
    id: b.batch_id,
    file: b.file_name || b.batch_id.slice(0, 8),
    campaign: b.campaign_name || "—",
    status: batchStatus(b.status),
    total: b.total_addresses ?? 0,
    geocoded: b.geocoded_addresses ?? 0,
    failed: b.failed_addresses ?? 0,
    created: b.created_at ? new Date(b.created_at) : new Date(),
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AddAddressView() {
  const reduced = useReducedMotion()
  const [campaigns, setCampaigns] = useState<CampaignVM[]>([])
  const [campaign, setCampaign] = useState<CampaignVM | null>(null)
  const [campOpen, setCampOpen] = useState(false)
  const [addresses, setAddresses] = useState<Addr[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loadingAddrs, setLoadingAddrs] = useState(false)
  const [singleOpen, setSingleOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<{ file: string; progress: number } | null>(null)

  // Load campaigns once
  useEffect(() => {
    let cancelled = false
    fetchAllCampaigns()
      .then((cs) => {
        if (cancelled) return
        const vms = cs.map((c, i) => ({ id: c.id, name: c.name, color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }))
        setCampaigns(vms)
        setCampaign((prev) => prev ?? vms[0] ?? null)
      })
      .catch(() => { if (!cancelled) setError("Kunne ikke laste kampanjer.") })
    return () => { cancelled = true }
  }, [])

  // Refresh address list + history for the selected campaign
  const refresh = useCallback(async (campaignId: string) => {
    setLoadingAddrs(true)
    setError(null)
    try {
      const [list, history] = await Promise.all([
        fetchUploadedAddresses(campaignId, "", 1, 100),
        fetchUploadHistory().catch(() => ({ upload_history: [] })),
      ])
      setAddresses((list.results || []).map(toAddr))
      setBatches((history.upload_history || []).map(toBatch))
    } catch {
      setError("Kunne ikke laste adresser.")
      setAddresses([])
    } finally {
      setLoadingAddrs(false)
    }
  }, [])

  useEffect(() => { if (campaign) void refresh(campaign.id) }, [campaign, refresh])

  const filtered = useMemo(() => {
    const sorted = [...addresses].sort((a, b) => b.added.getTime() - a.added.getTime())
    if (!search) return sorted
    const q = search.toLowerCase()
    return sorted.filter(a => a.text.toLowerCase().includes(q))
  }, [addresses, search])

  const geocodedCount = addresses.filter(a => a.geocoded).length

  // Bulk CSV upload: batch id → upload → poll progress → refresh
  const runUpload = useCallback(async (file: File) => {
    if (!campaign) return
    setError(null)
    setUploading({ file: file.name, progress: 0 })
    try {
      const { batch_id } = await generateBatchId()
      await uploadFile(file, campaign.id, batch_id)

      // Poll progress until terminal state
      let done = false
      while (!done) {
        await new Promise((r) => setTimeout(r, 1500))
        const p = await getUploadProgress(batch_id)
        setUploading({ file: file.name, progress: Math.min(99, Math.round(p.progress_percentage || 0)) })
        const st = batchStatus(p.status)
        if (st === "completed" || st === "failed") done = true
      }
      setUploading({ file: file.name, progress: 100 })
      await refresh(campaign.id)
    } catch {
      setError(`Opplasting av ${file.name} feilet.`)
    } finally {
      setUploading(null)
    }
  }, [campaign, refresh])

  const onFile = (f: File | undefined) => { if (f) void runUpload(f) }

  const addSingle = async (text: string, postal: string, city: string) => {
    if (!campaign) return
    const full = [text, [postal, city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    try {
      await createUploadedAddress(full, campaign.id)
      await refresh(campaign.id)
    } catch {
      setError("Kunne ikke legge til adresse.")
    }
  }

  const saveEdit = async (id: string) => {
    const text = editText
    setEditId(null)
    try {
      await updateAddressText(id, text)
      if (campaign) await refresh(campaign.id)
    } catch {
      setError("Kunne ikke oppdatere adresse.")
    }
  }

  const STATUS_BATCH: Record<Batch["status"], { label: string; color: string; bg: string; Icon: React.ElementType }> = {
    completed:  { label: "Fullført", color: "#10b981", bg: "bg-emerald-500/15", Icon: CheckCircle2 },
    processing: { label: "Behandler", color: "#f59e0b", bg: "bg-amber-500/15", Icon: Loader2 },
    failed:     { label: "Feilet", color: "#f43f5e", bg: "bg-rose-500/15", Icon: AlertTriangle },
  }

  return (
    <div className="min-h-screen bg-ab-base">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-emerald-600/8 blur-3xl" />
      </div>

      <div className="relative px-4 sm:px-6 py-5 sm:py-6 max-w-[1500px] mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-ab-fg-4 mb-1">Adresser · Import</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-ab-fg">Legg til adresse</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Campaign selector */}
            <div className="relative">
              <button onClick={() => setCampOpen(o => !o)} disabled={!campaigns.length} className="cursor-pointer flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm font-medium text-ab-fg-2 hover:text-ab-fg hover:border-ab-line transition-all disabled:opacity-50">
                <span className="h-2 w-2 rounded-full" style={{ background: campaign?.color ?? "#64748b" }} /> {campaign?.name ?? "Ingen kampanjer"} <ChevronDown className="h-3.5 w-3.5 text-ab-fg-3" />
              </button>
              <AnimatePresence>
                {campOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCampOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}
                      className="absolute right-0 top-full mt-2 z-20 w-56 max-h-72 overflow-y-auto rounded-xl border border-ab-line bg-ab-overlay shadow-2xl py-1">
                      {campaigns.map(c => (
                        <button key={c.id} onClick={() => { setCampaign(c); setCampOpen(false) }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-ab-hover text-left">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="flex-1 text-ab-fg-2">{c.name}</span>{campaign?.id === c.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => setSingleOpen(true)} disabled={!campaign} className="cursor-pointer flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:bg-blue-500 transition-all disabled:opacity-50">
              <Plus className="h-4 w-4" /> Legg til enkelt
            </button>
          </div>
        </motion.div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Upload zone + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Drop zone */}
          <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (campaign && !uploading) onFile(e.dataTransfer.files?.[0]) }}
              onClick={() => campaign && !uploading && fileRef.current?.click()}
              className={cn("cursor-pointer rounded-2xl border-2 border-dashed bg-ab-elevated backdrop-blur-xl p-8 text-center transition-all",
                !campaign && "opacity-50 cursor-not-allowed",
                dragOver ? "border-blue-500/60 bg-blue-500/[0.06]" : "border-ab-line hover:border-ab-line")}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { onFile(e.target.files?.[0] ?? undefined); e.target.value = "" }} />
              <AnimatePresence mode="wait">
                {uploading ? (
                  <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 className="h-8 w-8 text-blue-400 mx-auto mb-3 animate-spin" />
                    <p className="text-sm font-semibold text-ab-fg mb-1">Laster opp {uploading.file}</p>
                    <p className="text-xs text-ab-fg-3 mb-4">Geokoder adresser…</p>
                    <div className="max-w-sm mx-auto h-2 overflow-hidden rounded-full bg-ab-hover">
                      <motion.div className="h-full rounded-full bg-blue-500" animate={{ width: `${uploading.progress}%` }} transition={{ duration: 0.2 }} />
                    </div>
                    <p className="mt-2 font-mono text-xs text-ab-fg-3">{uploading.progress}%</p>
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15"><FileUp className="h-6 w-6 text-blue-400" /></div>
                    <p className="text-sm font-semibold text-ab-fg mb-1">Dra og slipp CSV/Excel-fil, eller klikk for å bla</p>
                    <p className="text-xs text-ab-fg-3">Adresser geokodes automatisk og knyttes til <span className="text-ab-fg-2">{campaign?.name ?? "—"}</span></p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* KPI tiles */}
          <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
            {[
              { label: "Adresser", value: addresses.length, color: "#3b82f6", Icon: MapPin },
              { label: "Geokodet", value: geocodedCount, color: "#10b981", Icon: CheckCircle2 },
              { label: "Mangler", value: addresses.length - geocodedCount, color: "#f59e0b", Icon: AlertTriangle },
              { label: "Opplastinger", value: batches.length, color: "#8b5cf6", Icon: FileText },
            ].map(k => (
              <div key={k.label} className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-4">
                <div className="flex items-center justify-between mb-2"><span className="text-xs text-ab-fg-3">{k.label}</span><div className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ background: `${k.color}22` }}><k.Icon className="h-3.5 w-3.5" style={{ color: k.color }} /></div></div>
                <p className="font-mono text-2xl font-bold text-ab-fg">{k.value}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Upload history */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5">
          <h3 className="text-base font-semibold text-ab-fg mb-4">Opplastingshistorikk</h3>
          {batches.length === 0 ? (
            <p className="text-sm text-ab-fg-4 py-4 text-center">Ingen opplastinger ennå.</p>
          ) : (
          <div className="space-y-2">
            {batches.map((b, i) => {
              const s = STATUS_BATCH[b.status]
              const pct = b.total ? Math.round(b.geocoded / b.total * 100) : 0
              return (
                <motion.div key={b.id} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                  className="flex items-center gap-4 rounded-xl border border-ab-line bg-ab-elevated px-4 py-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}18` }}><FileText className="h-4 w-4" style={{ color: s.color }} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-sm font-semibold text-ab-fg truncate">{b.file}</span><span className="text-xs text-ab-fg-4">{b.campaign}</span></div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ab-hover"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} /></div>
                      <span className="text-xs text-ab-fg-3 font-mono">{nbFmt.format(b.geocoded)}/{nbFmt.format(b.total)}{b.failed > 0 && <span className="text-rose-400"> · {b.failed} feilet</span>}</span>
                    </div>
                  </div>
                  <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0", s.bg)} style={{ color: s.color }}><s.Icon className="h-3 w-3" /> {s.label}</span>
                  <span className="text-xs text-ab-fg-4 shrink-0 hidden md:block">{b.created.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}</span>
                </motion.div>
              )
            })}
          </div>
          )}
        </motion.div>

        {/* Address table */}
        <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ab-line">
            <h3 className="text-base font-semibold text-ab-fg">Adresser</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-4" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk adresse…" className="h-9 w-56 rounded-xl border border-ab-line bg-ab-elevated pl-8 pr-3 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div className="px-5 py-2.5 border-b border-ab-line grid grid-cols-[1fr_180px_90px] gap-3 text-[10px] font-bold uppercase tracking-wider text-ab-fg-4">
            <span>Adresse</span><span>Koordinater</span><span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-ab-line max-h-[400px] overflow-y-auto">
            {loadingAddrs ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-ab-fg-3"><Loader2 className="h-4 w-4 animate-spin" /> Laster adresser…</div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-ab-fg-4 py-10 text-center">Ingen adresser for denne kampanjen.</p>
            ) : filtered.map((a, i) => (
              <motion.div key={a.id} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
                className="group grid grid-cols-[1fr_180px_90px] gap-3 items-center px-5 py-2.5 hover:bg-ab-hover transition-colors">
                {editId === a.id ? (
                  <div className="flex items-center gap-2">
                    <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus onKeyDown={e => e.key === "Enter" && saveEdit(a.id)} className="flex-1 h-8 rounded-lg border border-blue-500/50 bg-ab-elevated px-2.5 text-sm text-ab-fg outline-none" />
                    <button onClick={() => saveEdit(a.id)} className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditId(null)} className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-ab-fg-3 hover:bg-ab-hover"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-ab-fg-2 truncate">{a.text}</span>
                    <button onClick={() => { setEditId(a.id); setEditText(a.text) }} className="cursor-pointer opacity-0 group-hover:opacity-100 text-ab-fg-4 hover:text-ab-fg transition-all"><Pencil className="h-3 w-3" /></button>
                  </div>
                )}
                <span className="font-mono text-xs text-ab-fg-4">{a.geocoded && a.lat != null ? `${a.lat.toFixed(4)}, ${a.lng!.toFixed(4)}` : "—"}</span>
                <div className="text-right">
                  {a.geocoded
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400"><CheckCircle2 className="h-3 w-3" /> OK</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400"><AlertTriangle className="h-3 w-3" /> Mangler</span>}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Single add modal */}
      <SingleAddModal open={singleOpen} onClose={() => setSingleOpen(false)} campaign={campaign} onAdd={addSingle} />
    </div>
  )
}

function SingleAddModal({ open, onClose, campaign, onAdd }: { open: boolean; onClose: () => void; campaign: { name: string; color: string } | null; onAdd: (t: string, p: string, c: string) => void | Promise<void> }) {
  const [text, setText] = useState(""); const [postal, setPostal] = useState(""); const [city, setCity] = useState("")
  const [saving, setSaving] = useState(false)
  React.useEffect(() => { if (open) { setText(""); setPostal(""); setCity(""); setSaving(false) } }, [open])
  const valid = text.trim() && postal.trim() && city.trim()
  const submit = async () => { if (!valid || saving) return; setSaving(true); await onAdd(text.trim(), postal.trim(), city.trim()); onClose() }
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4" style={{ background: "rgba(5,8,16,0.65)", backdropFilter: "blur(3px)" }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }} onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-ab-line bg-ab-overlay shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ab-line">
              <h2 className="text-lg font-bold text-ab-fg">Legg til adresse</h2>
              <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-ab-fg-4 hover:text-ab-fg hover:bg-ab-hover"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="block text-xs font-medium text-ab-fg-3 mb-1.5">Adresse</label><input value={text} onChange={e => setText(e.target.value)} autoFocus placeholder="Gatenavn og nummer" className="w-full h-10 rounded-xl border border-ab-line bg-ab-elevated px-3.5 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-ab-fg-3 mb-1.5">Postnummer</label><input value={postal} onChange={e => setPostal(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" className="w-full h-10 rounded-xl border border-ab-line bg-ab-elevated px-3.5 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" onKeyDown={e => e.key === "Enter" && submit()} /></div>
                <div><label className="block text-xs font-medium text-ab-fg-3 mb-1.5">By</label><input value={city} onChange={e => setCity(e.target.value)} placeholder="By" className="w-full h-10 rounded-xl border border-ab-line bg-ab-elevated px-3.5 text-sm text-ab-fg placeholder:text-ab-fg-4 outline-none focus:border-blue-500/50" onKeyDown={e => e.key === "Enter" && submit()} /></div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-ab-line bg-ab-elevated px-3.5 py-2.5 text-sm text-ab-fg-2"><span className="h-2 w-2 rounded-full" style={{ background: campaign?.color ?? "#64748b" }} /> Knyttes til {campaign?.name ?? "—"}</div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ab-line">
              <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover">Avbryt</button>
              <button onClick={submit} disabled={!valid || saving} className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Legg til</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AddAddressView
