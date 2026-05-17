import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

/**
 * Simple cluster marker component that doesn't rely on complex panes
 */
const SimpleClusterMarker = ({ cluster, color, onClick }) => {
  const icon = L.divIcon({
    className: 'simple-cluster-marker',
    html: `
      <div style="
        background: ${color};
        color: white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
        border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      ">
        ${cluster.point_count}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onClick && onClick(cluster)
      }}
    />
  );
};

export default SimpleClusterMarker;

