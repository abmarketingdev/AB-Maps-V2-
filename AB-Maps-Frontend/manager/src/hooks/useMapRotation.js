import { useState, useCallback } from 'react';
import { SAFE_RENDER_MODE, DISABLE_ROTATION_ON_MOBILE, isMobile } from '../config/mapFlags.js';

/**
 * Custom hook for managing map rotation state and functionality
 */
const useMapRotation = (initialBearing = 0) => {
  const [bearing, setBearing] = useState(initialBearing);
  const [isRotationEnabled, setIsRotationEnabled] = useState(true);
  const [isTouchRotationEnabled, setIsTouchRotationEnabled] = useState(true);

  const handleRotationChange = useCallback((newBearing) => {
    setBearing(newBearing);
  }, []);

  const resetRotation = useCallback(() => {
    setBearing(0);
  }, []);

  const rotateTo = useCallback((angle) => {
    setBearing(angle);
  }, []);

  const toggleRotation = useCallback(() => {
    setIsRotationEnabled(prev => !prev);
  }, []);

  const toggleTouchRotation = useCallback(() => {
    setIsTouchRotationEnabled(prev => !prev);
  }, []);

  return {
    bearing,
    isRotationEnabled,
    isTouchRotationEnabled,
    handleRotationChange,
    resetRotation,
    rotateTo,
    toggleRotation,
    toggleTouchRotation
  };
};

export default useMapRotation; 