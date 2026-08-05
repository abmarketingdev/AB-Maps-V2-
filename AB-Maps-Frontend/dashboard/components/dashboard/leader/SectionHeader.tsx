"use client"

import type { ReactNode } from "react"

interface SectionHeaderProps {
  label: string
  accent?: "teamleder" | "manager" | "neutral"
  right?: ReactNode
}

// Understated section divider used to mark MÅL MÅNED / MÅL UKE / TEAM / LØNN /
// TOPPLISTER regions. Small uppercase tracking, quiet — the tiles below carry
// the visual weight, not the header.
export function SectionHeader({ label, accent = "neutral", right }: SectionHeaderProps) {
  const dotColor =
    accent === "teamleder" ? "#F59E0B" :
    accent === "manager" ? "#3461FF" :
    "rgba(255,255,255,0.2)"

  return (
    <div className="flex items-center gap-3 pb-2 pt-1">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
      />
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ab-fg-3">
        {label}
      </h2>
      <div className="h-px flex-1 bg-ab-line-1" />
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
