/**
 * mapIcons.js - SVG Icon Utility for Vector Tile Markers
 * 
 * Provides Lucide-style icons for different marker types:
 * - Building2: Apartment complexes/buildings
 * - Home: Standalone houses
 * - MapPin: Uploaded/imported addresses
 * 
 * Icons are rendered as SVG paths with dynamic coloring support.
 */

// Lucide icon paths (24x24 viewBox)
export const ICON_PATHS = {
  // Building2 icon - apartment complex
  building: `
    M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z
    M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2
    M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 0-2 2h-2
    M10 6h4
    M10 10h4
    M10 14h4
    M10 18h4
  `,
  
  // Home icon - standalone house
  home: `
    M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z
    M9 22V12h6v10
  `,
  
  // MapPin icon - uploaded/generic address
  pin: `
    M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z
    M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z
  `,
  
  // Cluster icon - group of markers
  cluster: `
    M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z
  `
};

// Icon sizes based on marker type
export const ICON_SIZES = {
  building: { width: 28, height: 28 },
  house: { width: 20, height: 20 },
  uploaded: { width: 22, height: 22 },
  pin: { width: 22, height: 22 },
  cluster: { width: 24, height: 24 },
  default: { width: 20, height: 20 }
};

/**
 * Get icon configuration based on marker type
 * @param {string} markerType - 'building', 'house', 'uploaded', or 'cluster'
 * @returns {Object} Icon configuration
 */
export function getIconConfig(markerType) {
  switch (markerType) {
    case 'building':
      return {
        path: ICON_PATHS.building,
        size: ICON_SIZES.building,
        strokeWidth: 1.5,
        type: 'building'
      };
    case 'house':
      return {
        path: ICON_PATHS.home,
        size: ICON_SIZES.house,
        strokeWidth: 2,
        type: 'home'
      };
    case 'uploaded':
      return {
        path: ICON_PATHS.pin,
        size: ICON_SIZES.uploaded,
        strokeWidth: 2,
        type: 'pin'
      };
    case 'cluster':
      return {
        path: ICON_PATHS.cluster,
        size: ICON_SIZES.cluster,
        strokeWidth: 2,
        type: 'cluster'
      };
    default:
      return {
        path: ICON_PATHS.pin,
        size: ICON_SIZES.default,
        strokeWidth: 2,
        type: 'pin'
      };
  }
}

/**
 * Create an SVG element for a marker icon
 * @param {Object} options - Icon options
 * @param {string} options.type - 'building', 'house', 'uploaded', 'cluster'
 * @param {string} options.fillColor - Fill color for the icon
 * @param {string} options.strokeColor - Stroke color (default: white)
 * @param {number} options.scale - Scale factor (default: 1)
 * @returns {string} SVG string
 */
export function createIconSVG({ type, fillColor, strokeColor = '#ffffff', scale = 1 }) {
  const config = getIconConfig(type);
  const { path, size, strokeWidth } = config;
  
  const width = size.width * scale;
  const height = size.height * scale;
  
  // For cluster, use a simpler circle representation
  if (type === 'cluster') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="12" cy="12" r="4" fill="${strokeColor}" opacity="0.3"/>
      </svg>
    `.trim();
  }
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" 
         fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" 
         stroke-linecap="round" stroke-linejoin="round">
      <path d="${path.replace(/\s+/g, ' ').trim()}"/>
    </svg>
  `.trim();
}

/**
 * Create a data URL from SVG string for use in Leaflet icons
 * @param {string} svgString - SVG markup
 * @returns {string} Data URL
 */
export function svgToDataUrl(svgString) {
  const encoded = encodeURIComponent(svgString)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

/**
 * Create a Leaflet DivIcon with custom SVG
 * @param {Object} options - Icon options
 * @returns {L.DivIcon} Leaflet DivIcon
 */
export function createLeafletDivIcon(L, options) {
  const { type, fillColor, strokeColor = '#ffffff', scale = 1 } = options;
  const config = getIconConfig(type);
  const width = config.size.width * scale;
  const height = config.size.height * scale;
  
  const svgHtml = createIconSVG(options);
  
  return L.divIcon({
    className: `marker-icon marker-icon-${type}`,
    html: svgHtml,
    iconSize: [width, height],
    iconAnchor: [width / 2, type === 'pin' || type === 'uploaded' ? height : height / 2],
    popupAnchor: [0, -height / 2]
  });
}

/**
 * Get fill color based on marker properties
 * @param {Object} props - Feature properties from MVT
 * @returns {string} Hex color
 */
export function getMarkerColor(props) {
  const markerType = props?.marker_type;
  const status = (props?.status || '').toLowerCase();
  const markerColor = props?.marker_color;
  
  // Buildings use marker_color from backend
  if (markerType === 'building') {
    switch (markerColor) {
      case 'blue': return '#3b82f6';    // Completed
      case 'yellow': return '#f59e0b';  // In progress
      case 'green': return '#10b981';   // Alternative completed
      case 'red': return '#ef4444';     // Error/attention
      default: return '#64748b';        // Grey/unvisited
    }
  }
  
  // Houses use status
  if (markerType === 'house') {
    switch (status) {
      case 'ja': return '#10b981';           // Green - Yes
      case 'nei': return '#ef4444';          // Red - No
      case 'ikke_hjemme': return '#f59e0b';  // Yellow - Not home
      case 'folg_opp': return '#8b5cf6';     // Purple - Follow up
      default: return '#64748b';              // Grey - Unvisited
    }
  }
  
  // Uploaded addresses - blue
  if (markerType === 'uploaded' || props?.source_table === 'uploaded_address') {
    return '#3b82f6';
  }
  
  // Fallback based on status
  switch (status) {
    case 'ja': return '#10b981';
    case 'nei': return '#ef4444';
    case 'ikke_hjemme': return '#f59e0b';
    case 'folg_opp': return '#8b5cf6';
    case 'uploaded': return '#3b82f6';
    default: return '#64748b';
  }
}

/**
 * Determine marker type from properties
 * @param {Object} props - Feature properties
 * @returns {string} Marker type
 */
export function getMarkerType(props) {
  if (props?.cluster) return 'cluster';
  if (props?.marker_type === 'building') return 'building';
  if (props?.marker_type === 'house') return 'house';
  if (props?.marker_type === 'uploaded' || 
      props?.source_table === 'uploaded_address' ||
      (props?.status || '').toLowerCase() === 'uploaded') {
    return 'uploaded';
  }
  return 'house'; // Default to house
}

export default {
  ICON_PATHS,
  ICON_SIZES,
  getIconConfig,
  createIconSVG,
  svgToDataUrl,
  createLeafletDivIcon,
  getMarkerColor,
  getMarkerType
};

