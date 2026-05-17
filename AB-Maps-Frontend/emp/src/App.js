import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';
// Optional but bulletproof: Leaflet shim to sanitize bad e.latlng
import './utils/leaflet-latlng-guard';

import { FaLocationArrow } from 'react-icons/fa';
import { jitterLatLng } from './utils/geoJitter';
import { SAFE_RENDER_MODE, DISABLE_ROTATION_ON_MOBILE } from './config/mapFlags.js';

// Vector tiles components  
import CanvasPolygonLayer from './components/map/CanvasPolygonLayer';
import VectorTileLayer from './components/map/VectorTileLayer';
import OptimisticMarkerOverlay from './components/map/OptimisticMarkerOverlay';
import TalkmoreMarkersLayer from './components/map/TalkmoreMarkersLayer';
import useMapClickGuard from './hooks/useMapClickGuard';
import useMapLongPress from './hooks/useMapLongPress';

// Components
import MapController from './components/map/MapController';
import MapEvents from './components/map/MapEvents';
import MapRotationController from './components/map/MapRotationController';

// New floating popups
import FloatingAddressPopup from './components/map/FloatingAddressPopup';
import FloatingUploadedAddressPopup from './components/map/FloatingUploadedAddressPopup';
import FloatingAddressMarkerPopup from './components/map/FloatingAddressMarkerPopup';
// NOTE: ApartmentSelectionPopup deprecated in Phase 4 - use ApartmentListDrawer instead

// Phase 2: Building and Apartment Components
import BuildingSummaryCard from './components/map/BuildingSummaryCard';
import ApartmentListDrawer from './components/map/ApartmentListDrawer';
import buildingService from './services/buildingService';
import LoadingIndicator from './components/ui/LoadingIndicator';
import Toast from './components/ui/Toast';
import MarkerDeletePopup from './components/ui/MarkerDeletePopup';
import EmployeeToolbar from './components/ui/EmployeeToolbar';
import AnimatedSearchBar from './components/ui/AnimatedSearchBar';
import LocationStatus from './components/ui/LocationStatus';
import CampaignSelector from './components/ui/CampaignSelector';
import CampaignFormPopup from './components/ui/CampaignFormPopup';
import SimpleRotationControl from './components/ui/SimpleRotationControl';
import MapUIControl from './components/ui/MapUIControl';

// Hooks
import useMapState from './hooks/useMapState';
import useMobileDetection from './hooks/useMobileDetection';
import useMapRotation from './hooks/useMapRotation';


// Services
import { searchAddress, getEmployeeProfile, getTeamAssignedAreas, getCampaignAreas, getTalkmoreAreaResults } from './services/apiService';
import locationService from './services/locationService';
import { isPointInPolygon } from './utils/addressUtils';

// Token synchronization utilities
import { 
  initializeTokenSync, 
  getAccessToken, 
  getRefreshToken,
  syncTokensFromDashboard,
  updateAccessToken,
  updateRefreshToken,
  clearAllTokens
} from './utils/tokenSync';

import { refreshAccessToken, shouldRefreshToken } from './utils/tokenRefresh';

