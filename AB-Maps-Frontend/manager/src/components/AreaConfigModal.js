import React, { useState, useEffect } from 'react';
import { SketchPicker } from 'react-color';
import AssignEmployeesModal from './AssignEmployeesModal';

const AreaConfigModal = ({ onConfirm, onCancel, addressCount, areaId, areaName: initialAreaName }) => {
  const [areaName, setAreaName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#2b2d42');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAssignEmployeesModal, setShowAssignEmployeesModal] = useState(false);

  // Initialize areaName with initial value
  useEffect(() => {
    if (initialAreaName) {
      setAreaName(initialAreaName);
    }
  }, [initialAreaName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      name: areaName,
      color: selectedColor
    });
  };

  const handleAddEmployee = () => {
    setShowAssignEmployeesModal(true);
  };

  const handleCloseAssignEmployees = () => {
    setShowAssignEmployeesModal(false);
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Configure Area</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="areaName">Area Name:</label>
              <input
                type="text"
                id="areaName"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="Enter area name"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Area Color:</label>
              <div className="color-picker-container">
                <div
                  className="color-preview"
                  style={{ backgroundColor: selectedColor }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                />
                {showColorPicker && (
                  <div className="color-picker-popover">
                    <div className="color-picker-cover" onClick={() => setShowColorPicker(false)} />
                    <SketchPicker
                      color={selectedColor}
                      onChange={(color) => setSelectedColor(color.hex)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="address-count">
              Number of addresses in this area: <strong>{addressCount}</strong>
            </div>

            {/* Add Employee Button */}
            {areaId && (
              <div className="form-group">
                <button
                  type="button"
                  className="btn-add-employee"
                  onClick={handleAddEmployee}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tildel Ansatte
                </button>
              </div>
            )}

            <div className="modal-actions">
              <button type="submit" className="btn-primary">
                Confirm
              </button>
              <button type="button" className="btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Assign Employees Modal */}
      <AssignEmployeesModal
        isOpen={showAssignEmployeesModal}
        onClose={handleCloseAssignEmployees}
        areaId={areaId}
        areaName={areaName}
      />
    </>
  );
};

export default AreaConfigModal;
