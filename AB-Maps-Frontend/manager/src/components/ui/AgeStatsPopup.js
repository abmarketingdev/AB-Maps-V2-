/**
 * @deprecated This component is temporarily disabled.
 * The Age Statistics feature has been deprecated and removed from the UI.
 * This file is kept for future reference but is not currently in use.
 */

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkerAlt, 
  faSpinner, 
  faExclamationTriangle,
  faChartBar,
  faLocationArrow,
  faTimes,
  faUsers
} from '@fortawesome/free-solid-svg-icons';
import ageStatsService from '../../services/ageStatsService';
import './AgeStatsPopup.css';

/**
 * Calculate centroid of a polygon ring
 * @param {Array} ring - Array of [lng, lat] coordinates
 * @returns {Array} [lng, lat] centroid
 */
const calculateCentroid = (ring) => {
  if (!ring || ring.length === 0) return null;
  
  let sumLng = 0;
  let sumLat = 0;
  const count = ring.length;

  for (const coord of ring) {
    sumLng += coord[0];
    sumLat += coord[1];
  }

  return [sumLng / count, sumLat / count];
};

/**
 * Get coordinates from locked areas data (already loaded)
 * @param {Array} lockedAreas - Array of locked area objects with polygon_geometry
 * @param {string} areaCode - SSB area code
 * @param {string} areaType - Type of area (fylke or kommune)
 * @returns {{lat: number, lng: number} | null} Center coordinates
 */
const getAreaCoordinatesFromLockedAreas = (lockedAreas, areaCode, areaType) => {
  if (!Array.isArray(lockedAreas) || lockedAreas.length === 0) {
    console.error('[AgeStatsPopup] No locked areas provided');
    return null;
  }

  // Match area by both area_code and area_type
  const area = lockedAreas.find(a => 
    a.area_code === areaCode && a.area_type === areaType
  );

  if (!area) {
    console.error(`[AgeStatsPopup] Area not found: ${areaCode} (${areaType})`);
    return null;
  }

  if (!area.polygon_geometry || !area.polygon_geometry.coordinates) {
    console.error('[AgeStatsPopup] Area has no polygon geometry');
    return null;
  }

  // Calculate centroid of the polygon
  const coords = area.polygon_geometry.coordinates;
  let centroid = null;

  if (area.polygon_geometry.type === 'MultiPolygon') {
    // MultiPolygon structure: [[[[lng, lat], [lng, lat], ...]]]
    // Get the first polygon's first ring
    if (coords[0] && coords[0][0] && Array.isArray(coords[0][0])) {
      const firstRing = coords[0][0];
      centroid = calculateCentroid(firstRing);
    }
  } else if (area.polygon_geometry.type === 'Polygon') {
    // Polygon structure: [[[lng, lat], [lng, lat], ...]]
    // Get the first ring (exterior ring)
    if (coords[0] && Array.isArray(coords[0])) {
      centroid = calculateCentroid(coords[0]);
    }
  }

  if (centroid && centroid[0] && centroid[1]) {
    // Centroid is [lng, lat], return as {lat, lng}
    return { lat: centroid[1], lng: centroid[0] };
  }

  console.error('[AgeStatsPopup] Could not calculate centroid');
  return null;
};

/**
 * AgeStatsPopup - Modal popup showing age statistics for locked areas
 * Allows flying to each area on the map
 * @deprecated Feature temporarily disabled
 */
