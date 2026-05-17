import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTimes, faTrash, faEdit, faSpinner, faCopy, faRedo } from '@fortawesome/free-solid-svg-icons';
import addressService from '../../services/addressService';
import { useAuth } from '../../contexts/AuthContext';
import { labelForNeiSubcategory } from '../../constants/neiSubcategory';
import NeiSubcategoryInlineStep from './NeiSubcategoryInlineStep';
import './FloatingAddressMarkerPopup.css';

const FloatingAddressMarkerPopup = ({ 
  marker, 
  onClose, 
  onDelete, 
  canDelete,
  onCopyAddress,
  onAddressUpdated,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fullAddressData, setFullAddressData] = useState(null);
  const [canDeleteAddress, setCanDeleteAddress] = useState(false);
  const [fetchingPermissions, setFetchingPermissions] = useState(true);
  const popupRef = useRef(null);
  
  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);
  
  // Copy address state
  const [copied, setCopied] = useState(false);
  const [editStatusMode, setEditStatusMode] = useState(false);
  const [neiReasonStep, setNeiReasonStep] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Position the popup at the marker location with mobile centering
  useEffect(() => {
    if (popupRef.current && marker?.position) {
      const mapContainer = document.querySelector('.leaflet-container');
      
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        const map = mapContainer._leaflet_map || mapContainer.leaflet_map;
        
        if (map) {
          try {
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
          } catch (error) {
            // Fallback: center the popup on screen
            popupRef.current.style.left = '50%';
            popupRef.current.style.top = '50%';
            popupRef.current.style.transform = 'translate(-50%, -50%)';
            popupRef.current.style.position = 'fixed';
            popupRef.current.style.zIndex = '100000';
          }
        } else {
          // Fallback: center the popup on screen
          popupRef.current.style.left = '50%';
          popupRef.current.style.top = '50%';
          popupRef.current.style.transform = 'translate(-50%, -50%)';
          popupRef.current.style.position = 'fixed';
          popupRef.current.style.zIndex = '100000';
        }
      } else {
        // Fallback: center the popup on screen
        popupRef.current.style.left = '50%';
        popupRef.current.style.top = '50%';
        popupRef.current.style.transform = 'translate(-50%, -50%)';
        popupRef.current.style.position = 'fixed';
        popupRef.current.style.zIndex = '100000';
      }
    }
  }, [marker]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking on delete button or its children
      if (event.target.closest('.delete-button')) {
        return;
      }
      
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Fetch full address data to determine permissions
  useEffect(() => {
    const fetchAddressPermissions = async () => {
      if (!marker?.addressId || !user) {
        setFetchingPermissions(false);
        return;
      }

      setFetchingPermissions(true);
      
      try {
        const response = await addressService.getAddress(marker.addressId);
        setFullAddressData(response);
        
        // Initialize notes state with fetched data
        setNotes(response.notes || '');
        
        // Check permissions based on user type
        let canDelete = false;
        const currentUserId = user?.user_info?.id;
        
        if (user.user_type === 'manager' && response.manager?.id) {
          canDelete = response.manager.id === currentUserId;
        } else if (user.user_type === 'employee' && response.employee?.id) {
          canDelete = response.employee.id === currentUserId;
        }
        
        setCanDeleteAddress(canDelete);
        
      } catch (err) {
        setError('Kunne ikke hente adresseinformasjon');
        setCanDeleteAddress(false);
      } finally {
        setFetchingPermissions(false);
      }
    };

    fetchAddressPermissions();
  }, [marker?.addressId, user]);

  useEffect(() => {
    setEditStatusMode(false);
    setNeiReasonStep(false);
    setStatusError(null);
  }, [marker?.addressId]);

  const patchVisitStatus = async (newStatus, neiSub = undefined) => {
    if (!marker?.addressId) return;
    setSavingStatus(true);
    setStatusError(null);
    try {
      const payload = { status: newStatus };
      if (user?.user_type === 'employee' && fullAddressData?.employee?.id) {
        payload.employee_id = fullAddressData.employee.id;
      } else if (user?.user_type === 'manager' && fullAddressData?.manager?.id) {
        payload.manager_id = fullAddressData.manager.id;
      } else if (fullAddressData?.employee?.id) {
        payload.employee_id = fullAddressData.employee.id;
      } else if (fullAddressData?.manager?.id) {
        payload.manager_id = fullAddressData.manager.id;
      }
      if (newStatus === 'nei' && neiSub !== undefined) {
        payload.nei_subcategory = neiSub;
      }
      const updated = await addressService.patchAddress(marker.addressId, payload);
      setFullAddressData(updated);
      onAddressUpdated?.(updated);
      try {
        const v = (window.tilesVersion || 0) + 1;
        window.tilesVersion = v;
        window.dispatchEvent(
          new CustomEvent('tilesVersionUpdate', {
            detail: {
              version: v,
              reason: 'status_updated',
              addressId: marker.addressId,
            },
          })
        );
      } catch (_) {}
      setEditStatusMode(false);
      setNeiReasonStep(false);
    } catch (err) {
      console.error('Status patch error:', err);
      setStatusError(
        err?.message || 'Kunne ikke oppdatere status'
      );
    } finally {
      setSavingStatus(false);
    }
  };

  if (!marker?.position) {
    return null;
  }

  const { lat, lng } = marker.position;
  const address = marker.address || 'Ukjent adresse';
  const status = (fullAddressData?.status ?? marker.status) || 'ukjent';
  const statusColor = status === 'ja' ? '#27ae60' : 
                     status === 'ikke_hjemme' ? '#f39c12' : 
                     status === 'nei' ? '#e74c3c' : 
                     status === 'folg_opp' ? '#9b59b6' :
                     '#95a5a6';

  const getStatusText = (status) => {
    switch (status) {
      case 'ja': return 'Ja';
      case 'ikke_hjemme': return 'Ikke hjemme';
      case 'nei': return 'Nei';
      case 'folg_opp': return 'Følg opp';
      default: return 'Ukjent';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ja': return faCheck;
      case 'ikke_hjemme': return faClock;
      case 'nei': return faTimes;
      case 'folg_opp': return faRedo;
      default: return faCheck;
    }
  };

  const handleDelete = async () => {
    if (!marker?.addressId) {
      setError('Kunne ikke slette punktet - mangler nødvendig informasjon');
      return;
    }
    
    if (!canDeleteAddress) {
      setError('Du kan ikke slette dette punktet');
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    try {
      // Try direct API delete to surface permission errors here
      await addressService.deleteAddress(marker.addressId);
      
      // Force immediate viewport tile refresh to remove deleted marker
      try {
        // Import tile refresh utilities dynamically
        const { forceViewportTileRefresh } = await import('../../utils/viewportTileRefresh');
        
        // Get map instance from global or try to find it
        const mapInstance = window.mapInstance || document.querySelector('.leaflet-container')?._leaflet_map;
        
        if (mapInstance) {
          // Trigger tile version update via custom event
          const currentVersion = window.tilesVersion || 0;
          const newVersion = currentVersion + 1;
          window.tilesVersion = newVersion;
          
          // Dispatch custom event to update tiles version in App component
          window.dispatchEvent(new CustomEvent('tilesVersionUpdate', { 
            detail: { 
              version: newVersion, 
              reason: 'address_deleted',
              addressId: marker.addressId,
              position: marker.position
            } 
          }));
          
          // Also call the refresh function directly
          forceViewportTileRefresh(
            () => {} // setTilesVersion will be handled by the event
          );
        }
      } catch (refreshError) {
        // Don't fail the deletion if tile refresh fails
      }
      
      // Ask parent to refresh markers if provided, but mark to skip API delete
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

  /**
   * Save notes to backend
   * Uses PATCH for partial update (efficient)
   * Updates local state on success
   * Triggers tile refresh to show changes on map
   */
  const handleSaveNotes = async () => {
    // Validation: Check we have address ID
    if (!marker?.addressId) {
      setNotesError('Kunne ikke lagre - mangler adresse-ID');
      return;
    }
    
    // Permission: Check user owns this marker
    if (!canDeleteAddress) {
      setNotesError('Du kan kun redigere dine egne punkter');
      return;
    }
    
    setSavingNotes(true);
    setNotesError(null);
    
    try {
      // Trim whitespace and convert empty to null
      const trimmedNotes = notes.trim();
      
      // Prepare payload with required IDs from fullAddressData
      const payload = {
        notes: trimmedNotes || null
      };
      
      // Backend requires either employee_id or manager_id even for PATCH
      // Include the appropriate ID based on who owns the marker
      if (fullAddressData?.employee?.id) {
        payload.employee_id = fullAddressData.employee.id;
      } else if (fullAddressData?.manager?.id) {
        payload.manager_id = fullAddressData.manager.id;
      }
      
      // Call PATCH endpoint
      const updated = await addressService.patchAddress(marker.addressId, payload);
      
      // Update local state with backend response
      setFullAddressData(prev => ({ ...prev, notes: updated.notes }));
      setNotes(updated.notes || '');
      setIsEditingNotes(false);
      
      // Force tile refresh (same pattern as delete)
      try {
        const currentVersion = window.tilesVersion || 0;
        const newVersion = currentVersion + 1;
        window.tilesVersion = newVersion;
        
        // Dispatch event for App component to catch
        window.dispatchEvent(new CustomEvent('tilesVersionUpdate', { 
          detail: { 
            version: newVersion, 
            reason: 'notes_updated',
            addressId: marker.addressId,
            position: marker.position
          } 
        }));
      } catch (refreshError) {
        // Non-critical: Don't fail save if refresh fails
        console.warn('Tile refresh failed:', refreshError);
      }
      
    } catch (err) {
      // Parse error message
      const msg = err?.message || '';
      
      // User-friendly error messages
      if (msg.includes('403') || msg.includes('401')) {
        setNotesError('Du kan kun redigere dine egne punkter');
      } else if (msg.includes('2000') || msg.includes('too long')) {
        setNotesError('Notater kan ikke være lengre enn 2000 tegn');
      } else {
        setNotesError('Kunne ikke lagre notater - prøv igjen');
      }
      
      console.error('Error saving notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  /**
   * Cancel editing and restore original notes
   * Clears any error messages
   */
  const handleCancelNotesEdit = () => {
    setNotes(fullAddressData?.notes || '');
    setIsEditingNotes(false);
    setNotesError(null);
  };

  /**
   * Copy address to clipboard and update search bar
   */
  const handleCopyAddress = async () => {
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(address);
      
      // Update search bar if callback provided
      if (onCopyAddress) {
        onCopyAddress(address);
      }
      
      // Show "Copied!" feedback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = address;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (onCopyAddress) {
          onCopyAddress(address);
        }
        
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr);
      }
    }
  };

  return (
    <div 
      ref={popupRef}
      className="floating-address-marker-popup"
      onClick={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onWheel={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onTouchMove={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onScroll={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
    >
      <div className="popup-header">
        <h3>Adresse Detaljer</h3>
        <button 
          className="close-button" 
          onClick={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
              e.nativeEvent.stopImmediatePropagation();
            }
            onClose();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
        >
          ×
        </button>
      </div>
      
      <div className="popup-content">
        {error && (
          <div className="error-message">{error}</div>
        )}

        <div className="address-info">
          <div className="address-header">
            <h4 className="address-text">{address}</h4>
            <button 
              className="copy-address-btn"
              onClick={handleCopyAddress}
              title={copied ? "Kopiert!" : "Kopier adresse"}
              type="button"
            >
              <FontAwesomeIcon 
                icon={faCopy} 
                style={{ fontSize: '14px' }} 
              />
              {copied && <span className="copied-text">Kopiert!</span>}
            </button>
          </div>
        </div>
        
        {/* Creator Section - Only show for addresses (not uploaded addresses) */}
        {marker?.creator_name && marker?.creator_type && (
          <div className="creator-section">
            <h5>Opprettet av</h5>
            <div className="creator-display">
              <span style={{ fontWeight: '600', marginRight: '8px' }}>
                {marker.creator_name}
              </span>
              <span style={{ 
                color: '#666', 
                fontSize: '13px',
                textTransform: 'capitalize'
              }}>
                ({marker.creator_type === 'manager' ? 'Manager' : 'Ansatt'})
              </span>
            </div>
          </div>
        )}
        
        <div className="status-section">
          <h5>Status</h5>
          <div className="status-display">
            <FontAwesomeIcon 
              icon={getStatusIcon(status)} 
              style={{ color: statusColor, marginRight: '8px' }} 
            />
            <span style={{ color: statusColor, fontWeight: '600' }}>
              {getStatusText(status)}
              {status === 'nei' && (
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#555',
                    marginTop: 4,
                  }}
                >
                  {fullAddressData?.nei_subcategory_display ||
                    labelForNeiSubcategory(
                      fullAddressData?.nei_subcategory ?? marker?.nei_subcategory
                    )}
                </span>
              )}
            </span>
          </div>
          {canDeleteAddress &&
            !fetchingPermissions &&
            !isEditingNotes && (
              <div style={{ marginTop: 10 }}>
                {!editStatusMode ? (
                  <button
                    type="button"
                    className="btn-edit-notes"
                    onClick={() => {
                      setEditStatusMode(true);
                      setNeiReasonStep(false);
                      setStatusError(null);
                    }}
                  >
                    Endre status
                  </button>
                ) : neiReasonStep ? (
                  <NeiSubcategoryInlineStep
                    disabled={savingStatus}
                    confirmLabel="Lagre Nei"
                    onBack={() => setNeiReasonStep(false)}
                    onConfirm={(sub) => patchVisitStatus('nei', sub)}
                  />
                ) : (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      {[
                        { value: 'ja', label: 'Ja', color: '#27ae60' },
                        {
                          value: 'ikke_hjemme',
                          label: 'Ikke hjemme',
                          color: '#f39c12',
                        },
                        { value: 'nei', label: 'Nei', color: '#e74c3c' },
                        {
                          value: 'folg_opp',
                          label: 'Følg opp',
                          color: '#9b59b6',
                        },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={savingStatus}
                          onClick={() => {
                            if (opt.value === 'nei') {
                              setNeiReasonStep(true);
                            } else {
                              patchVisitStatus(opt.value);
                            }
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: 'none',
                            background: opt.color,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: savingStatus ? 'not-allowed' : 'pointer',
                            opacity: savingStatus ? 0.7 : 1,
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={savingStatus}
                      onClick={() => {
                        setEditStatusMode(false);
                        setNeiReasonStep(false);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        border: '1px solid #ccc',
                        borderRadius: 6,
                        background: '#fff',
                      }}
                    >
                      Avbryt
                    </button>
                    {savingStatus && (
                      <span style={{ marginLeft: 8, fontSize: 12 }}>
                        <FontAwesomeIcon icon={faSpinner} spin /> Lagrer…
                      </span>
                    )}
                    {statusError && (
                      <div
                        style={{
                          color: '#c0392b',
                          fontSize: 12,
                          marginTop: 6,
                        }}
                      >
                        {statusError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
        
        {/* Notes Section - Editable */}
        <div className="notes-section">
          <div className="notes-header">
            <h5>📝 Notater</h5>
            {!isEditingNotes && canDeleteAddress && !fetchingPermissions && (
              <button 
                onClick={() => setIsEditingNotes(true)}
                className="btn-edit-notes"
                type="button"
              >
                ✏️ {fullAddressData?.notes ? 'Rediger' : 'Legg til'}
              </button>
            )}
          </div>
          
          {isEditingNotes ? (
            <div className="notes-editor">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={5}
                className="notes-textarea"
                placeholder="Legg til notater om denne adressen...

Eksempler:
• Første besøk - ikke hjemme
• Prøv igjen etter kl 18:00
• Interessert i månedlig støtte
• Kontaktperson: [navn]"
                disabled={savingNotes}
                autoFocus
              />
              <div className="notes-footer">
                <span className={`char-count ${notes.length > 1900 ? 'warning' : ''}`}>
                  {notes.length} / 2000 tegn
                </span>
                <div className="notes-actions">
                  <button 
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="btn-save-notes"
                    type="button"
                  >
                    {savingNotes ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '6px' }} />
                        Lagrer...
                      </>
                    ) : (
                      <>💾 Lagre</>
                    )}
                  </button>
                  <button 
                    onClick={handleCancelNotesEdit}
                    disabled={savingNotes}
                    className="btn-cancel-notes"
                    type="button"
                  >
                    ❌ Avbryt
                  </button>
                </div>
              </div>
              {notesError && (
                <div className="notes-error">{notesError}</div>
              )}
            </div>
          ) : (
            <div className="notes-display">
              {fullAddressData?.notes ? (
                fullAddressData.notes.split('\n').map((line, i) => (
                  <p key={i}>{line || <br />}</p>
                ))
              ) : (
                <em className="no-notes">Ingen notater ennå. Klikk "Legg til" for å legge til notater.</em>
              )}
            </div>
          )}
        </div>
        
        <div className="actions-section">
          <button
            className="delete-button"
            style={{
              position: 'relative',
              zIndex: 1000002,
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              // CRITICAL: Stop all propagation immediately
              e.preventDefault();
              e.stopPropagation();
              if (e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
              }
              if (e.nativeEvent) {
                if (e.nativeEvent.stopPropagation) {
                  e.nativeEvent.stopPropagation();
                }
                if (e.nativeEvent.stopImmediatePropagation) {
                  e.nativeEvent.stopImmediatePropagation();
                }
              }
              
              // Only call handleDelete if button is not disabled
              if (!isDeleting && !fetchingPermissions && canDeleteAddress) {
                handleDelete();
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
              }
              if (e.nativeEvent) {
                if (e.nativeEvent.stopPropagation) {
                  e.nativeEvent.stopPropagation();
                }
                if (e.nativeEvent.stopImmediatePropagation) {
                  e.nativeEvent.stopImmediatePropagation();
                }
              }
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
              }
              if (e.nativeEvent) {
                if (e.nativeEvent.stopPropagation) {
                  e.nativeEvent.stopPropagation();
                }
                if (e.nativeEvent.stopImmediatePropagation) {
                  e.nativeEvent.stopImmediatePropagation();
                }
              }
            }}
            disabled={isDeleting || fetchingPermissions || !canDeleteAddress}
            title={fetchingPermissions ? 'Sjekker tillatelser...' : !canDeleteAddress ? 'Du kan kun slette dine egne punkter' : 'Slett punkt'}
          >
            {isDeleting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                Sletter...
              </>
            ) : fetchingPermissions ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                Sjekker tillatelser...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faTrash} style={{ marginRight: '8px' }} />
                {canDeleteAddress ? 'Slett punkt' : 'Kan ikke slette'}
              </>
            )}
          </button>
          {!fetchingPermissions && !canDeleteAddress && (
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '8px',
              textAlign: 'center'
            }}>
              Du kan kun slette dine egne punkter
            </div>
          )}
        </div>
        
        {user && (
          <div className="user-info">
            Logget inn som: {user.username || user.user_info?.name || 'Unknown'} ({user.user_type})
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingAddressMarkerPopup; 