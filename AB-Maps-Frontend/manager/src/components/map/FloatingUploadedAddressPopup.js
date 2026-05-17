import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTimes, faTrash, faEdit, faSpinner, faUser, faCalendar, faMapMarkerAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import addressService from '../../services/addressService';
import { useAuth } from '../../contexts/AuthContext';
import './FloatingUploadedAddressPopup.css';

const FloatingUploadedAddressPopup = ({ 
  marker, 
  onClose, 
  onDelete, 
  canDelete 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const popupRef = useRef(null);

  // Position the popup at the marker location with mobile centering
  useEffect(() => {
    if (popupRef.current && marker?.position) {
      const mapContainer = document.querySelector('.leaflet-container');
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        const map = mapContainer._leaflet_map || mapContainer.leaflet_map;
        
        if (map) {
          const point = map.latLngToContainerPoint(marker.position);
          const x = rect.left + point.x;
          const y = rect.top + point.y;
          
          // Check if we're on mobile (smaller screen)
          const isMobile = window.innerWidth <= 768;
          
          if (isMobile) {
            // Center on mobile with proper margins
            popupRef.current.style.left = '50%';
            popupRef.current.style.top = '50%';
            popupRef.current.style.transform = 'translate(-50%, -50%)';
            popupRef.current.style.position = 'fixed';
            popupRef.current.style.zIndex = '100000';
          } else {
            // Desktop positioning above marker
            popupRef.current.style.left = `${x}px`;
            popupRef.current.style.top = `${y - 20}px`;
            popupRef.current.style.transform = 'translate(-50%, -100%)';
            popupRef.current.style.position = 'fixed';
          }
        }
      }
    }
  }, [marker]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!marker?.position || !marker?.uploadedAddressData) return null;

  const { lat, lng } = marker.position;
  const addressData = marker.uploadedAddressData;
  const address = addressData.address_text || 'Ukjent adresse';
  // For uploaded addresses, show as "Reservert"
  const statusLabel = 'Reservert';
  const statusIcon = faExclamationTriangle;
  const statusColor = '#f39c12';

  // Keep helpers in case we want to map backend status later
  const getStatusText = () => statusLabel;
  const getStatusIcon = () => statusIcon;

  const formatDate = (dateString) => {
    if (!dateString) return 'Ukjent';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('nb-NO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Ukjent';
    }
  };

  const handleDelete = async () => {
    if (!marker?.addressId) {
      setError('Kunne ikke slette punktet - mangler nødvendig informasjon');
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await addressService.deleteAddress(marker.addressId);
      if (onDelete) {
        await onDelete({ ...marker, _skipApiDelete: true });
      }
      onClose();
    } catch (err) {
      const msg = `${err?.message || ''}`;
      if (msg.includes('403') || msg.includes('401')) {
        setError('Du kan kun slette dine egne punkter');
      } else {
        setError('Kunne ikke slette punktet');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop overlay to prevent map interaction */}
      <div 
        className="popup-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999999,
          cursor: 'pointer'
        }}
      />
      
      <div 
        ref={popupRef}
        className="floating-uploaded-address-popup"
        onClick={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onMouseDown={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onMouseUp={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onTouchStart={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onTouchEnd={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onPointerDown={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onPointerUp={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onWheel={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onTouchMove={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onScroll={(e) => { 
          e.stopPropagation(); 
          e.nativeEvent.stopImmediatePropagation(); 
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
      >
        <div className="popup-header">
          <h3>Opplastet Adresse Detaljer</h3>
          <button 
            className="close-button" 
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              onClose();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
          >
            ×
          </button>
        </div>
        
        <div className="popup-content">
          {error && (
            <div className="error-message">{error}</div>
          )}
          
          {/* Address section */}
          <div className="address-section">
            <div className="address-section-header">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="address-icon" />
              <span className="address-section-title">Adresse</span>
            </div>
            <div className="address-block">
              <div className="address-text-lines">{address}</div>
              <div className="coordinates-pill">
                <span>Koordinater: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
              </div>
            </div>
          </div>
          
          <div className="status-section">
            <h5>Status</h5>
            <div className="status-display reserved">
              <FontAwesomeIcon 
                icon={getStatusIcon()} 
                className="status-icon"
                style={{ color: statusColor, marginRight: '8px' }} 
              />
              <span className="status-text" style={{ color: statusColor, fontWeight: '700' }}>
                {getStatusText()}
              </span>
            </div>
            <div className="status-hint">Denne adressen er merket som reservert</div>
          </div>
          
          <div className="metadata-section">
            <h5>Metadata</h5>
            <div className="metadata-grid">
              {addressData.created_at && (
                <div className="metadata-item">
                  <FontAwesomeIcon icon={faCalendar} style={{ color: '#666', marginRight: '8px' }} />
                  <span>Opprettet: {formatDate(addressData.created_at)}</span>
                </div>
              )}
              
              {addressData.updated_at && (
                <div className="metadata-item">
                  <FontAwesomeIcon icon={faCalendar} style={{ color: '#666', marginRight: '8px' }} />
                  <span>Oppdatert: {formatDate(addressData.updated_at)}</span>
                </div>
              )}
              
              {addressData.employee_id && (
                <div className="metadata-item">
                  <FontAwesomeIcon icon={faUser} style={{ color: '#666', marginRight: '8px' }} />
                  <span>Ansatt ID: {addressData.employee_id}</span>
                </div>
              )}
              
              {addressData.manager_id && (
                <div className="metadata-item">
                  <FontAwesomeIcon icon={faUser} style={{ color: '#666', marginRight: '8px' }} />
                  <span>Manager ID: {addressData.manager_id}</span>
                </div>
              )}
              
              {addressData.campaign_id && (
                <div className="metadata-item">
                  <FontAwesomeIcon icon={faMapMarkerAlt} style={{ color: '#666', marginRight: '8px' }} />
                  <span>Kampanje ID: {addressData.campaign_id}</span>
                </div>
              )}
            </div>
          </div>
          
          {addressData.tags && Object.keys(addressData.tags).length > 0 && (
            <div className="tags-section">
              <h5>Tags</h5>
              <div className="tags-list">
                {Object.entries(addressData.tags).map(([key, value]) => (
                  <span key={key} className="tag">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {canDelete && (
            <div className="actions-section">
              <button
                className="delete-button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  handleDelete();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                    Sletter...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} style={{ marginRight: '8px' }} />
                    Slett punkt
                  </>
                )}
              </button>
            </div>
          )}
          
          {user && (
            <div className="user-info">
              Logget inn som: {user.username || user.user_info?.name || 'Unknown'} ({user.user_type})
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FloatingUploadedAddressPopup; 