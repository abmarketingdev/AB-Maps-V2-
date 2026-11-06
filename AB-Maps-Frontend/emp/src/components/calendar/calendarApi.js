// The only file that knows E1's /api/scheduling/ contract. The UI works on the normalised
// shapes below; if the backend contract changes, only this file changes.
//
// Day      { date, state: 'no_show'|'worked'|'today'|'planned'|'off', shiftId,
//            goals: { doors, givers } | null, actual: { doors, ja, jaPct } | null,
//            request: Request | null }
// Request  { id, status: 'venter'|'godkjent'|'avslått'|'avbrutt', fromDate, toDate,
//            reason, declineReason, createdAt, decidedAt }
import { fetchWithAuthRefresh } from '../../utils/apiInterceptor';
import { API_CONFIG } from '../../config/apiConfig';

// Same base as every other emp maps call (API_CONFIG.backend.baseUrl, fallback like useMapState):
// never a relative /api/ (on maps.abmarketing.no that reaches the dashboard).
const BASE = `${API_CONFIG.backend.baseUrl || process.env.REACT_APP_API_BASE_URL || ''}/api/scheduling`;

// Dev-only mock (REACT_APP_CAL_MOCK=1 at build time). The condition is a literal after
// DefinePlugin, so the production build drops the branch and never emits the mock chunk.
function loadMock() {
  if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_CAL_MOCK === '1') {
    return import('./mockCalendar');
  }
  return null;
}

export class CalendarError extends Error {
  constructor(message, { status = 0, code = '', offline = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.offline = offline;
  }
}

// Fallbacks only: the backend sends a Norwegian `detail` with every error (E1 contract).
const MESSAGES = {
  date_taken: 'Du har allerede en arbeidsdag den datoen.',
  to_date_past: 'Velg en dato fra i morgen.',
  to_date_too_far: 'Du kan ikke flytte mer enn 8 uker frem.',
  same_date: 'Velg en annen dato enn dagen du flytter fra.',
  past_shift: 'Denne arbeidsdagen kan ikke flyttes lenger.',
  already_pending: 'Du har allerede en forespørsel som venter for denne dagen.',
  not_own_shift: 'Du kan bare flytte dine egne arbeidsdager.',
  not_pending: 'Forespørselen er allerede behandlet.',
};

// fetchWithAuthRefresh throws `API call failed: <status> - <body>` for non-2xx answers.
function toCalendarError(err) {
  if (err instanceof CalendarError) return err;
  const text = String((err && err.message) || '');
  const m = text.match(/^API call failed: (\d+) - ([\s\S]*)$/);
  if (m) {
    const status = Number(m[1]);
    let body = null;
    try { body = JSON.parse(m[2]); } catch (_) { /* not JSON */ }
    const code = (body && (body.code || body.error)) || '';
    let msg = (body && typeof body.detail === 'string' && body.detail) || MESSAGES[code] || (body && body.message);
    if (!msg && body && typeof body === 'object') {
      const first = Object.values(body).flat().find((v) => typeof v === 'string');
      if (first) msg = first;
    }
    if (!msg) {
      if (status === 403) msg = 'Du har ikke tilgang til kalenderen.';
      else if (status === 404) msg = 'Fant ikke kalenderen din.';
      else if (status >= 500) msg = 'Serverfeil. Prøv igjen om litt.';
      else msg = 'Noe gikk galt. Prøv igjen.';
    }
    return new CalendarError(msg, { status, code });
  }
  if (/No access token|Token refresh failed/.test(text)) {
    return new CalendarError('Økten er utløpt. Logg inn på nytt.', { status: 401 });
  }
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return new CalendarError(
    offline ? 'Du er frakoblet. Koble til internett og prøv igjen.' : 'Fikk ikke kontakt med serveren.',
    { offline: true },
  );
}

async function call(path, options = {}) {
  try {
    const res = await fetchWithAuthRefresh(`${BASE}${path}`, {
      ...options,
      headers: { accept: 'application/json', ...(options.headers || {}) },
    });
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    throw toCalendarError(err);
  }
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function normaliseRequest(r) {
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    fromDate: r.from_date || r.fromDate,
    toDate: r.to_date || r.toDate,
    reason: r.reason || '',
    declineReason: r.decline_reason || r.declineReason || '',
    createdAt: r.requested_at || r.created_at || null,
    decidedAt: r.decided_at || null,
  };
}

function normaliseDay(d) {
  const g = d.goals || {};
  const goalDoors = num(g.doors ?? d.goal_doors);
  const goalGivers = num(g.givers ?? d.goal_givers);
  const a = d.actual || null;
  let actual = null;
  if (a) {
    const doors = num(a.doors) || 0;
    const ja = num(a.ja) || 0;
    const jaPct = a.ja_pct !== undefined && a.ja_pct !== null
      ? Number(a.ja_pct)
      : (doors ? (ja / doors) * 100 : 0);
    actual = { doors, ja, jaPct };
  }
  return {
    date: d.date,
    state: d.state,
    shiftId: d.shift_id ?? d.shiftId ?? (d.shift && d.shift.id) ?? null,
    goals: goalDoors === null && goalGivers === null ? null : { doors: goalDoors, givers: goalGivers },
    actual,
    request: normaliseRequest(d.move_request || d.pending_move_request || d.request || null),
  };
}

/** `days` days from `from` for the logged-in person: { days, person, today }. */
export async function getWeek(from, days = 14) {
  const mock = loadMock();
  if (mock) return (await mock).getWeek(from, days);
  const data = await call(`/week/?from=${from}&days=${days}`);
  const list = Array.isArray(data) ? data : (data && data.days) || [];
  return {
    days: list.map(normaliseDay),
    // null = account without an employee/manager id (no calendar)
    person: data && !Array.isArray(data) ? data.person || null : null,
    today: (data && data.today) || null,
  };
}

/** Own move requests (newest first). Returns null when the backend has no list endpoint. */
export async function listMyRequests() {
  const mock = loadMock();
  if (mock) return (await mock).listMyRequests();
  try {
    const data = await call('/move-requests/?mine=1');
    const list = Array.isArray(data) ? data : (data && data.results) || [];
    return list.map(normaliseRequest);
  } catch (err) {
    if (err.status === 404 || err.status === 405) return null;
    throw err;
  }
}

export async function createMoveRequest({ shiftId, fromDate, toDate, reason }) {
  const mock = loadMock();
  if (mock) return (await mock).createMoveRequest({ shiftId, fromDate, toDate, reason });
  const data = await call('/move-requests/', {
    method: 'POST',
    body: JSON.stringify({ shift_id: shiftId, to_date: toDate, reason: reason || '' }),
  });
  return normaliseRequest(data);
}

export async function cancelMoveRequest(id) {
  const mock = loadMock();
  if (mock) return (await mock).cancelMoveRequest(id);
  const data = await call(`/move-requests/${id}/cancel/`, { method: 'POST', body: '{}' });
  return normaliseRequest(data);
}
