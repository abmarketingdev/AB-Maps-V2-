import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTimes, faTrash, faSpinner, faRedo, faCopy } from '@fortawesome/free-solid-svg-icons';
import './FloatingAddressMarkerPopup.css';
import useMobileOptimization from '../../hooks/useMobileOptimization';
import addressService from '../../services/addressService';
import { labelForNeiSubcategory } from '../../constants/neiSubcategory';
import NeiSubcategoryInlineStep from './NeiSubcategoryInlineStep';

/**
 * Floating popup for regular address markers - centered on screen with event isolation
 * Uses portal rendering and center-screen positioning
 */
const FloatingAddressMarkerPopup = ({ 
  marker, 
  onClose, 
  onDelete, 
  canDelete,
  mapRef,
  onCopyAddress,  // Optional callback for search bar update
  token,          // Authentication token
  employee,       // Employee/user object for permission checking
  onAddressUpdated, // (updatedAddress) => sync map marker state
}) => {
  // 🔵 DEBUGGING: Log at the VERY TOP to track popup rendering
  console.log('🔵🔵🔵 [FloatingAddressMarkerPopup] ===== POPUP RENDERING =====', {
    hasMarker: !!marker,
    marker,
    markerId: marker?.id || marker?.addressId,
    markerAddress: marker?.address,
    isUploadedAddress: marker?.isUploadedAddress,
    hasPosition: !!marker?.position,
    timestamp: Date.now()
  });

  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Copy address state
  const [copied, setCopied] = useState(false);
  
  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);
  
  // Address data state
  const [fullAddressData, setFullAddressData] = useState(null);
  const [canDeleteAddress, setCanDeleteAddress] = useState(false);
  const [fetchingPermissions, setFetchingPermissions] = useState(true);
  const [editStatusMode, setEditStatusMode] = useState(false);
  const [neiReasonStep, setNeiReasonStep] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  
  // MOBILE OPTIMIZED: Use mobile optimization hook
  const { getPopupDelay, getPortalStrategy, shouldReduceAnimations } = useMobileOptimization();
  
  // Refs for selection prevention only (no positioning needed for centered popup)
  const canCloseRef = useRef(false);

  // MOBILE OPTIMIZED: Use dynamic popup delay based on device performance
  useEffect(() => {
    const delay = getPopupDelay();
    
    const timer = setTimeout(() => {
      canCloseRef.current = true;
    }, delay);
    return () => clearTimeout(timer);
  }, [getPopupDelay]);

  // Enhanced ESC key handling
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [onClose]);

  // Fetch full address data to determine permissions and load notes
  useEffect(() => {
    const fetchAddressPermissions = async () => {
      if (!marker?.addressId || !token) {
        setFetchingPermissions(false);
        return;
      }

      setFetchingPermissions(true);
      
      try {
        const response = await addressService.getAddress(marker.addressId, token);
        setFullAddressData(response);
        
        // Initialize notes state with fetched data
        setNotes(response.notes || '');
        
        // Owner check: the serializer returns FLAT ids. An employee owns a marker when its
        // employee_id matches their domain id (backend stamps employee_id on emp-created rows),
        // or when created_by_user_id matches their auth user id. Backend enforces the same rule.
        const domainId = employee?.id;
        const authId = employee?.user_id || employee?.user?.id;
        const creator = response.created_by_user_id;
        const canDelete =
          (!!response.employee_id && String(response.employee_id) === String(domainId)) ||
          (!!creator && !!authId && String(creator) === String(authId));

        setCanDeleteAddress(canDelete);
        
      } catch (err) {
        console.error('Error fetching address data:', err);
        setError('Kunne ikke hente adresseinformasjon');
        setCanDeleteAddress(false);
      } finally {
        setFetchingPermissions(false);
      }
    };

    fetchAddressPermissions();
  }, [marker?.addressId, token, employee]);

  useEffect(() => {
    setEditStatusMode(false);
    setNeiReasonStep(false);
    setStatusError(null);
  }, [marker?.addressId]);

  const patchVisitStatus = useCallback(
    async (newStatus, neiSub = undefined) => {
      if (!marker?.addressId || !token) return;
      setSavingStatus(true);
      setStatusError(null);
      try {
        const payload = { status: newStatus };
        if (fullAddressData?.employee?.id) {
          payload.employee_id = fullAddressData.employee.id;
        } else if (fullAddressData?.manager?.id) {
          payload.manager_id = fullAddressData.manager.id;
        }
        if (newStatus === 'nei' && neiSub !== undefined) {
          payload.nei_subcategory = neiSub;
        }
        const updated = await addressService.patchAddress(
          marker.addressId,
          payload,
          token
        );
        setFullAddressData(updated);
        onAddressUpdated?.(updated);
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
    },
    [marker?.addressId, token, fullAddressData, onAddressUpdated]
  );

  // MOBILE OPTIMIZED: Memoize computed values to prevent re-calculations
  const computedValues = useMemo(() => {
    if (!marker?.position) return null;
    
    const { lat, lng } = marker.position;
    const address = marker.address || 'Ukjent adresse';
    const status = fullAddressData?.status ?? marker.status ?? 'ukjent';
    const statusColor = marker.status === 'ja' ? '#27ae60' : 
                       marker.status === 'ikke_hjemme' ? '#f39c12' : 
                       marker.status === 'nei' ? '#e74c3c' : 
                       marker.status === 'folg_opp' ? '#9b59b6' : '#95a5a6';
    
    return { lat, lng, address, status, statusColor };
  }, [marker?.position, marker?.address, marker?.status, fullAddressData?.status]);
  
  if (!computedValues) return null;
  
  const { lat, lng, address, status, statusColor } = computedValues;

  // MOBILE OPTIMIZED: Memoize status functions to prevent recreations
  const getStatusText = useCallback((status) => {
    switch (status) {
      case 'ja': return 'Ja';
      case 'ikke_hjemme': return 'Ikke hjemme';
      case 'nei': return 'Nei';
      case 'folg_opp': return 'Følg opp';
      default: return 'Ukjent';
    }
  }, []);

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'ja': return faCheck;
      case 'ikke_hjemme': return faClock;
      case 'nei': return faTimes;
      case 'folg_opp': return faRedo;
      default: return faCheck;
    }
  }, []);

  /**
   * Copy address to clipboard and update search bar
   */
  const handleCopyAddress = useCallback(async () => {
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
  }, [address, onCopyAddress]);

  /**
   * Save notes to backend
   * Uses PATCH for partial update (efficient)
   * Updates local state on success
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
      const updated = await addressService.patchAddress(marker.addressId, payload, token);
      
      // Update local state with backend response
      setFullAddressData(prev => ({ ...prev, notes: updated.notes }));
      setNotes(updated.notes || '');
      setIsEditingNotes(false);
      
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

  const handleDelete = async () => {
    if (!marker?.addressId && !marker?.id) {
      setError('Kunne ikke slette punktet - mangler nødvendig informasjon');
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      if (onDelete) {
        console.log('🔄 Calling onDelete for marker:', marker?.addressId || marker?.id);
        await onDelete(marker);
        console.log('✅ Delete successful, closing popup in 100ms');
        // ENHANCED: Add delay to ensure state clearing is complete before closing
        setTimeout(() => {
          onClose();
        }, 100);
      }
    } catch (err) {
      console.error('Delete error in popup:', err);
      // Let the error propagate to useMapState for toast handling
      // Don't set local error state, as useMapState will handle the toast
      throw err; // Re-throw so useMapState can catch it and show toast
    } finally {
      setIsDeleting(false);
    }
  };

  // MOBILE OPTIMIZED: Performance-aware portal setup
  const portalTarget = useRef(null);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const { useBodyFallback, preloadPortal } = getPortalStrategy();
    
    // Use optimized portal target based on device capabilities
    if (preloadPortal) {
      // High-performance devices: use ui-layer with fallback
      portalTarget.current = document.getElementById('ui-layer') || document.body;
    } else {
      // Low-performance devices: use body directly for faster rendering
      portalTarget.current = useBodyFallback ? document.body : 
                            (document.getElementById('ui-layer') || document.body);
    }
    
    setIsReady(true);
  }, [getPortalStrategy]);
  
  if (!isReady || !marker?.position) return null;

  return createPortal(
    <>
      {/* Backdrop with selection prevention and arming gate */}
      <div 
        className="fam-backdrop"
        onMouseDown={(e) => { 
          e.preventDefault();          // stops text selection highlight
          e.stopPropagation();
          if (!canCloseRef.current) return;
          console.log('🔴 Backdrop clicked - closing popup');
          onClose();
        }}
      />
      
      {/* Outer container - centered on screen */}
      <div 
        className="fam-outer"
      >
        {/* Inner container - MOBILE OPTIMIZED animation and styling */}
        <div 
          className={`fam-inner ${shouldReduceAnimations() ? 'fam-no-animation' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onWheel={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onTouchStart={(e) => { e.stopPropagation(); }}
        >
          <div className="fam-header">
            <h3>Adresse Detaljer</h3>
            <button 
              className="fam-close-button" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                console.log('🔴 Close button clicked - bypassing arming gate');
                onClose();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
            >
              ×
            </button>
          </div>
          
          <div className="fam-content">
            {error && (
              <div className="fam-error">{error}</div>
            )}

            <div className="fam-address-info">
              <div className="fam-address-header">
                <h4 className="fam-address-text">{address}</h4>
                <button 
                  className="fam-copy-address-btn"
                  onClick={handleCopyAddress}
                  title={copied ? "Kopiert!" : "Kopier adresse"}
                  type="button"
                >
                  <FontAwesomeIcon 
                    icon={faCopy} 
                    style={{ fontSize: '14px' }} 
                  />
                  {copied && <span className="fam-copied-text">Kopiert!</span>}
                </button>
              </div>
              {/* Coordinates removed - not needed in employee marker popup */}
            </div>
            
            {/* Creator Section - Only show for addresses (not uploaded addresses) */}
            {marker?.creator_name && marker?.creator_type && (
              <div className="fam-creator-section">
                <h5>Opprettet av</h5>
                <div className="fam-creator-display">
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
            
            <div className="fam-status-section">
              <h5>Status</h5>
              <div className="fam-status-display">
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
                        className="fam-btn-edit-notes"
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
            <div className="fam-notes-section">
              <div className="fam-notes-header">
                <h5>📝 Notater</h5>
                {!isEditingNotes && canDeleteAddress && !fetchingPermissions && (
                  <button 
                    onClick={() => setIsEditingNotes(true)}
                    className="fam-btn-edit-notes"
                    type="button"
                  >
                    ✏️ {fullAddressData?.notes ? 'Rediger' : 'Legg til'}
                  </button>
                )}
              </div>
              
              {isEditingNotes ? (
                <div className="fam-notes-editor">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={2000}
                    rows={5}
                    className="fam-notes-textarea"
                    placeholder="Legg til notater om denne adressen...

Eksempler:
• Første besøk - ikke hjemme
• Prøv igjen etter kl 18:00
• Interessert i månedlig støtte
• Kontaktperson: [navn]"
                    disabled={savingNotes}
                    autoFocus
                  />
                  <div className="fam-notes-footer">
                    <span className={`fam-char-count ${notes.length > 1900 ? 'warning' : ''}`}>
                      {notes.length} / 2000 tegn
                    </span>
                    <div className="fam-notes-actions">
                      <button 
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="fam-btn-save-notes"
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
                        className="fam-btn-cancel-notes"
                        type="button"
                      >
                        ❌ Avbryt
                      </button>
                    </div>
                  </div>
                  {notesError && (
                    <div className="fam-notes-error">{notesError}</div>
                  )}
                </div>
              ) : (
                <div className="fam-notes-display">
                  {fetchingPermissions ? (
                    <em className="fam-no-notes">Henter notater...</em>
                  ) : fullAddressData?.notes ? (
                    fullAddressData.notes.split('\n').map((line, i) => (
                      <p key={i}>{line || <br />}</p>
                    ))
                  ) : (
                    <em className="fam-no-notes">Ingen notater ennå. Klikk "Legg til" for å legge til notater.</em>
                  )}
                </div>
              )}
            </div>
            
            {canDelete && (
              <div className="fam-actions-section">
                <button
                  className="fam-delete-button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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
          </div>
        </div>
      </div>
    </>,
    portalTarget.current
  );
};

export default FloatingAddressMarkerPopup;