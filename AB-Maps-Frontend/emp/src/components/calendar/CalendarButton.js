// «Kalender» entry point on the map. Small and eager; the calendar itself is a lazy chunk.
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import { getWeek } from './calendarApi';
import { osloToday } from './calendarDates';
import './CalendarButton.css';

const loadSheet = () => import(/* webpackChunkName: "kalender" */ './CalendarSheet');
const CalendarSheet = lazy(loadSheet);
const REFRESH_MS = 5 * 60 * 1000;

function badgeFor(day) {
  if (!day || !day.goals || day.state === 'no_show' || day.state === 'off') return null;
  if (day.goals.doors === null || day.goals.doors === undefined) return null;
  return `Mål ${day.goals.doors}`;
}

export default function CalendarButton() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [badge, setBadge] = useState(null);

  const refreshBadge = useCallback(async () => {
    try {
      const t = osloToday();
      const { days } = await getWeek(t, 1);
      setBadge(badgeFor(days.find((d) => d.date === t)));
    } catch (_) { /* silent: the button still works */ }
  }, []);

  useEffect(() => {
    refreshBadge();
    const id = setInterval(() => { if (!document.hidden) refreshBadge(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshBadge]);

  const onLoaded = useCallback((days) => {
    const t = osloToday();
    setBadge(badgeFor(days.find((d) => d.date === t)));
  }, []);

  const openSheet = () => { setEverOpened(true); setOpen(true); };

  return (
    <>
      <button
        type="button"
        className={`calx-fab${open ? ' is-open' : ''}`}
        onClick={openSheet}
        onPointerEnter={loadSheet}
        onTouchStart={loadSheet}
        aria-haspopup="dialog"
        aria-label={badge ? `Kalender, ${badge.toLowerCase()} dører i dag` : 'Kalender'}
      >
        <FaCalendarAlt className="calx-fab__icon" aria-hidden="true" />
        <span className="calx-fab__label">Kalender</span>
        {badge ? <span className="calx-fab__badge">{badge}</span> : null}
      </button>
      {everOpened ? (
        <Suspense fallback={<div className="calx-fab-loading" role="status" aria-label="Laster kalender"><span /></div>}>
          <CalendarSheet open={open} onClose={() => setOpen(false)} onLoaded={onLoaded} />
        </Suspense>
      ) : null}
    </>
  );
}
