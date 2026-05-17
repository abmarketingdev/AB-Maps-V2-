import React, { useEffect, useRef, useState } from 'react';
import NeiSubcategoryInlineStep from './NeiSubcategoryInlineStep';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEye, faBan, faSpinner } from '@fortawesome/free-solid-svg-icons';
import L from 'leaflet';
import {
  isTalkmoreCampaign as detectTalkmoreCampaign,
  readCampaignFromStorage,
} from '../../utils/campaignUtils';
import './FloatingAddressPopup.css';

/**
 * FloatingAddressPopup - For HOUSE markers only (Employee version)
 * 
 * PHASE 4 CLEANUP: Removed old apartment-related code.
 * Buildings with apartments are now handled by:
 * - Discovery Flow (useMapState.js) → BuildingSummaryCard → ApartmentListDrawer
 * - This popup is only for simple house addresses without apartments
 * 
 * @deprecated for apartment buildings - use BuildingSummaryCard + ApartmentListDrawer instead
 */
const FloatingAddressPopup = ({ 
  clickedInfo, 
  onClose, 
  statusOptions,
  onStatusSelect,
  isTalkmoreCampaign = false,
  isStatusSubmitting,
  isCheckingApartments = false,
  onOpenCampaignForm,
  onGeonorgeFallback, // Handler for Geonorge fallback button
  map
}) => {
  const popupRef = useRef(null);
  const [neiFlowAddress, setNeiFlowAddress] = useState(null);
  const [neiFlowError, setNeiFlowError] = useState(null);
  const storageCampaign = readCampaignFromStorage();
  const talkmoreNeiEnabled =
    Boolean(isTalkmoreCampaign) || detectTalkmoreCampaign(storageCampaign);

  // Position the popup at the click location
  useEffect(() => {
    if (!popupRef.current || !clickedInfo?.position || !map) {
      return;
    }

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

    const latLng = toLatLng(clickedInfo.position);
    if (!latLng) return;

    try {
      const rect = map.getContainer().getBoundingClientRect();
      const point = map.latLngToContainerPoint(latLng);
      const x = rect.left + point.x;
      const y = rect.top + point.y;
      
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        popupRef.current.style.animation = 'none';
        popupRef.current.style.left = '50%';
        popupRef.current.style.top = '50%';
        popupRef.current.style.transform = 'translate(-50%, -50%)';
        popupRef.current.style.position = 'fixed';
        popupRef.current.style.zIndex = '999999';
      } else {
        popupRef.current.style.left = `${x}px`;
        popupRef.current.style.top = `${y - 20}px`;
        popupRef.current.style.transform = 'translate(-50%, -100%)';
        popupRef.current.style.position = 'fixed';
        popupRef.current.style.zIndex = '999999';
      }
    } catch (error) {
      console.error('[FloatingAddressPopup] Error positioning popup:', error);
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        popupRef.current.style.animation = 'none';
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
  }, [clickedInfo, map]);

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

  if (!clickedInfo?.position) {
    return null;
  }

  const addresses = clickedInfo.addresses || [];
  const isLoading = addresses[0] === 'Henter adresse...';
  const isError = addresses[0] === 'Kunne ikke hente adresse' || addresses[0] === 'Fant ingen adresse';

  return (
    <div 
      ref={popupRef}
      className="floating-address-popup"
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        zIndex: 999999,
        visibility: 'visible',
        opacity: 1,
        display: 'block',
        backgroundColor: 'white',
        animation: window.innerWidth <= 768 ? 'none' : undefined
      }}
    >
      <div className="popup-header">
        <h3>Velg status for adresse</h3>
        <button 
          className="close-button" 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>
      
      <div className="popup-content">
        {!isLoading && !isError && addresses.length > 0 && (
          <div className="addresses-section">
            <div className="address-counter">
              <span className="counter-text">
                {addresses.filter(addr => 
                  addr !== 'Henter adresse...' && 
                  addr !== 'Fant ingen adresse' && 
                  addr !== 'Kunne ikke hente adresse' &&
                  !addr.startsWith('Koordinater:')
                ).length} adresse{addresses.filter(addr => 
                  addr !== 'Henter adresse...' && 
                  addr !== 'Fant ingen adresse' && 
                  addr !== 'Kunne ikke hente adresse' &&
                  !addr.startsWith('Koordinater:')
                ).length !== 1 ? 'r' : ''} funnet
              </span>
            </div>
            
            {/* Loading indicator for Geonorge apartment check */}
            {isCheckingApartments && (
              <div className="apartment-check-loading">
                <div className="loading-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
                <span>Sjekker for leiligheter...</span>
              </div>
            )}
            
            {/* Geonorge fallback button - shown when local-lookup returns 0 apartments */}
            {clickedInfo?.showGeonorgeFallback && !isCheckingApartments && (
              <div className="geonorge-fallback-section" style={{ 
                marginTop: '16px', 
                padding: '12px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6c757d' }}>
                  Ingen leiligheter funnet i lokal database. Prøv Geonorge API?
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🔵 [FloatingAddressPopup] Geonorge button clicked:', {
                      hasHandler: !!onGeonorgeFallback,
                      primaryAddress: clickedInfo?.primaryAddress,
                      position: clickedInfo?.position
                    });
                    if (onGeonorgeFallback && clickedInfo?.primaryAddress && clickedInfo?.position) {
                      // Normalize position to ensure it has lat/lng
                      let normalizedPosition = clickedInfo.position;
                      if (normalizedPosition.lat === undefined || normalizedPosition.lng === undefined) {
                        // Handle Leaflet LatLng or array format
                        if (Array.isArray(normalizedPosition) && normalizedPosition.length >= 2) {
                          normalizedPosition = { lat: normalizedPosition[0], lng: normalizedPosition[1] };
                        } else if (normalizedPosition.lat !== undefined && normalizedPosition.lng !== undefined) {
                          // Already correct format
                        } else {
                          console.error('❌ [FloatingAddressPopup] Invalid position format:', normalizedPosition);
                          return;
                        }
                      }
                      console.log('🔵 [FloatingAddressPopup] Calling onGeonorgeFallback with:', {
                        address: clickedInfo.primaryAddress,
                        position: normalizedPosition
                      });
                      onGeonorgeFallback(clickedInfo.primaryAddress, normalizedPosition);
                    } else {
                      console.warn('⚠️ [FloatingAddressPopup] Cannot call Geonorge fallback:', {
                        hasHandler: !!onGeonorgeFallback,
                        hasPrimaryAddress: !!clickedInfo?.primaryAddress,
                        hasPosition: !!clickedInfo?.position
                      });
                    }
                  }}
                  disabled={isStatusSubmitting || isCheckingApartments}
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    cursor: (isStatusSubmitting || isCheckingApartments) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    width: '100%',
                    opacity: (isStatusSubmitting || isCheckingApartments) ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isCheckingApartments ? 'Sjekker Geonorge...' : 'Sjekk Geonorge API'}
                </button>
              </div>
            )}
            
            <div 
              className="addresses-list"
              onWheel={(e) => {
                e.stopPropagation();
              }}
            >
              {addresses.map((address, addressIndex) => {
                // Skip special status messages
                if (address === 'Henter adresse...' || 
                    address === 'Fant ingen adresse' || 
                    address === 'Kunne ikke hente adresse' ||
                    address.startsWith('Koordinater:')) {
                  return null;
                }
                
                return (
                  <div key={addressIndex} className="address-item"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <div className="address-header">
                      <div className="address-info">
                        <span className="address-number">#{addressIndex + 1}</span>
                        <div className="address-text-wrapper">
                          <h4 className="address-text">{address}</h4>
                        </div>
                      </div>
                    </div>
                    
                    {talkmoreNeiEnabled && neiFlowAddress === address ? (
                      <NeiSubcategoryInlineStep
                        disabled={isStatusSubmitting || isCheckingApartments}
                        serverError={neiFlowError}
                        onBack={() => {
                          setNeiFlowAddress(null);
                          setNeiFlowError(null);
                        }}
                        onConfirm={async (sub) => {
                          setNeiFlowError(null);
                          const res = await onStatusSelect(
                            { stopPropagation: () => {}, preventDefault: () => {} },
                            address,
                            'nei',
                            sub
                          );
                          if (res && res.success === false) {
                            setNeiFlowError(res.error || 'Kunne ikke lagre');
                          } else {
                            setNeiFlowAddress(null);
                            setNeiFlowError(null);
                          }
                        }}
                      />
                    ) : (
                    <div className="status-buttons">
                      {statusOptions.map((option, i) => {
                        const isDisabled = isStatusSubmitting || isCheckingApartments;
                        return (
                          <button
                            key={i}
                            type="button"
                            className="status-button"
                            style={{
                              backgroundColor: option.color,
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              opacity: isDisabled ? 0.6 : 1,
                              transition: 'all 0.2s ease',
                              pointerEvents: isDisabled ? 'none' : 'auto',
                              minWidth: '100px',
                              justifyContent: 'center'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (option.value === 'nei' && talkmoreNeiEnabled) {
                                console.log('[FloatingAddressPopup][NeiFlow]', {
                                  source: 'emp',
                                  optionValue: option.value,
                                  talkmoreNeiEnabled,
                                  propIsTalkmoreCampaign: isTalkmoreCampaign,
                                  storageCampaignName: storageCampaign?.name ?? null,
                                  storageCampaignId: storageCampaign?.id ?? null,
                                });
                                setNeiFlowError(null);
                                setNeiFlowAddress(address);
                              } else {
                                onStatusSelect(e, address, option.value);
                              }
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            disabled={isDisabled}
                            title={option.label}
                          >
                            <FontAwesomeIcon icon={option.icon} style={{ fontSize: '12px' }} />
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                      {isStatusSubmitting && (
                        <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
                          <span className="spinner" style={{ width: 18, height: 18, border: '2px solid #fff', borderTop: '2px solid #2b2d42', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {isStatusSubmitting && (
          <div className="loading-message">
            <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
            Lagrer status...
          </div>
        )}
        
        <div className="user-info">
          Logget inn som: Employee
        </div>
      </div>
    </div>
  );
};

export default FloatingAddressPopup;
