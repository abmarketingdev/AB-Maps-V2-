import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheck, 
  faTimes, 
  faHome, 
  faClipboardList,
  faSpinner,
  faCircle,
  faStickyNote,
  faChevronDown,
  faChevronUp
} from '@fortawesome/free-solid-svg-icons';
import { labelForNeiSubcategory } from '../../constants/neiSubcategory';
import NeiSubcategoryInlineStep from './NeiSubcategoryInlineStep';

const STATUS_CONFIG = {
  ja: {
    label: 'Ja',
    color: '#10b981',
    bgColor: '#d1fae5',
    icon: faCheck,
  },
  nei: {
    label: 'Nei',
    color: '#ef4444',
    bgColor: '#fee2e2',
    icon: faTimes,
  },
  ikke_hjemme: {
    label: 'Ikke hjemme',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: faHome,
  },
  folg_opp: {
    label: 'Følg opp',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    icon: faClipboardList,
  },
};

/**
 * Nei: subcategory step then PATCH with `nei_subcategory` (or null). Notes only sent with status from here.
 */
const ApartmentListItem = ({
  apartment,
  onStatusChange,
  isUpdating = false,
  isTalkmoreCampaign = false,
  actionError = null,
  onClearRowError,
}) => {
  const { 
    id, 
    apartment_number, 
    status, 
    is_visited, 
    notes: existingNotes,
    carrier_status,
    nei_subcategory: aptNeiSub = null,
  } = apartment;
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNeiSubcatStep, setShowNeiSubcatStep] = useState(false);

  useEffect(() => {
    if (is_visited) setShowNeiSubcatStep(false);
  }, [is_visited]);

  const currentStatusConfig = status ? STATUS_CONFIG[status] : null;
  const showCarrierBadge = isTalkmoreCampaign && 
                           carrier_status === 'telenor_talkmore_available';

  const handleStatusClick = (e, newStatus) => {
    e.stopPropagation();
    if (!isUpdating && onStatusChange) {
      onStatusChange(id, newStatus, notes.trim() || null);
      setNotes('');
      setShowNotes(false);
    }
  };

  const handleReset = (e) => {
    e.stopPropagation();
    if (!isUpdating && onStatusChange) {
      onStatusChange(id, null, null);
    }
  };

  const toggleNotes = (e) => {
    e.stopPropagation();
    setShowNotes(!showNotes);
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  const handleNotesClick = (e) => {
    e.stopPropagation();
  };

  const neiReasonLabel = labelForNeiSubcategory(aptNeiSub);

  return (
    <div className={`apartment-list-item ${is_visited ? 'visited' : 'unvisited'} ${isUpdating ? 'updating' : ''}`}>
      <div className="apartment-item-header">
        <div className="apartment-number-badge">
          <span>{apartment_number}</span>
        </div>
        
        <div className="apartment-info">
          <span className="apartment-label">Leilighet {apartment_number}</span>
          {is_visited && currentStatusConfig && (
            <span 
              className="apartment-status-tag"
              style={{ 
                backgroundColor: currentStatusConfig.bgColor,
                color: currentStatusConfig.color 
              }}
            >
              <FontAwesomeIcon icon={currentStatusConfig.icon} />
              <span>{currentStatusConfig.label}</span>
              {isTalkmoreCampaign && status === 'nei' && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    opacity: 0.92,
                  }}
                  title={neiReasonLabel}
                >
                  · {neiReasonLabel}
                </span>
              )}
            </span>
          )}
        </div>

        {showCarrierBadge && (
          <div className="carrier-status-badge">
            <span className="carrier-badge-icon">📱</span>
            <span className="carrier-badge-text">Talkmore/Telenor</span>
          </div>
        )}

        <div className="apartment-status-indicator">
          {isUpdating ? (
            <FontAwesomeIcon icon={faSpinner} spin className="updating-spinner" />
          ) : is_visited ? (
            <FontAwesomeIcon 
              icon={faCircle} 
              className="status-dot visited"
              style={{ color: currentStatusConfig?.color || '#28a745' }}
            />
          ) : (
            <FontAwesomeIcon 
              icon={faCircle} 
              className="status-dot unvisited"
            />
          )}
        </div>
      </div>

      {!is_visited ? (
        <>
          <button 
            className="notes-toggle-btn"
            onClick={toggleNotes}
            type="button"
          >
            <FontAwesomeIcon icon={faStickyNote} />
            <span>{showNotes ? 'Skjul notat' : 'Legg til notat'}</span>
            <FontAwesomeIcon icon={showNotes ? faChevronUp : faChevronDown} className="toggle-icon" />
          </button>

          {showNotes && (
            <div className="notes-input-container" onClick={handleNotesClick}>
              <textarea
                className="notes-input"
                placeholder="Skriv notat her... (valgfritt)"
                value={notes}
                onChange={handleNotesChange}
                rows={2}
                maxLength={500}
              />
              <div className="notes-char-count">
                {notes.length}/500
              </div>
            </div>
          )}

          {isTalkmoreCampaign && showNeiSubcatStep ? (
            <div className="apartment-nei-subcat-wrap" onClick={(e) => e.stopPropagation()}>
              <NeiSubcategoryInlineStep
                disabled={isUpdating}
                confirmLabel="Registrer Nei"
                serverError={actionError}
                onBack={() => {
                  onClearRowError?.(id);
                  setShowNeiSubcatStep(false);
                }}
                onConfirm={async (sub) => {
                  if (!onStatusChange) return;
                  const res = await onStatusChange(
                    id,
                    'nei',
                    notes.trim() || null,
                    null,
                    sub
                  );
                  if (!res || res.success === false) return;
                  onClearRowError?.(id);
                  setNotes('');
                  setShowNotes(false);
                  setShowNeiSubcatStep(false);
                }}
              />
            </div>
          ) : (
          <div className="apartment-status-buttons">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <button
                key={key}
                className="status-btn"
                style={{ 
                  backgroundColor: config.color,
                  opacity: isUpdating ? 0.6 : 1 
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (key === 'nei' && isTalkmoreCampaign) {
                    onClearRowError?.(id);
                    setShowNeiSubcatStep(true);
                  } else {
                    handleStatusClick(e, key);
                  }
                }}
                disabled={isUpdating}
                title={config.label}
              >
                <FontAwesomeIcon icon={config.icon} />
                <span>{config.label}</span>
              </button>
            ))}
          </div>
          )}
        </>
      ) : (
        <div className="apartment-visited-actions">
          <div className="visited-info">
            <span className="visited-label">
              Besøkt
              {currentStatusConfig && (
                <span style={{ color: currentStatusConfig.color, marginLeft: '4px' }}>
                  ({currentStatusConfig.label}
                  {isTalkmoreCampaign && status === 'nei' && (
                    <span style={{ fontWeight: 600 }}>: {neiReasonLabel}</span>
                  )}
                  )
                </span>
              )}
            </span>
            {existingNotes && (
              <div className="existing-notes">
                <FontAwesomeIcon icon={faStickyNote} className="notes-icon" />
                <span className="notes-text">{existingNotes}</span>
              </div>
            )}
          </div>
          <button 
            className="reset-btn"
            onClick={handleReset}
            disabled={isUpdating}
            title="Tilbakestill status"
          >
            Endre
          </button>
        </div>
      )}
    </div>
  );
};

export default ApartmentListItem;
