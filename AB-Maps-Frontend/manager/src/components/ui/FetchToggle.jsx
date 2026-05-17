import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import './CircularToggle.css';

/**
 * FetchToggle - A circular button for fetching areas in the current viewport
 */
const FetchToggle = ({ 
  onFetch, 
  disabled = false,
  isLoading = false,
  className = '' 
}) => {
  const handleClick = (e) => {
    if (disabled || isLoading) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Mobile haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Web Vibration API fallback
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
    
    onFetch(e);
  };

  const buttonClass = `circular-toggle ${isLoading ? 'enabled fetch-mode loading' : 'disabled'} ${className}`;

  return (
    <button
      className={buttonClass}
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={isLoading ? 'Fetching areas...' : 'Fetch areas in current viewport'}
      aria-label={isLoading ? 'Fetching areas, please wait' : 'Click to fetch areas in current viewport'}
    >
      <FontAwesomeIcon 
        icon={faSyncAlt} 
        className={`toggle-icon ${isLoading ? 'spinning' : ''}`}
      />
    </button>
  );
};

export default FetchToggle;

