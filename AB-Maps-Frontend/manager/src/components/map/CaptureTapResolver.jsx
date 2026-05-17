import { useEffect, useRef } from 'react';

/**
 * Capture-phase resolver to prioritize clusters and singles under tap/click
 * without relying on DOM z-index. Keeps polygon interactivity intact.
 */
export default function CaptureTapResolver({
  mapRef,
  addrClusters = [],
  uplClusters = [],
  addrSinglesPoints = [],
  uplSinglesPoints = [],
  isDrawingEnabled = false,
  shouldSuppressMapClick = () => false,
  suppressNextMapClick = () => {},
  pauseClusterRefresh = () => {},
  requestExpansionZoom = () => {
    // Simple zoom function for vector tiles
    const currentZoom = mapRef?.getZoom?.() || 16;
    return Math.min(currentZoom + 2, 22);
  },
  closeAddressPopup = () => {},
  closeUploadedAddressPopup = () => {},
  setSelectedMarker = () => {},
}) {
  const lastConsumeTsRef = useRef(0);

  useEffect(() => {
    if (!mapRef) return;
    const container = mapRef.getContainer?.();
    if (!container) return;

    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    const singleRadius = isMobile ? 20 : 12; // px
    const clusterRadius = 20; // px, matches 40px icon size

    const toDist = (p1, p2) => {
      const dx = p1.x - p2.x; const dy = p1.y - p2.y; return Math.sqrt(dx*dx + dy*dy);
    };

    const isUiTarget = (el) => {
      while (el) {
        if (el.classList && (
          el.classList.contains('leaflet-control') ||
          el.classList.contains('rotation-control-root') ||
          el.classList.contains('map-ui-control') ||
          el.classList.contains('floating-address-popup') ||
          el.classList.contains('floating-address-marker-popup') ||
          el.classList.contains('floating-uploaded-address-popup') ||
          el.classList.contains('floating-forbidden-popup') ||
          el.classList.contains('popup-backdrop') ||
          el.classList.contains('forbidden-backdrop')
        )) return true;
        el = el.parentElement;
      }
      return false;
    };

    const onCapture = async (evt) => {
      // Basic guards
      if (!mapRef) return;
      if (isDrawingEnabled) return;
      if (shouldSuppressMapClick()) return;
      if (evt.button && evt.button !== 0) return; // primary only
      if (evt.detail > 1) return; // avoid double click re-entry
      const now = Date.now();
      if (now - lastConsumeTsRef.current < 200) return;

      const target = evt.target;
      if (isUiTarget(target)) return;

      // Compute container point
      const point = mapRef.mouseEventToContainerPoint(evt);
      if (!point) return;

      // Build cluster candidates first
      const clusterPts = [];
      (addrClusters || []).forEach(c => clusterPts.push({ type: 'addresses', lat: c.lat, lng: c.lng, id: c.cluster_id }));
      (uplClusters || []).forEach(c => clusterPts.push({ type: 'uploaded', lat: c.lat, lng: c.lng, id: c.cluster_id }));

      let bestCluster = null; let bestClusterD = Infinity;
      for (const c of clusterPts) {
        const cp = mapRef.latLngToContainerPoint([c.lat, c.lng]);
        const d = toDist(cp, point);
        if (d <= clusterRadius && d < bestClusterD) { bestCluster = c; bestClusterD = d; }
      }

      if (bestCluster) {
        try {
          suppressNextMapClick(600);
          pauseClusterRefresh(900);
          if (typeof requestExpansionZoom === 'function') {
            const zoom = requestExpansionZoom();
            mapRef.flyTo([bestCluster.lat, bestCluster.lng], zoom, { animate: true, duration: 0.6 });
          }
        } finally {
          lastConsumeTsRef.current = Date.now();
          evt.stopImmediatePropagation?.();
          evt.stopPropagation?.();
        }
        return;
      }

      // Singles next
      const singles = [];
      (addrSinglesPoints || []).forEach(p => singles.push({ kind: 'address', ...p }));
      (uplSinglesPoints || []).forEach(p => singles.push({ kind: 'uploaded', ...p }));

      let best = null; let bestD = Infinity;
      for (const s of singles) {
        const sp = mapRef.latLngToContainerPoint(s.position);
        const d = toDist(sp, point);
        if (d <= singleRadius && d < bestD) { best = s; bestD = d; }
      }

      if (best) {
        try {
          closeAddressPopup?.();
          closeUploadedAddressPopup?.();
          suppressNextMapClick(500);
          pauseClusterRefresh(700);
          if (best.kind === 'uploaded') {
            setSelectedMarker({
              ...best,
              isUploadedAddress: true,
              uploadedAddressData: { address_text: best.address || best.display_name || 'Opplastet adresse' },
              position: best.position
            });
          } else {
            setSelectedMarker({ ...best, isUploadedAddress: false, position: best.position });
          }
        } finally {
          lastConsumeTsRef.current = Date.now();
          evt.stopImmediatePropagation?.();
          evt.stopPropagation?.();
        }
      }
    };

    container.addEventListener('click', onCapture, { capture: true });
    return () => container.removeEventListener('click', onCapture, { capture: true });
  }, [mapRef, addrClusters, uplClusters, addrSinglesPoints, uplSinglesPoints, isDrawingEnabled, shouldSuppressMapClick]);

  return null;
}

