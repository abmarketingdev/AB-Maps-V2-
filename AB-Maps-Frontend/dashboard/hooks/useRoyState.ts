"use client"

import * as React from "react"
import type { RoyState } from "@/components/ui-ab"

interface UseRoyStateInput {
  todayDoors?: number
  yesterdayDoors?: number
  dailyTarget?: number
  isLoading?: boolean
  isEmpty?: boolean
  hour?: number
}

const MIN_STATE_HOLD_MS = 4000

function deriveState(input: UseRoyStateInput): RoyState {
  const {
    todayDoors,
    yesterdayDoors,
    dailyTarget,
    isLoading,
    isEmpty,
    hour = new Date().getHours(),
  } = input

  if (isLoading) return "thinking"
  if (isEmpty) return "sleeping"

  const today = todayDoors ?? 0
  const yesterday = yesterdayDoors ?? 0
  const target = dailyTarget ?? 0

  if (target > 0 && today >= target * 1.25) return "win-big"
  if (target > 0 && today >= target) return "win-small"
  if (yesterday > 0 && today > yesterday && (target === 0 || today < target)) return "ready"
  if (yesterday > 0 && today < yesterday * 0.7 && hour > 14) return "concerned"
  return "idle"
}

/**
 * Roy state machine. Reacts to KPI deltas with a minimum 4s hold per state
 * (prevents twitching when data updates frequently).
 *
 * Rules:
 *  - isLoading            → thinking
 *  - isEmpty              → sleeping
 *  - today ≥ target*1.25  → win-big
 *  - today ≥ target       → win-small
 *  - today > yesterday    → ready
 *  - today < yesterday*0.7 and afternoon → concerned (only if yesterday > 0)
 *  - first mount          → greeting (one-shot, 2s, then derived)
 *  - otherwise            → idle
 */
export function useRoyState(input: UseRoyStateInput): RoyState {
  const [state, setState] = React.useState<RoyState>("greeting")
  const [greeted, setGreeted] = React.useState(false)
  const lastSwitchRef = React.useRef<number>(Date.now())
  const pendingRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // After 2s of greeting, transition to derived state
  React.useEffect(() => {
    if (greeted) return
    const t = setTimeout(() => setGreeted(true), 2000)
    return () => clearTimeout(t)
  }, [greeted])

  React.useEffect(() => {
    if (!greeted) return
    const next = deriveState(input)
    if (next === state) return

    const now = Date.now()
    const elapsed = now - lastSwitchRef.current

    if (elapsed >= MIN_STATE_HOLD_MS) {
      setState(next)
      lastSwitchRef.current = now
    } else {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingRef.current = setTimeout(() => {
        setState(next)
        lastSwitchRef.current = Date.now()
      }, MIN_STATE_HOLD_MS - elapsed)
    }

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeted, input.todayDoors, input.yesterdayDoors, input.dailyTarget, input.isLoading, input.isEmpty, input.hour])

  return state
}
