import React from 'react';
import './TalkmoreJobStatusPanel.css';

/**
 * TalkmoreJobStatusPanel Component
 * 
 * Displays job status, progress, and statistics for Talkmore enrichment jobs.
 * 
 * @param {Object} jobStatus - Current job status object
 * @param {boolean} isConnected - WebSocket connection status
 * @param {boolean} isLoading - Loading state
 * @param {string} error - Error message (if any)
 * @param {Function} onRefresh - Callback for refresh button
 */
const TalkmoreJobStatusPanel = ({ 
  jobStatus, 
  isConnected, 
  isLoading = false,
  error = null,
  onRefresh 
}) => {
  if (!jobStatus) {
    return (
      <div className="talkmore-status-panel">
        <div className="talkmore-status-loading">
          {isLoading ? 'Laster jobbstatus...' : 'Ingen jobbstatus tilgjengelig'}
        </div>
      </div>
    );
  }

  const {
    status,
    expected_count = 0,
    done_count = 0,
    success_count = 0,
    no_data_count = 0,
    failed_count = 0,
    progress_percentage = 0,
    started_at,
    finished_at
  } = jobStatus;

  // Status labels in Norwegian
  const statusLabels = {
    queued: 'I kø',
    discovering: 'Oppdager adresser',
    enriching_1881: 'Beriker med 1881',
    enriching_carrier: 'Søker etter operatører',
    writing: 'Skriver til database',
    done: 'Fullført',
    failed: 'Feilet'
  };

  const statusLabel = statusLabels[status] || status;

  // Status color
  const getStatusColor = () => {
    switch (status) {
      case 'done':
        return '#10b981'; // Green
      case 'failed':
        return '#ef4444'; // Red
      case 'queued':
        return '#6b7280'; // Gray
      default:
        return '#3b82f6'; // Blue (in progress)
    }
  };

  return (
    <div className="talkmore-status-panel">
      <div className="talkmore-status-header">
        <h3 className="talkmore-status-title">Talkmore Enrichment Status</h3>
        {onRefresh && (
          <button 
            className="talkmore-refresh-button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Oppdater status"
          >
            ↻
          </button>
        )}
      </div>

      {/* Connection Status */}
      <div className="talkmore-connection-status">
        <span className={`talkmore-connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '●' : '○'}
        </span>
        <span className="talkmore-connection-text">
          {isConnected ? 'Tilkoblet' : 'Ikke tilkoblet'}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="talkmore-error-message">
          ⚠️ {error}
        </div>
      )}

      {/* Status Badge */}
      <div className="talkmore-status-badge" style={{ borderColor: getStatusColor() }}>
        <span className="talkmore-status-label">Status:</span>
        <span className="talkmore-status-value" style={{ color: getStatusColor() }}>
          {statusLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="talkmore-progress-section">
        <div className="talkmore-progress-header">
          <span className="talkmore-progress-label">Fremgang</span>
          <span className="talkmore-progress-percentage">
            {progress_percentage.toFixed(1)}%
          </span>
        </div>
        <div className="talkmore-progress-bar">
          <div 
            className="talkmore-progress-fill"
            style={{ 
              width: `${Math.min(100, Math.max(0, progress_percentage))}%`,
              backgroundColor: status === 'done' ? '#10b981' : '#3b82f6'
            }}
          />
        </div>
        <div className="talkmore-progress-text">
          {done_count} / {expected_count} adresser
        </div>
      </div>

      {/* Statistics */}
      <div className="talkmore-statistics">
        <div className="talkmore-stat-item">
          <span className="talkmore-stat-label">Forventet:</span>
          <span className="talkmore-stat-value">{expected_count}</span>
        </div>
        <div className="talkmore-stat-item success">
          <span className="talkmore-stat-label">Vellykket:</span>
          <span className="talkmore-stat-value">{success_count}</span>
        </div>
        <div className="talkmore-stat-item warning">
          <span className="talkmore-stat-label">Ingen data:</span>
          <span className="talkmore-stat-value">{no_data_count}</span>
        </div>
        <div className="talkmore-stat-item error">
          <span className="talkmore-stat-label">Feilet:</span>
          <span className="talkmore-stat-value">{failed_count}</span>
        </div>
      </div>

      {/* Timestamps */}
      <div className="talkmore-timestamps">
        {started_at && (
          <div className="talkmore-timestamp">
            <span className="talkmore-timestamp-label">Startet:</span>
            <span className="talkmore-timestamp-value">
              {new Date(started_at).toLocaleString('no-NO')}
            </span>
          </div>
        )}
        {finished_at && (
          <div className="talkmore-timestamp">
            <span className="talkmore-timestamp-label">Fullført:</span>
            <span className="talkmore-timestamp-value">
              {new Date(finished_at).toLocaleString('no-NO')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TalkmoreJobStatusPanel;
