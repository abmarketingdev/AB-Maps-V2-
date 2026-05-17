/**
 * vectorTileIcons.js
 * 
 * Custom icon rendering for Leaflet.VectorGrid
 * Extends the SVG renderer to draw icons instead of circles
 */

import L from 'leaflet';
import { getMarkerType, getMarkerColor } from './mapIcons';

// Icon SVG paths (simplified for performance)
const ICON_PATHS = {
  // Building - simple building shape
  building: 'M6,22 L6,4 C6,2.9 6.9,2 8,2 L16,2 C17.1,2 18,2.9 18,4 L18,22 M10,6 L14,6 M10,10 L14,10 M10,14 L14,14 M10,18 L14,18',
  
  // Home - house shape  
  house: 'M3,9 L12,2 L21,9 L21,20 C21,21.1 20.1,22 19,22 L5,22 C3.9,22 3,21.1 3,20 Z M9,22 L9,12 L15,12 L15,22',
  
  // Pin - map pin shape
  uploaded: 'M20,10 C20,16 12,22 12,22 C12,22 4,16 4,10 C4,5.58 7.58,2 12,2 C16.42,2 20,5.58 20,10 Z M12,13 C13.66,13 15,11.66 15,10 C15,8.34 13.66,7 12,7 C10.34,7 9,8.34 9,10 C9,11.66 10.34,13 12,13 Z',
  
  // Cluster - just a circle
  cluster: 'M12,2 A10,10 0 1,0 22,12 A10,10 0 1,0 12,2 Z'
};

/**
 * Create a custom SVG renderer that draws icons instead of circles
 */
export function createIconRenderer() {
  // Check if L.SVG.Tile exists
  if (!L.SVG || !L.SVG.Tile) {
    console.warn('[vectorTileIcons] L.SVG.Tile not available');
    return null;
  }

  const IconTileRenderer = L.SVG.Tile.extend({
    
    // Override circle creation to draw icons
    _createCircle: function(layer, p) {
      const props = layer.properties || {};
      const markerType = getMarkerType(props);
      const fillColor = getMarkerColor(props);
      
      // Create a group element
      const g = this._createPath('g', layer, 'leaflet-interactive');
      g.setAttribute('class', `vt-icon vt-icon-${markerType}`);
      
      // Get size based on type
      const sizes = {
        building: 14,
        house: 10,
        uploaded: 11,
        cluster: 12,
        default: 10
      };
      const size = sizes[markerType] || sizes.default;
      
      // Create background circle
      const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bgCircle.setAttribute('r', size);
      bgCircle.setAttribute('fill', fillColor);
      bgCircle.setAttribute('stroke', '#ffffff');
      bgCircle.setAttribute('stroke-width', markerType === 'building' ? '3' : '2');
      g.appendChild(bgCircle);
      
      // Create icon path (scaled and centered)
      if (markerType !== 'cluster') {
        const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pathData = ICON_PATHS[markerType] || ICON_PATHS.uploaded;
        const scale = size * 0.07; // Scale icon to fit in circle
        
        iconPath.setAttribute('d', pathData);
        iconPath.setAttribute('fill', 'none');
        iconPath.setAttribute('stroke', '#ffffff');
        iconPath.setAttribute('stroke-width', String(1.5 / scale));
        iconPath.setAttribute('stroke-linecap', 'round');
        iconPath.setAttribute('stroke-linejoin', 'round');
        iconPath.setAttribute('transform', `scale(${scale}) translate(-12, -12)`);
        iconPath.setAttribute('opacity', '0.9');
        g.appendChild(iconPath);
      }
      
      layer._path = g;
      this._rootGroup.appendChild(g);
      
      return g;
    },
    
    // Override circle update to position icons
    _updateCircle: function(layer, p) {
      if (!layer._path) {
        this._createCircle(layer, p);
      }
      
      const point = p || this._point(layer._latlng);
      if (layer._path) {
        layer._path.setAttribute('transform', `translate(${point.x}, ${point.y})`);
      }
    }
  });

  return function(options) {
    return new IconTileRenderer(options);
  };
}

/**
 * CSS styles for vector tile icons
 */
export const ICON_STYLES = `
  .vt-icon {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  
  .vt-icon:hover {
    transform: scale(1.1);
  }
  
  .vt-icon-building {
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
  }
  
  .vt-icon circle {
    transition: fill 0.2s ease;
  }
  
  .vt-icon path {
    pointer-events: none;
  }
`;

/**
 * Inject icon styles into document
 */
export function injectIconStyles() {
  if (document.getElementById('vt-icon-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'vt-icon-styles';
  style.textContent = ICON_STYLES;
  document.head.appendChild(style);
}

export default {
  createIconRenderer,
  injectIconStyles,
  ICON_PATHS,
  ICON_STYLES
};

