import React from 'react';

/**
 * Dialog for configuring area properties
 */
const AreaDialog = ({ 
  showDialog, 
  areaData, 
  onDataChange, 
  onConfirm, 
  onCancel, 
  onDelete
}) => {
  if (!showDialog) return null;

  return (
    <div className="area-dialog-overlay">
      <div className="area-dialog">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Tildel område</h2>
          <button
            aria-label="Lukk"
            className="close-btn"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', marginLeft: 8 }}
          >
            &times;
          </button>
        </div>
        <div className="area-form">
          <input
            type="text"
            placeholder="Tittel"
            value={areaData.title}
            onChange={(e) => onDataChange({ ...areaData, title: e.target.value })}
            className="area-input"
          />
          <input
            type="color"
            value={areaData.color}
            onChange={(e) => onDataChange({ ...areaData, color: e.target.value })}
            className="area-color-picker"
          />
          <div className="area-info">
            <p>Salgsmuligheter: {areaData.houseCount}</p>
          </div>
          <div className="area-buttons">
            <button
              className="area-delete-button"
              onClick={onDelete}
              type="button"
            >
              Slett område
            </button>
            <button className="area-confirm-button" onClick={onConfirm} type="button">
              Bekreft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaDialog;
