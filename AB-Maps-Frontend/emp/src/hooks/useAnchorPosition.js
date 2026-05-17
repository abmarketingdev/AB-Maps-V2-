import { useLayoutEffect, useRef, useCallback } from 'react';

/**
 * Hook to anchor a popup to a map position with bullet-proof positioning
 * Handles all map events (move, zoom, rotate) to keep popup in sync
 */
function useAnchorPosition(map, latlng, elementRef) {
  const styleRef = useRef({ left: 0, top: 0 });

  const update = useCallback(() => {
    if (!map || !latlng || !elementRef?.current) return;
    
    try {
      const pt = map.latLngToContainerPoint(latlng);           // container coords
      const rect = map.getContainer().getBoundingClientRect(); // page coords
      
      styleRef.current = { 
        left: rect.left + pt.x, 
        top: rect.top + pt.y 
      };
      
      if (elementRef.current?.style) {
        Object.assign(elementRef.current.style, {
          left: `${styleRef.current.left}px`,
          top: `${styleRef.current.top}px`
        });
      }
    } catch (error) {
      console.warn('Error updating anchor position:', error);
    }
  }, [map, latlng, elementRef]);

  useLayoutEffect(() => {
    update(); // initial positioning
    
    if (!map) return;
    
    // Subscribe to all map events that affect positioning
    const events = ['move', 'zoom', 'zoomend', 'moveend', 'resize', 'rotate'];
    events.forEach(event => map.on(event, update));
    
    return () => {
      // Clean up all event listeners
      events.forEach(event => map.off(event, update));
    };
  }, [map, update]);

  return styleRef;
}

export default useAnchorPosition;
