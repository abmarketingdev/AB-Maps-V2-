"use client"

import * as React from "react"

// Røy — the AB Marketing arctic fox.
// Geometric primitives only. Solid circle eyes (no whites/highlights).
// 8 states: idle, greeting, ready, win-small, win-big, concerned, sleeping, thinking.

export type RoyState =
  | "idle"
  | "greeting"
  | "ready"
  | "win-small"
  | "win-big"
  | "concerned"
  | "sleeping"
  | "thinking"

interface RoyProps {
  state?: RoyState
  size?: number
  accent?: string
  className?: string
}

const FUR = "#2E3A4B"
const BELLY = "#E8ECF1"
const LINE = "#0E1420"

export function Roy({
  state = "idle",
  size = 64,
  accent = "var(--ab-accent-9)",
  className,
}: RoyProps) {
  const breathing = state === "idle" || state === "sleeping" || state === "concerned"
  const tilt = state === "greeting" ? -4 : state === "thinking" ? 3 : 0

  let eyeShape: React.ReactNode = (
    <>
      <circle cx="38" cy="46" r="3" fill={LINE} />
      <circle cx="62" cy="46" r="3" fill={LINE} />
    </>
  )
  if (state === "sleeping") {
    eyeShape = (
      <>
        <line x1="34" y1="46" x2="42" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
        <line x1="58" y1="46" x2="66" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      </>
    )
  } else if (state === "win-small" || state === "win-big") {
    eyeShape = (
      <>
        <path d="M 34 47 Q 38 43 42 47" stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M 58 47 Q 62 43 66 47" stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </>
    )
  } else if (state === "thinking") {
    eyeShape = (
      <>
        <circle cx="40" cy="44" r="3" fill={LINE} />
        <circle cx="64" cy="44" r="3" fill={LINE} />
      </>
    )
  } else if (state === "concerned") {
    eyeShape = (
      <>
        <circle cx="36" cy="48" r="3" fill={LINE} />
        <circle cx="60" cy="48" r="3" fill={LINE} />
      </>
    )
  }

  let mouth: React.ReactNode = (
    <path d="M 46 60 Q 50 62 54 60" stroke={LINE} strokeWidth="1.8" fill="none" strokeLinecap="round" />
  )
  if (state === "win-small" || state === "win-big") {
    mouth = <path d="M 44 59 Q 50 64 56 59" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" />
  } else if (state === "concerned") {
    mouth = <path d="M 46 62 Q 50 60 54 62" stroke={LINE} strokeWidth="1.8" fill="none" strokeLinecap="round" />
  } else if (state === "sleeping") {
    mouth = <path d="M 47 60 L 53 60" stroke={LINE} strokeWidth="1.6" fill="none" strokeLinecap="round" />
  }

  const earTilt =
    state === "concerned" ? 12 : state === "ready" || state === "win-small" || state === "win-big" ? -6 : 0

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        position: "relative",
        animation: breathing ? "roy-breathe 4s ease-in-out infinite" : "none",
      }}
      data-roy
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
            <path
              d="M 78 78 Q 92 70 88 56 Q 86 50 82 54 Q 86 62 78 70 Z"
              fill={FUR}
              stroke={LINE}
              strokeWidth="0.6"
            />
          )}
          <path d="M 84 53 Q 86 50 82 54 Q 81 56 84 53 Z" fill={BELLY} />

          {/* Ears */}
          <g transform={`rotate(${-earTilt} 32 28)`}>
            <path
              d="M 22 30 L 30 14 L 38 30 Z"
              fill={FUR}
              stroke={LINE}
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          </g>
          <g transform={`rotate(${earTilt} 68 28)`}>
            <path
              d="M 62 30 L 70 14 L 78 30 Z"
              fill={FUR}
              stroke={LINE}
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          </g>

          {/* Head */}
          <path
            d="M 22 38 Q 22 22 50 18 Q 78 22 78 38 L 78 56 Q 70 66 50 66 Q 30 66 22 56 Z"
            fill={FUR}
            stroke={LINE}
            strokeWidth="0.8"
            strokeLinejoin="round"
          />

          {/* Cheeks */}
          <path d="M 32 50 Q 32 60 50 64 Q 68 60 68 50 Q 60 56 50 56 Q 40 56 32 50 Z" fill={BELLY} />

          {/* Muzzle */}
          <path d="M 44 56 L 56 56 L 53 64 L 47 64 Z" fill={BELLY} stroke={LINE} strokeWidth="0.5" />

          {/* Nose */}
          <ellipse cx="50" cy="56" rx="2" ry="1.4" fill={LINE} />

          {/* Eyes */}
          {eyeShape}

          {/* Mouth */}
          {mouth}

          {/* Thinking dots */}
          {state === "thinking" && (
            <g>
              <circle cx="78" cy="22" r="1.6" fill={accent}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0s" />
              </circle>
              <circle cx="84" cy="20" r="1.6" fill={accent}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
              </circle>
              <circle cx="90" cy="18" r="1.6" fill={accent}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.6s" />
              </circle>
            </g>
          )}

          {/* Win-big: ring pulse */}
          {state === "win-big" && (
            <circle cx="50" cy="50" r="46" fill="none" stroke={accent} strokeWidth="1">
              <animate attributeName="r" values="40;52;40" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.4;0" dur="1.6s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      </svg>
    </div>
  )
}
