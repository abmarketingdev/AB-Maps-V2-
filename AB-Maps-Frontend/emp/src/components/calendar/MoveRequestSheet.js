import React, { useEffect, useMemo, useState } from 'react';
import { FaArrowRight, FaTimes, FaCalendarPlus } from 'react-icons/fa';
import Sheet from './Sheet';
import { addDays, dayLabel, longLabel } from './calendarDates';
import { cancelMoveRequest, createMoveRequest } from './calendarApi';
import { dorer, givere } from './DayCard';

const MAX_REASON = 300;
const MAX_DAYS_AHEAD = 56; // 8 weeks

/**
 * «Be om endring av arbeidsdag» for one planned day. Shows the form, or (when a request is
 * already waiting) its status with «Avbryt forespørsel».
 */
export default function MoveRequestSheet({ day, days, today, onClose, onChanged }) {
  const open = Boolean(day);
  const [toDate, setToDate] = useState('');
  const [other, setOther] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Keep the last day while the sheet animates out.
  const [shown, setShown] = useState(day);
  useEffect(() => {
    if (day) {
      setShown(day);
      setToDate(''); setOther(false); setReason(''); setError(''); setBusy(false); setConfirmCancel(false);
    }
  }, [day]);
  const d = day || shown;

  const workDates = useMemo(() => new Set(days.filter((x) => x.shiftId).map((x) => x.date)), [days]);
  const pendingTargets = useMemo(() => new Set(days
    .filter((x) => x.request && x.request.status === 'venter').map((x) => x.request.toDate)), [days]);
  const freeChoices = useMemo(() => days.filter((x) => x.date > today && !x.shiftId
    && !pendingTargets.has(x.date)), [days, today, pendingTargets]);

  const pending = d && d.request && d.request.status === 'venter' && d.request.fromDate === d.date ? d.request : null;
  const declined = d && d.request && d.request.status === 'avslått' && d.request.fromDate === d.date ? d.request : null;

  const minDate = addDays(today, 1);
  const maxDate = addDays(today, MAX_DAYS_AHEAD);
  const otherInvalid = other && toDate && (toDate < minDate || toDate > maxDate || workDates.has(toDate));

  const submit = async (e) => {
    e.preventDefault();
    if (!toDate || otherInvalid || busy) return;
    setBusy(true); setError('');
    try {
      await createMoveRequest({ shiftId: d.shiftId, fromDate: d.date, toDate, reason: reason.trim() });
      onChanged('Forespørselen er sendt til salgssjefen.');
    } catch (err) {
      setError(err.message || 'Kunne ikke sende forespørselen.');
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    setBusy(true); setError('');
    try {
      await cancelMoveRequest(pending.id);
      onChanged('Forespørselen er avbrutt.');
    } catch (err) {
      setError(err.message || 'Kunne ikke avbryte forespørselen.');
      setBusy(false);
    }
  };

  const header = (
    <div className="calx-head">
      <div className="calx-head__txt">
        <h2 id="calx-move-title" className="calx-h2">{pending ? 'Forespørsel sendt' : 'Be om endring av arbeidsdag'}</h2>
        {d ? <p className="calx-muted">{longLabel(d.date)}</p> : null}
      </div>
      <button type="button" className="calx-iconbtn" onClick={onClose} aria-label="Lukk">
        <FaTimes aria-hidden="true" />
      </button>
    </div>
  );

  let body = null;
  let footer = null;
  if (d && pending) {
    body = (
      <div className="calx-move">
        <div className="calx-fromto">
          <div className="calx-fromto__box">
            <span className="calx-fromto__k">Fra</span><strong>{dayLabel(pending.fromDate)}</strong>
          </div>
          <FaArrowRight className="calx-fromto__arrow" aria-hidden="true" />
          <div className="calx-fromto__box calx-fromto__box--to">
            <span className="calx-fromto__k">Til</span><strong>{dayLabel(pending.toDate)}</strong>
          </div>
        </div>
        <div className="calx-status calx-status--pending">
          <span className="calx-chip calx-chip--pending">Venter</span>
          <span>Salgssjefen din får forespørselen og svarer her.</span>
        </div>
        {pending.reason ? <div className="calx-quote"><span className="calx-fromto__k">Din grunn</span>{pending.reason}</div> : null}
        {error ? <div className="calx-alert" role="alert">{error}</div> : null}
      </div>
    );
    footer = (
      <>
        <button type="button" className="calx-btn calx-btn--ghost" onClick={onClose} disabled={busy}>Lukk</button>
        <button type="button" className="calx-btn calx-btn--danger" onClick={cancel} disabled={busy}>
          {busy ? 'Avbryter…' : confirmCancel ? 'Ja, avbryt forespørselen' : 'Avbryt forespørsel'}
        </button>
      </>
    );
  } else if (d) {
    body = (
      <form id="calx-move-form" className="calx-move" onSubmit={submit} noValidate>
        <div className="calx-summary">
          <span className="calx-summary__date">{dayLabel(d.date)}</span>
          <span className="calx-muted">
            {d.goals ? `Mål ${d.goals.doors ?? '–'} ${dorer(d.goals.doors)} · ${d.goals.givers ?? '–'} ${givere(d.goals.givers)}` : 'Planlagt arbeidsdag'}
          </span>
        </div>

        {declined ? (
          <div className="calx-status calx-status--declined">
            <span className="calx-chip calx-chip--declined">Avslått</span>
            <span>
              Forrige forespørsel (til {dayLabel(declined.toDate)}) ble avslått
              {declined.declineReason ? <>: «{declined.declineReason}»</> : '.'}
            </span>
          </div>
        ) : null}

        <fieldset className="calx-field">
          <legend className="calx-label">Ny dato</legend>
          {freeChoices.length ? (
            <div className="calx-choices" role="radiogroup" aria-label="Ledige dager">
              {freeChoices.map((x) => (
                <button key={x.date} type="button" role="radio" aria-checked={!other && toDate === x.date}
                  className={`calx-choice${!other && toDate === x.date ? ' is-on' : ''}`}
                  onClick={() => { setOther(false); setToDate(x.date); setError(''); }}>
                  {dayLabel(x.date)}
                </button>
              ))}
              <button type="button" role="radio" aria-checked={other}
                className={`calx-choice calx-choice--other${other ? ' is-on' : ''}`}
                onClick={() => { setOther(true); setToDate(''); setError(''); }}>
                <FaCalendarPlus aria-hidden="true" /> Annen dato
              </button>
            </div>
          ) : null}
          {(other || !freeChoices.length) ? (
            <div className="calx-dateinput">
              <input type="date" className="calx-input" min={minDate} max={maxDate} value={toDate}
                onChange={(e) => { setOther(true); setToDate(e.target.value); setError(''); }}
                aria-label="Velg dato" aria-invalid={otherInvalid || undefined} />
              <span className="calx-hint">
                {otherInvalid
                  ? (workDates.has(toDate) ? 'Du jobber allerede den dagen.' : 'Velg en dato fra i morgen og 8 uker frem.')
                  : 'Fra i morgen og inntil 8 uker frem.'}
              </span>
            </div>
          ) : null}
        </fieldset>

        <label className="calx-field">
          <span className="calx-label">Grunn <span className="calx-muted">(valgfritt)</span></span>
          <textarea className="calx-input calx-textarea" rows={3} maxLength={MAX_REASON} value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder="F.eks. legetime torsdag formiddag" />
          <span className="calx-hint calx-hint--right">{reason.length}/{MAX_REASON}</span>
        </label>

        {error ? <div className="calx-alert" role="alert">{error}</div> : null}
      </form>
    );
    footer = (
      <>
        <button type="button" className="calx-btn calx-btn--ghost" onClick={onClose} disabled={busy}>Avbryt</button>
        <button type="submit" form="calx-move-form" className="calx-btn calx-btn--primary"
          disabled={!toDate || otherInvalid || busy}>
          {busy ? 'Sender…' : toDate && !otherInvalid ? `Send · ${dayLabel(toDate)}` : 'Send forespørsel'}
        </button>
      </>
    );
  }

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} labelledBy="calx-move-title" size="auto"
      className="calx-panel--move" header={header} footer={footer}>
      {body}
    </Sheet>
  );
}
