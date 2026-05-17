import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import './RotationSafePopup.css';

// Hook to manage counter-rotated pane
export const useCounterRotatedPane = (bearing = 0) => {
  const map = useMap();
  const paneRef = useRef(null);
  
  useEffect(() => {
    if (!map) return;
    
    // Create pane if it doesn't exist
    if (!map.getPane('counter-rotated-pane')) {
      const pane = map.createPane('counter-rotated-pane');
      pane.style.zIndex = 650;
      pane.style.pointerEvents = 'none'; // Let events pass through initially
      paneRef.current = pane;
    }
    
    // Update rotation
    const pane = map.getPane('counter-rotated-pane');
    if (pane) {
      pane.style.transform = `rotate(${-bearing}deg)`;
      pane.style.transformOrigin = '50% 50%';
    }
  }, [map, bearing]);
  
  return paneRef.current;
};

// Rotation-safe popup component
export default function RotationSafePopup({
  position,
  children,
  isOpen,
  onClose,
  bearing = 0,
  offset = [0, -10],
  className = ''
}) {
  const map = useMap();
  const popupRef = useRef(null);
  const contentRef = useRef(null);
  
  useCounterRotatedPane(bearing);
  
  useEffect(() => {
    if (!map || !isOpen || !position) return;
    
    // Create a custom overlay for the popup
    const RotationSafeOverlay = L.Class.extend({
      initialize: function(latlng, content, options) {
        this._latlng = L.latLng(latlng);
        this._content = content;
        L.setOptions(this, options);
      },
      
      onAdd: function(map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 
          'rotation-safe-popup-container ' + className);
        
        // Prevent map interactions on popup
        L.DomEvent.disableClickPropagation(this._container);
        L.DomEvent.disableScrollPropagation(this._container);
        
        this._updateContent();
        this._updatePosition();
        
        const pane = map.getPane('counter-rotated-pane');
        pane.appendChild(this._container);
        pane.style.pointerEvents = 'auto';
        
        map.on('move zoom viewreset', this._updatePosition, this);
      },
      
      onRemove: function(map) {
        const pane = map.getPane('counter-rotated-pane');
        if (pane && this._container) {
          pane.removeChild(this._container);
          pane.style.pointerEvents = 'none';
        }
        map.off('move zoom viewreset', this._updatePosition, this);
        this._map = null;
      },
      
      _updateContent: function() {
        if (typeof this._content === 'string') {
          this._container.innerHTML = this._content;
        } else {
          this._container.innerHTML = '';
          this._container.appendChild(this._content);
        }
      },
      
      _updatePosition: function() {
        if (!this._map) return;
        
        const pos = this._map.latLngToLayerPoint(this._latlng);
        const offset = L.point(this.options.offset);
        const finalPos = pos.add(offset);
        
        // Apply counter-rotation at element level too for double safety
        L.DomUtil.setPosition(this._container, finalPos);
        this._container.style.transform += ` rotate(${bearing}deg)`;
      }
    });
    
    // Create wrapper div for React content
    const wrapper = document.createElement('div');
    wrapper.className = 'rotation-safe-popup-content';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rotation-safe-popup-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = onClose;
    wrapper.appendChild(closeBtn);
    
    // Content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'rotation-safe-popup-body';
    wrapper.appendChild(contentContainer);
    contentRef.current = contentContainer;
    
    // Create and add overlay
    const overlay = new RotationSafeOverlay(position, wrapper, { offset });
    overlay.addTo(map);
    popupRef.current = overlay;
    
    return () => {
      if (popupRef.current && map) {
        map.removeLayer(popupRef.current);
        popupRef.current = null;
      }
    };
  }, [map, isOpen, position, bearing, offset, className, onClose]);
  
  // Render React content into the popup
  useEffect(() => {
    if (contentRef.current && children && isOpen) {
      // Use React Portal to render content
      return () => {
        // Cleanup handled by portal
      };
    }
  }, [children, isOpen]);
  
  // Use portal to render children into the content container
  if (contentRef.current && isOpen && children) {
    return createPortal(children, contentRef.current);
  }
  
  return null;
}
