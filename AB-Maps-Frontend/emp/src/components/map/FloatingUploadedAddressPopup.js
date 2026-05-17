import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTimes, faUser, faCalendar, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import L from 'leaflet';
import './FloatingUploadedAddressPopup.css';

/**
 * Custom floating popup for uploaded addresses in employee interface
 * ENHANCED: Complete isolation from map events and improved positioning
 */
const FloatingUploadedAddressPopup = ({ 
  marker, 
  onClose,
  map
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const popupRef = useRef(null);

  // Enhanced positioning with better isolation
  useEffect(() => {
    if (!popupRef.current || !marker?.position || !map) return;

    const toLatLng = (pos) => {
      if (pos instanceof L.LatLng) return pos;
      if (Array.isArray(pos) && pos.length >= 2) {
        const a = +pos[0], b = +pos[1];
        if (Number.isFinite(a) && Number.isFinite(b)) return L.latLng(a, b);
        return null;
      }
      if (pos && typeof pos.lat !== 'undefined' && typeof pos.lng !== 'undefined') {
        const lat = +pos.lat, lng = +pos.lng;
        if (Number.isFinite(lat) && Number.isFinite(lng)) return L.latLng(lat, lng);
      }
      return null;
    };

    const latLng = toLatLng(marker.position);
    if (!latLng) return; // do not project invalid positions

    // 🟣 DEBUGGING: Log before calling latLngToContainerPoint
    console.log('🟣 [FloatingUploadedAddressPopup] About to call latLngToContainerPoint:', {
      marker,
      position: marker.position,
      latLng,
      latLngLat: latLng.lat,
      latLngLng: latLng.lng,
      isLatLngInstance: latLng instanceof L.LatLng,
      mapExists: !!map,
      mapType: typeof map,
      hasLatLngToContainerPoint: typeof map.latLngToContainerPoint === 'function',
      timestamp: Date.now()
    });

    try {
      const rect = map.getContainer().getBoundingClientRect();
      const point = map.latLngToContainerPoint(latLng);
      
      console.log('✅ [FloatingUploadedAddressPopup] latLngToContainerPoint succeeded:', {
        point,
        x: point.x,
        y: point.y
      });
      
      const x = rect.left + point.x;
      const y = rect.top + point.y;
      
      // Check if we're on mobile (smaller screen)
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Center on mobile with proper margins and highest z-index
        popupRef.current.style.left = '50%';
        popupRef.current.style.top = '50%';
        popupRef.current.style.transform = 'translate(-50%, -50%)';
        popupRef.current.style.position = 'fixed';
        popupRef.current.style.zIndex = '999999'; // Highest z-index for complete isolation
      } else {
        // Desktop positioning above marker with highest z-index
        popupRef.current.style.left = `${x}px`;
        popupRef.current.style.top = `${y - 20}px`;
        popupRef.current.style.transform = 'translate(-50%, -100%)';
        popupRef.current.style.position = 'fixed';
        popupRef.current.style.zIndex = '999999'; // Highest z-index for complete isolation
      }
    } catch (error) {
      console.error('❌ [FloatingUploadedAddressPopup] Error positioning popup:', error);
      // Fallback: center the popup on screen
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        popupRef.current.style.left = '50%';
        popupRef.current.style.top = '50%';
        popupRef.current.style.transform = 'translate(-50%, -50%)';
        popupRef.current.style.position = 'fixed';
        popupRef.current.style.zIndex = '999999';
      } else {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        popupRef.current.style.left = `${centerX}px`;
        popupRef.current.style.top = `${centerY}px`;
        popupRef.current.style.transform = 'translate(-50%, -50%)';
        popupRef.current.style.position = 'fixed';
        popupRef.current.style.zIndex = '999999';
      }
    }
  }, [marker, map]);

  // Opening shield - ignore events that could close popup immediately after opening
  const openedAt = useRef(0);
  const isClosingRef = useRef(false);
  
  useEffect(() => {
    openedAt.current = performance.now();
    isClosingRef.current = false;
  }, []);

  // Enhanced event isolation - prevent ALL map interference
  useEffect(() => {
    const handleClickOutside = (event) => {
      // ENHANCED: Longer opening shield to prevent immediate closure
      if (performance.now() - openedAt.current < 800) return;
      
      // Prevent multiple close calls
      if (isClosingRef.current) return;
      
      // ENHANCED: Better event isolation
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        // Prevent event bubbling to map
        event.stopPropagation();
        event.preventDefault();
        isClosingRef.current = true;
        onClose();
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        // Prevent event bubbling to map
        event.stopPropagation();
        event.preventDefault();
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          onClose();
        }
      }
    };

    // REMOVED: Duplicate mousedown listener to prevent conflicts
    // Only use click-based outside detection to avoid race conditions

    const handleTouchStart = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        event.stopPropagation();
        // Don't close on touch start - only on actual click outside
      }
    };

    // Add event listeners with proper options - REMOVED DUPLICATE mousedown
    document.addEventListener('click', handleClickOutside, true); // Use capture phase
    document.addEventListener('keydown', handleEscKey);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    
    return () => {
      // Clean up all event listeners
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscKey);
      document.removeEventListener('touchstart', handleTouchStart, { passive: true });
    };
  }, [onClose]);

  // ENHANCED: Prevent any focus issues that might cause reopening
  useEffect(() => {
    if (popupRef.current) {
      // Ensure popup has focus and prevent map from stealing it
      popupRef.current.focus();
      
      // Add tabindex to make it focusable
      popupRef.current.setAttribute('tabindex', '-1');
    }
  }, []);

  if (!marker) {
    return null;
  }

  // Extract address data
  const addressData = marker.uploadedAddressData || marker;
  const addressText = addressData.address_text || addressData.address || 'Opplastet adresse';
  const createdAt = addressData.created_at;
  const uploadedBy = addressData.uploaded_by;

  return (
    <div 
      ref={popupRef} 
      className="floating-uploaded-address-popup"
      // ENHANCED: Complete event isolation
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
      tabIndex="-1"
    >
      <div className="popup-header">
        <h3>
          <FontAwesomeIcon icon={faMapMarkerAlt} />
          Opplastet Adresse
        </h3>
        <button 
          className="close-button" 
          onClick={(e) => {
            // ENHANCED: Prevent event bubbling and multiple closes
            e.stopPropagation();
            e.preventDefault();
            if (!isClosingRef.current) {
              isClosingRef.current = true;
              onClose();
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          aria-label="Lukk"
        >
          ×
        </button>
      </div>
      
      <div className="popup-content">
        <div className="address-info">
          <div className="address-text">
            {addressText}
          </div>
          
          {uploadedBy && (
            <div className="meta-info">
              <FontAwesomeIcon icon={faUser} />
              <span>Opplastet av: {uploadedBy}</span>
            </div>
          )}
          
          {createdAt && (
            <div className="meta-info">
              <FontAwesomeIcon icon={faCalendar} />
              <span>Dato: {new Date(createdAt).toLocaleDateString('no-NO')}</span>
            </div>
          )}
          
          <div className="info-note">
            <FontAwesomeIcon icon={faCheck} />
            <span>Dette er en forhåndsopplastet adresse</span>
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            <FontAwesomeIcon icon={faTimes} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingUploadedAddressPopup;

