"use client"

import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { Activity } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "info" | "success" | "warn" | "danger" | "neutral"

interface ActivityRow {
  id: string
  time: string
  agent: string
  action: string
  location: string
  campaign?: string
  tone: Tone
}

const TONE_STYLES: Record<Tone, { dot: string; label: string }> = {
  info:    { dot: "bg-blue-500",    label: "bg-blue-500/15 text-blue-400"   },
  success: { dot: "bg-emerald-500", label: "bg-emerald-500/15 text-emerald-400" },
  warn:    { dot: "bg-amber-500",   label: "bg-amber-500/15 text-amber-400" },
  danger:  { dot: "bg-rose-500",    label: "bg-rose-500/15 text-rose-400"   },
  neutral: { dot: "bg-ab-fg-3",    label: "bg-ab-hover text-ab-fg-3"      },
}

interface ActivityFeedProps {
  className?: string
  rows?: ActivityRow[]   // live data (newest first); polled by the parent
}

export function ActivityFeed({ className, rows }: ActivityFeedProps) {
  const reduced = useReducedMotion()
  const feed = rows ?? []

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className={`rounded-2xl border border-ab-line bg-ab-elevated backdrop-blur-xl p-5 flex flex-col ${className ?? ""}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ab-fg">Live aktivitet</h3>
          <p className="mt-0.5 text-xs text-ab-fg-3">Siste hendelser</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ab-line">
        <AnimatePresence initial={false}>
          {feed.map((row) => (
            <motion.div
              key={row.id}
              initial={reduced ? false : { opacity: 0, x: -16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex items-start gap-2.5 rounded-xl border border-ab-line-1 bg-ab-elevated px-3 py-2.5"
            >
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TONE_STYLES[row.tone].dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed text-ab-fg-2">
                  <span className="font-semibold text-ab-fg">{row.agent}</span>
                  {" "}{row.action}{" "}
                  <span className="text-ab-fg-2">{row.location}</span>
                  {row.campaign && (
                    <> · <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", TONE_STYLES[row.tone].label)}>{row.campaign}</span></>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-ab-fg-4">{row.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default ActivityFeed
