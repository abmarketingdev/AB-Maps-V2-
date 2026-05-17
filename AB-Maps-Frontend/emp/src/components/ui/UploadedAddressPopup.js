import React, { useState, useEffect } from 'react';
import { Popup } from 'react-leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import L from 'leaflet';

const UploadedAddressPopup = ({ position, addressData, onClose }) => {
  // Validate all required props
  // Handle both array format [lat, lng] and object format {lat, lng}
  let lat, lng;
  
  if (Array.isArray(position)) {
    [lat, lng] = position;
  } else if (position && typeof position.lat === 'number' && typeof position.lng === 'number') {
    lat = position.lat;
    lng = position.lng;
  } else {
    console.warn('UploadedAddressPopup: Invalid position format', { position, addressData });
    return null;
  }
  
  if (!addressData) {
    console.warn('UploadedAddressPopup: Missing addressData', { position, addressData });
    return null;
  }

  const handleClose = (e) => {
    console.log('UploadedAddressPopup: handleClose called', e);
    
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
        // Prevent all clicks inside this popup from propagating to the map
        L.DomEvent.disableClickPropagation(container);
        // Also prevent other events that might interfere
        L.DomEvent.disableScrollPropagation(container);
      }
    },
  };

  return (
    <Popup
      position={[lat, lng]}
      onClose={handleClose}
      closeButton={true}
      autoClose={false}
      closeOnClick={false}
      closeOnEscapeKey={true}
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
              {addressData.address_text}
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
      </div>
    </Popup>
  );
};

export default UploadedAddressPopup; 