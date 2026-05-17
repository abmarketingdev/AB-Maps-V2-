import React, { useState, useEffect } from 'react';
import { FaLocationArrow, FaWifi, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './LocationStatus.css';

const LocationStatus = ({ locationService, permissionStatus: propPermissionStatus, onRequestPermission }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState({
    isTracking: false,
    isOnline: false,
    permissionStatus: 'unknown',
    lastLocation: null,
    queueLength: 0,
    retryAttempts: 0
  });

  // Use prop if provided, otherwise fallback to internal status
  const effectivePermissionStatus = propPermissionStatus || status.permissionStatus;

  useEffect(() => {
    if (!locationService) return;

    // Get initial status
    setStatus(locationService.getStatus());

    // Listen for status changes
    const handleStatusChange = () => {
      setStatus(locationService.getStatus());
    };

    const handleLocationUpdate = (data) => {
      setStatus(prev => ({ ...prev, lastLocation: data.location }));
    };

    const handleWebSocketConnected = () => {
      setStatus(prev => ({ ...prev, isOnline: true, retryAttempts: 0 }));
    };

    const handleWebSocketDisconnected = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    const handlePermissionChanged = (data) => {
      setStatus(prev => ({ ...prev, permissionStatus: data.status }));
    };

    const handleTrackingStarted = () => {
      setStatus(prev => ({ ...prev, isTracking: true }));
    };

    const handleTrackingStopped = () => {
      setStatus(prev => ({ ...prev, isTracking: false }));
    };

    // Add event listeners
    locationService.on('location_updated', handleLocationUpdate);
    locationService.on('websocket_connected', handleWebSocketConnected);
    locationService.on('websocket_disconnected', handleWebSocketDisconnected);
    locationService.on('permission_changed', handlePermissionChanged);
    locationService.on('tracking_started', handleTrackingStarted);
    locationService.on('tracking_stopped', handleTrackingStopped);

    // Update status periodically
    const interval = setInterval(handleStatusChange, 2000);

    return () => {
      locationService.off('location_updated', handleLocationUpdate);
      locationService.off('websocket_connected', handleWebSocketConnected);
      locationService.off('websocket_disconnected', handleWebSocketDisconnected);
      locationService.off('permission_changed', handlePermissionChanged);
      locationService.off('tracking_started', handleTrackingStarted);
      locationService.off('tracking_stopped', handleTrackingStopped);
      clearInterval(interval);
    };
  }, [locationService]);

  const getStatusIcon = () => {
    if (status.permissionStatus === 'denied') {
      return <FaTimesCircle className="status-icon error" />;
    }
    if (status.isTracking && status.isOnline) {
      return <FaCheckCircle className="status-icon success" />;
    }
    if (status.isTracking) {
      return <FaLocationArrow className="status-icon tracking" />;
    }
    if (status.isOnline) {
      return <FaWifi className="status-icon online" />;
    }
    return <FaExclamationTriangle className="status-icon warning" />;
  };

  const getStatusText = () => {
    if (status.permissionStatus === 'denied') {
      return 'Location access denied';
    }
    if (status.isTracking && status.isOnline) {
      return 'Tracking active';
    }
    if (status.isTracking) {
      return 'Tracking (offline)';
    }
    if (status.isOnline) {
      return 'Connected';
    }
    if (status.permissionStatus === 'granted') {
      return 'Ready to track';
    }
    return 'Initializing...';
  };

  const getStatusClass = () => {
    if (status.permissionStatus === 'denied') {
      return 'error';
    }
    if (status.isTracking && status.isOnline) {
      return 'success';
    }
    if (status.isTracking || status.isOnline) {
      return 'warning';
    }
    return 'info';
  };

  const formatLocation = (location) => {
    if (!location) return 'No location data';
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  };

  const formatAccuracy = (accuracy) => {
    if (!accuracy) return 'Unknown';
    return `${Math.round(accuracy)}m`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const handleRequestPermission = async () => {
    if (locationService) {
      try {
        await locationService.requestLocationPermission();
      } catch (error) {
        console.error('Failed to request location permission:', error);
      }
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`location-status ${getStatusClass()} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Icon Button */}
      <div className="status-icon-button" onClick={toggleExpanded}>
        <div className="icon-background">
          {getStatusIcon()}
        </div>
        <span className="status-label">Connection Status</span>
        {isExpanded && <FaChevronUp className="expand-icon" />}
        {!isExpanded && <FaChevronDown className="expand-icon" />}
      </div>

      {/* Expanded Content */}
      <div className="status-content">
        <div className="status-header">
          <span className="status-text">{getStatusText()}</span>
        </div>
        
        {/* Always show permission request button if permission is not granted */}
        {(effectivePermissionStatus === 'prompt' || effectivePermissionStatus === 'unknown' || effectivePermissionStatus === 'denied') && (
          <div className="permission-request">
            <button 
              onClick={onRequestPermission}
              className="permission-button"
            >
              Grant Location Access
            </button>
          </div>
        )}
      
      <div className="status-details">
        <div className="status-item">
          <span className="label">Permission:</span>
          <span className="value">{status.permissionStatus}</span>
        </div>
        
        <div className="status-item">
          <span className="label">Connection:</span>
          <span className="value">{status.isOnline ? 'Online' : 'Offline'}</span>
        </div>
        
        {status.lastLocation && (
          <>
            <div className="status-item">
              <span className="label">Location:</span>
              <span className="value">{formatLocation(status.lastLocation)}</span>
            </div>
            
            <div className="status-item">
              <span className="label">Accuracy:</span>
              <span className="value">{formatAccuracy(status.lastLocation.accuracy)}</span>
            </div>
            
            <div className="status-item">
              <span className="label">Last Update:</span>
              <span className="value">{formatTimestamp(status.lastLocation.timestamp)}</span>
            </div>
          </>
        )}
        
        {status.queueLength > 0 && (
          <div className="status-item">
            <span className="label">Queued Updates:</span>
            <span className="value">{status.queueLength}</span>
          </div>
        )}
        
        {status.retryAttempts > 0 && (
          <div className="status-item">
            <span className="label">Reconnection Attempts:</span>
            <span className="value">{status.retryAttempts}</span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default LocationStatus; 