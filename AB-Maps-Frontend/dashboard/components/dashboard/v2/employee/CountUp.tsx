"use client"

/** Animated count-up number. Springs from 0 → value on mount. */

import { useEffect, useRef, useState } from "react"
import { animate, useReducedMotion } from "framer-motion"

interface CountUpProps {
  value: number
  decimals?: number
  duration?: number
  delay?: number
  suffix?: string
  className?: string
}

export function CountUp({ value, decimals = 0, duration = 1.1, delay = 0, suffix = "", className }: CountUpProps) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : 0)
  const node = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (reduced) { setDisplay(value); return }
    const controls = animate(0, value, {
      duration, delay, ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value, duration, delay, reduced])

  return (
    <span ref={node} className={className}>
      {display.toLocaleString("nb-NO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  )
}

export default CountUp
