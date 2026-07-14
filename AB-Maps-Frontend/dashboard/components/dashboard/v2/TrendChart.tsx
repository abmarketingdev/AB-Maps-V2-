"use client"

import { useState } from "react"
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { motion } from "framer-motion"
import { useReducedMotion } from "framer-motion"

type Period = "7d" | "30d" | "90d"

interface ChartPoint {
  date: string
  doors: number
  yesRate: number
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "7 dager" },
  { key: "30d", label: "30 dager" },
  { key: "90d", label: "90 dager" },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-ab-line bg-ab-overlay/90 backdrop-blur-xl px-4 py-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-ab-fg-3">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-sm font-semibold" style={{ color: p.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.dataKey === "doors" ? `${p.value} dører` : `${p.value}% ja`}
        </div>
      ))}
    </div>
  )
}

interface TrendChartProps {
  className?: string
  points?: ChartPoint[]              // live data (oldest→newest); falls back to mock
  range?: Period                     // controlled range (from parent)
  onRangeChange?: (r: Period) => void
}

export function TrendChart({ className, points, range, onRangeChange }: TrendChartProps) {
  const [internalPeriod, setInternalPeriod] = useState<Period>(range ?? "7d")
  const period = range ?? internalPeriod
  const setPeriod = (p: Period) => { onRangeChange ? onRangeChange(p) : setInternalPeriod(p) }
  const data = points ?? []
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className={`rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ab-fg">Aktivitetstrend</h3>
          <p className="mt-0.5 text-xs text-ab-fg-3">Dører banket & ja-prosent</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-ab-elevated p-1">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                period === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-ab-fg-3 hover:text-ab-fg-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="doorsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={period === "90d" ? 14 : period === "30d" ? 6 : 0}
          />
          <YAxis
            yAxisId="doors"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tick={{ fill: "rgba(245,158,11,0.7)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            yAxisId="doors"
            type="monotone"
            dataKey="doors"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#doorsGrad)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#3b82f6" }}
            isAnimationActive={!reduced}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="yesRate"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#f59e0b" }}
            isAnimationActive={!reduced}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex gap-4">
        <div className="flex items-center gap-1.5 text-xs text-ab-fg-3">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Dører banket
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ab-fg-3">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
          Ja-prosent
        </div>
      </div>
    </motion.div>
  )
}

export default TrendChart
