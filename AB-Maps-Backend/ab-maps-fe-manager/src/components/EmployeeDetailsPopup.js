import React, { useState, useEffect } from 'react';
import { FaUser, FaUserCheck, FaUserClock, FaUserTimes, FaMapMarkerAlt, FaPhone, FaEnvelope, FaHistory, FaClock, FaMap } from 'react-icons/fa';
import './EmployeeDetailsPopup.css';

const EmployeeDetailsPopup = ({ 
  employee, 
  isOpen, 
  onClose, 
  onFocusLocation,
  onRemoveEmployee 
}) => {
  const [activeTab, setActiveTab] = useState('details');
  const [activityHistory, setActivityHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load activity history when popup opens
  useEffect(() => {
    if (isOpen && employee) {
      loadActivityHistory();
    }
  }, [isOpen, employee]);

  const loadActivityHistory = async () => {
    if (!employee || !employee.id) return;
    
    setIsLoadingHistory(true);
    try {
      // TODO: Replace with actual API call when backend endpoint is available
      // const history = await employeeService.getActivityHistory(employee.id);
      // setActivityHistory(history);
      
      // For now, return empty array until backend endpoint is implemented
      setActivityHistory([]);
    } catch (error) {
      console.error('Error loading activity history:', error);
      setActivityHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen || !employee) return null;

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
        return '#22c55e';
      case 'online':
        return '#3b82f6';
      case 'offline':
        return '#6b7280';
      case 'inactive':
        return '#f59e0b';
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

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatActivityTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'location_update':
        return FaMapMarkerAlt;
      case 'status_change':
        return FaUserCheck;
      case 'area_assignment':
        return FaMap;
      default:
        return FaHistory;
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'location_update':
        return '#3b82f6';
      case 'status_change':
        return '#22c55e';
      case 'area_assignment':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const status = getEmployeeStatus();
  const StatusIcon = getStatusIcon(status);
  const statusColor = getStatusColor(status);
  const statusText = getStatusText(status);

  return (
    <div className="employee-details-overlay" onClick={onClose}>
      <div className="employee-details-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="employee-details-header">
          <div className="employee-avatar-large">
            <StatusIcon style={{ color: statusColor }} />
          </div>
          <div className="employee-header-info">
            <h2 className="employee-name-large">
              {employee.name || employee.full_name || `Employee ${employee.id}`}
            </h2>
            <div className="employee-status-large">
              <span className={`status-badge ${status}`}>
                {statusText}
              </span>
              <span className="last-seen-large">
                Last seen: {formatTimestamp(employee.lastSeen)}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="employee-details-tabs">
          <button 
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button 
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>

        {/* Content */}
        <div className="employee-details-content">
          {activeTab === 'details' && (
            <div className="details-tab">
              <div className="detail-section">
                <h3>Basic Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Employee ID</span>
                    <span className="detail-value">{employee.id}</span>
                  </div>
                  {employee.email && (
                    <div className="detail-item">
                      <span className="detail-label">
                        <FaEnvelope className="detail-icon" />
                        Email
                      </span>
                      <span className="detail-value">{employee.email}</span>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="detail-item">
                      <span className="detail-label">
                        <FaPhone className="detail-icon" />
                        Phone
                      </span>
                      <span className="detail-value">{employee.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Current Location</h3>
                {employee.currentPosition ? (
                  <div className="location-info">
                    <div className="location-coordinates">
                      <FaMapMarkerAlt className="location-icon" />
                      <span>
                        {employee.currentPosition.lat.toFixed(6)}, {employee.currentPosition.lng.toFixed(6)}
                      </span>
                    </div>
                    <div className="location-accuracy">
                      Accuracy: {employee.locationAccuracy || 'Unknown'}
                    </div>
                  </div>
                ) : (
                  <div className="no-location">
                    No location data available
                  </div>
                )}
              </div>

              {employee.assigned_area && (
                <div className="detail-section">
                  <h3>Assigned Area</h3>
                  <div className="area-info">
                    <FaMap className="area-icon" />
                    <span className="area-name">{employee.assigned_area.name}</span>
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Status Information</h3>
                <div className="status-details">
                  <div className="status-item">
                    <span className="status-label">Current Status</span>
                    <span className={`status-value ${status}`}>{statusText}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Last Update</span>
                    <span className="status-value">{formatTimestamp(employee.lastSeen)}</span>
                  </div>
                  {employee.is_online && (
                    <div className="status-item">
                      <span className="status-label">Online Since</span>
                      <span className="status-value">{formatTimestamp(employee.onlineSince)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="activity-tab">
              <div className="activity-header">
                <h3>Recent Activity</h3>
                <button className="refresh-btn" onClick={loadActivityHistory}>
                  Refresh
                </button>
              </div>
              
              {isLoadingHistory ? (
                <div className="loading-activity">
                  Loading activity history...
                </div>
              ) : activityHistory.length === 0 ? (
                <div className="no-activity">
                  No recent activity
                </div>
              ) : (
                <div className="activity-list">
                  {activityHistory.map(activity => {
                    const ActivityIcon = getActivityIcon(activity.type);
                    const activityColor = getActivityColor(activity.type);
                    
                    return (
                      <div key={activity.id} className="activity-item">
                        <div className="activity-icon">
                          <ActivityIcon style={{ color: activityColor }} />
                        </div>
                        <div className="activity-content">
                          <div className="activity-description">
                            {activity.description}
                          </div>
                          <div className="activity-time">
                            {formatActivityTime(activity.timestamp)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="employee-details-actions">
          <button 
            className="action-btn secondary-btn"
            onClick={() => {
              if (onFocusLocation && employee.currentPosition) {
                onFocusLocation(employee.currentPosition);
              }
            }}
          >
            <FaMapMarkerAlt />
            Focus Location
          </button>
          <button 
            className="action-btn primary-btn"
            onClick={() => {
              // TODO: Implement contact employee functionality
              console.log('Contact employee:', employee.id);
            }}
          >
            <FaPhone />
            Contact
          </button>
          <button 
            className="action-btn danger-btn"
            onClick={() => {
              if (onRemoveEmployee) {
                onRemoveEmployee(employee.id);
              }
            }}
          >
            Remove from Map
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsPopup; 