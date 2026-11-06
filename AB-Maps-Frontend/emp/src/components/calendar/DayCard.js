import React from 'react';
import { FaBullseye, FaCheck, FaMoon, FaTimesCircle, FaSun } from 'react-icons/fa';
import { ddmm, weekdayShort, longLabel } from './calendarDates';

export const STATE_META = {
  no_show: { cls: 'noshow', label: 'Ikke møtt', Icon: FaTimesCircle },
  worked: { cls: 'worked', label: 'Arbeidet', Icon: FaCheck },
  today: { cls: 'today', label: 'I dag', Icon: FaSun },
  planned: { cls: 'planned', label: 'Planlagt', Icon: FaBullseye },
  off: { cls: 'off', label: 'Fri', Icon: FaMoon },
};

const fmtPct = (v) => `${(Math.round(v * 10) / 10).toLocaleString('nb-NO')} %`;
const fmtNum = (v) => (v === null || v === undefined ? '–' : String(v));
/** Norwegian singular/plural: exactly 1 → «dør»/«giver», everything else → «dører»/«givere». */
export const dorer = (n) => (n === 1 ? 'dør' : 'dører');
export const givere = (n) => (n === 1 ? 'giver' : 'givere');

/** Small status chip for a move request on a day. */
export function requestChip(day) {
  const r = day.request;
  if (!r || r.status === 'avbrutt') return null;
  const isTarget = r.toDate === day.date && r.fromDate !== day.date;
  if (r.status === 'venter') return { cls: 'pending', text: isTarget ? 'Ønsket hit' : 'Venter' };
  if (r.status === 'godkjent') return { cls: 'approved', text: isTarget ? 'Flyttet hit' : 'Flyttet' };
  if (r.status === 'avslått') return isTarget ? null : { cls: 'declined', text: 'Avslått' };
  return null;
}

/** Screen-reader sentence for a day. */
function describe(day, canMove) {
  const parts = [longLabel(day.date), STATE_META[day.state]?.label || ''];
  if (day.state === 'worked' && day.actual) parts.push(`${day.actual.doors} ${dorer(day.actual.doors)}, ${fmtPct(day.actual.jaPct)} ja`);
  if ((day.state === 'planned' || day.state === 'today') && day.goals) {
    parts.push(`mål ${fmtNum(day.goals.doors)} ${dorer(day.goals.doors)} og ${fmtNum(day.goals.givers)} ${givere(day.goals.givers)}`);
  }
  const chip = requestChip(day);
  if (chip) parts.push(chip.text);
  if (canMove) parts.push('trykk for å be om endring');
  return parts.filter(Boolean).join(', ');
}

function Body({ day }) {
  const { state, goals, actual } = day;
  if (state === 'no_show') {
    return <div className="calx-day__big calx-day__big--alert">IKKE MØTT</div>;
  }
  if (state === 'worked') {
    return (
      <>
        <div className="calx-day__metric"><strong>{actual ? actual.doors : 0}</strong></div>
        <div className="calx-day__unit">{dorer(actual ? actual.doors : 0)}</div>
        <div className="calx-day__sub">Ja {actual ? fmtPct(actual.jaPct) : '0 %'}</div>
      </>
    );
  }
  if (state === 'today') {
    if (!goals && !day.shiftId) return <div className="calx-day__off">Fri i dag</div>;
    if (!goals) {
      return (
        <>
          <div className="calx-day__metric"><strong>{actual ? actual.doors : 0}</strong></div>
          <div className="calx-day__unit">{dorer(actual ? actual.doors : 0)}</div>
          <div className="calx-day__sub">Ingen mål i dag</div>
        </>
      );
    }
    return (
      <>
        <div className="calx-day__metric"><strong>{actual ? actual.doors : 0}</strong><span>/ {fmtNum(goals.doors)}</span></div>
        <div className="calx-day__unit">{dorer(goals.doors)}</div>
        <div className="calx-day__sub">Mål {fmtNum(goals.givers)} {givere(goals.givers)}</div>
      </>
    );
  }
  if (state === 'planned') {
    if (!goals) return <div className="calx-day__sub">Mål ikke satt</div>;
    return (
      <>
        <div className="calx-day__goal">Mål <strong>{fmtNum(goals.doors)}</strong> {dorer(goals.doors)}</div>
        <div className="calx-day__goal">Mål <strong>{fmtNum(goals.givers)}</strong> {givere(goals.givers)}</div>
      </>
    );
  }
  return <div className="calx-day__off">Fri</div>;
}

export default function DayCard({ day, isToday, canMove, onSelect, index = 0 }) {
  const meta = STATE_META[day.state] || STATE_META.off;
  const chip = requestChip(day);
  const cls = `calx-day calx-day--${meta.cls}${isToday ? ' is-today' : ''}${canMove ? ' is-action' : ''}`;
  const content = (
    <>
      <div className="calx-day__head">
        <span className="calx-day__date">
          <span className="calx-day__wd">{weekdayShort(day.date)}</span> {ddmm(day.date)}
        </span>
        <meta.Icon className="calx-day__icon" aria-hidden="true" />
      </div>
      <div className="calx-day__body"><Body day={day} /></div>
      <div className="calx-day__foot">
        {chip ? <span className={`calx-chip calx-chip--${chip.cls}`}>{chip.text}</span> : null}
      </div>
    </>
  );
  const style = { '--i': index };
  if (canMove) {
    return (
      <button type="button" className={cls} style={style} onClick={() => onSelect(day)}
        aria-label={describe(day, true)} data-date={day.date}>
        {content}
      </button>
    );
  }
  return (
    <div className={cls} style={style} aria-label={describe(day, false)} data-date={day.date}>
      {content}
    </div>
  );
}
