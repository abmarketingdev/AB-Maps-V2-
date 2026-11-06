// Lazy chunk: the whole calendar UI. Loaded the first time the promoter opens «Kalender».
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCalendarAlt, FaExclamationTriangle, FaSyncAlt, FaTimes, FaWifi, FaArrowRight } from 'react-icons/fa';
import Sheet from './Sheet';
import WeekRow from './WeekRow';
import TodayCard from './TodayCard';
import MoveRequestSheet from './MoveRequestSheet';
import { STATE_META } from './DayCard';
import { addDays, dayLabel, isoWeek, mondayOf, osloToday, rangeLabel } from './calendarDates';
import { getWeek, listMyRequests } from './calendarApi';
import './Calendar.css';

const STATUS_TEXT = { venter: 'Venter', godkjent: 'Godkjent', avslått: 'Avslått', avbrutt: 'Avbrutt' };
const STATUS_CLS = { venter: 'pending', godkjent: 'approved', avslått: 'declined', avbrutt: 'muted' };

function Skeleton() {
  return (
    <div className="calx-skel" aria-hidden="true">
      <div className="calx-skel__today" />
      {[0, 1].map((w) => (
        <div key={w} className="calx-weeksec">
          <div className="calx-skel__title" />
          <ol className="calx-week">
            {Array.from({ length: 7 }).map((_, i) => <li key={i} className="calx-week__cell"><div className="calx-skel__day" /></li>)}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <ul className="calx-legend" aria-label="Forklaring">
      {['no_show', 'worked', 'today', 'planned', 'off'].map((k) => {
        const m = STATE_META[k];
        return (
          <li key={k} className={`calx-legend__item calx-legend__item--${m.cls}`}>
            <m.Icon aria-hidden="true" />{m.label}
          </li>
        );
      })}
    </ul>
  );
}

function Requests({ list }) {
  if (!list || !list.length) return null;
  return (
    <section className="calx-reqs" aria-labelledby="calx-reqs-title">
      <h3 id="calx-reqs-title" className="calx-h3">Mine forespørsler</h3>
      <ul className="calx-reqs__list">
        {list.slice(0, 6).map((r) => (
          <li key={r.id} className="calx-req">
            <div className="calx-req__dates">
              <span>{dayLabel(r.fromDate)}</span>
              <FaArrowRight aria-hidden="true" />
              <span>{dayLabel(r.toDate)}</span>
              <span className={`calx-chip calx-chip--${STATUS_CLS[r.status] || 'muted'}`}>{STATUS_TEXT[r.status] || r.status}</span>
            </div>
            {r.status === 'avslått' && r.declineReason ? <p className="calx-req__note">Grunn: {r.declineReason}</p> : null}
            {r.status !== 'avslått' && r.reason ? <p className="calx-req__note calx-muted">«{r.reason}»</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CalendarSheet({ open, onClose, onLoaded }) {
  const [today, setToday] = useState(osloToday());
  const monday = mondayOf(today);
  const [days, setDays] = useState(null);
  const [requests, setRequests] = useState(null);
  const [noPerson, setNoPerson] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [moveDay, setMoveDay] = useState(null);
  const [notice, setNotice] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    const t = osloToday();
    setToday(t);
    setLoading(true);
    setError(null);
    try {
      const [week, reqs] = await Promise.all([
        getWeek(mondayOf(t), 14),
        listMyRequests().catch(() => null),
      ]);
      if (my !== seq.current) return;
      if (week.today && week.today !== t) setToday(week.today);
      setNoPerson(!week.person);
      setDays(week.days);
      setRequests(reqs);
      if (onLoaded) onLoaded(week.days);
    } catch (err) {
      if (my !== seq.current) return;
      setError(err);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [onLoaded]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const week1 = useMemo(() => (days ? days.filter((d) => d.date < addDays(monday, 7)) : []), [days, monday]);
  const week2 = useMemo(() => (days ? days.filter((d) => d.date >= addDays(monday, 7)) : []), [days, monday]);
  const todayDay = days && days.find((d) => d.date === today);
  const nextWork = days && days.find((d) => d.date > today && d.shiftId);

  const canMove = useCallback((d) => d.state === 'planned' && d.date > today && Boolean(d.shiftId), [today]);

  const header = (
    <div className="calx-head">
      <div className="calx-head__txt">
        <h2 id="calx-title" className="calx-h2">Kalender</h2>
        <p className="calx-muted">Uke {isoWeek(monday)}–{isoWeek(addDays(monday, 7))} · {rangeLabel(monday, addDays(monday, 13))}</p>
      </div>
      <button type="button" className={`calx-iconbtn${loading ? ' is-spinning' : ''}`} onClick={load}
        aria-label="Oppdater" disabled={loading}>
        <FaSyncAlt aria-hidden="true" />
      </button>
      <button type="button" className="calx-iconbtn" onClick={onClose} aria-label="Lukk kalender" data-autofocus>
        <FaTimes aria-hidden="true" />
      </button>
    </div>
  );

  let content;
  if (error && !days) {
    content = (
      <div className="calx-empty" role="alert">
        <div className={`calx-empty__icon${error.offline ? '' : ' calx-empty__icon--err'}`}>
          {error.offline ? <FaWifi aria-hidden="true" /> : <FaExclamationTriangle aria-hidden="true" />}
        </div>
        <h3 className="calx-h3">{error.offline ? 'Ingen nettforbindelse' : 'Kunne ikke hente kalenderen'}</h3>
        <p className="calx-muted">{error.message}</p>
        <button type="button" className="calx-btn calx-btn--primary" onClick={load}>Prøv igjen</button>
      </div>
    );
  } else if (!days) {
    content = <Skeleton />;
  } else if (noPerson) {
    content = (
      <div className="calx-empty">
        <div className="calx-empty__icon"><FaCalendarAlt aria-hidden="true" /></div>
        <h3 className="calx-h3">Ingen kalender ennå</h3>
        <p className="calx-muted">Kontoen din er ikke koblet til en ansatt. Ta kontakt med salgssjefen din.</p>
      </div>
    );
  } else {
    content = (
      <>
        {error ? (
          <div className="calx-alert calx-alert--inline" role="status">
            <FaExclamationTriangle aria-hidden="true" /> Viser sist hentede data. {error.message}
          </div>
        ) : null}
        <TodayCard day={todayDay} nextWork={nextWork} />
        <WeekRow id="calx-w1" title="Denne uken" sub={`Uke ${isoWeek(monday)}`} days={week1} today={today}
          canMove={canMove} onSelect={setMoveDay} />
        <WeekRow id="calx-w2" title="Neste uke" sub={`Uke ${isoWeek(addDays(monday, 7))}`} days={week2} today={today}
          canMove={canMove} onSelect={setMoveDay} offset={7} />
        <p className="calx-tip">Trykk på en blå dag for å be om å flytte den.</p>
        <Legend />
        <Requests list={requests} />
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} labelledBy="calx-title" className="calx-panel--main" header={header}>
        {content}
        <div className={`calx-toast${notice ? ' is-on' : ''}`} role="status" aria-live="polite">{notice}</div>
      </Sheet>
      <MoveRequestSheet
        day={moveDay}
        days={days || []}
        today={today}
        onClose={() => setMoveDay(null)}
        onChanged={(msg) => { setMoveDay(null); setNotice(msg); load(); }}
      />
    </>
  );
}
