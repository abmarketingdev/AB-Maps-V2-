// VectorTileLayer.jsx - Deterministic Add/Delete Strategy
// ADD: bump {v} and redraw (no remount)
// DELETE: remount the layer (new instance via key change)

import { useEffect, useRef, memo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { getMarkerType, getMarkerColor } from '../../utils/mapIcons';

// Polyfill for Leaflet.DomEvent.fakeStop (some builds lack it)
if (!L.DomEvent.fakeStop) {
  L.DomEvent.fakeStop = function (e) {
    if (!e) return;
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    e._stopped = true;
  };
}

function VectorTileLayer({
  baseUrl,         // ".../tiles/{z}/{x}/{y}.pbf?v={v}&campaign={campaignId}&employee={employeeId}"
  v,               // tilesVersion for cache busting
  campaignId,
  employeeId,
  onFeatureClick,  // (props, latlng) => void
  styles,          // vectorTileLayerStyles
  minZoom = 16,
  maxZoom = 18,
  onReady,         // (layer) => void - exposes layer for external access
}) {
  const map = useMap();
  const layerRef = useRef(null);

  // Create/destroy only when truly necessary (key change in parent will remount)
  useEffect(() => {
    console.log('🔧 [VectorTileLayer] Creating new layer instance');
    
    // Build URL by replacing template variables
    const url = baseUrl
      .replace('{v}', v)
      .replace('{campaignId}', campaignId || '')
      .replace('{employeeId}', employeeId || '');
    
    console.log('🌐 [VectorTileLayer] URL:', url);

    // Define dynamic styling function - uses centralized utilities from mapIcons.js
    // Enhanced styling with larger markers for icon visibility
    const defaultStyles = styles || {
      markers: (props, z) => {
        const markerType = getMarkerType(props);
        const fillColor = getMarkerColor(props);
        const isCluster = markerType === 'cluster' || props?.cluster;
        
        // Cluster styling - keep visible with center indicator
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

    const layer = L.vectorGrid.protobuf(url, {
      vectorTileLayerName: 'markers',    // Must match Django ST_AsMVT layer name
      vectorTileLayerStyles: defaultStyles,
      minZoom,
      maxZoom,
      interactive: true,
      rendererFactory: L.svg.tile,       // SVG for better hit testing
      tolerance: 12,
      buffer: 256,
      updateWhenIdle: false,
      updateWhenZooming: true,
      getFeatureId: (f) => f?.properties?.id || f?.properties?.cluster_id,
      // Store these for soft updates
      v,
      campaignId,
      employeeId,
    });

    // Cursor feedback on hover
    layer.on('mouseover', () => {
      map.getContainer().style.cursor = 'pointer';
    });
    layer.on('mouseout', () => {
      map.getContainer().style.cursor = '';
    });

    // Handle feature clicks
    layer.on('click', (e) => {
      console.log('🎯 [VectorTileLayer] Click event:', e);

      // HARD STOP: prevent any other layer / the map from receiving this click
      try {
        if (e?.originalEvent) {
          L.DomEvent.stop(e.originalEvent);      // stopPropagation + preventDefault
          if (L.DomEvent.fakeStop) {
            L.DomEvent.fakeStop(e.originalEvent);
          }
        }
      } catch (stopError) {
        console.warn('⚠️ [VectorTileLayer] Error stopping event:', stopError);
      }

      // Resolve a latlng we control (don't rely on e.latlng presence)
      let ll = null;
      
      if (e?.latlng) {
        ll = e.latlng;
      } else if (e?.layerPoint && map.layerPointToLatLng) {
        try {
          ll = map.layerPointToLatLng(e.layerPoint);
        } catch (conversionError) {
          console.warn('⚠️ [VectorTileLayer] Error converting layerPoint:', conversionError);
        }
      } else if (e?.originalEvent && map.mouseEventToLatLng) {
        try {
          ll = map.mouseEventToLatLng(e.originalEvent);
        } catch (conversionError) {
          console.warn('⚠️ [VectorTileLayer] Error converting mouseEvent:', conversionError);
        }
      }

      if (!ll) {
        console.warn('⚠️ [VectorTileLayer] No valid latlng found');
        return;
      }

      // Clusters → zoom in
      if (e?.layer?.properties?.cluster) {
        console.log('📍 [VectorTileLayer] Cluster clicked, zooming in');
        const targetZoom = Math.max(map.getZoom() + 1, 17);
        map.flyTo(ll, targetZoom, { animate: true, duration: 0.4 });
        return;
      }

      // Singles → open popups
      const props = e?.layer?.properties;
      if (!props || !ll) {
        console.warn('⚠️ [VectorTileLayer] No properties or latlng for single marker');
        return;
      }

      console.log('✅ [VectorTileLayer] Single marker clicked:', props);

      const markerType = props?.marker_type;

      // PHASE 2: Enhanced click routing based on marker_type
      if (onFeatureClick) {
        onFeatureClick(
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
      }
    });

    layer.addTo(map);
    layerRef.current = layer;
    onReady?.(layer);

    // Helpful debug
    const onLoad = () => console.log('✅ [VectorGrid] Load complete');
    
    // ICON INJECTION: Add icons to SVG path markers after tile loads
    // VectorGrid renders points as <path> elements, not <circle>!
    const onTileLoad = (e) => {
      setTimeout(() => {
        try {
          const mapContainer = map.getContainer();
          if (!mapContainer) return;
          
          // Find all interactive paths (marker shapes) that don't have icons yet
          const markerPaths = mapContainer.querySelectorAll('.leaflet-tile-pane svg path.leaflet-interactive:not([data-has-icon])');
          
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
            
            // Icon paths (centered at 0,0) - Building, House, Pin
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
    };
    
    const onTileError = (e) => console.warn('❌ [VectorGrid] Tile error:', e.coords, e.error);
    
    layer.on('load', onLoad);
    layer.on('tileload', onTileLoad);
    layer.on('tileerror', onTileError);

    // Cleanup
    return () => {
      console.log('🧹 [VectorTileLayer] Removing layer instance');
      layer.off('load', onLoad);
      layer.off('tileload', onTileLoad);
      layer.off('tileerror', onTileError);
      layer.remove();
      layerRef.current = null;
    };
  }, [map, baseUrl, minZoom, maxZoom, styles, onFeatureClick, onReady]); // Only recreate if these core props change

  // Soft updates for adds: change params and redraw (no remount)
  useEffect(() => {
    if (!layerRef.current) return;
    
    console.log('🔄 [VectorTileLayer] Soft update - redrawing with new params');
    console.log('  v:', v, 'campaignId:', campaignId, 'employeeId:', employeeId);
    
    // Update the layer's stored params
    layerRef.current.options.v = v;
    layerRef.current.options.campaignId = campaignId;
    layerRef.current.options.employeeId = employeeId;
    
    // Rebuild URL with new params
    const newUrl = baseUrl
      .replace('{v}', v)
      .replace('{campaignId}', campaignId || '')
      .replace('{employeeId}', employeeId || '');
    
    // Update the URL template
    layerRef.current._url = newUrl;
    
    // Force redraw to fetch tiles with new URL
    layerRef.current.redraw();
    console.log('✅ [VectorTileLayer] Redraw complete');
  }, [v, campaignId, employeeId, baseUrl]); // Re-run when these change

  return null;
}

// ✅ FIX #1: Memoize component to prevent re-renders from parent state changes
// Only re-render when actual props change (v, campaignId, employeeId, baseUrl)
// This prevents blinking when location updates trigger App.js re-renders
export default memo(VectorTileLayer, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Return false if props changed (allow re-render)
  const propsEqual = 
    prevProps.v === nextProps.v &&
    prevProps.campaignId === nextProps.campaignId &&
    prevProps.employeeId === nextProps.employeeId &&
    prevProps.baseUrl === nextProps.baseUrl &&
    prevProps.minZoom === nextProps.minZoom &&
    prevProps.maxZoom === nextProps.maxZoom;
  
  if (!propsEqual) {
    console.log('🔄 [VectorTileLayer] Props changed, allowing re-render:', {
      vChanged: prevProps.v !== nextProps.v,
      campaignChanged: prevProps.campaignId !== nextProps.campaignId,
      employeeChanged: prevProps.employeeId !== nextProps.employeeId,
      urlChanged: prevProps.baseUrl !== nextProps.baseUrl
    });
  }
  
  return propsEqual; // true = skip render, false = allow render
});
