// Date helpers for the Kalender. All dates are plain "YYYY-MM-DD" strings
// (calendar days in Europe/Oslo). Arithmetic runs on UTC midnight so DST
// never shifts a day.

export const DAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const
export const DAY_CHIP = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"] as const
/** Weekday chips for planning: Monday–Saturday. */
export const WORK_DAY_CHIP = DAY_CHIP.slice(0, 6) as readonly string[]
export const DAY_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"] as const
const MONTH_SHORT = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"] as const
const MONTH_LONG = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
] as const

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Today's calendar date in Europe/Oslo. */
export function osloToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso))
}

/** Calendars show Monday–Saturday only (client 09.11: no Sunday anywhere). */
export const WORK_DAYS = 6

export function isSunday(iso: string): boolean {
  return weekdayIndex(iso) === 6
}

/** The day that decides which week a calendar opens on: today, or the coming
 *  Monday when today is a Sunday (Sunday is not shown, so show next week). */
export function calendarAnchor(today: string): string {
  return isSunday(today) ? addDays(today, 1) : today
}

/** Mon–Sat of the week starting at `monday`. */
export function workWeek(monday: string): string[] {
  return range(monday, WORK_DAYS)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parse(toIso).getTime() - parse(fromIso).getTime()) / 86_400_000)
}

/** ISO-8601 week number. */
export function isoWeek(iso: string): number {
  const d = parse(iso)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3) // Thursday of this week decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

export function range(fromIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(fromIso, i))
}

/** «Tor 12.11» */
export function cardDate(iso: string): { day: string; date: string } {
  const d = parse(iso)
  return {
    day: DAY_SHORT[weekdayIndex(iso)],
    date: `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
  }
}

/** «torsdag 12. november» */
export function longDate(iso: string): string {
  const d = parse(iso)
  return `${DAY_LONG[weekdayIndex(iso)].toLowerCase()} ${d.getUTCDate()}. ${MONTH_LONG[d.getUTCMonth()]}`
}

/** «12. nov» */
export function shortDate(iso: string): string {
  const d = parse(iso)
  return `${d.getUTCDate()}. ${MONTH_SHORT[d.getUTCMonth()]}`
}

/** «2.–15. nov» or «30. nov – 13. des» */
export function rangeLabel(fromIso: string, toIso: string): string {
  const a = parse(fromIso)
  const b = parse(toIso)
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}.–${b.getUTCDate()}. ${MONTH_SHORT[b.getUTCMonth()]}`
  }
  return `${a.getUTCDate()}. ${MONTH_SHORT[a.getUTCMonth()]} – ${b.getUTCDate()}. ${MONTH_SHORT[b.getUTCMonth()]}`
}

/** Relative label for a week starting at `monday`, seen from today. */
export function weekLabel(monday: string, today: string): string {
  const diff = daysBetween(mondayOf(calendarAnchor(today)), monday) / 7
  if (diff === 0) return "Denne uken"
  if (diff === 1) return "Neste uke"
  if (diff === -1) return "Forrige uke"
  return `Uke ${isoWeek(monday)}`
}
