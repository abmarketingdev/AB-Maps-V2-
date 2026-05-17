import React, { useState, useEffect } from 'react';
import { FaRotate } from 'react-icons/fa6';
import './TouchRotationHint.css';

/**
 * Component to show touch rotation hint on mobile devices
 */
const TouchRotationHint = ({ isVisible = false, onClose }) => {
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    if (isVisible && !isShown) {
      setIsShown(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsShown(false);
        if (onClose) onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isShown, onClose]);

  if (!isShown) return null;

  return (
    <div className="touch-rotation-hint">
      <div className="touch-rotation-hint-content">
        <div className="touch-rotation-hint-icon">
          <FaRotate />
        </div>
        <div className="touch-rotation-hint-text">
          <h3>Rotate Map</h3>
          <p>Use two fingers to rotate the map</p>
        </div>
        <button 
          className="touch-rotation-hint-close"
          onClick={() => {
            setIsShown(false);
            if (onClose) onClose();
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default TouchRotationHint; 