// Campaign service for fetching full campaign data
import { getCampaignById } from './services/campaignFormService';
import {
  logIsTalkmoreCampaign,
  resolveCampaign,
  isTalkmoreCampaign,
} from './utils/campaignUtils';

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
  const [token, setToken] = useState(null); //Need to debug this part here 
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [locationInitialized, setLocationInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('prompt');
  const [showAreaPin, setShowAreaPin] = useState(false);
  const [areaPinPosition, setAreaPinPosition] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [myLocationAccuracy, setMyLocationAccuracy] = useState(null);
  const [showMyLocation, setShowMyLocation] = useState(false);
  const [isLocationTrackingActive, setIsLocationTrackingActive] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [poorAccuracyCount, setPoorAccuracyCount] = useState(0);
  const [hasShownPrecisionTip, setHasShownPrecisionTip] = useState(false);
  const myLocationTimeout = useRef(null);
  const hasCenteredOnLocation = useRef(false);
  
  // ✅ FIX #2: Throttle location UI updates to prevent excessive re-renders
  const lastUIUpdateTime = useRef(0);
  const lastUIUpdatePosition = useRef(null);
  const UI_UPDATE_INTERVAL = 5000; // Update UI max once per 5 seconds
  const UI_UPDATE_DISTANCE = 5; // Or when moved >5 meters

  // Filter assigned areas to only include those that are nearby (in campaign areas)
  // If campaignAreas is empty or not loaded, show all assigned areas
  const nearbyAssignedAreas = useMemo(() => {
    if (!assignedAreas || assignedAreas.length === 0) {
      return [];
    }
    
    // If campaignAreas is not loaded yet or is empty, show all assigned areas
    if (!campaignAreas || campaignAreas.length === 0) {
      console.log('[App] Campaign areas not loaded yet, showing all assigned areas:', assignedAreas.length);
      return assignedAreas;
    }
    
    // Only include assigned areas that are also in nearby campaign areas
    const filtered = assignedAreas.filter(assigned =>
      campaignAreas.some(campaign => campaign.id === assigned.id)
    );
    
    console.log('[App] Filtered assigned areas:', {
      total: assignedAreas.length,
      campaignAreas: campaignAreas.length,
      filtered: filtered.length
    });
    
    return filtered;
  }, [assignedAreas, campaignAreas]);

  // Vector tiles state - MUST be declared BEFORE useMapState
  const [useVectorTiles] = useState(true);
  const [tilesVersion, setTilesVersion] = useState(0);
  const [vectorLayerKey, setVectorLayerKey] = useState(0); // ✅ Force re-mount when changed
  const [optimisticMarkers, setOptimisticMarkers] = useState([]);
  const vectorTileLayerRef = useRef(null);
  const mapRefAccessor = useRef(null); // ✅ Store mapRef in a ref for stable access

  // Phase 2: Building Summary and Apartment Drawer state
  const [buildingSummary, setBuildingSummary] = useState({
    isOpen: false,
    buildingId: null,
    address: '',
    totalUnits: 0,
    visitedUnits: 0,
    markerColor: 'grey',
    position: null
  });
  const [apartmentDrawer, setApartmentDrawer] = useState({
    isOpen: false,
    buildingId: null,
    baseAddress: ''
  });

  // Carrier markers state - stores features per area
  const [carrierMarkers, setCarrierMarkers] = useState(new Map()); // areaId -> features array
  const [loadingCarriers, setLoadingCarriers] = useState(new Set()); // areaId -> loading state

  // ✅ DETERMINISTIC TILE REFRESH STRATEGY
  // ADD: bump {v} and redraw (no remount)
  // DELETE: remount the layer (new instance)
  const refreshTiles = useCallback((markerPosition = null, operationType = 'add') => {
    console.log(`🔄 [App] refreshTiles - Operation: ${operationType}`);

    if (operationType === 'delete') {
      console.log('🗑️ [App] DELETION - Remounting layer');
      setTilesVersion(v => v + 1);   // Bust browser cache
      setVectorLayerKey(k => k + 1); // Forces a brand-new VectorGrid
      console.log('✅ [App] Layer will be remounted with new key');

    } else {
      // ADDITION: Just bump version and redraw (no remount)
      console.log('➕ [App] ADDITION - Bumping version and redrawing');
      setTilesVersion(v => v + 1);

      // Redraw will happen automatically via VectorTileLayer's useEffect
      // But we can also manually trigger it if layer is ready
      if (vectorTileLayerRef.current) {
        vectorTileLayerRef.current.redraw();
        console.log('✅ [App] Layer redrawn');
      }
    }
  }, []); // Empty deps - we access state via setters and refs

  // Initialize map state early to avoid initialization errors
  const {
    position,
    clickedInfo,
    addressMarkers,
    uploadedAddresses,
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
    setPosition,
    handleDeleteMarker,
    isStatusSubmitting,
    isGeonorgeLoading,
    lockedAreas, // ✅ Locked areas from campaign
    closeAddressPopup,
    closeUploadedAddressPopup,
    popupCounter,
    isClosingPopup,
    // Campaign form state
    showCampaignForm,
    campaignFormData,
    openCampaignForm,
    closeCampaignForm,
    // Geonorge fallback handler
    handleGeonorgeFallback,
    applyAddressMarkerUpdate,
    // NOTE: Old apartment state removed in Phase 4 - use ApartmentListDrawer instead
  } = useMapState(token, employee, selectedAreaId, setToast, permissionStatus, setCampaignAreas, refreshTiles, setBuildingSummary, setTilesVersion);

  // ✅ Keep mapRefAccessor in sync with mapRef state
  useEffect(() => {
    mapRefAccessor.current = mapRef;
  }, [mapRef]);

  // Debug locked areas loading
  useEffect(() => {
    if (lockedAreas && lockedAreas.length > 0) {
      console.log('🔒 [App] Locked areas loaded:', {
        count: lockedAreas.length,
        areas: lockedAreas.map(a => ({
          id: a.id,
          type: a.polygon_geometry?.type,
          hasCoordinates: !!a.polygon_geometry?.coordinates,
          coordsLength: a.polygon_geometry?.coordinates?.length
        }))
      });
    } else {
      console.log('🔒 [App] No locked areas:', { lockedAreas: lockedAreas?.length || 0 });
    }
  }, [lockedAreas]);

  // Mobile detection
  const isMobile = useMobileDetection();

  // Rotation functionality
  const {
    bearing,
    isRotationEnabled,
    isTouchRotationEnabled,
    handleRotationChange,
    resetRotation,
    rotateTo,
    toggleRotation,
    toggleTouchRotation
  } = useMapRotation();

  // Map click guard for stable popup behavior
  const {
    suppressNextMapClick,
    shouldSuppressMapClick,
    // Removed: pauseClusterRefresh and isClusterRefreshPaused - no longer needed with vector tiles
    // ENHANCED: Use new protection methods
    protectUploadedAddressClick,
    shouldSuppressUploadedPopupInterference,
    // ENHANCED: State tracking methods
    setUploadedPopupOpen,
    hasUploadedPopupOpen,
    clearUploadedPopupState,
    // ENHANCED: Regular address marker popup state tracking
    setAddressMarkerPopupOpen,
    hasAddressMarkerPopupOpen,
    clearAddressMarkerPopupState
  } = useMapClickGuard();

  // Global long-press detection for areas - DISABLED for now to test map movement
  // const { suppressLongPress } = useMapLongPress(mapRef, {
  //   onLongPress: (latlng, event) => {
  //     // Handle long-press on areas for context menu
  //     console.log('Long press detected at:', latlng);
  //     // You can add area-specific long-press handling here if needed
  //   },
  //   thresholdMs: 650,
  //   moveTolerancePx: 12
  // });

  // Zoom level state (mapRef is now available from useMapState above)
  const [zoomLevel, setZoomLevel] = useState(mapRef?.getZoom?.() ?? 13);


  // Set viewport height for mobile stability
  useEffect(() => {
    const setVh = () =>
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);


  // Development helper: detect transformed ancestors (uncomment for debugging)
  // useEffect(() => {
  //   const m = document.getElementById('map');
  //   if (!m) return;
  //   let n = m;
  //   while (n) {
  //     const s = getComputedStyle(n);
  //     if (s.transform !== 'none' || s.filter !== 'none' || s.perspective !== 'none') {
  //       console.warn('Transformed ancestor:', n, s.transform, s.filter, s.perspective);
  //     }
  //     n = n.parentElement;
  //   }
  // }, []);

  // Track zoom level for vector tiles
  useEffect(() => {
    if (!mapRef) return;
    const onZoomEnd = () => setZoomLevel(mapRef.getZoom());
    mapRef.on('zoomend', onZoomEnd);
    return () => mapRef.off('zoomend', onZoomEnd);
  }, [mapRef]);

  // Removed: Old clustering index building code - now handled by vector tiles backend

  // Removed: Old clustering code (requestClusters, handleClusterClick, handlePointClick) - now handled by vector tiles

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

  // On mount, initialize selectedCampaign from localStorage
  useEffect(() => {
    const readCampaign = () => {
      const stored = localStorage.getItem('currentCampaign');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSelectedCampaign(parsed);
        } catch {
          setSelectedCampaign({ id: stored });
        }
      } else {
        setSelectedCampaign(null);
      }
    };
    readCampaign();
    window.addEventListener('storage', readCampaign);
    return () => window.removeEventListener('storage', readCampaign);
  }, []);

  // Phase 1: Talkmore campaign detection (console — NEI_SUBCATEGORY_TALKMORE_ONLY_PLAN.md)
  useEffect(() => {
    const resolvedCampaign = resolveCampaign(selectedCampaign);
    logIsTalkmoreCampaign(resolvedCampaign, 'emp/App');
  }, [selectedCampaign]);

  useEffect(() => {
    setPermissionStatus('prompt');
    setLocationInitialized(false);
    
    // Initialize token synchronization system
    initializeTokenSync();
    
    // Sync tokens from dashboard first (in case dashboard has newer tokens)
    const synced = syncTokensFromDashboard();
    if (synced) {
      console.log('[App] Tokens synced from dashboard');
    }
    
    // Extract tokens and campaign_id from URL or localStorage
    const params = new URLSearchParams(window.location.search);
    let accessToken = params.get('accessToken') || params.get('token');
    let refreshToken = params.get('refreshToken');
    let campaignId = params.get('campaign_id');

    // Clean tokens from URL to prevent stale token on page reload/bookmark
    if (accessToken || refreshToken) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('accessToken');
      cleanUrl.searchParams.delete('token');
      cleanUrl.searchParams.delete('refreshToken');
      window.history.replaceState({}, '', cleanUrl.toString());
      console.log('[App] Cleaned tokens from URL');
    }

    // If tokens come from URL, store them and sync to dashboard format
    if (accessToken) {
      updateAccessToken(accessToken);
      console.log('[App] Access token received from URL, synced to storage');
    } else {
      // Try to get from synced storage (checks both maps and dashboard format)
      accessToken = getAccessToken();
    }
    
    if (refreshToken) {
      updateRefreshToken(refreshToken);
      console.log('[App] Refresh token received from URL, synced to storage');
    } else {
      // Try to get from synced storage (checks both maps and dashboard format)
      refreshToken = getRefreshToken();
    }

    // Set campaign_id in localStorage if provided in URL
    if (campaignId) {
      // Store initial campaign object with just ID
      let campaignObj = { id: campaignId };
      localStorage.setItem('currentCampaign', JSON.stringify(campaignObj));
      
      // Fetch full campaign data to get the name (needed for NRC campaign detection)
      // This follows the same pattern as EmployeeToolbar
      if (accessToken) {
        getCampaignById(campaignId, accessToken)
          .then(fullCampaign => {
            console.log('[App] Fetched full campaign data:', fullCampaign);
            // Update localStorage with full campaign data including name
            const fullCampaignObj = { id: campaignId, name: fullCampaign.name };
            localStorage.setItem('currentCampaign', JSON.stringify(fullCampaignObj));
            console.log('[App] Updated localStorage with campaign name:', fullCampaignObj);
          })
          .catch(err => {
            console.warn('[App] Could not fetch full campaign data:', err.message);
            // Campaign ID is still stored, just without name
          });
      }
    } else {
      // Check if campaign_id exists in localStorage
      const existingCampaign = localStorage.getItem('currentCampaign');
      if (!existingCampaign) {
        console.warn('No campaign ID available - some features may not work properly');
        setToast({ visible: true, message: 'No campaign selected. Some features may be limited.', type: 'warning' });
      } else {
        // Check if existing campaign has a name, if not fetch it
        try {
          const parsed = JSON.parse(existingCampaign);
          if (parsed && parsed.id && !parsed.name && accessToken) {
            getCampaignById(parsed.id, accessToken)
              .then(fullCampaign => {
                console.log('[App] Fetched full campaign data for existing campaign:', fullCampaign);
                const fullCampaignObj = { id: parsed.id, name: fullCampaign.name };
                localStorage.setItem('currentCampaign', JSON.stringify(fullCampaignObj));
                console.log('[App] Updated localStorage with campaign name:', fullCampaignObj);
              })
              .catch(err => {
                console.warn('[App] Could not fetch full campaign data:', err.message);
              });
          }
        } catch (e) {
          console.warn('[App] Could not parse existing campaign:', e);
        }
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
            const errorData = await err.response.json();
            if (errorData.detail) errorMsg += ` [${errorData.detail}]`;
          } catch (e) {
            console.error('Could not parse error response', e);
          }
        }
        console.error('Employee profile loading error:', err);
        setToast({ visible: true, message: errorMsg, type: 'error' });
      });
    getTeamAssignedAreas(accessToken)
      .then(areas => {
        console.log('Fetched assigned areas:', areas);
        // Ensure it's an array
        const areasArray = Array.isArray(areas) ? areas : (areas?.results || []);
        console.log('Setting assigned areas (count):', areasArray.length);
        setAssignedAreas(areasArray);
      })
      .catch(err => {
        console.error('Failed to fetch assigned areas:', err);
        // Set empty array on error to prevent undefined state
        setAssignedAreas([]);
      });
    // Campaign areas will be loaded after location permission is granted (see useMapState.js)
  }, []);

  // Cleanup location service on component unmount only.
  // This must NOT depend on locationInitialized, because when that state
  // flips from false → true the old effect's cleanup would run
  // stopLocationTracking() and immediately kill the tracking we just started.
  useEffect(() => {
    return () => {
      locationService.destroy();
      if (myLocationTimeout.current) clearTimeout(myLocationTimeout.current);
      stopLocationTracking();
    };
  }, []);

  // Handle app resume - simplified: just sync tokens from dashboard, no API calls
  // The apiInterceptor handles 401s on-demand, so we don't need to verify/refresh here.
  // On mobile, visibilitychange fires constantly (notifications, app switching, screen off/on)
  // so making API calls here was causing unnecessary refresh attempts and race conditions.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] App resumed, syncing tokens from dashboard...');
          syncTokensFromDashboard();
          
        // Update React state if token changed while we were away
          const currentToken = getAccessToken();
        if (currentToken && currentToken !== token) {
          setToken(currentToken);
          console.log('[App] Token updated from dashboard sync');
        }
      }
    };
    
    // Handle visibility change (desktop tab switch + mobile app switch)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle bfcache restore (mobile back/forward navigation)
    const handlePageShow = (e) => {
      if (e.persisted) {
        console.log('[App] Page restored from bfcache, syncing tokens...');
        handleVisibilityChange();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [token]); // Re-create when token state changes so comparison is fresh

  // Phase 4: Handle logout event from dashboard
  useEffect(() => {
    const handleLogout = () => {
      console.log('[App] Logout event received from dashboard');
      
      // Clear all tokens (both dashboard and maps app format)
      clearAllTokens();
      
      // Clear app state
      setToken(null);
      setEmployee(null);
      setAssignedAreas([]);
      setCampaignAreas([]);
      setSelectedCampaign(null);
      
      // Stop location tracking if active
      if (locationInitialized) {
        locationService.destroy();
      }
      
      // Redirect to login
      const loginUrl = process.env.REACT_APP_LOGIN_URL || '/login';
      console.log('[App] Redirecting to login:', loginUrl);
      window.location.href = loginUrl;
    };
    
    // Listen for logout event from dashboard
    window.addEventListener('userLoggedOut', handleLogout);
    
    // Also listen for storage events (cross-tab logout detection)
    const handleStorageChange = (e) => {
      // If auth_tokens or user_data is removed, user logged out
      if (e.key === 'auth_tokens' || e.key === 'user_data') {
        if (!localStorage.getItem('auth_tokens') && !localStorage.getItem('user_data')) {
          console.log('[App] Dashboard tokens cleared, handling logout...');
          handleLogout();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('userLoggedOut', handleLogout);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [locationInitialized]); // Include locationInitialized to check if we need to destroy location service

  // Proactive token refresh: schedule a refresh before token expires.
  // Uses remaining time until expiry (not iat) because Django Simple JWT
  // keeps the original iat across refreshes while exp advances, which would
  // cause the computed lifetime to grow and eventually make delay = 0.
  useEffect(() => {
    if (!token) return;

    const scheduleRefresh = (currentToken) => {
      try {
        const payload = JSON.parse(atob(currentToken.split('.')[1]));
        const exp = payload.exp * 1000;
        const timeUntilExpiry = exp - Date.now();

        if (timeUntilExpiry <= 0) {
          console.warn('[App] Token already expired, refreshing now');
          refreshAccessToken()
            .then(t => setToken(t))
            .catch(err => console.error('[App] Refresh of expired token failed:', err));
          return null;
        }

        // Refresh when 75% of the remaining time has elapsed (25% left)
        const delay = Math.max(Math.floor(timeUntilExpiry * 0.75), 10000);

        console.log(`[App] Scheduling proactive token refresh in ${Math.round(delay / 1000)}s (token expires in ${Math.round(timeUntilExpiry / 1000)}s)`);

        return setTimeout(async () => {
          try {
            const newToken = await refreshAccessToken();
            setToken(newToken);
            console.log('[App] Proactive token refresh succeeded');
          } catch (err) {
            console.error('[App] Proactive token refresh failed:', err);
          }
        }, delay);
      } catch (err) {
        console.error('[App] Failed to decode token for proactive refresh:', err);
        return null;
      }
    };

    const timerId = scheduleRefresh(token);
    return () => { if (timerId) clearTimeout(timerId); };
  }, [token]);

  // Center map on user location when both location and mapRef are available
  useEffect(() => {
    if (myLocation && mapRef && permissionStatus === 'granted' && locationInitialized && !hasCenteredOnLocation.current) {
      mapRef.flyTo(myLocation, 16, {
        animate: true,
        duration: 1.5,
        easeLinearity: 0.25
      });
      hasCenteredOnLocation.current = true;
    }
  }, [myLocation, permissionStatus, locationInitialized]);

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

  // Load carrier markers for an area
  const loadCarrierMarkers = useCallback(async (areaId) => {
    if (!areaId || !token) {
      console.warn('[App] Cannot load carrier markers: missing areaId or token');
      return;
    }

    // Check current state and set loading state atomically
    let shouldProceed = false;
    setLoadingCarriers(prev => {
      if (prev.has(areaId)) {
        console.log('[App] Carrier markers already loading for area:', areaId);
        return prev;
      }
      shouldProceed = true;
      return new Set(prev).add(areaId);
    });

    if (!shouldProceed) return;

    // Check if already loaded
    setCarrierMarkers(prev => {
      if (prev.has(areaId)) {
        console.log('[App] Carrier markers already loaded for area:', areaId);
        // Clear loading state since we already have the data
        setLoadingCarriers(prevLoading => {
          const newSet = new Set(prevLoading);
          newSet.delete(areaId);
          return newSet;
        });
        shouldProceed = false;
        return prev;
      }
      return prev;
    });

    if (!shouldProceed) return;

    try {
      console.log('[App] Loading carrier markers for area:', areaId);
      const features = await getTalkmoreAreaResults(areaId, true);
      console.log('[App] Loaded carrier markers:', features.length, 'features');

      setCarrierMarkers(prev => {
        const newMap = new Map(prev);
        newMap.set(areaId, features);
        return newMap;
      });

      setToast({
        visible: true,
        message: `Lastet ${features.length} carrier markører for området`,
        type: 'success'
      });
    } catch (error) {
      console.error('[App] Failed to load carrier markers:', error);
      setToast({
        visible: true,
        message: `Kunne ikke laste carrier markører: ${error.message}`,
        type: 'error'
      });
    } finally {
      setLoadingCarriers(prev => {
        const newSet = new Set(prev);
        newSet.delete(areaId);
        return newSet;
      });
    }
  }, [token]);

  // ✅ FIX #2: Helper to check if UI should update
  const shouldUpdateUI = useCallback((location) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUIUpdateTime.current;
    
    // Always update if first time or been >5 seconds
    if (!lastUIUpdatePosition.current || timeSinceLastUpdate > UI_UPDATE_INTERVAL) {
      return true;
    }
    
    // Update if moved >5 meters
    if (lastUIUpdatePosition.current) {
      const prevLat = lastUIUpdatePosition.current[0];
      const prevLng = lastUIUpdatePosition.current[1];
      const currLat = location.latitude;
      const currLng = location.longitude;
      
      // Haversine distance calculation
      const R = 6371e3; // Earth radius in meters
      const φ1 = prevLat * Math.PI / 180;
      const φ2 = currLat * Math.PI / 180;
      const Δφ = (currLat - prevLat) * Math.PI / 180;
      const Δλ = (currLng - prevLng) * Math.PI / 180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      if (distance > UI_UPDATE_DISTANCE) {
        return true;
      }
    }
    
    return false;
  }, [UI_UPDATE_INTERVAL, UI_UPDATE_DISTANCE]);

  // Listen to improved location service for marker + accuracy circle updates
  // ✅ FIX #2: Throttled updates to prevent excessive re-renders
  useEffect(() => {
    const onGood = ({ location }) => {
      // Check if UI should update (throttling)
      if (shouldUpdateUI(location)) {
        console.log('📍 [App] Updating location UI (good accuracy)');
        setMyLocation([location.latitude, location.longitude]);
        setMyLocationAccuracy(location.accuracy ?? null);
        lastUIUpdateTime.current = Date.now();
        lastUIUpdatePosition.current = [location.latitude, location.longitude];
      }
      
      // Always update accuracy counters (lightweight)
      if (location.accuracy <= 30) {
        setPoorAccuracyCount(0);
      }
    };

    const onWarm = ({ location }) => {
      // Check if UI should update (throttling)
      if (shouldUpdateUI(location)) {
        console.log('📍 [App] Updating location UI (warming up)');
        setMyLocation([location.latitude, location.longitude]);
        setMyLocationAccuracy(location.accuracy ?? null);
        lastUIUpdateTime.current = Date.now();
        lastUIUpdatePosition.current = [location.latitude, location.longitude];
      }
      
      // Always update accuracy counters (lightweight)
      if (location.accuracy > 1000) {
        setPoorAccuracyCount(prev => prev + 1);
      } else {
        setPoorAccuracyCount(0);
      }
    };

    locationService.on('location_updated', onGood);
    locationService.on('location_warming', onWarm);

    return () => {
      locationService.off('location_updated', onGood);
      locationService.off('location_warming', onWarm);
    };
  }, [shouldUpdateUI]);

  // Show iOS precision location tip if accuracy stays poor
  useEffect(() => {
    if (poorAccuracyCount >= 10 && !hasShownPrecisionTip) {
      setHasShownPrecisionTip(true);
      setToast({
        visible: true,
        message: 'For better accuracy: iOS Settings → Privacy & Security → Location Services → Safari Websites → Precise Location: On. Keep Wi-Fi enabled.',
        type: 'info'
      });
    }
  }, [poorAccuracyCount, hasShownPrecisionTip]);

  // TESTING: Auto-enable location tracking disabled for mobile testing
  // Auto-enable location tracking when user first gets permission
  // useEffect(() => {
  //   if (permissionStatus === 'granted' && locationInitialized && !isLocationTrackingActive) {
  //     // User just got permission, automatically enable tracking and show marker
  //     setIsLocationTrackingActive(true);
  //     setShowMyLocation(true);
  //     
  //     // Make sure location service is actually started
  //     if (locationService.getStatus().permissionStatus === 'granted') {
  //       locationService.startTracking().catch(err => {
  //         console.error('Failed to start location tracking:', err);
  //       });
  //     }
  //   }
  // }, [permissionStatus, locationInitialized, isLocationTrackingActive]);

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

  // Custom icon for user location
  const myLocationIcon = L.divIcon({
    className: 'my-location-icon',
    html: `
      <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="pinClip">
            <path d="M18 0c7.732 0 14 6.268 14 14 0 9.333-14 22-14 22S4 23.333 4 14C4 6.268 10.268 0 18 0z"/>
          </clipPath>
        </defs>
        <path d="M18 34s14-12 14-20C32 6.268 25.732 0 18 0S4 6.268 4 14c0 8 14 20 14 20z" fill="#154c7d"/>
        <circle cx="18" cy="14" r="8.5" fill="#fff"/>
        <!-- person -->
        <circle cx="18" cy="12.5" r="2.6" fill="#154c7d"/>
        <path d="M12.8 19.2c1.8-2 4.4-2.1 5.2-2.1s3.4.1 5.2 2.1c.4.5.6 1 .6 1.6v1.7h-11.6v-1.7c0-.6.2-1.1.6-1.6z" fill="#154c7d"/>
      </svg>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 30],
    popupAnchor: [0, -30]
  });

  // Auto-check permission state on mount (after employee is loaded)
  // Uses abort object (passed by reference) to prevent race conditions from
  // StrictMode double-mount or dependency changes.
  // NOTE: token is NOT in deps - token refreshes must not re-trigger location setup.
  // The guard uses a ref so we still skip if no token is available.
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    if (!employee || !tokenRef.current) return;

    const ctrl = { aborted: false };

    const checkInitialPermissionState = async () => {
      try {
        console.log('[App] Checking initial permission state...');
        const permState = await locationService.checkPermissionState();
        if (ctrl.aborted) return;
        console.log('[App] Initial permission state:', permState);

        if (permState === 'granted') {
          console.log('[App] Permission already granted - auto-initializing location...');
          setPermissionStatus('granted');
          await handleAutoLocationSetup(ctrl);
        } else if (permState === 'denied') {
          if (!ctrl.aborted) setPermissionStatus('denied');
          console.log('[App] Permission denied - user must enable in browser settings');
        } else {
          if (!ctrl.aborted) setPermissionStatus('prompt');
          console.log('[App] Permission state is', permState, '- waiting for user action');
        }
      } catch (e) {
        console.error('[App] Failed to check initial permission state:', e);
        if (!ctrl.aborted) setPermissionStatus('prompt');
      }
    };

    checkInitialPermissionState();

    return () => {
      ctrl.aborted = true;
      console.log('[App] Location setup effect cleanup — aborting any in-progress init');
    };
  }, [employee]);

  // Auto-initialize location when permission is already granted
  // ctrl is an object { aborted: bool } passed by reference so async checks always see latest value
  const handleAutoLocationSetup = async (ctrl = { aborted: false }) => {
    try {
      console.log('[App] Auto-initializing location tracking...');
      await locationService.initialize(employee);
      if (ctrl.aborted) return;

      const location = await locationService.requestLocationPermission();
      if (ctrl.aborted) return;
      
      if (location) {
        setMyLocation([location.latitude, location.longitude]);
      }

      // Initialize WebSocket
      try {
        await locationService.initializeWebSocket();
      } catch (wsError) {
        console.error('WebSocket connection failed:', wsError);
      }
      if (ctrl.aborted) return;

      // Start tracking
      locationService.startTracking();
      setLocationInitialized(true);
      setShowMyLocation(true);
      setIsLocationTrackingActive(true);

      // Center map on user location
      if (location && mapRef && hasCenteredOnLocation.current === false) {
        mapRef.flyTo([location.latitude, location.longitude], 16, { animate: true, duration: 1.5 });
        hasCenteredOnLocation.current = true;
      }

      console.log('[App] ✅ Location auto-initialized successfully');
    } catch (error) {
      if (ctrl.aborted) return;
      console.error('[App] Auto-initialization failed:', error);
      setPermissionStatus('prompt'); // Reset to allow manual request
    }
  };

  const handleRequestPermission = async () => {
    if (!employee || !token) return;

    console.log('[App] handleRequestPermission called');

    setIsRequestingLocation(true);
    setPermissionStatus('checking');
    hasCenteredOnLocation.current = false;

    try {
      // Initialize BEFORE requesting permission so employee/device_id is set
      await locationService.initialize(employee);

      const location = await locationService.requestLocationPermission();

      setPermissionStatus('granted');

      // Initialize WebSocket
      try {
        await locationService.initializeWebSocket();
      } catch (wsError) {
        console.error('WebSocket connection failed:', wsError);
        setToast({ visible: true, message: 'Location tracking started (offline mode)', type: 'warning' });
      }

      // Start tracking
      locationService.startTracking();
      setLocationInitialized(true);

      if (location) {
        const userLocation = [location.latitude, location.longitude];
        setMyLocation(userLocation);
        setShowMyLocation(true);
        setIsLocationTrackingActive(true);

        // Center map on user location
        if (mapRef && !hasCenteredOnLocation.current) {
          mapRef.flyTo(userLocation, 16, { animate: true, duration: 1.5, easeLinearity: 0.25 });
          hasCenteredOnLocation.current = true;
        }

        const message = locationService.getStatus().isOnline
          ? 'Location access granted! Tracking started.'
          : 'Location tracking started (offline mode)';
        setToast({ visible: true, message, type: 'success' });
        setTimeout(() => { setToast(prev => ({ ...prev, visible: false })); }, 5000);
      }

    } catch (error) {
      console.error('[App] Location permission request failed:', error);

      // Check error type using custom error classes
      const errorName = error.name || '';
      const errorMsg = error.message || 'Unknown error';

      if (errorName === 'PermissionDeniedError' || error.isPermanent) {
        // Permanent denial - user clicked "Block"
        setPermissionStatus('denied');
        setToast({
          visible: true,
          message: 'Location blocked. Click the lock icon in your browser to enable.',
          type: 'error'
        });
      } else if (errorName === 'LocationError' && !error.isPermanent) {
        // Temporary error - GPS timeout, position unavailable, etc.
        // Permission might still be granted
        setPermissionStatus('prompt'); // Allow retry
        setToast({
          visible: true,
          message: 'Could not get location. Please try again.',
          type: 'warning'
        });
      } else {
        // Unknown error
        setPermissionStatus('prompt');
        setToast({
          visible: true,
          message: `Location setup failed: ${errorMsg}`,
          type: 'error'
        });
      }
    } finally {
      setIsRequestingLocation(false);
    }
  };

  // TESTING: Permission listener disabled for mobile testing
  // Add a listener to detect when permission is granted after initial denial
  // if (navigator.permissions && navigator.permissions.query) {
  //   navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
  //     // Listen for permission changes
  //     permissionStatus.addEventListener('change', async () => {
  //       if (permissionStatus.state === 'granted') {
  //         setPermissionStatus('granted');
  //         
  //         try {
  //           // Initialize location service
  //           await locationService.initialize(token, employee);
  //           
  //           // Initialize WebSocket connection
  //           try {
  //             await locationService.initializeWebSocket();
  //           } catch (wsError) {
  //             console.error('WebSocket connection failed:', wsError);
  //             setToast({ visible: true, message: 'Location tracking started (offline mode)', type: 'warning' });
  //           }
  //           
  //           // Start tracking
  //           await locationService.startTracking();
  //           setLocationInitialized(true);
  //           
  //           // Get current location
  //           const location = await locationService.getCurrentLocation();
  //           if (location) {
  //             const userLocation = [location.latitude, location.longitude];
  //             setMyLocation(userLocation);
  //             setShowMyLocation(true);
  //             setIsLocationTrackingActive(true);
  //             
  //             setToast({ visible: true, message: 'Location access granted! Map is now available.', type: 'success' });
  //           }
  //         } catch (err) {
  //           console.error('Failed to initialize after permission granted:', err);
  //         }
  //       }
  //     });
  //   });
  // }

  const handleLocateMe = async () => {
    try {
      if (isLocationTrackingActive && myLocation) {
        const newShowState = !showMyLocation;
        setShowMyLocation(newShowState);
        if (newShowState && mapRef) {
          // User explicitly re-enabled marker: recenter once
          mapRef.flyTo(myLocation, 16, { animate: true, duration: 1.2, easeLinearity: 0.25 });
        }
        setToast({ visible: true, message: newShowState ? 'Posisjonsmarkør vist' : 'Posisjonsmarkør skjult', type: 'info' });
        return;
      }

      if (permissionStatus !== 'granted') {
        await handleRequestPermission();
        setIsLocationTrackingActive(true);
        setShowMyLocation(true);
        return;
      }

      if (permissionStatus === 'granted' && !myLocation) {
        await locationService.startTracking();
        setIsLocationTrackingActive(true);
        setShowMyLocation(true);
        setToast({ visible: true, message: 'Starter posisjonssporing...', type: 'info' });
        return;
      }

      if (permissionStatus === 'granted' && myLocation) {
        setIsLocationTrackingActive(true);
        setShowMyLocation(true);
        if (mapRef) {
          mapRef.flyTo(myLocation, 16, { animate: true, duration: 1.2, easeLinearity: 0.25 });
        }
        setToast({ visible: true, message: 'Posisjonsmarkør vist', type: 'info' });
        return;
      }

    } catch (e) {
      setToast({ visible: true, message: 'Kunne ikke starte posisjonssporing', type: 'error' });
    }
  };

  // Function to completely stop location tracking (for cleanup)
  const stopLocationTracking = () => {
    locationService.stopTracking();
    setIsLocationTrackingActive(false);
    setShowMyLocation(false);
    setMyLocation(null);
    setMyLocationAccuracy(null);
    setPoorAccuracyCount(0);
  };

  // Vector tile click handler - PHASE 2: Enhanced with marker_type routing
  const handleVectorTileClick = useCallback((properties, latlng) => {
    // 🟡 DEBUGGING: Log incoming vector tile click
    let stackTrace = null;
    try {
      stackTrace = new Error().stack?.split('\n').slice(1, 5);
    } catch (err) {
      // Ignore stack trace errors
    }

    console.log('🟡 [App] handleVectorTileClick called:', {
      hasProperties: !!properties,
      propertiesId: properties?.id,
      propertiesSourceTable: properties?.source_table,
      markerType: properties?.markerType || properties?.marker_type,
      hasLatLng: !!latlng,
      timestamp: Date.now()
    });

    // Validate and convert latlng to Leaflet LatLng object
    if (!latlng) {
      console.error('❌ [App] handleVectorTileClick: latlng is null or undefined');
      return;
    }

    let validLatLng = null;
    try {
      // Try to convert to Leaflet LatLng object
      if (latlng.lat !== undefined && latlng.lng !== undefined) {
        const lat = typeof latlng.lat === 'number' ? latlng.lat : parseFloat(latlng.lat);
        const lng = typeof latlng.lng === 'number' ? latlng.lng : parseFloat(latlng.lng);

        if (isNaN(lat) || isNaN(lng)) {
          console.warn('handleVectorTileClick: Invalid lat/lng values', latlng);
          return;
        }

        validLatLng = L.latLng(lat, lng);
      } else if (Array.isArray(latlng) && latlng.length >= 2) {
        validLatLng = L.latLng(latlng[0], latlng[1]);
      } else if (latlng instanceof L.LatLng) {
        validLatLng = latlng;
      } else {
        console.error('❌ [App] handleVectorTileClick: Invalid latlng format:', latlng);
        return;
      }
    } catch (error) {
      console.error('❌ [App] handleVectorTileClick: Error converting latlng:', error);
      return;
    }

    // Check if click is inside ANY locked area - prevent popup
    const isInsideLockedArea = Array.isArray(lockedAreas) &&
      lockedAreas.length > 0 &&
      lockedAreas.some(lockedArea => {
        const geometry = lockedArea?.polygon_geometry;
        if (!geometry || !geometry.coordinates) return false;

        const point = [validLatLng.lat, validLatLng.lng];

        // Handle MultiPolygon geometry
        if (geometry.type === 'MultiPolygon') {
          return geometry.coordinates.some(polygonRing => {
            const ring = polygonRing[0];
            if (!Array.isArray(ring) || ring.length < 3) return false;
            const polygonCoords = ring.map(([lng, lat]) => [lat, lng]);
            return isPointInPolygon(point, polygonCoords);
          });
        } else {
          const ring = geometry.coordinates[0];
          if (!Array.isArray(ring) || ring.length < 3) return false;
          const polygonCoords = ring.map(([lng, lat]) => [lat, lng]);
          return isPointInPolygon(point, polygonCoords);
        }
      });

    if (isInsideLockedArea) {
      console.log('🚫 [App] Vector tile click blocked: inside locked area');
      return;
    }

    const zoom = mapRef?.getZoom?.() || 15;
    const markerType = properties.markerType || properties.marker_type;

    // Cluster → Zoom in
    if (properties.cluster) {
      const targetZoom = Math.min(zoom + 2, 18);
      mapRef.flyTo(validLatLng, targetZoom, { animate: true, duration: 0.6 });
      return;
    }

    // PHASE 2: Building → Show BuildingSummaryCard
    if (markerType === 'building' || properties.isBuilding) {
      console.log('🏢 [App] Building marker clicked:', properties);
      setBuildingSummary({
        isOpen: true,
        buildingId: properties.buildingId || properties.id,
        address: properties.addressText || properties.address_text || '',
        totalUnits: properties.totalUnits || properties.total_units || 0,
        visitedUnits: properties.visitedUnits || properties.visited_units || 0,
        markerColor: properties.markerColor || properties.marker_color || 'grey',
        position: validLatLng,
        creatorName: properties.creator_name,
        creatorType: properties.creator_type
      });
      return;
    }

    // PHASE 2: Uploaded address → Show uploaded popup
    if (markerType === 'uploaded' || properties.isUploadedAddress || properties.source_table === 'uploaded_address') {
      const markerData = {
        id: properties.id,
        position: validLatLng,
        isUploadedAddress: true,
        uploadedAddressData: {
          address_text: properties.address_text,
          address: properties.address_text,
          status: properties.status,
          tags: typeof properties.tags === 'string' ? JSON.parse(properties.tags) : (properties.tags || {}),
          created_at: properties.created_at,
          uploaded_by: properties.uploaded_by,
          manager_id: properties.manager_id,
          employee_id: properties.employee_id,
          campaign_id: properties.campaign_id
        }
      };
      handleMarkerClick(markerData);
      return;
    }

    // PHASE 2: House (or legacy) → Show existing popup
    // Regular address -> check if it's an existing marker (has status) or new address
    const hasStatus = properties.status && properties.status !== 'null' && properties.status !== '';

    console.log('🔵 [App] Address clicked:', {
      addressId: properties.id,
      address: properties.address_text,
      hasStatus,
      markerType
    });

    if (hasStatus) {
      // EXISTING MARKER: User already set a status for this address
      const markerData = {
        id: properties.id,
        addressId: properties.id,
        position: validLatLng,
        address: properties.address_text,
        status: properties.status,
        tags: typeof properties.tags === 'string' ? JSON.parse(properties.tags) : (properties.tags || {}),
        isUploadedAddress: false,
        creator_name: properties.creator_name,
        creator_type: properties.creator_type
      };
      handleMarkerClick(markerData);
    } else {
      // NEW ADDRESS: No status yet, user needs to select status
      setClickedInfo({
        addressId: properties.id,
        address: properties.address_text,
        addresses: [properties.address_text || 'Adresse'],
        position: validLatLng,
        status: properties.status,
        tags: typeof properties.tags === 'string' ? JSON.parse(properties.tags) : (properties.tags || {}),
        source: 'vectorTile',
        creator_name: properties.creator_name,
        creator_type: properties.creator_type
      });
    }
  }, [mapRef, handleMarkerClick, setClickedInfo, lockedAreas]);

  // Phase 2: Handler for opening apartment drawer from BuildingSummaryCard
  const handleOpenApartmentDrawer = useCallback((buildingId, baseAddress) => {
    setBuildingSummary(prev => ({ ...prev, isOpen: false }));
    setApartmentDrawer({
      isOpen: true,
      buildingId,
      baseAddress
    });
  }, []);

  // Phase 2: Handler for closing apartment drawer
  const handleCloseApartmentDrawer = useCallback(() => {
    setApartmentDrawer({
      isOpen: false,
      buildingId: null,
      baseAddress: ''
    });
  }, []);

  // Phase 2: Handler for apartment status change (refresh tiles)
  const handleApartmentStatusChange = useCallback((buildingId) => {
    console.log('🔄 [App] Apartment status changed for building:', buildingId);
    // Refresh tiles to show updated building marker color
    setTilesVersion(v => v + 1);
  }, []);

  const handleAreaSelect = useCallback((area) => {
    console.log('handleAreaSelect called with area:', area);

    // Area selection is now optional - users can navigate and place markers without selecting an area
    // This is just for navigation help and visual organization
    const areaId = area?.properties?.id ?? area?.id;
    console.log('Extracted area ID:', areaId);

    setSelectedAreaId(areaId);
    localStorage.setItem('area_id', areaId);

    if (mapRef && area.geometry && area.geometry.coordinates && area.geometry.coordinates[0] && area.geometry.coordinates[0].length > 0) {
      console.log('Map flying to area bounds:', area.geometry.coordinates[0]);
      const latlngs = area.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
      console.log('Converted coordinates:', latlngs);
      const bounds = L.latLngBounds(latlngs);
      console.log('Created bounds:', bounds);
      mapRef.flyToBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true, duration: 1.5 });
      console.log('Map flyToBounds called');
    } else {
      console.log('Cannot fly to area - missing required data:', {
        hasMapRef: !!mapRef,
        hasGeometry: !!area.geometry,
        hasCoordinates: !!(area.geometry && area.geometry.coordinates),
        hasFirstRing: !!(area.geometry && area.geometry.coordinates && area.geometry.coordinates[0]),
        hasCoordinatesLength: !!(area.geometry && area.geometry.coordinates && area.geometry.coordinates[0] && area.geometry.coordinates[0].length > 0)
      });
    }

    showToast(`Selected area: ${area?.properties?.name ?? area?.name}`, 'info');
  }, [mapRef]);

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

  const handleSuggestionClick = useCallback((result) => {
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
  }, [mapRef]);

  // In handleCampaignSelect, also update localStorage and state
  const handleCampaignSelect = useCallback((campaign) => {
    setSelectedCampaign(campaign);
    localStorage.setItem('currentCampaign', JSON.stringify(campaign));
    // Campaign areas will be refreshed by useMapState when location is available
  }, [token]);

  // Show toast to select area after location is granted and initialized, and no area is selected
  // REMOVED: Area selection is now optional - users can navigate and place markers without selecting an area
  // useEffect(() => {
  //   if (permissionStatus === 'granted' && locationInitialized && !selectedAreaId) {
  //     setToast({ visible: true, message: 'Velg et område for å komme i gang.', type: 'info' });
  //   }
  // }, [permissionStatus, locationInitialized, selectedAreaId]);

  // Dismiss toast when area is selected
  // REMOVED: No longer needed since we don't show the area selection toast
  // useEffect(() => {
  //   if (selectedAreaId && toast.visible && toast.message === 'Velg et område for å komme i gang.') {
  //     setToast({ visible: false, message: '', type: '' });
  //   }
  // }, [selectedAreaId]);

  // Debug function to test map centering
  useEffect(() => {
    window.testMapCentering = () => {
      if (myLocation && mapRef) {
        mapRef.flyTo(myLocation, 16, {
          animate: true,
          duration: 1.5,
          easeLinearity: 0.25
        });
        hasCenteredOnLocation.current = true;
      }
    };

    return () => {
      delete window.testMapCentering;
    };
  }, [myLocation, permissionStatus, locationInitialized]);

  // TESTING: Permission check disabled for mobile testing
  // Fallback: Check if permission was granted after initial denial
  // useEffect(() => {
  //   if (permissionStatus === 'denied' && !locationInitialized) {
  //     const checkPermission = async () => {
  //       try {
  //         if (navigator.permissions && navigator.permissions.query) {
  //           const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
  //           if (permissionStatus.state === 'granted') {
  //             setPermissionStatus('granted');
  //             
  //             // Initialize location service
  //             await locationService.initialize(token, employee);
  //             
  //             // Initialize WebSocket connection
  //             try {
  //               await locationService.initializeWebSocket();
  //             } catch (wsError) {
  //               console.error('WebSocket connection failed:', wsError);
  //               setToast({ visible: true, message: 'Location tracking started (offline mode)', type: 'warning' });
  //             }
  //             
  //             // Start tracking
  //             await locationService.startTracking();
  //             setLocationInitialized(true);
  //             
  //             // Get current location
  //             const location = await locationService.getCurrentLocation();
  //             if (location) {
  //               const userLocation = [location.latitude, location.longitude];
  //               setMyLocation(userLocation);
  //               setShowMyLocation(true);
  //               setIsLocationTrackingActive(true);
  //               
  //               setToast({ visible: true, message: 'Location access granted! Map is now available.', type: 'success' });
  //             }
  //           }
  //         }
  //       } catch (err) {
  //         console.log('Permission check failed:', err);
  //       }
  //     };
  //     
  //     // Check immediately and then every 2 seconds
  //     checkPermission();
  //     const interval = setInterval(checkPermission, 2000);
  //     
  //     return () => clearInterval(interval);
  //   }
  // }, [permissionStatus, locationInitialized, token, employee]);

  // Only show map/tracking UI if permission granted and initialized
  // Area selection is now optional - users can navigate and place markers without selecting an area
  return (
    <div className="app-container">
      {isLoading && <LoadingIndicator fullScreen={true} />}
      <Toast
        toast={toast}
        onClose={() => setToast({ visible: false, message: '', type: '' })}
      />
      <LocationStatus
        locationService={locationService}
        permissionStatus={permissionStatus}
        onRequestPermission={handleRequestPermission}
        isRequestingLocation={isRequestingLocation}
      />
      {permissionStatus === 'granted' && locationInitialized && (
        <>
          {/* Locate Me Button */}
          <button
            className="locate-btn"
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              zIndex: 1200,
              borderRadius: '50%',
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              background: isLocationTrackingActive ? (showMyLocation ? '#1976d2' : '#f39c12') : '#fff',
              border: '2px solid #1976d2',
              color: isLocationTrackingActive ? '#fff' : '#1976d2',
              fontSize: 22,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={isLocationTrackingActive ?
              (showMyLocation ? "Klikk for å skjule markør (høyreklikk for å stoppe sporing)" : "Klikk for å vise markør (høyreklikk for å stoppe sporing)")
              : "Start posisjonssporing"}
            onClick={handleLocateMe}
            onContextMenu={(e) => {
              e.preventDefault();
              if (isLocationTrackingActive) {
                stopLocationTracking();
                setToast({ visible: true, message: 'Posisjonssporing stoppet', type: 'info' });
              }
            }}
          >
            <FaLocationArrow />
          </button>
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

          {/* Employee Toolbar - Area selection is optional and just for navigation help */}
          <EmployeeToolbar
            employee={employee}
            assignedAreas={nearbyAssignedAreas}
            allAreas={campaignAreas}
            onAreaSelect={handleAreaSelect}
            selectedAreaId={selectedAreaId}
            selectedCampaign={selectedCampaign}
            onLoadCarriers={loadCarrierMarkers}
            loadingCarriers={loadingCarriers}
          />
          {position ? (
            <MapContainer
              center={position}
              zoom={13}
              maxZoom={18}
              maxZoomAnimation={!isMobile}
              fadeAnimation={!isMobile}
              markerZoomAnimation={!isMobile}
              style={{ height: '100vh', width: '100%' }}
              ref={setMapRef}
              updateWhenZooming={false}
              updateWhenIdle={true}
              rotate={isRotationEnabled}
              touchRotate={isTouchRotationEnabled}
              tap={false}
              preferCanvas={false}
              bearing={bearing}
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
              <MapRotationController
                enableRotation={isRotationEnabled}
                enableTouchRotation={isTouchRotationEnabled}
                enableRotationControl={false}
                initialBearing={bearing}
                onRotationChange={handleRotationChange}
              />
              <MapEvents
                onMapClick={handleMapClick}
                clickGuardState={{
                  hasUploadedPopupOpen,
                  hasAddressMarkerPopupOpen,
                  shouldSuppressMapClick,
                  shouldSuppressUploadedPopupInterference
                }}
              />

              {/* Vector Tiles Layer - shows clusters at z=16, individual markers at z>=17 */}
              {mapRef && useVectorTiles && zoomLevel >= 16 && employee && (
                <VectorTileLayer
                  key={vectorLayerKey} // ✅ Change this ONLY on deletes
                  baseUrl={`${process.env.REACT_APP_TILE_SERVER_URL || 'http://localhost:8000'}/tiles/{z}/{x}/{y}.pbf?v={v}&campaign={campaignId}&buffer=256&extent=4096&cluster_buffer=128`}
                  v={tilesVersion}
                  campaignId={selectedCampaign?.id}
                  employeeId={null} // Don't filter by employee - show all markers in campaign including uploaded addresses
                  onFeatureClick={handleVectorTileClick}
                  onReady={(layer) => {
                    vectorTileLayerRef.current = layer;
                    console.log('✅ [App] Vector tile layer ready');
                  }}
                />
              )}

              {/* Optimistic markers overlay for immediate feedback */}
              {useVectorTiles && <OptimisticMarkerOverlay markers={optimisticMarkers} />}


              {/* Simple Rotation Control - Desktop only */}
              {!isMobile && (
                <MapUIControl
                  style={{
                    position: 'absolute',
                    bottom: 88,
                    right: 24,
                    zIndex: 1200
                  }}
                >
                  <SimpleRotationControl
                    bearing={bearing}
                    onRotate={rotateTo}
                    onReset={resetRotation}
                    isEnabled={isRotationEnabled}
                  />
                </MapUIControl>
              )}
              {/* Render all areas using Canvas polygon layer for stability */}
              <CanvasPolygonLayer
                polygons={campaignAreas?.map(area => {
                  const isAssigned = nearbyAssignedAreas.some(a => a.id === area.id);

                  // Check if area has valid polygon geometry
                  if (!area.polygon_geometry || !area.polygon_geometry.coordinates || !area.polygon_geometry.coordinates[0]) {
                    return null;
                  }

                  return {
                    id: `campaign-${area.id}`,
                    coordinates: area.polygon_geometry.coordinates,
                    color: area.color,
                    isAssigned,
                    ...area
                  };
                }).filter(Boolean) || []}
                styleFor={(props) => ({
                  color: props.color,
                  fillColor: props.color,
                  fillOpacity: props.isAssigned ? 0.5 : 0.15,
                  weight: props.isAssigned ? 4 : 2,
                  dashArray: null
                })}
                onPolygonClick={(props, latlng, eventType) => {
                  if (eventType === 'contextmenu') {
                    // Handle right-click/long-press for campaign areas
                    console.log('Campaign area context menu:', props);
                    // Add your campaign area context menu logic here
                  } else if (eventType === 'click') {
                    // Handle left-click for campaign areas
                    console.log('🟦 Campaign area clicked:', props);
                    // Directly trigger map click behavior to open FloatingAddressPopup
                    handleMapClick(latlng);
                  }
                }}
              />

              {/* Then render nearby assigned areas (filtered to only show areas that are also nearby campaign areas) */}
              <CanvasPolygonLayer
                polygons={nearbyAssignedAreas?.map(area => {
                  // Skip if this area is already rendered as a campaign area to avoid duplicates
                  const alreadyRendered = campaignAreas && campaignAreas.some(ca => ca.id === area.id);
                  if (alreadyRendered) {
                    return null;
                  }

                  // Check if area has valid polygon geometry
                  if (!area.polygon_geometry || !area.polygon_geometry.coordinates || !area.polygon_geometry.coordinates[0]) {
                    return null;
                  }

                  return {
                    id: `assigned-${area.id}`,
                    coordinates: area.polygon_geometry.coordinates,
                    color: area.color || '#1976d2',
                    ...area
                  };
                }).filter(Boolean) || []}
                styleFor={(props) => ({
                  color: props.color || '#1976d2',
                  fillColor: props.color || '#1976d2',
                  fillOpacity: 0.5,
                  weight: 4,
                  dashArray: null
                })}
                onPolygonClick={(props, latlng, eventType) => {
                  if (eventType === 'contextmenu') {
                    // Handle right-click/long-press for assigned areas
                    console.log('Assigned area context menu:', props);
                    // Add your assigned area context menu logic here
                  } else if (eventType === 'click') {
                    // Handle left-click for assigned areas
                    console.log('🔵 Assigned area clicked:', props);
                    // Directly trigger map click behavior to open FloatingAddressPopup
                    handleMapClick(latlng);
                  }
                }}
              />

              {/* Display locked areas with different styling - areas created by other managers */}
              {lockedAreas && lockedAreas.length > 0 && (
                <CanvasPolygonLayer
                  polygons={lockedAreas.map(area => {
                    // Handle MultiPolygon geometry properly
                    let coordinates = [];
                    if (area.polygon_geometry?.coordinates) {
                      if (area.polygon_geometry.type === 'MultiPolygon') {
                        // MultiPolygon: [[[[lng, lat], [lng, lat], ...]]]
                        // Flatten one level: [[[lng, lat], [lng, lat], ...]]
                        // CanvasPolygonLayer expects GeoJSON format [lng, lat]
                        coordinates = area.polygon_geometry.coordinates.flat();
                        console.log('🔒 [App] MultiPolygon locked area:', {
                          areaId: area.id,
                          coordinatesLength: coordinates.length,
                          firstRingLength: coordinates[0]?.length,
                          sample: coordinates[0]?.slice(0, 3)
                        });
                      } else {
                        // Regular Polygon: [[[lng, lat], [lng, lat], ...]]
                        // CanvasPolygonLayer expects GeoJSON format [lng, lat]
                        coordinates = area.polygon_geometry.coordinates || [];
                        console.log('🔒 [App] Polygon locked area:', {
                          areaId: area.id,
                          coordinatesLength: coordinates.length,
                          firstRingLength: coordinates[0]?.length,
                          sample: coordinates[0]?.slice(0, 3)
                        });
                      }
                    } else {
                      console.warn('⚠️ [App] Locked area missing geometry:', area.id);
                    }

                    if (!coordinates || coordinates.length === 0) {
                      console.warn('⚠️ [App] Locked area has no coordinates:', area.id);
                      return null;
                    }

                    return {
                      id: `locked-${area.id}`,
                      coordinates: coordinates,
                      color: '#ff6b6b', // Red color for locked areas
                      ...area
                    };
                  }).filter(Boolean)}
                  styleFor={(props) => ({
                    color: '#ff6b6b',           // Red border
                    fillColor: '#ff6b6b',       // Red fill
                    fillOpacity: 0.2,           // Semi-transparent
                    weight: 2,
                    dashArray: '10, 5'           // Dashed border for locked areas
                  })}
                  onPolygonClick={(props, latlng, eventType) => {
                    // Locked areas: prevent all popups - no interaction allowed
                    if (eventType === 'click') {
                      // Do nothing - no popups should open for any locked areas
                      console.log('🚫 [App] Click on locked area - interaction blocked');
                    }
                  }}
                  pane="lockedAreasPane"
                />
              )}

              {/* Show area pin marker for 5 seconds when area is selected */}
              {showAreaPin && areaPinPosition && (
                <Marker position={[areaPinPosition.lat, areaPinPosition.lng]} icon={areaPinIcon} />
              )}

              {/* Carrier markers layer - Talkmore/Telenor markers above areas */}
              {(() => {
                // Collect all features from all areas
                const allCarrierFeatures = [];
                carrierMarkers.forEach((features) => {
                  if (Array.isArray(features)) {
                    allCarrierFeatures.push(...features);
                  }
                });
                
                if (allCarrierFeatures.length > 0) {
                  return (
                    <TalkmoreMarkersLayer
                      features={allCarrierFeatures}
                      enabled={true}
                    />
                  );
                }
                return null;
              })()}

              {showMyLocation && myLocation && (
                <>
                  <Marker position={myLocation} icon={myLocationIcon}>
                    <Popup>Du er her</Popup>
                  </Marker>
                  {typeof myLocationAccuracy === 'number' && myLocationAccuracy > 0 && (
                    <Circle
                      center={myLocation}
                      radius={Math.max(10, myLocationAccuracy)}  // never smaller than 10m to remain visible
                      pathOptions={{ color: '#154c7d', fillColor: '#154c7d', fillOpacity: 0.15, weight: 1 }}
                    />
                  )}
                </>
              )}
              {/* Vector tiles replaced the old Canvas/Cluster layers above zoom 16 */}
              {/* All address and uploaded address markers are now rendered via VectorTileLayer */}

              {/* Floating Uploaded Address Popup - REMOVED FROM INSIDE MapContainer */}
              {/* This was causing interference - moved outside for complete isolation */}

              {/* Marker delete popup - REMOVED FROM INSIDE MapContainer */}
              {/* This was causing interference - moved outside for complete isolation */}
            </MapContainer>
          ) : (
            <div style={{
              height: '100vh',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f5f5f5'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h3>Getting your location...</h3>
                <p>Please allow location access to continue</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* FloatingAddressPopup - For PLACING NEW markers from vector tiles */}
      {/* This opens when clicking vector tiles to SELECT STATUS and place a new marker */}
      {(() => {
        const shouldRender = !!clickedInfo?.position;
        console.log('🔵🔵🔵 [App] FloatingAddressPopup RENDER CHECK (NEW MARKER):', {
          shouldRender,
          hasClickedInfo: !!clickedInfo,
          clickedInfo,
          hasPosition: !!clickedInfo?.position,
          addressId: clickedInfo?.addressId,
          address: clickedInfo?.address,
          source: clickedInfo?.source,
          timestamp: Date.now()
        });

        if (shouldRender) {
          const activeCampaign = resolveCampaign(selectedCampaign);
          const isTalkmoreNeiCampaign = isTalkmoreCampaign(activeCampaign);
          return (
            <FloatingAddressPopup
              clickedInfo={clickedInfo}
              onClose={closeAddressPopup}
              statusOptions={statusOptions}
              onStatusSelect={handleStatusSelect}
              isTalkmoreCampaign={isTalkmoreNeiCampaign}
              isStatusSubmitting={isStatusSubmitting}
              isCheckingApartments={isGeonorgeLoading}
              onOpenCampaignForm={openCampaignForm}
              onGeonorgeFallback={handleGeonorgeFallback}
              map={mapRef}
            />
          );
        }
        return null;
      })()}

      {/* NOTE: ApartmentSelectionPopup removed in Phase 4.
          Buildings with apartments now use BuildingSummaryCard + ApartmentListDrawer. */}

      {/* Floating Uploaded Address Popup - MOVED OUTSIDE MapContainer for complete isolation */}
      {/* 
        COMPLETE SOLUTION IMPLEMENTATION:
        
        1. MOVED OUTSIDE MapContainer: This popup is now completely isolated from Leaflet's event system
        2. ENHANCED EVENT ISOLATION: All events are stopped from propagating to the map
        3. TRIPLE PROTECTION SYSTEM: 
           - suppressNextMapClick(1000ms) - prevents map clicks for 1 second
           - (removed: cluster refresh prevention - not needed with vector tiles)  
           - suppressUploadedPopupInterference(1500ms) - prevents popup interference for 1.5 seconds
        4. HIGHEST Z-INDEX: 999999 ensures popup appears above all map elements
        5. STATE ISOLATION: Separate state management prevents conflicts with address popup
        6. FOCUS MANAGEMENT: Proper focus handling prevents keyboard event conflicts
        7. EVENT HANDLERS: All interactions prevent event bubbling to map
        
        This ensures that when a blue marker is clicked, the popup opens in complete isolation
        and doesn't interfere with any other map functionality or popups.
      */}
      {(() => {
        // DEBUG: Log the render condition evaluation
        const shouldRender = selectedMarker &&
          selectedMarker.isUploadedAddress &&
          selectedMarker.position &&
          typeof selectedMarker.position.lat === 'number' &&
          typeof selectedMarker.position.lng === 'number';

        if (shouldRender) {
          return (
            <>
              <FloatingUploadedAddressPopup
                key={`uploaded-popup-${selectedMarker.addressId}`}
                marker={selectedMarker}
                onClose={() => {
                  console.log('🔄 Closing uploaded address popup');
                  // SIMPLIFIED: Single operation to prevent race conditions
                  clearUploadedPopupState();
                  handleMarkerClick(null);
                  console.log('✅ Uploaded address popup closed - map clicks should work now');
                }}
                map={mapRef}
              />
            </>
          );
        }

        return null;
      })()}

      {/* FloatingAddressMarkerPopup - For VIEWING/DELETING EXISTING markers */}
      {/* This opens when clicking existing markers to VIEW STATUS and DELETE */}
      {(() => {
        const shouldRender = selectedMarker &&
          !selectedMarker.isUploadedAddress &&
          selectedMarker.position &&
          typeof selectedMarker.position.lat === 'number' &&
          typeof selectedMarker.position.lng === 'number';

        console.log('🔵🔵🔵 [App] FloatingAddressMarkerPopup RENDER CHECK (EXISTING MARKER):', {
          shouldRender,
          hasSelectedMarker: !!selectedMarker,
          selectedMarker,
          isUploadedAddress: selectedMarker?.isUploadedAddress,
          markerId: selectedMarker?.id || selectedMarker?.addressId,
          markerAddress: selectedMarker?.address,
          hasPosition: !!selectedMarker?.position,
          timestamp: Date.now()
        });

        if (shouldRender) {
          return (
            <>
              <FloatingAddressMarkerPopup
                key={`addr-popup-${selectedMarker.addressId || selectedMarker.id}`}
                marker={selectedMarker}
                onAddressUpdated={applyAddressMarkerUpdate}
                onDelete={handleDeleteMarker}
                onClose={() => {
                  console.log('🔄 Closing address marker popup');
                  clearAddressMarkerPopupState();
                  handleMarkerClick(null);
                  console.log('✅ Address marker popup closed - map clicks should work now');
                }}
                canDelete={true}
                mapRef={mapRef}
                token={token}
                employee={employee}
              />
            </>
          );
        }

        return null;
      })()}

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

      {/* Phase 2: Building Summary Card */}
      <BuildingSummaryCard
        isOpen={buildingSummary.isOpen}
        onClose={() => setBuildingSummary(prev => ({ ...prev, isOpen: false }))}
        buildingId={buildingSummary.buildingId}
        address={buildingSummary.address}
        totalUnits={buildingSummary.totalUnits}
        visitedUnits={buildingSummary.visitedUnits}
        markerColor={buildingSummary.markerColor}
        creatorName={buildingSummary.creatorName}
        creatorType={buildingSummary.creatorType}
        onOpenDrawer={handleOpenApartmentDrawer}
        onBuildingDeleted={(deletedBuildingId) => {
          console.log('🗑️ [App] Building deleted:', deletedBuildingId);
          // Close the summary card
          setBuildingSummary(prev => ({ ...prev, isOpen: false }));
          // Refresh tiles to remove the deleted building marker
          setTilesVersion(v => v + 1);
        }}
      />

      {/* Phase 2: Apartment List Drawer */}
      <ApartmentListDrawer
        isOpen={apartmentDrawer.isOpen}
        onClose={handleCloseApartmentDrawer}
        buildingId={apartmentDrawer.buildingId}
        baseAddress={apartmentDrawer.baseAddress}
        onTileRefresh={handleApartmentStatusChange}
        onOpenCampaignForm={openCampaignForm}
      />

    </div>
  );
}

export default App;