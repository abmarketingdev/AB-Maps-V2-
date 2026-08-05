"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { Clock } from "lucide-react"
import { Placeholder } from "./Placeholder"

interface Team {
  name: string
  color: string
}

interface AktivitetstidChartProps {
  /** Rows shaped { hour: "16:00", [team.name]: <count>, ... } */
  data: Record<string, string | number>[]
  teams: Team[]
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div className="rounded-xl border border-ab-line bg-ab-overlay/95 backdrop-blur-xl px-3.5 py-2.5 shadow-xl min-w-[180px]">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-ab-fg-3">Kl. {label}</span>
        <span className="font-mono font-bold text-ab-fg">{total} dører</span>
      </div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
            <span className="flex-1 text-ab-fg">{p.dataKey}</span>
            <span className="font-mono font-semibold text-ab-fg">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Salgsleder-only. Hourly activity 16:00 → 21:00, one line per team.
// Area gradient under each line + thick strokes + rich tooltip so the chart
// reads as premium not as a Recharts default.
export function AktivitetstidChart({ data, teams }: AktivitetstidChartProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ab-fg">Aktivitetstid</h3>
            <p className="mt-0.5 text-xs text-ab-fg-3">Dører banket per time — per team</p>
          </div>
        </div>
      </div>

      <Placeholder>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              {teams.map(t => (
                <linearGradient key={t.name} id={`grad-${t.name.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={t.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={t.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              dy={4}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-ab-fg-3">{value}</span>}
            />
            {teams.map(t => (
              <Area
                key={t.name}
                type="monotone"
                dataKey={t.name}
                stroke={t.color}
                strokeWidth={2.5}
                fill={`url(#grad-${t.name.replace(/\s+/g, "-")})`}
                dot={{ r: 3, fill: t.color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "rgba(255,255,255,0.5)" }}
                isAnimationActive={!reduced}
                animationDuration={900}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Placeholder>
    </motion.div>
  )
}
