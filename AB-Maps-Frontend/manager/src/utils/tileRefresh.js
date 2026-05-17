// Utility functions for tile refreshing and management

/**
 * Refresh tiles by incrementing the version
 * @param {Function} setTilesVersion - State setter for tiles version
 */
export const refreshTiles = (setTilesVersion) => {
  // Increment version to force tile refresh
  setTilesVersion(v => v + 1);
};

/**
 * Refresh tiles with a delay
 * @param {Function} setTilesVersion - State setter for tiles version
 * @param {number} delay - Delay in milliseconds
 */
export const refreshTilesWithDelay = (setTilesVersion, delay = 500) => {
  setTimeout(() => {
    refreshTiles(setTilesVersion);
  }, delay);
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
 * Get all tile coordinates that need to be refreshed for a given bounds
 * @param {L.LatLngBounds} bounds - Leaflet bounds object
 * @param {number} zoom - Zoom level
 * @returns {Array} Array of tile coordinates
 */
export const getTileCoordsForBounds = (bounds, zoom) => {
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
 * Build tile URL with parameters
 * @param {string} baseUrl - Base tile URL template
 * @param {Object} coords - Tile coordinates {x, y, z}
 * @param {Object} params - Query parameters
 * @returns {string} Complete tile URL
 */
export const buildTileUrl = (baseUrl, coords, params = {}) => {
  const url = baseUrl
    .replace('{z}', coords.z)
    .replace('{x}', coords.x)
    .replace('{y}', coords.y);
  
  const queryParams = new URLSearchParams(params);
  const queryString = queryParams.toString();
  
  return queryString ? `${url}?${queryString}` : url;
};
