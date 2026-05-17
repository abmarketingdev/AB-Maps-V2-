"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createAvatar } from "@dicebear/core";
import { adventurerNeutral } from "@dicebear/collection";
import {
  Flame,
  TrendingUp,
  Target,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MoodOutput } from "./lib/mood";

interface MoodMascotProps {
  seed: string;
  mood: MoodOutput;
  size?: "sm" | "md" | "lg" | "xl";
  /** Force the corner mood badge on/off. If omitted, defaults to ON at lg/xl
   *  and OFF at sm/md (where the corner glyph is illegible). */
  showMoodIndicator?: boolean;
  showMoodLabel?: boolean;
  className?: string;
  /** Skip the built-in pulsing halo for on-fire at lg/xl. Useful when the
   *  mascot is placed in a high-traffic spot (e.g. the page header) where a
   *  constant glow would be distracting. The mood-colored ring remains. */
  disablePulseGlow?: boolean;
  /** Return just the avatar element (no built-in Tooltip / button / label
   *  wrapper). Lets the caller wrap with its own Link, Tooltip, or motion
   *  shell while keeping the avatar visuals identical. */
  bare?: boolean;
}

const SIZE_PX: Record<NonNullable<MoodMascotProps["size"]>, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

// Phase 1.5 — restricted to the 4 actionable moods + 'new'. Old icons
// (Zap, CloudRain, Moon) intentionally dropped from this map.
const ICON_MAP = {
  Flame,
  TrendingUp,
  Target,
  AlertCircle,
  Sparkles,
} as const;

// mood.colorClass → exact hex. Used for inline gradients + ring colors so
// Tailwind's JIT doesn't need to know about dynamic class strings.
const COLOR_HEX: Record<string, string> = {
  "text-amber-500": "#f59e0b",   // on-fire
  "text-emerald-500": "#10b981", // on-track
  "text-blue-500": "#3b82f6",    // working-hard
  "text-rose-500": "#f43f5e",    // needs-attention
  "text-pink-500": "#ec4899",    // new
};

export function MoodMascot({
  seed,
  mood,
  size = "md",
  showMoodIndicator,
  showMoodLabel = false,
  className,
  disablePulseGlow = false,
  bare = false,
}: MoodMascotProps) {
  const reduce = useReducedMotion();
  const px = SIZE_PX[size];
  const Icon = (ICON_MAP as any)[mood.iconName] ?? Sparkles;
  const tintHex = COLOR_HEX[mood.colorClass] ?? "#94a3b8";
  const isLargeSize = size === "lg" || size === "xl";

  // Default behaviour for the corner badge: ON at lg/xl, OFF at sm/md.
  // Phase 1.5 — at small sizes the badge becomes illegible and adds noise
  // to dense lists. The face tint + ring carry the signal alone.
  const renderIndicator = showMoodIndicator ?? isLargeSize;

  // On-fire pulsing halo only at large sizes too — would create chaos in
  // dense ranking tables otherwise.
  const isOnFire = mood.mood === "on-fire";
  const renderPulsingHalo = isOnFire && isLargeSize && !disablePulseGlow;

  // Cached avatar SVG — regenerated only when seed changes.
  const avatarSvg = useMemo(() => {
    return createAvatar(adventurerNeutral, {
      seed,
      size: px,
      radius: 50,
      backgroundColor: ["transparent"],
    }).toString();
  }, [seed, px]);

  const indicatorSize = Math.max(18, Math.round(px * 0.34));

  const inner = (
    <div className={cn("relative inline-block", className)} style={{ width: px, height: px }}>
      {/* On-fire animated pulsing halo (lg/xl only) */}
      {renderPulsingHalo && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-[-6px] rounded-full bg-amber-400/30 blur-xl"
          initial={reduce ? false : { opacity: 0.3, scale: 1 }}
          animate={
            reduce
              ? undefined
              : { opacity: [0.3, 0.7, 0.3], scale: [1, 1.08, 1] }
          }
          transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
        />
      )}

      {/* Mascot avatar — mood-tint gradient is now the dominant signal.
          The cartoon face sits on a near-white inner canvas so the dark line
          work stays legible in both themes; the tint radiates from edges. */}
      <motion.div
        initial={reduce ? false : { scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-full overflow-hidden shadow-sm"
        style={{
          width: px,
          height: px,
          // Louder tint than Phase 1: 35% outer → 10% mid → near-white center.
          // Dark mode bumps to 45% to compensate for darker surrounding bg.
          // Center stays near-white in both themes so faces remain readable.
          background: `linear-gradient(135deg, ${tintHex}59 0%, ${tintHex}1f 45%, #ffffff 100%)`,
          // Mood-color ring (was neutral white/black). On-fire keeps its
          // stronger amber ring.
          boxShadow: isOnFire
            ? `0 0 0 2px ${tintHex}99, 0 1px 2px rgba(0,0,0,0.08)`
            : `0 0 0 2px ${tintHex}66, 0 1px 2px rgba(0,0,0,0.08)`,
        }}
      >
        <span
          aria-hidden
          className="block w-full h-full"
          dangerouslySetInnerHTML={{ __html: avatarSvg }}
        />
      </motion.div>

      {/* Mood indicator badge — only at lg/xl sizes. Saturated sticker with
          white icon, mood-colored shadow. */}
      {renderIndicator && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 rounded-full inline-flex items-center justify-center border-2 border-ab-canvas"
          style={{
            width: indicatorSize,
            height: indicatorSize,
            background: tintHex,
            boxShadow: `0 4px 12px ${tintHex}66, 0 1px 2px rgba(0,0,0,0.18)`,
          }}
        >
          <Icon
            className="text-white"
            style={{
              width: Math.round(indicatorSize * 0.58),
              height: Math.round(indicatorSize * 0.58),
            }}
            strokeWidth={2.5}
          />
        </span>
      )}
    </div>
  );

  // `bare` returns just the avatar so callers (e.g. the employee page header)
  // can supply their own Link / Tooltip / motion wrapper without a nested
  // interactive element.
  if (bare) return inner;

  const content = (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent/40"
              aria-label={`${mood.label} — ${mood.description}`}
            >
              {inner}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px]">
            <div className="text-[12px] font-semibold">{mood.label}</div>
            <div className="text-[11px] text-ab-fg-2 mt-0.5">{mood.description}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showMoodLabel && (
        <span
          className={cn(
            "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-medium tracking-wide whitespace-nowrap",
            mood.bgClass,
            mood.colorClass,
            mood.borderClass,
          )}
        >
          {mood.label}
        </span>
      )}
    </div>
  );

  return content;
}
