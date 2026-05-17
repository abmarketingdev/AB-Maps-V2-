import React from 'react';
import { Popup } from 'react-leaflet';
import { areaService } from '../../services/areaService';

/**
 * Component for displaying area information and action buttons
 */
const AreaPopup = ({ area, index, isEditable, onUpdate, onDelete }) => {
  const [manager, setManager] = React.useState(null);
  const [employeeCount, setEmployeeCount] = React.useState(0);

  // Load manager and employee count for the area
  React.useEffect(() => {
    const loadAreaInfo = async () => {
      try {
        // Get manager info
        const managerData = await areaService.getManager(area.properties.manager_id);
        setManager(managerData);
        
        // Get employee count
        const employees = await areaService.getAreaEmployees(area.properties.id);
        setEmployeeCount(employees.length);
      } catch (error) {
        console.error('Error loading area info:', error);
      }
    };

    if (area) {
      loadAreaInfo();
    }
  }, [area]);

  return (
    <Popup position={area.position}>
      <div className="area-popup">
        <h3>{area.properties.name}</h3>
        <div className="area-info">
          <p><strong>Manager:</strong> {manager?.name || 'Unknown'}</p>
          <p><strong>Houses:</strong> {area.properties.house_count}</p>
          <p><strong>Employees:</strong> {employeeCount}</p>
          <p><strong>Created:</strong> {new Date(area.properties.created_at).toLocaleDateString()}</p>
        </div>
        
        {isEditable ? (
          <div className="editable-controls">
            <button 
              className="edit-btn"
              onClick={() => onUpdate(index)}
            >
              Edit
            </button>
            <button 
              className="delete-btn"
              onClick={() => onDelete(index)}
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="read-only-notice">
            <p>Read-only area (created by another manager)</p>
          </div>
        )}
      </div>
    </Popup>
  );
};

export default AreaPopup;
