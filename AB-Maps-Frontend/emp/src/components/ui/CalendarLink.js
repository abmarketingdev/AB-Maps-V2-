// «Kalender» on the map: opens the promoter's own calendar in the dashboard (Min kalender).
// The calendar itself lives in the dashboard since 08.11; this is only the way there.
import React from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import './CalendarLink.css';

export default function CalendarLink() {
  return (
    <a className="calx-link" href={`${window.location.origin}/employee/kalender`} aria-label="Kalender, åpner din kalender">
      <FaCalendarAlt className="calx-link__icon" aria-hidden="true" />
      <span>Kalender</span>
    </a>
  );
}
