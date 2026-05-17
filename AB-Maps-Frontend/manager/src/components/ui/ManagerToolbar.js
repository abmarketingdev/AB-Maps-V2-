import React, { useState, useEffect } from 'react';
import { FaMapMarkedAlt, FaChevronDown, FaChevronUp, FaSignOutAlt, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { areaService } from '../../services/areaService';
import { getCampaignById } from '../../services/campaignFormService';
import './ManagerToolbar.css';


const ManagerSummaryDropdown = ({
  managerName,
  onlineCount,
  open,
  onToggle,
  onAreaSelect
}) => {
  const { logout } = useAuth();
  const [managerAreas, setManagerAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalOnlineCount, setTotalOnlineCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState(null);

  useEffect(() => {
    const readCampaign = async () => {
      const stored = localStorage.getItem('currentCampaign');
      if (stored) {
        try {
          let parsed = null;
          try {
            parsed = JSON.parse(stored);
          } catch {
            // Not JSON, treat as ID string
          }
          if (parsed && parsed.name) {
            setCurrentCampaign(parsed);
          } else {
            // If it's an ID string or object without name, fetch campaign by ID
            const campaignId = parsed && parsed.id ? parsed.id : stored;
            if (campaignId) {
              try {
                const campaign = await getCampaignById(campaignId);
                setCurrentCampaign(campaign);
              } catch (err) {
                setCurrentCampaign(null);
              }
            } else {
              setCurrentCampaign(null);
            }
          }
        } catch {
          setCurrentCampaign(null);
        }
      } else {
        setCurrentCampaign(null);
      }
    };
    readCampaign();
    window.addEventListener('storage', readCampaign);
    return () => window.removeEventListener('storage', readCampaign);
  }, []);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get user initials
  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Load manager's areas and calculate online count
  useEffect(() => {
    if (open || showMobileMenu) {
      const loadManagerAreas = async () => {
        setLoading(true);
        try {
          const areas = await areaService.getManagerAreas();
          setManagerAreas(areas);
          
          // Calculate total online employees across all areas (unique employees only)
          // Use employee data directly from my_areas response instead of making additional API calls
          const allEmployees = new Map(); // Use Map to track unique employees by ID
          
          areas.forEach(area => {
            // Check if area has employees data from my_areas response
            if (area.employees && Array.isArray(area.employees)) {
              area.employees.forEach(emp => {
                const employeeId = emp.id;
                
                // Only add if not already tracked
                if (!allEmployees.has(employeeId)) {
                  allEmployees.set(employeeId, emp);
                }
              });
            }
          });
          
          // Count unique online employees
          const totalOnline = Array.from(allEmployees.values()).filter(emp => emp.is_online).length;
          setTotalOnlineCount(totalOnline);
        } catch (error) {
          console.error('Error loading manager areas:', error);
          setManagerAreas([]);
          setTotalOnlineCount(0);
        } finally {
          setLoading(false);
        }
      };
      
      loadManagerAreas();
    }
  }, [open, showMobileMenu]);

  const handleLogout = () => {
    logout();
  };

  const handleMobileToggle = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  // Mobile version - minimalistic circular avatar
  if (isMobile) {
    return (
      <div className="mobile-manager-toolbar">
        {/* Floating Action Button */}
        <div className="mobile-fab" onClick={handleMobileToggle}>
          <div className="mobile-avatar">
            <span className="mobile-initials">{getUserInitials(managerName)}</span>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {showMobileMenu && (
          <div className="mobile-menu-overlay" onClick={handleMobileToggle}>
            <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="mobile-menu-header">
                <div className="mobile-user-info">
                  <div className="mobile-avatar-large">
                    <span className="mobile-initials-large">{getUserInitials(managerName)}</span>
                  </div>
                  <div className="mobile-user-details">
                    <h3>{managerName}</h3>
                    <p>{managerAreas.length} tildelt område{managerAreas.length !== 1 ? 'r' : ''} • {totalOnlineCount} pålogget</p>
                  </div>
                </div>
                <button className="mobile-close-btn" onClick={handleMobileToggle}>
                  <FaTimes />
                </button>
              </div>

              {/* Campaign Info */}
              <div className="mobile-campaign-info">
                <div className="mobile-campaign-label">Valgt kampanje:</div>
                <div className="mobile-campaign-name">{currentCampaign ? currentCampaign.name : 'Ingen kampanje valgt'}</div>
              </div>

              {/* Quick Actions */}
              <div className="mobile-quick-actions">
                <button 
                  className="mobile-action-btn secondary"
                  onClick={() => {
                    handleLogout();
                    setShowMobileMenu(false);
                  }}
                >
                  <FaSignOutAlt />
                  <span>Logg ut</span>
                </button>
              </div>

              {/* Areas Section */}
              <div className="mobile-section">
                <h4>Områder</h4>
                <div className="mobile-areas-list">
                  {loading ? (
                    <div className="mobile-loading">Laster inn områder...</div>
                  ) : managerAreas.length === 0 ? (
                    <div className="mobile-no-data">Ingen områder funnet</div>
                  ) : (
                    managerAreas.map(area => (
                      <button
                        key={area.id}
                        className="mobile-area-item"
                        onClick={() => {
                          onAreaSelect(area);
                          setShowMobileMenu(false);
                        }}
                      >
                        <div className="mobile-area-info">
                          <span className="mobile-area-name">{area.name}</span>
                          <span className="mobile-area-stats">{area.house_count} boliger</span>
                        </div>
                        <div 
                          className="mobile-area-color" 
                          style={{ backgroundColor: area.color }}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop version - keep existing design
  return (
    <div className="manager-summary-dropdown">
      <div className="summary-bar">
        <div className="summary-left" onClick={onToggle}>
          <FaMapMarkedAlt className="summary-icon" size={22} />
          <div className="summary-info">
            <div className="summary-name">{managerName}</div>
            <div className="summary-meta">
              {loading ? 'Laster inn...' : `${managerAreas.length} tildelt område${managerAreas.length !== 1 ? 'r' : ''}`} &bull; {totalOnlineCount} pålogget
            </div>
          </div>
          {open ? <FaChevronUp size={18} /> : <FaChevronDown size={18} />}
        </div>
        <div className="summary-actions">
          <button 
            className="logout-button" 
            onClick={handleLogout}
            title="Logg ut"
          >
            <FaSignOutAlt size={16} />
          </button>
        </div>
      </div>
      {open && (
        <div className="area-dropdown open">
          {/* Campaign Info */}
          <div className="campaign-info">
            <div className="campaign-label">Valgt kampanje:</div>
            <div className="campaign-name">{currentCampaign && currentCampaign.name ? currentCampaign.name : 'Ingen kampanje valgt'}</div>
          </div>
          <div className="area-list">
            {loading ? (
              <div className="loading-message">Laster inn områder...</div>
            ) : managerAreas.length === 0 ? (
              <div className="no-areas-message">Ingen områder funnet</div>
            ) : (
              managerAreas.map(area => (
                <div key={area.id} className="area-item-container">
                  <button
                    className="area-item"
                    onClick={() => onAreaSelect(area)}
                  >
                    <div className="area-info">
                      <span className="area-name">{area.name}</span>
                      <span className="area-stats">
                        {area.house_count} boliger
                      </span>
                    </div>
                    <div 
                      className="area-color-indicator" 
                      style={{ backgroundColor: area.color }}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerSummaryDropdown; 