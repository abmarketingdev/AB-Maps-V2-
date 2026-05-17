import React from 'react';
import { Popup } from 'react-leaflet';
import L from 'leaflet';
import { useAddress } from '../../hooks/useAddresses';

const MarkerDeletePopup = ({ marker, onDelete, onClose, canDelete }) => {
  const popupEventHandlers = {
    add: (e) => {
      const container = e.target.getElement();
      if (container) {
        // This is the key: stop all clicks inside this popup from propagating to the map
        L.DomEvent.disableClickPropagation(container);
      }
    },
  };

  // Fetch address details using the addressId from marker
  const { address, loading, error } = useAddress(marker.addressId);

  return (
    <Popup
      position={marker.position}
      onClose={onClose}
      eventHandlers={popupEventHandlers}
    >
      <div className="marker-delete-popup">
        {loading && <p>Laster adresse...</p>}
        {error && <p style={{ color: '#e74c3c' }}>Kunne ikke hente adresse</p>}
        {address && (
          <div>
            <p>
              <strong>Status:</strong> {address.status_display || address.status}
              <br />
              <strong>Adresse:</strong> {address.address_text}
              <br />
              <strong>Bruker:</strong> {address.manager?.name || address.employee?.name || 'Ukjent'}
            </p>
          </div>
        )}
        {!loading && !address && !error && (
          <p>Ingen adresseinformasjon tilgjengelig</p>
        )}
        {canDelete ? (
          <button
            className="delete-button"
            onClick={(e) => {
              L.DomEvent.stopPropagation(e);
              onDelete(marker); // Pass the full marker object
            }}
          >
            Slett Punkt
          </button>
        ) : (
          <p style={{ 
            color: '#e74c3c', 
            fontSize: '12px', 
            fontStyle: 'italic',
            margin: '8px 0',
            textAlign: 'center'
          }}>
            Du kan kun slette dine egne punkter
          </p>
        )}
      </div>
    </Popup>
  );
};

export default MarkerDeletePopup; 