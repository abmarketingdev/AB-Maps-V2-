// Feature flags configuration
export const FEATURE_FLAGS = {
  VECTOR_TILES: {
    enabled: process.env.REACT_APP_ENABLE_VECTOR_TILES === 'true' || false,
    minZoom: parseInt(process.env.REACT_APP_VECTOR_TILES_MIN_ZOOM || '16'),
    maxZoom: parseInt(process.env.REACT_APP_VECTOR_TILES_MAX_ZOOM || '22'),
    debugMode: process.env.REACT_APP_VECTOR_TILES_DEBUG === 'true' || false,
    tileServerUrl: process.env.REACT_APP_TILE_SERVER_URL || ''
  }
};

// Runtime feature flag management
export const VectorTileFeatureFlag = {
  isEnabled: () => {
    // Prioritize environment variable over localStorage
    if (process.env.REACT_APP_ENABLE_VECTOR_TILES === 'true') {
      return true;
    }
    
    // Fallback to localStorage
    if (localStorage.getItem('vector_tiles_enabled') === 'true') {
      return true;
    }
    
    // Fallback to window variable
    if (window.VECTOR_TILES_ENABLED === true) {
      return true;
    }
    
    return false;
  },
  
  enable: () => {
    localStorage.setItem('vector_tiles_enabled', 'true');
    window.location.reload();
  },
  
  disable: () => {
    localStorage.setItem('vector_tiles_enabled', 'false');
    window.location.reload();
  },
  
  toggle: () => {
    const current = VectorTileFeatureFlag.isEnabled();
    if (current) {
      VectorTileFeatureFlag.disable();
    } else {
      VectorTileFeatureFlag.enable();
    }
  }
};

// Check if we should use vector tiles at current zoom
export const shouldUseVectorTiles = (zoom) => {
  return VectorTileFeatureFlag.isEnabled() && zoom >= FEATURE_FLAGS.VECTOR_TILES.minZoom;
};
