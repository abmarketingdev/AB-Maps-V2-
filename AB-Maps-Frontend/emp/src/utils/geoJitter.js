import L from 'leaflet';
import { SAFE_RENDER_MODE } from '../config/mapFlags.js';

/**
 * Return a small, stable offset position in *pixels* to separate overlapping points
 * Only applied at high zoom (>=18) so normal views are unchanged.
 * In safe mode, returns original coordinates without jitter.
 */
export function jitterLatLng(lat, lng, idOrSeed, map) {
  if (SAFE_RENDER_MODE) {
    console.log('🎯 [JITTER DEBUG] Safe mode enabled, returning original coordinates');
    return { lat, lng };
  }
  if (!map) return { lat, lng };
  
  const pt = map.latLngToLayerPoint([lat, lng]);

  // Create a deterministic "random" from the id/seed
  const seed = (typeof idOrSeed === 'string')
    ? [...idOrSeed].reduce((a, c) => a + c.charCodeAt(0), 0)
    : (idOrSeed ?? 0);

  // Golden-angle style spread
  const angle = (seed * 137.508) % 360;
  const r = 8 + (seed % 4) * 2; // 8..14 px
  const dx = r * Math.cos(angle * Math.PI / 180);
  const dy = r * Math.sin(angle * Math.PI / 180);

  const p2 = L.point(pt.x + dx, pt.y + dy);
  const ll = map.layerPointToLatLng(p2);
  return { lat: ll.lat, lng: ll.lng };
}

