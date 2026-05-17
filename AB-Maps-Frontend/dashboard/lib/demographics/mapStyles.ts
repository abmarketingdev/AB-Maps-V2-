// lib/demographics/mapStyles.ts
// MapLibre tile sources and layer configurations

import type { SourceSpecification, LayerSpecification } from 'maplibre-gl';

// API base URL from environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Vector tile source definitions for MapLibre
 */
export const TILE_SOURCES: Record<string, SourceSpecification> = {
  'source-fylke': {
    type: 'vector',
    tiles: [`${API_BASE_URL}/tiles/fylke/{z}/{x}/{y}.mvt`],
    minzoom: 4,
    maxzoom: 7,
  },
  'source-kommune': {
    type: 'vector',
    tiles: [`${API_BASE_URL}/tiles/kommune/{z}/{x}/{y}.mvt`],
    minzoom: 7,
    maxzoom: 11,
  },
  'source-grunnkrets': {
    type: 'vector',
    // Use versioned endpoint for stable CDN caching
    tiles: [`${API_BASE_URL}/tiles/grunnkrets/v2025/{z}/{x}/{y}.mvt`],
    minzoom: 11,
    maxzoom: 22,
  },
};

/**
 * Layer names from ST_AsMVT (backend tile generation)
 * These MUST match what the backend returns in the MVT
 */
export const SOURCE_LAYERS = {
  fylke: 'fylke',
  kommune: 'kommune',
  grunnkrets: 'grunnkrets',
} as const;

/**
 * Color palette for administrative boundaries
 */
const COLORS = {
  fylkeFill: 'rgba(100, 149, 237, 0.3)',      // Cornflower blue
  fylkeOutline: 'rgba(65, 105, 225, 0.8)',     // Royal blue
  kommuneFill: 'rgba(144, 238, 144, 0.3)',     // Light green
  kommuneOutline: 'rgba(34, 139, 34, 0.8)',    // Forest green
  grunnkretsOutline: 'rgba(128, 128, 128, 0.6)', // Gray
  selectedOutline: '#ff6b00',                   // Orange for selection
  lockedOutline: '#22c55e',                     // Green for locked
};

/**
 * Fylke layers (visible at zoom 4-6.99)
 */
export const FYLKE_LAYERS: LayerSpecification[] = [
  {
    id: 'fylke-fill',
    type: 'fill',
    source: 'source-fylke',
    'source-layer': SOURCE_LAYERS.fylke,
    minzoom: 4,
    maxzoom: 6.99,
    paint: {
      'fill-color': COLORS.fylkeFill,
      'fill-opacity': 0.6,
    },
  },
  {
    id: 'fylke-outline',
    type: 'line',
    source: 'source-fylke',
    'source-layer': SOURCE_LAYERS.fylke,
    minzoom: 4,
    maxzoom: 6.99,
    paint: {
      'line-color': COLORS.fylkeOutline,
      'line-width': 2,
    },
  },
];

/**
 * Kommune layers (visible at zoom 7-10.99)
 */
export const KOMMUNE_LAYERS: LayerSpecification[] = [
  {
    id: 'kommune-fill',
    type: 'fill',
    source: 'source-kommune',
    'source-layer': SOURCE_LAYERS.kommune,
    minzoom: 7,
    maxzoom: 10.99,
    paint: {
      'fill-color': COLORS.kommuneFill,
      'fill-opacity': 0.6,
    },
  },
  {
    id: 'kommune-outline',
    type: 'line',
    source: 'source-kommune',
    'source-layer': SOURCE_LAYERS.kommune,
    minzoom: 7,
    maxzoom: 10.99,
    paint: {
      'line-color': COLORS.kommuneOutline,
      'line-width': 1.5,
    },
  },
];

/**
 * Grunnkrets layers (visible at zoom 11+)
 * Fill layer will be styled with choropleth based on selected metric
 */
export const GRUNNKRETS_LAYERS: LayerSpecification[] = [
  {
    id: 'grunnkrets-fill',
    type: 'fill',
    source: 'source-grunnkrets',
    'source-layer': SOURCE_LAYERS.grunnkrets,
    minzoom: 11,
    maxzoom: 22,
    paint: {
      // Default fill - will be updated with choropleth expression
      'fill-color': '#ffffcc',
      'fill-opacity': 0.55,
    },
  },
  {
    id: 'grunnkrets-outline',
    type: 'line',
    source: 'source-grunnkrets',
    'source-layer': SOURCE_LAYERS.grunnkrets,
    minzoom: 11,
    maxzoom: 22,
    paint: {
      'line-color': COLORS.grunnkretsOutline,
      'line-width': 0.5,
    },
  },
];

