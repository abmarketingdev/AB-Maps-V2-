import React from 'react';
import { areaService } from '../../services/areaService';
import './AreaDropdown.css';

const AreaDropdown = ({ open, onAreaSelect, currentUserId }) => {
  const [managerAreas, setManagerAreas] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // Load manager's areas when dropdown opens
  React.useEffect(() => {
    if (open) {
      const loadManagerAreas = async () => {
        setLoading(true);
        try {
          const areas = await areaService.getManagerAreas();
          setManagerAreas(areas);
        } catch (error) {
          console.error('Error loading manager areas:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadManagerAreas();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="area-dropdown open">
      <div className="area-list">
        {loading ? (
          <div className="loading-message">Loading areas...</div>
        ) : managerAreas.length === 0 ? (
          <div className="no-areas-message">No areas found</div>
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
                    {area.house_count} houses
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
  );
};

export default AreaDropdown; 