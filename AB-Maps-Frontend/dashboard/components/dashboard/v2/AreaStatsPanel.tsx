"use client"

/**
 * Area Intelligence panel — the left rail of the merged Områder view when an area
 * is selected. Shows per-area door-knock stats from maps-service
 * (GET /api/areas/areas/{id}/stats/): KPIs, Ja/Nei/Ikke-hjemme breakdown, assignees
 * with their in-area sales (ja), and a postal-code breakdown. "Sales" = status='ja'.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { ArrowLeft, DoorOpen, CheckCircle2, Percent, Users, ChevronDown, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAreaStats, type AreaStats, type PersonStat, type StatusBucket } from "@/lib/api/areaStats"
import { PanelLoading, PanelError } from "./_states"

const nbFmt = new Intl.NumberFormat("nb-NO")
const STATUS = [
  { key: "ja" as const, label: "Ja", color: "#10b981" },
  { key: "nei" as const, label: "Nei", color: "#f43f5e" },
  { key: "ikke_hjemme" as const, label: "Ikke hjemme", color: "#f59e0b" },
]

function SegmentedBar({ b }: { b: StatusBucket }) {
  const reduced = useReducedMotion()
  const total = b.total || 1
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-white/8 flex">
      {STATUS.map(s => (
        <motion.div key={s.key} className="h-full" style={{ background: s.color }}
          initial={reduced ? false : { width: 0 }} animate={{ width: `${(b[s.key] / total) * 100}%` }}
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }} />
      ))}
    </div>
  )
}

function PersonRow({ p }: { p: PersonStat }) {
  const [open, setOpen] = useState(false)
  const total = p.total || 1
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="cursor-pointer w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-bold text-white/70">
          {(p.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/90 truncate">{p.name}</p>
          <p className="text-[11px] text-white/35">{p.kind === "manager" ? "Leder" : "Selger"} · {nbFmt.format(p.total)} dører</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-sm font-bold text-emerald-400">{nbFmt.format(p.ja)}</p>
          <p className="text-[10px] text-white/30">salg · {p.ja_rate.toFixed(1)}%</p>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-white/30 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }} className="px-3 pb-3">
            <SegmentedBar b={p} />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {STATUS.map(s => (
                <div key={s.key} className="text-center">
                  <p className="font-mono text-sm font-bold" style={{ color: s.color }}>{nbFmt.format(p[s.key])}</p>
                  <p className="text-[10px] text-white/35">{s.label}</p>
                  <p className="font-mono text-[10px] text-white/25">{((p[s.key] / total) * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AreaStatsPanel({ areaId, campaign, fallbackName, accent, start, end, onBack }: {
  areaId: string
  campaign?: string
  fallbackName?: string
  accent?: string
  start?: string
  end?: string
  onBack: () => void
}) {
  const reduced = useReducedMotion()
  const [data, setData] = useState<AreaStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const [showOthers, setShowOthers] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErrored(false)
    getAreaStats(areaId, { campaign, start, end })
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setErrored(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [areaId, campaign, start, end])

  const k = data?.knocked
  const kpis = [
    { label: "Dører", value: nbFmt.format(data?.doors ?? 0), accent: "#3b82f6", Icon: DoorOpen },
    { label: "Salg (Ja)", value: nbFmt.format(k?.ja ?? 0), accent: "#10b981", Icon: CheckCircle2 },
    { label: "Ja-rate", value: `${(k?.ja_rate ?? 0).toFixed(1)}%`, accent: "#f59e0b", Icon: Percent },
    { label: "Tildelt", value: nbFmt.format(data?.assignees.length ?? 0), accent: "#8b5cf6", Icon: Users },
  ]

  return (
    <motion.div initial={reduced ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
        <button onClick={onBack} aria-label="Tilbake til liste"
          className="cursor-pointer h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: accent || "#3b82f6" }} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{data?.name ?? fallbackName ?? "Område"}</p>
            <p className="text-[11px] text-white/40 truncate">{data?.campaign?.name ?? "Områdestatistikk"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? <PanelLoading label="Laster områdestatistikk…" />
          : errored ? <PanelError onRetry={onBack} />
            : data && (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3">
                  {kpis.map(({ label, value, accent: a, Icon }) => (
                    <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-white/40 font-medium">{label}</span>
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${a}22` }}>
                          <Icon className="h-3.5 w-3.5" style={{ color: a }} />
                        </span>
                      </div>
                      <p className="font-mono text-xl font-bold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Status breakdown */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Statusfordeling</p>
                    <p className="text-[11px] text-white/35">{nbFmt.format(k?.total ?? 0)} dører besøkt</p>
                  </div>
                  <SegmentedBar b={k!} />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {STATUS.map(s => (
                      <div key={s.key} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                          <span className="text-[11px] text-white/45">{s.label}</span>
                        </div>
                        <p className="font-mono text-lg font-bold" style={{ color: s.color }}>{nbFmt.format((k as any)[s.key])}</p>
                        <p className="font-mono text-[10px] text-white/30">{(((k as any)[s.key] / (k?.total || 1)) * 100).toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assignees */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2.5 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Tildelte selgere ({data.assignees.length})
                  </p>
                  {data.assignees.length === 0 ? (
                    <p className="text-sm text-white/30">Ingen tildelte i dette området.</p>
                  ) : (
                    <div className="space-y-2">{data.assignees.map(p => <PersonRow key={`${p.person_id}-${p.kind}`} p={p} />)}</div>
                  )}

                  {data.unassigned_contributors.length > 0 && (
                    <div className="mt-3">
                      <button onClick={() => setShowOthers(o => !o)}
                        className="cursor-pointer flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors">
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showOthers && "rotate-180")} />
                        Andre bidragsytere ({data.unassigned_contributors.length})
                      </button>
                      <AnimatePresence initial={false}>
                        {showOthers && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }} className="mt-2 space-y-2">
                            {data.unassigned_contributors.map(p => <PersonRow key={`${p.person_id}-${p.kind}`} p={p} />)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Postal breakdown */}
                {data.postals.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2.5 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Postnummer ({data.postals.length})
                    </p>
                    <div className="space-y-2">
                      {data.postals.map(pc => {
                        const max = data.postals[0]?.total || 1
                        return (
                          <div key={pc.postal_code} className="flex items-center gap-3">
                            <span className="w-12 shrink-0 font-mono text-xs text-white/60">{pc.postal_code}</span>
                            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                              <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${(pc.total / max) * 100}%` }} />
                            </div>
                            <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold text-white/70">{nbFmt.format(pc.total)}</span>
                            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-emerald-400">{pc.ja_rate.toFixed(1)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
      </div>
    </motion.div>
  )
}

export default AreaStatsPanel
