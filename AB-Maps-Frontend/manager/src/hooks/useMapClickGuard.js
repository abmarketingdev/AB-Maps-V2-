import { useRef, useCallback } from 'react';

/**
 * Guard to:
 *  - suppress the next map click (so clicking a feature or close button
 *    doesn't also trigger the map's 'click' -> placement popup)
 *  - pause cluster refresh briefly during popup open/close or flyTo/autopan,
 *    preventing flicker from data re-queries while popups animate.
 */
export default function useMapClickGuard() {
  const suppressNextMapClickRef = useRef(false);
  const pauseClusterRefreshRef  = useRef(false);

  const suppressNextMapClick = useCallback((ms = 200) => {
    console.log('🛡️ suppressNextMapClick called for', ms, 'ms');
    suppressNextMapClickRef.current = true;
    window.setTimeout(() => { 
      console.log('🛡️ suppressNextMapClick timeout expired - clicks now allowed');
      suppressNextMapClickRef.current = false; 
    }, ms);
  }, []);

  const shouldSuppressMapClick = useCallback(() => {
    const shouldSuppress = suppressNextMapClickRef.current;
    if (shouldSuppress) {
      console.log('🛡️ shouldSuppressMapClick: YES - click is being suppressed');
    }
    return shouldSuppress;
  }, []);

  const pauseClusterRefresh = useCallback((ms = 300) => {
    pauseClusterRefreshRef.current = true;
    window.setTimeout(() => { pauseClusterRefreshRef.current = false; }, ms);
  }, []);

  const isClusterRefreshPaused = useCallback(() => pauseClusterRefreshRef.current, []);

  return {
    suppressNextMapClick,
    shouldSuppressMapClick,
    pauseClusterRefresh,
    isClusterRefreshPaused,
  };
}
