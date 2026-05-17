import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Component to handle map events like clicks (Employee Interface)
 * ENHANCED: Better integration with click guard system and touch events
 */
const MapEvents = ({ onMapClick, clickGuardState }) => {
  const map = useMap();

  useEffect(() => {
    const handlePreclick = (e) => {
      if (
        clickGuardState?.shouldSuppressMapClick?.() ||
        clickGuardState?.hasUploadedPopupOpen?.() ||
        clickGuardState?.hasAddressMarkerPopupOpen?.()
      ) {
        // swallow BEFORE map 'click' triggers
        try {
          if (e?.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
          }
        } catch (error) {
          // Ignore errors if methods don't exist
        }
        return;
      }
    };

    const handleClick = (e) => {
      // 🟢 DEBUGGING: Log incoming map click event
      let stackTrace = null;
      try {
        stackTrace = new Error().stack?.split('\n').slice(1, 5);
      } catch (err) {
        // Ignore stack trace errors
      }
      
      console.log('🟢 [MapEvents] Click event received:', {
        hasEvent: !!e,
        hasLatLng: !!e?.latlng,
        latlngType: typeof e?.latlng,
        latlngValue: e?.latlng,
        latlngLat: e?.latlng?.lat,
        latlngLng: e?.latlng?.lng,
        hasOriginalEvent: !!e?.originalEvent,
        originalEventType: e?.originalEvent?.type,
        target: e?.originalEvent?.target,
        targetTagName: e?.originalEvent?.target?.tagName,
        targetClassName: e?.originalEvent?.target?.className,
        isVectorTile: e?.originalEvent?.target?.tagName === 'CANVAS',
        timestamp: Date.now(),
        stackTrace: stackTrace
      });
      
      // CRITICAL: Check if click is from vector tile layer - ignore it completely
      // Vector tiles handle their own clicks, so we must not process them here
      let el = e.originalEvent?.target;
      while (el) {
        // Check if click is from vector tile canvas
        if (el.tagName === 'CANVAS' && 
            (el.closest('.leaflet-vectorgrid') || 
             el.classList?.contains('leaflet-vectorgrid-canvas'))) {
          // This is a vector tile click - let VectorTileLayer handle it
          console.log('🚫 [MapEvents] Vector tile click detected - ignoring');
          return;
        }
        // Check for rotation control classes
        if (el.classList && (
          el.classList.contains('simple-rotation-control') ||
          el.classList.contains('rotation-control') ||
          el.classList.contains('leaflet-control') ||
          el.classList.contains('ui-control') ||
          el.classList.contains('map-ui-control') ||
          el.classList.contains('uploaded-address-icon') ||
          // Removed: regular-address-cluster and uploaded-address-cluster class checks - no longer used with vector tiles
          el.classList.contains('floating-uploaded-address-popup') || // ENHANCED: Prevent map clicks when popup is open
          el.classList.contains('floating-address-popup') // ENHANCED: Prevent map clicks when address popup is open
        )) {
          return; // Ignore this click
        }
        el = el.parentElement;
      }
      
      // ENHANCED: Check if we should suppress this map click
      if (clickGuardState && (
        (clickGuardState.hasUploadedPopupOpen && clickGuardState.hasUploadedPopupOpen()) ||
        (clickGuardState.hasAddressMarkerPopupOpen && clickGuardState.hasAddressMarkerPopupOpen())
      )) {
        return;
      }
      
      // ENHANCED: Check suppression timing
      if (clickGuardState && clickGuardState.shouldSuppressMapClick && clickGuardState.shouldSuppressMapClick()) {
        return;
      }
      
      // Only call onMapClick if it's a genuine map click with valid latlng
      if (!e.latlng) {
        let stackTrace = null;
        try {
          stackTrace = new Error().stack;
        } catch (err) {
          // Ignore stack trace errors
        }
        
        console.error('❌ [MapEvents] Event with NO latlng received!', {
          event: e,
          type: e?.type,
          originalEvent: e?.originalEvent,
          target: e?.originalEvent?.target,
          fullEventKeys: Object.keys(e || {}),
          timestamp: Date.now(),
          stackTrace: stackTrace
        });
        return;
      }
      
      // Validate that latlng has valid lat/lng properties
      if (typeof e.latlng.lat !== 'number' || typeof e.latlng.lng !== 'number' ||
          isNaN(e.latlng.lat) || isNaN(e.latlng.lng)) {
        let stackTrace = null;
        try {
          stackTrace = new Error().stack;
        } catch (err) {
          // Ignore stack trace errors
        }
        
        console.error('❌ [MapEvents] e.latlng has invalid coordinates:', {
          latlng: e.latlng,
          lat: e.latlng?.lat,
          lng: e.latlng?.lng,
          latType: typeof e.latlng?.lat,
          lngType: typeof e.latlng?.lng,
          event: e,
          timestamp: Date.now(),
          stackTrace: stackTrace
        });
        return;
      }
      
      // Ensure it's a proper Leaflet LatLng object
      const validLatLng = e.latlng instanceof L.LatLng 
        ? e.latlng 
        : L.latLng(e.latlng.lat, e.latlng.lng);
      
      console.log('📞 [MapEvents] Calling onMapClick with valid latlng:', {
        validLatLng,
        lat: validLatLng.lat,
        lng: validLatLng.lng,
        timestamp: Date.now()
      });
      
      onMapClick?.(validLatLng, e);
      
      console.log('✅ [MapEvents] onMapClick call completed');
    };

    map.on("preclick", handlePreclick);
    map.on("click", handleClick);
    return () => {
      map.off("preclick", handlePreclick);
      map.off("click", handleClick);
    };
  }, [map, onMapClick, clickGuardState]);

  return null;
};

export default MapEvents;
