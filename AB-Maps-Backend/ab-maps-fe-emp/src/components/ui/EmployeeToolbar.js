import React, { useState } from 'react';
import { FaMap, FaChevronDown, FaChevronUp, FaUser, FaCheckCircle } from 'react-icons/fa';
import './EmployeeToolbar.css';

/**
 * Employee Toolbar Component - Shows assigned areas and employee info
 */
const EmployeeToolbar = ({ employee, assignedAreas, allAreas, onAreaSelect, selectedAreaId, selectedCampaign }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Remove local selectedArea state

  // Helper to get area with geometry (GeoJSON) for fly-to
  const getAreaWithGeometry = (area) => {
    // If area is already GeoJSON (has geometry), return as is
    if (area.geometry && area.properties) return area;
    // Try to find the matching area in allAreas (by id)
    if (allAreas && allAreas.length > 0) {
      // Try both id and properties.id
      const match = allAreas.find(
        (a) => (a.id === area.id) || (a.id === area?.properties?.id)
      );
      if (match && match.polygon_geometry && match.polygon_geometry.coordinates) {
        // Convert to GeoJSON-like object for compatibility
        return {
          geometry: { type: 'Polygon', coordinates: match.polygon_geometry.coordinates },
          properties: { id: match.id, name: match.name, color: match.color },
          ...match
        };
      }
    }
    // Fallback: return the plain area
    return area;
  };

  const handleAreaClick = (area) => {
    if (onAreaSelect) {
      onAreaSelect(getAreaWithGeometry(area));
    }
    setIsExpanded(false);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="employee-toolbar">
      {/* Main toolbar button */}
      <div className="toolbar-main" onClick={toggleExpanded}>
        <div className="toolbar-icon">
          <FaMap />
        </div>
        <div className="toolbar-info">
          <div className="employee-name">{employee?.name || 'Ansatt'}</div>
          <div className="area-count">
            {assignedAreas?.length || 0} tildelte områder
          </div>
        </div>
        <div className="toolbar-arrow">
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </div>
      </div>

      {/* Animated dropdown: always rendered, content always present */}
      <div className={`toolbar-dropdown${isExpanded ? ' open' : ''}`}>
        <div className="dropdown-header">
          <FaUser className="header-icon" />
          <span>Mine tildelte områder</span>
        </div>
        {selectedCampaign && (
          <div className="campaign-info">
            <div className="campaign-label">Valgt kampanje:</div>
            <div className="campaign-name">{selectedCampaign.name}</div>
          </div>
        )}
        {assignedAreas && assignedAreas.length > 0 ? (
          <div className="areas-list">
            {assignedAreas.map((area) => (
              <div
                key={area.id}
                className={`area-item assigned${selectedAreaId === area.id ? ' selected' : ''}`}
                onClick={() => handleAreaClick(area)}
                style={selectedAreaId === area.id ? { border: '2px solid #1976d2', background: 'linear-gradient(90deg, #e3f2fd 60%, #bbdefb 100%)', boxShadow: '0 2px 8px rgba(25,118,210,0.10)' } : {}}
              >
                <div className="area-color-indicator" style={{ backgroundColor: area.color }}></div>
                <div className="area-details">
                  <div className="area-name">{area.name}</div>
                </div>
                {selectedAreaId === area.id && (
                  <FaCheckCircle style={{ color: '#1976d2', marginLeft: 8, fontSize: 18, verticalAlign: 'middle' }} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-areas">
            <div className="no-areas-icon">📋</div>
            <div className="no-areas-text">Ingen områder tildelt ennå</div>
            <div className="no-areas-subtext">Kontakt lederen din for tildelinger</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeToolbar; 