import React, { useEffect, useRef } from 'react';
import './FloatingForbiddenAreaPopup.css';

const FloatingForbiddenAreaPopup = ({ position, onClose, title = 'Begrenset tilgang', message = 'Dette området ble ikke opprettet av deg.' }) => {
  const panelRef = useRef(null);

  // Centered modal with backdrop – fully DOM based
  useEffect(() => {
    const onDocClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (typeof onClose === 'function') onClose();
      }
    };
    document.addEventListener('mousedown', onDocClick, true);
    const onKey = (e) => { if (e.key === 'Escape') { if (typeof onClose === 'function') onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const stopAll = (e) => {
    if (!e) return;
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // Global capture-phase blockers while popup is mounted
  useEffect(() => {
    // Use capture blockers only for wheel/scroll/contextmenu to avoid preventing button clicks
    const events = ['contextmenu'];
    const blocker = (e) => {
      const t = e.target;
      const panel = panelRef.current;
      if (!panel) return;
      const isInsidePanel = panel.contains(t);
      const isBackdrop = t && t.classList && t.classList.contains('forbidden-backdrop');
      if (isInsidePanel || isBackdrop) {
        if (typeof e.preventDefault === 'function') {
          try { e.preventDefault(); } catch {}
        }
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (e && e.nativeEvent && e.nativeEvent.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
      }
    };
    events.forEach(evt => document.addEventListener(evt, blocker, { capture: true, passive: false }));
    return () => {
      events.forEach(evt => document.removeEventListener(evt, blocker, { capture: true }));
    };
  }, []);

  return (
    <>
      <div
        className="popup-backdrop forbidden-backdrop"
        onClick={onClose}
        onMouseDown={stopAll}
        onMouseUp={stopAll}
        onTouchStart={stopAll}
        onTouchEnd={stopAll}
        onContextMenu={(e) => { e.preventDefault(); stopAll(e); }}
      />
      <div
        ref={panelRef}
        className="floating-forbidden-popup"
        onClick={stopAll}
        onMouseDown={stopAll}
        onMouseUp={stopAll}
        onTouchStart={stopAll}
        onTouchEnd={stopAll}
        onPointerDown={stopAll}
        onPointerUp={stopAll}
        onContextMenu={(e) => { e.preventDefault(); stopAll(e); }}
        onWheel={stopAll}
        onScroll={stopAll}
      >
        <div className="ffp-header">
          <span>{title}</span>
          <button className="ffp-close" aria-label="Lukk" onClick={(e) => { stopAll(e); if (onClose) onClose(); }}>×</button>
        </div>
        <div className="ffp-body">
          <p>{message}</p>
        </div>
      </div>
    </>
  );
};

export default FloatingForbiddenAreaPopup;

