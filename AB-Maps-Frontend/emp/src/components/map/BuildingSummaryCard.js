import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBuilding, 
  faListUl, 
  faTimes, 
  faCheck, 
  faSpinner,
  faMapMarkerAlt,
  faTrash,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import buildingService from '../../services/buildingService';
import './BuildingSummaryCard.css';

/**
 * BuildingSummaryCard Component (Employee App)
 * 
 * Displays a quick summary of a building's visit progress.
 * Appears when user clicks on a building marker in the map.
 * 
 * Features:
 * - Progress ring visualization
 * - Visit statistics
 * - "Open list" button to access ApartmentListDrawer
 * - Delete button (only visible to creator)
 * - Color-coded status (grey/yellow/blue)
 */
const BuildingSummaryCard = ({
  isOpen,
  onClose,
  buildingId,
  address,
  totalUnits,
  visitedUnits,
  status,           // 'unvisited' | 'in_progress' | 'completed'
  markerColor,      // 'grey' | 'yellow' | 'blue'
  position,
  onOpenDrawer,
  onBuildingDeleted, // Callback when building is deleted
  isLoading = false,
  creatorName,      // Name of the person who created the building
  creatorType,      // 'manager' | 'employee'
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Reset delete confirmation state when card opens or building changes
  useEffect(() => {
    if (isOpen) {
      setShowDeleteConfirm(false);
      setDeleteError(null);
      setIsDeleting(false);
    }
  }, [isOpen, buildingId]);

  if (!isOpen) return null;

  // Calculate percentage
  const percentage = totalUnits > 0 
    ? Math.round((visitedUnits / totalUnits) * 100) 
    : 0;

  // Remaining units
  const remainingUnits = totalUnits - visitedUnits;

  // Calculate status from markerColor if not provided
  // markerColor: 'grey' = unvisited, 'yellow' = in_progress, 'blue' = completed
  const calculatedStatus = status || (
    markerColor === 'blue' ? 'completed' :
    markerColor === 'yellow' ? 'in_progress' :
    'unvisited'
  );

  // Status labels in Norwegian
  const statusLabels = {
    unvisited: 'Ikke startet',
    in_progress: 'Pågående',
    completed: 'Fullført',
  };

  // Color classes based on marker color
  const colorClasses = {
    grey: 'status-grey',
    yellow: 'status-yellow',
    blue: 'status-blue',
  };

  // Get the appropriate color class
  const colorClass = colorClasses[markerColor] || colorClasses.grey;

  // Stop event propagation to prevent map interaction
  const stopPropagation = (e) => {
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // Handle open drawer click
  const handleOpenDrawer = (e) => {
    stopPropagation(e);
    if (onOpenDrawer) {
      // Pass buildingId and address to the handler
      onOpenDrawer(buildingId, address);
    }
  };

  // Handle close click
  const handleClose = (e) => {
    stopPropagation(e);
    setShowDeleteConfirm(false);
    setDeleteError(null);
    if (onClose) {
      onClose();
    }
  };

  // Handle delete click - show confirmation
  const handleDeleteClick = (e) => {
    stopPropagation(e);
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  // Handle cancel delete
  const handleCancelDelete = (e) => {
    stopPropagation(e);
    setShowDeleteConfirm(false);
    setDeleteError(null);
  };

  // Handle confirm delete
  const handleConfirmDelete = async (e) => {
    stopPropagation(e);
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await buildingService.deleteBuilding(buildingId);
      
      // Notify parent that building was deleted
      if (onBuildingDeleted) {
        onBuildingDeleted(buildingId);
      }
      
      // Close the card
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('[BuildingSummaryCard] Delete failed:', error);
      setDeleteError(error.message || 'Kunne ikke slette bygningen. Prøv igjen.');
    } finally {
      setIsDeleting(false);
    }
  };

  const cardContent = (
    <div 
      className="building-summary-backdrop"
      onClick={handleClose}
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <div 
        className={`building-summary-card ${colorClass}`}
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
      >
        {/* Header */}
        <div className="building-summary-header">
          <div className="building-title">
            <FontAwesomeIcon icon={faBuilding} className="building-icon" />
            <h3>{address || 'Ukjent adresse'}</h3>
          </div>
          <button 
            className="close-btn" 
            onClick={handleClose}
            aria-label="Lukk"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Body */}
        <div className="building-summary-body">
          {isLoading ? (
            <div className="loading-state">
              <FontAwesomeIcon icon={faSpinner} spin size="2x" />
              <span>Laster...</span>
            </div>
          ) : showDeleteConfirm ? (
            // Delete confirmation UI
            <div className="delete-confirm-container">
              <div className="delete-warning-icon">
                <FontAwesomeIcon icon={faExclamationTriangle} />
              </div>
              <h4>Slett bygning?</h4>
              <p>
                Er du sikker på at du vil slette denne bygningen og alle {totalUnits} leiligheter?
              </p>
              <p className="delete-warning-text">
                Denne handlingen kan ikke angres.
              </p>
              
              {deleteError && (
                <div className="delete-error-message">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span>{deleteError}</span>
                </div>
              )}
              
              <div className="delete-confirm-buttons">
                <button 
                  className="cancel-delete-btn"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  Avbryt
                </button>
                <button 
                  className="confirm-delete-btn"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Sletter...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faTrash} />
                      <span>Slett</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Progress Ring */}
              <div className={`progress-ring-container ${colorClass}`}>
                <svg className="progress-ring" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    className="progress-ring-bg"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <circle
                    className="progress-ring-progress"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="8"
                    strokeDasharray={`${percentage * 2.64} 264`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="progress-ring-content">
                  <span className="progress-value">{visitedUnits}/{totalUnits}</span>
                  {status === 'completed' && (
                    <FontAwesomeIcon icon={faCheck} className="completed-icon" />
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="building-stats">
                <div className="stat-row">
                  <span className="stat-label">Besøkt</span>
                  <span className="stat-value">{visitedUnits}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Gjenstår</span>
                  <span className="stat-value remaining">{remainingUnits}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Status</span>
                  <span className={`status-badge ${colorClass}`}>
                    {statusLabels[calculatedStatus] || 'Ukjent'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="progress-bar-container">
                <div 
                  className={`progress-bar ${colorClass}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="progress-percentage">{percentage}%</div>

              {/* Creator Section - Only show if creator info is available */}
              {(creatorName || creatorType) && (
                <div className="building-creator-section">
                  <div className="creator-info">
                    <span className="creator-label">Opprettet av:</span>
                    <span className="creator-name">{creatorName || 'Ukjent'}</span>
                    {creatorType && (
                      <span className="creator-type">
                        ({creatorType === 'manager' ? 'Manager' : 'Ansatt'})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!showDeleteConfirm && (
          <div className="building-summary-footer">
            <button 
              className={`open-drawer-btn ${colorClass}`}
              onClick={handleOpenDrawer}
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={faListUl} />
              <span>Åpne leilighetsliste</span>
            </button>
            
            <button 
              className="delete-building-btn"
              onClick={handleDeleteClick}
              disabled={isLoading}
              title="Slett bygning"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        )}

        {/* Position indicator (optional) */}
        {position && !showDeleteConfirm && (
          <div className="position-indicator">
            <FontAwesomeIcon icon={faMapMarkerAlt} />
            <span>{position.lat?.toFixed(5)}, {position.lng?.toFixed(5)}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Render using portal for complete isolation
  return ReactDOM.createPortal(cardContent, document.body);
};

export default BuildingSummaryCard;
