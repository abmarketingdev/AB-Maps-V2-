"use client"

/**
 * Celebration — milestone moment overlay: a confetti burst + Roy "powering up".
 * Pure Framer Motion (no external confetti dep). Fires once per mount when a
 * milestone is present, then auto-dismisses. Gated strictly by the caller so it
 * never spams — only goal-hit / personal-best / streak milestones.
 */

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { RoyMascot } from "@/components/gamification/RoyMascot"
import type { Milestone } from "./employeeLogic"

const CONFETTI_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f43f5e", "#8b5cf6", "#fbbf24"]

function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() =>
    Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 2,            // -1..1 horizontal drift
      delay: Math.random() * 0.25,
      duration: 1.6 + Math.random() * 1.4,
      rotate: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      left: Math.random() * 100,
    })), [count])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-[-5%] rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color }}
          initial={{ y: "-10vh", opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", x: p.x * 160, rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn", times: [0, 0.85, 1] }}
        />
      ))}
    </div>
  )
}

export function Celebration({ milestone, onDone }: { milestone: Milestone; onDone?: () => void }) {
  const reduced = useReducedMotion()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!milestone) return
    setShow(true)
    const t = setTimeout(() => { setShow(false); onDone?.() }, reduced ? 1800 : 3200)
    return () => clearTimeout(t)
  }, [milestone, reduced, onDone])

  return (
    <AnimatePresence>
      {show && milestone && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ background: "rgba(5,8,16,0.55)", backdropFilter: "blur(3px)" }}
          onClick={() => { setShow(false); onDone?.() }}
        >
          {!reduced && <Confetti />}
          <motion.div
            initial={{ scale: 0.7, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative flex flex-col items-center text-center px-10 py-8 rounded-3xl border border-white/12 bg-[#0d1528]/90 shadow-[0_32px_90px_-12px_rgba(0,0,0,0.7)]"
          >
            <RoyMascot state="win-big" size={120} accent="#fbbf24" powerUp />
            <motion.h2
              initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="mt-4 text-xl font-bold text-white"
            >
              {milestone.title}
            </motion.h2>
            <motion.p
              initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="mt-1 text-sm text-white/55"
            >
              {milestone.sub}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Celebration
