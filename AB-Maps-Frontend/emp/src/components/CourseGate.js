/**
 * Course gate (Dana 05.11): an admin can require a person to finish a course before they may
 * use the map. Maps answers every API call from such a person with
 * 403 {"code":"course_required","sections":[{id,title}]}; Learning exposes the same state at
 * /api/learning/me/assignments/. This wrapper shows a full-screen notice instead of the map.
 *
 * - On start it asks Learning once (after a token is available).
 * - It wraps window.fetch once: any 403 with code "course_required" switches to the notice.
 * Any error → the map loads as normal (fail open). Admins are never blocked by the backend.
 */
import React, { useCallback, useEffect, useState } from 'react';

const EVENT = 'ab:course-required';
let fetchWrapped = false;

function wrapFetch() {
  if (fetchWrapped || typeof window === 'undefined' || !window.fetch) return;
  fetchWrapped = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await original(...args);
    if (res && res.status === 403) {
      try {
        const body = await res.clone().json();
        if (body && body.code === 'course_required') {
          window.dispatchEvent(new CustomEvent(EVENT, { detail: body.sections || [] }));
        }
      } catch (_) { /* not JSON: not ours */ }
    }
    return res;
  };
}

// Install at import time (index.js imports this before rendering): App's own effects run
// before a parent's useEffect, so wrapping later would miss the first API calls.
wrapFetch();

function quoteList(sections) {
  const names = sections.map((s) => `«${s.title}»`);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}`;
}

async function askLearning(baseUrl, token) {
  const res = await fetch(`${baseUrl || ''}/api/learning/me/assignments/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export default function CourseGate({ getToken, baseUrl, children }) {
  const [sections, setSections] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const onBlocked = (e) => setSections(Array.isArray(e.detail) ? e.detail : []);
    window.addEventListener(EVENT, onBlocked);

    // The token may arrive via the URL a moment after mount: try for ~10 s.
    let tries = 0;
    let stopped = false;
    const timer = setInterval(async () => {
      tries += 1;
      let token = null;
      try { token = getToken(); } catch (_) { token = null; }
      if (!token && tries < 20) return;
      clearInterval(timer);
      if (!token || stopped) return;
      try {
        const state = await askLearning(baseUrl, token);
        if (!stopped && state && state.blocked) setSections(state.sections || []);
      } catch (_) { /* fail open */ }
    }, 500);

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener(EVENT, onBlocked);
    };
  }, [getToken, baseUrl]);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const state = await askLearning(baseUrl, getToken());
      if (state && !state.blocked) {
        window.location.reload();
        return;
      }
      if (state) setSections(state.sections || []);
    } catch (_) { /* keep the notice */ }
    setChecking(false);
  }, [baseUrl, getToken]);

  if (sections === null) return children;

  const first = sections[0];
  const courseUrl = first ? `${window.location.origin}/learning-platform/${first.id}` : `${window.location.origin}/learning-platform`;
  const title = sections.length > 1 ? 'kursene' : 'kurset';

  return (
    <div style={S.backdrop} role="alertdialog" aria-modal="true" aria-labelledby="course-gate-title">
      <div style={S.card}>
        <div style={S.icon} aria-hidden="true">📚</div>
        <h1 id="course-gate-title" style={S.h1}>Kurs må fullføres</h1>
        <p style={S.p}>
          Du må fullføre {title} {sections.length ? <strong>{quoteList(sections)}</strong> : 'som er tildelt deg'} før du kan bruke kartet.
        </p>
        <a href={courseUrl} style={S.primary}>Gå til kurset</a>
        <button type="button" onClick={recheck} disabled={checking} style={S.secondary}>
          {checking ? 'Sjekker …' : 'Jeg er ferdig, sjekk igjen'}
        </button>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 16, background: '#F4F5F7',
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  card: {
    width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #D5D9E0', borderRadius: 12,
    padding: '28px 24px', textAlign: 'center', boxShadow: '0 8px 24px rgba(16,24,40,0.08)',
  },
  icon: { fontSize: 40, lineHeight: 1, marginBottom: 12 },
  h1: { fontSize: 20, fontWeight: 600, color: '#101828', margin: '0 0 8px' },
  p: { fontSize: 15, lineHeight: 1.5, color: '#475467', margin: '0 0 20px' },
  primary: {
    display: 'block', height: 44, lineHeight: '44px', borderRadius: 8, background: '#1D4ED8',
    color: '#fff', fontWeight: 600, fontSize: 15, textDecoration: 'none', marginBottom: 10,
  },
  secondary: {
    display: 'block', width: '100%', height: 44, borderRadius: 8, background: '#fff',
    border: '1px solid #D5D9E0', color: '#344054', fontWeight: 500, fontSize: 15, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
