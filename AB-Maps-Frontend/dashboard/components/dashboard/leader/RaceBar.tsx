"use client"

/**
 * Race-bar leaderboard row — horizontal bar sliding to a percentile, with
 * avatar + name on the left, mono value + delta pill on the right.
 * Used by TopplisterRow, TeamPanel and Kampanjestatus.
 */
import { cn } from "@/lib/utils"
import { ArrowUpRight, ArrowDownRight, Flame } from "lucide-react"
import { Avatar } from "./Avatar"

export interface RaceBarProps {
  name: string
  value: number | string
  /** 0-100. If not provided, valuePct is computed by parent via max. */
  pct: number
  color?: string
  delta?: number             // percentage or point delta vs baseline
  deltaGoodDirection?: "up" | "down"
  streak?: number            // if >= 3, show flame
  isYou?: boolean            // highlight current-user row
  rank?: number              // 1..N; top-3 get medal
  className?: string
  avatarSize?: number
  showAvatar?: boolean
  onClick?: () => void
}

export function RaceBar({
  name, value, pct, color = "#3461FF",
  delta, deltaGoodDirection = "up",
  streak = 0, isYou = false, rank, className, avatarSize = 26, showAvatar = true, onClick,
}: RaceBarProps) {
  const clamped = Math.max(0, Math.min(100, pct))
  const goodDelta = delta === undefined ? undefined : deltaGoodDirection === "up" ? delta >= 0 : delta <= 0
  const medal =
    rank === 1 ? "linear-gradient(135deg,#FCD34D,#F59E0B)" :
    rank === 2 ? "linear-gradient(135deg,#E5E7EB,#9CA3AF)" :
    rank === 3 ? "linear-gradient(135deg,#FDBA74,#C2410C)" : null

  return (
    <div
      onClick={onClick}
      className={cn(
        "group grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 px-3 rounded-xl transition-colors",
        onClick && "cursor-pointer hover:bg-white/[0.04]",
        isYou && "bg-white/[0.03] ring-1 ring-inset ring-aurora-sunrise/30",
        className,
      )}
    >
      {/* Avatar or rank */}
      <div className="flex items-center gap-2 min-w-0">
        {rank != null && (
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-md text-[11px] font-mono font-bold shrink-0",
              medal ? "text-black/80" : "bg-white/[0.04] text-ab-fg-3",
            )}
            style={medal ? { background: medal, boxShadow: `0 0 10px rgba(245,158,11,0.35)` } : undefined}
          >
            {rank}
          </span>
        )}
        {showAvatar && <Avatar name={name} size={avatarSize} color={color} />}
      </div>

      {/* Name + bar */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5 min-w-0">
          <span className={cn("text-[13px] font-medium truncate", isYou ? "text-aurora-sunrise" : "text-ab-fg")}>
            {name}
          </span>
          {streak >= 3 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-aurora-amber" title={`${streak}-dagers streak`}>
              <Flame className="h-3 w-3" /> {streak}
            </span>
          )}
        </div>
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="race-fill h-full rounded-full"
            style={{
              width: `${clamped}%`,
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              boxShadow: `0 0 12px ${color}55`,
            }}
          />
        </div>
      </div>

      {/* Value + delta */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-sm tabular-nums text-ab-fg">
          {typeof value === "number" ? value.toLocaleString("nb-NO") : value}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-mono",
              goodDelta ? "text-aurora-streak" : "text-rose-400",
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
      </div>
    </div>
  )
}

export default RaceBar