/**
 * Selected grunnkrets highlight layer (for stats drawer - uses code)
 */
export const GRUNNKRETS_SELECTED_LAYER: LayerSpecification = {
  id: 'grunnkrets-selected',
  type: 'line',
  source: 'source-grunnkrets',
  'source-layer': SOURCE_LAYERS.grunnkrets,
  minzoom: 11,
  maxzoom: 22,
  paint: {
    'line-color': COLORS.selectedOutline,
    'line-width': 3,
  },
  // Filter will be set dynamically: ["==", ["get", "code"], selectedCode]
  filter: ['==', ['get', 'code'], ''],
};

/**
 * Selection highlight layers (for area locking - uses code matching)
 * These layers show orange outline for selected areas
 */
export const SELECTION_HIGHLIGHT_LAYERS: LayerSpecification[] = [
  // Fylke selected
  {
    id: 'fylke-selected-outline',
    type: 'line',
    source: 'source-fylke',
    'source-layer': SOURCE_LAYERS.fylke,
    minzoom: 4,
    maxzoom: 6.99,
    paint: {
      'line-color': COLORS.selectedOutline,
      'line-width': 4,
    },
    filter: ['in', ['get', 'code'], ['literal', []]], // Empty initially
  },
  // Kommune selected
  {
    id: 'kommune-selected-outline',
    type: 'line',
    source: 'source-kommune',
    'source-layer': SOURCE_LAYERS.kommune,
    minzoom: 7,
    maxzoom: 10.99,
    paint: {
      'line-color': COLORS.selectedOutline,
      'line-width': 4,
    },
    filter: ['in', ['get', 'code'], ['literal', []]], // Empty initially
  },
  // Grunnkrets selected (for locking, separate from stats selection)
  {
    id: 'grunnkrets-lock-selected-outline',
    type: 'line',
    source: 'source-grunnkrets',
    'source-layer': SOURCE_LAYERS.grunnkrets,
    minzoom: 11,
    maxzoom: 22,
    paint: {
      'line-color': COLORS.selectedOutline,
      'line-width': 4,
    },
    filter: ['in', ['get', 'code'], ['literal', []]], // Empty initially
  },
];

/**
 * Locked area highlight layers
 * These layers show green dashed outline for locked areas
 */
export const LOCKED_HIGHLIGHT_LAYERS: LayerSpecification[] = [
  // Fylke locked
  {
    id: 'fylke-locked-outline',
    type: 'line',
    source: 'source-fylke',
    'source-layer': SOURCE_LAYERS.fylke,
    minzoom: 4,
    maxzoom: 6.99,
    paint: {
      'line-color': COLORS.lockedOutline,
      'line-width': 3,
      'line-dasharray': [2, 1],
    },
    filter: ['in', ['get', 'code'], ['literal', []]], // Empty initially
  },
  // Kommune locked
  {
    id: 'kommune-locked-outline',
    type: 'line',
    source: 'source-kommune',
    'source-layer': SOURCE_LAYERS.kommune,
    minzoom: 7,
    maxzoom: 10.99,
    paint: {
      'line-color': COLORS.lockedOutline,
      'line-width': 3,
      'line-dasharray': [2, 1],
    },
    filter: ['in', ['get', 'code'], ['literal', []]], // Empty initially
  },
  // Grunnkrets locked
  {
    id: 'grunnkrets-locked-outline',
    type: 'line',
    source: 'source-grunnkrets',
    'source-layer': SOURCE_LAYERS.grunnkrets,
    minzoom: 11,
    maxzoom: 22,
    paint: {
      'line-color': COLORS.lockedOutline,
      'line-width': 3,
      'line-dasharray': [2, 1],
    },
    filter: ['in', ['get', 'code'], ['literal', []]], // Empty initially
  },
];

/**
 * All layers in render order (bottom to top)
 * Order: base layers → locked highlights → selected highlights
 */
export const ALL_LAYERS: LayerSpecification[] = [
  ...FYLKE_LAYERS,
  ...KOMMUNE_LAYERS,
  ...GRUNNKRETS_LAYERS,
  ...LOCKED_HIGHLIGHT_LAYERS,      // Locked below selected
  ...SELECTION_HIGHLIGHT_LAYERS,   // Selected on top
  GRUNNKRETS_SELECTED_LAYER,       // Stats drawer selection (topmost)
];

/**
 * Interactive layer IDs for event handling
 */
export const INTERACTIVE_LAYERS = {
  fylke: 'fylke-fill',
  kommune: 'kommune-fill',
  grunnkrets: 'grunnkrets-fill',
};

