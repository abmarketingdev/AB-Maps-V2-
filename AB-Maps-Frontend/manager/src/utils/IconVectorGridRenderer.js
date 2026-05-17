/**
 * IconVectorGridRenderer.js
 * 
 * Custom renderer for Leaflet.VectorGrid that renders SVG icons
 * instead of circles for point features. Supports dynamic coloring
 * similar to Mapbox GL SDF icons.
 */

import L from 'leaflet';
import { getMarkerType, getMarkerColor, getIconConfig } from './mapIcons';

// Lucide-style SVG path data (optimized for 24x24 viewBox)
const ICON_SVG_PATHS = {
  // Building2 - simplified for clarity at small sizes
  building: 'M6 22V4c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v18M6 12H4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h2M18 9h2c1.1 0 2 .9 2 2v9M10 6h4M10 10h4M10 14h4M10 18h4',
  
  // Home - house shape
  home: 'M3 9l9-7 9 7v11c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V9zM9 22V12h6v10',
  
  // MapPin - location marker
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  
  // Cluster - simple filled circle with inner ring
  cluster: 'M12 2a10 10 0 100 20 10 10 0 000-20z'
};

/**
 * Create the SVG icon element for a point feature
 * @param {Object} props - Feature properties
 * @param {number} zoom - Current zoom level
 * @returns {SVGElement} SVG group element
 */
function createIconElement(props, zoom) {
  const markerType = getMarkerType(props);
  const fillColor = getMarkerColor(props);
  const config = getIconConfig(markerType);
  
  // Scale based on zoom and type
  const baseScale = markerType === 'building' ? 1.3 : 
                    markerType === 'cluster' ? 1.2 : 1.0;
  const zoomScale = zoom >= 18 ? 1.15 : 1.0;
  const scale = baseScale * zoomScale;
  
  const size = config.size.width * scale;
  const halfSize = size / 2;
  
  // Create SVG group
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', `vt-icon vt-icon-${markerType}`);
  
  if (markerType === 'cluster') {
    // Cluster: filled circle with count
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('r', halfSize);
    circle.setAttribute('fill', '#1e293b');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    g.appendChild(circle);
    
    // Inner highlight
    const innerCircle = document.createElementNS(ns, 'circle');
    innerCircle.setAttribute('r', halfSize * 0.4);
    innerCircle.setAttribute('fill', 'rgba(255,255,255,0.2)');
    g.appendChild(innerCircle);
  } else {
    // Icon background circle for better visibility
    const bgCircle = document.createElementNS(ns, 'circle');
    bgCircle.setAttribute('r', halfSize + 2);
    bgCircle.setAttribute('fill', fillColor);
    bgCircle.setAttribute('stroke', '#ffffff');
    bgCircle.setAttribute('stroke-width', '2');
    bgCircle.setAttribute('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))');
    g.appendChild(bgCircle);
    
    // Icon path
    const path = document.createElementNS(ns, 'path');
    const iconPath = ICON_SVG_PATHS[config.type] || ICON_SVG_PATHS.pin;
    
    // Scale and center the path
    const iconScale = (size * 0.55) / 24; // Icon takes 55% of the circle
    path.setAttribute('d', iconPath);
    path.setAttribute('transform', `scale(${iconScale}) translate(-12, -12)`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-width', String(2 / iconScale));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    g.appendChild(path);
  }
  
  return g;
}

/**
 * Extended SVG Tile renderer that supports icon rendering
 */
export function createIconTileRenderer() {
  // Check if L.svg.tile exists (from leaflet.vectorgrid)
  if (!L.svg || !L.svg.tile) {
    console.warn('L.svg.tile not found, falling back to default renderer');
    return L.svg.tile;
  }
  
  const IconTileRenderer = L.SVG.Tile.extend({
    options: {
      useIcons: true
    },
    
    _initContainer: function() {
      L.SVG.Tile.prototype._initContainer.call(this);
      // Add class for styling
      if (this._container) {
        L.DomUtil.addClass(this._container, 'leaflet-vt-icons');
      }
    },
    
    // Override _updateCircle to render icons for points
    _updateCircle: function(layer, p) {
      // If icons disabled, use default circle rendering
      if (!this.options.useIcons) {
        return L.SVG.Tile.prototype._updateCircle.call(this, layer, p);
      }
      
      const props = layer.feature?.properties || layer.properties || {};
      const zoom = this._map ? this._map.getZoom() : 17;
      
      // Check if this should be an icon
      const markerType = getMarkerType(props);
      
      // Create or update the icon element
      if (!layer._iconElement) {
        layer._iconElement = createIconElement(props, zoom);
        this._rootGroup.appendChild(layer._iconElement);
        layer._path = layer._iconElement; // For compatibility
      }
      
      // Update position
      const point = p || this._point(layer._latlng);
      layer._iconElement.setAttribute('transform', `translate(${point.x}, ${point.y})`);
    }
  });
  
  return function(options) {
    return new IconTileRenderer(options);
  };
}

/**
 * Style function that returns icon-aware styling
 * This replaces the circle-based styles with icon configuration
 */
export function createIconStyles() {
  return {
    markers: (props, zoom) => {
      const markerType = getMarkerType(props);
      const fillColor = getMarkerColor(props);
      
      // Base sizes for different types
      const baseRadius = 
        props?.cluster ? 12 :
        markerType === 'building' ? (zoom >= 18 ? 14 : 12) :
        markerType === 'house' ? (zoom >= 18 ? 10 : 8) :
        (zoom >= 18 ? 10 : 8);
      
      return {
        // Circle properties (used by default renderer and as fallback)
        radius: baseRadius,
        fill: true,
        fillOpacity: 1,
        weight: 2,
        color: '#ffffff',
        fillColor: fillColor,
        stroke: true,
        
        // Extended properties for icon rendering
        _iconType: markerType,
        _iconColor: fillColor,
        _isIcon: true
      };
    }
  };
}

export default {
  createIconTileRenderer,
  createIconStyles,
  createIconElement,
  getMarkerType,
  getMarkerColor
};

