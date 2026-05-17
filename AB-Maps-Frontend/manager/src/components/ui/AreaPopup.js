import React from 'react';
import { Popup } from 'react-leaflet';
import L from 'leaflet';
import { areaService } from '../../services/areaService';
import FloatingForbiddenAreaPopup from '../map/FloatingForbiddenAreaPopup';
import AssignEmployeesModal from '../AssignEmployeesModal';

/**
 * Component for displaying area information and action buttons
 */
const AreaPopup = ({ area, index, isEditable, onUpdate, onDelete, onClose }) => {
  const debugLog = (...args) => { try { console.log('[AreaPopup]', ...args); } catch {} };
  const [manager, setManager] = React.useState(null);
  const [employeeCount, setEmployeeCount] = React.useState(0);
  const [showAssignEmployeesModal, setShowAssignEmployeesModal] = React.useState(false);
  // access: 'pending' -> waiting on backend; 'allowed' -> show Leaflet Popup; 'forbidden' -> show floating modal
  const [access, setAccess] = React.useState('pending');

  // Support both GeoJSON-like "properties" and flat area objects
  const props = area?.properties ? area.properties : area || {};
  const managerId = props?.manager_id;
  const areaId = props?.id;
  const houseCount = props?.house_count ?? props?.houses ?? 0;
  const createdAt = props?.created_at ? new Date(props.created_at) : null;
  const position = area?.position; // injected by caller

  React.useEffect(() => {
    const loadAreaInfo = async () => {
      try {
        // First try explicit manager lookup
        if (managerId && typeof areaService.getManager === 'function') {
          try {
            
            const managerData = await areaService.getManager(managerId);
            if (managerData) setManager(managerData);
          } catch (e) {
            // ignore and fall back to deriving from employees
          }
        }
        // Always fetch employees for count and possible manager derivation
        if (areaId) {
          const employees = await areaService.getAreaEmployees(areaId);
          setEmployeeCount(Array.isArray(employees) ? employees.length : 0);
          if (!manager && Array.isArray(employees)) {
            const withMgr = employees.find(emp => emp && emp.manager && emp.manager.name);
            if (withMgr && withMgr.manager) {
              setManager(withMgr.manager);
            }
          }
          // If employees fetch worked, we consider access allowed
          setAccess('allowed');
        }
      } catch (error) {
        // If backend forbids access, show Forbidden overlay instead of Leaflet popup
        const msg = `${error?.message || ''}`.toLowerCase();
        // Also treat any network 403 (fetch response status) as forbidden
        if (error?.status === 403 || error?.response?.status === 403 || msg.includes('403') || msg.includes('forbidden')) {
          debugLog('Forbidden detected (403) for area:', areaId);
          setAccess('forbidden');
        } else {
          // Any other error: do not open Leaflet popup by default; show forbidden-style message for safety
          debugLog('Area info error; treating as forbidden for safety. Error:', error);
          setAccess('forbidden');
        }
      }
    };

    loadAreaInfo();
  }, [managerId, areaId]);

  const popupEventHandlers = {
    add: (e) => {
      const popupEl = e.target.getElement();
      const attach = (node) => {
        if (!node) return null;
        L.DomEvent.disableClickPropagation(node);
        L.DomEvent.disableScrollPropagation(node);
        const stopper = (ev) => {
          L.DomEvent.stop(ev);
          if (ev?.originalEvent && typeof ev.originalEvent.stopImmediatePropagation === 'function') {
            ev.originalEvent.stopImmediatePropagation();
          }
        };
        const events = ['click','mousedown','mouseup','dblclick','contextmenu','touchstart','touchend','touchmove','pointerdown','pointerup','wheel','scroll'];
        events.forEach(evt => L.DomEvent.on(node, evt, stopper));
        return { node, stopper, events };
      };

      const guards = [];
      if (popupEl) guards.push(attach(popupEl));
      const popupRoot = popupEl && popupEl.closest ? popupEl.closest('.leaflet-popup') : null;
      if (popupRoot) guards.push(attach(popupRoot));
      const pane = popupRoot && popupRoot.parentElement ? popupRoot.parentElement : null; // .leaflet-popup-pane
      if (pane) guards.push(attach(pane));

      // store to remove later
      e.target._isolationGuards = guards.filter(Boolean);
    },
    remove: (e) => {
      const guards = e?.target?._isolationGuards || [];
      guards.forEach(g => {
        try {
          g.events.forEach(evt => L.DomEvent.off(g.node, evt, g.stopper));
        } catch {}
      });
      if (e?.target) delete e.target._isolationGuards;
    }
  };

  const handleAddEmployee = () => {
    setShowAssignEmployeesModal(true);
  };

  const handleCloseAssignEmployees = () => {
    setShowAssignEmployeesModal(false);
  };

  // Gate rendering until access is resolved to avoid eager Leaflet popup creation
  if (access === 'pending') {
    // Render nothing (or could render a tiny non-blocking loader if desired)
    return null;
  }

  if (access === 'forbidden') {
    debugLog('Rendering FloatingForbiddenAreaPopup');
    return (
      <FloatingForbiddenAreaPopup
        position={position}
        onClose={onClose}
        message="Dette området ble ikke opprettet av deg."
      />
    );
  }

  debugLog('Rendering standard Leaflet AreaPopup', { areaId });
  return (
    <Popup position={position} autoPan={false} closeOnClick={false} eventHandlers={popupEventHandlers}>
      <div
        className="area-popup"
        onClick={(e)=>{e.stopPropagation();}}
        onMouseDown={(e)=>{e.stopPropagation();}}
        onMouseUp={(e)=>{e.stopPropagation();}}
        onTouchStart={(e)=>{e.stopPropagation();}}
        onTouchEnd={(e)=>{e.stopPropagation();}}
        onPointerDown={(e)=>{e.stopPropagation();}}
        onPointerUp={(e)=>{e.stopPropagation();}}
        onContextMenu={(e)=>{e.stopPropagation();}}
      >
        <h3>{props?.name || 'Area'}</h3>
        <div className="area-info">
          <p><strong>Manager:</strong> {manager?.name || 'Unknown'}</p>
          <p><strong>Houses:</strong> {houseCount}</p>
          <p><strong>Employees:</strong> {employeeCount}</p>
          {createdAt && (
            <p><strong>Created:</strong> {createdAt.toLocaleDateString()}</p>
          )}
        </div>
        
        {isEditable ? (
          <div className="editable-controls">
            <button 
              className="edit-btn"
              onClick={() => onUpdate(index)}
            >
              Edit
            </button>
            {areaId && (
              <button 
                className="add-employee-btn"
                onClick={handleAddEmployee}
              >
                Tildel Ansatte
              </button>
            )}
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
      
      {/* Assign Employees Modal */}
      {areaId && (
        <AssignEmployeesModal
          isOpen={showAssignEmployeesModal}
          onClose={handleCloseAssignEmployees}
          areaId={areaId}
          areaName={props?.name || 'Area'}
        />
      )}
    </Popup>
  );
};

export default AreaPopup;

/**
 * ForbiddenAreaPopup – Floating, Leaflet‑independent notice for 403 cases
 * Usage: render when backend rejects area interaction (403).
 */
export const ForbiddenAreaPopup = ({ onClose, message = 'Dette området ble ikke opprettet av deg.' }) => {
  const containerRef = React.useRef(null);

  // Close on outside click
  React.useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (typeof onClose === 'function') onClose();
      }
    };
    document.addEventListener('mousedown', onDocClick, true);
    return () => document.removeEventListener('mousedown', onDocClick, true);
  }, [onClose]);

  const stopAll = (e) => {
    if (!e) return;
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 12000,
  };

  const panelStyle = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 12001,
    minWidth: 320,
    maxWidth: '90vw',
    background: '#1f2430',
    color: '#fff',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
  };

  const headerStyle = {
    padding: '14px 18px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const bodyStyle = {
    padding: 18,
    fontSize: 15,
    lineHeight: 1.5,
  };

  const closeBtnStyle = {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 28,
    height: 28,
    cursor: 'pointer',
    fontSize: 18,
  };

  return (
    <>
      <div
        style={backdropStyle}
        onClick={onClose}
        onMouseDown={stopAll}
        onMouseUp={stopAll}
        onTouchStart={stopAll}
        onTouchEnd={stopAll}
        onContextMenu={(e) => { e.preventDefault(); stopAll(e); }}
      />
      <div
        ref={containerRef}
        style={panelStyle}
        className="forbidden-area-popup"
        onClick={stopAll}
        onMouseDown={stopAll}
        onMouseUp={stopAll}
        onTouchStart={stopAll}
        onTouchEnd={stopAll}
        onPointerDown={stopAll}
        onPointerUp={stopAll}
        onContextMenu={(e) => { e.preventDefault(); stopAll(e); }}
      >
        <div style={headerStyle}>
          <span>Begrenset tilgang</span>
          <button style={closeBtnStyle} aria-label="Lukk" onClick={(e) => { stopAll(e); if (onClose) onClose(); }}>
            ×
          </button>
        </div>
        <div style={bodyStyle}>
          {message}
        </div>
      </div>
    </>
  );
};

