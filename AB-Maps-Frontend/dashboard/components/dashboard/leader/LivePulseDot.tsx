"use client"

/**
 * Breathing green dot — sits on section headers pulling from live poll endpoints
 * (Sanntid section). Communicates "this data is fresh" without noise.
 */
import { cn } from "@/lib/utils"

interface LivePulseDotProps {
  className?: string
  size?: number
  color?: string
  label?: string
}

export function LivePulseDot({ className, size = 6, color = "var(--aurora-streak)", label }: LivePulseDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-aurora-streak", className)}>
      <span
        className="rounded-full live-pulse"
        style={{ width: size, height: size, background: color }}
        aria-hidden
      />
      {label && <span>{label}</span>}
    </span>
  )
}

export default LivePulseDot
