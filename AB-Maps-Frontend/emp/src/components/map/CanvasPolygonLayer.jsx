import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { SAFE_RENDER_MODE } from '../../config/mapFlags.js';
import useMobileDetection from '../../hooks/useMobileDetection';

/**
 * Canvas-based polygon layer component for stable area rendering
 * 
 * @param {Array} polygons - Array of polygon objects with coordinates and styling
 * @param {Function} styleFor - Function that returns style object for a given polygon
 * @param {Function} onPolygonClick - Click handler: (polygon, latlng) => void
 * @param {string} pane - Optional Leaflet pane name (default 'areasPane')
 */
export default function CanvasPolygonLayer({ polygons, styleFor, onPolygonClick, pane = 'areasPane' }) {
  const map = useMap();
  const layerRef = useRef(null);
  const isMobile = useMobileDetection();
  
  // Use SVG renderer for polygons on mobile (most stable)
  const rendererRef = useRef(L.svg({
    padding: 0,
    tolerance: 0,
    updateWhenZooming: false,
    updateWhenIdle: true,
    className: 'leaflet-svg-layer'
  }));

  const fc = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: (polygons || []).map((polygon, idx) => ({
        type: 'Feature',
        properties: {
          __index: idx,
          ...polygon,
          __origCoords: polygon.coordinates
        },
        geometry: { 
          type: 'Polygon', 
          coordinates: polygon.coordinates 
        },
      })),
    }),
    [polygons?.length, polygons?.map(p => p.id).join(',')]
  );

  useEffect(() => {
    if (!map || !fc.features.length) return;

    try {
      const geo = L.geoJSON(fc, {
        pane,                              // put pane here (correct place)
        renderer: rendererRef.current,
        interactive: false,                // 🔑 let gestures pass through
        bubblingMouseEvents: true,         // allow events to reach the map
        style: (feature) => {
          const props = feature.properties;
          const sty = styleFor?.(props) || {};
          
          return {
            color: sty.color || '#111',
            fillColor: sty.fillColor || '#222',
            fillOpacity: sty.fillOpacity || 0.3,
            weight: sty.weight || 3,
            dashArray: sty.dashArray || null,
          };
        },
        // no per-feature handlers → nothing to consume the pointer start
      });

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      
      map.addLayer(geo);
      layerRef.current = geo;

      return () => {
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error creating Canvas polygon layer:', error);
    }
  }, [map, fc, styleFor, onPolygonClick, pane, isMobile]);

  return null;
}
