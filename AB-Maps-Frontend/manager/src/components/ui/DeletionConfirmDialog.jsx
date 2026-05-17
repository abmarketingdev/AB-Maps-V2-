import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrashAlt, 
  faExclamationTriangle, 
  faSpinner,
  faMapMarkerAlt,
  faUpload,
  faDrawPolygon,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import polygonDeletionService, { convertToGeoJSON } from '../../services/polygonDeletionService';
import './DeletionConfirmDialog.css';

/**
 * DeletionConfirmDialog - Confirmation dialog for bulk polygon deletion
 * Shows preview of what will be deleted and allows entity type selection
 */
const DeletionConfirmDialog = ({
  isOpen,
  onClose,
  polygon, // Array of {lat, lng} points
  onDeletionComplete, // Callback after successful deletion
  showToast // Toast notification function
}) => {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState({
    addresses: true,
    uploaded_addresses: true,
    areas: true
  });

  // Load preview when dialog opens with a polygon
  useEffect(() => {
    if (isOpen && polygon && polygon.length >= 3) {
      loadPreview();
    } else if (!isOpen) {
      // Reset state when dialog closes
      setPreviewData(null);
      setError(null);
      setIsLoading(false);
      setIsExecuting(false);
    }
  }, [isOpen, polygon]);

  // Load preview data
  const loadPreview = useCallback(async () => {
    if (!polygon || polygon.length < 3) return;

    setIsLoading(true);
    setError(null);

    try {
      const geoJSON = convertToGeoJSON(polygon);
      const entityTypes = Object.entries(selectedEntityTypes)
        .filter(([_, selected]) => selected)
        .map(([type]) => type);

      const data = await polygonDeletionService.previewDeletion(geoJSON, entityTypes);
      setPreviewData(data);
    } catch (err) {
      console.error('[DeletionConfirmDialog] Preview error:', err);
      setError(err.message || 'Failed to load preview');
    } finally {
      setIsLoading(false);
    }
  }, [polygon, selectedEntityTypes]);

  // Reload preview when entity types change
  useEffect(() => {
    if (isOpen && polygon && polygon.length >= 3 && !isLoading && !isExecuting) {
      const debounceTimer = setTimeout(() => {
        loadPreview();
      }, 300);
      return () => clearTimeout(debounceTimer);
    }
  }, [selectedEntityTypes]);

  // Handle entity type checkbox change
  const handleEntityTypeChange = (entityType) => {
    setSelectedEntityTypes(prev => ({
      ...prev,
      [entityType]: !prev[entityType]
    }));
  };

  // Execute deletion
  const handleConfirmDelete = async () => {
    if (!polygon || polygon.length < 3) return;

    const selectedTypes = Object.entries(selectedEntityTypes)
      .filter(([_, selected]) => selected)
      .map(([type]) => type);

    if (selectedTypes.length === 0) {
      setError('Please select at least one entity type to delete');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const geoJSON = convertToGeoJSON(polygon);
      const result = await polygonDeletionService.executeDeletion(geoJSON, selectedTypes);

      // Show success message
      if (showToast) {
        showToast(`Successfully deleted ${result.total_deleted} items`, 'success');
      }

      // Call completion handler (triggers tile refresh)
      if (onDeletionComplete) {
        onDeletionComplete(result);
      }

      // Close dialog
      onClose();
    } catch (err) {
      console.error('[DeletionConfirmDialog] Deletion error:', err);
      setError(err.message || 'Deletion failed. No data was deleted.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  const totalCount = previewData?.total_will_delete || 0;
  const polygonArea = previewData?.polygon_area_km2 || 0;

  return (
    <div className="deletion-dialog-overlay" onClick={onClose}>
      <div className="deletion-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="deletion-dialog-header">
          <div className="deletion-dialog-title">
            <FontAwesomeIcon icon={faTrashAlt} className="title-icon danger" />
            <h2>Bulk Delete Preview</h2>
          </div>
          <button 
            className="deletion-dialog-close" 
            onClick={onClose}
            disabled={isExecuting}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="deletion-dialog-content">
          {/* Loading State */}
          {isLoading && (
            <div className="deletion-loading">
              <FontAwesomeIcon icon={faSpinner} spin className="loading-icon" />
              <p>Loading preview...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="deletion-error">
              <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
              <p>{error}</p>
              <button 
                className="retry-button" 
                onClick={loadPreview}
                disabled={isLoading || isExecuting}
              >
                Retry
              </button>
            </div>
          )}

          {/* Preview Data */}
          {!isLoading && !error && previewData && (
            <>
              {/* Polygon Info */}
              <div className="polygon-info">
                <span className="polygon-area">
                  Polygon Area: <strong>{polygonArea.toFixed(2)} km²</strong>
                </span>
              </div>

              {/* Entity Type Selection */}
              <div className="entity-types-section">
                <h3>Select what to delete:</h3>
                
                <label className="entity-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedEntityTypes.addresses}
                    onChange={() => handleEntityTypeChange('addresses')}
                    disabled={isExecuting}
                  />
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="entity-icon addresses" />
                  <span className="entity-label">
                    Addresses
                    {previewData.will_delete?.addresses && (
                      <span className="entity-count">
                        ({previewData.will_delete.addresses.count})
                      </span>
                    )}
                  </span>
                </label>

                {/* Address status breakdown */}
                {selectedEntityTypes.addresses && previewData.will_delete?.addresses?.details && (
                  <div className="entity-details">
                    <span className="status-item ja">
                      Ja: {previewData.will_delete.addresses.details.ja || 0}
                    </span>
                    <span className="status-item nei">
                      Nei: {previewData.will_delete.addresses.details.nei || 0}
                    </span>
                    <span className="status-item ikke-hjemme">
                      Ikke hjemme: {previewData.will_delete.addresses.details.ikke_hjemme || 0}
                    </span>
                    <span className="status-item folg-opp">
                      Følg opp: {previewData.will_delete.addresses.details.folg_opp || 0}
                    </span>
                  </div>
                )}

                <label className="entity-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedEntityTypes.uploaded_addresses}
                    onChange={() => handleEntityTypeChange('uploaded_addresses')}
                    disabled={isExecuting}
                  />
                  <FontAwesomeIcon icon={faUpload} className="entity-icon uploaded" />
                  <span className="entity-label">
                    Uploaded Addresses
                    {previewData.will_delete?.uploaded_addresses && (
                      <span className="entity-count">
                        ({previewData.will_delete.uploaded_addresses.count})
                      </span>
                    )}
                  </span>
                </label>

                {/* Uploaded addresses breakdown */}
                {selectedEntityTypes.uploaded_addresses && previewData.will_delete?.uploaded_addresses && (
                  <div className="entity-details">
                    <span className="status-item">
                      Geocoded: {previewData.will_delete.uploaded_addresses.geocoded || 0}
                    </span>
                    <span className="status-item">
                      Failed: {previewData.will_delete.uploaded_addresses.failed_geocoding || 0}
                    </span>
                  </div>
                )}

                <label className="entity-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedEntityTypes.areas}
                    onChange={() => handleEntityTypeChange('areas')}
                    disabled={isExecuting}
                  />
                  <FontAwesomeIcon icon={faDrawPolygon} className="entity-icon areas" />
                  <span className="entity-label">
                    Areas
                    {previewData.will_delete?.areas && (
                      <span className="entity-count">
                        ({previewData.will_delete.areas.count})
                      </span>
                    )}
                  </span>
                </label>

                {/* Areas list */}
                {selectedEntityTypes.areas && previewData.will_delete?.areas?.names?.length > 0 && (
                  <div className="entity-details areas-list">
                    {previewData.will_delete.areas.names.map((name, idx) => (
                      <span key={idx} className="area-name">{name || 'Unnamed Area'}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="deletion-summary">
                <div className="total-count">
                  <span>Total items to delete:</span>
                  <strong className={totalCount > 0 ? 'danger' : ''}>{totalCount}</strong>
                </div>
              </div>

              {/* Warning */}
              <div className="deletion-warning">
                <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                <p><strong>Warning:</strong> This action cannot be undone!</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="deletion-dialog-footer">
          <button
            className="cancel-button"
            onClick={onClose}
            disabled={isExecuting}
          >
            Cancel
          </button>
          <button
            className="delete-button"
            onClick={handleConfirmDelete}
            disabled={
              isLoading || 
              isExecuting || 
              totalCount === 0 || 
              Object.values(selectedEntityTypes).every(v => !v)
            }
          >
            {isExecuting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                Deleting...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faTrashAlt} />
                Delete {totalCount} Items
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeletionConfirmDialog;

