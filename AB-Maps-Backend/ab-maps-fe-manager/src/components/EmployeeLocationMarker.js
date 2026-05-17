import React, { useEffect, useRef, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { FaUser, FaUserCheck, FaUserClock, FaUserTimes } from 'react-icons/fa';
import './EmployeeLocationMarker.css';

const EmployeeLocationMarker = ({ 
  employee, 
  onClick, 
  onDelete, 
  isSelected = false,
  showLabels = true 
}) => {
  const markerRef = useRef(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(employee.lastSeen || new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // Update last seen time when employee data changes
  useEffect(() => {
    if (employee.lastSeen) {
      setLastUpdateTime(employee.lastSeen);
    }
  }, [employee.lastSeen]);

  // Handle real-time location updates with visual feedback
  useEffect(() => {
    if (employee.currentPosition && employee.lastSeen) {
      // Show updating animation briefly
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [employee.currentPosition, employee.lastSeen]);

  // Get employee status and corresponding icon
  const getEmployeeStatus = () => {
    if (!employee.is_online) return 'offline';
    if (employee.is_active) return 'active';
    if (employee.is_online) return 'online';
    return 'inactive';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return FaUserCheck;
      case 'online':
        return FaUser;
      case 'offline':
        return FaUserTimes;
      case 'inactive':
        return FaUserClock;
      default:
        return FaUser;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#22c55e'; // Green
      case 'online':
        return '#3b82f6'; // Blue
      case 'offline':
        return '#6b7280'; // Gray
      case 'inactive':
        return '#f59e0b'; // Amber
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Unknown';
    }
  };

  const status = getEmployeeStatus();
  const StatusIcon = getStatusIcon(status);
  const statusColor = getStatusColor(status);
  const statusText = getStatusText(status);

  // Create custom icon
  const createCustomIcon = () => {
    const iconSize = isSelected ? 32 : 28;
    const borderStyle = isLocationUnavailable ? '2px dashed #ff6b6b' : '2px solid white';
    const opacity = isLocationUnavailable ? '0.7' : '1';
    const pulseAnimation = isUpdating ? 'pulse 1s infinite' : 'none';
    
    const iconHtml = `
      <div class="employee-marker ${isSelected ? 'selected' : ''} ${isLocationUnavailable ? 'location-unavailable' : ''} ${isUpdating ? 'updating' : ''}" 
           style="
             width: ${iconSize}px; 
             height: ${iconSize}px; 
             background: ${statusColor};
             border: ${borderStyle};
             border-radius: 50%;
             display: flex;
             align-items: center;
             justify-content: center;
             box-shadow: 0 2px 8px rgba(0,0,0,0.3);
             position: relative;
             opacity: ${opacity};
             animation: ${pulseAnimation};
           ">
        <svg width="16" height="16" fill="white" viewBox="0 0 16 16">
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
        </svg>
        ${isLocationUnavailable ? `
          <div class="location-unavailable-indicator" 
               style="
                 position: absolute;
                 top: -8px;
                 right: -8px;
                 width: 16px;
                 height: 16px;
                 background: #ff6b6b;
                 border-radius: 50%;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 font-size: 10px;
                 color: white;
                 font-weight: bold;
               ">
            ?
          </div>
        ` : ''}
        ${showLabels ? `
          <div class="employee-label" 
               style="
                 position: absolute;
                 top: -25px;
                 left: 50%;
                 transform: translateX(-50%);
                 background: rgba(0,0,0,0.8);
                 color: white;
                 padding: 2px 6px;
                 border-radius: 4px;
                 font-size: 11px;
                 white-space: nowrap;
                 z-index: 1000;
               ">
            ${employee.name || employee.full_name || `Employee ${employee.id}`}
            ${isLocationUnavailable ? ' (No Location)' : ''}
          </div>
        ` : ''}
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'employee-marker-container',
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
      popupAnchor: [0, -iconSize / 2]
    });
  };

  // Format last seen time
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Handle marker click
  const handleMarkerClick = (e) => {
    e.originalEvent.stopPropagation();
    if (onClick) {
      onClick(employee);
    }
    setIsPopupOpen(true);
  };

  // Handle popup close
  const handlePopupClose = () => {
    setIsPopupOpen(false);
  };

  // Handle delete
  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(employee.id);
    }
  };

  // Check if position is valid
  if (!employee.currentPosition || !employee.currentPosition.lat || !employee.currentPosition.lng) {
    console.warn('Invalid employee position:', employee);
    return null;
  }

  const position = [employee.currentPosition.lat, employee.currentPosition.lng];
  
  // Add special styling for employees with unavailable location
  const isLocationUnavailable = employee.isLocationUnavailable;

  return (
    <>
      <Marker
        ref={markerRef}
        position={position}
        icon={createCustomIcon()}
        eventHandlers={{
          click: handleMarkerClick
        }}
      >
      <Popup
        onOpen={() => setIsPopupOpen(true)}
        onClose={handlePopupClose}
        className="employee-popup"
      >
        <div className="employee-popup-content">
          <div className="employee-popup-header">
            <div className="employee-avatar">
              <StatusIcon style={{ color: statusColor }} />
            </div>
            <div className="employee-info">
              <h3 className="employee-name">
                {employee.name || employee.full_name || `Employee ${employee.id}`}
              </h3>
              <div className="employee-status">
                <span className={`status-indicator ${status}`}>
                  {statusText}
                </span>
                <span className="last-seen">
                  Last seen: {formatLastSeen(lastUpdateTime)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="employee-details">
            <div className="detail-row">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{employee.id}</span>
            </div>
            
            {employee.email && (
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{employee.email}</span>
              </div>
            )}
            
            {employee.phone && (
              <div className="detail-row">
                <span className="detail-label">Phone:</span>
                <span className="detail-value">{employee.phone}</span>
              </div>
            )}
            
            <div className="detail-row">
              <span className="detail-label">Location:</span>
              <span className="detail-value">
                {isLocationUnavailable ? (
                  <span style={{ color: '#ff6b6b', fontStyle: 'italic' }}>
                    Location unavailable
                  </span>
                ) : (
                  <div>
                    <div>{`${position[0].toFixed(6)}, ${position[1].toFixed(6)}`}</div>
                    {employee.locationAccuracy && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        Accuracy: ±{employee.locationAccuracy.toFixed(1)}m
                      </div>
                    )}
                  </div>
                )}
              </span>
            </div>
            
            {employee.assigned_area && (
              <div className="detail-row">
                <span className="detail-label">Area:</span>
                <span className="detail-value">{employee.assigned_area.name}</span>
              </div>
            )}
          </div>
          
          <div className="employee-popup-actions">
            <button 
              className="action-btn view-btn"
              onClick={() => {
                // Fly to employee location
                if (window.mapRef) {
                  window.mapRef.flyTo(position, 17, {
                    animate: true,
                    duration: 1.2
                  });
                }
              }}
            >
              Focus
            </button>
            <button 
              className="action-btn delete-btn"
              onClick={handleDelete}
            >
              Remove
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
    </>
  );
};

export default EmployeeLocationMarker; 