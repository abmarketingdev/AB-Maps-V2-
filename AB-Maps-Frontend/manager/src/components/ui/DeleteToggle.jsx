import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import './DeleteToggle.css';

/**
 * DeleteToggle - A circular toggle button for enabling/disabling delete mode
 * Only visible to superusers for bulk polygon deletion
 */
const DeleteToggle = ({ 
  isDeleteMode = false, 
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

  const buttonClass = `circular-toggle ${isDeleteMode ? 'enabled delete-mode' : 'disabled'} ${className}`;

  return (
    <button
      className={buttonClass}
      onClick={handleToggle}
      disabled={disabled}
      title={isDeleteMode ? 'Exit delete mode' : 'Enter delete mode (bulk delete)'}
      aria-pressed={isDeleteMode}
      aria-label={isDeleteMode ? 'Delete mode enabled, click to exit' : 'Enter delete mode for bulk deletion'}
    >
      <FontAwesomeIcon 
        icon={faTrashAlt} 
        className="toggle-icon"
      />
    </button>
  );
};

export default DeleteToggle;

