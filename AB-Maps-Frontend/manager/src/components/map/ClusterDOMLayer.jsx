import { Marker } from 'react-leaflet';
import { useMemo } from 'react';
import L from 'leaflet';
import '../ui/ClusterBadge.css';

/**
 * DOM layer for cluster bubbles with numbers
 * 
 * @param {Array} items - Array of cluster objects: [{ cluster_id, point_count, lat, lng }]
 * @param {string} color - Circle color (e.g. '#2C3E50' or '#1976d2')
 * @param {Function} onClick - Click handler: (cluster) => void
 * @param {string} pane - Leaflet pane name (default 'clusterPane')
 */
export default function ClusterDOMLayer({ items, color, onClick, pane = 'clusterPane', beforeClusterClick }) {
  const makeIcon = useMemo(
    () => (count) =>
      L.divIcon({
        className: 'cluster-badge',
        html: `
          <div style="
            background:${color};
            color:#fff;
            width:40px;height:40px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,.18);
            font-weight:700; font-size:14px;">
            ${count}
          </div>`,
        iconSize: [40, 40],
      }),
    [color]
  );

  return (items || []).map((c) => (
    <Marker
      key={`cluster-${c.cluster_id}-${c.point_count}`}
      position={[c.lat, c.lng]}
      icon={makeIcon(c.point_count)}
      pane={pane}
      eventHandlers={{
        mousedown: (e) => {
          e?.originalEvent?.stopPropagation?.();
          if (typeof beforeClusterClick === 'function') beforeClusterClick();
        },
        touchstart: (e) => {
          e?.originalEvent?.stopPropagation?.();
          if (typeof beforeClusterClick === 'function') beforeClusterClick();
        },
        click: (e) => {
          e?.originalEvent?.stopPropagation?.();
          if (typeof beforeClusterClick === 'function') beforeClusterClick();
          onClick(c);
        }
      }}
    />
  ));
}
