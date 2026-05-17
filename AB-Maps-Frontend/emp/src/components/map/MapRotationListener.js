import React, { useEffect } from 'react';

/**
 * Component to listen for map rotation changes
 */
const MapRotationListener = ({ map, onRotationChange }) => {
  useEffect(() => {
    if (!map || !onRotationChange) return;

    const handleRotationChange = () => {
      const currentBearing = map.getBearing();
      onRotationChange(currentBearing);
    };

    // Listen for rotation changes
    map.on('rotate', handleRotationChange);

    // Set initial bearing
    const initialBearing = map.getBearing();
    if (initialBearing !== 0) {
      onRotationChange(initialBearing);
    }

    return () => {
      map.off('rotate', handleRotationChange);
    };
  }, [map, onRotationChange]);

  return null;
};

export default MapRotationListener; 