import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import './EnrichmentJobButton.css';

/**
 * Enrichment Job Button Component
 * Shows in toolbar when enrichment jobs are active
 * Displays spinning icon animation when jobs are running
 */
const EnrichmentJobButton = ({ 
  activeJobsCount = 0, 
  onClick, 
  disabled = false,
  className = '' 
}) => {
  const hasActiveJobs = activeJobsCount > 0;

  const handleClick = (e) => {
    if (disabled || !hasActiveJobs) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Mobile haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  const buttonClass = `enrichment-job-button ${hasActiveJobs ? 'active' : 'inactive'} ${className}`.trim();

  return (
    <button
      className={buttonClass}
      onClick={handleClick}
      disabled={disabled || !hasActiveJobs}
      title={
        hasActiveJobs 
          ? `${activeJobsCount} enrichment job${activeJobsCount > 1 ? 's' : ''} active - Click to view progress` 
          : 'No active enrichment jobs'
      }
      aria-label={
        hasActiveJobs 
          ? `${activeJobsCount} active enrichment job${activeJobsCount > 1 ? 's' : ''}, click to view progress` 
          : 'No active enrichment jobs'
      }
      aria-pressed={hasActiveJobs}
    >
      <div className="enrichment-job-icon-wrapper">
        <FontAwesomeIcon 
          icon={faSyncAlt} 
          className={`enrichment-job-icon ${hasActiveJobs ? 'spinning' : ''}`}
        />
      </div>
      {hasActiveJobs && activeJobsCount > 1 && (
        <span className="enrichment-job-badge" aria-label={`${activeJobsCount} active jobs`}>
          {activeJobsCount}
        </span>
      )}
    </button>
  );
};

export default EnrichmentJobButton;
