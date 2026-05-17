import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * Reusable wrapper for UI controls inside the map
 * Automatically prevents event propagation to the map
 */
const MapUIControl = ({ 
  children, 
  className = '', 
  style = {},
  onClick,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd,
  ...props 
}) => {
  const controlRef = useRef(null);

  useEffect(() => {
    if (controlRef.current && L.DomEvent) {
      // Use Leaflet's built-in event prevention
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  const handleEvent = (eventType) => (e) => {
    // Stop all event propagation
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation?.();
    if (e.preventDefault) e.preventDefault();
    
    // Call the original handler if provided
    const handler = props[eventType];
    if (handler) handler(e);
  };

  return (
    <div
      ref={controlRef}
      className={`map-ui-control ${className}`}
      style={{
        pointerEvents: 'auto',
        zIndex: 1000,
        ...style
      }}
      onClick={handleEvent('onClick')}
      onMouseDown={handleEvent('onMouseDown')}
      onMouseUp={handleEvent('onMouseUp')}
      onTouchStart={handleEvent('onTouchStart')}
      onTouchEnd={handleEvent('onTouchEnd')}
      {...props}
    >
      {children}
    </div>
  );
};

export default MapUIControl; 