import React, { useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import useAddressLookup from '../../hooks/useAddressLookup';
import LoadingIndicator from '../ui/LoadingIndicator';

/**
 * Component to handle map events like clicks and mouse movements
 * 
 * IMPORTANT: Uses refs to ensure event handlers always have access to the latest props.
 * This is necessary because useMapEvents captures closures at mount time.
 */
const MapEvents = ({ onMapClick, onMapMove, shouldSuppressMapClick, onContextMenu, isDrawingEnabled, finishDrawing, cancelDrawing, completeDrawingManually, resolveTap, onZoomEnd }) => {
  // Use refs to always have the latest function references
  // This fixes the stale closure issue where useMapEvents captures the initial props
  const onMapClickRef = useRef(onMapClick);
  const onMapMoveRef = useRef(onMapMove);
  const shouldSuppressMapClickRef = useRef(shouldSuppressMapClick);
  const resolveTapRef = useRef(resolveTap);
  const onContextMenuRef = useRef(onContextMenu);
  const onZoomEndRef = useRef(onZoomEnd);
  
  // Keep refs updated with latest function references
  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onMapMoveRef.current = onMapMove;
    shouldSuppressMapClickRef.current = shouldSuppressMapClick;
    resolveTapRef.current = resolveTap;
    onContextMenuRef.current = onContextMenu;
    onZoomEndRef.current = onZoomEnd;
  }, [onMapClick, onMapMove, shouldSuppressMapClick, resolveTap, onContextMenu, onZoomEnd]);
  
  const map = useMapEvents({
    click: (e) => {
      console.log('🗺️ [MapEvents] Map click event received:', {
        hasEvent: !!e,
        hasLatLng: !!e?.latlng,
        latlngType: typeof e?.latlng,
        latlngValue: e?.latlng,
        hasOriginalEvent: !!e?.originalEvent,
        target: e?.originalEvent?.target,
        targetClassName: e?.originalEvent?.target?.className,
        targetNodeName: e?.originalEvent?.target?.nodeName,
        stackTrace: new Error().stack?.split('\n').slice(1, 6)
      });

      // Check guard first - use ref to get latest function
      if (typeof shouldSuppressMapClickRef.current === 'function' && shouldSuppressMapClickRef.current()) {
        console.log('🛑 [MapEvents] Map click suppressed by guard');
        return;
      }
      
      // Only ignore clicks that originate from inside existing popup content
      // Allow clicks on the map itself to create new popups
      const target = e?.originalEvent?.target;
      // Debug
      try { console.log('[MapEvents.click] target:', target?.className || target?.nodeName); } catch {}
      // If a higher-level resolver handles a point/cluster hit, stop here
      if (typeof resolveTapRef.current === 'function') {
        try {
          console.log('🔍 [MapEvents] Checking resolveTap...');
          const consumed = resolveTapRef.current(e.latlng, e);
          if (consumed) {
            console.log('✅ [MapEvents] Tap resolved by higher-level handler');
            return;
          }
        } catch (resolveError) {
          console.error('🚨 [MapEvents] Error in resolveTap:', resolveError);
        }
      }
      if (target && (
        target.closest?.('.leaflet-popup-content') ||
        target.closest?.('.leaflet-popup') ||
        target.closest?.('.area-popup') ||
        target.closest?.('.floating-address-popup') ||
        target.closest?.('.floating-address-marker-popup') ||
        target.closest?.('.floating-uploaded-address-popup') ||
        target.closest?.('.floating-forbidden-popup') ||
        target.closest?.('.ffp-close') ||
        target.closest?.('.forbidden-backdrop') ||
        target.closest?.('.popup-backdrop')
      )) {
        try { console.log('[MapEvents.click] Ignored due to popup/backdrop target'); } catch {}
        return;
      }

      // Check if the click originated from inside a UI element
      let el = e.originalEvent?.target;
      while (el) {
        // Check for rotation control classes
        if (el.classList && (
          el.classList.contains('rotation-control-root') ||
          el.classList.contains('rotation-control') ||
          el.classList.contains('simple-rotation-control') ||
          el.classList.contains('leaflet-control') ||
          el.classList.contains('ui-control') ||
          el.classList.contains('map-ui-control') ||
          el.classList.contains('uploaded-address-icon') ||
          el.classList.contains('regular-address-cluster') ||
          el.classList.contains('uploaded-address-cluster')
        )) {
          return; // Ignore this click
        }
        
        // Check for our custom floating popups
        if (el.classList && (
          el.classList.contains('floating-address-popup') ||
          el.classList.contains('floating-address-marker-popup') ||
          el.classList.contains('floating-uploaded-address-popup') ||
          el.classList.contains('popup-backdrop')
        )) {
          return; // Ignore this click
        }
        
        el = el.parentElement;
      }
      
      // Only call onMapClick if it's a genuine map click - use ref to get latest function
      try { 
        console.log('🗺️ [MapEvents.click] Genuine map click at', e.latlng, {
          timestamp: Date.now(),
          eventTarget: e.originalEvent?.target?.className || 'unknown',
          eventPhase: e.originalEvent?.eventPhase,
          bubbles: e.originalEvent?.bubbles,
          cancelable: e.originalEvent?.cancelable,
          latlngType: typeof e.latlng,
          latlngLat: e.latlng?.lat,
          latlngLng: e.latlng?.lng,
          stackTrace: new Error().stack?.split('\n').slice(1, 6)
        }); 
        console.log('📞 [MapEvents] Calling onMapClickRef.current...');
        onMapClickRef.current(e.latlng);
        console.log('✅ [MapEvents] onMapClick call completed');
      } catch (error) {
        console.error('🚨 [MapEvents] Error in map click handler:', error);
        console.error('🚨 [MapEvents] Event that caused error:', e);
      }
    },
    contextmenu: (e) => {
      // Right-click/long-press for area config - use ref
      if (typeof shouldSuppressMapClickRef.current === 'function' && shouldSuppressMapClickRef.current()) return;
      const target = e?.originalEvent?.target;
      try { console.log('[MapEvents.contextmenu] received at', e.latlng, 'target:', target?.className || target?.nodeName); } catch {}
      if (target && (
        target.closest?.('.leaflet-popup') || 
        target.closest?.('.address-popup') ||
        target.closest?.('.floating-address-popup') ||
        target.closest?.('.floating-address-marker-popup') ||
        target.closest?.('.floating-uploaded-address-popup') ||
        target.closest?.('.floating-forbidden-popup') ||
        target.closest?.('.ffp-close') ||
        target.closest?.('.forbidden-backdrop') ||
        target.closest?.('.popup-backdrop')
      )) return;
      if (typeof onContextMenuRef.current === 'function') {
        try { console.log('[MapEvents.contextmenu] Dispatching to onContextMenu'); } catch {}
        onContextMenuRef.current(e.latlng, e);
      }
    },
    mousemove: (e) => {
      onMapMoveRef.current(e);
    },
    zoomend: (e) => {
      if (typeof onZoomEndRef.current === 'function') {
        onZoomEndRef.current(map.getZoom());
      }
    }
  });

  // Add keyboard event listener for Enter key to finish drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isDrawingEnabled) {
        if (e.key === 'Enter') {
          completeDrawingManually ? completeDrawingManually() : finishDrawing();
        } else if (e.key === 'Escape') {
          cancelDrawing();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawingEnabled, finishDrawing, cancelDrawing, completeDrawingManually]);

  return null;
};

export default MapEvents;
