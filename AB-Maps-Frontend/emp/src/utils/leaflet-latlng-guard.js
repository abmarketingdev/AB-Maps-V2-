// leaflet-latlng-guard.js
// Comprehensive Leaflet guard to prevent crashes from invalid latlng objects
// This prevents Leaflet from crashing when plugins hand it undefined latlng
// CRITICAL: Includes SphericalMercator.project guard to catch errors at the source

import L from 'leaflet';

// Debug tracking
const debugLog = (message, data = {}) => {
  console.log(`🛡️ [LeafletGuard] ${message}`, data);
};

// Error tracking
const errorTracker = {
  invalidLatLngs: [],
  callStacks: [],
  addInvalidLatLng: (latlng, stackTrace, eventType) => {
    const entry = {
      timestamp: new Date().toISOString(),
      latlng: latlng,
      eventType: eventType,
      stackTrace: stackTrace,
      latlngType: typeof latlng,
      latlngKeys: latlng ? Object.keys(latlng) : 'null/undefined'
    };
    errorTracker.invalidLatLngs.push(entry);
    errorTracker.callStacks.push(stackTrace);
    
    console.error('🚨 [LeafletGuard] Invalid latlng detected:', entry);
    
    // Keep only last 10 entries
    if (errorTracker.invalidLatLngs.length > 10) {
      errorTracker.invalidLatLngs.shift();
      errorTracker.callStacks.shift();
    }
  },
  getStackTrace: () => {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 8) : ['No stack trace available'];
  },
  report: () => {
    console.group('🛡️ [LeafletGuard] Error Report');
    console.log('Total invalid latlngs caught:', errorTracker.invalidLatLngs.length);
    errorTracker.invalidLatLngs.forEach((entry, i) => {
      console.log(`Entry ${i + 1}:`, entry);
    });
    console.groupEnd();
    return errorTracker.invalidLatLngs;
  }
};

// Expose error tracker globally for debugging
window.leafletGuardDebug = errorTracker;

