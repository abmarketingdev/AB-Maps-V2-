// Bottom sheet on phones, centred dialog from 768 px. Portal to <body> (outside the Leaflet
// container, so map gestures never see these events), focus trapped, Esc closes the top-most
// sheet only, drag the grabber down to dismiss, prefers-reduced-motion respected.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ANIM_MS = 220;
const stack = [];

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sheet({ open, onClose, labelledBy, size = 'full', className = '', header, children, footer }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef(null);
  const idRef = useRef(Symbol('sheet'));
  const returnFocus = useRef(null);
  const drag = useRef(null);
  const [dragY, setDragY] = useState(0);

  // mount → next frame add the visible class (so the transition runs); close → animate out → unmount
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), reducedMotion() ? 0 : ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted) return undefined;
    const id = idRef.current;
    stack.push(id);
    returnFocus.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel && panel.querySelector('[data-autofocus]');
    (first || panel)?.focus({ preventScroll: true });
    return () => {
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      const el = returnFocus.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, [mounted]);

  const onKeyDown = useCallback((e) => {
    if (stack[stack.length - 1] !== idRef.current) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE))
      .filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!nodes.length) { e.preventDefault(); return; }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }, [onClose]);

  // Drag-to-dismiss, grabber/header only (so scrolling the content never closes the sheet).
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button, a, input, textarea')) return;
    if (window.matchMedia('(min-width: 768px)').matches) return;
    drag.current = { y: e.clientY, t: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onPointerUp = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    const v = dy / Math.max(1, performance.now() - drag.current.t);
    drag.current = null;
    setDragY(0);
    if (dy > 120 || (dy > 40 && v > 0.6)) onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`calx-root${shown ? ' is-shown' : ''}`}
      onKeyDown={onKeyDown}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="calx-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        className={`calx-panel calx-panel--${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="calx-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="calx-grabber" aria-hidden="true" />
          {header}
        </div>
        <div className="calx-body">{children}</div>
        {footer ? <div className="calx-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
