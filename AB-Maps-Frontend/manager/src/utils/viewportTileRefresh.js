// Utility functions for viewport-specific tile refreshing

/**
 * Force refresh tiles after address creation/modification
 * Simply increments version - browser + ETag handle freshness automatically
 * @param {Function} setTilesVersion - State setter for tiles version
 */
export const forceViewportTileRefresh = (setTilesVersion) => {
  // Simply increment version - browser + ETag will handle freshness
  setTilesVersion(v => v + 1);
};

/**
 * Standard tile refresh (uses browser cache when appropriate)
 * @param {Function} setTilesVersion - State setter for tiles version
 */
export const refreshTiles = (setTilesVersion) => {
  setTilesVersion(v => v + 1);
};

/**
 * Calculate tile coordinates for a given lat/lng and zoom
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude  
 * @param {number} zoom - Zoom level
 * @returns {Object} Tile coordinates {x, y, z}
 */
export const getTileCoords = (lat, lng, zoom) => {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 
    1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y, z: zoom };
};

/**
 * Get all tile coordinates that need to be refreshed for current viewport
 * @param {L.LatLngBounds} bounds - Leaflet bounds object
 * @param {number} zoom - Zoom level
 * @returns {Array} Array of tile coordinates
 */
export const getViewportTileCoords = (bounds, zoom) => {
  const tiles = [];
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  const swTile = getTileCoords(sw.lat, sw.lng, zoom);
  const neTile = getTileCoords(ne.lat, ne.lng, zoom);
  
  for (let x = swTile.x; x <= neTile.x; x++) {
    for (let y = neTile.y; y <= swTile.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  
  return tiles;
};

/**
 * Check if a position is within current viewport
 * @param {L.Map} mapRef - Leaflet map instance
 * @param {Object} position - Position {lat, lng}
 * @returns {boolean} True if position is in viewport
 */
export const isPositionInViewport = (mapRef, position) => {
  if (!mapRef || !mapRef.getBounds || !position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
    return false;
  }
  
  const bounds = mapRef.getBounds();
  return bounds.contains([position.lat, position.lng]);
};

/**
 * Enhanced refresh that only forces refresh if position is in current viewport
 * @param {Function} setTilesVersion - State setter for tiles version
 * @param {L.Map} mapRef - Leaflet map instance
 * @param {Object} modifiedPosition - Position that was modified {lat, lng}
 */
export const smartViewportRefresh = (setTilesVersion, mapRef, modifiedPosition) => {
  const inViewport = isPositionInViewport(mapRef, modifiedPosition);
  
  if (inViewport) {
    forceViewportTileRefresh(setTilesVersion);
  } else {
    refreshTiles(setTilesVersion);
  }
};
