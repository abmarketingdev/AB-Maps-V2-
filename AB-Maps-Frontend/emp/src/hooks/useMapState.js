import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { faPlus, faEye, faBan, faCheck, faRedo } from '@fortawesome/free-solid-svg-icons';
import { saveData, loadData, addToSyncQueue, getSyncQueue, clearSyncQueue } from '../services/persistenceService';
import useAddressLookup from './useAddressLookup';
import { getAllAddressMarkers, createAddressMarker, deleteAddressMarker, getCampaignAreas } from '../services/apiService';
import addressService from '../services/addressService';
import locationService from '../services/locationService';
import { areaService } from '../services/areaService';
import { isPointInPolygon } from '../utils/addressUtils';
// NRC Campaign URL helper
import { isNRCCampaign, openNRCUrl } from '../utils/nrcUrlHelper';
// Phase 2: Import for Discovery Flow (Backend local-lookup API for apartment detection)
import { fetchLocalLookupForAddress, fetchGeonorgeForAddress } from '../services/apartmentService';
import buildingService from '../services/buildingService';
import { API_CONFIG } from '../config/apiConfig';
// Helper to fetch statuses for an address
const getAddressStatuses = async (token, addressId) => {
  // Use the same backend base as every other service (was hardcoded to a prod
  // Render URL, which silently pointed dev traffic at production).
  const base = API_CONFIG.backend.baseUrl || process.env.REACT_APP_API_BASE_URL || '';
  const url = `${base}/api/addresses/statuses/?address=${addressId}`;
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.results || [];
};
// Add import for creating status
// We'll use fetch directly for /api/addresses/statuses/ for now

/**
 * Custom hook for managing map state and interactions (Employee Interface)
 */
