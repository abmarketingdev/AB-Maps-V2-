import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import './OptimisticMarkerOverlay.css';

export default function OptimisticMarkerOverlay({ markers = [] }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    // Create pane for optimistic markers
    if (!map.getPane('optimistic-pane')) {
      const pane = map.createPane('optimistic-pane');
      pane.style.zIndex = 601; // Above vector tiles
    }
    
    // Create markers
    const leafletMarkers = markers.map(marker => {
      const icon = L.divIcon({
        className: 'optimistic-marker',
        html: `<div class="optimistic-marker-inner status-${marker.status}">
                 <div class="optimistic-marker-pulse"></div>
               </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      return L.marker(marker.position, {
        icon,
        pane: 'optimistic-pane',
        interactive: false
      }).addTo(map);
    });
    
    // Cleanup
    return () => {
      leafletMarkers.forEach(m => map.removeLayer(m));
    };
  }, [map, markers]);
  
  return null;
}
