import React, { useCallback } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import AddressPopup from '../ui/AddressPopup';
import './PlacementPopupAnchor.css';

const PlacementPopupAnchor = ({
  clickedInfo,
  onClose,
  onAddMarker,
  onOpenCampaignForm,
}) => {
  if (!clickedInfo?.position) {
    return null;
  }

  const { lat, lng } = clickedInfo.position;
  
  // Use a Leaflet Marker with invisible icon to anchor the popup
  
  // Memoize the event handlers to prevent infinite re-renders
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAddMarker = useCallback((marker) => {
    onAddMarker(marker);
    onClose();
  }, [onAddMarker, onClose]);
  return (
    <Marker
      position={[lat, lng]}
      opacity={0}
      pane="markerPane"
      zIndexOffset={1000}
      icon={L.divIcon({ 
        className: 'invisible-anchor', 
        html: '', 
        iconSize: [1, 1],
        iconAnchor: [0.5, 0.5]
      })}
    >
      <Popup
        autoPan={true}
        autoPanPadding={[50, 50]}
        closeButton={true}
        closeOnEscapeKey={true}
        closeOnClick={false}
        eventHandlers={{ remove: handleClose }}
        className="placement-popup"
        maxWidth={400}
        minWidth={300}
        pane="popupPane"
        zIndexOffset={1000}
        keepInView={true}
      >
        <AddressPopup
          position={clickedInfo.position}
          addresses={clickedInfo.addresses}
          onClose={handleClose}
          onAddMarker={handleAddMarker}
          onOpenCampaignForm={onOpenCampaignForm}
        />
      </Popup>
    </Marker>
  );
};

export default PlacementPopupAnchor; 