const useMapState = (token, employee, selectedAreaId, setToast, permissionStatus, setCampaignAreas, refreshTiles = null, setBuildingSummary = null, setTilesVersion = null) => {
  // Keep a ref to the latest token so data-fetching effects can read it
  // without re-triggering when the token refreshes.
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Map state - start with a fallback position, will be updated to user location when permission granted
  const [position, setPosition] = useState([59.9139, 10.7522]); // Fallback to Oslo, will be updated to user location
  const [clickedInfo, setClickedInfo] = useState(null);
  const [addressMarkers, setAddressMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const { lookupAddressAtPoint, isLoading: isAddressLoading } = useAddressLookup();
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false); // <-- Add loading state
  const [isGeonorgeLoading, setIsGeonorgeLoading] = useState(false); // Loading state for Geonorge apartment check
  
  // Uploaded addresses state
  const [uploadedAddresses, setUploadedAddresses] = useState([]);
  const [uploadedAddressesLoaded, setUploadedAddressesLoaded] = useState(false);
  
  // Location-based state for distance tracking
  const [userLocation, setUserLocation] = useState(null); // { lat, lon }
  const [lastFetchLocation, setLastFetchLocation] = useState(null); // Track last fetch location
  const [hasInitialLoad, setHasInitialLoad] = useState(false); // Track if we've done initial load
  const [popupCounter, setPopupCounter] = useState(0); // Counter to force popup re-render
  const [isClosingPopup, setIsClosingPopup] = useState(false); // Flag to prevent reopening during close
  
  // Locked areas state - areas created by other managers in the campaign
  const [lockedAreas, setLockedAreas] = useState([]);
  
  // Campaign form popup state
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignFormData, setCampaignFormData] = useState({
    campaignId: null,
    addressId: null,
    salesRepId: null,
    addressData: null
  });


  // Status options for address markers
  const statusOptions = [
    { value: 'ja', label: 'Ja', color: '#2ecc71', icon: faPlus },
    { value: 'ikke_hjemme', label: 'Ikke hjemme', color: '#f1c40f', icon: faEye },
    { value: 'nei', label: 'Nei', color: '#e74c3c', icon: faBan },
    { value: 'folg_opp', label: 'Følg opp', color: '#9b59b6', icon: faRedo },
  ];

  // Helper to convert uploaded addresses to marker objects
  const convertUploadedAddressesToMarkers = (uploadedAddresses) => {
    
    return uploadedAddresses.map(addr => {
      
      let lat = null;
      let lng = null;

      // Handle various coordinate formats
      if (addr.position?.coordinates?.length === 2) {
        [lng, lat] = addr.position.coordinates; // GeoJSON [lng, lat]
      } else if (addr.coordinates?.coordinates?.length === 2) {
        [lng, lat] = addr.coordinates.coordinates; // Nested GeoJSON [lng, lat]
      } else if (addr.coordinates?.length === 2) {
        [lat, lng] = addr.coordinates; // Flat [lat, lng]
      } else if (typeof addr.latitude === 'number' && typeof addr.longitude === 'number') {
        lat = addr.latitude;
        lng = addr.longitude;
      }

      if (lat === null || lng === null) {
        console.warn('Invalid or missing coordinates for uploaded address:', addr.address_text, addr);
        return null;
      }
      
      const marker = {
        address: addr.address_text,
        status: 'uploaded', // Special status for uploaded addresses
        position: { lat, lng },
        addressId: addr.id,
        managerId: addr.manager?.id || null,
        employeeId: addr.employee?.id || null,
        recordedAt: addr.added_at,
        user: addr.manager?.name || addr.employee?.name || 'Unknown',
        isUploadedAddress: true // Flag to identify uploaded addresses
      };
      
      return marker;
    }).filter(marker => marker !== null);
  };

  // Load uploaded addresses via Nearby API (second)
  const loadUploadedAddresses = useCallback(async () => {
    if (!token || !lastFetchLocation || !employee) {
      console.log('[loadUploadedAddresses] Missing requirements:', { token: !!token, lastFetchLocation: !!lastFetchLocation, employee: !!employee });
      return;
    }
    try {
      const lat = lastFetchLocation.lat;
      const lon = lastFetchLocation.lon;
      console.log('[loadUploadedAddresses] Fetching uploaded addresses for:', { lat, lon });
      const campaignRaw = localStorage.getItem('currentCampaign');
      const campaignId = campaignRaw ? ((campaignRaw.startsWith('{') || campaignRaw.startsWith('[')) ? JSON.parse(campaignRaw)?.id : campaignRaw) : null;
      setUploadedAddresses([]);
      setUploadedAddressesLoaded(false);
      const uploaded = await addressService.getNearbyUploadedAddresses(lat, lon, 8000, 2000, token, campaignId);
      // API may return either an array or an object with results
      const uploadedArray = Array.isArray(uploaded) ? uploaded : (uploaded?.results || []);
      console.log('[loadUploadedAddresses] Received uploaded addresses:', uploadedArray.length);
      const uploadedMarkers = convertUploadedAddressesToMarkers(uploadedArray);
      setUploadedAddresses(uploadedMarkers);
      setUploadedAddressesLoaded(true);
    } catch (error) {
      console.error('Error setting up uploaded addresses stream:', error);
      setUploadedAddressesLoaded(true);
    }
  }, [token, lastFetchLocation, employee]);

  // Load locked areas for the current campaign
  const loadLockedAreas = useCallback(async () => {
    if (!tokenRef.current || !employee) {
      console.log('[loadLockedAreas] Missing requirements:', { token: !!tokenRef.current, employee: !!employee });
      return;
    }
    
    try {
      const campaignRaw = localStorage.getItem('currentCampaign');
      const campaignId = campaignRaw ? 
        (campaignRaw.startsWith('{') || campaignRaw.startsWith('[') 
          ? JSON.parse(campaignRaw)?.id 
          : campaignRaw) 
        : null;
      
      if (campaignId) {
        console.log('🔒 [loadLockedAreas] Loading locked areas for campaign:', campaignId);
        const lockedAreasData = await areaService.getLockedAreas(campaignId);
        const areas = Array.isArray(lockedAreasData.locked_areas) 
          ? lockedAreasData.locked_areas 
          : [];
        setLockedAreas(areas);
        console.log(`✅ [loadLockedAreas] Loaded ${areas.length} locked areas`);
      } else {
        console.log('⚠️ [loadLockedAreas] No campaign ID, skipping locked areas load');
        setLockedAreas([]);
      }
    } catch (error) {
      console.error('❌ [loadLockedAreas] Failed to load locked areas:', error);
      setLockedAreas([]);
    }
  }, [employee]);

  // Load addresses via Nearby API (addresses first)
  const loadAddressMarkersFromNearby = useCallback(async () => {
    if (!token || !lastFetchLocation) {
      console.log('[loadAddressMarkersFromNearby] Missing requirements:', { token: !!token, lastFetchLocation: !!lastFetchLocation });
      return;
    }
    try {
      setAddressMarkers([]);
      const lat = lastFetchLocation.lat;
      const lon = lastFetchLocation.lon;
      console.log('[loadAddressMarkersFromNearby] Fetching addresses for:', { lat, lon });
      const campaignRaw = localStorage.getItem('currentCampaign');
      const campaignId = campaignRaw ? ((campaignRaw.startsWith('{') || campaignRaw.startsWith('[')) ? JSON.parse(campaignRaw)?.id : campaignRaw) : null;
      
      const addresses = await addressService.getNearbyAddresses(lat, lon, 8000, 2000, token, campaignId);
      const addressArray = Array.isArray(addresses) ? addresses : (addresses?.results || []);
      console.log('[loadAddressMarkersFromNearby] Received addresses:', addressArray.length);
      const addressMarkers = convertAddressesToMarkers(addressArray);
      setAddressMarkers(addressMarkers);
    } catch (error) {
      console.error('Error loading nearby address markers:', error);
      setToast({ visible: true, message: 'Failed to load nearby address markers', type: 'error' });
    }
  }, [token, lastFetchLocation]);

  // Helper to convert addresses to markers - Enhanced to handle various coordinate formats
  const convertAddressesToMarkers = (addresses) => {
    return addresses.map((addr) => {
      if (!addr) return null;

      let lat = null;
      let lng = null;

      // Handle various coordinate formats
      if (addr.position?.coordinates?.length === 2) {
        // GeoJSON format: [lng, lat]
        [lng, lat] = addr.position.coordinates;
      } else if (addr.coordinates?.coordinates?.length === 2) {
        // Nested GeoJSON format: coordinates.coordinates [lng, lat]
        [lng, lat] = addr.coordinates.coordinates;
      } else if (addr.coordinates?.length === 2) {
        // Flat coordinates format: [lat, lng]
        [lat, lng] = addr.coordinates;
      } else if (typeof addr.latitude === 'number' && typeof addr.longitude === 'number') {
        // Direct latitude/longitude properties
        lat = addr.latitude;
        lng = addr.longitude;
      } else if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
        // Direct lat/lng properties
        lat = addr.lat;
        lng = addr.lng;
      }

      if (lat === null || lng === null) {
        console.warn('Address missing valid coordinates:', addr);
        return null;
      }
      
      return {
        address: addr.address_text,
        status: addr.status,
        position: { lat, lng },
        addressId: addr.id,
        managerId: addr.manager?.id || null,
        employeeId: addr.employee?.id || null,
        recordedAt: addr.recorded_at,
        user: addr.manager?.name || addr.employee?.name || 'Unknown',
        nei_subcategory: addr.nei_subcategory ?? null,
        nei_subcategory_display: addr.nei_subcategory_display ?? null,
      };
    }).filter(marker => marker !== null);
  };

  // Distance calculation function (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Subscribe to location updates and trigger nearby loads only when significant movement
  useEffect(() => {
    const DISTANCE_THRESHOLD = 500; // 500 meters threshold
    
    const handleLoc = ({ location }) => {
      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        const newLocation = { lat: location.latitude, lon: location.longitude, accuracy: location.accuracy };
        
        // Always update current location for map centering
        setUserLocation(newLocation);
        
        // Update internal position state for "my location" marker only.
        // Do NOT change the map view automatically; user controls centering.
        setPosition([location.latitude, location.longitude]);
        
        // Only trigger fetch if it's initial load or user moved 500+ meters
        const shouldFetch = !hasInitialLoad || 
          !lastFetchLocation || 
          calculateDistance(lastFetchLocation.lat, lastFetchLocation.lon, newLocation.lat, newLocation.lon) > DISTANCE_THRESHOLD;
        
        if (shouldFetch) {
          setLastFetchLocation(newLocation);
          setHasInitialLoad(true);
        }
      }
    };
    
    const handlePermissionGranted = ({ location }) => {
      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        const newLocation = { lat: location.latitude, lon: location.longitude, accuracy: location.accuracy };
        setUserLocation(newLocation);
        
        // Only set lastFetchLocation if it's different from current location to prevent duplicate API calls
        const shouldFetch = !lastFetchLocation || 
          calculateDistance(lastFetchLocation.lat, lastFetchLocation.lon, newLocation.lat, newLocation.lon) > 50; // 50m threshold
        
        if (shouldFetch) {
          setLastFetchLocation(newLocation);
        }
        setHasInitialLoad(true);
        
        // Update map position to user's actual location on initial permission - this centers the map
        setPosition([location.latitude, location.longitude]);
        
        // Center the map view on user location if mapRef is available
        if (mapRef) {
          mapRef.flyTo([location.latitude, location.longitude], 16, { 
            animate: true, 
            duration: 1.5,
            easeLinearity: 0.25 
          });
        }
      }
    };
    
    locationService.on('location_updated', handleLoc);
    locationService.on('permission_granted', handlePermissionGranted);
    return () => {
      locationService.off('location_updated', handleLoc);
      locationService.off('permission_granted', handlePermissionGranted);
    };
  }, [hasInitialLoad, lastFetchLocation, mapRef]); // Add mapRef to dependencies

  // Handle initial location setup when component mounts
  useEffect(() => {
    // Check if we already have location permission and location
    const checkInitialLocation = async () => {
      try {
        const status = locationService.getStatus();
        if (status.permissionStatus === 'granted' && status.lastLocation) {
          const location = status.lastLocation;
          
          // VALIDATE: Check if coordinates are valid numbers
          if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number' ||
              isNaN(location.latitude) || isNaN(location.longitude)) {
            console.warn('useMapState: Invalid coordinates in lastLocation:', location);
            return;
          }
          
          const newLocation = { lat: location.latitude, lon: location.longitude, accuracy: location.accuracy };
          
          setUserLocation(newLocation);
          setLastFetchLocation(newLocation);
          setHasInitialLoad(true);
          setPosition([location.latitude, location.longitude]);
          
          // Center the map if mapRef is available and coordinates are valid
          if (mapRef && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
            try {
              mapRef.flyTo([location.latitude, location.longitude], 16, { 
                animate: true, 
                duration: 1.5,
                easeLinearity: 0.25 
              });
            } catch (flyError) {
              console.error('useMapState: Error flying to location:', flyError);
            }
          }
        } else {
          // No location permission granted - don't set any location or trigger API calls
          console.log('[useMapState] No location permission granted - not setting location or triggering API calls');
          setUserLocation(null);
          setLastFetchLocation(null);
          setHasInitialLoad(false);
        }
      } catch (error) {
        console.log('useMapState: No initial location available:', error.message);
        
        // No location permission granted - don't set any location or trigger API calls
        console.log('[useMapState] No location permission granted - not setting location or triggering API calls');
        setUserLocation(null);
        setLastFetchLocation(null);
        setHasInitialLoad(false);
      }
    };
    
    checkInitialLocation();
  }, [mapRef]); // Only run when mapRef changes

  // Only fetch data when lastFetchLocation changes (significant movement or initial load)
  // AND when location permission is granted.
  // NOTE: token is intentionally NOT in deps — token refreshes must not re-trigger
  // expensive campaign/area API calls. The API functions read the latest token from
  // localStorage via fetchWithAuthRefresh / getAccessToken().
  useEffect(() => {
    console.log('[useMapState] useEffect triggered for API calls:', { 
      lastFetchLocation: !!lastFetchLocation, 
      token: !!tokenRef.current,
      permissionStatus: permissionStatus,
      lastFetchLocationData: lastFetchLocation 
    });
    if (!lastFetchLocation || !tokenRef.current || permissionStatus !== 'granted') {
      console.log('[useMapState] Missing requirements for API calls - permission not granted or missing data');
      return;
    }
    (async () => {
      console.log('[useMapState] Starting API calls...');
      
      if (setCampaignAreas) {
        try {
          const { lat, lon } = lastFetchLocation;
          console.log('[useMapState] Loading nearby campaign areas...');
          const campaignAreas = await getCampaignAreas(null, lat, lon);
          console.log('[useMapState] Received campaign areas:', campaignAreas.length);
          setCampaignAreas(campaignAreas);
        } catch (error) {
          console.error('Error loading campaign areas:', error);
          setCampaignAreas([]);
        }
      }
      
      await loadLockedAreas();
    })();
  }, [lastFetchLocation, permissionStatus, loadLockedAreas]);

  // Handler for map clicks
  const handleMapClick = async (latlng) => {
    // CRITICAL: Validate latlng before proceeding
    if (!latlng) {
      console.warn('handleMapClick: latlng is null or undefined');
      return;
    }
    
    // Validate and normalize latlng to ensure it's a proper Leaflet LatLng object
    let validLatLng = null;
    try {
      if (latlng instanceof L.LatLng) {
        validLatLng = latlng;
      } else if (latlng.lat !== undefined && latlng.lng !== undefined) {
        const lat = typeof latlng.lat === 'number' ? latlng.lat : parseFloat(latlng.lat);
        const lng = typeof latlng.lng === 'number' ? latlng.lng : parseFloat(latlng.lng);
        
        if (isNaN(lat) || isNaN(lng)) {
          console.warn('handleMapClick: Invalid lat/lng values', latlng);
          return;
        }
        
        validLatLng = L.latLng(lat, lng);
      } else if (Array.isArray(latlng) && latlng.length >= 2) {
        const lat = typeof latlng[0] === 'number' ? latlng[0] : parseFloat(latlng[0]);
        const lng = typeof latlng[1] === 'number' ? latlng[1] : parseFloat(latlng[1]);
        
        if (isNaN(lat) || isNaN(lng)) {
          console.warn('handleMapClick: Invalid array values', latlng);
          return;
        }
        
        validLatLng = L.latLng(lat, lng);
      } else {
        console.warn('handleMapClick: Invalid latlng format', latlng);
        return;
      }
    } catch (error) {
      console.error('handleMapClick: Error converting latlng', error, latlng);
      return;
    }
    
    // Check if click is inside ANY locked area - prevent address popup
    const isInsideLockedArea = Array.isArray(lockedAreas) && 
      lockedAreas.length > 0 &&
      lockedAreas.some(lockedArea => {
        const geometry = lockedArea?.polygon_geometry;
        if (!geometry || !geometry.coordinates) return false;
        
        const point = [validLatLng.lat, validLatLng.lng];
        
        // Handle MultiPolygon geometry
        if (geometry.type === 'MultiPolygon') {
          // MultiPolygon: [[[[lng, lat], [lng, lat], ...]]]
          // Check if point is inside any of the polygons in the MultiPolygon
          return geometry.coordinates.some(polygonRing => {
            const ring = polygonRing[0]; // First ring of each polygon
            if (!Array.isArray(ring) || ring.length < 3) return false;
            
            // Convert GeoJSON coordinates [lng, lat] to [lat, lng] format
            const polygonCoords = ring.map(([lng, lat]) => [lat, lng]);
            return isPointInPolygon(point, polygonCoords);
          });
        } else {
          // Handle regular Polygon geometry
          const ring = geometry.coordinates[0];
          if (!Array.isArray(ring) || ring.length < 3) return false;
          
          // Convert GeoJSON coordinates [lng, lat] to [lat, lng] format
          const polygonCoords = ring.map(([lng, lat]) => [lat, lng]);
          return isPointInPolygon(point, polygonCoords);
        }
      });
    
    // If click is inside a locked area, don't open address popup
    if (isInsideLockedArea) {
      console.log('🚫 [useMapState] Map click blocked: inside locked area');
      return; // Early return - no popup, no address lookup
    }
    
    // ENHANCED: Check if we're in the process of closing a popup
    if (isClosingPopup) {
      console.log('🚫 Map click blocked: popup is closing');
      return;
    }
    
    // ENHANCED: Check if we have any popup open - if so, ignore map clicks
    if (clickedInfo || selectedMarker) {
      console.log('🚫 Map click blocked: popup already open', { clickedInfo: !!clickedInfo, selectedMarker: !!selectedMarker });
      return;
    }
    
    console.log('✅ Map click allowed: opening FloatingAddressPopup at', validLatLng);
    
    // Clear any focus that might interfere with subsequent interactions
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    } catch (e) {
      // Ignore focus-related errors
    }
    
    // REMOVED: Competing setTimeout that was causing race conditions
    // The defensive clearing was interfering with popup opening
    // State is managed by individual popup close handlers instead

    // ENHANCED: Guard: don't open popup if click originated from UI controls, clusters, or if we're closing a popup
    try {
      const orig = (latlng && latlng.originalEvent && latlng.originalEvent.target) || null;
      let el = orig;
      while (el) {
        if (el.classList && (
          el.classList.contains('leaflet-control') ||
          el.classList.contains('map-ui-control') ||
          el.classList.contains('uploaded-address-icon') ||
          // Removed: regular-address-cluster and uploaded-address-cluster class checks - no longer used with vector tiles
          el.classList.contains('floating-uploaded-address-popup') || // ENHANCED: Prevent map clicks when popup is open
          el.classList.contains('floating-address-popup') // ENHANCED: Prevent map clicks when address popup is open
        )) {
          return; // ignore UI clicks
        }
        el = el.parentElement;
      }
    } catch {}

    // Reset first to ensure no stale popup data persists
    setClickedInfo(null);
    // Immediately show popup with a loading message (use validated latlng)
    setClickedInfo({ position: validLatLng, addresses: ['Henter adresse...'] });

    try {
      const addresses = await lookupAddressAtPoint(validLatLng);
      const finalAddresses = addresses.length > 0 ? addresses : ['Fant ingen adresse'];
      const primaryAddress = finalAddresses[0];
      
      // PHASE 2: Discovery Flow - Check for apartments
      // Only attempt building discovery if we have a valid address and setBuildingSummary is available
      if (setBuildingSummary && primaryAddress && 
          primaryAddress !== 'Fant ingen adresse' && 
          !primaryAddress.startsWith('Koordinater:') &&
          primaryAddress !== 'Kunne ikke hente adresse') {
        try {
          console.log('🏢 [useMapState] Discovery Flow: Checking for apartments at:', primaryAddress);
          
          // Update popup with actual address BEFORE local lookup check so loading indicator shows
          setClickedInfo({ position: validLatLng, addresses: finalAddresses });
          
          // Show loading state while checking for apartments
          setIsGeonorgeLoading(true);
          
          // Get campaign ID and employee ID for the API call
          const campaignRaw = localStorage.getItem('currentCampaign');
          const campaignId = campaignRaw ? 
            ((campaignRaw.startsWith('{') || campaignRaw.startsWith('[')) 
              ? JSON.parse(campaignRaw)?.id 
              : campaignRaw) 
            : null;
          
          const createdById = employee?.id || null;
          
          // Call backend local-lookup API
          const lookupResult = await fetchLocalLookupForAddress(primaryAddress, {
            campaignId,
            createdById
          });
          
          if (lookupResult && lookupResult.units && lookupResult.units.length > 0) {
            console.log('🏢 [useMapState] Found apartments:', lookupResult.units.length);
            
            // Create building via bulk-create API
            // IMPORTANT: Use user's click position (validLatLng) instead of API response position
            const buildingData = {
              base_address: primaryAddress,
              apartment_numbers: lookupResult.units,
              campaign_id: campaignId,
              position: {
                lat: validLatLng.lat,  // Use user's click position
                lon: validLatLng.lng  // Use user's click position
              },
              // Send the knocker's live GPS so the backend's 150 m guard can reject a building
              // placed from far away (the address popup still shows on rejection).
              ...(userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number'
                ? { user_location: { lat: userLocation.lat, lng: userLocation.lon, accuracy: userLocation.accuracy } }
                : {})
            };
            
            try {
              const result = await buildingService.bulkCreateApartments(buildingData);
              console.log('✅ [useMapState] Building created:', result);
              
              // Clear the loading popup
              setClickedInfo(null);
              
              // Show BuildingSummaryCard
              setBuildingSummary({
                isOpen: true,
                buildingId: result.building_id,
                address: primaryAddress,
                totalUnits: result.total || lookupResult.units.length,
                visitedUnits: 0,
                markerColor: 'grey',
                position: validLatLng
              });
              
              // Refresh tiles so grey marker appears
              if (setTilesVersion) {
                setTilesVersion(v => v + 1);
              } else if (refreshTiles) {
                refreshTiles(validLatLng, 'add');
              }
              
              setIsGeonorgeLoading(false);
              return; // Exit early - don't show FloatingAddressPopup
            } catch (buildingError) {
              console.error('❌ [useMapState] Failed to create building:', buildingError);
              setIsGeonorgeLoading(false);
              // Fall through to show normal address popup
            }
          } else {
            console.log('🏠 [useMapState] No apartments found from local-lookup - showing Geonorge fallback option');
            setIsGeonorgeLoading(false);
            // Set flag to show Geonorge fallback button in FloatingAddressPopup
            setClickedInfo({ 
              position: validLatLng, 
              addresses: finalAddresses,
              showGeonorgeFallback: true, // Flag to show Geonorge button
              primaryAddress: primaryAddress // Store for Geonorge call
            });
            return; // Exit early to show popup with Geonorge button
          }
        } catch (lookupError) {
          console.log('⚠️ [useMapState] Local lookup check failed, continuing with house flow:', lookupError.message);
          setIsGeonorgeLoading(false);
          // Fall through to show normal address popup
        }
      }
      
      // No apartments found or building creation failed - show normal address popup
      setClickedInfo({ position: validLatLng, addresses: finalAddresses });
    } catch (err) {
      console.error('Error looking up address:', err);
      setClickedInfo({ position: validLatLng, addresses: ['Kunne ikke hente adresse'] });
    }
  };

  const showToast = (message, type = 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: '', type: '' });
    }, 5000);
  };

  // Handler for Geonorge fallback when local-lookup returns 0 apartments
  const handleGeonorgeFallback = useCallback(async (address, position) => {
    console.log('🔵 [useMapState] handleGeonorgeFallback called:', { address, position, hasSetBuildingSummary: !!setBuildingSummary });
    
    if (!setBuildingSummary || !address || !position) {
      console.warn('[useMapState] Cannot handle Geonorge fallback: missing required params', {
        hasSetBuildingSummary: !!setBuildingSummary,
        hasAddress: !!address,
        hasPosition: !!position
      });
      return;
    }

    // Normalize position to ensure it has lat/lng
    let normalizedPosition = position;
    if (position.lat === undefined || position.lng === undefined) {
      // Handle Leaflet LatLng or array format
      if (Array.isArray(position) && position.length >= 2) {
        normalizedPosition = { lat: position[0], lng: position[1] };
      } else if (position.lat !== undefined && position.lng !== undefined) {
        // Already correct format
        normalizedPosition = position;
      } else {
        console.error('❌ [useMapState] Invalid position format in handleGeonorgeFallback:', position);
        return;
      }
    }

    try {
      console.log('🏢 [useMapState] Geonorge fallback: Checking for apartments at:', address, 'with position:', normalizedPosition);
      
      setIsGeonorgeLoading(true);
      
      // Call Geonorge API
      const geonorgeResult = await fetchGeonorgeForAddress(address);
      
      if (geonorgeResult && geonorgeResult.units && geonorgeResult.units.length > 0) {
        console.log('🏢 [useMapState] Geonorge found apartments:', geonorgeResult.units.length);
        
        // Get campaign ID
        const campaignRaw = localStorage.getItem('currentCampaign');
        const campaignId = campaignRaw ? 
          ((campaignRaw.startsWith('{') || campaignRaw.startsWith('[')) 
            ? JSON.parse(campaignRaw)?.id 
            : campaignRaw) 
          : null;
        
        // Create building via bulk-create API
        const buildingData = {
          base_address: address,
          apartment_numbers: geonorgeResult.units,
          campaign_id: campaignId,
          position: {
            lat: normalizedPosition.lat,
            lon: normalizedPosition.lng
          },
          // Send the knocker's live GPS so the backend's 150 m guard can reject a building
          // placed from far away (the address popup still shows on rejection).
          ...(userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number'
            ? { user_location: { lat: userLocation.lat, lng: userLocation.lon, accuracy: userLocation.accuracy } }
            : {})
        };
        
        try {
          const result = await buildingService.bulkCreateApartments(buildingData);
          console.log('✅ [useMapState] Building created from Geonorge:', result);
          
          // Clear the popup
          setClickedInfo(null);
          
          // Show BuildingSummaryCard
          setBuildingSummary({
            isOpen: true,
            buildingId: result.building_id,
            address: address,
            totalUnits: result.total || geonorgeResult.units.length,
            visitedUnits: 0,
            markerColor: 'grey',
            position: normalizedPosition
          });
          
          // Refresh tiles so grey marker appears
          if (setTilesVersion) {
            setTilesVersion(v => v + 1);
          } else if (refreshTiles) {
            refreshTiles(position, 'add');
          }
          
          setIsGeonorgeLoading(false);
          showToast(`Fant ${geonorgeResult.units.length} leiligheter via Geonorge`, 'success');
        } catch (buildingError) {
          console.error('❌ [useMapState] Failed to create building from Geonorge:', buildingError);
          setIsGeonorgeLoading(false);
          showToast('Kunne ikke opprette bygning fra Geonorge-data', 'error');
        }
      } else {
        console.log('🏠 [useMapState] Geonorge also found no apartments');
        setIsGeonorgeLoading(false);
        showToast('Ingen leiligheter funnet via Geonorge', 'info');
        // Keep popup open for user to select status
      }
    } catch (geonorgeError) {
      console.error('⚠️ [useMapState] Geonorge fallback failed:', geonorgeError);
      setIsGeonorgeLoading(false);
      
      // Provide more specific error message for 502 errors
      let errorMessage = 'Kunne ikke sjekke Geonorge';
      if (geonorgeError.message && geonorgeError.message.includes('502')) {
        errorMessage = 'Geonorge API er midlertidig utilgjengelig (502). Prøv igjen om et øyeblikk.';
      } else if (geonorgeError.message) {
        errorMessage = `Geonorge feil: ${geonorgeError.message}`;
      }
      
      showToast(errorMessage, 'error');
    }
  }, [setBuildingSummary, setTilesVersion, refreshTiles, setClickedInfo, showToast, setIsGeonorgeLoading]);

  // NOTE: Old apartment lookup handlers (fetchApartmentsForAddress, handleOpenApartmentPopup, 
  // handleSelectApartment, handleCloseApartmentPopup) removed in Phase 4 cleanup.
  // Buildings with apartments now use BuildingSummaryCard + ApartmentListDrawer.

  // Handle status selection for an address
  const handleStatusSelect = async (e, addressText, status, neiSubcategory = undefined) => {
    
    if (e) { e.stopPropagation?.(); e.preventDefault?.(); }
    if (!clickedInfo || !token || !employee) {
      return { success: false, error: 'Kan ikke lagre akkurat nå.' };
    }
    // REMOVED: Area selection is now optional - users can place markers without selecting an area
    // if (!selectedAreaId) {
    //   console.log('❌ No area selected, showing toast');
    //   showToast('You must select an area before placing a sale.', 'error');
    //   return;
    // }
    if (isStatusSubmitting) {
      return { success: false, error: 'Lagring pågår.' };
    }
    setIsStatusSubmitting(true);
    
    // Get campaign ID from localStorage (needed for both NRC check and marker creation)
    const getCampaignId = () => {
      const campaignData = localStorage.getItem('currentCampaign');
      
      if (campaignData) {
        // Check if it's a UUID (campaign ID) or JSON object
        if (campaignData.startsWith('{') || campaignData.startsWith('[')) {
          try {
            const campaign = JSON.parse(campaignData);
            return campaign.id;
          } catch (error) {
            console.error('useMapState: Error parsing campaign JSON data:', error);
            return null;
          }
        } else {
          // It's a direct campaign ID (UUID)
          return campaignData;
        }
      }
      return null;
    };
    
    const campaignId = getCampaignId();
    
    // 🔑 NRC CAMPAIGN: Open URL IMMEDIATELY (before any await) to avoid popup blocker
    // Browser blocks window.open() if called after async operations
    if (status === 'ja' && isNRCCampaign()) {
      console.log('[useMapState] NRC campaign detected, opening external URL BEFORE async operations');
      openNRCUrl(addressText);
    }
    
    try {
      // 1. Create address marker with status, employee info, and area_id (optional)
      // Status is already in the correct format (ja, ikke_hjemme, nei) from the button click
      const backendStatus = status; // No mapping needed, status is already correct
      
      // NOTE: Phase 4 cleanup - apartment selection removed. 
      // Buildings with apartments now use BuildingSummaryCard + ApartmentListDrawer.
      // This popup is only for simple house addresses.
      
      const markerPayload = {
        address_text: addressText,
        status: backendStatus,
        position: {
          type: 'Point',
          coordinates: [clickedInfo.position.lng, clickedInfo.position.lat]
        },
        tags: { 
          source: 'map_click', 
          timestamp: new Date().toISOString(),
          marker_type: 'house'  // Mark as house for vector tiles
        },
        employee_id: employee.id,
        area_id: selectedAreaId || null,
        campaign_id: campaignId,
      };
      if (backendStatus === 'nei' && neiSubcategory !== undefined) {
        markerPayload.nei_subcategory = neiSubcategory;
      }
      // GPS proximity guard: send the knocker's live location so the backend can verify the
      // door is within 150 m (else it rejects with 400 too_far, handled below).
      if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number') {
        markerPayload.user_location = {
          lat: userLocation.lat, lng: userLocation.lon, accuracy: userLocation.accuracy,
        };
      }
      const createdMarker = await createAddressMarker(token, markerPayload);
      
      // Ensure the marker has the correct position structure for the map
      const formattedMarker = {
        ...createdMarker,
        id: createdMarker.id, // Ensure ID is present
        addressId: createdMarker.id, // Also set addressId for compatibility
        position: {
          lat: clickedInfo.position.lat,
          lng: clickedInfo.position.lng
        },
        address: createdMarker.address_text || addressText,
        status: createdMarker.status || backendStatus,
        nei_subcategory: createdMarker.nei_subcategory ?? null,
        nei_subcategory_display: createdMarker.nei_subcategory_display ?? null,
      };
      
      setAddressMarkers(prev => {
        const newMarkers = [...prev, formattedMarker];
        return newMarkers;
      });
      
      // 🔑 Refresh tiles to show the new marker immediately
      // Backend auto-invalidates Redis cache, we just trigger Leaflet redraw
      // Pass marker position for targeted tile refresh
      if (refreshTiles) {
        refreshTiles(clickedInfo.position, 'add');  // 'add' operation for fast targeted refresh
        console.log('✅ [useMapState] Tiles refreshed after marker placement (targeted refresh)');
      }
      
      setToast({ visible: true, message: 'Marker added!', type: 'success' });
      
      // If status is "ja", handle campaign form (NRC already opened above before await)
      if (status === 'ja' && campaignId && !isNRCCampaign()) {
        // Other campaigns (not NRC) - open campaign form
        const addressData = {
          address_text: addressText,
          postnummer: '',
          posted: ''
        };
        // Small delay to ensure address is saved before opening form
        setTimeout(() => {
          openCampaignForm(campaignId, createdMarker?.id, employee?.id, addressData);
        }, 500);
      }
      
      // Always close the popup after status selection
      setClickedInfo(null);
      
      return { success: true };
    } catch (err) {
      console.error('❌ Failed to add marker:', err);
      const msg = err?.message || 'Failed to add marker';
      setToast({ visible: true, message: msg, type: 'error' });
      return { success: false, error: msg };
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  // Handle marker deletion
  const handleDeleteMarker = async (marker) => {
    console.log('🗑️ [useMapState] Deleting marker:', marker?.id || marker?.addressId);
    
    if (!token || !employee) return;
    
    const markerId = marker?.id || marker?.addressId;
    if (!markerId) {
      console.error('No marker ID found for deletion');
      return;
    }
    
    try {
      // Call the delete API first
      await deleteAddressMarker(token, markerId);
      
      // If API call is successful, remove marker from state instantly
      setAddressMarkers(prev => prev.filter(m => (m.id || m.addressId) !== markerId));
      console.log('🔄 Clearing selectedMarker after successful deletion');
      setSelectedMarker(null);
      
      // ENHANCED: Force clear with timeout to ensure state is cleared
      setTimeout(() => {
        setSelectedMarker(null);
        console.log('🔄 Force cleared selectedMarker after deletion');
      }, 50);
      
      // 🔑 Refresh tiles to remove the deleted marker from the map
      // Backend auto-invalidates Redis cache, we just trigger Leaflet redraw
      // Pass marker position for targeted tile refresh
      if (refreshTiles) {
        refreshTiles(marker?.position, 'delete');  // 'delete' operation for layer re-mount
        console.log('✅ [useMapState] Tiles refreshed after marker deletion');
      }
      
      setToast({ visible: true, message: 'Marker deleted!', type: 'success' });
      
      // Auto-dismiss success toast after 3 seconds
      setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3000);
    } catch (err) {
      console.error('Error deleting marker:', err);
      
      // Check for specific error types
      if (err.message && err.message.includes('403')) {
        setToast({ visible: true, message: 'Kan ikke slette adresser plassert av andre', type: 'error' });
        // Auto-dismiss error toast after 3 seconds
        setTimeout(() => {
          setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
      } else if (err.message && err.message.includes('401')) {
        setToast({ visible: true, message: 'Du må logge inn på nytt', type: 'error' });
        // Auto-dismiss error toast after 3 seconds
        setTimeout(() => {
          setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
      } else {
        setToast({ visible: true, message: 'Kunne ikke slette punktet', type: 'error' });
        // Auto-dismiss error toast after 3 seconds
        setTimeout(() => {
          setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
      }
      
      // ENHANCED: Clear selectedMarker even on error to allow new map clicks
      console.log('🔄 Clearing selectedMarker after deletion error');
      setSelectedMarker(null);
      
      // ENHANCED: Force clear with timeout to ensure state is cleared
      setTimeout(() => {
        setSelectedMarker(null);
        console.log('🔄 Force cleared selectedMarker after deletion error');
      }, 50);
    }
  };

  // Get marker icon based on status
  // Get marker icon for uploaded addresses (blue circle with cross)
  const getUploadedAddressIcon = () => {
    return L.divIcon({
      className: 'icon-style-map uploaded-address-icon',
      html: `<div style="background-color: #3498db; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; border: 2px solid #2980b9;">
              <i class="fas fa-times" style="font-size: 12px;"></i>
            </div>`,
      iconSize: [24, 24]
    });
  };

  const getMarkerIcon = (status) => {
    // Special handling for uploaded addresses
    if (status === 'uploaded') {
      return getUploadedAddressIcon();
    }

    let color = '#3498db'; // default blue
    let iconName = 'check'; // default icon

    switch (status) {
      case 'ja':
        color = '#2ecc71';
        iconName = 'plus';
        break;
      case 'ikke_hjemme':
        color = '#f1c40f';
        iconName = 'eye';
        break;
      case 'nei':
        color = '#e74c3c';
        iconName = 'ban';
        break;
      // Keep backward compatibility for old uppercase values
      case 'Ja':
        color = '#2ecc71';
        iconName = 'plus';
        break;
      case 'Ikke hjemme':
        color = '#f1c40f';
        iconName = 'eye';
        break;
      case 'Nei':
        color = '#e74c3c';
        iconName = 'ban';
        break;
    }

    return L.divIcon({
      className: 'icon-style-map',
      html: `<div style="background-color: ${color}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white;">
              <i class="fas fa-${iconName}"></i>
            </div>`,
      iconSize: [24, 24]
    });
  };

  // Handle marker clicks including uploaded addresses
  const handleMarkerClick = async (marker, index) => {
    // Increment popup counter to force re-render
    setPopupCounter(prev => prev + 1);
    
    // ENHANCED: Handle null marker case (clearing)
    if (!marker) {
      console.log('🔄 Clearing selectedMarker via handleMarkerClick');
      setSelectedMarker(null);
      return;
    }
    
    // ENHANCED: Direct marker setting without setTimeout to prevent race conditions
    // The setTimeout was causing timing issues with popup opening/closing
    const processMarkerClick = async () => {
      // Check if this is an uploaded address marker
      if (marker?.isUploadedAddress && marker?.addressId) {
        try {
          console.log('🔄 Fetching uploaded address data for popup...');
          const addressData = await addressService.getUploadedAddress(marker.addressId, token);
          
          // Set the uploaded address data for the popup
          const updatedMarker = { 
            ...marker, 
            index,
            uploadedAddressData: addressData,
            isUploadedAddress: true,
            id: marker.addressId,
            token
          };
          console.log('✅ Setting uploaded address marker for popup');
          setSelectedMarker(updatedMarker);
        } catch (error) {
          console.error('[Click] Error fetching uploaded address details:', error);
          // Fall back to regular marker handling
          let markerId = marker?.id;
          if (!markerId && marker?.addressId) markerId = marker.addressId;
          setSelectedMarker({ ...marker, index, id: markerId, token });
        }
      } else {
        // Regular marker handling
        console.log('✅ Setting regular address marker for popup');
        let markerId = marker?.id;
        if (!markerId && marker?.addressId) markerId = marker.addressId;
        setSelectedMarker({ ...marker, index, id: markerId, token });
      }
    };
    
    processMarkerClick();
  };

  // Robust function to close uploaded address popup
  const closeUploadedAddressPopup = () => {
    console.log('🔄 closeUploadedAddressPopup called');
    
    // ENHANCED: Set closing flag to prevent any re-opening during this process
    setIsClosingPopup(true);
    
    // ENHANCED: Clear all popup states to prevent interference
    setSelectedMarker(null);
    setClickedInfo(null);
    
    // Clear any potential focus or state issues
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    } catch (error) {
      // Ignore focus-related errors
    }
    
    // ENHANCED: Reset closing flag after a brief delay
    setTimeout(() => {
      setIsClosingPopup(false);
      console.log('✅ closeUploadedAddressPopup completed');
    }, 100);
  };

  // ENHANCED: Function to close address popup with better isolation
  const closeAddressPopup = () => {
    console.log('🔄 closeAddressPopup called');
    
    // ENHANCED: Clear all popup states to prevent interference
    setClickedInfo(null);
    setSelectedMarker(null);
    
    // Blur focus to avoid key events triggering reopen
    try { 
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur(); 
      } 
    } catch (error) {
      // Ignore focus-related errors
    }
    
    console.log('✅ closeAddressPopup completed');
  };

  // Campaign form handlers
  const openCampaignForm = (campaignId, addressId, salesRepId, addressData = null) => {
    setCampaignFormData({
      campaignId,
      addressId,
      salesRepId,
      addressData
    });
    setShowCampaignForm(true);
  };
  
  const closeCampaignForm = () => {
    setShowCampaignForm(false);
    setCampaignFormData({
      campaignId: null,
      addressId: null,
      salesRepId: null,
      addressData: null
    });
  };

  const applyAddressMarkerUpdate = useCallback((updated) => {
    if (!updated?.id) return;
    const id = updated.id;
    const patch = {
      status: updated.status,
      nei_subcategory: updated.nei_subcategory ?? null,
      nei_subcategory_display: updated.nei_subcategory_display ?? null,
    };
    setAddressMarkers((prev) =>
      prev.map((m) =>
        (m.addressId || m.id) === id ? { ...m, ...patch } : m
      )
    );
    setSelectedMarker((prev) =>
      prev && (prev.addressId || prev.id) === id ? { ...prev, ...patch } : prev
    );
  }, []);

  return {
    // State
    position,
    clickedInfo,
    addressMarkers,
    uploadedAddresses,
    selectedMarker,
    mapRef,
    statusOptions,
    isStatusSubmitting,
    isGeonorgeLoading,
    lockedAreas,
    // Campaign form state
    showCampaignForm,
    campaignFormData,
    
    // Setters
    setMapRef,
    setClickedInfo,
    setPosition,
    
    // Handlers
    handleMapClick,
    handleStatusSelect,
    getMarkerIcon,
    handleMarkerClick,
    handleDeleteMarker,
    showToast,
    closeAddressPopup,
    closeUploadedAddressPopup,
    popupCounter,
    isClosingPopup,
    // Campaign form handlers
    openCampaignForm,
    closeCampaignForm,
    // Geonorge fallback handler
    handleGeonorgeFallback,
    applyAddressMarkerUpdate,
    // NOTE: Old apartment handlers (handleOpenApartmentPopup, handleSelectApartment, 
    // handleCloseApartmentPopup) removed in Phase 4 cleanup.
  };
};

export default useMapState;
