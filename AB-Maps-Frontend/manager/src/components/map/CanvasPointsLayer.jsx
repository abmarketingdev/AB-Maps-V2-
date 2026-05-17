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
      features: (points || []).map((p, idx) => ({
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
    // (no debug logging)

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
          console.log('🎯 Point clicked:', {
            address: feature.properties.address,
            addressId: feature.properties.addressId,
            coordinates: [feature.properties.__origLat, feature.properties.__origLng],
            eventTarget: e.originalEvent?.target?.className || 'unknown',
            eventType: e.type,
            timestamp: Date.now()
          });
          
          // CRITICAL: Call beforePointClick IMMEDIATELY to suppress long press
          console.log('🎯 Point click - calling beforePointClick IMMEDIATELY');
          if (typeof beforePointClick === 'function') beforePointClick();
          
          if (e?.originalEvent) {
            console.log('🔧 Point click - stopping event propagation');
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
          }
          if (L?.DomEvent?.stop) {
            console.log('🔧 Point click - using L.DomEvent.stop');
            L.DomEvent.stop(e);
          }
          
          console.log('🎯 Point click - calling onPointClick handler');
          onPointClick?.(feature.properties, e.latlng);
        };
        
        // Add mousedown/touchstart logging for debugging and immediate suppression
        const onMouseDown = (e) => {
          console.log('👇 Point mousedown detected:', {
            address: feature.properties.address,
            eventType: e.type,
            target: e.originalEvent?.target?.className || 'unknown'
          });
          
          // CRITICAL: Suppress long press IMMEDIATELY on mousedown
          console.log('🚨 Point mousedown - suppressing long press IMMEDIATELY');
          if (typeof beforePointClick === 'function') beforePointClick();
        };
        
        const onTouchStart = (e) => {
          console.log('👆 Point touchstart detected:', {
            address: feature.properties.address,
            eventType: e.type,
            target: e.originalEvent?.target?.className || 'unknown'
          });
          
          // CRITICAL: Suppress long press IMMEDIATELY on touchstart
          console.log('🚨 Point touchstart - suppressing long press IMMEDIATELY');
          if (typeof beforePointClick === 'function') beforePointClick();
        };
        
        // IMPORTANT: do not intercept mousedown/touchstart; only handle click
        layer.on('click', onClickOnly);
        layer.on('mousedown', onMouseDown);
        layer.on('touchstart', onTouchStart);
      },
    });

    layerRef.current = geo.addTo(map);
    // (debug logs removed)
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
