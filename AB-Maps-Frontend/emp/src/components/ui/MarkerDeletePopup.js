import React, { useEffect, useState } from 'react';
import { Popup } from 'react-leaflet';
import L from 'leaflet';
import { getAddressMarkerById, deleteAddressMarker } from '../../services/apiService';

const MarkerDeletePopup = ({ marker, onDelete, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setDetails(null);
    if (marker && marker.id && marker.token) {
      getAddressMarkerById(marker.token, marker.id)
        .then(data => { if (isMounted) { setDetails(data); setLoading(false); } })
        .catch(err => { if (isMounted) { setError('Kunne ikke hente detaljene'); setLoading(false); } });
    } else {
      setLoading(false);
    }
    return () => { isMounted = false; };
  }, [marker]);

  // Helper to get the name of the person who placed the marker
  const getPlacerName = (details) => {
    if (!details) return '';
    if (details.employee && details.employee.name) return details.employee.name;
    if (details.manager && details.manager.name) return details.manager.name;
    return '';
  };

  const handleDelete = async (e) => {
    L.DomEvent.stopPropagation(e);
    if (!marker.id || !marker.token) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAddressMarker(marker.token, marker.id);
      if (onDelete) onDelete(marker.index, marker.id);
      if (onClose) onClose();
    } catch (err) {
      setError('Kunne ikke slette punktet');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Popup
      position={
        marker.position && marker.position.coordinates
          ? [marker.position.coordinates[1], marker.position.coordinates[0]]
          : marker.position
      }
      onClose={onClose}
    >
      <div className="marker-delete-popup">
        {loading ? (
          <p>Laster detaljer...</p>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : details ? (
          <>
            <p>
              <strong>Status:</strong> {details.status_display || details.status}
              <br />
              <strong>Adresse:</strong> {details.address_text}
              <br />
              <strong>Plassert av:</strong> {getPlacerName(details)}
            </p>
            <button
              className="delete-button"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Sletter...' : 'Slett Punkt'}
            </button>
          </>
        ) : (
          <p>Ingen detaljer funnet.</p>
        )}
      </div>
    </Popup>
  );
};

export default MarkerDeletePopup; 