import { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * Robust long-press hook using Pointer Events (iOS/Android/Web), capture phase.
 * @param {L.Map|null|undefined} map
 * @param {{ onLongPress: (latlng: L.LatLng, rawEvent: PointerEvent) => void, thresholdMs?: number, moveTolerancePx?: number }} opts
 */
export default function useMapLongPress(map, opts) {
  const { onLongPress, thresholdMs = 650, moveTolerancePx = 12, shouldArm } = opts || {};

  const timerRef = useRef(null);
  const startRef = useRef(null);
  const pointersRef = useRef(0);
  const firedRef = useRef(false);

  const interactingRef = useRef(false);
  const suppressUntilRef = useRef(0);

  const clear = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    firedRef.current = false;
    startRef.current = null;
    pointersRef.current = 0;
  };

  const suppressLongPress = (ms) => {
    suppressUntilRef.current = Math.max(suppressUntilRef.current, Date.now() + (ms || 0));
    clear();
  };

  useEffect(() => {
    if (!map || typeof onLongPress !== 'function') return;
    const container = map.getContainer();

    const toLatLng = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      const pt = L.point(clientX - rect.left, clientY - rect.top);
      return map.containerPointToLatLng(pt);
    };

    const isFromUI = (el) => {
      let n = el;
      while (n) {
        if (
          n?.classList?.contains('leaflet-control') ||
          n?.classList?.contains('map-ui-control') ||
          n?.classList?.contains('leaflet-popup') ||
          n?.dataset?.noLongPress === 'true'
        ) return true;
        n = n.parentElement;
      }
      return false;
    };

    const onPointerDown = (e) => {
      if (Date.now() < suppressUntilRef.current) return;
      if (typeof e.button === 'number' && e.button !== 0) return;
      if (isFromUI(e.target)) return;

      pointersRef.current += 1;
      if (pointersRef.current > 1) { clear(); return; }

      const latlng = toLatLng(e.clientX, e.clientY);
      if (typeof shouldArm === 'function' && !shouldArm(latlng, e)) return;

      startRef.current = { x: e.clientX, y: e.clientY };
      firedRef.current = false;

      timerRef.current = window.setTimeout(() => {
        if (firedRef.current) return;
        if (Date.now() < suppressUntilRef.current) return;
        if (interactingRef.current) return;
        firedRef.current = true;
        onLongPress(toLatLng(e.clientX, e.clientY), e);
      }, thresholdMs);
    };

    const onPointerMove = (e) => {
      if (!timerRef.current || !startRef.current) return;
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      const armMoveTolerancePx = 2; // be strict while arming to favor pan
      if (dx > armMoveTolerancePx || dy > armMoveTolerancePx) clear();
    };

    const onPointerUpGlobal = () => clear();
    const onVisibility = () => clear();

    const onInteractStart = () => {
      interactingRef.current = true;
      clear();
    };
    const onInteractEnd = () => {
      interactingRef.current = false;
      suppressLongPress(350);
    };

    // Capture phase so we still see events even if Leaflet stops them
    container.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
    container.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });

    // Touch fallback (for devices/browsers where pointer events are flaky)
    const onTouchStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      if (Date.now() < suppressUntilRef.current) return;
      pointersRef.current = 1;
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY };
      firedRef.current = false;
      timerRef.current = window.setTimeout(() => {
        if (pointersRef.current === 1 && !firedRef.current && Date.now() >= suppressUntilRef.current && !interactingRef.current) {
          firedRef.current = true;
          const ll = toLatLng(t.clientX, t.clientY);
          onLongPress(ll, e);
        }
      }, thresholdMs);
    };

    const onTouchMove = (e) => {
      if (!timerRef.current || !e.touches || e.touches.length !== 1 || !startRef.current) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startRef.current.x);
      const dy = Math.abs(t.clientY - startRef.current.y);
      const armMoveTolerancePx = 2;
      if (dx > armMoveTolerancePx || dy > armMoveTolerancePx) clear();
    };

    const onTouchEnd = () => { clear(); };
    const onTouchCancel = () => { clear(); };

    container.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    container.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true });

    window.addEventListener('pointerup', onPointerUpGlobal, { passive: true, capture: true });
    window.addEventListener('pointercancel', onPointerUpGlobal, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibility, { capture: true });

    map.on('movestart dragstart zoomstart', onInteractStart);
    map.on('moveend dragend zoomend', onInteractEnd);
    map.on('rotatestart', onInteractStart);
    map.on('rotateend', onInteractEnd);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, { capture: true });
      container.removeEventListener('pointermove', onPointerMove, { capture: true });
      // no per-container pointerup listeners; using global
      container.removeEventListener('touchstart', onTouchStart, { capture: true });
      container.removeEventListener('touchmove', onTouchMove, { capture: true });
      container.removeEventListener('touchend', onTouchEnd, { capture: true });
      container.removeEventListener('touchcancel', onTouchCancel, { capture: true });
      window.removeEventListener('pointerup', onPointerUpGlobal, { capture: true });
      window.removeEventListener('pointercancel', onPointerUpGlobal, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility, { capture: true });
      map.off('movestart', onInteractStart);
      map.off('dragstart', onInteractStart);
      map.off('zoomstart', onInteractStart);
      map.off('moveend', onInteractEnd);
      map.off('dragend', onInteractEnd);
      map.off('zoomend', onInteractEnd);
      map.off('rotatestart', onInteractStart);
      map.off('rotateend', onInteractEnd);
      clear();
    };
  }, [map, onLongPress, thresholdMs, moveTolerancePx, shouldArm]);
  return { suppressLongPress };
}
