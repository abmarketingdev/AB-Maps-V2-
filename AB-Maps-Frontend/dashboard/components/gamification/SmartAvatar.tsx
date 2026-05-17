"use client";

import React from "react";
import { useTheme } from "next-themes";
import { stringToHsl } from "@/lib/stringToHsl";
import { cn } from "@/lib/utils";
import { MoodMascot } from "./MoodMascot";
import { computeMood, getMoodMeta } from "./lib/mood";

/**
 * SmartAvatar — wraps MoodMascot (for employees with performance data) and
 * falls back to the existing initials-bubble pattern (for managers / superusers /
 * admins, or when performance data is missing). Single component used across
 * Ytelse, Statistikk, and Områder so all three pages stay consistent.
 */

interface SmartAvatarUser {
  id?: string;
  name: string;
  role?: string;
  user_type?: string;
  is_manager?: boolean;
  type?: string; // some older shapes use `type`
}

interface SmartAvatarPerformance {
  jaProsent: number;
  dorerPerDag: number;
  minJaProsent?: number;
  minDorerPerDag?: number;
  rankPercentile?: number;
  daysOnPlatform?: number;
}

interface SmartAvatarProps {
  user: SmartAvatarUser;
  performance?: SmartAvatarPerformance;
  size?: "sm" | "md" | "lg" | "xl";
  showMoodIndicator?: boolean;
  showMoodLabel?: boolean;
  className?: string;
}

const SIZE_PX: Record<NonNullable<SmartAvatarProps["size"]>, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const DEFAULT_MIN_JA = 3.0;
const DEFAULT_MIN_DORER = 70;

/** Treat as employee unless the user object explicitly says manager/admin/superuser.
 *  This conservatively defaults to "employee" for the common case where a sales
 *  row only carries a name string — employees field-sell, managers don't. */
function isEmployee(user: SmartAvatarUser): boolean {
  const role = (user.role ?? "").toLowerCase();
  const userType = (user.user_type ?? "").toLowerCase();
  const t = (user.type ?? "").toLowerCase();
  const explicit = [role, userType, t].filter(Boolean);

  if (user.is_manager === true) return false;
  if (explicit.some((r) => r === "manager" || r === "admin" || r === "superuser")) {
    return false;
  }
  // Otherwise treat as employee (default).
  return true;
}

function initialsOf(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SmartAvatar({
  user,
  performance,
  size = "md",
  showMoodIndicator = true,
  showMoodLabel = false,
  className,
}: SmartAvatarProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const seed = user.id || user.name || "anon";

  const employee = isEmployee(user);

  if (employee) {
    const mood = performance
      ? computeMood({
          jaProsent: performance.jaProsent,
          dorerPerDag: performance.dorerPerDag,
          minJaProsent: performance.minJaProsent ?? DEFAULT_MIN_JA,
          minDorerPerDag: performance.minDorerPerDag ?? DEFAULT_MIN_DORER,
          rankPercentile: performance.rankPercentile,
          daysOnPlatform: performance.daysOnPlatform,
        })
      : getMoodMeta("new"); // No perf data → 'new' fallback

    return (
      <MoodMascot
        seed={seed}
        mood={mood}
        size={size}
        showMoodIndicator={showMoodIndicator}
        showMoodLabel={showMoodLabel}
        className={className}
      />
    );
  }

  // Non-employee fallback: token-styled initials disc (matches the
  // ring-1 ring-inset pattern used elsewhere in the app).
  const px = SIZE_PX[size];
  const fontSize = Math.round(px * 0.28);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10 shrink-0",
        className,
      )}
      style={{
        width: px,
        height: px,
        background: stringToHsl(user.name, { dark: isDark }),
        color: isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.72)",
        fontSize,
      }}
      title={user.name}
    >
      {initialsOf(user.name)}
    </span>
  );
}
