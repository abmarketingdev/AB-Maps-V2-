"use client"

/**
 * RegisterKnockModal — quick door-knock registration (Module 2, guide §7.2).
 * Pick an outcome (+ optional address, + a "nei" reason), POST to
 * /api/employee/me/registrations/, then trigger a refetch of /me/today/.
 */

import React, { useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, DoorClosed, Home, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  postRegistration,
  type RegistrationStatus,
  type NeiSubcategory,
} from "@/lib/api/employeeDashboard"

const OUTCOMES: { status: RegistrationStatus; label: string; color: string; icon: React.ElementType }[] = [
  { status: "ja",          label: "Ja",          color: "#10b981", icon: Check },
  { status: "nei",         label: "Nei",         color: "#f43f5e", icon: X },
  { status: "ikke_hjemme", label: "Ikke hjemme", color: "#64748b", icon: Home },
  { status: "folg_opp",    label: "Følg opp",    color: "#f59e0b", icon: Clock },
]

const NEI_REASONS: { value: NeiSubcategory; label: string }[] = [
  { value: "ikke_interessert",   label: "Ikke interessert" },
  { value: "darlig_erfaring",    label: "Dårlig erfaring" },
  { value: "bindingstid",        label: "Bindingstid" },
  { value: "bedrift",            label: "Bedrift" },
  { value: "pris",               label: "Pris" },
  { value: "eksisterende_kunde", label: "Eksisterende kunde" },
]

interface Props {
  open: boolean
  onClose: () => void
  onRegistered: () => void
}

export function RegisterKnockModal({ open, onClose, onRegistered }: Props) {
  const [status, setStatus] = useState<RegistrationStatus | null>(null)
  const [address, setAddress] = useState("")
  const [neiReason, setNeiReason] = useState<NeiSubcategory | "">("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)

  React.useEffect(() => { setMounted(true) }, [])
  React.useEffect(() => {
    if (open) { setStatus(null); setAddress(""); setNeiReason(""); setNotes(""); setError("") }
  }, [open])

  const submit = async () => {
    if (!status || submitting) return
    setSubmitting(true); setError("")
    try {
      await postRegistration({
        status,
        address: address.trim() || undefined,
        nei_subcategory: status === "nei" && neiReason ? neiReason : undefined,
        notes: notes.trim() || undefined,
      })
      onRegistered()
      onClose()
    } catch (e: any) {
      setError(e?.message?.includes("403") ? "Du har ikke tilgang til å registrere her." : "Kunne ikke registrere. Prøv igjen.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(5,8,16,0.7)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0d1528] shadow-[0_32px_90px_-12px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <DoorClosed className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Registrer dør</h2>
              </div>
              <button onClick={onClose} className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* outcome picker */}
              <div className="grid grid-cols-2 gap-2.5">
                {OUTCOMES.map((o) => {
                  const Icon = o.icon
                  const active = status === o.status
                  return (
                    <button key={o.status} onClick={() => setStatus(o.status)}
                      className={cn("flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-all cursor-pointer",
                        active ? "text-white" : "border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20")}
                      style={active ? { borderColor: `${o.color}80`, background: `${o.color}1f`, boxShadow: `0 0 16px -6px ${o.color}` } : undefined}>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${o.color}26` }}>
                        <Icon className="h-4 w-4" style={{ color: o.color }} />
                      </span>
                      {o.label}
                    </button>
                  )
                })}
              </div>

              {/* nei reason */}
              <AnimatePresence>
                {status === "nei" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Årsak (valgfritt)</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {NEI_REASONS.map((r) => (
                        <button key={r.value} onClick={() => setNeiReason(neiReason === r.value ? "" : r.value)}
                          className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                            neiReason === r.value ? "bg-rose-500/20 text-rose-300" : "bg-white/5 text-white/45 hover:text-white/75")}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* address */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Adresse (valgfritt)</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Storgata 1"
                  className="mt-1.5 w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/50 transition-all" />
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
              <button onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/8 transition-colors">Avbryt</button>
              <button onClick={submit} disabled={!status || submitting}
                className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? "Registrerer…" : "Registrer"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default RegisterKnockModal
