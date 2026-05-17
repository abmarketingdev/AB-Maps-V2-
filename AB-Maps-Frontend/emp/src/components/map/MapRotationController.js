import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-rotate';
import { SAFE_RENDER_MODE, DISABLE_ROTATION_ON_MOBILE } from '../../config/mapFlags.js';
import useMobileDetection from '../../hooks/useMobileDetection';

/**
 * Component for handling map rotation functionality
 * Enables rotation with touch gestures and provides rotation controls
 */
const MapRotationController = ({ 
  enableRotation = true, 
  enableTouchRotation = true,
  enableRotationControl = true,
  initialBearing = 0,
  onRotationChange
}) => {
  const map = useMap();
  const rotationControlRef = useRef(null);
  const [showTouchHint, setShowTouchHint] = useState(false);
  const isMobile = useMobileDetection();

  useEffect(() => {
    if (!map || !enableRotation) return;

    // Set initial bearing
    if (initialBearing !== 0) {
      map.setBearing(initialBearing);
    }

    // Enable touch rotation if specified
    if (enableTouchRotation) {
      map.options.touchRotate = true;
      // Additional touch rotation options for better mobile experience
      map.options.touchRotateOptions = {
        // Minimum number of fingers required for rotation
        minFingers: 2,
        // Maximum rotation speed (degrees per pixel)
        maxRotationSpeed: 2,
        // Enable rotation with two-finger gesture
        enableTwoFingerRotation: true
      };
    }

    // Add rotation control if specified
    if (enableRotationControl) {
      const rotationControl = L.control.rotate({
        position: 'topright',
        closeOnZeroBearing: false
      });
      
      rotationControl.addTo(map);
      rotationControlRef.current = rotationControl;
    }

    // Listen for rotation changes
    const handleRotationChange = () => {
      if (!onRotationChange) return;
      const shouldDisableRotation = SAFE_RENDER_MODE && DISABLE_ROTATION_ON_MOBILE && isMobile;
      const b = shouldDisableRotation ? 0 : (map.getBearing?.() ?? 0);
      onRotationChange(b);
    };

    // Listen for touch events (no hint needed)
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length >= 2) {
        console.log('🔄 Two-finger touch detected for rotation');
      }
    };

    map.on('rotate', handleRotationChange);
    map.on('touchstart', handleTouchStart);

    return () => {
      // Cleanup
      if (rotationControlRef.current) {
        map.removeControl(rotationControlRef.current);
      }
      map.off('rotate', handleRotationChange);
      map.off('touchstart', handleTouchStart);
    };
  }, [map, enableRotation, enableTouchRotation, enableRotationControl, initialBearing, onRotationChange]);

  // Handle bearing changes from parent
  useEffect(() => {
    if (map && enableRotation && initialBearing !== map.getBearing()) {
      map.setBearing(initialBearing);
    }
  }, [map, enableRotation, initialBearing]);

  return null;
};

export default MapRotationController; 