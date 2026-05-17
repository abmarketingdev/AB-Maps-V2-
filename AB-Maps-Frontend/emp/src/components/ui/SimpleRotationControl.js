import React, { useState, useEffect, useRef } from 'react';
import { FaArrowsRotate, FaArrowRotateLeft, FaArrowRotateRight, FaArrowRotateLeft as FaUndo } from 'react-icons/fa6';
import L from 'leaflet';
import './SimpleRotationControl.css';

/**
 * Simple rotation control for desktop users
 */
const SimpleRotationControl = ({ 
  bearing = 0, 
  onRotate, 
  onReset, 
  isEnabled = true 
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

  const stopAll = e => {
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation?.();
    if (e.preventDefault) e.preventDefault();
  };

  return (
    <div 
      ref={controlRef}
      className="simple-rotation-control"
      onClick={stopAll}
      onMouseDown={stopAll}
      onMouseUp={stopAll}
      onTouchStart={stopAll}
      onTouchEnd={stopAll}
    >
      <div className="simple-rotation-main">
        <button
          className="simple-rotation-button"
          onClick={() => setIsOpen(!isOpen)}
          title={`Rotation: ${Math.round(bearing)}°`}
        >
          <FaArrowsRotate />
          {isOpen && <span className="simple-rotation-angle">{Math.round(bearing)}°</span>}
        </button>
      </div>

      {isOpen && (
        <div className="simple-rotation-panel">
          <div className="simple-rotation-row">
            <button
              className="simple-rotation-btn"
              onClick={rotateLeft}
              title="Rotate Left 15°"
            >
              <FaArrowRotateLeft />
            </button>
            <button
              className="simple-rotation-btn"
              onClick={handleReset}
              title="Reset Rotation"
            >
              <FaUndo />
            </button>
            <button
              className="simple-rotation-btn"
              onClick={rotateRight}
              title="Rotate Right 15°"
            >
              <FaArrowRotateRight />
            </button>
          </div>
          
          <div className="simple-rotation-row">
            <button
              className="simple-rotation-btn"
              onClick={() => handleRotate(0)}
              title="North (0°)"
            >
              N
            </button>
            <button
              className="simple-rotation-btn"
              onClick={() => handleRotate(90)}
              title="East (90°)"
            >
              E
            </button>
            <button
              className="simple-rotation-btn"
              onClick={() => handleRotate(180)}
              title="South (180°)"
            >
              S
            </button>
            <button
              className="simple-rotation-btn"
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

export default SimpleRotationControl; 