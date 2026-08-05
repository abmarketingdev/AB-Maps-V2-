"use client"

/**
 * Aurora Nordic — animated shader background for hero panels.
 * Pure CSS radial gradients + keyframes (see globals.css .aurora-canvas).
 * No canvas, no perf hit; respects prefers-reduced-motion via keyframe pause.
 * Also pauses the 30s aurora-shift when the tab is hidden — background tabs
 * shouldn't burn a CPU core repainting a gradient nobody's looking at.
 */
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface AuroraBgProps {
  className?: string
  intensity?: "soft" | "normal" | "vivid"
}

export function AuroraBg({ className, intensity = "normal" }: AuroraBgProps) {
  const opacity = intensity === "soft" ? "opacity-40" : intensity === "vivid" ? "opacity-90" : "opacity-70"
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const sync = () => setPaused(document.visibilityState === "hidden")
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className={cn("absolute inset-0 aurora-canvas", opacity)}
        style={paused ? { animationPlayState: "paused" } : undefined}
      />
      {/* Vignette to keep type readable on top */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ab-base/60" />
    </div>
  )
}

export default AuroraBg
