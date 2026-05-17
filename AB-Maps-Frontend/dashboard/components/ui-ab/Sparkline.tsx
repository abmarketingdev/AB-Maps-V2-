import * as React from "react"

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = "var(--ab-accent-11)",
  fill = true,
  className,
}: SparklineProps) {
  if (!data || data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : width
  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
    .join(" ")
  const areaPath = `M0,${height} L${points.split(" ").join(" L")} L${width},${height} Z`
  const linePath = `M${points.split(" ").join(" L")}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id="ab-spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#ab-spark-grad)" />
        </>
      )}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
