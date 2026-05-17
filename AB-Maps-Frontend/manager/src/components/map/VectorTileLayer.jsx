// VectorTileLayer.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { getMarkerType, getMarkerColor } from '../../utils/mapIcons';

// ====== ICON SVG TEMPLATES ======
const ICON_SVGS = {
  building: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`,
  house: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  uploaded: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  cluster: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="#fff" opacity="0.5"/></svg>`
};

const ICON_SIZES = {
  building: { w: 36, h: 36, icon: 18 },
  house: { w: 28, h: 28, icon: 14 },
  uploaded: { w: 32, h: 32, icon: 16 },
  cluster: { w: 32, h: 32, icon: 16 },
  default: { w: 28, h: 28, icon: 14 }
};

/**
 * Create a DivIcon with SVG icon inside a colored circle
 */
function createMarkerIcon(type, fillColor) {
  const size = ICON_SIZES[type] || ICON_SIZES.default;
  const svg = ICON_SVGS[type] || ICON_SVGS.uploaded;
  
  const html = `
    <div style="
      width: ${size.w}px;
      height: ${size.h}px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: ${size.w}px;
        height: ${size.h}px;
        background: ${fillColor};
        border: ${type === 'building' ? '3px' : '2.5px'} solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        transition: transform 0.15s ease;
      ">
        <div style="width: ${size.icon}px; height: ${size.icon}px;">
          ${svg}
        </div>
      </div>
    </div>
  `;
  
  return L.divIcon({
    className: `vt-icon-marker vt-icon-${type}`,
    html: html,
    iconSize: [size.w, size.h],
    iconAnchor: [size.w / 2, size.h / 2]
  });
}

/** ----------------------------------------------------------------
 *  Helpers
 *  ---------------------------------------------------------------*/

// Some Leaflet builds lack fakeStop; harmless polyfill.
if (!L.DomEvent.fakeStop) {
  L.DomEvent.fakeStop = function (e) {
    if (!e) return;
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    e._stopped = true;
  };
}

// Resolve a LatLng from various event shapes (rotation/plugins safety)
function resolveEventLatLng(e, map) {
  if (e?.latlng) return e.latlng;
  try {
    if (e?.layerPoint && map?.layerPointToLatLng) return map.layerPointToLatLng(e.layerPoint);
    if (e?.containerPoint && map?.containerPointToLatLng) return map.containerPointToLatLng(e.containerPoint);
    if (e?.originalEvent && map?.mouseEventToLatLng) return map.mouseEventToLatLng(e.originalEvent);
  } catch (_) {}
  return null;
}

// Simple metrics hook
const useVectorTileMetrics = () => {
  const ref = useRef({ tileLoads: 0, tileErrors: 0, totalLoadTime: 0 });
  const recordLoad = (ms) => {
    ref.current.tileLoads += 1;
    ref.current.totalLoadTime += ms || 0;
  };
  const recordError = () => (ref.current.tileErrors += 1);
  const snapshot = () => {
    const { tileLoads, tileErrors, totalLoadTime } = ref.current;
    return {
      tileLoads,
      tileErrors,
      avgLoadTime: tileLoads ? (totalLoadTime / tileLoads).toFixed(2) : '0.00',
      errorRate: tileLoads ? ((tileErrors / tileLoads) * 100).toFixed(2) : '0.00',
    };
  };
  return { recordLoad, recordError, snapshot };
};

/** ----------------------------------------------------------------
 *  Component
 *  ---------------------------------------------------------------*/

