import React, { useState, useEffect, useMemo } from 'react';
import { FaMapMarkedAlt, FaChevronDown, FaChevronUp, FaSignOutAlt, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { areaService } from '../../services/areaService';
import { getCampaignById, getCampaigns } from '../../services/campaignFormService';
import './ManagerToolbar.css';

// Compact "Tegnet <d. mmm>" for the sidebar area cards.
// Users have been putting the drawn-date into the area title so they could
// scan the sidebar list; surfacing it here lets them stop. Returns null on
// missing/bad timestamps so the sub-line simply doesn't render (no "Invalid
// Date" leaks). Title is untouched.
const formatDrawnShort = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `Tegnet ${d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`;
};


const ManagerSummaryDropdown = ({
  managerName,
  onlineCount,
  open,
  onToggle,
  onAreaSelect,
  onCampaignSelect,
  areaDateFilter,       // { from: 'yyyy-mm-dd', to: 'yyyy-mm-dd' } — empty strings = filter off
  setAreaDateFilter,    // (fn|obj) => void — same shape
}) => {
  const { logout } = useAuth();
  const [managerAreas, setManagerAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalOnlineCount, setTotalOnlineCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  // Apply the drawn-date filter to the sidebar list. Same date-window semantics
  // as App.js filteredAreas: Fra inclusive at 00:00, Til inclusive at 23:59.
  // ONLY applies when no campaign is selected — matches App.js filteredAreas
  // gating (see boss ask 2026-08-05: filter is a browsing tool for the
  // no-campaign view). Filter UI is also hidden while a campaign is active.
  const filteredManagerAreas = useMemo(() => {
    if (currentCampaign) return managerAreas;           // campaign scope takes precedence
    const from = areaDateFilter?.from;
    const to = areaDateFilter?.to;
    if (!from && !to) return managerAreas;
    const fromMs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const toMs   = to   ? new Date(to   + 'T23:59:59.999').getTime() : Infinity;
    if (isNaN(fromMs) || isNaN(toMs)) return managerAreas;
    return (managerAreas || []).filter(a => {
      if (!a?.created_at) return false;
      const t = new Date(a.created_at).getTime();
      if (isNaN(t)) return false;
      return t >= fromMs && t <= toMs;
    });
  }, [managerAreas, areaDateFilter, currentCampaign]);

  // "Filter is active" only in the no-campaign browsing view; UI + summary
  // counter both key off this.
  const filterActive = !currentCampaign && !!(areaDateFilter?.from || areaDateFilter?.to);
  const totalCount = managerAreas.length;
  const shownCount = filteredManagerAreas.length;

  // Load the selectable campaigns for the picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getCampaigns();
        const arr = Array.isArray(list) ? list : (list?.results || []);
        if (!cancelled) setCampaigns(arr);
      } catch {
        if (!cancelled) setCampaigns([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pick a campaign from the dropdown → notify the app (persists + syncs authService) and update
  // the local display so getCampaignId() resolves for the body campaign_id + X-Campaign-ID header.
  const handlePickCampaign = (e) => {
    const id = e.target.value;
    const campaign = campaigns.find(c => String(c.id) === String(id)) || null;
    setCurrentCampaign(campaign);
    if (onCampaignSelect) onCampaignSelect(campaign);
  };

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

              {/* Campaign selector */}
              <div className="mobile-campaign-info">
                <div className="mobile-campaign-label">Valgt kampanje:</div>
                <select
                  className="campaign-select mobile-campaign-select"
                  value={currentCampaign?.id || ''}
                  onChange={handlePickCampaign}
                >
                  <option value="">Ingen kampanje valgt</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                  ) : filteredManagerAreas.length === 0 ? (
                    <div className="mobile-no-data">Ingen områder funnet</div>
                  ) : (
                    filteredManagerAreas.map(area => (
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
                          {formatDrawnShort(area.created_at) && (
                            <span className="mobile-area-drawn" style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                              {formatDrawnShort(area.created_at)}
                            </span>
                          )}
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
              {loading ? 'Laster inn...' : (filterActive
                ? `${shownCount} av ${totalCount} tildelt område${totalCount !== 1 ? 'r' : ''}`
                : `${totalCount} tildelt område${totalCount !== 1 ? 'r' : ''}`)} &bull; {totalOnlineCount} pålogget
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
          {/* Campaign selector */}
          <div className="campaign-info">
            <div className="campaign-label">Valgt kampanje:</div>
            <select
              className="campaign-select"
              value={currentCampaign?.id || ''}
              onChange={handlePickCampaign}
            >
              <option value="">Ingen kampanje valgt</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Drawn-date filter (2026-08-05 boss ask). ONLY visible when no
              campaign is selected — filter is a browsing tool for the
              no-campaign view where 5000+ areas render at once. Both empty =
              show all (default). Any date filled = narrow the map + this
              sidebar to areas whose created_at is within the range.
              Filter STATE is preserved when a campaign is picked, so
              clearing the campaign restores the previous filter. */}
          {!currentCampaign && (
          <div className="campaign-info" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px', paddingTop: '10px' }}>
            <div className="campaign-label">Filter tegnet:</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                Fra:{' '}
                <input
                  type="date"
                  value={areaDateFilter?.from || ''}
                  onChange={(e) => setAreaDateFilter && setAreaDateFilter(prev => ({ ...(prev || {}), from: e.target.value }))}
                  style={{ padding: '3px 5px', fontSize: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
              </label>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                Til:{' '}
                <input
                  type="date"
                  value={areaDateFilter?.to || ''}
                  onChange={(e) => setAreaDateFilter && setAreaDateFilter(prev => ({ ...(prev || {}), to: e.target.value }))}
                  style={{ padding: '3px 5px', fontSize: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
              </label>
              {filterActive && (
                <button
                  type="button"
                  onClick={() => setAreaDateFilter && setAreaDateFilter({ from: '', to: '' })}
                  title="Nullstill filter"
                  style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}
                >
                  × Nullstill
                </button>
              )}
            </div>
          </div>
          )}

          <div className="area-list">
            {loading ? (
              <div className="loading-message">Laster inn områder...</div>
            ) : filteredManagerAreas.length === 0 ? (
              <div className="no-areas-message">Ingen områder funnet</div>
            ) : (
              filteredManagerAreas.map(area => (
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
                      {formatDrawnShort(area.created_at) && (
                        <span className="area-drawn" style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                          {formatDrawnShort(area.created_at)}
                        </span>
                      )}
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