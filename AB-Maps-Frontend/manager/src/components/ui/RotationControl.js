import React, { useState, useEffect, useRef } from 'react';
import { FaArrowsRotate, FaArrowRotateLeft, FaArrowRotateRight, FaArrowRotateLeft as FaUndo } from 'react-icons/fa6';
import L from 'leaflet';
import './RotationControl.css';

/**
 * Component for manual rotation controls
 */
const RotationControl = ({ 
  bearing = 0, 
  onRotate, 
  onReset, 
  isEnabled = true,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef(null);

  useEffect(() => {
    if (controlRef.current && L.DomEvent) {
      // Use Leaflet's built-in event prevention
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  const stopAll = e => {
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation?.();
    if (e.preventDefault) e.preventDefault();
  };

  const handleRotate = (angle) => {
    if (onRotate) {
      onRotate(angle);
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  const rotateLeft = () => handleRotate(bearing - 15);
  const rotateRight = () => handleRotate(bearing + 15);

  if (!isEnabled) return null;

  return (
    <div
      ref={controlRef}
      className={`rotation-control rotation-control-root ${className}`}
      onClick={stopAll}
      onMouseDown={stopAll}
      onMouseUp={stopAll}
      onTouchStart={stopAll}
      onTouchEnd={stopAll}
    >
      <div className="rotation-control-main">
        <button
          className="rotation-control-button"
          onClick={() => setIsOpen(!isOpen)}
          title={`Rotation: ${Math.round(bearing)}°`}
        >
          <FaArrowsRotate />
          {isOpen && <span className="rotation-angle">{Math.round(bearing)}°</span>}
        </button>
      </div>

      {isOpen && (
        <div className="rotation-control-panel">
          <div className="rotation-control-row">
            <button
              className="rotation-control-btn"
              onClick={rotateLeft}
              title="Rotate Left 15°"
            >
              <FaArrowRotateLeft />
            </button>
            <button
              className="rotation-control-btn"
              onClick={handleReset}
              title="Reset Rotation"
            >
              <FaUndo />
            </button>
            <button
              className="rotation-control-btn"
              onClick={rotateRight}
              title="Rotate Right 15°"
            >
              <FaArrowRotateRight />
            </button>
          </div>
          
          <div className="rotation-control-row">
            <button
              className="rotation-control-btn"
              onClick={() => handleRotate(0)}
              title="North (0°)"
            >
              N
            </button>
            <button
              className="rotation-control-btn"
              onClick={() => handleRotate(90)}
              title="East (90°)"
            >
              E
            </button>
            <button
              className="rotation-control-btn"
              onClick={() => handleRotate(180)}
              title="South (180°)"
            >
              S
            </button>
            <button
              className="rotation-control-btn"
              onClick={() => handleRotate(270)}
              title="West (270°)"
            >
              W
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotationControl; 