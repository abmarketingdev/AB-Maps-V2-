"use client"

import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import {
  Users, DoorOpen, TrendingUp, Megaphone, ShoppingBag,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { KpiStats } from "@/lib/api/dashboardOverview"

interface KPI {
  id: string
  label: string
  value: number
  format: "number" | "percent"
  delta?: number
  deltaLabel?: string
  accent: string
  glowColor: string
  Icon: React.ElementType
  live?: boolean
}

// No revenue card — the backend has no revenue data (guide §1). Values are 0
// until live stats arrive (no mock fallback).
function buildKpis(stats?: KpiStats): KPI[] {
  return [
    {
      id: "online", label: "Online ansatte",
      value: stats?.online.value ?? 0,
      format: "number",
      deltaLabel: stats ? `av ${stats.online.total}` : undefined,
      accent: "#3b82f6", glowColor: "rgba(59,130,246,0.2)", Icon: Users, live: true,
    },
    {
      id: "doors", label: "Totale dører",
      value: stats?.totalDoors.value ?? 0,
      format: "number", delta: stats?.totalDoors.deltaPct,
      deltaLabel: "vs i går", accent: "#8b5cf6", glowColor: "rgba(139,92,246,0.2)", Icon: DoorOpen,
    },
    {
      id: "ja", label: "Ja-prosent",
      value: stats?.yesRate.value ?? 0,
      format: "percent", delta: stats?.yesRate.deltaPct,
      deltaLabel: "vs i går", accent: "#f59e0b", glowColor: "rgba(245,158,11,0.2)", Icon: TrendingUp,
    },
    {
      id: "campaigns", label: "Aktive kampanjer",
      value: stats?.activeCampaigns.value ?? 0,
      format: "number", accent: "#06b6d4", glowColor: "rgba(6,182,212,0.2)", Icon: Megaphone,
    },
    {
      id: "sales", label: "Salg i dag",
      value: stats?.salesToday.value ?? 0,
      format: "number", delta: stats?.salesToday.deltaPct,
      deltaLabel: "vs i går", accent: "#f43f5e", glowColor: "rgba(244,63,94,0.2)", Icon: ShoppingBag,
    },
  ]
}

function formatValue(value: number, format: KPI["format"]): string {
  if (format === "percent") return `${value.toFixed(1)}%`
  return value.toLocaleString("nb-NO")
}

function CountUp({ target, format }: { target: number; format: KPI["format"] }) {
  const [current, setCurrent] = useState(0)
  const reduced = useReducedMotion()
  const raf = useRef<number>(0)

  useEffect(() => {
    if (reduced) { setCurrent(target); return }
    const start = Date.now()
    const duration = 800
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(target * eased)
      if (progress < 1) raf.current = requestAnimationFrame(tick)
      else setCurrent(target)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, reduced])

  return <span>{formatValue(current, format)}</span>
}

interface KPIStripProps {
  className?: string
  stats?: KpiStats
}

export function KPIStrip({ className, stats }: KPIStripProps) {
  const reduced = useReducedMotion()
  const kpis = buildKpis(stats)

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3", className)}>
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.id}
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="group relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5 cursor-default transition-all duration-200 hover:border-ab-line"
          style={{ "--glow": kpi.glowColor } as React.CSSProperties}
          whileHover={reduced ? {} : { boxShadow: `0 0 24px ${kpi.glowColor}` }}
        >
          {/* Top row: icon + live dot */}
          <div className="flex items-center justify-between mb-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: `${kpi.accent}22` }}
            >
              <kpi.Icon className="h-4 w-4" style={{ color: kpi.accent }} />
            </div>
            {kpi.live && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>

          {/* Value */}
          <div className="font-mono text-2xl font-bold tracking-tight text-ab-fg">
            <CountUp target={kpi.value} format={kpi.format} />
          </div>

          {/* Label */}
          <p className="mt-1 text-xs font-medium text-ab-fg-3">{kpi.label}</p>

          {/* Delta */}
          {kpi.delta !== undefined && (
            <div className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              kpi.delta >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {kpi.delta >= 0
                ? <ArrowUpRight className="h-3.5 w-3.5" />
                : <ArrowDownRight className="h-3.5 w-3.5" />
              }
              <span>{Math.abs(kpi.delta)}{kpi.format === "percent" ? "pp" : "%"} {kpi.deltaLabel}</span>
            </div>
          )}

          {/* Bottom glow line */}
          <div
            className="absolute bottom-0 left-0 h-[2px] w-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{ background: `linear-gradient(90deg, transparent, ${kpi.accent}, transparent)` }}
          />
        </motion.div>
      ))}
    </div>
  )
}

export default KPIStrip
