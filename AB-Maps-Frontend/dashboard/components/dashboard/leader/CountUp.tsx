"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

interface CountUpProps {
  value: number
  duration?: number  // ms
  delay?: number     // ms
  className?: string
}

// Local CountUp — the employee dashboard has its own, DashboardV2 tiles have
// their own inline copy. Kept here so the leader/ tree has no cross-tree deps.
export function CountUp({ value, duration = 900, delay = 0, className }: CountUpProps) {
  const [current, setCurrent] = useState(0)
  const reduced = useReducedMotion()
  const raf = useRef<number>(0)
  const timeout = useRef<number>(0)

  useEffect(() => {
    if (reduced) { setCurrent(value); return }
    timeout.current = window.setTimeout(() => {
      const start = Date.now()
      const tick = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setCurrent(value * eased)
        if (progress < 1) raf.current = requestAnimationFrame(tick)
        else setCurrent(value)
      }
      raf.current = requestAnimationFrame(tick)
    }, delay)
    return () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(timeout.current)
    }
  }, [value, duration, delay, reduced])

  return <span className={className}>{Math.round(current).toLocaleString("nb-NO")}</span>
}
