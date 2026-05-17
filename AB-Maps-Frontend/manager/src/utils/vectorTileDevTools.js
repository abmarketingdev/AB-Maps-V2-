import { VectorTileFeatureFlag } from '../config/featureFlags';
import L from 'leaflet';

// Expose developer tools in console
if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_VECTOR_TILES_DEBUG === 'true') {
  window.VectorTileDevTools = {
    // Force enable vector tiles (override localStorage)
    forceEnable: () => {
      localStorage.setItem('vector_tiles_enabled', 'true');
      console.log('✅ Vector tiles force enabled! Refresh the page.');
    },
    
    // Force disable vector tiles
    forceDisable: () => {
      localStorage.setItem('vector_tiles_enabled', 'false');
      console.log('❌ Vector tiles force disabled! Refresh the page.');
    },
    
    // Debug current state
    getState: () => {
      const map = window.mapInstance; // Assuming map is exposed
      if (!map) return 'Map not found';
      
      const layers = [];
      map.eachLayer((layer) => {
        if (layer._url && layer._url.includes('.pbf')) {
          layers.push({
            url: layer._url,
            tiles: Object.keys(layer._tiles || {}).length,
            loading: layer._loading || false
          });
        }
      });
      
      return {
        enabled: VectorTileFeatureFlag.isEnabled(),
        zoom: map.getZoom(),
        center: map.getCenter(),
        vectorLayers: layers,
        visibleTiles: document.querySelectorAll('.leaflet-tile').length
      };
    },
    
    // Force refresh all tiles
    refreshAll: () => {
      const map = window.mapInstance;
      if (!map) return;
      
      map.eachLayer((layer) => {
        if (layer.redraw) {
          layer.redraw();
        }
      });
    },
    
    // Show tile grid overlay
    showTileGrid: () => {
      const map = window.mapInstance;
      if (!map || window._tileGridLayer) return;
      
      window._tileGridLayer = L.gridLayer({
        tileSize: 256,
        opacity: 0.5
      });
      
      window._tileGridLayer.createTile = function(coords) {
        const tile = document.createElement('div');
        tile.style.outline = '1px solid red';
        tile.style.color = 'red';
        tile.style.fontSize = '12px';
        tile.style.padding = '5px';
        tile.style.fontWeight = 'bold';
        tile.style.background = 'rgba(255, 255, 255, 0.8)';
        tile.innerHTML = `${coords.z}/${coords.x}/${coords.y}`;
        return tile;
      };
      
      window._tileGridLayer.addTo(map);
    },
    
    hideTileGrid: () => {
      if (window._tileGridLayer && window.mapInstance) {
        window.mapInstance.removeLayer(window._tileGridLayer);
        window._tileGridLayer = null;
      }
    },
    
    // Performance profiling
    profileTileLoad: async () => {
      console.log('Starting tile load profiling...');
      const results = [];
      
      // Hook into tile events temporarily
      const map = window.mapInstance;
      if (!map) return;
      
      const handler = (e) => {
        if (e.tile) {
          results.push({
            coords: e.coords,
            loadTime: e.tile._loadTime || 0,
            features: Object.keys(e.tile._features || {}).length
          });
        }
      };
      
      map.eachLayer((layer) => {
        if (layer.on && layer._url && layer._url.includes('.pbf')) {
          layer.on('tileload', handler);
        }
      });
      
      // Move map to trigger tile loads
      const startPos = map.getCenter();
      map.panBy([100, 100]);
      await new Promise(r => setTimeout(r, 2000));
      map.panTo(startPos);
      await new Promise(r => setTimeout(r, 2000));
      
      // Remove handler
      map.eachLayer((layer) => {
        if (layer.off && layer._url && layer._url.includes('.pbf')) {
          layer.off('tileload', handler);
        }
      });
      
      // Report results
      const avgLoadTime = results.length ? 
        results.reduce((sum, r) => sum + r.loadTime, 0) / results.length : 0;
      
      console.table(results);
      console.log(`Average load time: ${avgLoadTime.toFixed(2)}ms`);
      console.log(`Total tiles loaded: ${results.length}`);
      
      return results;
    },
    
    // Check campaign filtering
    checkCampaignFilter: () => {
      const map = window.mapInstance;
      if (!map) return 'Map not found';
      
      let tileUrls = [];
      map.eachLayer((layer) => {
        if (layer._url && layer._url.includes('.pbf')) {
          // Get a sample tile URL
          const tiles = layer._tiles || {};
          const firstTile = Object.values(tiles)[0];
          if (firstTile && firstTile.el && firstTile.el.src) {
            tileUrls.push(firstTile.el.src);
          }
        }
      });
      
      console.log('Vector tile URLs with campaign filtering:');
      tileUrls.forEach(url => {
        console.log(url);
        const urlObj = new URL(url);
        console.log('Query params:', Object.fromEntries(urlObj.searchParams));
      });
      
      return tileUrls;
    }
  };
  
  console.log('%c Vector Tile Dev Tools loaded! ', 'background: #3388ff; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  console.log('Access via window.VectorTileDevTools');
  console.log('Commands: forceEnable(), forceDisable(), getState(), showTileGrid(), profileTileLoad(), checkCampaignFilter()');
}
