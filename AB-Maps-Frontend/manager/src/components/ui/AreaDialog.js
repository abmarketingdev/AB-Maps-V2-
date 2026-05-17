import React from 'react';
import './area-dialog.css';
import { validateDateRange } from '../../utils/dateUtils';

/**
 * Dialog for configuring area properties
 */
const AreaDialog = ({ 
  showDialog, 
  areaData, 
  onDataChange, 
  onConfirm, 
  onCancel, 
  onDelete,
  areaId,
  areaIndex,
  onAddEmployee,
  draftAreas,  // NEW: Pass draftAreas to sync status updates
  onShowTalkmoreResults,  // NEW: Callback for Talkmore results button
  talkmoreResultsLoading = false  // NEW: Loading state for Talkmore results
}) => {

  // Validate end_date when dialog opens or when endDate changes
  React.useEffect(() => {
    if (showDialog && areaData?.endDate) {
      const validation = validateDateRange(areaData.endDate);
      if (!validation.valid) {
        // Set error if validation fails
        if (areaData.endDateError !== validation.error) {
          onDataChange(prev => ({ ...prev, endDateError: validation.error }));
        }
      } else if (areaData.endDateError) {
        // Clear error if validation passes
        onDataChange(prev => ({ ...prev, endDateError: null }));
      }
    } else if (showDialog && !areaData?.endDate && areaData?.endDateError) {
      // Clear error if endDate is removed
      onDataChange(prev => ({ ...prev, endDateError: null }));
    }
  }, [showDialog, areaData?.endDate, areaData?.endDateError, onDataChange]);

  // NEW: Direct state sync from draftAreas - simpler and more reliable approach
  // Use a polling mechanism to check for updates while dialog is open
  React.useEffect(() => {
    if (!showDialog || !areaData?.isDraft || areaIndex === null || !draftAreas || draftAreas.length <= areaIndex) {
      return;
    }
    
    const draft = draftAreas[areaIndex];
    if (!draft) return;
    
    // Always sync from draftAreas (source of truth) - check if values differ
    const needsUpdate = 
      draft.apartmentCalculationStatus !== areaData.apartmentCalculationStatus ||
      draft.apartment_count !== areaData.apartmentCount ||
      draft.house_count !== areaData.houseCount ||
      draft.addressCalculationStatus !== areaData.addressCalculationStatus ||
      (draft.apartmentCalculationProgress && (
        draft.apartmentCalculationProgress.completed !== (areaData.apartmentCalculationProgress?.completed || 0) ||
        draft.apartmentCalculationProgress.total !== (areaData.apartmentCalculationProgress?.total || 0)
      ));
    
    if (needsUpdate) {
      // Sync from draftAreas (source of truth) - use functional update to ensure latest state
      onDataChange(prev => ({
        ...prev,
        addressCalculationStatus: draft.addressCalculationStatus,
        addressCalculationError: draft.addressCalculationError,
        apartmentCalculationStatus: draft.apartmentCalculationStatus,
        apartmentCalculationError: draft.apartmentCalculationError,
        apartmentCalculationProgress: draft.apartmentCalculationProgress || prev.apartmentCalculationProgress,
        houseCount: draft.house_count !== undefined ? draft.house_count : prev.houseCount,
        apartmentCount: draft.apartment_count !== undefined ? draft.apartment_count : (prev.apartmentCount || 0)
      }));
    }
  }, [showDialog, areaIndex, draftAreas, areaData, onDataChange]);
  
  // Polling mechanism: Check for updates every 500ms while dialog is open and calculation is in progress
  React.useEffect(() => {
    if (!showDialog || !areaData?.isDraft || areaIndex === null || !draftAreas) {
      return;
    }
    
    // Only poll if calculation is still in progress
    if (areaData.apartmentCalculationStatus === 'calculating' || areaData.apartmentCalculationStatus === 'pending') {
      const intervalId = setInterval(() => {
        if (areaIndex !== null && draftAreas.length > areaIndex) {
          const draft = draftAreas[areaIndex];
          if (draft && (
            draft.apartmentCalculationStatus !== areaData.apartmentCalculationStatus ||
            draft.apartment_count !== areaData.apartmentCount ||
            (draft.apartmentCalculationProgress && (
              draft.apartmentCalculationProgress.completed !== (areaData.apartmentCalculationProgress?.completed || 0) ||
              draft.apartmentCalculationProgress.total !== (areaData.apartmentCalculationProgress?.total || 0)
            ))
          )) {
            onDataChange(prev => ({
              ...prev,
              addressCalculationStatus: draft.addressCalculationStatus,
              addressCalculationError: draft.addressCalculationError,
              apartmentCalculationStatus: draft.apartmentCalculationStatus,
              apartmentCalculationError: draft.apartmentCalculationError,
              apartmentCalculationProgress: draft.apartmentCalculationProgress || prev.apartmentCalculationProgress,
              houseCount: draft.house_count !== undefined ? draft.house_count : prev.houseCount,
              apartmentCount: draft.apartment_count !== undefined ? draft.apartment_count : (prev.apartmentCount || 0)
            }));
          }
        }
      }, 500); // Check every 500ms
      
      return () => clearInterval(intervalId);
    }
  }, [showDialog, areaData?.isDraft, areaIndex, draftAreas, areaData?.apartmentCalculationStatus, areaData?.apartmentCount, onDataChange]);

  if (!showDialog) {
    return null;
  }

  const handleOverlayClick = (e) => {
    // Only close if clicking the overlay itself, not the dialog content
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  // Prevent all events from bubbling up to the overlay or map
  const stopAll = (e) => {
    if (!e) return;
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  const handleDialogClick = (e) => {
    // Prevent all events from bubbling up to the overlay
    stopAll(e);
  };

  const handleAddEmployee = () => {
    onAddEmployee(areaId, areaData?.title || 'Area');
  };

  // Handle end date change with validation
  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value;
    
    // Clear previous error
    const updatedData = { ...areaData, endDate: newEndDate, endDateError: null };
    
    // Validate if date is provided
    if (newEndDate) {
      const validation = validateDateRange(newEndDate);
      if (!validation.valid) {
        updatedData.endDateError = validation.error;
      }
    }
    
    onDataChange(updatedData);
  };

  return (
    <div 
      className="area-dialog-overlay"
      onClick={handleOverlayClick}
      onMouseDown={stopAll}
      onTouchStart={stopAll}
    >
      <div 
        className="area-dialog"
        onClick={handleDialogClick}
        onMouseDown={handleDialogClick}
        onTouchStart={handleDialogClick}
        onContextMenu={handleDialogClick}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Tildel område</h2>
          <button
            aria-label="Lukk"
            className="close-btn"
            onClick={(e) => {
              stopAll(e);
              onCancel();
            }}
          >
            &times;
          </button>
        </div>
        <div className="area-form">
          <input
            type="text"
            placeholder="Tittel"
            value={areaData.title}
            onChange={(e) => onDataChange({ ...areaData, title: e.target.value })}
            className="area-input"
          />
          <input
            type="color"
            value={areaData.color}
            onChange={(e) => onDataChange({ ...areaData, color: e.target.value })}
            className="area-color-picker"
          />
          
          {/* NEW: End Date Input Field */}
          <div className={`form-group ${areaData.endDateError ? 'has-error' : ''}`} style={{ marginTop: '15px' }}>
            <label htmlFor="endDate" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              Sluttdato (End Date):
            </label>
            <input
              type="datetime-local"
              id="endDate"
              value={areaData.endDate || ''}
              onChange={handleEndDateChange}
              className="area-input"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              min={new Date().toISOString().slice(0, 16)} // Prevent selecting past dates
            />
            <small style={{ display: 'block', marginTop: '5px', color: '#666', fontSize: '12px' }}>
              {areaData.isDraft 
                ? 'Startdato settes automatisk til nå. Velg en sluttdato i fremtiden (ikke før dagens dato).'
                : areaData.endDate 
                  ? 'Du kan endre sluttdatoen for dette området. Sluttdato kan ikke være før dagens dato.'
                  : 'Dette området har ingen sluttdato. Legg til en for å aktivere utløp. Sluttdato kan ikke være før dagens dato.'}
            </small>
            {/* Validation error display */}
            {areaData.endDateError && (
              <div className="error-message" style={{ color: '#e74c3c', fontSize: '12px', marginTop: '5px' }}>
                {areaData.endDateError}
              </div>
            )}
          </div>
          
          <div className="area-info">
            <p>
              Salgsmuligheter: {
                areaData.addressCalculationStatus === 'calculating' 
                  ? <span className="area-loading">Beregner...</span>
                  : areaData.addressCalculationStatus === 'error'
                  ? (
                    <span className="area-error" title={areaData.addressCalculationError || 'Kunne ikke beregne'}>
                      {areaData.addressCalculationError?.includes('timeout') || areaData.addressCalculationError?.includes('Gateway timeout')
                        ? 'Timeout - Prøv igjen senere'
                        : 'Kunne ikke beregne'}
                    </span>
                  )
                  : areaData.houseCount || areaData.house_count || 0
              } boliger
            </p>
            {/* NEW: Show apartment buildings count if available */}
            {(areaData.total_apartment_buildings !== undefined && areaData.total_apartment_buildings > 0) && (
              <p>
                Leilighetsbygg: {areaData.total_apartment_buildings}
              </p>
            )}
            {/* Apartment count display with progress bar (for drafts) or simple display (for saved areas) */}
            {(areaData.isDraft || areaData.apartmentCount !== undefined) && (() => {
              // For drafts: Read directly from draftAreas (source of truth) instead of areaData
              // For saved areas: Use areaData directly
              const draft = areaData.isDraft && (areaIndex !== null && draftAreas && draftAreas.length > areaIndex)
                ? draftAreas[areaIndex] 
                : null;
              
              // Use draft data if available (for drafts), otherwise fall back to areaData (for saved areas)
              const status = draft?.apartmentCalculationStatus ?? areaData.apartmentCalculationStatus;
              const count = draft?.apartment_count ?? areaData.apartmentCount ?? areaData.apartment_count ?? 0;
              const error = draft?.apartmentCalculationError ?? areaData.apartmentCalculationError;
              
              // NEW: Simplified display - backend API is fast, no progress bar needed
              if (status === 'calculating') {
                return (
                  <p className="area-loading">
                    Beregner leiligheter...
                  </p>
                );
              }
              
              if (status === 'error') {
                return (
                  <p className="area-error" title={error || 'Kunne ikke beregne leiligheter'}>
                    Leiligheter: {
                      error?.includes('timeout') || error?.includes('Gateway timeout')
                        ? 'Timeout - Prøv igjen senere'
                        : 'Kunne ikke beregne'
                    }
                  </p>
                );
              }
              
              // Completed or no status (for saved areas)
              return (
                <p>
                  Leiligheter: {count}
                </p>
              );
              
              // OLD: Progress bar implementation - COMMENTED OUT (not needed with new backend API)
              /*
              const progress = draft?.apartmentCalculationProgress ?? areaData.apartmentCalculationProgress ?? { completed: 0, total: 0 };
              const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
              
              if (!areaData.isDraft && count !== undefined) {
                return (
                  <p>
                    Leiligheter: {count ?? 0}
                  </p>
                );
              }
              
              return (
                <>
                  {(status === 'calculating' || status === 'pending') && (
                    <div className="apartment-progress-container">
                      <p className="area-loading">
                        Beregner leiligheter...
                      </p>
                      {progress.total > 0 && (
                        <div className="apartment-progress-wrapper">
                          <div className="apartment-progress-bar">
                            <div 
                              className="apartment-progress-fill"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="apartment-progress-text">
                            {progress.completed} / {progress.total} adresser
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {status === 'completed' && (
                    <p>
                      Leiligheter: {count ?? 0}
                    </p>
                  )}
                  {status === 'error' && (
                    <p className="area-error" title={error || 'Kunne ikke beregne leiligheter'}>
                      Leiligheter: {
                        error?.includes('timeout') || error?.includes('Gateway timeout')
                          ? 'Timeout - Prøv igjen senere'
                          : 'Kunne ikke beregne'
                      }
                    </p>
                  )}
                  {!status && count !== undefined && (
                    <p>
                      Leiligheter: {count}
                    </p>
                  )}
                </>
              );
              */
            })()}
          </div>
          <div className="area-buttons">
            <button
              className="area-delete-button"
              onClick={(e) => {
                stopAll(e);
                onDelete();
              }}
              type="button"
            >
              Slett område
            </button>
            {areaId && (
              <button
                className="area-add-employee-button"
                onClick={(e) => {
                  stopAll(e);
                  handleAddEmployee();
                }}
                type="button"
              >
                Tildel Ansatte
              </button>
            )}
            {areaId && onShowTalkmoreResults && (
              <button
                className="area-talkmore-results-button"
                onClick={(e) => {
                  stopAll(e);
                  onShowTalkmoreResults(areaId);
                }}
                type="button"
                disabled={talkmoreResultsLoading}
              >
                {talkmoreResultsLoading ? 'Laster...' : 'Vis Talkmore-resultater'}
              </button>
            )}
            <button 
              className="area-confirm-button" 
              onClick={(e) => {
                stopAll(e);
                onConfirm();
              }}
              type="button"
            >
              Bekreft
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AreaDialog;
