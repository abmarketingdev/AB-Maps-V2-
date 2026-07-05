import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { faPlus, faEye, faBan, faCheck } from '@fortawesome/free-solid-svg-icons';
import * as turf from '@turf/turf';
// OLD: External API imports - COMMENTED OUT
// import { getAddressesInPolygon, searchAddress } from '../services/apiService';
import { searchAddress } from '../services/apiService';
import { isPointInPolygon } from '../utils/addressUtils';
import useAddressLookup from './useAddressLookup';
import { areaService } from '../services/areaService';
import { useAuth } from '../contexts/AuthContext';
import addressService from '../services/addressService';
// NEW: Backend polygon operations service
import polygonOperationsService from '../services/polygonOperationsService';
import authService from '../services/authService';
import locationService from '../services/locationService';
import { VectorTileFeatureFlag } from '../config/featureFlags';
import { API_CONFIG } from '../config/apiConfig';
import { forceViewportTileRefresh, smartViewportRefresh } from '../utils/viewportTileRefresh';
// OLD: External API imports for apartment calculations - COMMENTED OUT
// import { calculateApartmentCounts, getTotalApartmentCount } from '../utils/apartmentCountCalculator';
// Phase 2: Import for Discovery Flow (Backend local-lookup API for apartment detection)
import { fetchLocalLookupForAddress, fetchGeonorgeForAddress } from '../services/apartmentService';
import buildingService from '../services/buildingService';
// Phase 3: Import date utility functions
import { formatDateToISO, formatISOToLocal, validateDateRange } from '../utils/dateUtils';

/**
 * Custom hook for managing map state and interactions
 */
