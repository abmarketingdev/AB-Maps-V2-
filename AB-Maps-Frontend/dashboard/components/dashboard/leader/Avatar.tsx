"use client"

/**
 * Ringed gradient avatar for identity chips (promoters, team leaders, top scorers).
 * Colocated with the leader-dashboard primitives so we don't touch legacy avatars.
 */
import { cn } from "@/lib/utils"

interface AvatarProps {
  name: string
  size?: number
  color?: string          // seed color for the gradient ring / fill
  withRing?: boolean      // premium ring treatment (default true here)
  online?: boolean        // small streak dot on bottom-right
  className?: string
}

function seedColorFromName(name: string): string {
  // Deterministic pick from a small aurora palette.
  const palette = ["#3461FF", "#FF7A45", "#FFC46B", "#4ADE80", "#8B5CF6", "#F472B6", "#0E9384"]
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return palette[h % palette.length]
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase()
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function Avatar({
  name, size = 28, color, withRing = true, online = false, className,
}: AvatarProps) {
  const c = color ?? seedColorFromName(name)
  return (
    <span
      className={cn("relative inline-grid place-items-center rounded-full font-mono font-semibold text-white shrink-0", className)}
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `linear-gradient(135deg, ${hexAlpha(c, 0.95)}, ${hexAlpha(c, 0.55)})`,
        boxShadow: withRing
          ? `0 0 0 1.5px ${hexAlpha(c, 0.4)}, inset 0 0 ${Math.max(4, size * 0.3)}px ${hexAlpha(c, 0.35)}`
          : `inset 0 0 ${Math.max(4, size * 0.3)}px ${hexAlpha(c, 0.35)}`,
      }}
    >
      {initials(name)}
      {online && (
        <span
          className="absolute rounded-full bg-aurora-streak live-pulse"
          style={{
            width: Math.max(6, size * 0.28),
            height: Math.max(6, size * 0.28),
            bottom: -1,
            right: -1,
            boxShadow: "0 0 0 2px var(--ab-bg-elevated)",
          }}
          aria-hidden
        />
      )}
    </span>
  )
}

/** Stacked pile of Avatars — overlaps them with a small negative margin. */
export function AvatarStack({
  names, size = 22, max = 4, color, className,
}: { names: string[]; size?: number; max?: number; color?: string; className?: string }) {
  const visible = names.slice(0, max)
  const extra = Math.max(0, names.length - max)
  return (
    <div className={cn("inline-flex items-center", className)}>
      <div className="flex" style={{ paddingLeft: 0 }}>
        {visible.map((n, i) => (
          <div key={n + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.35, zIndex: 10 - i }}>
            <Avatar name={n} size={size} color={color} />
          </div>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-[10px] font-mono text-ab-fg-3">+{extra}</span>
      )}
    </div>
  )
}

export default Avatar
