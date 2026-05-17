import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { createRoot } from 'react-dom/client';

/**
 * Component for map toolbar with drawing controls
 */
const Toolbar = ({ isDrawingEnabled, onToggleDrawing }) => {
  const map = useMap();
  const rootRef = useRef(null);
  const controlRef = useRef(null);

  useEffect(() => {
    if (map && !controlRef.current) {
      const CustomControl = L.Control.extend({
        onAdd: function (map) {
          const container = L.DomUtil.create('div', 'leaflet-bar toolbar-container');
          
          // This is the key: stop all clicks from propagating to the map, guaranteed.
          L.DomEvent.disableClickPropagation(container);
          
          rootRef.current = createRoot(container);
          rootRef.current.render(
            <label className="drawing-mode-switch">
              <span>Tegnemodus</span>
              <input
                type="checkbox"
                checked={isDrawingEnabled}
                onChange={onToggleDrawing}
              />
              <span className="slider round"></span>
            </label>
          );
          
          return container;
        },
        onRemove: function (map) {
          if (rootRef.current) {
            rootRef.current.unmount();
            rootRef.current = null;
          }
        },
      });

      const control = new CustomControl({ position: 'topleft' });
      map.addControl(control);
      controlRef.current = control;
    }

    // This part handles dynamically updating the 'checked' state of the input
    if (rootRef.current) {
      rootRef.current.render(
        <label className="drawing-mode-switch">
          <span>Tegnemodus</span>
          <input
            type="checkbox"
            checked={isDrawingEnabled}
            onChange={onToggleDrawing}
          />
          <span className="slider round"></span>
        </label>
      );
    }

  }, [map, isDrawingEnabled, onToggleDrawing]);

  return null; // The component renders itself into the map, not here
};

export default Toolbar;
