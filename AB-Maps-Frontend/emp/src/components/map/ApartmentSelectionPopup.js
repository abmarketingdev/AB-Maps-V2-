import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faArrowLeft, faBuilding } from '@fortawesome/free-solid-svg-icons';
import './ApartmentSelectionPopup.css';

/**
 * @deprecated This component is DEPRECATED as of Phase 4 cleanup.
 * 
 * Buildings with apartments should now use:
 * - BuildingSummaryCard: For showing building overview
 * - ApartmentListDrawer: For managing individual apartments
 * 
 * These new components integrate with the backend Building/Apartment model
 * via buildingService.js instead of direct Geonorge API calls.
 * 
 * This component may be removed in a future release.
 * 
 * Original description:
 * Apartment Selection Popup Component
 * Displays a list of apartments for a given address and allows user to select one
 */
const ApartmentSelectionPopup = ({
  isOpen,
  onClose,
  baseAddress,
  apartments = [], // Array of unit numbers
  onSelectApartment
}) => {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const popupRef = useRef(null);

  // Reset selected unit when popup opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedUnit(null);
    }
  }, [isOpen]);

  // Close popup when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [isOpen, onClose]);

  // Stop all event propagation to prevent map interaction
  const stopAll = (e) => {
    if (!e) return;
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // Handle apartment selection
  const handleSelect = () => {
    if (selectedUnit && onSelectApartment) {
      onSelectApartment(selectedUnit);
      // Small delay to show visual feedback before closing
      setTimeout(() => {
        onClose();
      }, 300);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setSelectedUnit(null);
    onClose();
  };

  if (!isOpen) return null;

  // Render popup using portal to document.body for complete isolation
  const popupContent = (
    <>
      {/* Backdrop */}
      <div
        className="apartment-popup-backdrop"
        onClick={handleCancel}
        onMouseDown={stopAll}
        onMouseUp={stopAll}
        onTouchStart={stopAll}
        onTouchEnd={stopAll}
        onContextMenu={(e) => { e.preventDefault(); stopAll(e); }}
      />
      
      {/* Popup */}
      <div
        ref={popupRef}
        className="apartment-selection-popup"
        onClick={stopAll}
        onMouseDown={stopAll}
        onMouseUp={stopAll}
        onTouchStart={stopAll}
        onTouchEnd={stopAll}
        onPointerDown={stopAll}
        onPointerUp={stopAll}
        onContextMenu={(e) => { e.preventDefault(); stopAll(e); }}
        onWheel={stopAll}
        onScroll={stopAll}
      >
        {/* Header */}
        <div className="apartment-popup-header">
          <button
            className="apartment-popup-back-button"
            onClick={(e) => {
              stopAll(e);
              handleCancel();
            }}
            aria-label="Tilbake"
            title="Tilbake"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="apartment-popup-title">
            <FontAwesomeIcon icon={faBuilding} className="apartment-title-icon" />
            <h3>Velg leilighet</h3>
          </div>
          <button
            className="apartment-popup-close-button"
            onClick={(e) => {
              stopAll(e);
              handleCancel();
            }}
            aria-label="Lukk"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="apartment-popup-content">
          {/* Base address display */}
          <div className="apartment-base-address">
            <div className="base-address-icon">
              <FontAwesomeIcon icon={faBuilding} />
            </div>
            <div className="base-address-info">
              <span className="base-address-label">Adresse</span>
              <span className="base-address-text">{baseAddress}</span>
            </div>
          </div>

          {/* Apartment count indicator */}
          {apartments.length > 0 && (
            <div className="apartment-count-indicator">
              <span className="count-badge">{apartments.length}</span>
              <span className="count-text">
                {apartments.length === 1 ? 'leilighet funnet' : 'leiligheter funnet'}
              </span>
            </div>
          )}

          {/* Apartment list */}
          {apartments.length === 0 ? (
            <div className="apartment-empty-message">
              <FontAwesomeIcon icon={faBuilding} className="empty-icon" />
              <p>Ingen leiligheter funnet for denne adressen.</p>
            </div>
          ) : (
            <>
              <div className="apartment-list-header">
                <span>Velg leilighet fra listen:</span>
              </div>
              <div className="apartments-list">
                {apartments.map((unit, index) => (
                  <div
                    key={index}
                    className={`apartment-item ${selectedUnit === unit ? 'selected' : ''}`}
                    onClick={() => setSelectedUnit(unit)}
                    onMouseDown={stopAll}
                    onTouchStart={stopAll}
                  >
                    <div className="apartment-item-number-badge">
                      <span className="apartment-number">{unit}</span>
                    </div>
                    <div className="apartment-item-content">
                      <span className="apartment-label">Leilighet</span>
                      <span className="apartment-address">
                        {baseAddress}, leilighet {unit}
                      </span>
                    </div>
                    {selectedUnit === unit && (
                      <div className="apartment-checkmark">
                        <FontAwesomeIcon 
                          icon={faCheck} 
                          className="selected-icon" 
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="apartment-popup-actions">
            <button
              className="apartment-cancel-button"
              onClick={(e) => {
                stopAll(e);
                handleCancel();
              }}
            >
              Avbryt
            </button>
            <button
              className="apartment-select-button"
              onClick={(e) => {
                stopAll(e);
                handleSelect();
              }}
              disabled={!selectedUnit}
            >
              Velg
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Use portal to render directly to document.body, completely isolated from parent
  return ReactDOM.createPortal(popupContent, document.body);
};

export default ApartmentSelectionPopup;

