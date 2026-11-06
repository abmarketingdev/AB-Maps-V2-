// Dev-only mock of the scheduling API (loaded only when REACT_APP_CAL_MOCK=1).
// Scenario via ?calmock=<name>: default | error | offline | dayoff | noshow | slow | empty | decided
import { addDays, mondayOf, osloToday } from './calendarDates';

const scenario = () => new URLSearchParams(window.location.search).get('calmock') || 'default';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let requests = null;
let nextId = 100;
let shifts = null; // date -> { id, goals, noShow }

function seed() {
  if (shifts) return;
  const s = scenario();
  const today = osloToday();
  const monday = mondayOf(today);
  shifts = {};
  for (let i = 0; i < 14; i += 1) {
    const date = addDays(monday, i);
    const dow = i % 7;
    if (dow >= 5) continue; // weekend off
    if (s === 'dayoff' && date === today) continue;
    if (i === 9) continue; // a weekday off next week
    shifts[date] = {
      id: 500 + i,
      goals: { doors: i === 8 ? 60 : 40, givers: i === 8 ? 8 : 5 },
      noShow: (i === 1) || (s === 'noshow' && date === today),
    };
  }
  requests = [];
  const future = Object.keys(shifts).filter((d) => d > today).sort();
  if (s !== 'empty' && future.length >= 3) {
    requests.push({ id: 11, status: 'venter', from_date: future[1], to_date: addDays(monday, 12), reason: 'Legetime på formiddagen', decline_reason: '', created_at: `${today}T08:12:00Z` });
    requests.push({ id: 10, status: 'avslått', from_date: future[2], to_date: addDays(monday, 13), reason: 'Bursdag', decline_reason: 'Vi trenger hele teamet på stand den dagen.', created_at: `${addDays(today, -2)}T10:00:00Z`, decided_at: `${addDays(today, -1)}T09:00:00Z` });
  }
  if (s === 'decided' || s === 'default') {
    requests.push({ id: 9, status: 'godkjent', from_date: addDays(monday, -2), to_date: addDays(monday, 9), reason: 'Bytte med Ola', decline_reason: '', created_at: `${addDays(today, -4)}T10:00:00Z`, decided_at: `${addDays(today, -3)}T09:00:00Z` });
    if (shifts[addDays(monday, 9)] === undefined) {
      shifts[addDays(monday, 9)] = { id: 599, goals: { doors: 40, givers: 5 }, noShow: false };
    }
  }
}

function actualFor(date) {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) % 997;
  const doors = 28 + (h % 30);
  const ja = 2 + (h % 7);
  return { doors, ja, ja_pct: Math.round((ja / doors) * 1000) / 10 };
}

export async function getWeek(from, days = 14) {
  const s = scenario();
  await wait(s === 'slow' ? 60000 : 450);
  if (s === 'error') throw Object.assign(new Error('Serverfeil. Prøv igjen om litt.'), { status: 500 });
  if (s === 'offline') throw Object.assign(new Error('Du er frakoblet. Koble til internett og prøv igjen.'), { offline: true });
  seed();
  const today = osloToday();
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(from, i);
    const sh = shifts[date];
    let state = 'off';
    if (date === today) state = sh && sh.noShow ? 'no_show' : 'today';
    else if (sh && date < today) state = sh.noShow ? 'no_show' : 'worked';
    else if (sh) state = 'planned';
    const req = requests.find((r) => r.from_date === date && r.status === 'venter')
      || requests.find((r) => (r.from_date === date || r.to_date === date) && r.status !== 'avbrutt');
    let actual = null;
    if (date < today && sh && !sh.noShow) actual = actualFor(date);
    if (date === today) actual = sh ? { doors: 14, ja: 2, ja_pct: 14.3 } : { doors: 0, ja: 0, ja_pct: 0 };
    out.push({
      date,
      state,
      shift_id: sh ? sh.id : null,
      goals: sh ? sh.goals : null,
      actual,
      move_request: req || null,
    });
  }
  return { days: out.map((d) => ({
    date: d.date,
    state: d.state,
    shiftId: d.shift_id,
    goals: d.goals,
    actual: d.actual ? { doors: d.actual.doors, ja: d.actual.ja, jaPct: d.actual.ja_pct } : null,
    request: d.move_request ? norm(d.move_request) : null,
  })) };
}

function norm(r) {
  return {
    id: r.id, status: r.status, fromDate: r.from_date, toDate: r.to_date, reason: r.reason,
    declineReason: r.decline_reason, createdAt: r.created_at, decidedAt: r.decided_at || null,
  };
}

export async function listMyRequests() {
  await wait(200);
  seed();
  return requests.filter((r) => r.status !== 'avbrutt').map(norm);
}

export async function createMoveRequest({ fromDate, toDate, reason }) {
  await wait(600);
  seed();
  if (shifts[toDate]) {
    throw Object.assign(new Error('Du har allerede en arbeidsdag den datoen.'), { status: 409, code: 'date_taken' });
  }
  const r = { id: nextId += 1, status: 'venter', from_date: fromDate, to_date: toDate, reason, decline_reason: '', created_at: new Date().toISOString() };
  requests.unshift(r);
  return norm(r);
}

export async function cancelMoveRequest(id) {
  await wait(400);
  const r = requests.find((x) => x.id === id);
  if (r) r.status = 'avbrutt';
  return r ? norm(r) : null;
}
