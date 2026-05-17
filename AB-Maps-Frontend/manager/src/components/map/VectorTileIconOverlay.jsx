/**
 * VectorTileIconOverlay.jsx
 * 
 * Renders Lucide-style SVG icons on top of vector tile features.
 * This component listens to vector tile load events and renders
 * icon markers at feature coordinates.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getMarkerType, getMarkerColor } from '../../utils/mapIcons';

// Lucide icon SVG paths (24x24 viewBox)
const ICON_SVGS = {
  // Building2 icon
  building: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
      <path d="M10 6h4"/>
      <path d="M10 10h4"/>
      <path d="M10 14h4"/>
      <path d="M10 18h4"/>
    </svg>
  `,
  
  // Home icon
  house: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  `,
  
  // MapPin icon
  uploaded: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  `,
  
  // Cluster icon (group)
  cluster: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3"/>
    </svg>
  `
};

// Icon sizes based on marker type
const ICON_SIZES = {
  building: { width: 32, height: 32 },
  house: { width: 24, height: 24 },
  uploaded: { width: 28, height: 28 },
  cluster: { width: 28, height: 28 },
  default: { width: 24, height: 24 }
};

/**
 * Create a Leaflet DivIcon with the specified SVG
 */
function createIcon(type, fillColor) {
  const size = ICON_SIZES[type] || ICON_SIZES.default;
  const svgTemplate = ICON_SVGS[type] || ICON_SVGS.uploaded;
  
  // Create icon HTML with background circle and icon
  const html = `
    <div class="vt-icon-wrapper vt-icon-${type}" style="
      width: ${size.width}px;
      height: ${size.height}px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: ${size.width}px;
        height: ${size.height}px;
        background: ${fillColor};
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <div style="
          width: ${size.width * 0.55}px;
          height: ${size.height * 0.55}px;
          color: #ffffff;
        ">
          ${svgTemplate}
        </div>
      </div>
    </div>
  `;
  
  return L.divIcon({
    className: 'vt-icon-marker',
    html: html,
    iconSize: [size.width, size.height],
    iconAnchor: [size.width / 2, type === 'uploaded' ? size.height : size.height / 2],
    popupAnchor: [0, -size.height / 2]
  });
}

/**
 * VectorTileIconOverlay Component
 * Renders icons for vector tile features
 */
export default function VectorTileIconOverlay({ 
  features = [], 
  onFeatureClick,
  enabled = true 
}) {
  const map = useMap();
  const markersRef = useRef(new Map());
  const layerGroupRef = useRef(null);

  // Initialize layer group
  useEffect(() => {
    if (!map) return;
    
    layerGroupRef.current = L.layerGroup().addTo(map);
    
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        map.removeLayer(layerGroupRef.current);
      }
    };
  }, [map]);

  // Update markers when features change
  useEffect(() => {
    if (!map || !layerGroupRef.current || !enabled) return;
    
    const layerGroup = layerGroupRef.current;
    const existingMarkers = markersRef.current;
    const newMarkerIds = new Set();
    
    // Add/update markers for each feature
    features.forEach(feature => {
      if (!feature.coordinates || !feature.properties) return;
      
      const id = feature.properties.id || `${feature.coordinates[0]}-${feature.coordinates[1]}`;
      newMarkerIds.add(id);
      
      // Skip if marker already exists
      if (existingMarkers.has(id)) return;
      
      const markerType = getMarkerType(feature.properties);
      const fillColor = getMarkerColor(feature.properties);
      
      // Skip clusters for now (they're handled by vector tiles)
      if (markerType === 'cluster') return;
      
      const icon = createIcon(markerType, fillColor);
      const marker = L.marker(
        [feature.coordinates[1], feature.coordinates[0]], 
        { icon }
      );
      
      // Add click handler
      if (onFeatureClick) {
        marker.on('click', () => {
          onFeatureClick(feature.properties, {
            lat: feature.coordinates[1],
            lng: feature.coordinates[0]
          });
        });
      }
      
      marker.addTo(layerGroup);
      existingMarkers.set(id, marker);
    });
    
    // Remove markers that are no longer in features
    existingMarkers.forEach((marker, id) => {
      if (!newMarkerIds.has(id)) {
        layerGroup.removeLayer(marker);
        existingMarkers.delete(id);
      }
    });
    
  }, [features, map, enabled, onFeatureClick]);

  return null;
}