const AgeStatsPopup = ({ 
  isOpen, 
  onClose, 
  onFlyToArea,
  showToast,
  lockedAreas = [] // Already loaded locked areas from App.js
}) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flyingTo, setFlyingTo] = useState(null); // Track which area we're flying to

  // Fetch age stats when popup opens
  useEffect(() => {
    if (isOpen) {
      fetchAgeStats();
    }
  }, [isOpen]);

  const fetchAgeStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await ageStatsService.getAgeStats();
      setStats(data);
      
      if (data.error) {
        // SSB API error - show warning but still display data
        if (showToast) {
          showToast(`Advarsel: ${data.error}`, 'warning');
        }
      }
    } catch (err) {
      console.error('[AgeStatsPopup] Error fetching stats:', err);
      setError(err.message || 'Kunne ikke laste aldersstatistikk');
      if (showToast) {
        showToast(err.message || 'Kunne ikke laste aldersstatistikk', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFlyToArea = (area) => {
    setFlyingTo(area.id);
    
    try {
      // Get coordinates from already-loaded locked areas (no API call needed)
      const coords = getAreaCoordinatesFromLockedAreas(lockedAreas, area.area_code, area.area_type);
      const zoomLevel = ageStatsService.getZoomLevelForAreaType(area.area_type);
      
      if (coords && onFlyToArea) {
        onFlyToArea(coords, zoomLevel, area);
        
        if (showToast) {
          showToast(`Flyr til ${area.area_name}`, 'info');
        }
        
        // Close popup instantly
        onClose();
      } else {
        if (showToast) {
          showToast(`Kunne ikke finne lokasjon for ${area.area_name}`, 'error');
        }
      }
    } catch (err) {
      console.error('[AgeStatsPopup] Error flying to area:', err);
      if (showToast) {
        showToast(`Feil ved navigering til ${area.area_name}`, 'error');
      }
    } finally {
      setFlyingTo(null);
    }
  };

  const getAreaTypeLabel = (type) => {
    switch (type) {
      case 'fylke': return 'Fylke';
      case 'kommune': return 'Kommune';
      default: return type;
    }
  };

  const getAreaTypeClass = (type) => {
    switch (type) {
      case 'fylke': return 'area-type-fylke';
      case 'kommune': return 'area-type-kommune';
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="age-stats-modal-overlay" onClick={onClose}>
      <div className="age-stats-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="age-stats-header">
          <div className="age-stats-title">
            <FontAwesomeIcon icon={faChartBar} className="header-icon" />
            <h2>Aldersstatistikk</h2>
          </div>
          <button className="age-stats-close-btn" onClick={onClose} title="Lukk">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Stats year info */}
        {stats && stats.stats_year && (
          <div className="age-stats-year-info">
            <FontAwesomeIcon icon={faUsers} className="year-icon" />
            <span>Statistikk fra {stats.stats_year}</span>
          </div>
        )}

        {/* Error banner if SSB API failed */}
        {stats && stats.error && (
          <div className="age-stats-warning">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{stats.error}</span>
          </div>
        )}

        {/* Content */}
        <div className="age-stats-content">
          {loading ? (
            <div className="age-stats-loading">
              <FontAwesomeIcon icon={faSpinner} spin size="2x" />
              <p>Laster aldersstatistikk...</p>
            </div>
          ) : error ? (
            <div className="age-stats-error">
              <FontAwesomeIcon icon={faExclamationTriangle} size="2x" />
              <p>{error}</p>
              <button className="retry-btn" onClick={fetchAgeStats}>
                Prøv igjen
              </button>
            </div>
          ) : stats && stats.data && stats.data.length > 0 ? (
            <div className="age-stats-list">
              {stats.data.map((area) => (
                <div key={area.id} className="age-stats-item">
                  <div className="area-info">
                    <div className="area-header">
                      <span className={`area-type-badge ${getAreaTypeClass(area.area_type)}`}>
                        {getAreaTypeLabel(area.area_type)}
                      </span>
                      <span className="area-code">{area.area_code}</span>
                      {area.cached && (
                        <span className="cached-badge" title="Data fra hurtiglager">
                          Hurtiglager
                        </span>
                      )}
                    </div>
                    <h3 className="area-name">{area.area_name}</h3>
                    <div className="age-values">
                      {area.mean_age !== null ? (
                        <>
                          <div className="age-stat">
                            <span className="age-label">Gjennomsnittsalder</span>
                            <span className="age-value">{area.mean_age.toFixed(1)}</span>
                          </div>
                          <div className="age-stat">
                            <span className="age-label">Medianalder</span>
                            <span className="age-value">{area.median_age?.toFixed(1) || 'N/A'}</span>
                          </div>
                        </>
                      ) : (
                        <div className="age-stat no-data">
                          <span className="age-label">Ingen aldersdata tilgjengelig</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    className="fly-to-btn"
                    onClick={() => handleFlyToArea(area)}
                    disabled={flyingTo === area.id}
                    title={`Gå til ${area.area_name}`}
                  >
                    {flyingTo === area.id ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faLocationArrow} />
                        <span>Gå til område</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="age-stats-empty">
              <FontAwesomeIcon icon={faMapMarkerAlt} size="2x" />
              <p>Ingen låste områder funnet for denne kampanjen.</p>
              <p className="hint">Lås noen fylke- eller kommuneområder for å se deres aldersstatistikk.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="age-stats-footer">
          <span className="data-source">Datakilde: SSB (Statistisk sentralbyrå)</span>
        </div>
      </div>
    </div>
  );
};

export default AgeStatsPopup;

