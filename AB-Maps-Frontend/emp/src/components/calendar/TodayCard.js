import React from 'react';
import { longLabel, dayLabel } from './calendarDates';
import { dorer, givere } from './DayCard';

const R = 30;
const C = 2 * Math.PI * R;
const fmtPct = (v) => `${(Math.round(v * 10) / 10).toLocaleString('nb-NO')} %`;

function Ring({ value, goal, tone }) {
  const ratio = goal ? Math.min(1, value / goal) : 0;
  return (
    <svg className={`calx-ring calx-ring--${tone}`} viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
      <circle cx="36" cy="36" r={R} className="calx-ring__track" />
      <circle cx="36" cy="36" r={R} className="calx-ring__bar"
        strokeDasharray={C} strokeDashoffset={C * (1 - ratio)} transform="rotate(-90 36 36)" />
      <text x="36" y="36" textAnchor="middle" dominantBaseline="central" className="calx-ring__txt">
        {goal ? `${Math.round(ratio * 100)}%` : '–'}
      </text>
    </svg>
  );
}

function Bar({ value, goal }) {
  const ratio = goal ? Math.min(1, value / goal) : 0;
  return (
    <div className="calx-bar" role="presentation">
      <span style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}

/** Today at a glance: goal vs actual so far. */
export default function TodayCard({ day, nextWork }) {
  if (!day) return null;
  const head = (
    <div className="calx-today__label">
      <span className="calx-dot" aria-hidden="true" />I dag · {longLabel(day.date)}
    </div>
  );

  if (day.state === 'no_show') {
    return (
      <div className="calx-today calx-today--noshow">
        {head}
        <div className="calx-today__title">Registrert som ikke møtt</div>
        <p className="calx-today__text">Ta kontakt med salgssjefen din hvis dette er feil.</p>
      </div>
    );
  }

  if (day.state === 'off' || (!day.goals && !day.shiftId)) {
    return (
      <div className="calx-today calx-today--off">
        {head}
        <div className="calx-today__title">Du har fri i dag</div>
        <p className="calx-today__text">
          {nextWork
            ? <>Neste arbeidsdag: <strong>{dayLabel(nextWork.date)}</strong>{nextWork.goals ? ` · Mål ${nextWork.goals.doors ?? '–'} ${dorer(nextWork.goals.doors)}` : ''}</>
            : 'Ingen planlagte arbeidsdager de neste to ukene.'}
        </p>
      </div>
    );
  }

  const a = day.actual || { doors: 0, ja: 0, jaPct: 0 };
  const g = day.goals || {};
  return (
    <div className="calx-today calx-today--work">
      {head}
      <div className="calx-today__grid">
        <Ring value={a.doors} goal={g.doors} tone="doors" />
        <div className="calx-today__stats">
          <div className="calx-stat">
            <div className="calx-stat__row">
              <span className="calx-stat__k">Dører</span>
              <span className="calx-stat__v"><strong>{a.doors}</strong> / {g.doors ?? '–'}</span>
            </div>
            <Bar value={a.doors} goal={g.doors} />
          </div>
          <div className="calx-stat">
            <div className="calx-stat__row">
              <span className="calx-stat__k">Ja · {fmtPct(a.jaPct)}</span>
              <span className="calx-stat__v"><strong>{a.ja}</strong> / {g.givers ?? '–'} {givere(g.givers)}</span>
            </div>
            <Bar value={a.ja} goal={g.givers} />
          </div>
        </div>
      </div>
    </div>
  );
}
