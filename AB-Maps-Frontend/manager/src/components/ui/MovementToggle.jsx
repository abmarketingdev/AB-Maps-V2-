import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWalking } from '@fortawesome/free-solid-svg-icons';
import './CircularToggle.css';

/**
 * MovementToggle - A circular toggle button to enable/disable area interactions for free map movement
 */
const MovementToggle = ({ 
  isMovementMode = false, 
  onToggle, 
  disabled = false,
  className = '' 
}) => {
  const handleToggle = () => {
    if (disabled) return;
    
    // Mobile haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Web Vibration API fallback
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
    
    onToggle();
  };

  const buttonClass = `circular-toggle ${isMovementMode ? 'enabled movement-mode' : 'disabled'} ${className}`;

  return (
    <button
      className={buttonClass}
      onClick={handleToggle}
      disabled={disabled}
      title={isMovementMode ? 'Disable movement mode to interact with areas' : 'Enable movement mode for free map navigation'}
      aria-pressed={isMovementMode}
      aria-label={isMovementMode ? 'Movement mode enabled, click to disable' : 'Movement mode disabled, click to enable'}
    >
      <FontAwesomeIcon 
        icon={faWalking} 
        className="toggle-icon"
      />
    </button>
  );
};

export default MovementToggle;
