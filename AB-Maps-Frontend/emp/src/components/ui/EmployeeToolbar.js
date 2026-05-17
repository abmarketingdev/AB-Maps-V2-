import React, { useState, useEffect } from 'react';
import { FaMap, FaChevronDown, FaChevronUp, FaUser, FaCheckCircle, FaSignal } from 'react-icons/fa';
import { getCampaignById } from '../../services/campaignFormService';
import './EmployeeToolbar.css';

/**
 * Employee Toolbar Component - Shows assigned areas for navigation help (optional)
 * Users can place address markers without selecting an area
 */
const EmployeeToolbar = ({ employee, assignedAreas, allAreas, onAreaSelect, selectedAreaId, selectedCampaign, onLoadCarriers, loadingCarriers }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [campaign, setCampaign] = useState(selectedCampaign || null);

  useEffect(() => {
    const fetchCampaign = async () => {
      let campaignToSet = selectedCampaign;
      if (!campaignToSet || !campaignToSet.name) {
        // Try to get campaign from localStorage
        const stored = localStorage.getItem('currentCampaign');
        let campaignId = null;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            campaignId = parsed && parsed.id ? parsed.id : stored;
          } catch {
            campaignId = stored;
          }
        }
        if (campaignId) {
          // Try to get token from localStorage (using namespaced key)
          const token = localStorage.getItem('emp_accessToken');
          try {
            const fetched = await getCampaignById(campaignId, token);
            console.log('Fetched campaign:', fetched);
            campaignToSet = fetched;
          } catch {
            campaignToSet = null;
          }
        }
      }
      setCampaign(campaignToSet);
    };
    fetchCampaign();
  }, [selectedCampaign]);

  // Remove local selectedArea state

  // Helper to get area with geometry (GeoJSON) for fly-to
  const getAreaWithGeometry = (area) => {
    console.log('getAreaWithGeometry called with area:', area);

    // If area already has polygon_geometry, use it directly
    if (area.polygon_geometry && area.polygon_geometry.coordinates) {
      console.log('Area has polygon_geometry, converting to GeoJSON format');
      return {
        geometry: { type: 'Polygon', coordinates: area.polygon_geometry.coordinates },
        properties: { id: area.id, name: area.name, color: area.color },
        ...area
      };
    }

    // If area is already GeoJSON (has geometry), return as is
    if (area.geometry && area.properties) {
      console.log('Area is already in GeoJSON format');
      return area;
    }

    // Try to find the matching area in allAreas (by id)
    if (allAreas && allAreas.length > 0) {
      console.log('Looking for area in allAreas, searching for ID:', area.id);
      console.log('allAreas:', allAreas);

      // Try both id and properties.id
      const match = allAreas.find(
        (a) => (a.id === area.id) || (a.id === area?.properties?.id)
      );

      if (match) {
        console.log('Found matching area in allAreas:', match);
        if (match.polygon_geometry && match.polygon_geometry.coordinates) {
          console.log('Converting matched area to GeoJSON format');
          return {
            geometry: { type: 'Polygon', coordinates: match.polygon_geometry.coordinates },
            properties: { id: match.id, name: match.name, color: match.color },
            ...match
          };
        } else {
          console.log('Matched area does not have polygon_geometry');
        }
      } else {
        console.log('No matching area found in allAreas');
      }
    } else {
      console.log('allAreas is empty or undefined');
    }

    // Fallback: return the plain area
    console.log('Returning plain area as fallback');
    return area;
  };

  const handleAreaClick = (area) => {
    console.log('handleAreaClick called with area:', area);
    const areaWithGeometry = getAreaWithGeometry(area);
    console.log('Area with geometry:', areaWithGeometry);

    if (onAreaSelect) {
      console.log('Calling onAreaSelect with:', areaWithGeometry);
      onAreaSelect(areaWithGeometry);
    }
    setIsExpanded(false);
  };

  const handleLoadCarriers = (e, areaId) => {
    e.stopPropagation(); // Prevent area selection when clicking the button
    if (onLoadCarriers) {
      onLoadCarriers(areaId);
    }
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
            {assignedAreas?.length || 0} områder tilgjengelig (valgfritt)
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
        {campaign && (
          <div className="campaign-info">
            <div className="campaign-label">Valgt kampanje:</div>
            <div className="campaign-name">{campaign.name}</div>
          </div>
        )}
        {assignedAreas && assignedAreas.length > 0 ? (
          <div className="areas-list">
            {assignedAreas.map((area) => {
              const isLoading = loadingCarriers && loadingCarriers.has(area.id);
              return (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="carrier-button"
                      onClick={(e) => handleLoadCarriers(e, area.id)}
                      disabled={isLoading}
                      title="Last carrier markører (Talkmore/Telenor)"
                      style={{
                        background: isLoading ? '#ccc' : '#3b82f6',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        color: 'white',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        minWidth: '32px',
                        justifyContent: 'center'
                      }}
                    >
                      <FaSignal style={{ fontSize: '12px' }} />
                    </button>
                    {selectedAreaId === area.id && (
                      <FaCheckCircle style={{ color: '#1976d2', fontSize: 18, verticalAlign: 'middle' }} />
                    )}
                  </div>
                </div>
              );
            })}
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