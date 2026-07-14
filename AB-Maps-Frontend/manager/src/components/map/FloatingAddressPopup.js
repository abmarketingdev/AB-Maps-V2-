import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTimes, faSpinner, faRedo } from '@fortawesome/free-solid-svg-icons';
import addressService from '../../services/addressService';
import authService from '../../services/authService';
import locationService from '../../services/locationService';
import { useAuth } from '../../contexts/AuthContext';
import { isNRCCampaignAsync, openNRCUrl } from '../../utils/nrcUrlHelper';
import './FloatingAddressPopup.css';
import NeiSubcategoryInlineStep from './NeiSubcategoryInlineStep';
import {
  labelForNeiSubcategory,
  isNeiSubcategory,
} from '../../constants/neiSubcategory';

/**
 * FloatingAddressPopup - For HOUSE markers only
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
  onAddMarker, 
  onOpenCampaignForm,
  isTalkmoreCampaign = false,
  isCheckingApartments = false,
  onGeonorgeFallback // Handler for Geonorge fallback button
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [savedStatuses, setSavedStatuses] = useState({});
  const [neiFlowAddress, setNeiFlowAddress] = useState(null);
  const [neiFlowError, setNeiFlowError] = useState(null);
  const [isNRCCampaignState, setIsNRCCampaignState] = useState(false);
  const popupRef = useRef(null);

  // Pre-fetch NRC campaign status when popup opens (needed for synchronous check in click handler)
  useEffect(() => {
    const checkNRCCampaign = async () => {
      const isNRC = await isNRCCampaignAsync();
      console.log('[FloatingAddressPopup] Pre-fetched NRC campaign status:', isNRC);
      setIsNRCCampaignState(isNRC);
    };
    checkNRCCampaign();
  }, []);

  // Position the popup at the click location
  useEffect(() => {
    if (popupRef.current && clickedInfo?.position) {
      const mapContainer = document.querySelector('.leaflet-container');
      
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        const map = mapContainer._leaflet_map || mapContainer.leaflet_map;
        
        if (map) {
          try {
            const point = map.latLngToContainerPoint(clickedInfo.position);
            const x = rect.left + point.x;
            const y = rect.top + point.y;
            
            // Position popup above the click point
            popupRef.current.style.left = `${x}px`;
            popupRef.current.style.top = `${y - 20}px`;
            popupRef.current.style.transform = 'translate(-50%, -100%)';
          } catch (error) {
            // Fallback: center the popup on screen
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            popupRef.current.style.left = `${centerX}px`;
            popupRef.current.style.top = `${centerY}px`;
            popupRef.current.style.transform = 'translate(-50%, -50%)';
          }
        } else {
          // Fallback: center the popup on screen
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          
          popupRef.current.style.left = `${centerX}px`;
          popupRef.current.style.top = `${centerY}px`;
          popupRef.current.style.transform = 'translate(-50%, -50%)';
        }
      } else {
        // Fallback: center the popup on screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        popupRef.current.style.left = `${centerX}px`;
        popupRef.current.style.top = `${centerY}px`;
        popupRef.current.style.transform = 'translate(-50%, -50%)';
      }
    }
  }, [clickedInfo]);

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

  // Get addresses and determine loading/error states
  const addresses = clickedInfo?.addresses || [];
  const isLoading = addresses[0] === 'Henter adresse...';
  const isError = addresses[0] === 'Kunne ikke hente adresse' || addresses[0] === 'Fant ingen adresse';

  if (!clickedInfo?.position) return null;

  // Enhanced status options with icons
  const enhancedStatusOptions = [
    {
      value: 'ja',
      label: 'Ja',
      color: '#2ecc71',
      icon: faCheck
    },
    {
      value: 'ikke_hjemme',
      label: 'Ikke hjemme',
      color: '#f1c40f',
      icon: faClock
    },
    {
      value: 'nei',
      label: 'Nei',
      color: '#e74c3c',
      icon: faTimes
    },
    {
      value: 'folg_opp',
      label: 'Følg opp',
      color: '#9b59b6',
      icon: faRedo
    }
  ];

  /**
   * Get campaign ID from localStorage
   */
  const getCampaignId = () => {
    // Delegate to the normalized resolver (this.user.campaignId → localStorage, object/JSON → .id)
    // so the body carries the same campaign the X-Campaign-ID header does.
    const fromAuth = authService.getCampaignId && authService.getCampaignId();
    if (fromAuth) return fromAuth;
    const campaignData = localStorage.getItem('currentCampaign');
    if (campaignData) {
      try {
        return JSON.parse(campaignData).id;
      } catch (error) {
        return campaignData;
      }
    }
    return null;
  };

  /**
   * Handle status selection with backend integration
   * For simple house addresses only (no apartments)
   */
  const handleStatusSelect = async (
    e,
    address,
    statusValue,
    neiSubcategory = undefined,
    fromNeiSubcatStep = false
  ) => {
    // Real status buttons pass a DOM event. Nei subcategory confirm passes null — never pass a
    // partial "event" stub (truthy object without preventDefault) or `if (e) { e.preventDefault() }` crashes.
    if (e != null) {
      try {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
      } catch (_) {
        /* ignore */
      }
    }

    if (
      statusValue === 'nei' &&
      neiSubcategory != null &&
      neiSubcategory !== '' &&
      !isNeiSubcategory(neiSubcategory)
    ) {
      const errMsg = 'Ugyldig årsak for Nei.';
      if (fromNeiSubcatStep) setNeiFlowError(errMsg);
      return { success: false, error: errMsg };
    }

    // 🔑 NRC CAMPAIGN: Open URL IMMEDIATELY (before any await) to avoid popup blocker
    // Browser blocks window.open() if called after async operations
    // Uses pre-fetched isNRCCampaignState to avoid async call during click
    if (statusValue === 'ja' && isNRCCampaignState) {
      console.log('[FloatingAddressPopup] NRC campaign detected, opening external URL BEFORE async operations');
      openNRCUrl(address);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let geoJsonPosition = null;
      if (typeof clickedInfo.position === 'object' && clickedInfo.position.lat && clickedInfo.position.lng) {
        geoJsonPosition = {
          type: 'Point',
          coordinates: [clickedInfo.position.lng, clickedInfo.position.lat]
        };
      }
      
      const campaignId = getCampaignId();
      // No campaign selected → the knock would be saved campaign-less (and analytics/campaign
      // metrics would miss it). Stop with a clear prompt instead.
      if (!campaignId) {
        setLoading(false);
        const msg = 'Velg en kampanje først (øverst i verktøylinjen).';
        setError(msg);
        return { success: false, error: msg };
      }

      // Create address (marker) in backend - simple house address
      const payload = {
        address_text: address,
        status: statusValue,
        position: geoJsonPosition,
        tags: { 
          source: 'map_click', 
          timestamp: new Date().toISOString(),
          marker_type: 'house' // Mark as house for vector tiles
        },
        employee_id: user.user_type === 'employee' ? user.user_info?.id : null,
        manager_id: user.user_type === 'manager' ? user.user_info?.id : null,
        campaign_id: campaignId,
      };
      if (statusValue === 'nei' && neiSubcategory !== undefined) {
        payload.nei_subcategory = neiSubcategory;
      }

      // GPS proximity guard: attach the tracked device position (via locationService, which
      // runs a watchPosition) so the backend's 150 m check actually fires. Prefer the last tracked
      // fix; else request one with the service's own timeout+retry. A confident far fix is
      // rejected (400 too_far, shown as a toast). Only if GPS is truly unavailable do we send
      // nothing — and we warn the user that the knock will be unverified.
      try {
        let fix = locationService.getStatus && locationService.getStatus().lastLocation;
        if (!fix && locationService.getCurrentLocation) {
          fix = await locationService.getCurrentLocation();
        }
        const lat = fix && (fix.latitude ?? fix.lat);
        const lng = fix && (fix.longitude ?? fix.lng);
        if (typeof lat === 'number' && typeof lng === 'number') {
          payload.user_location = { lat, lng, accuracy: fix.accuracy };
        }
      } catch (e) { /* GPS unavailable — handled below */ }
      if (!payload.user_location) {
        setError('GPS utilgjengelig — posisjonen kunne ikke bekreftes. Aktiver stedstjenester.');
      }

      const createdAddress = await addressService.createAddress(payload);
      if (createdAddress && createdAddress.id) {
        const newMarker = {
          address: address,
          status: statusValue,
          position: clickedInfo.position,
          addressId: createdAddress.id,
          nei_subcategory: createdAddress.nei_subcategory ?? null,
          nei_subcategory_display: createdAddress.nei_subcategory_display ?? null,
        };
        
        if (onAddMarker) {
          onAddMarker({
            ...newMarker,
            _forceViewportRefresh: true,
            _createdFromPopup: true
          });
        }
        
        setSavedStatuses(prev => ({
          ...prev,
          [address]: {
            status: statusValue,
            addressId: createdAddress.id,
            timestamp: new Date().toISOString(),
            user: user.username || user.user_info?.name || 'Unknown',
            nei_subcategory: createdAddress.nei_subcategory ?? null,
            nei_subcategory_display:
              createdAddress.nei_subcategory_display ??
              null,
          }
        }));
        
        setError(null);
        const statusText = statusValue === 'ja' ? 'Ja' : 
                          statusValue === 'ikke_hjemme' ? 'Ikke hjemme' : 
                          statusValue === 'nei' ? 'Nei' :
                          statusValue === 'folg_opp' ? 'Følg opp' :
                          'Ukjent';
        setSuccessMessage(`Status "${statusText}" lagret for ${address}`);
        
        // If status is "ja", handle campaign form (NRC already opened above before await)
        if (statusValue === 'ja' && !isNRCCampaignState && onOpenCampaignForm) {
          // Other campaigns (not NRC) - open campaign form
          const addressData = {
            address_text: address,
            postnummer: '',
            posted: ''
          };
          setTimeout(() => {
            onOpenCampaignForm(campaignId, createdAddress?.id, user?.user_info?.id, addressData);
          }, 500);
        }
        
        // Auto-close popup after successful status selection
        setTimeout(() => {
          onClose();
        }, 1500);
        return { success: true };
      }
      const failMsg = 'Kunne ikke opprette adresse. Prøv igjen.';
      if (fromNeiSubcatStep) setNeiFlowError(failMsg);
      else setError(failMsg);
      return { success: false, error: failMsg };
    } catch (err) {
      const msg = err.message || 'Kunne ikke lagre adresse';
      if (fromNeiSubcatStep) {
        setNeiFlowError(msg);
      } else {
        setError(msg);
        setTimeout(() => {
          onClose();
        }, 3000);
      }
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (statusValue) => {
    const option = enhancedStatusOptions.find(opt => opt.value === statusValue);
    return option ? option.icon : faCheck;
  };

  /**
   * Get status color
   */
  const getStatusColor = (statusValue) => {
    const option = enhancedStatusOptions.find(opt => opt.value === statusValue);
    return option ? option.color : '#95a5a6';
  };

  return (
    <div 
      ref={popupRef}
      className="floating-address-popup"
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
    >
      <div className="popup-header">
        <h3>Velg status for adresse</h3>
        <button 
          className="close-button" 
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>
      
      <div className="popup-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
        
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
                    e.nativeEvent.stopImmediatePropagation();
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
                  disabled={loading || isCheckingApartments}
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    cursor: (loading || isCheckingApartments) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    width: '100%',
                    opacity: (loading || isCheckingApartments) ? 0.6 : 1,
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
            >
              {addresses.map((address, addressIndex) => {
                // Skip special status messages
                if (address === 'Henter adresse...' || 
                    address === 'Fant ingen adresse' || 
                    address === 'Kunne ikke hente adresse' ||
                    address.startsWith('Koordinater:')) {
                  return null;
                }
                
                const isAddressLoading = loading && savedStatuses[address];
                
                return (
                  <div key={addressIndex} className="address-item">
                    <div className="address-header">
                      <div className="address-info">
                        <span className="address-number">#{addressIndex + 1}</span>
                        <div className="address-text-wrapper">
                          <h4 className="address-text">{address}</h4>
                        </div>
                      </div>
                      <div className="address-actions">
                        {savedStatuses[address] && (
                          <div className="saved-status">
                            <FontAwesomeIcon 
                              icon={isAddressLoading ? faSpinner : getStatusIcon(savedStatuses[address].status)} 
                              spin={isAddressLoading}
                              style={{ 
                                color: getStatusColor(savedStatuses[address].status),
                                marginRight: '6px' 
                              }} 
                            />
                            <span style={{ color: getStatusColor(savedStatuses[address].status) }}>
                              {savedStatuses[address].status === 'ja' ? 'Ja' : 
                               savedStatuses[address].status === 'ikke_hjemme' ? 'Ikke hjemme' : 
                               savedStatuses[address].status === 'nei' ? 'Nei' :
                               savedStatuses[address].status === 'folg_opp' ? 'Følg opp' :
                               'Ukjent'}
                              {isTalkmoreCampaign && savedStatuses[address].status === 'nei' && (
                                <span style={{ display: 'block', fontSize: 11, marginTop: 2, opacity: 0.95 }}>
                                  {savedStatuses[address].nei_subcategory_display ||
                                    labelForNeiSubcategory(savedStatuses[address].nei_subcategory)}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {!savedStatuses[address] && (
                      isTalkmoreCampaign && neiFlowAddress === address ? (
                        <NeiSubcategoryInlineStep
                          disabled={loading || isCheckingApartments}
                          serverError={neiFlowError}
                          onBack={() => {
                            setNeiFlowError(null);
                            setNeiFlowAddress(null);
                          }}
                          onConfirm={async (sub) => {
                            try {
                              setNeiFlowError(null);
                              // null = programmatic submit (no DOM event) — avoids partial-event crashes
                              const res = await handleStatusSelect(
                                null,
                                address,
                                'nei',
                                sub,
                                true
                              );
                              if (!res?.success) {
                                setNeiFlowError(
                                  res?.error || 'Kunne ikke lagre adresse'
                                );
                              }
                            } catch (err) {
                              setNeiFlowError(
                                err?.message || 'Kunne ikke lagre adresse'
                              );
                            }
                          }}
                        />
                      ) : (
                      <div className="status-buttons">
                        {enhancedStatusOptions.map((option, i) => {
                          const isDisabled = loading || isCheckingApartments;
                          return (
                          <button
                            key={i}
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
                              e.nativeEvent.stopImmediatePropagation();
                              if (option.value === 'nei' && isTalkmoreCampaign) {
                                setNeiFlowError(null);
                                setNeiFlowAddress(address);
                              } else {
                                handleStatusSelect(e, address, option.value);
                              }
                            }}
                            disabled={isDisabled}
                            title={option.label}
                          >
                            <FontAwesomeIcon icon={option.icon} style={{ fontSize: '12px' }} />
                            <span>{option.label}</span>
                          </button>
                        );
                        })}
                      </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {loading && (
          <div className="loading-message">
            <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
            Lagrer status...
          </div>
        )}
        
        {user && (
          <div className="user-info">
            Logget inn som: {user.username || user.user_info?.name || 'Unknown'} ({user.user_type})
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingAddressPopup;
