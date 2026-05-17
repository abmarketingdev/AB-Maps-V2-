import React from 'react';
import { Popup } from 'react-leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * Component for displaying address information and status selection buttons
 */
const AddressPopup = ({ position, addresses, statusOptions, onStatusSelect, isStatusSubmitting }) => {
  if (!position || !addresses || addresses.length === 0) return null;

  const isLoading = addresses[0] === 'Henter adresse...';
  const isError = addresses[0] === 'Kunne ikke hente adresse' || addresses[0] === 'Fant ingen adresse';

  return (
    <Popup position={position}>
      <div className="address-popup">
        <div className="address-list">
          {addresses.map((address, index) => (
            <div key={index} className="address-item">
              <p>{address}</p>
              {!isLoading && !isError && (
                <div className="status-buttons">
                  {statusOptions.map((option, i) => (
                    <button
                      key={i}
                      className="status-button"
                      style={{ backgroundColor: option.color, opacity: isStatusSubmitting ? 0.6 : 1 }}
                      onClick={(e) => {
                        console.log('Status button clicked:', option.label);
                        onStatusSelect(e, address, option.label);
                      }}
                      title={option.label}
                      disabled={isStatusSubmitting}
                    >
                      <FontAwesomeIcon icon={option.icon} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                  {isStatusSubmitting && (
                    <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
                      <span className="spinner" style={{ width: 18, height: 18, border: '2px solid #fff', borderTop: '2px solid #2b2d42', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Popup>
  );
};

export default AddressPopup;
