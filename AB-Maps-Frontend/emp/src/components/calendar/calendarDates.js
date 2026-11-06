// Date helpers for the calendar. All dates are plain 'YYYY-MM-DD' strings in Europe/Oslo,
// the same day boundaries the backend uses. Arithmetic runs on UTC noon so DST never shifts a day.

const OSLO_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit',
});

const WEEKDAYS_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const WEEKDAYS_LONG = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august',
  'september', 'oktober', 'november', 'desember'];
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

export function osloToday(now = new Date()) {
  return OSLO_FMT.format(now);
}

function toDate(iso) {
  return new Date(`${iso}T12:00:00Z`);
}

function fromDate(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

export function mondayOf(iso) {
  const dow = toDate(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

export function weekdayShort(iso) {
  return WEEKDAYS_SHORT[toDate(iso).getUTCDay()];
}

/** «12.11» */
export function ddmm(iso) {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

/** «Tor 12.11» */
export function dayLabel(iso) {
  return `${weekdayShort(iso)} ${ddmm(iso)}`;
}

/** «torsdag 12. november» */
export function longLabel(iso) {
  const d = toDate(iso);
  return `${WEEKDAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

/** ISO-8601 week number («Uke 46»). */
export function isoWeek(iso) {
  const d = toDate(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/** «9.–15. nov» or «30. nov – 6. des» */
export function rangeLabel(fromIso, toIso) {
  const a = toDate(fromIso);
  const b = toDate(toIso);
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}.–${b.getUTCDate()}. ${MONTHS_SHORT[b.getUTCMonth()]}`;
  }
  return `${a.getUTCDate()}. ${MONTHS_SHORT[a.getUTCMonth()]} – ${b.getUTCDate()}. ${MONTHS_SHORT[b.getUTCMonth()]}`;
}
