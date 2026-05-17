import React from 'react';
import { FaUser, FaMapMarkerAlt, FaWifi } from 'react-icons/fa';
import './EmployeeTrackingIndicator.css';

const EmployeeTrackingIndicator = ({ 
  employee, 
  isTracking = false, 
  lastUpdate = null,
  onStopTracking 
}) => {
  if (!employee || !isTracking) return null;

  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diffMs = now - lastUpdate;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  return (
    <div className="employee-tracking-indicator">
      <div className="tracking-header">
        <div className="tracking-icon">
          <FaUser />
        </div>
        <div className="tracking-info">
          <div className="tracking-name">
            {employee.name || employee.full_name || `Employee ${employee.id}`}
          </div>
          <div className="tracking-status">
            <FaWifi className="wifi-icon" />
            <span>Live Tracking</span>
          </div>
        </div>
        <button 
          className="stop-tracking-btn"
          onClick={onStopTracking}
          title="Stop tracking"
        >
          ×
        </button>
      </div>
      
      <div className="tracking-details">
        <div className="location-info">
          <FaMapMarkerAlt className="location-icon" />
          <span>
            {employee.currentPosition 
              ? `${employee.currentPosition.lat.toFixed(6)}, ${employee.currentPosition.lng.toFixed(6)}`
              : 'Location unavailable'
            }
          </span>
        </div>
        
        {lastUpdate && (
          <div className="last-update">
            Last update: {formatLastUpdate(lastUpdate)}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeTrackingIndicator; 