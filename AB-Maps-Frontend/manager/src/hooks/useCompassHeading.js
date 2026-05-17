import { useEffect, useState, useCallback } from 'react';

// Map heading degrees to cardinal direction
const toCardinal = (deg) => {
  if (deg == null || isNaN(deg)) return null;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const ix = Math.round(deg / 45) % 8;
  return dirs[ix];
};

/**
 * Hook to read device compass heading on mobile.
 * Handles iOS permission prompt and falls back gracefully when unavailable.
 */
const useCompassHeading = () => {
  const [heading, setHeading] = useState(null); // 0-360
  const [hasPermission, setHasPermission] = useState(null); // null=unknown, true/false

  const handleOrientation = useCallback((e) => {
    // Prefer absolute heading when available
    let alpha = e.absolute ? e.alpha : e.webkitCompassHeading || e.alpha;

    // Some browsers report 0-360 clockwise from North; others need transformation
    if (typeof e.webkitCompassHeading === 'number') {
      // iOS: already compass heading
      setHeading(e.webkitCompassHeading);
      return;
    }
    if (typeof alpha === 'number') {
      // Best-effort normalize
      const normalized = (360 - alpha) % 360; // convert from device alpha to compass-like heading
      setHeading(normalized);
    }
  }, []);

  // Request permission on iOS 13+
  const requestPermission = useCallback(async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        setHasPermission(res === 'granted');
        return res === 'granted';
      }
      // Non-iOS: assume permitted
      setHasPermission(true);
      return true;
    } catch (e) {
      setHasPermission(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let cleanup = () => {};
    const enable = async () => {
      // For iOS, hasPermission remains null until request; attach listener only when allowed
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        if (hasPermission !== true) {
          return; // wait until user requests
        }
      } else {
        // Other platforms: assume allowed
        setHasPermission(true);
      }

      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      cleanup = () => {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      };
    };

    enable();
    return cleanup;
  }, [handleOrientation, hasPermission]);

  const direction = heading == null ? null : toCardinal(heading);
  return { heading, direction, hasPermission, requestPermission };
};

export default useCompassHeading;


