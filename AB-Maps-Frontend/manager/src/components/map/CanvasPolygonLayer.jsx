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
export default function CanvasPolygonLayer({ polygons, styleFor, onPolygonClick, pane = 'areasPane', isMovementMode = false }) {
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
        // Configure polygon layer interactivity based on movement mode
        pane: pane,
        interactive: !isMovementMode, // ← KEY FIX: Make non-interactive when movement mode is on
        // Allow pointer events to bubble so map click handlers fire
        bubblingMouseEvents: true,
        renderer: rendererRef.current,
        style: (feature) => {
          const props = feature.properties;
          const sty = styleFor?.(props) || {};
          
          const style = {
            color: sty.color || '#111',
            fillColor: sty.fillColor || '#222',
            fillOpacity: sty.fillOpacity || 0.3,
            weight: sty.weight || 3,
            dashArray: sty.dashArray || null,
            pane: pane
          };
          
          // In movement mode, make polygons completely non-interactive via CSS
          if (isMovementMode) {
            style.className = 'movement-mode-polygon';
          }
          
          return style;
        },
        onEachFeature: (feature, layer) => {
          if (onPolygonClick && !isMovementMode) {
            // Only handle polygon clicks when movement mode is DISABLED
            // This allows free map movement when movement mode is enabled
            
            // Add debugging for polygon click events
            const handlePolygonClick = (e) => {
              console.log('📐 Polygon click event triggered:', {
                areaId: feature.properties.id,
                areaName: feature.properties.name || 'Unnamed area',
                eventType: e.type,
                coordinates: [e.latlng.lat, e.latlng.lng],
                eventTarget: e.originalEvent?.target?.className || 'unknown',
                timestamp: Date.now(),
                movementMode: isMovementMode
              });
              
              // Call the polygon click handler
              onPolygonClick(feature.properties, e.latlng, 'click');
            };
            
            // Add debugging for mousedown events
            const handlePolygonMouseDown = (e) => {
              console.log('👇 Polygon mousedown detected:', {
                areaId: feature.properties.id,
                areaName: feature.properties.name || 'Unnamed area',
                eventType: e.type,
                target: e.originalEvent?.target?.className || 'unknown',
                movementMode: isMovementMode
              });
            };
            
            // Add debugging for touchstart events
            const handlePolygonTouchStart = (e) => {
              console.log('👆 Polygon touchstart detected:', {
                areaId: feature.properties.id,
                areaName: feature.properties.name || 'Unnamed area',
                eventType: e.type,
                target: e.originalEvent?.target?.className || 'unknown',
                movementMode: isMovementMode
              });
            };
            
            // DISABLED: No click handler to prevent polygon clicks when markers are clicked
            // layer.on('click', handlePolygonClick);
            // layer.on('mousedown', handlePolygonMouseDown);  
            // layer.on('touchstart', handlePolygonTouchStart);
            
            // Handle right-click/long-press via contextmenu only
            layer.on('contextmenu', (e) => {
              console.log('📐 Polygon contextmenu triggered:', {
                areaId: feature.properties.id,
                areaName: feature.properties.name || 'Unnamed area',
                eventType: 'contextmenu',
                coordinates: [e.latlng.lat, e.latlng.lng],
                movementMode: isMovementMode
              });
              
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault();
              onPolygonClick(feature.properties, e.latlng, 'contextmenu');
            });
            // Note: Do NOT implement touchstart-based long-press here.
            // The global useMapLongPress hook handles mobile long-press consistently.
          }
        }
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
  }, [map, fc, styleFor, onPolygonClick, pane, isMobile, isMovementMode]);

  return null;
}
