import React, { useState, useEffect } from 'react';
import { Popup } from 'react-leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import L from 'leaflet';

const UploadedAddressPopup = ({ position, addressData, onClose }) => {
  const { user } = useAuth();
  
  // Validate all required props
  // Handle both array format [lat, lng] and object format {lat, lng}
  let lat, lng;
  
  if (Array.isArray(position)) {
    [lat, lng] = position;
  } else if (position && typeof position.lat === 'number' && typeof position.lng === 'number') {
    lat = position.lat;
    lng = position.lng;
  } else {
    return null;
  }
  
  // Allow popup to render while data is loading; use placeholders if needed

  const handleClose = (e) => {
    // Prevent event propagation to stop it from triggering other handlers
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    // Clear any potential focus issues that might cause reopening
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    } catch (err) {
      // Ignore any focus-related errors
    }
    
    // Call the parent's onClose handler
    if (onClose) {
      onClose();
    }
  };

  // Event handlers to prevent popup clicks from propagating to map
  const popupEventHandlers = {
    add: (e) => {
      const container = e.target.getElement();
      if (container) {
        // More robust event prevention
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        // Comprehensive event blocking
        ['click', 'mousedown', 'mouseup', 'dblclick', 'contextmenu',
         'touchstart', 'touchend', 'touchmove', 'touchcancel',
         'pointerdown', 'pointerup', 'pointercancel'].forEach((evt) => {
          L.DomEvent.on(container, evt, (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
          });
        });
        
        // Additional protection for child elements
        const preventMapEvents = (el) => {
          ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(evt => {
            el.addEventListener(evt, (e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
            }, true);
          });
        };
        
        preventMapEvents(container);
        container.querySelectorAll('*').forEach(preventMapEvents);
      }

    },
    remove: () => {

    }
  };

  return (
    <Popup
      position={[lat, lng]}
      onClose={handleClose}
      closeButton={true}
      autoClose={false}
      closeOnClick={false}
      closeOnEscapeKey={true}
      autoPan={false}
      className="address-popup-enhanced"
      eventHandlers={popupEventHandlers}
    >
      <div 
        className="address-popup"
        onClick={(e) => {
          // Prevent any clicks inside the popup from bubbling up
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }}
      >
        <div className="address-list">
          <div className="address-item" style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '8px',
            background: '#fff3cd'
          }}>
            <p style={{
              margin: '0 0 8px 0',
              fontWeight: '500',
              fontSize: '14px',
              color: '#333'
            }}>
              {addressData?.address_text || addressData?.text || 'Adresse'}
            </p>
            
            {/* Reserved status indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px',
              padding: '4px 8px',
              background: '#ffc107',
              color: '#856404',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <FontAwesomeIcon 
                icon={faExclamationTriangle} 
                style={{ marginRight: '6px' }}
              />
              <span>Denne adressen er reservert</span>
            </div>
            
            {/* Additional info */}
            <div style={{
              fontSize: '11px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              Denne adressen er allerede registrert i systemet og kan ikke endres.
            </div>
          </div>
        </div>
        
        {user && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#666',
            textAlign: 'center'
          }}>
            Logget inn som: {user.username || user.user_info?.name || 'Unknown'} ({user.user_type})
          </div>
        )}
      </div>
    </Popup>
  );
};

export default UploadedAddressPopup; 