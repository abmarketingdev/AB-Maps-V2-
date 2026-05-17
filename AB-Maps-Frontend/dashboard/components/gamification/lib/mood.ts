/**
 * Mood derivation for the gamification mascot system.
 * Pure utility — no React, no side effects. Input is the current performance
 * snapshot for a single user; output is a mood descriptor with copy + colors.
 *
 * Phase 1.5: reduced from 7 moods to 4 actionable states (+ 'new' fallback
 * for missing data / new hires). Rationale: managers need one mood ↔ one
 * action, not analysis paralysis. "Står på" replaces three "trying but not
 * yet hitting target" states; "Sjekk inn" replaces two "low activity" states.
 */

export type Mood =
  | "on-fire"
  | "on-track"
  | "working-hard"
  | "needs-attention"
  | "new";

export interface MoodInput {
  jaProsent: number;
  dorerPerDag: number;
  minJaProsent: number;
  minDorerPerDag: number;
  rankPercentile?: number;
  daysOnPlatform?: number;
}

export interface MoodOutput {
  mood: Mood;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  iconName: string;
}

const META: Record<Mood, Omit<MoodOutput, "mood">> = {
  "on-fire": {
    label: "I flammer",
    description: "Topp 10% denne uken — uslåelig form!",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/15",
    borderClass: "border-amber-500/40",
    iconName: "Flame",
  },
  "on-track": {
    label: "På sporet",
    description: "Over begge målene — jevn og god!",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/15",
    borderClass: "border-emerald-500/40",
    iconName: "TrendingUp",
  },
  "working-hard": {
    label: "Står på",
    description: "Banker mye — ja-en kommer snart.",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/15",
    borderClass: "border-blue-500/40",
    iconName: "Target",
  },
  "needs-attention": {
    label: "Sjekk inn",
    description: "Lav aktivitet — kan trenge en prat.",
    colorClass: "text-rose-500",
    bgClass: "bg-rose-500/15",
    borderClass: "border-rose-500/40",
    iconName: "AlertCircle",
  },
  new: {
    label: "Ny på laget",
    description: "Mindre enn 7 dager — velkommen!",
    colorClass: "text-pink-500",
    bgClass: "bg-pink-500/15",
    borderClass: "border-pink-500/40",
    iconName: "Sparkles",
  },
};

export function computeMood(input: MoodInput): MoodOutput {
  const {
    jaProsent,
    dorerPerDag,
    minJaProsent,
    minDorerPerDag,
    rankPercentile,
    daysOnPlatform,
  } = input;

  // Decision tree — priority order, first match wins.
  let mood: Mood = "on-track"; // graceful fallback

  if (daysOnPlatform !== undefined && daysOnPlatform < 7) {
    mood = "new";
  } else if (
    rankPercentile !== undefined &&
    rankPercentile <= 10 &&
    // Tightened in Phase 1.5: requires substantially above target (1.3×),
    // not just meeting it. Produces real outliers, not "above average".
    jaProsent >= minJaProsent * 1.3
  ) {
    mood = "on-fire";
  } else if (jaProsent >= minJaProsent && dorerPerDag >= minDorerPerDag) {
    mood = "on-track";
  } else if (dorerPerDag >= minDorerPerDag && jaProsent < minJaProsent) {
    mood = "working-hard";
  } else if (
    dorerPerDag < minDorerPerDag ||
    jaProsent < minJaProsent * 0.7
  ) {
    mood = "needs-attention";
  }

  return { mood, ...META[mood] };
}

/** All user-facing moods (excludes the 'new' fallback). Use this for the
 *  preview gallery. */
export const ALL_MOODS: Mood[] = [
  "on-fire",
  "on-track",
  "working-hard",
  "needs-attention",
];

/** The 'new' fallback — shown separately in the preview, never in the main
 *  gallery row. */
export const FALLBACK_MOOD: Mood = "new";

export function getMoodMeta(mood: Mood): MoodOutput {
  return { mood, ...META[mood] };
}
