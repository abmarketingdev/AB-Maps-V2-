import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaintBrush } from '@fortawesome/free-solid-svg-icons';
import './CircularToggle.css';

/**
 * DrawingToggle - A circular toggle button for enabling/disabling drawing mode
 */
const DrawingToggle = ({ 
  isDrawingEnabled = false, 
  onToggle, 
  disabled = false,
  className = '' 
}) => {
  const handleToggle = (e) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Mobile haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    onToggle(e);
  };

  const buttonClass = `circular-toggle ${isDrawingEnabled ? 'enabled drawing-mode' : 'disabled'} ${className}`;

  return (
    <button
      className={buttonClass}
      onClick={handleToggle}
      disabled={disabled}
      title={isDrawingEnabled ? 'Disable drawing mode' : 'Enable drawing mode'}
      aria-pressed={isDrawingEnabled}
      aria-label={isDrawingEnabled ? 'Drawing mode enabled, click to disable' : 'Drawing mode disabled, click to enable'}
    >
      <FontAwesomeIcon 
        icon={faPaintBrush} 
        className="toggle-icon"
      />
    </button>
  );
};

export default DrawingToggle;
