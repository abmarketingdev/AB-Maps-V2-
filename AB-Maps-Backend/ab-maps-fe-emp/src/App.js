import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';

// Components
import MapController from './components/map/MapController';
import MapEvents from './components/map/MapEvents';
import AddressPopup from './components/ui/AddressPopup';
import LoadingIndicator from './components/ui/LoadingIndicator';
import Toast from './components/ui/Toast';
import MarkerDeletePopup from './components/ui/MarkerDeletePopup';
import EmployeeToolbar from './components/ui/EmployeeToolbar';
import AnimatedSearchBar from './components/ui/AnimatedSearchBar';
import LocationStatus from './components/ui/LocationStatus';
import CampaignSelector from './components/ui/CampaignSelector';
import CampaignFormPopup from './components/ui/CampaignFormPopup';

// Hooks
import useMapState from './hooks/useMapState';

// Services
import { searchAddress, getEmployeeProfile, getTeamAssignedAreas, getCampaignAreas } from './services/apiService';
import locationService from './services/locationService';

// Styles
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [assignedAreas, setAssignedAreas] = useState([]);
  const [campaignAreas, setCampaignAreas] = useState([]);
  const [token, setToken] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [locationInitialized, setLocationInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('prompt');
  const [showAreaPin, setShowAreaPin] = useState(false);
  const [areaPinPosition, setAreaPinPosition] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // Remove dummy employee and area data

  // On mount, clear area_id to force re-selection on refresh
  useEffect(() => {
    localStorage.removeItem('area_id');
  }, []);

  // On mount, check for area_id in localStorage
  useEffect(() => {
    const storedAreaId = localStorage.getItem('area_id');
    if (storedAreaId) {
      setSelectedAreaId(Number(storedAreaId));
    }
  }, []);

  useEffect(() => {
    setPermissionStatus('prompt');
    setLocationInitialized(false);
    // Extract tokens and campaign_id from URL or localStorage
    const params = new URLSearchParams(window.location.search);
    let accessToken = params.get('accessToken') || params.get('token');
    let refreshToken = params.get('refreshToken');
    let campaignId = params.get('campaign_id');
    
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    } else {
      accessToken = localStorage.getItem('accessToken');
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      refreshToken = localStorage.getItem('refreshToken');
    }
    
    // Set campaign_id in localStorage if provided in URL
    if (campaignId) {
      localStorage.setItem('currentCampaign', campaignId);
      console.log('Campaign ID set from URL:', campaignId);
    } else {
      // Check if campaign_id exists in localStorage
      const existingCampaign = localStorage.getItem('currentCampaign');
      if (!existingCampaign) {
        console.warn('No campaign ID available - some features may not work properly');
        setToast({ visible: true, message: 'No campaign selected. Some features may be limited.', type: 'warning' });
      } else {
        console.log('Using existing campaign ID from localStorage:', existingCampaign);
      }
    }
    
    setToken(accessToken);
    if (!accessToken) {
      setToast({ visible: true, message: 'Ingen token funnet i URL eller localStorage. Logg inn på nytt.', type: 'error' });
      return;
    }
    getEmployeeProfile(accessToken)
      .then(profile => {
        const employeeData = profile.employee || profile;
        setEmployee(employeeData);
      })
      .catch(async err => {
        let errorMsg = 'Kunne ikke hente profil. Prøv å logge inn på nytt.';
        if (err && err.message) errorMsg += ` [${err.message}]`;
        if (err && err.response) {
          try {
            const body = await err.response.text();
            console.error('Profile fetch error response body:', body);
          } catch (e) {}
        }
        setToast({ visible: true, message: errorMsg, type: 'error' });
      });
    getTeamAssignedAreas(accessToken)
      .then(areas => {
        console.log('Assigned areas received:', areas);
        setAssignedAreas(areas);
      })
      .catch(err => {
        console.error('Failed to fetch assigned areas:', err);
        // Set empty array on error to prevent undefined state
        setAssignedAreas([]);
      });
    getCampaignAreas(accessToken)
      .then(areas => setCampaignAreas(areas))
      .catch(err => {
        console.error('Failed to fetch campaign areas:', err);
        // Fallback to empty array if campaign areas fail
        setCampaignAreas([]);
      });
  }, []);

  // Cleanup location service on component unmount
  useEffect(() => {
    return () => {
      if (locationInitialized) {
        locationService.destroy();
      }
    };
  }, [locationInitialized]);

  // Show pin for 5 seconds when selectedAreaId changes
  useEffect(() => {
    if (!selectedAreaId || !campaignAreas) return;
    // Find the selected area
    const selectedArea = campaignAreas.find(a => a.id === selectedAreaId);
    if (!selectedArea || !selectedArea.polygon_geometry || !selectedArea.polygon_geometry.coordinates || !selectedArea.polygon_geometry.coordinates[0]) return;
    // Calculate centroid of the first polygon ring
    const coords = selectedArea.polygon_geometry.coordinates[0];
    if (!coords || coords.length === 0) return;
    let sumLat = 0, sumLng = 0;
    coords.forEach(([lng, lat]) => {
      sumLat += lat;
      sumLng += lng;
    });
    const n = coords.length;
    const centroid = { lat: sumLat / n, lng: sumLng / n };
    setAreaPinPosition(centroid);
    setShowAreaPin(true);
    const timer = setTimeout(() => setShowAreaPin(false), 5000);
    return () => clearTimeout(timer);
  }, [selectedAreaId, campaignAreas]);

  // Custom colored pin icon
  const areaPinIcon = L.divIcon({
    className: 'area-pin-icon',
    html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="12" rx="10" ry="10" fill="#1976d2"/>
      <path d="M14 36C14 36 26 22.5 14 22.5C2 22.5 14 36 14 36Z" fill="#1976d2"/>
      <circle cx="14" cy="12" r="5" fill="white"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36]
  });

  const handleRequestPermission = async () => {
    if (!employee || !token) return;
    try {
      // Step 1: Request location permission
      await locationService.requestLocationPermission();
      setPermissionStatus('granted');
      
      // Step 2: Initialize location service
      await locationService.initialize(token, employee);
      
      // Step 3: Initialize WebSocket connection
      try {
        await locationService.initializeWebSocket();
      } catch (wsError) {
        console.error('WebSocket connection failed:', wsError);
        // Don't fail completely if WebSocket fails, just show a warning
        setToast({ visible: true, message: 'Location tracking started (offline mode)', type: 'warning' });
      }
      
      // Step 4: Start tracking
      await locationService.startTracking();
      setLocationInitialized(true);
      
      // Show success message
      const message = locationService.getStatus().isOnline 
        ? 'Location access granted! Tracking started.' 
        : 'Location access granted! Tracking started (offline mode).';
      setToast({ visible: true, message, type: 'success' });
      
    } catch (error) {
      console.error('Location permission request failed:', error);
      
      // Check if it's a permission error or something else
      if (error.message && error.message.includes('Permission denied')) {
        setPermissionStatus('denied');
        setToast({ visible: true, message: 'Location access denied by browser', type: 'error' });
      } else {
        // Keep permission as granted if it was actually granted
        setPermissionStatus('granted');
        setToast({ visible: true, message: `Location setup failed: ${error.message}`, type: 'error' });
      }
    }
  };

  const {
    position,
    clickedInfo,
    addressMarkers,
    selectedMarker,
    mapRef,
    statusOptions,
    setMapRef,
    handleMapClick,
    handleStatusSelect,
    getMarkerIcon,
    handleMarkerClick,
    showToast,
    setClickedInfo,
    handleDeleteMarker,
    isStatusSubmitting,
    // Campaign form state
    showCampaignForm,
    campaignFormData,
    openCampaignForm,
    closeCampaignForm,
  } = useMapState(token, employee, selectedAreaId);

  const handleAreaSelect = (area) => {
    const areaId = area?.properties?.id ?? area?.id;
    setSelectedAreaId(areaId);
    localStorage.setItem('area_id', areaId);
    if (mapRef && area.geometry && area.geometry.coordinates && area.geometry.coordinates[0] && area.geometry.coordinates[0].length > 0) {
      const latlngs = area.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
      const bounds = L.latLngBounds(latlngs);
      mapRef.flyToBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true, duration: 1.5 });
    }
    showToast(`Selected area: ${area?.properties?.name ?? area?.name}`, 'info');
  };

  const handleSearch = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const results = await searchAddress(query);
    setSearchResults(results);
    setSearching(false);
  };

  const handleSuggestionClick = (result) => {
    if (mapRef) {
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      mapRef.flyTo([lat, lng], 17, { animate: true, duration: 1.5 });
      setClickedInfo({
        position: { lat, lng },
        addresses: [result.display_name]
      });
      setSearchResults([]);
    }
  };

  const handleCampaignSelect = (campaign) => {
    setSelectedCampaign(campaign);
    // Refresh areas when campaign changes
    if (token) {
      getCampaignAreas(token)
        .then(areas => setCampaignAreas(areas))
        .catch(err => {
          console.error('Failed to fetch campaign areas:', err);
          setCampaignAreas([]);
        });
    }
  };

  // Show toast to select area after location is granted and initialized, and no area is selected
  useEffect(() => {
    if (permissionStatus === 'granted' && locationInitialized && !selectedAreaId) {
      setToast({ visible: true, message: 'Velg et område for å komme i gang.', type: 'info' });
    }
  }, [permissionStatus, locationInitialized, selectedAreaId]);

  // Dismiss toast when area is selected
  useEffect(() => {
    if (selectedAreaId && toast.visible && toast.message === 'Velg et område for å komme i gang.') {
      setToast({ visible: false, message: '', type: '' });
    }
  }, [selectedAreaId]);

  // Only show map/tracking UI if permission granted and initialized
  // Only enforce area selection after these conditions
  return (
    <div className="app-container">
      {isLoading && <LoadingIndicator fullScreen={true} />}
      <Toast toast={toast} />
      <LocationStatus 
        locationService={locationService} 
        permissionStatus={permissionStatus}
        onRequestPermission={handleRequestPermission}
      />
      {permissionStatus === 'granted' && locationInitialized && (
        <>
          <div style={{ position: 'absolute', top: 98, left: 12, zIndex: 1200 }}>
            <AnimatedSearchBar
              onSearch={handleSearch}
              suggestions={searchResults}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
          
          {/* Campaign Selector - Hidden but functional for campaign management */}
          <div style={{ position: 'absolute', top: -1000, left: -1000, zIndex: -1 }}>
            <CampaignSelector
              token={token}
              employee={employee}
              onCampaignSelect={handleCampaignSelect}
              selectedCampaign={selectedCampaign}
            />
          </div>
          
          <EmployeeToolbar 
            employee={employee}
            assignedAreas={assignedAreas}
            allAreas={campaignAreas}
            onAreaSelect={handleAreaSelect}
            selectedAreaId={selectedAreaId}
            selectedCampaign={selectedCampaign}
          />
          <MapContainer
            center={position}
            zoom={13}
            maxZoom={18}
            maxZoomAnimation={true}
            fadeAnimation={true}
            markerZoomAnimation={true}
            style={{ height: '100vh', width: '100%' }}
            ref={setMapRef}
            updateWhenZooming={false}
            updateWhenIdle={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={18}
              maxNativeZoom={18}
              tileSize={256}
              zoomOffset={0}
            />
            <MapController onMapReady={setMapRef} />
            <MapEvents onMapClick={handleMapClick} />
            {campaignAreas && campaignAreas.length > 0 && campaignAreas.map((area) => {
              const isAssigned = assignedAreas.some(a => a.id === area.id);
              // Check if area has valid polygon geometry
              if (!area.polygon_geometry || !area.polygon_geometry.coordinates || !area.polygon_geometry.coordinates[0]) {
                console.warn('Area missing polygon geometry:', area);
                return null;
              }
              return (
                <Polygon
                  key={area.id}
                  positions={area.polygon_geometry.coordinates[0].map(([lng, lat]) => [lat, lng])}
                  pathOptions={{
                    color: area.color,
                    fillColor: area.color,
                    fillOpacity: isAssigned ? 0.5 : 0.15,
                    weight: isAssigned ? 4 : 2,
                  }}
                />
              );
            })}
            {/* Show area pin marker for 5 seconds when area is selected */}
            {showAreaPin && areaPinPosition && (
              <Marker position={[areaPinPosition.lat, areaPinPosition.lng]} icon={areaPinIcon} />
            )}
            <MarkerClusterGroup
              iconCreateFunction={(cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                  html: `<div style='background:#2C3E50;color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow:0 2px 8px rgba(44,62,80,0.18);'>${count}</div>`,
                  className: 'custom-cluster-icon',
                  iconSize: [40, 40],
                });
              }}
            >
              {addressMarkers && addressMarkers.length > 0 && addressMarkers.map((marker, index) => {
                // Check if marker has valid position coordinates
                if (!marker.position || !marker.position.coordinates || marker.position.coordinates.length < 2) {
                  console.warn('Marker missing position coordinates:', marker);
                  return null;
                }
                return (
                  <Marker
                    key={marker.id || index}
                    position={[marker.position.coordinates[1], marker.position.coordinates[0]]}
                    icon={getMarkerIcon(marker.status)}
                    eventHandlers={{
                      click: () => handleMarkerClick(marker, index),
                    }}
                  >
                    <Popup>
                      <div>
                        <strong>{marker.address_text}</strong>
                        <br />
                        <span>{marker.status || ''}</span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
            {clickedInfo && (
              <AddressPopup 
                position={clickedInfo.position}
                addresses={clickedInfo.addresses}
                statusOptions={statusOptions}
                onStatusSelect={handleStatusSelect}
                isStatusSubmitting={isStatusSubmitting}
              />
            )}
            {selectedMarker && (
              <MarkerDeletePopup
                marker={selectedMarker}
                onDelete={(index, id) => handleDeleteMarker(index, id)}
                onClose={() => handleMarkerClick(null)}
              />
            )}
          </MapContainer>
        </>
      )}

      {/* Campaign Form Popup */}
      <CampaignFormPopup
        isOpen={showCampaignForm}
        onClose={closeCampaignForm}
        campaignId={campaignFormData.campaignId}
        addressId={campaignFormData.addressId}
        salesRepId={campaignFormData.salesRepId}
        addressData={campaignFormData.addressData}
        token={token}
      />
    </div>
  );
}

export default App;