export default function VectorTileLayer({
  baseUrl = '/tiles/{z}/{x}/{y}.pbf',
  minZoom = 16,
  maxZoom = 22,
  managerId,
  employeeId,
  campaignId,
  tilesVersion = 0,
  lastCreatedAddressId = null,
  onFeatureClick,           // (props, {lat, lng}) => void
  debugMode = false,
  forceRefreshViewport = false, // New prop to force viewport refresh
  isDrawingEnabled = false,    // When true, skip click handling to allow drawing
  isDeleteMode = false,        // When true, skip click handling to allow polygon deletion drawing
}) {
  const map = useMap();
  const layerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const { recordLoad, recordError, snapshot } = useVectorTileMetrics();

  useEffect(() => {
    if (!map) return;

    // Tear down any previous layer when inputs change
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    // Ensure a dedicated pane below markers/popups but above base tiles/polygons
    // CRITICAL: Parent this pane to the rotatePane so vector tiles rotate with the map
    const PANE_NAME = 'vectorTilePane';
    const rotatePane = map.getPane('rotatePane'); // Leaflet-Rotate creates this (class: .leaflet-rotate-pane)
    
    if (!map.getPane(PANE_NAME)) {
      // Create vectorTilePane as a child of rotatePane
      const pane = map.createPane(PANE_NAME);
      
      // Typical Leaflet defaults: tilePane ~ 200, overlayPane ~ 400, markerPane ~ 600, popupPane ~ 700
      // Put vector tiles high enough for clicks but below normal markers.
      pane.style.zIndex = '580';
      
      // Parent to rotatePane if it exists (for proper rotation)
      if (rotatePane && pane.parentNode !== rotatePane) {
        rotatePane.appendChild(pane);
      }
    } else {
      // If vectorTilePane already exists but is not parented to rotatePane, reparent it
      const existingPane = map.getPane(PANE_NAME);
      if (existingPane && rotatePane && existingPane.parentNode !== rotatePane) {
        rotatePane.appendChild(existingPane);
      }
    }

    // Build URL with content-affecting filters only
    const qs = new URLSearchParams();
    
    // Standard version parameter (always v=1)
    qs.append('v', '1');
    
    // Content-affecting filters (determine which addresses to include)
    if (campaignId) qs.append('campaign', campaignId);
    if (managerId) qs.append('manager', managerId);
    if (employeeId) qs.append('employee', employeeId);
    
    const urlTemplate = qs.toString() ? `${baseUrl}?${qs}` : baseUrl;
    
    // Browser will automatically handle caching via ETag revalidation
    // Backend parameters (buffer, extent, cluster_buffer) are handled server-side
    // No manual cache busting needed - ETag ensures freshness!

    // Icon markers layer group for rendering actual icons
    const iconLayerGroup = L.layerGroup();
    const iconMarkers = new Map();
    
    // Style function — Minimal circles for hit detection (icons rendered separately)
    const styles = {
      markers: (props, z) => {
        const markerType = getMarkerType(props);
        const fillColor = getMarkerColor(props);
        const isCluster = markerType === 'cluster' || props?.cluster;
        
        // Store feature data for icon rendering
        const id = props?.id || props?.cluster_id;
        if (id && !isCluster) {
          // Queue for icon rendering after tile loads
          setTimeout(() => {
            if (!iconMarkers.has(id)) {
              // We'll add icons in the tile load handler
            }
          }, 0);
        }
        
        // Cluster styling - keep visible
        if (isCluster) {
          return {
            radius: z >= 17 ? 16 : 14,
            fill: true,
            fillOpacity: 0.95,
            weight: 3,
            color: '#ffffff',
            fillColor: '#1e293b',
            stroke: true,
          };
        }

        // Non-cluster markers - render as colored circles with icons inside
        // Size based on type - reduced sizes to prevent marker overlap
        const sizes = {
          building: z >= 18 ? 12 : 9,
          house: z >= 18 ? 9 : 7,
          uploaded: z >= 18 ? 9 : 7,
          default: z >= 18 ? 8 : 6
        };
        
        return {
          radius: sizes[markerType] || sizes.default,
          fill: true,
          fillOpacity: 1,
          weight: markerType === 'building' ? 3 : 2.5,
          color: '#ffffff',
          fillColor: fillColor,
          stroke: true,
        };
      },
    };

    // Create VectorGrid layer — SVG while debugging makes hit-testing very robust
    const layer = L.vectorGrid.protobuf(urlTemplate, {
      vectorTileLayerName: 'markers',     // must match Django ST_AsMVT layer name
      pane: PANE_NAME,
      minZoom,
      maxZoom,
      maxNativeZoom: 18,                  // CRITICAL: Backend only supports zoom 16-18, cap tile requests at 18
      interactive: true,                  // 🔑 feature events enabled
      rendererFactory: L.svg.tile,        // SVG for easier hit testing & debug
      tolerance: 12,                      // Further increased for better boundary handling
      buffer: 256,                        // Doubled buffer to full tile size for maximum coverage
      keepBuffer: 8,                      // Increased to maintain larger buffer across zoom changes
      padding: 0.5,                       // Add 50% padding around tiles for boundary clusters
      updateWhenZooming: false,           // Prevent updates during zoom to avoid flickering
      updateWhenIdle: true,               // Only update when map is idle
      debug: debugMode ? 1 : 0,
      getFeatureId: (f) => f?.properties?.id || f?.properties?.cluster_id, // stable IDs for events
      vectorTileLayerStyles: styles,
      // Browser handles caching automatically via ETag revalidation
      // tilesVersion in dependencies ensures instant updates on edit
    });

    // Cursor feedback on hover
    layer.on('mouseover', () => {
      const pane = map.getPane(PANE_NAME);
      if (pane) pane.style.cursor = 'pointer';
    });
    layer.on('mouseout', () => {
      const pane = map.getPane(PANE_NAME);
      if (pane) pane.style.cursor = '';
    });

    // Click: VectorGrid gives { layer.properties, latlng, ... }
    layer.on('click', (e) => {
      // CRITICAL: When drawing or delete mode is active, let the click pass through
      // to the map click handler for polygon drawing
      if (isDrawingEnabled || isDeleteMode) {
        console.log('[VectorTileLayer] Skipping click - drawing/delete mode active');
        return; // Don't stop propagation, let map handle the click
      }

      // HARD STOP: prevent any other layer / the map from receiving this click
      try {
        if (e?.originalEvent) {
          L.DomEvent.stop(e.originalEvent);      // stopPropagation + preventDefault
          L.DomEvent.fakeStop?.(e.originalEvent);
        }
      } catch (stopError) {
      }

      // Resolve a latlng we control (don't rely on e.latlng presence)
      let ll = null;
      
      if (e?.latlng) {
        ll = e.latlng;
      } else if (e?.layerPoint && map.layerPointToLatLng) {
        try {
          ll = map.layerPointToLatLng(e.layerPoint);
        } catch (conversionError) {
        }
      } else if (e?.originalEvent && map.mouseEventToLatLng) {
        try {
          ll = map.mouseEventToLatLng(e.originalEvent);
        } catch (conversionError) {
        }
      }

      if (!ll) {
        return;
      }

      // Clusters → zoom in
      if (e?.layer?.properties?.cluster) {
        if (ll) {
          const targetZoom = Math.max(map.getZoom() + 1, 17);
          map.flyTo(ll, targetZoom, { animate: true, duration: 0.4 });
        }
        return;
      }

      // Singles → route based on marker_type
      const props = e?.layer?.properties;
      if (!props || !ll) {
        return;
      }

      const markerType = props?.marker_type;

      // PHASE 2: Enhanced click routing based on marker_type
      onFeatureClick?.(
        {
          ...props,
          // Include marker_type for routing decisions in parent component
          markerType: markerType,
          // Building-specific properties
          isBuilding: markerType === 'building',
          buildingId: markerType === 'building' ? props.id : null,
          totalUnits: props.total_units || 0,
          visitedUnits: props.visited_units || 0,
          remainingUnits: props.remaining_units || 0,
          markerColor: props.marker_color || 'grey',
          // House/uploaded properties
          isUploadedAddress:
            markerType === 'uploaded' ||
            props.source_table === 'uploaded_address' ||
            (props.status || '').toLowerCase() === 'uploaded',
          addressId: props.id,
          addressText: props.address_text || '',
        },
        { lat: ll.lat, lng: ll.lng }
      );
      
    });

    // Enhanced tile debugging for cluster boundary issues
    layer.on('tileloadstart', (e) => {
      if (debugMode) {
        const backendZoom = Math.min(e.coords.z, 18);
        const tileUrl = urlTemplate
          .replace('{z}', backendZoom)
          .replace('{x}', e.coords.x)
          .replace('{y}', e.coords.y);
        console.log('🔄 [VectorTile] Loading tile:', {
          frontendZoom: e.coords.z,
          backendZoom: backendZoom,
          coords: e.coords,
          url: tileUrl,
          maxNativeZoom: 18,
          buffer: 256,
          padding: 0.5
        });
      }
    });

    // Tile metrics
    const t0 = new Map();
    layer.on('tileloadstart', (e) => {
      t0.set(`${e.coords.x}:${e.coords.y}:${e.coords.z}`, performance.now());
    });
    layer.on('tileload', (e) => {
      const key = `${e.coords.x}:${e.coords.y}:${e.coords.z}`;
      const start = t0.get(key);
      if (start != null) {
        recordLoad(performance.now() - start);
        t0.delete(key);
      }
      
      // ICON INJECTION: Add icons to SVG path markers after tile renders
      // VectorGrid renders points as <path> elements, not <circle>!
      setTimeout(() => {
        try {
          const pane = map.getPane(PANE_NAME);
          if (!pane) return;
          
          // Find all interactive paths (marker shapes) that don't have icons yet
          const markerPaths = pane.querySelectorAll('svg path.leaflet-interactive:not([data-has-icon])');
          
          markerPaths.forEach(markerPath => {
            const g = markerPath.parentElement;
            if (!g || g.tagName.toLowerCase() !== 'g') return;
            
            // Get fill color and stroke width to determine marker type
            const fillColor = markerPath.getAttribute('fill');
            const strokeWidth = parseFloat(markerPath.getAttribute('stroke-width')) || 2;
            
            // Determine icon type based on stroke width (thicker = building)
            let iconType = 'house';
            if (strokeWidth >= 3) iconType = 'building';
            else if (fillColor === '#3b82f6') iconType = 'uploaded'; // Blue = uploaded
            else if (fillColor === '#1e293b') iconType = 'cluster';
            
            // Skip clusters
            if (iconType === 'cluster') {
              markerPath.setAttribute('data-has-icon', 'true');
              return;
            }
            
            // Get the bounding box to determine size and position
            let cx = 0, cy = 0, size = 10;
            try {
              const bbox = markerPath.getBBox();
              cx = bbox.x + bbox.width / 2;
              cy = bbox.y + bbox.height / 2;
              size = Math.max(bbox.width, bbox.height) / 2;
            } catch (e) {
              // BBox not available, use defaults
            }
            
            // Scale icon based on marker size
            const scale = size / 14;
            
            // Create icon group centered on the marker
            const iconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            iconG.setAttribute('class', 'vt-icon-inner');
            iconG.setAttribute('pointer-events', 'none');
            iconG.setAttribute('transform', `translate(${cx}, ${cy}) scale(${scale})`);
            
            // Icon paths (centered at 0,0)
            const iconDefs = {
              building: [
                'M-4,5 L-4,-3 L4,-3 L4,5',  // Building body
                'M-2,-1 L0,-1', 'M2,-1 L2,-1',  // Windows
                'M-2,2 L0,2', 'M2,2 L2,2',
              ],
              house: [
                'M0,-4 L5,1 L5,5 L-5,5 L-5,1 Z',  // House
                'M-1.5,5 L-1.5,2 L1.5,2 L1.5,5',  // Door
              ],
              uploaded: [
                'M0,-5 C3,-5 5,-2 5,0 C5,3 0,6 0,6 S-5,3 -5,0 C-5,-2 -3,-5 0,-5',  // Pin
                'M0,-1 A1.5,1.5 0 1,0 0,2 A1.5,1.5 0 1,0 0,-1',  // Dot
              ]
            };
            
            const pathDefs = iconDefs[iconType] || iconDefs.house;
            pathDefs.forEach(d => {
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              path.setAttribute('d', d);
              path.setAttribute('fill', 'none');
              path.setAttribute('stroke', '#ffffff');
              path.setAttribute('stroke-width', String(1.5 / scale));
              path.setAttribute('stroke-linecap', 'round');
              path.setAttribute('stroke-linejoin', 'round');
              path.setAttribute('opacity', '0.95');
              iconG.appendChild(path);
            });
            
            g.appendChild(iconG);
            markerPath.setAttribute('data-has-icon', 'true');
          });
        } catch (iconError) {
          console.error('🎨 [Icons] Error:', iconError);
        }
      }, 100);
      
      const backendZoom = Math.min(e.coords.z, 18);
      const tileUrl = urlTemplate
        .replace('{z}', backendZoom)
        .replace('{x}', e.coords.x)
        .replace('{y}', e.coords.y);
      
      
      if (debugMode) {
        
        // Debug: Track if we're looking for a specific address
        if (lastCreatedAddressId) {
          
          // Add function to manually inspect tile content
          window.inspectTileContent = async () => {
            try {
              // Use URL with cache busting parameters instead of fetch options
              const cacheBustedUrl = tileUrl.includes('?') 
                ? `${tileUrl}&inspect=${Date.now()}` 
                : `${tileUrl}?inspect=${Date.now()}`;
              
              const response = await fetch(cacheBustedUrl);
              const arrayBuffer = await response.arrayBuffer();
              
              if (arrayBuffer.byteLength === 0) {
              } else {
              }
            } catch (error) {
            }
          };
          
          // Auto-inspect the tile if we're looking for a specific address
          setTimeout(() => {
            window.inspectTileContent();
          }, 100);
        }
      }
    });
    layer.on('tileerror', (e) => {
      recordError();
      // Log metrics to console instead of updating state
      console.log('Vector Tile Error Metrics:', snapshot());
      
      // Enhanced error logging to debug tile failures
      
      // Try to determine specific failure reason
      if (e?.error?.message?.includes('404')) {
        console.warn('🔍 [MVT] Tile not found (404) - this is normal for areas with no addresses');
      } else if (e?.error?.message?.includes('500')) {
        console.error('🚨 [MVT] Server error (500) - backend issue');
      } else if (e?.error?.message?.includes('fetch')) {
        console.error('🌐 [MVT] Network/fetch error - check connection or CORS');
      }
    });

    // Loading flags
    layer.on('loading', () => setIsLoading(true));
    layer.on('load', () => setIsLoading(false));

    // Mount
    layer.addTo(map);
    layerRef.current = layer;

    // Cleanup
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [
    map,
    baseUrl,
    minZoom,
    maxZoom,
    managerId,
    employeeId,
    campaignId,
    tilesVersion,    // ✅ KEEP THIS! Triggers instant updates - layer remounts, ETag revalidates
    debugMode,
    onFeatureClick,
    isDrawingEnabled, // Re-mount when drawing mode changes
    isDeleteMode,     // Re-mount when delete mode changes
  ]);

  // Expose debugging utilities
  useEffect(() => {
    window.vectorTileLayer = window.vectorTileLayer || {};
    window.vectorTileLayer.isLoading = isLoading;
    
    // Debug function to inspect SVG structure
    window.debugVectorTileIcons = () => {
      const pane = map?.getPane('vectorTilePane');
      if (!pane) {
        console.log('❌ vectorTilePane not found');
        return;
      }
      
      console.log('📍 Pane found:', pane);
      
      const svgs = pane.querySelectorAll('svg');
      console.log('📍 SVGs in pane:', svgs.length);
      
      // Look for interactive paths (these are the markers)
      const markerPaths = pane.querySelectorAll('path.leaflet-interactive');
      console.log('📍 Marker paths (path.leaflet-interactive):', markerPaths.length);
      
      markerPaths.forEach((p, i) => {
        if (i < 5) { // Only show first 5
          console.log(`  Path ${i}:`, {
            fill: p.getAttribute('fill'),
            stroke: p.getAttribute('stroke'),
            strokeWidth: p.getAttribute('stroke-width'),
            hasIcon: p.getAttribute('data-has-icon'),
            parent: p.parentElement?.tagName
          });
        }
      });
      
      const withIcons = pane.querySelectorAll('path.leaflet-interactive[data-has-icon]');
      console.log('📍 Paths with icons:', withIcons.length);
      
      return { pane, svgs: svgs.length, markerPaths: markerPaths.length, withIcons: withIcons.length };
    };
    
    // Manual icon injection trigger
    window.injectIcons = () => {
      const pane = map?.getPane('vectorTilePane');
      if (!pane) return console.log('No pane');
      
      const paths = pane.querySelectorAll('svg path.leaflet-interactive:not([data-has-icon])');
      console.log('Found', paths.length, 'marker paths without icons');
      
      paths.forEach(markerPath => {
        const g = markerPath.parentElement;
        if (!g) return;
        
        // Get bounding box
        let cx = 0, cy = 0, size = 10;
        try {
          const bbox = markerPath.getBBox();
          cx = bbox.x + bbox.width / 2;
          cy = bbox.y + bbox.height / 2;
          size = Math.max(bbox.width, bbox.height) / 2;
        } catch (e) {}
        
        const scale = size / 12;
        
        // Add a simple test icon (star shape)
        const iconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        iconG.setAttribute('transform', `translate(${cx}, ${cy}) scale(${scale})`);
        iconG.setAttribute('pointer-events', 'none');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M0,-5 L1.5,-1.5 L5,-1.5 L2.5,1 L3.5,5 L0,2.5 L-3.5,5 L-2.5,1 L-5,-1.5 L-1.5,-1.5 Z');
        path.setAttribute('fill', '#ffffff');
        path.setAttribute('stroke', 'none');
        
        iconG.appendChild(path);
        g.appendChild(iconG);
        markerPath.setAttribute('data-has-icon', 'true');
      });
      
      console.log('Icons injected!');
    };
    
    console.log('🎨 Debug functions available: debugVectorTileIcons(), injectIcons()');
  }, [isLoading, map]);

  return null;
}
