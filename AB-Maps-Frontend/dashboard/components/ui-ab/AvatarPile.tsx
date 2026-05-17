import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarPileEntry {
  name: string
  initials?: string
  src?: string
  online?: boolean
}

interface AvatarPileProps {
  people: AvatarPileEntry[]
  max?: number
  size?: number
  className?: string
}

export function AvatarPile({ people, max = 4, size = 24, className }: AvatarPileProps) {
  const visible = people.slice(0, max)
  const extra = Math.max(0, people.length - max)
  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-1.5">
        {visible.map((p, i) => {
          const initials = p.initials ?? p.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
          return (
            <div
              key={`${p.name}-${i}`}
              title={p.name}
              className="rounded-full border border-ab-line bg-ab-active text-ab-fg-2 inline-flex items-center justify-center text-[10px] font-semibold"
              style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
            >
              {p.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.src} alt={p.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                initials
              )}
              {p.online && (
                <span
                  className="absolute -bottom-0 -right-0 rounded-full bg-ab-teal border-2 border-ab-elevated"
                  style={{ width: size * 0.35, height: size * 0.35 }}
                />
              )}
            </div>
          )
        })}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-[11px] text-ab-fg-3 mono">+{extra}</span>
      )}
    </div>
  )
}
