import React from 'react';
import './TalkmoreAddressPopup.css';

/**
 * TalkmoreAddressPopup Component
 * 
 * Displays detailed address information for enriched addresses.
 * Note: Markers are non-interactive, so this component may be used
 * for displaying details in a modal or separate panel.
 * 
 * @param {Object} addressData - Address details object
 * @param {Function} onClose - Callback when popup is closed
 */
const TalkmoreAddressPopup = ({ addressData, onClose }) => {
  if (!addressData) {
    return null;
  }

  const {
    address_text,
    address_uuid,
    carrier_summary = {},
    people = [],
    position,
    status
  } = addressData;

  return (
    <div className="talkmore-address-popup-overlay" onClick={onClose}>
      <div 
        className="talkmore-address-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="talkmore-address-popup-header">
          <h3 className="talkmore-address-popup-title">Adressedetaljer</h3>
          <button 
            className="talkmore-address-popup-close"
            onClick={onClose}
            aria-label="Lukk"
          >
            ×
          </button>
        </div>

        <div className="talkmore-address-popup-content">
          {/* Address Text */}
          <div className="talkmore-address-section">
            <label className="talkmore-address-label">Adresse:</label>
            <p className="talkmore-address-text">{address_text || 'Ukjent adresse'}</p>
          </div>

          {/* Status */}
          {status && (
            <div className="talkmore-address-section">
              <label className="talkmore-address-label">Status:</label>
              <span className={`talkmore-address-status talkmore-address-status-${status}`}>
                {status}
              </span>
            </div>
          )}

          {/* Position */}
          {position && position.coordinates && (
            <div className="talkmore-address-section">
              <label className="talkmore-address-label">Koordinater:</label>
              <p className="talkmore-address-coordinates">
                {position.coordinates[1].toFixed(6)}, {position.coordinates[0].toFixed(6)}
              </p>
            </div>
          )}

          {/* Carrier Summary */}
          {Object.keys(carrier_summary).length > 0 && (
            <div className="talkmore-address-section">
              <label className="talkmore-address-label">Operatører:</label>
              <div className="talkmore-address-carriers">
                {Object.entries(carrier_summary).map(([carrier, count]) => (
                  <div key={carrier} className="talkmore-address-carrier-item">
                    <span className="talkmore-address-carrier-name">{carrier}</span>
                    <span className="talkmore-address-carrier-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People List */}
          {people && people.length > 0 && (
            <div className="talkmore-address-section">
              <label className="talkmore-address-label">
                Personer ({people.length}):
              </label>
              <div className="talkmore-address-people">
                {people.map((person, index) => (
                  <div key={index} className="talkmore-address-person">
                    <div className="talkmore-address-person-name">
                      {person.name || 'Ukjent navn'}
                    </div>
                    <div className="talkmore-address-person-details">
                      {person.phone_e164 && (
                        <span className="talkmore-address-person-phone">
                          📞 {person.phone_e164}
                        </span>
                      )}
                      {person.carrier && (
                        <span className="talkmore-address-person-carrier">
                          {person.carrier}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UUID (for debugging) */}
          {address_uuid && (
            <div className="talkmore-address-section talkmore-address-uuid">
              <label className="talkmore-address-label">UUID:</label>
              <p className="talkmore-address-uuid-value">{address_uuid}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalkmoreAddressPopup;
