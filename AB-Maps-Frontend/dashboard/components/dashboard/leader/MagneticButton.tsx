"use client"

/**
 * Magnetic CTA — a button whose child element gently pulls toward the cursor
 * when the cursor is within ~100px. Used for primary CTAs like "Registrer dør".
 */
import { useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  strength?: number   // 0.15 – 0.35 typical
}

export function MagneticButton({ children, className, onClick, strength = 0.25 }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [t, setT] = useState({ x: 0, y: 0 })

  function onMove(e: React.MouseEvent) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.hypot(dx, dy)
    const radius = 130
    if (dist > radius) return
    setT({ x: dx * strength, y: dy * strength })
  }
  function reset() {
    setT({ x: 0, y: 0 })
  }

  return (
    <button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white",
        "bg-gradient-to-br from-aurora-sunrise via-ab-accent to-aurora-sunrise bg-[length:200%_100%]",
        "shadow-[0_10px_30px_-10px_rgba(255,122,69,0.6)] hover:shadow-[0_15px_45px_-10px_rgba(255,122,69,0.75)]",
        "transition-[background-position,box-shadow] duration-500 hover:bg-right",
        className,
      )}
      style={{
        transform: `translate3d(${t.x}px, ${t.y}px, 0)`,
        transition: "transform 220ms cubic-bezier(0.23, 1, 0.32, 1), background-position 500ms, box-shadow 300ms",
      }}
    >
      {children}
    </button>
  )
}

export default MagneticButton