const useMapState = (suppressNextMapClick, shouldSuppressMapClick, additionalParams = {}) => {
  // Extract additional parameters for viewport refresh and Phase 2 Discovery Flow
  const { 
    setTilesVersion = null,
    setBuildingSummary = null,  // Phase 2: For building discovery flow
    // Delete mode parameters (Superuser polygon deletion)
    isDeleteMode = false,
    onDeleteModePolygonComplete = null,
    // Phase 4: Enrichment job tracking callback
    onEnrichmentJobCreated = null
  } = additionalParams;
  // Map state
  const [position] = useState([59.9139, 10.7522]); // Oslo center
  const [clickedInfo, setClickedInfo] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [isGeonorgeLoading, setIsGeonorgeLoading] = useState(false); // Loading state for Geonorge apartment check
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [areas, setAreas] = useState([]);
  const [currentArea, setCurrentArea] = useState([]);
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [editingAreaIndex, setEditingAreaIndex] = useState(null);
  const [previewLine, setPreviewLine] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [currentAreaData, setCurrentAreaData] = useState({
    title: '',
    color: '#2b2d42',
    houseCount: 0,
    endDate: null  // NEW: Add endDate field
  });
  
  // Memoize currentAreaData to prevent unnecessary re-renders
  const memoizedCurrentAreaData = useMemo(() => currentAreaData, [
    currentAreaData.title,
    currentAreaData.color,
    currentAreaData.houseCount,
    currentAreaData.isDraft,
    currentAreaData.endDate  // NEW: Include endDate in memoization
  ]);

  const searchTimeoutRef = useRef(null);
  const { lookupAddressAtPoint, isLoading: isAddressLoading } = useAddressLookup();
  const [markersLoaded, setMarkersLoaded] = useState(false);
  const [uploadedAddressesLoaded, setUploadedAddressesLoaded] = useState(false);
  const [uploadedAddresses, setUploadedAddresses] = useState([]);
  const [draftAreas, setDraftAreas] = useState([]); // For areas not yet saved to backend
  const [assignedAreas, setAssignedAreas] = useState([]); // Areas assigned to current manager
  const [lockedAreas, setLockedAreas] = useState([]); // Locked areas from campaign
  const [showOverlapToolbar, setShowOverlapToolbar] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // { lat, lon }
  const [lastFetchLocation, setLastFetchLocation] = useState(null); // Track last fetch location
  const [hasInitialLoad, setHasInitialLoad] = useState(false); // Track if we've done initial load
  const [popupCounter, setPopupCounter] = useState(0); // Counter to force popup re-render
  const [isFetchingAreas, setIsFetchingAreas] = useState(false); // Loading state for fetching areas
  
  // Movement mode state
  const [isMovementMode, setIsMovementMode] = useState(false);
  
  // Campaign form popup state
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignFormData, setCampaignFormData] = useState({
    campaignId: null,
    addressId: null,
    salesRepId: null,
    addressData: null
  });

  // AssignEmployeesModal state
  const [showAssignEmployeesModal, setShowAssignEmployeesModal] = useState(false);
  const [assignEmployeesModalData, setAssignEmployeesModalData] = useState({
    areaId: null,
    areaName: ''
  });

  // Movement mode handlers
  const toggleMovementMode = useCallback((onCleanup) => {
    setIsMovementMode(prev => {
      const newMode = !prev;
      
      // When enabling movement mode, run cleanup function if provided
      if (newMode && typeof onCleanup === 'function') {
        onCleanup();
      }
      
      return newMode;
    });
  }, []);

  const setMovementMode = useCallback((enabled, onCleanup) => {
    setIsMovementMode(enabled);
    
    if (enabled && typeof onCleanup === 'function') {
      onCleanup();
    }
  }, []);

  // Get authenticated user from context
  const { user: currentUser } = useAuth();

  // Status options for address markers
  const statusOptions = [
    { label: 'Ja', color: '#2ecc71', icon: faPlus },
    { label: 'Ikke hjemme', color: '#f1c40f', icon: faEye },
    { label: 'Nei', color: '#e74c3c', icon: faBan },
  ];

  /**
   * Helper function to convert address statuses to markers
   */
  const convertAddressStatusesToMarkers = (addressStatuses) => {
    return addressStatuses.map(status => {
      const address = status.address;
      if (!address) return null;
      
      let position = null;
      if (status.position && status.position.coordinates) {
        position = {
          lat: status.position.coordinates[1],
          lng: status.position.coordinates[0]
        };
      } else if (address.position && address.position.coordinates) {
        position = {
          lat: address.position.coordinates[1],
          lng: address.position.coordinates[0]
        };
      }
      
      if (!position) return null;
      
      return {
        address: address.address_text,
        status: status.status,
        position: position,
        addressId: address.id,
        statusId: status.id,
        managerId: status.manager?.id || null,
        employeeId: status.employee?.id || null,
        recordedAt: status.recorded_at,
        user: status.user_name || 'Unknown'
      };
    }).filter(marker => marker !== null);
  };

  // Areas will be loaded after location permission is granted (see loadAreasData function)

  // Helper to convert address objects to marker objects
  const convertAddressesToMarkers = (addresses) => {
    const markers = addresses.map((addr, index) => {
      if (!addr) {
        return null;
      }

      let lat = null;
      let lng = null;

      // Handle multiple coordinate formats to match your API response
      if (addr.coordinates?.coordinates && Array.isArray(addr.coordinates.coordinates) && addr.coordinates.coordinates.length === 2) {
        // Your API format: coordinates: {type: "Point", coordinates: [lng, lat]}
        lng = addr.coordinates.coordinates[0];
        lat = addr.coordinates.coordinates[1];
      } else if (addr.position?.coordinates && Array.isArray(addr.position.coordinates) && addr.position.coordinates.length === 2) {
        // Alternative format: position.coordinates [lng, lat]
        lng = addr.position.coordinates[0];
        lat = addr.position.coordinates[1];
      } else if (typeof addr.latitude === 'number' && typeof addr.longitude === 'number') {
        // Direct lat/lng properties (your API has these)
        lat = addr.latitude;
        lng = addr.longitude;
      } else if (Array.isArray(addr.coordinates) && addr.coordinates.length === 2) {
        // Flat array format [lat, lng]
        lat = addr.coordinates[0];
        lng = addr.coordinates[1];
      }

      if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }

      const marker = {
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

      return marker;
    }).filter(marker => marker !== null);

    return markers;
  };

  // Helper to convert uploaded addresses to marker objects (robust to shapes)
  const convertUploadedAddressesToMarkers = (uploadedAddresses) => {
    return (uploadedAddresses || []).map(addr => {
      // Try multiple coordinate shapes
      let lat = null;
      let lng = null;
      
      // Shape A: GeoJSON-like object at addr.position.coordinates => [lng, lat]
      if (addr?.position?.coordinates && Array.isArray(addr.position.coordinates) && addr.position.coordinates.length === 2) {
        lng = addr.position.coordinates[0];
        lat = addr.position.coordinates[1];
      }
      // Shape B: Nested geometry-like addr.coordinates.coordinates => [lng, lat]
      else if (addr?.coordinates?.coordinates && Array.isArray(addr.coordinates.coordinates) && addr.coordinates.coordinates.length === 2) {
        lng = addr.coordinates.coordinates[0];
        lat = addr.coordinates.coordinates[1];
      }
      // Shape C: Flat array addr.coordinates => [lat, lon] (legacy uploaded format)
      else if (Array.isArray(addr?.coordinates) && addr.coordinates.length === 2) {
        lat = addr.coordinates[0];
        lng = addr.coordinates[1];
      }
      // Shape D: Separate fields
      else if (typeof addr?.latitude === 'number' && typeof addr?.longitude === 'number') {
        lat = addr.latitude;
        lng = addr.longitude;
      }

      if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }

      return {
        address: addr.address_text || addr.text || 'Unknown address',
        status: 'uploaded',
        position: { lat, lng },
        addressId: addr.id,
        managerId: addr.manager?.id || null,
        employeeId: null,
        recordedAt: addr.added_at || addr.created_at || null,
        user: addr.manager?.name || 'Unknown',
        isUploadedAddress: true
      };
    }).filter(Boolean);
  };

  // Areas will be loaded after location permission is granted (see loadAreasData function)

  // Load areas data (both assigned areas and nearby areas)
  const loadAreasData = useCallback(async () => {
    if (!currentUser || !lastFetchLocation) return;
    
    const { lat, lon } = lastFetchLocation;
    
    try {
      // Load assigned areas (my_areas)
      const myAreas = await areaService.getManagerAreas();
      setAssignedAreas(Array.isArray(myAreas) ? myAreas : []);
    } catch (error) {
      setAssignedAreas([]);
    }

    try {
      // Load nearby areas (replaces getAllAreas)
      const areasData = await areaService.getNearbyAreas(lat, lon);
      setAreas(areasData);
    } catch (error) {
      // Fallback to getAllAreas() if nearby API fails
      try {
        const fallbackAreasData = await areaService.getAllAreas();
        setAreas(fallbackAreasData);
      } catch (fallbackError) {
        // Silently fail fallback
      }
    }

    // Load locked areas for the current campaign
    try {
      const campaignId = authService.getCampaignId();
      if (campaignId) {
        const lockedAreasData = await areaService.getLockedAreas(campaignId);
        const areas = Array.isArray(lockedAreasData.locked_areas) ? lockedAreasData.locked_areas : [];
        setLockedAreas(areas);
      } else {
        setLockedAreas([]);
      }
    } catch (error) {
      setLockedAreas([]);
    }
  }, [currentUser, lastFetchLocation]);

  // Note: Nearby fetching is driven by granted geolocation updates only



  // Load markers via Nearby API (addresses first) - DISABLED when vector tiles enabled
  const loadMarkersFromBackend = useCallback(async () => {
    // Skip if vector tiles are enabled - they handle address loading
    const useVectorTiles = VectorTileFeatureFlag.isEnabled();
    if (useVectorTiles) {
      setMarkers([]);
      setMarkersLoaded(true);
      return;
    }
    
    if (!currentUser || !lastFetchLocation) return;
    try {
      setMarkers([]);
      setMarkersLoaded(false);
      const lat = lastFetchLocation.lat;
      const lon = lastFetchLocation.lon;
      const campaignId = authService.getCampaignId();
      const addresses = await addressService.getNearbyAddresses(lat, lon, 8000, 2000, campaignId);
      const markersFromBackend = convertAddressesToMarkers(addresses);
      setMarkers(markersFromBackend);
      setMarkersLoaded(true);
    } catch (error) {
      showToast('Failed to load nearby markers', 'error');
      setMarkersLoaded(true);
    }
  }, [currentUser, lastFetchLocation]);

  // Load uploaded addresses via Nearby API (second) - DISABLED when vector tiles enabled
  const loadUploadedAddresses = useCallback(async () => {
    // Skip if vector tiles are enabled - they handle uploaded address loading
    const useVectorTiles = VectorTileFeatureFlag.isEnabled();
    if (useVectorTiles) {
      setUploadedAddresses([]);
      return;
    }
    
    if (!currentUser || !lastFetchLocation) return;
    try {
      const lat = lastFetchLocation.lat;
      const lon = lastFetchLocation.lon;
      const campaignId = authService.getCampaignId();
      setUploadedAddresses([]);
      setUploadedAddressesLoaded(false);
      const uploaded = await addressService.getNearbyUploadedAddresses(lat, lon, 8000, 2000, campaignId);
      // API may return either an array or an object with results
      const uploadedArray = Array.isArray(uploaded) ? uploaded : (uploaded?.results || []);
      const uploadedMarkers = convertUploadedAddressesToMarkers(uploadedArray);
      setUploadedAddresses(uploadedMarkers);
      setUploadedAddressesLoaded(true);
    } catch (error) {
      setUploadedAddressesLoaded(true);
    }
  }, [currentUser, lastFetchLocation]);

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
          setLastFetchLocation(newLocation);
          setHasInitialLoad(true);
        }
      };
    
    locationService.on('location_updated', handleLoc);
    locationService.on('permission_granted', handlePermissionGranted);
    return () => {
      locationService.off('location_updated', handleLoc);
      locationService.off('permission_granted', handlePermissionGranted);
    };
  }, [hasInitialLoad, lastFetchLocation]);

  // Only fetch data when lastFetchLocation changes (significant movement or initial load)
  useEffect(() => {
    if (!lastFetchLocation || !currentUser) return;
    
    // Skip nearby API calls if vector tiles are enabled
    const useVectorTiles = VectorTileFeatureFlag.isEnabled();
    
    // Load areas first, then addresses and uploaded addresses (only if vector tiles disabled)
    (async () => {
      try {
        await loadAreasData();
      } catch (error) {
        // Silently handle error
      }
      
      if (!useVectorTiles) {
        await loadMarkersFromBackend();
        await loadUploadedAddresses();
      } else {
      }
    })();
  }, [lastFetchLocation, currentUser, loadAreasData, loadMarkersFromBackend, loadUploadedAddresses]);

  // Debug markers changes (no longer persisting to IndexedDB)
  useEffect(() => {
    // Markers updated
  }, [markers, markersLoaded]);

  // Handler for map clicks
  const handleMapClick = async (latlng) => {
    // DEBUG: Log the current state for troubleshooting
    console.log('🗺️ [useMapState.handleMapClick] Called with:', {
      isDrawingEnabled,
      isDeleteMode,
      hasClickedInfo: !!clickedInfo,
      hasSelectedMarker: !!selectedMarker,
      latlng: latlng ? { lat: latlng.lat, lng: latlng.lng } : null
    });

    // Check if popup is open - ignore clicks when popup is visible
    if (clickedInfo || selectedMarker) {
      console.log('🛑 [useMapState.handleMapClick] Blocked - popup already open');
      return;
    }
    
    // Check guard first - ignore synthetic clicks after feature/close
    if (typeof shouldSuppressMapClick === 'function' && shouldSuppressMapClick()) {
      console.log('🛑 [useMapState.handleMapClick] Blocked - suppressed by guard');
      return;
    }
    
    // DEFENSIVE: Always close other popups when map is clicked
    setSelectedMarker(null);
    setSelectedArea(null);
    // Don't clear clickedInfo here - we'll set it below for new clicks
    
    // Clear any focus that might interfere with subsequent interactions
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    } catch (e) {
      // Ignore focus-related errors
    }
    
    // Additional defensive clearing with timeout
    setTimeout(() => {
      setSelectedMarker(null);
    }, 0);

    // Process map clicks for drawing mode OR delete mode
    // CRITICAL: Both isDrawingEnabled AND isDeleteMode should trigger drawing behavior
    if (isDrawingEnabled || isDeleteMode) {
      console.log('✏️ [useMapState.handleMapClick] Entering drawing/delete mode branch');
      
      // Check if user is closing the polygon by clicking the first point
      if (currentArea.length >= 3 && mapRef) {
        const firstPoint = mapRef.latLngToContainerPoint(currentArea[0]);
        const clickedPoint = mapRef.latLngToContainerPoint(latlng);
        const distance = firstPoint.distanceTo(clickedPoint);
        
        if (distance < 30) { // slightly more forgiving snap threshold
          finishDrawing();
          return;
        }
      }
      
      // Fallback: if we have 3+ points and no mapRef, allow manual completion
      if (currentArea.length >= 3 && !mapRef) {
        // Check if click is very close to first point using lat/lng distance
        const firstPoint = currentArea[0];
        const latDiff = Math.abs(firstPoint.lat - latlng.lat);
        const lngDiff = Math.abs(firstPoint.lng - latlng.lng);
        const distanceInDegrees = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        
        if (distanceInDegrees < 0.001) { // Roughly 100 meters
          finishDrawing();
          return;
        }
      }

      const newArea = [...currentArea, latlng];
      setCurrentArea(newArea);
      console.log('✏️ [useMapState.handleMapClick] Added point to polygon:', newArea.length, 'points');
    } else {
      // SAFETY CHECK: Double-check we're not in delete mode
      // This should never happen, but just in case there's a race condition
      if (isDeleteMode) {
        console.warn('⚠️ [useMapState.handleMapClick] In else branch but isDeleteMode is true - this should not happen!');
        return;
      }
      
      console.log('📍 [useMapState.handleMapClick] Normal click - will open popup');
      
      // Guard: don't open popup if click originated from UI controls or clusters
      try {
        const orig = (latlng && latlng.originalEvent && latlng.originalEvent.target) || null;
        let el = orig;
        while (el) {
          if (el.classList && (
            el.classList.contains('leaflet-control') ||
            el.classList.contains('map-ui-control') ||
            el.classList.contains('uploaded-address-icon') ||
            el.classList.contains('regular-address-cluster') ||
            el.classList.contains('uploaded-address-cluster')
          )) {
            return; // ignore UI clicks
          }
          el = el.parentElement;
        }
      } catch {}

      // Check if click is inside ANY locked area - prevent address popup
      const isInsideLockedArea = Array.isArray(lockedAreas) && 
        lockedAreas.some(lockedArea => {
          const geometry = lockedArea?.polygon_geometry;
          if (!geometry || !geometry.coordinates) return false;
          
          const point = [latlng.lat, latlng.lng];
          
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
        return;
      }

      // Reset first to ensure no stale popup data persists
      setClickedInfo(null);
      // Immediately show popup with a loading message
      const loadingInfo = { 
        position: latlng, 
        addresses: ['Henter adresse...'],
        source: 'mapClick' // Flag to indicate this came from empty map click
      };
      setClickedInfo(loadingInfo);

      try {
        // Add a timeout for the entire address lookup process
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Address lookup timeout')), 5000); // 5 second timeout
        });
        
        const addressPromise = lookupAddressAtPoint(latlng);
        const addresses = await Promise.race([addressPromise, timeoutPromise]);
        
        const finalAddresses = addresses.length > 0 ? addresses : ['Fant ingen adresse'];
        const primaryAddress = finalAddresses[0];
        
        // PHASE 2: Discovery Flow - Check for apartments
        // Only attempt building discovery if we have a valid address and setBuildingSummary is available
        if (setBuildingSummary && primaryAddress && 
            primaryAddress !== 'Fant ingen adresse' && 
            !primaryAddress.startsWith('Koordinater:')) {
          try {
            console.log('🏢 [useMapState] Discovery Flow: Checking for apartments at:', primaryAddress);
            
            // Update popup with actual address BEFORE local lookup check so loading indicator shows
            setClickedInfo({ 
              position: latlng, 
              addresses: finalAddresses,
              source: 'mapClick'
            });
            
            // Show loading state while checking for apartments
            setIsGeonorgeLoading(true);
            
            // Get campaign ID and manager ID for the API call
            const campaignId = authService.getCampaignId();
            // No campaign → the bulk-create would 400 and no building would be created. Stop early
            // with a clear message and prompt the user to pick a campaign in the toolbar.
            if (!campaignId) {
              setIsGeonorgeLoading(false);
              setClickedInfo(null);
              setToast({ visible: true, message: 'Velg en kampanje først (øverst i verktøylinjen)', type: 'error' });
              return;
            }
            const createdById = currentUser?.id || null;

            // Call backend local-lookup API
            const lookupResult = await fetchLocalLookupForAddress(primaryAddress, {
              campaignId,
              createdById
            });
            
            if (lookupResult && lookupResult.units && lookupResult.units.length > 0) {
              console.log('🏢 [useMapState] Found apartments:', lookupResult.units.length);
              
              // Create building via bulk-create API
              // IMPORTANT: Use user's click position (latlng) instead of API response position
              const buildingData = {
                base_address: primaryAddress,
                apartment_numbers: lookupResult.units,
                campaign_id: campaignId,
                position: { 
                  lat: latlng.lat,  // Use user's click position
                  lon: latlng.lng  // Use user's click position
                }
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
                  position: latlng
                });
                
                // Refresh tiles so grey marker appears
                if (setTilesVersion) {
                  setTilesVersion(v => v + 1);
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
                position: latlng, 
                addresses: finalAddresses,
                source: 'mapClick',
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
        const finalInfo = { 
          position: latlng, 
          addresses: finalAddresses,
          source: 'mapClick' // Flag to indicate this came from empty map click
        };
        setClickedInfo(finalInfo);
      } catch (err) {
        // Provide a fallback address based on coordinates
        const fallbackAddress = `Koordinater: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
        const fallbackInfo = { 
          position: latlng, 
          addresses: [fallbackAddress],
          source: 'mapClick' // Flag to indicate this came from empty map click
        };
        setClickedInfo(fallbackInfo);
      }
    }
  };

  // Handler for map mouse movement
  const handleMapMove = useCallback((e) => {
    if (isDrawingEnabled && currentArea.length > 0) {
      const lastPoint = currentArea[currentArea.length - 1];
      setPreviewLine({
        start: [lastPoint.lat, lastPoint.lng],
        end: [e.latlng.lat, e.latlng.lng]
      });
    }
  }, [isDrawingEnabled, currentArea, mapRef]);

  const showToast = (message, type = 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: '', type: '' });
    }, 3000);
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
        const campaignId = authService.getCampaignId();
        if (!campaignId) {
          setClickedInfo(null);
          setToast({ visible: true, message: 'Velg en kampanje først (øverst i verktøylinjen)', type: 'error' });
          return;
        }

        // Create building via bulk-create API
        const buildingData = {
          base_address: address,
          apartment_numbers: geonorgeResult.units,
          campaign_id: campaignId,
          position: { 
            lat: normalizedPosition.lat, 
            lon: normalizedPosition.lng 
          }
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
  }, [setBuildingSummary, setTilesVersion, setClickedInfo, showToast, setIsGeonorgeLoading]);

  // Manual completion function - can be called from keyboard or UI
  const completeDrawingManually = () => {
    if (currentArea.length >= 3) {
      finishDrawing();
    } else {
      // Current area has less than 3 points
    }
  };

  // Finish drawing an area
  const finishDrawing = async () => {
    if (currentArea.length >= 3) {
      // DELETE MODE: If in delete mode, call the delete handler instead of creating area
      if (isDeleteMode && onDeleteModePolygonComplete) {
        console.log('[useMapState] Delete mode - calling polygon complete handler');
        const polygonPoints = [...currentArea]; // Copy the points
        setCurrentArea([]); // Clear drawing
        setIsDrawingEnabled(false);
        setPreviewLine(null);
        onDeleteModePolygonComplete(polygonPoints);
        return; // Don't create draft area
      }

      // Create new polygon as GeoJSON
      const newPolygon = turf.polygon([
        currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])
      ]);
      
      // Allow overlapping areas: disable overlap checks and toolbar
      setShowOverlapToolbar(false);
      
      // Immediately create draft area with a provisional count, then update asynchronously
      const draftId = `draft-${Date.now()}`;
      const provisionalDraft = {
        id: draftId,
        name: '',
        color: '#2b2d42',
        house_count: 0,
        apartment_count: 0,  // Total individual apartments
        total_apartment_buildings: 0,  // NEW: Total apartment buildings
        addresses: [],  // OLD: Store addresses array (not used with new API, kept for compatibility)
        addressCalculationStatus: 'calculating',  // Track status
        apartmentCalculationStatus: 'calculating',  // Track apartment calculation status
        apartmentCalculationProgress: { completed: 0, total: 0 },  // OLD: Track progress (not used with new API, kept for compatibility)
        polygon_geometry: {
          type: 'Polygon',
          coordinates: [currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])]
        },
        isDraft: true
      };

      setDraftAreas(prev => [...prev, provisionalDraft]);
      setCurrentArea([]);
      setIsDrawingEnabled(false);

      // NEW: Use backend polygon-operations API instead of external APIs
      // Convert currentArea to GeoJSON Polygon format
      const polygonGeoJSON = {
        type: 'Polygon',
        coordinates: [currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])]
      };

      // Update status to calculating
      setDraftAreas(prev => prev.map(a => 
        a.id === draftId ? { 
          ...a, 
          addressCalculationStatus: 'calculating',
          apartmentCalculationStatus: 'calculating'
        } : a
      ));

      // Call backend API
      polygonOperationsService.search(polygonGeoJSON)
        .then(result => {
          const summary = result.summary || {};
          setDraftAreas(prev => prev.map(a => 
            a.id === draftId ? { 
              ...a, 
              house_count: summary.total_houses || 0,
              apartment_count: summary.total_individual_apartments || 0,
              total_apartment_buildings: summary.total_apartment_buildings || 0,
              addressCalculationStatus: 'completed',
              apartmentCalculationStatus: 'completed',
              addressCalculationError: null,
              apartmentCalculationError: null
            } : a
          ));
        })
        .catch(err => {
          // Calculation failed
          const errorMessage = err.message || 'Failed to calculate buildings and apartments';
          setDraftAreas(prev => prev.map(a => 
            a.id === draftId ? { 
              ...a, 
              addressCalculationStatus: 'error',
              addressCalculationError: errorMessage,
              apartmentCalculationStatus: 'error',
              apartmentCalculationError: errorMessage
            } : a
          ));
        });

      // OLD: External API implementation - COMMENTED OUT
      /*
      getAddressesInPolygon(currentArea)
        .then(addresses => {
          const count = addresses.length;
          setDraftAreas(prev => prev.map(a => 
            a.id === draftId ? { 
              ...a, 
              house_count: count,
              addresses: addresses,  // NEW: Store full array
              addressCalculationStatus: 'completed',
              apartmentCalculationStatus: 'calculating'  // NEW: Start apartment calculation
            } : a
          ));
          
          // NEW: Trigger apartment calculation after addresses are fetched
          if (addresses.length > 0) {
            // Initialize progress
            setDraftAreas(prev => prev.map(a => 
              a.id === draftId ? { 
                ...a,
                apartmentCalculationProgress: { completed: 0, total: addresses.length }
              } : a
            ));
            
            calculateApartmentCounts(addresses, (completed, total, currentAddress) => {
              // Update progress in draft state
              setDraftAreas(prev => prev.map(a => 
                a.id === draftId ? { 
                  ...a,
                  apartmentCalculationProgress: { completed, total }
                } : a
              ));
              
            })
            .then(addressesWithApartments => {
              // Calculate total apartment count
              const totalApartments = getTotalApartmentCount(addressesWithApartments);
              
              setDraftAreas(prev => prev.map(a => 
                a.id === draftId ? { 
                  ...a,
                  addresses: addressesWithApartments,  // Update with apartment data
                  apartment_count: totalApartments,
                  apartmentCalculationStatus: 'completed',
                  apartmentCalculationProgress: { completed: addressesWithApartments.length, total: addressesWithApartments.length }  // Final progress
                } : a
              ));
            })
            .catch(err => {
              // Apartment calculation failed
              setDraftAreas(prev => prev.map(a => 
                a.id === draftId ? { 
                  ...a,
                  apartmentCalculationStatus: 'error',
                  apartmentCalculationError: err.message || 'Failed to calculate apartments'
                } : a
              ));
            });
          } else {
            // No addresses, mark apartment calculation as completed (no apartments to calculate)
            setDraftAreas(prev => prev.map(a => 
              a.id === draftId ? { 
                ...a,
                apartmentCalculationStatus: 'completed',
                apartment_count: 0
              } : a
            ));
          }
        })
        .catch(err => {
          // Background address count failed
          const errorMessage = err.message || 'Failed to calculate addresses';
          setDraftAreas(prev => prev.map(a => 
            a.id === draftId ? { 
              ...a, 
              addressCalculationStatus: 'error',
              addressCalculationError: errorMessage,
              apartmentCalculationStatus: 'error',  // Can't calculate apartments without addresses
              apartmentCalculationError: 'Cannot calculate apartments without addresses'  // Set error message for apartments too
            } : a
          ));
        });
      */
    } else {
      // Current area has less than 3 points
    }
  };



  // Get marker icon for uploaded addresses (blue circle)
  const getUploadedAddressIcon = () => {
    return L.divIcon({
      className: 'icon-style-map uploaded-address-icon',
      html: `<div style="background-color: #1976d2; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; border: 2px solid #125ea5; box-shadow: 0 2px 6px rgba(25,118,210,0.35);"></div>`,
      iconSize: [24, 24]
    });
  };

  // Get marker icon based on status
  const getMarkerIcon = (status) => {
    // Special handling for uploaded addresses
    if (status === 'uploaded') {
      return getUploadedAddressIcon();
    }

    let color = '#2C3E50'; // default dark for regular address markers
    let icon = faCheck;

    switch (status) {
      case 'Ja':
      case 'ja':
        color = '#2ecc71';
        icon = faPlus;
        break;
      case 'Ikke hjemme':
      case 'ikke_hjemme':
        color = '#f1c40f';
        icon = faEye;
        break;
      case 'Nei':
      case 'nei':
        color = '#e74c3c';
        icon = faBan;
        break;
    }

    return L.divIcon({
      className: 'icon-style-map',
      html: `<div style="background-color: ${color}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; box-shadow: 0 2px 6px rgba(44,62,80,0.25);">
              <i class="fas fa-${icon.iconName}"></i>
            </div>`,
      iconSize: [24, 24]
    });
  };

  // Handle search selection
  const handleSearchSelect = (result) => {
    // Set the clicked info for the address
    setClickedInfo({
      position: { lat: parseFloat(result.lat), lng: parseFloat(result.lon) },
      addresses: [result.display_name]
    });
    
    // Update search state
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setIsSearching(false);
    
    // Smoothly fly to the selected location with animation
    if (mapRef) {
      mapRef.flyTo(
        [parseFloat(result.lat), parseFloat(result.lon)],
        17, // Reduced zoom level for better performance
        {
          animate: true,
          duration: 1.2, // Slightly faster animation
          easeLinearity: 0.25
        }
      );
    }
  };

  // Handle search input changes
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearching(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchAddress(value);
      setSearchResults(results);
    }, 500);
  };

  // Toggle drawing mode
  const toggleDrawing = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setClickedInfo(null);
    
    setIsDrawingEnabled(prev => {
      const newDrawingState = !prev;
      if (mapRef) {
        const mapContainer = mapRef.getContainer();
        if (newDrawingState) {
          mapContainer.classList.add('drawing-mode');
        } else {
          mapContainer.classList.remove('drawing-mode');
          setCurrentArea([]);
          setPreviewLine(null);
        }
      }
      return newDrawingState;
    });
  };

  // Handle polygon creation from DrawControl
  const handlePolygonCreated = (polygon) => {
    setAreas(prevAreas => [...prevAreas, polygon]);
    setIsDrawingEnabled(false); // Disable drawing mode after creating a polygon
  };

  // Handle polygon editing from DrawControl
  const handlePolygonEdited = (editedPolygon) => {
    setAreas(prevAreas => prevAreas.map(area => 
      area.properties.name === editedPolygon.properties.name ? editedPolygon : area
    ));
  };

  // Handle area editing
  const handleAreaEdit = async (index, isDraft = false) => {
    const area = isDraft ? draftAreas[index] : areas[index];
    
    // Only allow editing draft areas or areas owned by the user
    const areaManagerId = area.manager_id || area.properties?.manager_id || area.manager?.id;
    const currentManagerId = currentUser.user_info?.id || currentUser.user_id || currentUser.user_info?.manager_id;
    if (!isDraft && areaManagerId && currentManagerId && areaManagerId !== currentManagerId) {
      showToast('You can only edit your own areas', 'error');
      return;
    }
    // Convert GeoJSON coordinates to Leaflet format for editing
    const leafletCoordinates = area.polygon_geometry.coordinates[0].map(coord => ({
      lat: coord[1],
      lng: coord[0]
    }));
    setCurrentArea(leafletCoordinates);
    setCurrentAreaData({
      title: area.name,
      color: area.color,
      houseCount: area.house_count,
      // Get apartment count from response - check both apartment_counts and apartment_count
      apartmentCount: area.apartment_counts ?? area.apartment_count ?? 0,  // NEW: Include apartment count from GET response
      endDate: area.end_date ? formatISOToLocal(area.end_date) : null,  // NEW: Load and convert end_date from area
      isDraft: !!isDraft,
      addressCalculationStatus: isDraft ? (area.addressCalculationStatus || 'completed') : undefined,  // NEW: Include status for drafts
      addressCalculationError: isDraft ? area.addressCalculationError : undefined,  // NEW: Include error message
      apartmentCalculationStatus: isDraft ? (area.apartmentCalculationStatus || 'completed') : undefined,  // NEW: Include apartment status
      apartmentCalculationError: isDraft ? area.apartmentCalculationError : undefined,  // NEW: Include apartment error
      apartmentCalculationProgress: isDraft ? (area.apartmentCalculationProgress || { completed: 0, total: 0 }) : undefined  // NEW: Include progress
    });
    setEditingAreaIndex(index);
    setShowAreaDialog(true);
  };

  // Handle area deletion
  const handleAreaDelete = async (index) => {
    const area = areas[index];
    
    // Check if area is editable by current user
    const areaManagerId = area.manager_id || area.properties?.manager_id || area.manager?.id;
    const currentManagerId = currentUser.user_info?.id || currentUser.user_id || currentUser.user_info?.manager_id;
    if (areaManagerId && currentManagerId && areaManagerId !== currentManagerId) {
      showToast('You can only delete your own areas', 'error');
      return;
    }
    
    try {
      await areaService.deleteArea(area.id);
      setAreas(prev => prev.filter((_, i) => i !== index));
      setSelectedArea(null);
      showToast('Area deleted successfully', 'success');
    } catch (error) {
      showToast('Failed to delete area', 'error');
    }
  };

  // Handle area confirmation (for dialog-based creation/edit)
  const handleAreaConfirm = async () => {
    if (currentArea.length < 3) {
      showToast('Draw at least 3 points to create an area', 'error');
      return;
    }
    if (!currentAreaData.title || !currentAreaData.title.trim()) {
      showToast('Area name is required', 'error');
      return;
    }
    // Validate end_date if provided (applies to both create and update)
    if (currentAreaData.endDate) {
      const validation = validateDateRange(currentAreaData.endDate);
      if (!validation.valid) {
        showToast(validation.error, 'error');
        return; // Prevent submission if validation fails
      }
    }
    // Prefer existing draft count if available to avoid slow external calls
    let totalAddresses = currentAreaData.isDraft && editingAreaIndex !== null
      ? (draftAreas[editingAreaIndex]?.house_count ?? 0)
      : null;
    if (totalAddresses === null) {
      try {
        // OLD: External API call - COMMENTED OUT
        // const addresses = await getAddressesInPolygon(currentArea);
        // totalAddresses = addresses.length;
        
        // NEW: Use backend polygon-operations API
        const polygonGeoJSON = {
          type: 'Polygon',
          coordinates: [currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])]
        };
        const result = await polygonOperationsService.search(polygonGeoJSON);
        totalAddresses = result.summary?.total_houses || 0;
      } catch (e) {
        const errorMsg = e.message?.includes('timeout') || e.message?.includes('Gateway timeout')
          ? 'Timeout ved beregning. Prøv igjen senere.'
          : 'Kunne ikke beregne antall adresser. Prøv igjen.';
        showToast(errorMsg, 'error');
        totalAddresses = 0;
      }
    }
    if (currentAreaData.isDraft && editingAreaIndex !== null) {
      // Save draft area to backend
      const draft = draftAreas[editingAreaIndex];
      // Get apartment count from draft if available
      const apartmentCount = draft?.apartment_count ?? currentAreaData.apartmentCount ?? 0;
      
      const newAreaData = {
        name: currentAreaData.title,
        color: currentAreaData.color,
        house_count: totalAddresses,
        apartment_counts: apartmentCount,  // NEW: Include apartment count in POST request
        polygon_geometry: draft.polygon_geometry,
        end_date: currentAreaData.endDate ? formatDateToISO(currentAreaData.endDate) : undefined  // NEW: Include end_date
      };
      
      // Remove undefined fields before sending
      Object.keys(newAreaData).forEach(key => {
        if (newAreaData[key] === undefined) delete newAreaData[key];
      });
      
      try {
        const createdArea = await areaService.createArea(newAreaData);
        setAreas(prev => [...prev, createdArea]);
        
        // ✅ Phase 4: Extract enrichment_job_id and add to tracker
        if (createdArea.enrichment_job_id) {
          console.log('[useMapState] Area created with enrichment job:', {
            areaId: createdArea.id,
            areaName: createdArea.name,
            jobId: createdArea.enrichment_job_id,
            timestamp: new Date().toISOString()
          });
          
          // Add job to tracker via callback
          if (onEnrichmentJobCreated) {
            try {
              onEnrichmentJobCreated(
                createdArea.enrichment_job_id,
                createdArea.id,
                createdArea.name
              );
              console.log('[useMapState] Enrichment job callback triggered successfully');
            } catch (callbackError) {
              console.error('[useMapState] Error in enrichment job callback:', {
                error: callbackError.message,
                stack: callbackError.stack,
                jobId: createdArea.enrichment_job_id,
                areaId: createdArea.id
              });
              // Don't throw - area creation was successful, just callback failed
            }
          } else {
            console.log('[useMapState] Enrichment job created but no callback provided:', {
              jobId: createdArea.enrichment_job_id,
              areaId: createdArea.id
            });
          }
        } else {
          console.log('[useMapState] Area created without enrichment job:', {
            areaId: createdArea.id,
            areaName: createdArea.name
          });
        }
        
        setDraftAreas(prev => prev.filter((_, i) => i !== editingAreaIndex));
        showToast('Area created successfully', 'success');
      } catch (error) {
        // Check for date validation errors from API
        let errorMessage = 'Kunne ikke opprette område';
        
        if (error.message) {
          // Try to parse JSON string if error.message is a JSON string
          try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.end_date && Array.isArray(parsedError.end_date)) {
              errorMessage = parsedError.end_date[0] || errorMessage;
            } else if (parsedError.end_date) {
              errorMessage = parsedError.end_date;
            } else if (parsedError.detail) {
              errorMessage = parsedError.detail;
            } else {
              errorMessage = error.message;
            }
          } catch {
            // Not a JSON string, use message as is
            errorMessage = error.message;
          }
        } else if (typeof error === 'object') {
          // Try to extract error from response
          const errorData = error.response?.data || error;
          if (errorData.end_date && Array.isArray(errorData.end_date)) {
            errorMessage = errorData.end_date[0] || errorMessage;
          } else if (errorData.end_date) {
            errorMessage = errorData.end_date;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        }
        
        showToast(errorMessage, 'error');
      }
    } else if (editingAreaIndex !== null) {
      // Update existing area
      const area = areas[editingAreaIndex];
      // Get apartment count from currentAreaData if available
      const apartmentCount = currentAreaData.apartmentCount ?? area.apartment_counts ?? area.apartment_count ?? 0;
      
      const updateData = {
        name: currentAreaData.title,
        color: currentAreaData.color,
        house_count: totalAddresses,
        apartment_counts: apartmentCount,  // NEW: Include apartment count in PUT request
        polygon_geometry: {
          type: 'Polygon',
          coordinates: [currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])]
        },
        end_date: currentAreaData.endDate ? formatDateToISO(currentAreaData.endDate) : undefined  // NEW: Include end_date
      };
      
      // Remove undefined fields before sending
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });
      
      try {
        const updatedArea = await areaService.updateArea(area.id, updateData);
        setAreas(prev => prev.map((a, index) => index === editingAreaIndex ? updatedArea : a));
        showToast('Area updated successfully', 'success');
      } catch (error) {
        // Check for date validation errors from API
        let errorMessage = 'Kunne ikke oppdatere område';
        
        if (error.message) {
          // Try to parse JSON string if error.message is a JSON string
          try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.end_date && Array.isArray(parsedError.end_date)) {
              errorMessage = parsedError.end_date[0] || errorMessage;
            } else if (parsedError.end_date) {
              errorMessage = parsedError.end_date;
            } else if (parsedError.detail) {
              errorMessage = parsedError.detail;
            } else {
              errorMessage = error.message;
            }
          } catch {
            // Not a JSON string, use message as is
            errorMessage = error.message;
          }
        } else if (typeof error === 'object') {
          // Try to extract error from response
          const errorData = error.response?.data || error;
          if (errorData.end_date && Array.isArray(errorData.end_date)) {
            errorMessage = errorData.end_date[0] || errorMessage;
          } else if (errorData.end_date) {
            errorMessage = errorData.end_date;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        }
        
        showToast(errorMessage, 'error');
      }
    }
    // Reset state
    setCurrentArea([]);
    setCurrentAreaData({
      title: '',
      color: '#2b2d42',
      houseCount: 0,
      endDate: null  // NEW: Reset endDate
    });
    setShowAreaDialog(false);
    setEditingAreaIndex(null);
    setIsDrawingEnabled(false);
  };

  // Handle area cancellation
  const handleAreaCancel = () => {
    setCurrentArea([]);
    setShowAreaDialog(false);
    setIsDrawingEnabled(false);
    setCurrentAreaData({
      title: '',
      color: '#2b2d42',
      houseCount: 0,
      endDate: null  // NEW: Reset endDate
    });
    setEditingAreaIndex(null);
  };

  // Handle polygon deletion from DrawControl
  const handlePolygonDeleted = (deletedPolygons) => {
    setAreas(prevAreas => prevAreas.filter(area => {
      // Compare each area to see if it matches any deleted polygon
      return !deletedPolygons.some(deleted => {
        // Compare coordinates (simple deep comparison)
        const areaCoords = area.polygon_geometry?.coordinates;
        const deletedCoords = deleted.geometry?.coordinates;
        if (!areaCoords || !deletedCoords) return false;
        // Compare as JSON string for simplicity
        return JSON.stringify(areaCoords) === JSON.stringify(deletedCoords);
      });
    }));
  };

  const cancelDrawing = () => {
    setCurrentArea([]);
    setPreviewLine(null);
    setIsDrawingEnabled(false);
    if (mapRef) {
      const mapContainer = mapRef.getContainer();
      mapContainer.classList.remove('drawing-mode');
    }
  };

  const handleAreaUpdate = async (index, newProperties) => {
    const area = areas[index];
    
    // Check if area is editable by current user
    const areaManagerId = area.manager_id || area.properties?.manager_id || area.manager?.id;
    const currentManagerId = currentUser.user_info?.id || currentUser.user_id || currentUser.user_info?.manager_id;
    if (areaManagerId && currentManagerId && areaManagerId !== currentManagerId) {
      showToast('You can only edit your own areas', 'error');
      return;
    }
    
    try {
      const updatedArea = await areaService.updateArea(area.id, newProperties);
      setAreas(prevAreas =>
        prevAreas.map((a, i) =>
          i === index ? updatedArea : a
        )
      );
      showToast('Area updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update area', 'error');
    }
  };

  const handleUndo = useCallback(() => {
    setCurrentArea(prevArea => {
      const newArea = prevArea.slice(0, -1);
      return newArea;
    });
  }, []); // Empty dependency array ensures this function is stable

  const handleMarkerClick = async (marker, index) => {
    
    // Close other popups first
    setClickedInfo(null);
    setSelectedArea(null);
    
    // If marker is null, clear the selected marker and ensure focus is cleared
    if (!marker) {
      setSelectedMarker(null);
      // Clear any potential focus that might cause side effects
      try {
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
      } catch (e) {
        // Ignore focus-related errors
      }
      // Force a small delay to ensure state is fully cleared
      setTimeout(() => {
        setSelectedMarker(null);
      }, 0);
      return;
    }
    
    // Always clear selected marker first to ensure fresh popup state
    setSelectedMarker(null);
    
    // Increment popup counter to force re-render
    setPopupCounter(prev => prev + 1);
    
    // Use setTimeout to ensure state clearing happens first, then set new marker
    setTimeout(async () => {
      // Check if this is an uploaded address marker
      if (marker?.isUploadedAddress && marker?.addressId) {
        try {
          const addressData = await addressService.getUploadedAddress(marker.addressId);
          
          // Set the uploaded address data for the popup
          const updatedMarker = { 
            ...marker, 
            index,
            uploadedAddressData: addressData,
            isUploadedAddress: true
          };
          setSelectedMarker(updatedMarker);
        } catch (error) {
          // Fall back to regular marker handling
          setSelectedMarker({ ...marker, index });
        }
      } else {
        // Regular marker handling
        setSelectedMarker({ ...marker, index });
      }
    }, 0);
  };

  // Helper to add a marker and refresh
  const addMarkerWithIds = useCallback((marker, refreshTilesCallback) => {
    // Skip nearby API reload if vector tiles are enabled
    const useVectorTiles = VectorTileFeatureFlag.isEnabled();
    
    if (!useVectorTiles) {
      // After creating a marker, reload all markers from backend
      loadMarkersFromBackend();
    } else {
    }
    
    // Show success toast for address creation
    showToast('Punktet ble lagt til', 'success');
    
    // Also refresh vector tiles if callback provided
    if (refreshTilesCallback && typeof refreshTilesCallback === 'function') {
      refreshTilesCallback();
    }
  }, [loadMarkersFromBackend, showToast]);

  /**
   * Check if a marker belongs to the current user
   */
  const canDeleteMarker = (marker) => {
    if (!currentUser || !marker) {
      return false;
    }

    // Admins/superusers can delete any marker (backend also enforces this).
    let cachedSuperuser = false;
    try {
      cachedSuperuser = JSON.parse(sessionStorage.getItem('superuser_status') || '{}')?.status === true;
    } catch { /* ignore */ }
    if (['admin', 'superuser'].includes(currentUser.user_type) || cachedSuperuser) {
      return true;
    }

    // Owner: the auth user who created the marker. `created_by_user_id` is stamped from the
    // token on every create and matches `currentUser.user_id` (both are the auth user id).
    const markerCreator = marker.created_by_user_id || marker.createdByUserId;
    const authId = currentUser.user_id;
    if (markerCreator && authId && String(markerCreator) === String(authId)) {
      return true;
    }

    // Legacy fallback: domain-id match (for rows/tiles that only carry manager_id/employee_id).
    const markerManagerId = marker.managerId || marker.manager_id;
    const markerEmployeeId = marker.employeeId || marker.employee_id;
    const domainId = currentUser.user_info?.id;
    if (markerManagerId && currentUser.user_type === 'manager' && String(markerManagerId) === String(domainId)) {
      return true;
    }
    if (markerEmployeeId && currentUser.user_type === 'employee' && String(markerEmployeeId) === String(domainId)) {
      return true;
    }

    return false;
  };

  const handleDeleteMarker = async (markerOrIndex) => {
    let marker = markerOrIndex;
    if (typeof markerOrIndex === 'number') {
      marker = markers[markerOrIndex];
    }
    if (!marker) return;

    // If popup already performed the API delete, just refresh state
    if (marker._skipApiDelete) {
      try {
        // Store marker position for viewport refresh
        const markerPosition = marker.position;
        
        // Force viewport refresh if vector tiles are enabled and we have refresh functions
        const useVectorTiles = VectorTileFeatureFlag.isEnabled();
        if (useVectorTiles && setTilesVersion && mapRef) {
          smartViewportRefresh(
            setTilesVersion,
            mapRef,
            markerPosition
          );
        } else {
          // For non-vector tile mode, still need to reload markers
          const addresses = await addressService.getAddresses();
          const markersFromBackend = convertAddressesToMarkers(addresses);
          setMarkers(markersFromBackend);
        }
        
        setSelectedMarker(null);
        showToast('Punktet ble slettet', 'success');
        return true;
      } catch (error) {
        // ignore refresh error; UI will sync on next fetch
        setSelectedMarker(null);
        return false;
      }
    }

    // Check if user can delete this marker (only for direct API calls)
    if (!canDeleteMarker(marker)) {
      showToast('Du kan kun slette dine egne punkter', 'error');
      return;
    }

    // Validate that marker has required IDs
    if (!marker.addressId) {
      showToast('Kunne ikke slette punktet - mangler nødvendig informasjon', 'error');
      return;
    }

    try {
      // Store marker position for viewport refresh
      const markerPosition = marker.position;
      
      // Delete address
      await addressService.deleteAddress(marker.addressId);

      // Force viewport refresh if vector tiles are enabled and we have refresh functions
      const useVectorTiles = VectorTileFeatureFlag.isEnabled();
      if (useVectorTiles && setTilesVersion && mapRef) {
        smartViewportRefresh(
          setTilesVersion,
          mapRef,
          markerPosition
        );
      }

      // Reload markers from backend to get the latest data (for non-vector tile mode)
      if (!useVectorTiles) {
        const reloadMarkers = async () => {
          try {
            const addresses = await addressService.getAddresses();
            const markersFromBackend = convertAddressesToMarkers(addresses);
            setMarkers(markersFromBackend);
          } catch (error) {
            // Error reloading markers after deletion
          }
        };
        await reloadMarkers();
      }

      setSelectedMarker(null);
      showToast('Punktet ble slettet', 'success');
      return true;
    } catch (error) {
      showToast('Kunne ikke slette punktet', 'error');
      // Re-throw so callers (e.g., floating popups) can show inline errors
      throw error;
    }
  };

  const handleAreaSelect = (area, index, latlng) => {
    // Close other popups
    setClickedInfo(null);
    setSelectedMarker(null);

    if (area === null) {
      setSelectedArea(null);
      return;
    }
    setSelectedArea({ ...area, index, position: latlng });
  };

  // Handle area deletion from AreaDialog
  const handleAreaDeleteDialog = async () => {
    if (editingAreaIndex !== null) {
      // Check if it's a draft area
      if (currentAreaData.isDraft) {
        // Delete draft area from state (no backend call needed)
        setDraftAreas(prev => prev.filter((_, idx) => idx !== editingAreaIndex));
        setShowAreaDialog(false);
        setEditingAreaIndex(null);
        setCurrentArea([]);
        setCurrentAreaData({
          title: '',
          color: '#2b2d42',
          houseCount: 0,
          endDate: null  // NEW: Reset endDate
        });
        showToast('Utkastet ble slettet', 'success');
        return;
      }
      
      // Handle saved area deletion (existing logic)
      const area = areas[editingAreaIndex];
      const areaManagerId = area.manager_id || area.properties?.manager_id || area.manager?.id;
      const currentManagerId = currentUser.user_info?.id || currentUser.user_id || currentUser.user_info?.manager_id;
      if (areaManagerId && currentManagerId && areaManagerId !== currentManagerId) {
        showToast('You can only delete your own areas', 'error');
        return;
      }
      try {
        await areaService.deleteArea(area.id);
        setAreas(prev => prev.filter((_, idx) => idx !== editingAreaIndex));
        setShowAreaDialog(false);
        setEditingAreaIndex(null);
        setCurrentArea([]);
        setCurrentAreaData({
          title: '',
          color: '#2b2d42',
          houseCount: 0,
          endDate: null  // NEW: Reset endDate
        });
        showToast('Området ble slettet', 'success');
      } catch (error) {
        showToast('Kunne ikke slette området', 'error');
      }
    }
  };

  // Expose a function to close the address popup
  const closeAddressPopup = useCallback(() => {
    if (typeof suppressNextMapClick === 'function') suppressNextMapClick(250);
    setClickedInfo(null);
    // Blur focus to avoid key events triggering reopen
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch {}
  }, []); // Remove suppressNextMapClick dependency to prevent infinite re-renders

  // Robust function to close uploaded address popup
  const closeUploadedAddressPopup = useCallback(() => {
    if (typeof suppressNextMapClick === 'function') suppressNextMapClick(250);
    setSelectedMarker(null);
    // Clear any potential focus or state issues
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    } catch {}
    
    // Force a small delay to ensure state is fully cleared
    setTimeout(() => {
      setSelectedMarker(null);
    }, 0);
  }, []); // Remove suppressNextMapClick dependency to prevent infinite re-renders
  
  // Campaign form handlers
  const openCampaignForm = useCallback((campaignId, addressId, salesRepId, addressData = null) => {
    setCampaignFormData({
      campaignId,
      addressId,
      salesRepId,
      addressData
    });
    setShowCampaignForm(true);
  }, []);
  
  const closeCampaignForm = useCallback(() => {
    setShowCampaignForm(false);
    setCampaignFormData({
      campaignId: null,
      addressId: null,
      salesRepId: null,
      addressData: null
    });
  }, []);

  // AssignEmployeesModal handlers
  const openAssignEmployeesModal = useCallback((areaId, areaName) => {
    setAssignEmployeesModalData({
      areaId,
      areaName
    });
    setShowAssignEmployeesModal(true);
    // Keep AreaDialog open underneath; stacked modal UX
  }, []);

  const closeAssignEmployeesModal = useCallback(() => {
    setShowAssignEmployeesModal(false);
    setAssignEmployeesModalData({
      areaId: null,
      areaName: ''
    });
  }, []);

  // Helper function to merge areas without duplicates
  const upsertAreas = useCallback((newAreas, existingAreas) => {
    // Create a Set of existing area IDs for O(1) lookup
    const existingIds = new Set(existingAreas.map(area => area.id));
    
    // Filter out areas that already exist
    const uniqueNewAreas = newAreas.filter(area => {
      // Skip if no polygon geometry
      if (!area.polygon_geometry) return false;
      // Skip if already exists
      if (existingIds.has(area.id)) return false;
      return true;
    });
    
    // Merge unique new areas with existing areas
    return [...existingAreas, ...uniqueNewAreas];
  }, []);

  // Fetch areas in current viewport
  const fetchAreasInViewport = useCallback(async () => {
    if (!mapRef) {
      showToast('Map not initialized', 'error');
      return;
    }

    setIsFetchingAreas(true);

    try {
      // Get map center and bounds
      const center = mapRef.getCenter();
      const bounds = mapRef.getBounds();
      const ne = bounds.getNorthEast();

      // Calculate radius that covers the screen
      let radius = Math.ceil(mapRef.distance(center, ne));
      // Cap radius at 150km
      radius = Math.min(radius, 150000);

      // Fetch areas from API
      const newAreas = await areaService.getNearbyAreas(center.lat, center.lng, radius);

      // Merge with existing areas (prevent duplicates)
      setAreas(prevAreas => {
        const mergedAreas = upsertAreas(newAreas, prevAreas);
        const newCount = mergedAreas.length - prevAreas.length;
        
        if (newCount > 0) {
          showToast(`Loaded ${newCount} new area${newCount === 1 ? '' : 's'}`, 'success');
        } else {
          showToast('No new areas found in this region', 'info');
        }
        
        return mergedAreas;
      });
    } catch (error) {
      console.error('Failed to fetch areas:', error);
      showToast('Failed to fetch areas. Please try again.', 'error');
    } finally {
      setIsFetchingAreas(false);
    }
  }, [mapRef, upsertAreas, showToast]);

  // Remove areas by IDs (for immediate deletion after bulk delete operation)
  const removeAreasByIds = useCallback((areaIds) => {
    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      console.warn('[useMapState] removeAreasByIds: Invalid areaIds array');
      return;
    }

    console.log('[useMapState] Removing areas by IDs:', areaIds);

    // Remove from main areas array
    setAreas(prevAreas => {
      const filtered = prevAreas.filter(area => !areaIds.includes(area.id));
      const removedCount = prevAreas.length - filtered.length;
      console.log(`[useMapState] Removed ${removedCount} area(s) from main areas array`);
      return filtered;
    });

    // Also remove from assignedAreas if present
    setAssignedAreas(prevAssigned => {
      const filtered = prevAssigned.filter(area => !areaIds.includes(area.id));
      if (filtered.length !== prevAssigned.length) {
        console.log(`[useMapState] Removed ${prevAssigned.length - filtered.length} area(s) from assignedAreas`);
      }
      return filtered;
    });

    // Also remove from lockedAreas if present
    setLockedAreas(prevLocked => {
      const filtered = prevLocked.filter(area => !areaIds.includes(area.id));
      if (filtered.length !== prevLocked.length) {
        console.log(`[useMapState] Removed ${prevLocked.length - filtered.length} area(s) from lockedAreas`);
      }
      return filtered;
    });

    // Clear selectedArea if it was deleted
    setSelectedArea(prevSelected => {
      if (prevSelected && areaIds.includes(prevSelected.id)) {
        console.log('[useMapState] Clearing selectedArea (was deleted)');
        return null;
      }
      return prevSelected;
    });

    // Note: If an area being edited is deleted, the area dialog will handle it
    // when it tries to access the area data (it will be undefined)
  }, []);

  const applyAddressMarkerUpdate = useCallback((updated) => {
    if (!updated?.id) return;
    const id = updated.id;
    const patch = {
      status: updated.status,
      nei_subcategory: updated.nei_subcategory ?? null,
      nei_subcategory_display: updated.nei_subcategory_display ?? null,
    };
    setMarkers((prev) =>
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
    markers,
    uploadedAddresses,
    selectedMarker,
    selectedArea,
    mapRef,
    searchQuery,
    searchResults,
    isSearching,
    isDrawingEnabled,
    areas,
    assignedAreas,
    lockedAreas,
    currentArea,
    showAreaDialog,
    editingAreaIndex,
    previewLine,
    toast,
    currentAreaData: memoizedCurrentAreaData,
    statusOptions,
    currentUser,
    draftAreas,
    showOverlapToolbar,
    setShowOverlapToolbar,
    isGeonorgeLoading,
    isFetchingAreas,
    // Campaign form state
    showCampaignForm,
    campaignFormData,
    // AssignEmployeesModal state
    showAssignEmployeesModal,
    assignEmployeesModalData,
    // Setters
    setMapRef,
    setCurrentAreaData,
    // Handlers
    handleMapClick,
    handleMapMove,
    finishDrawing,
    completeDrawingManually,
    getMarkerIcon,
    handleSearchSelect,
    handleSearchChange,
    toggleDrawing,
    handlePolygonCreated,
    handlePolygonEdited,
    handleAreaEdit,
    handleGeonorgeFallback,
    handleAreaDelete,
    handleAreaConfirm,
    handleAreaCancel,
    handlePolygonDeleted,
    cancelDrawing,
    handleAreaUpdate,
    handleUndo,
    handleMarkerClick,
    handleDeleteMarker,
    canDeleteMarker,
    handleAreaSelect,
    handleAreaDeleteDialog,
    addMarkerWithIds,
    closeAddressPopup,
    closeUploadedAddressPopup,
    popupCounter,
    // Movement mode
    isMovementMode,
    toggleMovementMode,
    setMovementMode,
    // Area dialog state
    showAreaDialog,
    setShowAreaDialog,
    // State setters for vector tiles
    setClickedInfo,
    setSelectedMarker,
    setSearchQuery,  // Add this for copy address functionality
    // Utility functions
    showToast,
    // Campaign form handlers
    openCampaignForm,
    closeCampaignForm,
    // AssignEmployeesModal handlers
    openAssignEmployeesModal,
    closeAssignEmployeesModal,
    // Fetch areas handler
    fetchAreasInViewport,
    // Remove areas by IDs (for immediate deletion)
    removeAreasByIds,
    applyAddressMarkerUpdate,
  };
};

export default useMapState;
