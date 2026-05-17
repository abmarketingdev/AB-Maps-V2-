import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { SAFE_RENDER_MODE } from '../../config/mapFlags.js';
import useMobileDetection from '../../hooks/useMobileDetection';

/**
 * Generic Canvas-based points layer component
 * 
 * @param {Array} points - Array of point objects with position: {lat, lng} and other props
 * @param {Function} styleFor - Function that returns style object for a given point: (props) => { radius, color, fillColor, fillOpacity, weight }
 * @param {Function} onPointClick - Click handler: (props, latlng) => void
 * @param {string} pane - Optional Leaflet pane name (default 'pointsPane')
 */
export default function CanvasPointsLayer({
  points,
  styleFor,
  onPointClick,
  pane = 'pointsPane',
  beforePointClick,
  rotationActive = false,
  useDomInRotation = false,
}) {
  const map = useMap();
  const layerRef = useRef(null);
  const isMobile = useMobileDetection();
  const hasLoggedMountRef = useRef(false);
  
  // Use pane-bound renderer; force SVG when rotation/mobile/safe for transform fidelity
  const renderer = useMemo(() => {
    const forceSvg = isMobile || SAFE_RENDER_MODE || rotationActive;
    const r = forceSvg
      ? L.svg({
          padding: 0,
          tolerance: 0,
          updateWhenZooming: true,
          updateWhenIdle: true,
          pane,
          className: 'leaflet-svg-layer'
        })
      : L.canvas({
          padding: 0.5,
          tolerance: 0,
          updateWhenZooming: true,
          updateWhenIdle: true,
          pane,
          className: 'leaflet-canvas-layer'
        });
    return r;
  }, [isMobile, rotationActive, pane]);

  const fc = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: (points || [])
        .filter(p => {
          // VALIDATE: Check if point has valid position with lat/lng
          if (!p || !p.position || 
              typeof p.position.lat !== 'number' || 
              typeof p.position.lng !== 'number' ||
              isNaN(p.position.lat) || 
              isNaN(p.position.lng)) {
            console.warn('CanvasPointsLayer: Skipping invalid point:', p);
            return false;
          }
          return true;
        })
        .map((p, idx) => ({
          type: 'Feature',
          properties: {
            __index: idx,
            ...p,
            __origLat: p.position.lat,
            __origLng: p.position.lng
          },
          geometry: { type: 'Point', coordinates: [p.position.lng, p.position.lat] },
        })),
    }),
    [points]
  );

  useEffect(() => {
    if (!map) return;

    // Ensure target pane exists before mounting renderer/layer
    let createdPane = null;
    if (!map.getPane(pane)) {
      try {
        map.createPane(pane);
        createdPane = map.getPane(pane);
        if (createdPane && createdPane.style) {
          createdPane.style.zIndex = '570';
        }
      } catch {}
    }

    // rAF-coalesced redraw on rotate/zoom end
    let raf = 0;
    const requestRedraw = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          if (layerRef.current && layerRef.current.eachLayer) {
            layerRef.current.eachLayer((l) => l?.redraw && l.redraw());
          }
        } catch {}
      });
    };
    const onRotate = requestRedraw;
    map.on('rotate', onRotate);
    map.on('rotateend', requestRedraw);
    map.on('zoomend', requestRedraw);

    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    // Ensure renderer container is attached to the target pane before creating vectors
    try {
      if (renderer && typeof renderer.addTo === 'function') {
        renderer.addTo(map);
      }
    } catch {}

    const geo = L.geoJSON(fc, {
      pane,
      bubblingMouseEvents: false, // keep map clicks clean; we won't trap pointer-down
      renderer,
      pointToLayer: (feature, latlng) => {
        const props = feature.properties;
        const sty = styleFor?.(props) || {};
        
        // Disable any pixel-space jitter under rotation/mobile/safe
        if (isMobile || SAFE_RENDER_MODE || rotationActive) {
          // Optional belt-and-suspenders: use DOM marker for perfect pane transform fidelity
          if (useDomInRotation) {
            const size = Math.max(2, Math.min(40, (sty.radius ?? 5) * 2));
            const icon = L.divIcon({
              className: 'dom-point-marker',
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${sty.fillColor ?? '#1976d2'};border:${sty.weight ?? 1}px solid ${sty.color ?? '#111'};opacity:${sty.fillOpacity ?? 0.9};"></div>`,
              iconSize: [size, size],
            });
            return L.marker(latlng, { pane, icon, keyboard: false, interactive: true });
          } else {
            return L.circleMarker(latlng, {
              pane,
              radius: sty.radius ?? 5,
              color: sty.color ?? '#111',
              weight: sty.weight ?? 1,
              fillColor: sty.fillColor ?? '#1976d2',
              fillOpacity: sty.fillOpacity ?? 0.9,
            });
          }
        }

        // Desktop without rotation: keep original coordinates (no pixel jitter)
        return L.circleMarker(latlng, {
          pane,
          radius: sty.radius ?? 5,
          color: sty.color ?? '#111',
          weight: sty.weight ?? 1,
          fillColor: sty.fillColor ?? '#1976d2',
          fillOpacity: sty.fillOpacity ?? 0.9,
        });
      },
      onEachFeature: (feature, layer) => {
        const onClickOnly = (e) => {
          if (e?.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
          }
          if (L?.DomEvent?.stop) L.DomEvent.stop(e);
          if (typeof beforePointClick === 'function') beforePointClick();
          onPointClick?.(feature.properties, e.latlng);
        };
        // IMPORTANT: do not intercept mousedown/touchstart; only handle click
        if (onPointClick) layer.on('click', onClickOnly);
      },
    });

    layerRef.current = geo.addTo(map);
    return () => {
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
      map.off('rotate', onRotate);
      map.off('rotateend', requestRedraw);
      map.off('zoomend', requestRedraw);
      if (raf) cancelAnimationFrame(raf);
      try {
        if (renderer && typeof renderer.remove === 'function') {
          renderer.remove();
        }
      } catch {}
    };
  }, [map, fc, pane, renderer, rotationActive, isMobile]);

  return null;
}
