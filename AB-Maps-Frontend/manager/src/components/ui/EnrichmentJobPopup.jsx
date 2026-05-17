import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faExclamationTriangle, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import './EnrichmentJobPopup.css';

/**
 * Enrichment Job Popup Component
 * Displays active enrichment jobs with progress
 * 
 * @param {Array} jobs - Array of job objects
 * @param {boolean} isOpen - Whether popup is open
 * @param {Function} onClose - Callback to close popup
 */
const EnrichmentJobPopup = ({ 
  jobs = [], 
  isOpen = false, 
  onClose 
}) => {
  // Don't render if not open or no jobs
  if (!isOpen || !jobs || jobs.length === 0) {
    return null;
  }

  const handleOverlayClick = (e) => {
    // Close when clicking overlay
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const handleEscapeKey = (e) => {
    if (e.key === 'Escape' && onClose) {
      onClose();
    }
  };

  // Add escape key listener
  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div 
      className="enrichment-job-popup-overlay" 
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="enrichment-job-popup-title"
    >
      <div 
        className="enrichment-job-popup" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="enrichment-job-popup-header">
          <h3 id="enrichment-job-popup-title" className="enrichment-job-popup-title">
            Enrichment Jobs
          </h3>
          <button 
            className="enrichment-job-popup-close" 
            onClick={onClose}
            aria-label="Close enrichment jobs popup"
            title="Close"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="enrichment-job-popup-content">
          {jobs.length === 0 ? (
            <div className="enrichment-job-popup-empty">
              No active enrichment jobs
            </div>
          ) : (
            jobs.map(job => (
              <EnrichmentJobItem key={job.jobId} job={job} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Individual Job Item Component
 * Displays progress and status for a single enrichment job
 */
const EnrichmentJobItem = ({ job }) => {
  if (!job) {
    return null;
  }

  /**
   * Get status color based on job status
   * @param {string} status - Job status
   * @returns {string} Color hex code
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'enriching':
      case 'writing':
      case 'connecting':
        return '#3b82f6'; // Blue
      case 'done':
        return '#10b981'; // Green
      case 'error':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  /**
   * Get status label in Norwegian
   * @param {string} status - Job status
   * @returns {string} Status label
   */
  const getStatusLabel = (status) => {
    const labels = {
      connecting: 'Kobler til',
      enriching: 'Beriker',
      writing: 'Skriver',
      done: 'Fullført',
      error: 'Feil'
    };
    return labels[status] || status;
  };

  const statusColor = getStatusColor(job.status);
  const statusLabel = getStatusLabel(job.status);
  const progress = Math.min(100, Math.max(0, job.progress || 0));

  return (
    <div className="enrichment-job-item">
      <div className="enrichment-job-item-header">
        <h4 className="enrichment-job-item-title">{job.areaName || 'Unknown Area'}</h4>
        <span 
          className="enrichment-job-status-badge"
          style={{ backgroundColor: statusColor }}
          aria-label={`Status: ${statusLabel}`}
        >
          {statusLabel}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="enrichment-job-progress">
        <div className="enrichment-job-progress-bar">
          <div 
            className="enrichment-job-progress-fill"
            style={{ 
              width: `${progress}%`,
              backgroundColor: statusColor
            }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`Progress: ${progress.toFixed(1)}%`}
          />
        </div>
        <span className="enrichment-job-progress-text">
          {progress.toFixed(1)}%
        </span>
      </div>
      
      {/* Statistics */}
      <div className="enrichment-job-stats">
        <div className="enrichment-job-stat-item">
          <span className="enrichment-job-stat-label">Ferdig:</span>
          <span className="enrichment-job-stat-value">
            {job.doneCount || 0} / {job.expectedCount || 0}
          </span>
        </div>
        
        {job.successCount > 0 && (
          <div className="enrichment-job-stat-item enrichment-job-success">
            <FontAwesomeIcon icon={faCheckCircle} className="enrichment-job-stat-icon" />
            <span className="enrichment-job-stat-value">{job.successCount}</span>
          </div>
        )}
        
        {job.noDataCount > 0 && (
          <div className="enrichment-job-stat-item enrichment-job-warning">
            <span className="enrichment-job-stat-label">Ingen data:</span>
            <span className="enrichment-job-stat-value">{job.noDataCount}</span>
          </div>
        )}
        
        {job.failedCount > 0 && (
          <div className="enrichment-job-stat-item enrichment-job-failed">
            <FontAwesomeIcon icon={faTimesCircle} className="enrichment-job-stat-icon" />
            <span className="enrichment-job-stat-value">{job.failedCount}</span>
          </div>
        )}
      </div>
      
      {/* Connection Status */}
      {job.isConnected !== undefined && (
        <div className="enrichment-job-connection">
          <span 
            className={`enrichment-job-connection-indicator ${job.isConnected ? 'connected' : 'disconnected'}`}
            aria-label={job.isConnected ? 'Connected' : 'Disconnected'}
          >
            {job.isConnected ? '●' : '○'}
          </span>
          <span className="enrichment-job-connection-text">
            {job.isConnected ? 'Tilkoblet' : 'Ikke tilkoblet'}
          </span>
        </div>
      )}
      
      {/* Error Display */}
      {job.error && (
        <div className="enrichment-job-error" role="alert">
          <FontAwesomeIcon icon={faExclamationTriangle} className="enrichment-job-error-icon" />
          <span className="enrichment-job-error-text">{job.error}</span>
        </div>
      )}
      
      {/* Timestamps */}
      {(job.startedAt || job.finishedAt) && (
        <div className="enrichment-job-timestamps">
          {job.startedAt && (
            <div className="enrichment-job-timestamp">
              <span className="enrichment-job-timestamp-label">Startet:</span>
              <span className="enrichment-job-timestamp-value">
                {new Date(job.startedAt).toLocaleString('no-NO')}
              </span>
            </div>
          )}
          {job.finishedAt && (
            <div className="enrichment-job-timestamp">
              <span className="enrichment-job-timestamp-label">Fullført:</span>
              <span className="enrichment-job-timestamp-value">
                {new Date(job.finishedAt).toLocaleString('no-NO')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnrichmentJobPopup;
