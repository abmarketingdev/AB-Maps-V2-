"use client"

/**
 * Tiny inline SVG sparkline sized to sit BEHIND KPI digits.
 * Reads a 6-12 point series, renders a smoothed area — no axes, no labels.
 * Used inside GoalTile / HeroKpi as an atmospheric trend indicator.
 */
interface SparklineProps {
  data: number[]
  color?: string
  className?: string
  strokeWidth?: number
  fill?: boolean
  height?: number
}

export function Sparkline({
  data, color = "currentColor", className, strokeWidth = 1.75, fill = true, height = 40,
}: SparklineProps) {
  if (!data || data.length < 2) return null
  const w = 100
  const h = height
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  // Smooth via monotone-cubic-ish path (simple bezier per segment).
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * h * 0.9 - h * 0.05] as const)
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const cx = (x0 + x1) / 2
    d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`
  }
  const areaD = `${d} L ${w} ${h} L 0 ${h} Z`
  const gradId = `spark-${Math.random().toString(36).slice(2, 9)}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradId})`} />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default Sparkline
