/**
 * @deprecated This component is temporarily disabled.
 * The Age Statistics feature has been deprecated and the button removed from the toolbar.
 * This file is kept for future reference but is not currently in use.
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './CircularToggle.css';
import './AgeStatsToggle.css';

/**
 * AgeStatsToggle - A circular button for opening the age statistics popup
 * Shows SSB age statistics for locked areas (fylke and kommune)
 * @deprecated Feature temporarily disabled
 */
const AgeStatsToggle = ({ 
  onClick, 
  disabled = false,
  isLoading = false,
  isOpen = false,
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
    
    onClick(e);
  };

  const getButtonClass = () => {
    let classes = 'circular-toggle';
    
    if (isLoading) {
      classes += ' enabled stats-mode loading';
    } else if (isOpen) {
      classes += ' enabled stats-mode';
    } else {
      classes += ' disabled';
    }
    
    if (className) {
      classes += ` ${className}`;
    }
    
    return classes;
  };

  return (
    <button
      className={getButtonClass()}
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={isLoading ? 'Laster aldersstatistikk...' : 'Vis aldersstatistikk for låste områder'}
      aria-label={isLoading ? 'Laster aldersstatistikk, vennligst vent' : 'Klikk for å vise aldersstatistikk for låste områder'}
    >
      <FontAwesomeIcon 
        icon={isLoading ? faSpinner : faChartBar} 
        className={`toggle-icon ${isLoading ? 'spinning' : ''}`}
      />
    </button>
  );
};

export default AgeStatsToggle;

