import { CheckCircle2, Moon, Sun, Target, XCircle, type LucideIcon } from "lucide-react"
import type { DayState } from "@/lib/api/scheduling"

// Client colour semantics (06 Nov note): red = ikke møtt, green = jobbet,
// orange = i dag, blue = planlagt, black = fri. Outlined cards: light tint,
// 2 px state border, 3 px left stripe, icon + label so colour is never the
// only signal. Dark theme keeps the hue on a darker tint.
export interface StateStyle {
  label: string
  icon: LucideIcon
  card: string // border + background
  stripe: string // left stripe colour
  ink: string // label/icon colour
  dot: string // legend dot
}

export const STATE_STYLES: Record<DayState, StateStyle> = {
  no_show: {
    label: "Ikke møtt",
    icon: XCircle,
    card: "border-[#DC2626] bg-[#FEF2F2] dark:border-[#EF4444] dark:bg-[#2A1215]",
    stripe: "bg-[#DC2626] dark:bg-[#EF4444]",
    ink: "text-[#B91C1C] dark:text-[#FCA5A5]",
    dot: "bg-[#DC2626]",
  },
  worked: {
    label: "Jobbet",
    icon: CheckCircle2,
    card: "border-[#16A34A] bg-[#F0FDF4] dark:border-[#22C55E] dark:bg-[#0F2417]",
    stripe: "bg-[#16A34A] dark:bg-[#22C55E]",
    ink: "text-[#15803D] dark:text-[#86EFAC]",
    dot: "bg-[#16A34A]",
  },
  today: {
    label: "I dag",
    icon: Sun,
    card: "border-[#EA580C] bg-[#FFF7ED] dark:border-[#F97316] dark:bg-[#2B1709]",
    stripe: "bg-[#EA580C] dark:bg-[#F97316]",
    ink: "text-[#C2410C] dark:text-[#FDBA74]",
    dot: "bg-[#EA580C]",
  },
  planned: {
    label: "Planlagt",
    icon: Target,
    card: "border-[#2563EB] bg-[#EFF6FF] dark:border-[#3B82F6] dark:bg-[#0E1A33]",
    stripe: "bg-[#2563EB] dark:bg-[#3B82F6]",
    ink: "text-[#1D4ED8] dark:text-[#93C5FD]",
    dot: "bg-[#2563EB]",
  },
  off: {
    label: "Fri",
    icon: Moon,
    card: "border-[#1F2328] bg-[#FAFAF9] dark:border-[#9CA3AF] dark:bg-[#111214]",
    stripe: "bg-[#1F2328] dark:bg-[#9CA3AF]",
    ink: "text-[#57606A] dark:text-[#9CA3AF]",
    dot: "bg-[#1F2328] dark:bg-[#9CA3AF]",
  },
}

/** A planned day that is over with fewer doors than this is «Ikke jobbet» (server rule, boss 10.11). */
export const NOT_WORKED_DOORS = 50

export const LEGEND_ORDER: DayState[] = ["worked", "today", "planned", "no_show", "off"]

export function initials(name: string): string {
  const parts = name.replace(/[-–]/g, " ").split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–"
  return new Intl.NumberFormat("nb-NO").format(n)
}

/** «1 dør» / «N dører» (null → plural) */
export function doorsWord(n: number | null | undefined): string {
  return n === 1 ? "dør" : "dører"
}

/** «1 giver» / «N givere» (null → plural) */
export function giversWord(n: number | null | undefined): string {
  return n === 1 ? "giver" : "givere"
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–"
  return `${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 }).format(n)} %`
}
