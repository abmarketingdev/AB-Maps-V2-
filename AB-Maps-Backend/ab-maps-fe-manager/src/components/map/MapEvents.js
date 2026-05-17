import React, { useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';
import useAddressLookup from '../../hooks/useAddressLookup';
import LoadingIndicator from '../ui/LoadingIndicator';

/**
 * Component to handle map events like clicks and mouse movements
 */
const MapEvents = ({ onMapClick, onMapMove, isDrawingEnabled, finishDrawing, cancelDrawing }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
    mousemove: (e) => {
      onMapMove(e);
    }
  });

  // Add keyboard event listener for Enter key to finish drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isDrawingEnabled) {
        if (e.key === 'Enter') {
          finishDrawing();
        } else if (e.key === 'Escape') {
          cancelDrawing();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawingEnabled, finishDrawing, cancelDrawing]);

  return null;
};

export default MapEvents;
