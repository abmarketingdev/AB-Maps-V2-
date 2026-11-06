import React, { useEffect, useRef } from 'react';
import DayCard from './DayCard';

/** One week: 7 cards. Phone: horizontal scroll-snap row; desktop: 7-column grid. */
export default function WeekRow({ id, title, sub, days, today, canMove, onSelect, offset = 0 }) {
  const ref = useRef(null);

  // Bring today into view on phones (horizontal only: never scroll the sheet itself).
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const el = row.querySelector('.is-today');
    if (!el || row.scrollWidth <= row.clientWidth) return;
    const li = el.closest('li');
    row.scrollLeft = Math.max(0, li.offsetLeft - row.offsetLeft - 16);
  }, [days, today]);

  return (
    <section className="calx-weeksec" aria-labelledby={id}>
      <div className="calx-weeksec__head">
        <h3 id={id} className="calx-h3">{title}</h3>
        {sub ? <span className="calx-muted">{sub}</span> : null}
      </div>
      <ol className="calx-week" ref={ref}>
        {days.map((d, i) => (
          <li key={d.date} className="calx-week__cell">
            <DayCard day={d} isToday={d.date === today} canMove={canMove(d)} onSelect={onSelect} index={offset + i} />
          </li>
        ))}
      </ol>
    </section>
  );
}
