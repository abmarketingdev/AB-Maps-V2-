import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { createRoot } from 'react-dom/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndo } from '@fortawesome/free-solid-svg-icons';

const UndoButton = ({ onUndo }) => {
  const map = useMap();
  const rootRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const CustomControl = L.Control.extend({
      onAdd: function (map) {
        const container = L.DomUtil.create('div', 'undo-control leaflet-bar');
        
        // This is the key: stop all clicks from propagating to the map
        L.DomEvent.disableClickPropagation(container);
        
        rootRef.current = createRoot(container);
        rootRef.current.render(
          <button onClick={onUndo} title="Angre siste punkt">
            <FontAwesomeIcon icon={faUndo} />
          </button>
        );
        
        return container;
      },

      onRemove: function (map) {
        // Defer unmounting to avoid race conditions with React's render cycle
        setTimeout(() => {
          if (rootRef.current) {
            rootRef.current.unmount();
            rootRef.current = null;
          }
        }, 0);
      },
    });

    const control = new CustomControl({ position: 'topleft' });
    map.addControl(control);

    return () => {
      if (map && control) {
        map.removeControl(control);
      }
    };
  }, [map, onUndo]);

  return null; // The component renders itself into the map, not here
};

export default UndoButton; 