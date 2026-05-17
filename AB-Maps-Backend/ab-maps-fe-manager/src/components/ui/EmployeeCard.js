import React from 'react';
import { FaUserCircle } from 'react-icons/fa';
import './EmployeeCard.css';

const EmployeeCard = ({ employee, onClick }) => {
  // Helper function to format last seen time
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Get status display text
  const getStatusText = (status) => {
    const statusMap = {
      'online': 'Online',
      'offline': 'Offline',
      'busy': 'Busy',
      'away': 'Away',
      'working': 'Working',
      'break': 'Break'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="employee-card" onClick={onClick}>
      {employee.photo ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={employee.photo} alt={employee.name} className="employee-photo" />
          <span className={`status-dot ${employee.is_online ? 'online' : 'offline'}`} />
        </div>
      ) : (
        <span style={{ position: 'relative', display: 'inline-block' }}>
          <FaUserCircle className="employee-photo-fallback" size={38} />
          <span className={`status-dot ${employee.is_online ? 'online' : 'offline'}`} />
        </span>
      )}
      <div className="employee-info">
        <div className="employee-name">{employee.name}</div>
        <div className="employee-details">
          <div className="employee-phone">{employee.phone}</div>
          <div className="employee-status">
            <span className={`status-indicator ${employee.is_online ? 'online' : 'offline'}`}>
              {employee.is_online ? '🟢 Online' : '🔴 Offline'}
            </span>
            {!employee.is_online && employee.last_seen && (
              <span className="last-seen">Last seen: {formatLastSeen(employee.last_seen)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCard; 