// Only patch once
if (!L.Map.prototype.__latlngGuarded) {
  debugLog('Installing Leaflet guard patch...');
  
  // Check if Leaflet is properly initialized
  if (!L || !L.Map || !L.Map.prototype) {
    console.error('🚨 [LeafletGuard] Leaflet not properly initialized, skipping guard installation');
  } else {
  
  // Patch multiple Leaflet methods that could cause latlng crashes
  const __origFireDOMEvent = L.Map.prototype._fireDOMEvent;
  const __origLatLngToContainerPoint = L.Map.prototype.latLngToContainerPoint;
  const __origContainerPointToLatLng = L.Map.prototype.containerPointToLatLng;
  
  // 🔴 CRITICAL PATCH: SphericalMercator.project - catches errors at the SOURCE
  // This is the missing piece that prevents "Cannot read properties of undefined (reading 'lat')" errors
  const patchSphericalMercator = () => {
    try {
      if (L.Projection && L.Projection.SphericalMercator && L.Projection.SphericalMercator.prototype && L.Projection.SphericalMercator.prototype.project) {
        const __origProject = L.Projection.SphericalMercator.prototype.project;
        L.Projection.SphericalMercator.prototype.project = function(latlng) {
          debugLog('🎯 [LeafletGuard] SphericalMercator.project called', {
            latlng: latlng,
            latlngType: typeof latlng,
            hasLat: latlng?.lat !== undefined,
            hasLng: latlng?.lng !== undefined,
            latValue: latlng?.lat,
            lngValue: latlng?.lng,
            latlngKeys: latlng ? Object.keys(latlng) : 'null/undefined',
            stackTrace: new Error().stack?.split('\n').slice(1, 8)
          });
          
          try {
            if (!latlng || typeof latlng.lat !== 'number' || typeof latlng.lng !== 'number') {
              debugLog('🚨 [LeafletGuard] Invalid latlng in SphericalMercator.project:', {
                latlng: latlng,
                latType: typeof latlng?.lat,
                lngType: typeof latlng?.lng,
                latValue: latlng?.lat,
                lngValue: latlng?.lng,
                latlngKeys: latlng ? Object.keys(latlng) : 'null/undefined'
              });
              
              errorTracker.addInvalidLatLng(latlng, errorTracker.getStackTrace(), 'SphericalMercator.project');
              
              // Also track with vector tile debugger if available
              if (window.vectorTileDebugger) {
                window.vectorTileDebugger.trackInvalidLatLng(
                  latlng,
                  'SphericalMercator.project-invalid',
                  errorTracker.getStackTrace()
                );
              }
              
              // Return a safe default point
              return L.point(0, 0);
            }
            
            const result = __origProject.call(this, latlng);
            debugLog('✅ [LeafletGuard] SphericalMercator.project completed successfully', { result });
            return result;
          } catch (error) {
            console.error('🚨 [LeafletGuard] Error in SphericalMercator.project:', error);
            console.error('🚨 [LeafletGuard] Input latlng that caused error:', latlng);
            console.error('🚨 [LeafletGuard] Full error stack:', error.stack);
            
            errorTracker.addInvalidLatLng(latlng, errorTracker.getStackTrace(), 'SphericalMercator.project-error');
            
            // Also track with vector tile debugger if available
            if (window.vectorTileDebugger) {
              window.vectorTileDebugger.trackInvalidLatLng(
                latlng,
                'SphericalMercator.project-error',
                error.stack?.split('\n') || ['No stack trace']
              );
            }
            
            return L.point(0, 0);
          }
        };
        debugLog('✅ SphericalMercator.project patched');
        return true;
      } else {
        debugLog('⚠️ [LeafletGuard] SphericalMercator not ready for patching yet');
        return false;
      }
    } catch (error) {
      console.error('🚨 [LeafletGuard] Error patching SphericalMercator:', error);
      return false;
    }
  };

  // Try to patch immediately, if it fails, try again after a delay
  if (!patchSphericalMercator()) {
    debugLog('🔄 [LeafletGuard] Retrying SphericalMercator patch in 100ms...');
    setTimeout(() => {
      if (!patchSphericalMercator()) {
        debugLog('🔄 [LeafletGuard] Retrying SphericalMercator patch in 500ms...');
        setTimeout(patchSphericalMercator, 500);
      }
    }, 100);
  }
  
  // Continue with other patches even if SphericalMercator patch fails
  L.Map.prototype._fireDOMEvent = function (e, type, targets) {
    debugLog(`_fireDOMEvent called`, { 
      eventType: type, 
      hasEvent: !!e, 
      hasLatLng: !!e?.latlng,
      latlngType: typeof e?.latlng,
      latlngKeys: e?.latlng ? Object.keys(e.latlng) : 'none',
      eventKeys: e ? Object.keys(e) : 'no event',
      target: e?.originalEvent?.target?.className || 'no target',
      stackTrace: new Error().stack?.split('\n').slice(1, 5)
    });
    
    try {
      // More comprehensive invalid latlng detection
      if (e && e.latlng) {
        const latlng = e.latlng;
        const isInvalid = (
          // Check if latlng is null/undefined
          latlng == null ||
          // Check if latlng doesn't have lat/lng properties
          typeof latlng.lat !== 'number' || 
          typeof latlng.lng !== 'number' ||
          // Check if lat/lng are NaN or Infinity
          !isFinite(latlng.lat) || 
          !isFinite(latlng.lng) ||
          // Check if it's an object with x/y instead of lat/lng (common mistake)
          (typeof latlng.x === 'number' && typeof latlng.y === 'number')
        );
        
        if (isInvalid) {
          debugLog('🚨 Invalid latlng detected, removing it', {
            latlng: latlng,
            latType: typeof latlng?.lat,
            lngType: typeof latlng?.lng,
            latValue: latlng?.lat,
            lngValue: latlng?.lng,
            hasX: typeof latlng?.x,
            hasY: typeof latlng?.y,
            xValue: latlng?.x,
            yValue: latlng?.y,
            eventType: type,
            latlngKeys: latlng ? Object.keys(latlng) : 'null/undefined'
          });
          
          // Track this invalid latlng
          errorTracker.addInvalidLatLng(
            latlng, 
            errorTracker.getStackTrace(), 
            type
          );
          
          // Also track with vector tile debugger if available
          if (window.vectorTileDebugger) {
            window.vectorTileDebugger.trackInvalidLatLng(
              latlng,
              `leafletGuard-${type}`,
              errorTracker.getStackTrace()
            );
          }
          
          // Completely remove the latlng property
          // eslint-disable-next-line no-param-reassign
          delete e.latlng;
          
          debugLog('✅ Invalid latlng removed, Leaflet will recompute from mouse position');
        }
      }
      
      // Also check targets parameter if it exists (for compatibility with original signature)
      if (targets && typeof targets === 'object' && 'latlng' in targets) {
        const ll = targets.latlng;
        if (!ll || typeof ll.lat !== 'number' || typeof ll.lng !== 'number' ||
            !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) {
          try { 
            delete targets.latlng; 
          } catch { 
            targets.latlng = null; 
          }
        }
      }
    } catch (guardError) {
      console.error('🚨 [LeafletGuard] Error in guard itself:', guardError);
      console.error('🚨 [LeafletGuard] Event object:', e);
      errorTracker.addInvalidLatLng(
        e?.latlng, 
        errorTracker.getStackTrace(), 
        `guard-error-${type}`
      );
      
      // If there's an error in our guard, still try to remove latlng as a safety measure
      try {
        if (e && e.latlng) {
          // eslint-disable-next-line no-param-reassign
          delete e.latlng;
          debugLog('🛡️ Safety removal of latlng due to guard error');
        }
      } catch (safetyError) {
        console.error('🚨 [LeafletGuard] Even safety removal failed:', safetyError);
      }
    }
    
    try {
      const result = __origFireDOMEvent.call(this, e, type, targets);
      debugLog(`_fireDOMEvent completed successfully`, { eventType: type });
      return result;
    } catch (originalError) {
      console.error('🚨 [LeafletGuard] Original Leaflet error still occurred:', originalError);
      console.error('🚨 [LeafletGuard] Event that caused error:', e);
      console.error('🚨 [LeafletGuard] Event type:', type);
      console.error('🚨 [LeafletGuard] Event latlng:', e?.latlng);
      console.error('🚨 [LeafletGuard] Event originalEvent:', e?.originalEvent);
      console.error('🚨 [LeafletGuard] Event target:', e?.originalEvent?.target);
      console.error('🚨 [LeafletGuard] Full error stack:', originalError.stack);
      
      // Track this error with comprehensive data
      errorTracker.addInvalidLatLng(
        e?.latlng, 
        errorTracker.getStackTrace(), 
        `original-error-${type}`
      );
      
      // Also track with vector tile debugger if available
      if (window.vectorTileDebugger) {
        window.vectorTileDebugger.trackInvalidLatLng(
          e?.latlng,
          `leafletGuard-original-error-${type}`,
          originalError.stack?.split('\n') || ['No stack trace']
        );
      }
      
      throw originalError;
    }
  };

  // Patch latLngToContainerPoint to handle invalid latlngs
  // IMPORTANT: Only return safe default if latlng is truly invalid
  // Valid LatLng instances should pass through normally
  L.Map.prototype.latLngToContainerPoint = function(latlng) {
    // Enhanced logging for debugging
    const debugInfo = {
      latlng,
      latlngType: typeof latlng,
      isLatLngInstance: latlng instanceof L.LatLng,
      hasLat: latlng?.lat !== undefined,
      hasLng: latlng?.lng !== undefined,
      latType: typeof latlng?.lat,
      lngType: typeof latlng?.lng,
      latValue: latlng?.lat,
      lngValue: latlng?.lng,
      latlngKeys: latlng ? Object.keys(latlng) : 'none'
    };
    
    debugLog('🔍 [LeafletGuard] latLngToContainerPoint called', debugInfo);
    
    try {
      // More lenient check - allow LatLng instances and objects with lat/lng
      if (!latlng) {
        debugLog('🚨 [LeafletGuard] latlng is null/undefined in latLngToContainerPoint');
        errorTracker.addInvalidLatLng(latlng, errorTracker.getStackTrace(), 'latLngToContainerPoint');
        return L.point(0, 0);
      }
      
      // Check if it's a Leaflet LatLng instance (has methods like toBounds)
      if (latlng instanceof L.LatLng) {
        // Valid LatLng instance - pass through to original
        debugLog('✅ [LeafletGuard] Passing LatLng instance to original function');
        const result = __origLatLngToContainerPoint.call(this, latlng);
        debugLog('✅ [LeafletGuard] latLngToContainerPoint result:', { x: result.x, y: result.y });
        return result;
      }
      
      // Check if it has lat/lng properties with valid numbers
      const lat = latlng.lat;
      const lng = latlng.lng;
      
      if (typeof lat === 'number' && typeof lng === 'number' && 
          Number.isFinite(lat) && Number.isFinite(lng)) {
        // Valid lat/lng properties - pass through to original
        debugLog('✅ [LeafletGuard] Passing lat/lng object to original function');
        const result = __origLatLngToContainerPoint.call(this, latlng);
        debugLog('✅ [LeafletGuard] latLngToContainerPoint result:', { x: result.x, y: result.y });
        return result;
      }
      
      // Invalid latlng - return safe default
      debugLog('🚨 [LeafletGuard] Invalid latlng in latLngToContainerPoint:', {
        latlng,
        latType: typeof lat,
        lngType: typeof lng,
        latValue: lat,
        lngValue: lng,
        isLatLngInstance: latlng instanceof L.LatLng
      });
      errorTracker.addInvalidLatLng(latlng, errorTracker.getStackTrace(), 'latLngToContainerPoint');
      return L.point(0, 0);
    } catch (error) {
      console.error('🚨 [LeafletGuard] Error in latLngToContainerPoint:', error);
      console.error('🚨 [LeafletGuard] Input latlng:', latlng);
      console.error('🚨 [LeafletGuard] Debug info:', debugInfo);
      
      // If error occurred, try calling original anyway (might be a different error)
      try {
        const result = __origLatLngToContainerPoint.call(this, latlng);
        debugLog('✅ [LeafletGuard] Original function succeeded after error:', { x: result.x, y: result.y });
        return result;
      } catch (originalError) {
        console.error('🚨 [LeafletGuard] Original function also failed:', originalError);
        errorTracker.addInvalidLatLng(latlng, errorTracker.getStackTrace(), 'latLngToContainerPoint-error');
        return L.point(0, 0);
      }
    }
  };

  // Patch containerPointToLatLng to handle invalid points
  L.Map.prototype.containerPointToLatLng = function(point) {
    try {
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
        debugLog('🚨 [LeafletGuard] Invalid point in containerPointToLatLng:', point);
        errorTracker.addInvalidLatLng(point, errorTracker.getStackTrace(), 'containerPointToLatLng');
        // Return a safe default latlng
        return L.latLng(0, 0);
      }
      return __origContainerPointToLatLng.call(this, point);
    } catch (error) {
      console.error('🚨 [LeafletGuard] Error in containerPointToLatLng:', error);
      errorTracker.addInvalidLatLng(point, errorTracker.getStackTrace(), 'containerPointToLatLng-error');
      return L.latLng(0, 0);
    }
  };

  L.Map.prototype.__latlngGuarded = true;
  
  debugLog('✅ Leaflet guard patch installed successfully');
  
  // Add additional global error monitoring
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('Cannot read properties of undefined (reading \'lat\')')) {
      console.error('🚨 [LeafletGuard] Detected latlng error in console.error:', args);
      console.error('🚨 [LeafletGuard] Current stack trace:', new Error().stack);
      
      // Track this error
      errorTracker.addInvalidLatLng(
        { error: 'console.error-detected', message: message },
        new Error().stack?.split('\n') || ['No stack trace'],
        'console.error-latlng'
      );
    }
    originalConsoleError.apply(console, args);
  };
  
  } // Close the else block
  
} else {
  debugLog('⚠️ Leaflet guard already installed, skipping');
}
