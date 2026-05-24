"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { motion, useReducedMotion } from "framer-motion"
import { Flame, TrendingUp, Target, AlertCircle, Sparkles } from "lucide-react"
import type { MoodCount } from "@/lib/api/dashboardOverview"

interface MoodSegment {
  mood: string
  label: string
  value: number
  color: string
  icon: React.ElementType
}

// Display metadata per mood key (backend returns counts; UI owns label/color/icon).
const MOOD_META: Record<string, { label: string; color: string; icon: React.ElementType; order: number }> = {
  "on-fire":         { label: "I flammer",   color: "#f59e0b", icon: Flame,       order: 0 },
  "on-track":        { label: "På sporet",   color: "#10b981", icon: TrendingUp,  order: 1 },
  "working-hard":    { label: "Står på",     color: "#3b82f6", icon: Target,      order: 2 },
  "needs-attention": { label: "Sjekk inn",   color: "#f43f5e", icon: AlertCircle, order: 3 },
  "new":             { label: "Ny på laget", color: "#ec4899", icon: Sparkles,    order: 4 },
}

function buildSegments(counts: MoodCount[]): MoodSegment[] {
  return counts
    .filter((c) => MOOD_META[c.mood])
    .map((c) => ({ mood: c.mood, value: c.count, ...MOOD_META[c.mood] }))
    .sort((a, b) => MOOD_META[a.mood].order - MOOD_META[b.mood].order)
}

function CustomTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null
  const seg: MoodSegment = payload[0].payload
  const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
  return (
    <div className="rounded-xl border border-white/15 bg-[#0d1528]/90 backdrop-blur-xl px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold" style={{ color: seg.color }}>{seg.label}</p>
      <p className="mt-1 text-xs text-white/50">{seg.value} ansatte · {pct}%</p>
    </div>
  )
}

interface MoodRingProps {
  className?: string
  segments?: MoodCount[]
}

export function MoodRing({ className, segments }: MoodRingProps) {
  const reduced = useReducedMotion()
  const SEGMENTS = buildSegments(segments ?? [])
  const total = SEGMENTS.reduce((s, seg) => s + seg.value, 0)

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col ${className ?? ""}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Stemningsring</h3>
        <p className="mt-0.5 text-xs text-white/40">Ansattfordeling etter humør</p>
      </div>

      <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={SEGMENTS}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={!reduced}
              animationBegin={0}
              animationDuration={800}
            >
              {SEGMENTS.map((seg) => (
                <Cell key={seg.mood} fill={seg.color} opacity={0.9} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold text-white">{total}</span>
          <span className="text-xs text-white/40">ansatte</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        {SEGMENTS.map((seg) => (
          <div key={seg.mood} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <seg.icon className="h-3.5 w-3.5 shrink-0" style={{ color: seg.color }} />
              <span className="text-xs text-white/60">{seg.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }}
                />
              </div>
              <span className="w-5 text-right font-mono text-xs font-medium text-white/70">{seg.value}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default MoodRing
