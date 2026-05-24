"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { Mood } from "./lib/mood"

export type RoyState =
  | "idle"
  | "greeting"
  | "ready"
  | "win-small"
  | "win-big"
  | "concerned"
  | "sleeping"
  | "thinking"

export const MOOD_TO_ROY: Record<Mood, RoyState> = {
  "on-fire": "win-big",
  "on-track": "ready",
  "working-hard": "win-small",
  "needs-attention": "concerned",
  new: "greeting",
}

interface RoyMascotProps {
  state?: RoyState
  size?: number
  accent?: string
  className?: string
  /** Milestone "power-up": a one-shot scale-pop + intensified halo. Opt-in so
   *  existing (manager) call sites are unchanged. Used by employee celebrations. */
  powerUp?: boolean
}

const FUR = "#2E3A4B"
const BELLY = "#E8ECF1"
const LINE = "#0E1420"
const OCHRE = "#C8A24A"

function Eyes({ state }: { state: RoyState }) {
  if (state === "sleeping") {
    return (
      <>
        <line x1="34" y1="46" x2="42" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
        <line x1="58" y1="46" x2="66" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      </>
    )
  }
  if (state === "win-small" || state === "win-big") {
    return (
      <>
        <path d="M 34 47 Q 38 43 42 47" stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M 58 47 Q 62 43 66 47" stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </>
    )
  }
  if (state === "thinking") {
    return (
      <>
        <circle cx="40" cy="44" r="3" fill={LINE} />
        <circle cx="64" cy="44" r="3" fill={LINE} />
      </>
    )
  }
  if (state === "concerned") {
    return (
      <>
        <circle cx="36" cy="48" r="3" fill={LINE} />
        <circle cx="60" cy="48" r="3" fill={LINE} />
      </>
    )
  }
  return (
    <>
      <circle cx="38" cy="46" r="3" fill={LINE} />
      <circle cx="62" cy="46" r="3" fill={LINE} />
    </>
  )
}

function Mouth({ state }: { state: RoyState }) {
  if (state === "win-small" || state === "win-big") {
    return <path d="M 44 59 Q 50 64 56 59" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" />
  }
  if (state === "concerned") {
    return <path d="M 46 62 Q 50 60 54 62" stroke={LINE} strokeWidth="1.8" fill="none" strokeLinecap="round" />
  }
  if (state === "sleeping") {
    return <path d="M 47 60 L 53 60" stroke={LINE} strokeWidth="1.6" fill="none" strokeLinecap="round" />
  }
  return <path d="M 46 60 Q 50 62 54 60" stroke={LINE} strokeWidth="1.8" fill="none" strokeLinecap="round" />
}

// Per-state wrapper animation (ported from roy-demo.html). Each entry =
// [keyframes, durationSeconds]. Drives the "alive" feel for every mood.
const WRAP_ANIM: Record<RoyState, { anim: Record<string, number[]>; dur: number }> = {
  idle:        { anim: { y: [0, -1.2, 0] },                      dur: 4 },
  sleeping:    { anim: { y: [0, -1.2, 0] },                      dur: 4 },
  ready:       { anim: { y: [0, -1.5, 0] },                      dur: 2.4 },
  "win-small": { anim: { y: [0, -4, 0] },                        dur: 1.2 },
  "win-big":   { anim: { y: [0, -9, 0], scale: [1, 1.04, 0.98, 1] }, dur: 0.9 },
  concerned:   { anim: { x: [-1.2, 1.2, -1.2] },                 dur: 2.8 },
  thinking:    { anim: { rotate: [-1.5, 1.5, -1.5] },            dur: 3.6 },
  greeting:    { anim: { y: [0, -3, -2, 0], rotate: [0, -2, 2, 0] }, dur: 1.6 },
}

function Sparkles() {
  const pos = [
    { top: "18%", left: "14%", d: 0 },
    { top: "28%", right: "12%", d: 0.3 },
    { top: "60%", left: "6%", d: 0.6 },
    { top: "50%", right: "4%", d: 0.9 },
  ]
  return (
    <div className="pointer-events-none absolute inset-0">
      {pos.map((p, i) => (
        <motion.span key={i}
          className="absolute h-1 w-1 rounded-full"
          style={{ background: OCHRE, top: p.top, left: (p as any).left, right: (p as any).right }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: p.d }}
        />
      ))}
    </div>
  )
}

function Zzz() {
  return (
    <div className="pointer-events-none absolute" style={{ top: 4, right: 2, fontStyle: "italic", color: OCHRE }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i} className="inline-block" style={{ fontSize: 14 - i * 3 }}
          animate={{ opacity: [0, 1, 0], x: [0, 8], y: [6, -14] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: i }}>
          z
        </motion.span>
      ))}
    </div>
  )
}

