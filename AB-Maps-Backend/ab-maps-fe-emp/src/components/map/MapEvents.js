import React from 'react';
import { useMapEvents } from 'react-leaflet';

/**
 * Component to handle map events like clicks (Employee Interface)
 */
const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    }
  });

  return null;
};

export default MapEvents;