export function RoyMascot({ state = "idle", size = 64, accent = "#3b82f6", className, powerUp = false }: RoyMascotProps) {
  const reduced = useReducedMotion()
  const tilt = state === "greeting" ? -4 : state === "thinking" ? 3 : 0
  const earTilt = state === "concerned" ? 12 : (state === "ready" || state === "win-small" || state === "win-big" ? -6 : 0)
  const wrap = WRAP_ANIM[state]
  const showSparkles = !reduced && (state === "win-small" || state === "win-big")
  const showZzz = !reduced && state === "sleeping"
  // Round-eyed moods blink occasionally for an "alive" feel.
  const blinkable = !reduced && (state === "idle" || state === "ready" || state === "thinking" || state === "concerned" || state === "greeting")

  const inner = (
    <motion.div
      className={powerUp ? undefined : className}
      style={{ width: size, height: size, display: "inline-block", position: "relative" }}
      animate={reduced ? {} : wrap.anim}
      transition={reduced ? {} : { duration: wrap.dur, repeat: Infinity, ease: "easeInOut" }}
      data-state={state}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
        <g transform={`rotate(${tilt} 50 55)`}>
          {/* Body */}
          <path d="M 22 80 Q 22 62 35 60 L 65 60 Q 78 62 78 80 L 78 92 L 22 92 Z" fill={FUR} />
          <path d="M 30 80 Q 30 70 38 68 L 62 68 Q 70 70 70 80 L 70 92 L 30 92 Z" fill={BELLY} />

          {/* Tail */}
          {state === "sleeping" ? (
            <path d="M 75 88 Q 90 88 88 78 Q 86 72 80 76" fill={FUR} stroke={LINE} strokeWidth="0.6" />
          ) : (
            <path d="M 78 78 Q 92 70 88 56 Q 86 50 82 54 Q 86 62 78 70 Z" fill={FUR} stroke={LINE} strokeWidth="0.6" />
          )}
          <path d="M 84 53 Q 86 50 82 54 Q 81 56 84 53 Z" fill={BELLY} />

          {/* Ears */}
          <g transform={`rotate(${-earTilt} 32 28)`}>
            <path d="M 22 30 L 30 14 L 38 30 Z" fill={FUR} stroke={LINE} strokeWidth="0.6" strokeLinejoin="round" />
            <path d="M 27 26 L 30 19 L 33 26 Z" fill={OCHRE} opacity="0" />
          </g>
          <g transform={`rotate(${earTilt} 68 28)`}>
            <path d="M 62 30 L 70 14 L 78 30 Z" fill={FUR} stroke={LINE} strokeWidth="0.6" strokeLinejoin="round" />
          </g>

          {/* Head */}
          <path d="M 22 38 Q 22 22 50 18 Q 78 22 78 38 L 78 56 Q 70 66 50 66 Q 30 66 22 56 Z" fill={FUR} stroke={LINE} strokeWidth="0.8" strokeLinejoin="round" />
          {/* Cheeks */}
          <path d="M 32 50 Q 32 60 50 64 Q 68 60 68 50 Q 60 56 50 56 Q 40 56 32 50 Z" fill={BELLY} />
          {/* Muzzle */}
          <path d="M 44 56 L 56 56 L 53 64 L 47 64 Z" fill={BELLY} stroke={LINE} strokeWidth="0.5" />
          {/* Nose */}
          <ellipse cx="50" cy="56" rx="2" ry="1.4" fill={LINE} />

          {blinkable ? (
            <motion.g
              style={{ transformOrigin: "center", transformBox: "fill-box" } as React.CSSProperties}
              animate={{ scaleY: [1, 1, 0.12, 1, 1] }}
              transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", times: [0, 0.9, 0.94, 0.98, 1] }}
            >
              <Eyes state={state} />
            </motion.g>
          ) : (
            <Eyes state={state} />
          )}
          <Mouth state={state} />

          {/* Thinking dots */}
          {state === "thinking" && !reduced && (
            <g>
              {[0, 0.3, 0.6].map((delay, i) => (
                <circle key={i} cx={78 + i * 6} cy={22 - i * 2} r="1.6" fill={accent}>
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin={`${delay}s`} />
                </circle>
              ))}
            </g>
          )}

          {/* Win-big ring pulse */}
          {state === "win-big" && !reduced && (
            <circle cx="50" cy="50" r="46" fill="none" stroke={accent} strokeWidth="1">
              <animate attributeName="r" values="40;52;40" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.4;0" dur="1.6s" repeatCount="indefinite" />
            </circle>
          )}

          {/* Greeting tail flick */}
          {state === "greeting" && !reduced && (
            <g style={{ transformOrigin: "78px 70px", animation: "roy-tail-flick 1.5s ease-out 1" }}>
              <path d="M 78 78 Q 92 70 88 56 Q 86 50 82 54 Q 86 62 78 70 Z" fill={FUR} opacity="0.4" />
            </g>
          )}
        </g>
      </svg>
      {showSparkles && <Sparkles />}
      {showZzz && <Zzz />}
      <style>{`
        @keyframes roy-tail-flick {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(8deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </motion.div>
  )

  if (!powerUp) return inner

  // Milestone power-up: one-shot scale pop + expanding halo ring behind Roy.
  return (
    <motion.div
      className={className}
      style={{ position: "relative", display: "inline-block" }}
      initial={reduced ? false : { scale: 0.6, rotate: -10 }}
      animate={{ scale: [0.6, 1.2, 1], rotate: [-10, 4, 0] }}
      transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.6, 1] }}
    >
      {!reduced && (
        <motion.span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: size, height: size, border: `2px solid ${accent}` }}
          initial={{ scale: 0.7, opacity: 0.7 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {inner}
    </motion.div>
  )
}

export default RoyMascot
