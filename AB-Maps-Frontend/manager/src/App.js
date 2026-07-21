import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { jitterLatLng } from './utils/geoJitter';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';
// Import leaflet guard BEFORE any other Leaflet components
import './leafletGuard';
// Import error tracker for comprehensive debugging
import './utils/errorTracker';
// Import vector tile debugger for additional monitoring
import './utils/vectorTileDebugger';
// Import vector tile click tester for systematic testing
import './utils/vectorTileClickTester';
import { FaUserCircle } from 'react-icons/fa';
import { SAFE_RENDER_MODE, DISABLE_ROTATION_ON_MOBILE } from './config/mapFlags.js';
import CanvasPolygonLayer from './components/map/CanvasPolygonLayer';
import useMapClickGuard from './hooks/useMapClickGuard';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Vector Tile imports
import VectorTileLayer from './components/map/VectorTileLayer';
import RotationSafePopup from './components/map/RotationSafePopupSystem';
import OptimisticMarkerOverlay from './components/map/OptimisticMarkerOverlay';
import TalkmoreMarkersLayer from './components/map/TalkmoreMarkersLayer';
import TalkmoreJobStatusPanel from './components/ui/TalkmoreJobStatusPanel';
import { VectorTileFeatureFlag, shouldUseVectorTiles } from './config/featureFlags';
import { refreshTiles } from './utils/tileRefresh';
import { forceViewportTileRefresh, smartViewportRefresh } from './utils/viewportTileRefresh';
import useVectorTilePerformance from './hooks/useVectorTilePerformance';
import './utils/vectorTileDevTools'; // Initialize dev tools
// Components
import MapController from './components/map/MapController';
import MapEvents from './components/map/MapEvents';
import useMapLongPress from './hooks/useMapLongPress';
import MapRotationController from './components/map/MapRotationController';
import DrawControl from './components/DrawControl';
import Toolbar from './components/ui/Toolbar';
import EnrichmentJobButton from './components/ui/EnrichmentJobButton';
import EnrichmentJobPopup from './components/ui/EnrichmentJobPopup';
import SearchBar from './components/ui/SearchBar';
import FloatingAddressMarkerPopup from './components/map/FloatingAddressMarkerPopup';
import FloatingAddressPopup from './components/map/FloatingAddressPopup';
import FloatingUploadedAddressPopup from './components/map/FloatingUploadedAddressPopup';
import AreaPopup from './components/ui/AreaPopup';
import FloatingForbiddenAreaPopup from './components/map/FloatingForbiddenAreaPopup';
import AreaDialog from './components/ui/AreaDialog';
import AssignEmployeesModal from './components/AssignEmployeesModal';
import LoadingIndicator from './components/ui/LoadingIndicator';
import Toast from './components/ui/Toast';
import UndoButton from './components/ui/UndoButton';

import ManagerSummaryDropdown from './components/ui/ManagerToolbar';
import EmployeeListPopup from './components/ui/EmployeeListPopup';
import RotationControl from './components/ui/RotationControl';
import TouchRotationHint from './components/ui/TouchRotationHint';
import MapUIControl from './components/ui/MapUIControl';
// import WebSocketTest from './components/ui/WebSocketTest';
import EmployeeLocationMarker from './components/EmployeeLocationMarker';
import EmployeeDetailsPopup from './components/EmployeeDetailsPopup';
import CampaignFormPopup from './components/ui/CampaignFormPopup';
import LocationStatus from './components/ui/LocationStatus';
// DEPRECATED: AgeStatsPopup import - feature temporarily disabled
// import AgeStatsPopup from './components/ui/AgeStatsPopup';

// Phase 2: Building and Apartment Components
import BuildingSummaryCard from './components/map/BuildingSummaryCard';
import ApartmentListDrawer from './components/map/ApartmentListDrawer';
import buildingService from './services/buildingService';

// Polygon Deletion Components (Superuser only)
import DeletionConfirmDialog from './components/ui/DeletionConfirmDialog';

import locationService from './services/locationService';
import { FaLocationArrow } from 'react-icons/fa';

// Hooks
import useMapState from './hooks/useMapState';
import { useEmployeeLocation } from './hooks/useEmployeeLocation';
import useMapRotation from './hooks/useMapRotation';
import useMobileDetection from './hooks/useMobileDetection';
import useCompassHeading from './hooks/useCompassHeading';
import { useAddresses } from './hooks/useAddresses';
import useTalkmoreAreaResults from './hooks/useTalkmoreAreaResults';
import useTalkmoreJob from './hooks/useTalkmoreJob';
import useEnrichmentJobTracker from './hooks/useEnrichmentJobTracker';

// Services
import { getAddressesInPolygon, reverseGeocode, getTileGeneration } from './services/apiService';
import managerWebSocketService from './services/managerWebSocketService';
import authService from './services/authService';
import { API_CONFIG } from './config/apiConfig';

// Utils
import { formatNorwegianAddress } from './utils/addressUtils';
import {
  logIsTalkmoreCampaign,
  resolveCampaign,
  isTalkmoreCampaign,
} from './utils/campaignUtils';

// Styles
import './App.css';

function AppContent() {
  const [isLoading, setIsLoading] = useState(false);

  
  // Map click guard for stable popup behavior (declare first)
  const {
    suppressNextMapClick,
    shouldSuppressMapClick,
    pauseClusterRefresh,
    isClusterRefreshPaused
  } = useMapClickGuard();

  // Vector Tile state (must be declared before useMapState)
  const [zoomLevel, setZoomLevel] = useState(13);
  const [tilesVersion, setTilesVersion] = useState(0);
  const [optimisticMarkers, setOptimisticMarkers] = useState([]);
  const [lastCreatedAddressId, setLastCreatedAddressId] = useState(null);

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

  // Delete Mode State (for polygon bulk deletion)
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);
  const [deletionPolygon, setDeletionPolygon] = useState(null);

  // Talkmore area-based results state
  const {
    features: talkmoreAreaFeatures,
    loading: talkmoreAreaLoading,
    error: talkmoreAreaError,
    fetchResultsByArea,
  } = useTalkmoreAreaResults();

  // Talkmore job-based results state (optional - for job_id in URL)
  const [talkmoreJobId, setTalkmoreJobId] = useState(null);
  const {
    jobStatus: talkmoreJobStatus,
    features: talkmoreJobFeatures,
    isLoading: talkmoreJobLoading,
    isConnected: talkmoreJobConnected,
    error: talkmoreJobError,
    requestStatus: requestTalkmoreJobStatus
  } = useTalkmoreJob(talkmoreJobId, !!talkmoreJobId); // Only connect if jobId exists

  // Phase 7: Enrichment job tracking (for area-based enrichment jobs)
  const {
    jobs: enrichmentJobs,
    addJob: addEnrichmentJob,
    removeJob: removeEnrichmentJob,
    getActiveJobs: getActiveEnrichmentJobs,
    hasActiveJobs: hasActiveEnrichmentJobs,
    activeJobsCount: activeEnrichmentJobsCount
  } = useEnrichmentJobTracker();

  // Phase 7: State for enrichment job popup
  const [isEnrichmentJobPopupOpen, setIsEnrichmentJobPopupOpen] = useState(false);

  // Phase 7: Handle enrichment job created callback
  const handleEnrichmentJobCreated = useCallback((jobId, areaId, areaName) => {
    console.log('[App] Enrichment job created:', { jobId, areaId, areaName, timestamp: new Date().toISOString() });
    try {
      addEnrichmentJob(jobId, areaId, areaName);
      console.log('[App] Enrichment job added to tracker successfully');
    } catch (error) {
      console.error('[App] Failed to add enrichment job to tracker:', {
        error: error.message,
        stack: error.stack,
        jobId,
        areaId,
        areaName,
        timestamp: new Date().toISOString()
      });
    }
  }, [addEnrichmentJob]);

  const {
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
    draftAreas,
    currentArea,
    showAreaDialog,
    editingAreaIndex,
    previewLine,
    currentAreaData,
    statusOptions,
    toast,
    currentUser,
    showOverlapToolbar,
    setShowOverlapToolbar,
    showCampaignForm,
    campaignFormData,
    isGeonorgeLoading,
    isFetchingAreas,
    // AssignEmployeesModal state
    showAssignEmployeesModal,
    assignEmployeesModalData,
    
    // Setters
    setMapRef,
    setCurrentAreaData,
    
    // Handlers
    handleMapClick,
    handleMapMove,
    getMarkerIcon,
    handleSearchSelect,
    handleSearchChange,
    toggleDrawing,
    handlePolygonCreated,
    handlePolygonEdited,
    handleAreaEdit,
    handleAreaDelete,
    handleAreaConfirm,
    handleAreaCancel,
    handlePolygonDeleted,
    finishDrawing,
    completeDrawingManually,
    cancelDrawing,
    handleAreaUpdate,
    handleUndo,
    handleMarkerClick,
    handleDeleteMarker,
    canDeleteMarker,
    handleAreaSelect,
    handleAreaDeleteDialog,
    openCampaignForm,
    closeCampaignForm,
    // Geonorge fallback handler
    handleGeonorgeFallback,
    // AssignEmployeesModal handlers
    openAssignEmployeesModal,
    closeAssignEmployeesModal,
    addMarkerWithIds,
    closeAddressPopup,
    closeUploadedAddressPopup,
    popupCounter,
    // Movement mode
    isMovementMode,
    toggleMovementMode,
    setMovementMode,
    // Area dialog state
    setShowAreaDialog,
    // State setters for vector tiles
    setClickedInfo,
    setSelectedMarker,
    setSearchQuery,  // For copy address functionality
    // Utility functions
    showToast,
    // Fetch areas handler
    fetchAreasInViewport,
    // Remove areas by IDs (for immediate deletion)
    removeAreasByIds,
    applyAddressMarkerUpdate,
  } = useMapState(suppressNextMapClick, shouldSuppressMapClick, {
    // Pass viewport refresh parameters
    setTilesVersion,
    // Phase 2: Pass building summary setter for Discovery Flow
    setBuildingSummary,
    // Delete mode parameters (polygon deletion)
    isDeleteMode,
    onDeleteModePolygonComplete: useCallback((polygonPoints) => {
      if (isDeleteMode) {
        console.log('[App] Delete mode polygon completed:', polygonPoints);
        setDeletionPolygon(polygonPoints);
        setShowDeletionDialog(true);
    }
  }, [isDeleteMode]),
    // Phase 7: Pass enrichment job created callback
    onEnrichmentJobCreated: handleEnrichmentJobCreated
  });

  // Store showToast in a ref to avoid TDZ issues
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // ── Live map updates (no manual refresh) ──────────────────────────────────
  // Poll the server "tile generation" for the active campaign; when it moves (any
  // create/update/delete by this manager OR anyone else), refetch the areas in view +
  // bump tilesVersion so the map updates on its own. Jittered 10–15s, compared client-side.
  const liveGenRef = useRef(null);
  const fetchAreasRef = useRef(fetchAreasInViewport);
  useEffect(() => { fetchAreasRef.current = fetchAreasInViewport; }, [fetchAreasInViewport]);
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const readCid = () => {
      const raw = localStorage.getItem('currentCampaign') || localStorage.getItem('selectedCampaign');
      if (!raw) return null;
      try { return JSON.parse(raw)?.id || null; } catch (e) { return raw; }
    };
    const tick = async () => {
      const cid = readCid();
      if (cid) {
        try {
          const gen = await getTileGeneration(cid);
          if (!cancelled && gen != null) {
            if (liveGenRef.current != null && gen !== liveGenRef.current) {
              setTilesVersion(v => v + 1);
              try { if (fetchAreasRef.current) await fetchAreasRef.current(); } catch (e) { /* keep polling */ }
            }
            liveGenRef.current = gen;
          }
        } catch (e) { /* transient — keep polling */ }
      }
      if (!cancelled) timer = setTimeout(tick, 10000 + Math.floor(Math.random() * 5000));
    };
    timer = setTimeout(tick, 3000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line
  }, []);

  // Handler for showing Talkmore results from AreaDialog
  // NOTE: Must be defined AFTER useMapState to access showToast and showAreaDialog
  const handleShowTalkmoreResults = useCallback(async (areaId) => {
    if (!areaId) {
      console.warn('[App] handleShowTalkmoreResults: No area ID provided');
      return;
    }

    try {
      const result = await fetchResultsByArea(areaId);
      // Results will be available in talkmoreAreaFeatures
      if (result && result.features && result.features.length > 0) {
        showToastRef.current(`Viser ${result.features.length} Talkmore-resultater på kartet`, 'success');
      } else {
        showToastRef.current('Ingen Talkmore-resultater funnet for dette området', 'info');
      }
    } catch (err) {
      console.error('[App] Error fetching Talkmore results:', err);
      showToastRef.current('Kunne ikke hente Talkmore-resultater', 'error');
    }
  }, [fetchResultsByArea]);

  // Talkmore area markers stay on the map after the area dialog closes; loading
  // results for another area replaces them (fetchResultsByArea overwrites features).

  // Debug: Expose map instance globally for dev tools
  useEffect(() => {
    if (mapRef && process.env.NODE_ENV === 'production') {
      window.mapInstance = mapRef;
    }
    // Always expose tilesVersion globally for popup components
    window.tilesVersion = tilesVersion;
  }, [mapRef, tilesVersion]);

  // Listen for tile version updates from popup components
  useEffect(() => {
    const handleTilesVersionUpdate = (event) => {
      const { version } = event.detail;
      
      // Update tiles version to trigger re-render
      setTilesVersion(version);
      
      // Also update global reference
      window.tilesVersion = version;
    };

    window.addEventListener('tilesVersionUpdate', handleTilesVersionUpdate);
    
    return () => {
      window.removeEventListener('tilesVersionUpdate', handleTilesVersionUpdate);
    };
  }, [tilesVersion]);

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

  // Mobile detection
  const isMobile = useMobileDetection();
  
  // Removed noisy feature flag console logs
  const { heading, direction, hasPermission: hasCompassPermission, requestPermission: requestCompassPermission } = useCompassHeading();
  const [showTouchHint, setShowTouchHint] = useState(false);

  const toolbarRef = useRef(null);
  const pressTimerRef = useRef(null);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [selectedAreaForEmployees, setSelectedAreaForEmployees] = useState(null);
  const [selectedEmployeeMarker, setSelectedEmployeeMarker] = useState(null);
  const [openEmployeePopupId, setOpenEmployeePopupId] = useState(null);
  const [selectedNonEditableArea, setSelectedNonEditableArea] = useState(null);
  // Unified popup state for area popups
  const [selectedAreaPopup, setSelectedAreaPopup] = useState(null);
  
  // Employee location visualization state
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState(null);
  const [showEmployeeFilters, setShowEmployeeFilters] = useState(false);
  const [employeeFilters, setEmployeeFilters] = useState({
    showOnline: true,
    showOffline: true,
    showActive: true,
    showInactive: true,
    showLabels: true,
    showOnlyAssigned: false,
    searchQuery: ''
  });
  
  // Campaign state
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('prompt');
  
  // DEPRECATED: Age Stats popup state - feature temporarily disabled
  // const [showAgeStatsPopup, setShowAgeStatsPopup] = useState(false);
  // const [isAgeStatsLoading, setIsAgeStatsLoading] = useState(false);
  const [showLocationToast, setShowLocationToast] = useState(false);
  const [locationInitialized, setLocationInitialized] = useState(false);
  const [myLocation, setMyLocation] = useState(null);
  const [myLocationAccuracy, setMyLocationAccuracy] = useState(null);
  const [showMyLocation, setShowMyLocation] = useState(false);
  const [isLocationTrackingActive, setIsLocationTrackingActive] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [poorAccuracyCount, setPoorAccuracyCount] = useState(0);
  const [hasShownPrecisionTip, setHasShownPrecisionTip] = useState(false);
  const myLocationTimeout = useRef(null);

  // Vector tiles configuration (state declared earlier)
  const useVectorTiles = VectorTileFeatureFlag.isEnabled() && shouldUseVectorTiles(zoomLevel);
  const performanceMetrics = useVectorTilePerformance(process.env.NODE_ENV === 'development');


  // Status → color map for address markers (NOT uploaded)
  const addressStatusColor = useMemo(() => ({
    ja: '#2ecc71',            // Green
    Ja: '#2ecc71',
    ikke_hjemme: '#f1c40f',   // Yellow
    'Ikke hjemme': '#f1c40f',
    nei: '#e74c3c',           // Red
    Nei: '#e74c3c'
  }), []);

  // Use employee location hook
  const {
    employeeMarkers: wsEmployeeMarkers,
    employeeLocationData,
    addEmployee,
    removeEmployee,
    requestEmployeeLocation,
    requestAllEmployees,
    onEmployeeLocationAvailable
  } = useEmployeeLocation();
  
  // Address management hook
  const {
    updateAddress,
    createAddress,
    deleteAddress,
    loading: addressLoading,
    error: addressError
  } = useAddresses();

  // Debug markers changes
  useEffect(() => {
    // Markers changed
  }, [markers]);

  // Debug uploaded addresses changes
  useEffect(() => {
    // Uploaded addresses changed
  }, [uploadedAddresses]);


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

  // Create proper panes for ordering
  useEffect(() => {
    if (!mapRef) return;
    
    // Areas pane (polygons)
    if (!mapRef.getPane('areasPane')) {
      mapRef.createPane('areasPane');
      mapRef.getPane('areasPane').style.zIndex = '560'; // polygons
    }

    // Vector tile pane (ABOVE areas, below markerPane)
    if (!mapRef.getPane('vectorTilePane')) {
      mapRef.createPane('vectorTilePane');
      mapRef.getPane('vectorTilePane').style.zIndex = '580'; // vector tiles ABOVE areas
    }

    // Talkmore markers pane (ABOVE areas, below vector tiles)
    if (!mapRef.getPane('talkmore-markers-pane')) {
      mapRef.createPane('talkmore-markers-pane');
      mapRef.getPane('talkmore-markers-pane').style.zIndex = '590'; // Talkmore markers ABOVE areas
    }
    
    // markerPane ~600, popupPane ~700 (Leaflet defaults)
  }, [mapRef]);

  // Track zoom level for mobile radius and jitter
  useEffect(() => {
    if (!mapRef) return;
    const onZoomEnd = () => setZoomLevel(mapRef.getZoom());
    mapRef.on('zoomend', onZoomEnd);
    return () => mapRef.off('zoomend', onZoomEnd);
  }, [mapRef]);

  // Mobile detection
  const isMobileDevice = isMobile || /iPhone|iPad|Android/i.test(navigator.userAgent);

  // Handle zoom changes for vector tiles
  useEffect(() => {
    if (!mapRef) return;
    
    const handleZoomEnd = () => {
      const zoom = mapRef.getZoom();
      setZoomLevel(zoom);
    };
    
    mapRef.on('zoomend', handleZoomEnd);
    return () => {
      mapRef.off('zoomend', handleZoomEnd);
    };
  }, [mapRef]);

  // Update selectedEmployeeForDetails when employee status changes
  useEffect(() => {
    if (selectedEmployeeForDetails && wsEmployeeMarkers.length > 0) {
      const updatedEmployee = wsEmployeeMarkers.find(emp => emp.id === selectedEmployeeForDetails.id);
      if (updatedEmployee && (
        updatedEmployee.is_online !== selectedEmployeeForDetails.is_online ||
        updatedEmployee.status !== selectedEmployeeForDetails.status ||
        updatedEmployee.last_seen !== selectedEmployeeForDetails.last_seen
      )) {
        setSelectedEmployeeForDetails(updatedEmployee);
      }
    }
  }, [wsEmployeeMarkers, selectedEmployeeForDetails]);

  // Make toast available globally for real-time updates
  useEffect(() => {
    if (toast && toast.showToast) {
      window.toast = toast;
    }
    return () => {
      delete window.toast;
    };
  }, [toast]);

  // Handler for copying address to search bar
  const handleCopyAddressToSearch = useCallback((address) => {
    setSearchQuery(address);
  }, [setSearchQuery]);

  // Load selected campaign from localStorage on mount
  useEffect(() => {
    // Check for different possible localStorage keys
    const storedCampaign = localStorage.getItem('currentCampaign') || localStorage.getItem('selectedCampaign');
    if (storedCampaign) {
      try {
        const campaign = JSON.parse(storedCampaign);
        setSelectedCampaign(campaign);
      } catch (error) {
        // If parsing fails, try to get campaign by ID
        const campaignId = storedCampaign;
        if (campaignId) {
          fetchCampaignById(campaignId);
        }
      }
    } else {
      // Do NOT set any default campaign if none is found
      setSelectedCampaign(null);
    }
  }, []);

  // Check for job_id in URL parameters (optional - for job-based viewing)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('job_id') || urlParams.get('jobId');
    if (jobId) {
      console.log('[App] Found job_id in URL:', jobId);
      setTalkmoreJobId(jobId);
    }
  }, []);

  // Migration: Ensure currentCampaign is always a full object, not just an ID string
  useEffect(() => {
    const stored = localStorage.getItem('currentCampaign');
    if (stored && typeof stored === 'string') {
      try {
        JSON.parse(stored); // If this works, it's already an object
      } catch {
        // If parsing fails, it's just an ID string
        fetchCampaignById(stored); // This will fetch and store the full object
      }
    }
  }, []);

  // Function to fetch campaign by ID
  const fetchCampaignById = async (campaignId) => {
    try {
      const apiBase = process.env.REACT_APP_API_URL;
      
      // Get authentication token
      let token = null;
      try {
        // Try to get token from authService first, then fallback to localStorage
        if (window.authService && window.authService.getAccessToken) {
          token = window.authService.getAccessToken();
        }
        // Fallback to localStorage if authService doesn't have token
        if (!token) {
          token = localStorage.getItem('accessToken') || localStorage.getItem('access_token');
        }
      } catch (error) {
        // Error getting auth token
      }
      
      // Prepare headers with authentication
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      const response = await fetch(`${apiBase}/campaigns/campaigns/${campaignId}/`, {
        method: 'GET',
        headers: headers
      });
      
      if (response.ok) {
        const campaign = await response.json();
        setSelectedCampaign(campaign);
        // Only overwrite if not already the same object
        const stored = localStorage.getItem('currentCampaign');
        let shouldOverwrite = true;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id === campaign.id) {
              shouldOverwrite = false;
            }
          } catch {}
        }
        if (shouldOverwrite) {
          localStorage.setItem('currentCampaign', JSON.stringify(campaign));
        }
      } else {
        // Failed to fetch campaign
        setSelectedCampaign(null);
      }
    } catch (error) {
      // Error fetching campaign
      setSelectedCampaign(null);
    }
  };

  // Phase 1: Talkmore campaign detection (console — NEI_SUBCATEGORY_TALKMORE_ONLY_PLAN.md)
  useEffect(() => {
    const resolvedCampaign = resolveCampaign(selectedCampaign);
    logIsTalkmoreCampaign(resolvedCampaign, 'manager/App');
  }, [selectedCampaign]);

  // WebSocket connection setup
  useEffect(() => {
  if (currentUser?.accessToken) {
      const connectWebSocket = async () => {
        try {
          let accessToken = currentUser.accessToken;
          // If token is a JSON string or object, extract access
          if (typeof accessToken === 'string') {
            try {
              const parsed = JSON.parse(accessToken);
              if (parsed && parsed.access) {
                accessToken = parsed.access;
              }
            } catch (e) {
              // Not a JSON string, use as is
            }
          } else if (typeof accessToken === 'object' && accessToken) {
            accessToken = accessToken;
          }
          
          // Connect to WebSocket (now handles token refresh internally)
          await managerWebSocketService.connect(accessToken);
          
          // Request initial employee data
          requestAllEmployees();
          // Subscribe to real-time employee updates
        } catch (error) {
          // WebSocket connection failed, but continuing with app...
          // The app can still function without WebSocket for basic features
        }
      };

      connectWebSocket();

      // Cleanup on unmount
      return () => {
        managerWebSocketService.disconnect();
      };
    }
  }, [currentUser, requestAllEmployees]);

  // Detect geolocation permission on mount and listen for changes
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
        setPermissionStatus(perm.state); // 'granted', 'prompt', or 'denied'
        perm.onchange = () => {
          setPermissionStatus(perm.state);
        };
      });
    }
  }, []);

  // Show toast if permission is not granted
  useEffect(() => {
    setShowLocationToast(permissionStatus !== 'granted');
  }, [permissionStatus]);

  // Listen to improved location service for marker + accuracy circle updates
  useEffect(() => {
    const onGood = ({ location }) => {
      // Always update location data (needed for map centering and other features)
      setMyLocation([location.latitude, location.longitude]);
      setMyLocationAccuracy(location.accuracy ?? null);
      
      // Only show marker if tracking is active
      if (isLocationTrackingActive) {
        setShowMyLocation(true);
      }
      
      // Reset poor accuracy count when accuracy improves
      if (location.accuracy <= 30) {
        setPoorAccuracyCount(0);
      }
    };

    const onWarm = ({ location }) => {
      // Always update location data (needed for map centering and other features)
      setMyLocation([location.latitude, location.longitude]);
      setMyLocationAccuracy(location.accuracy ?? null);
      
      // Only show marker if tracking is active
      if (isLocationTrackingActive) {
        setShowMyLocation(true);
      }
      
      // Track poor accuracy for iOS precision tip
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
  }, [isLocationTrackingActive]);

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

  // Auto-enable location tracking when user first gets permission
  useEffect(() => {
    if (permissionStatus === 'granted' && locationInitialized && !isLocationTrackingActive) {
      // User just got permission, automatically enable tracking and show marker
      setIsLocationTrackingActive(true);
      setShowMyLocation(true);
      
      // Make sure location service is actually started
      if (locationService.getStatus().permissionStatus === 'granted') {
        locationService.startTracking().catch(err => {
          console.error('Failed to start location tracking:', err);
        });
      }
    }
  }, [permissionStatus, locationInitialized, isLocationTrackingActive]);

  // Cleanup effect for location tracking
  useEffect(() => {
    return () => {
      if (locationInitialized) {
        locationService.destroy();
      }
      if (myLocationTimeout.current) clearTimeout(myLocationTimeout.current);
      stopLocationTracking();
    };
  }, [locationInitialized]);

  // Handler to request location permission
  const handleRequestPermission = async () => {
    setIsRequestingLocation(true);
    try {
      // Show loading state
      setShowLocationToast(false);
      
      // Request permission and get location
      const location = await locationService.requestLocationPermission();
      
      // Update permission status
      setPermissionStatus('granted');
      setLocationInitialized(true);
      
      // Center map on user location
      if (location && mapRef) {
        const userLocation = [location.latitude, location.longitude];
        setMyLocation(userLocation);
        setShowMyLocation(true);
        setIsLocationTrackingActive(true);
        
        // Smooth fly to user location
        mapRef.flyTo(userLocation, 16, { 
          animate: true, 
          duration: 1.5,
          easeLinearity: 0.25 
        });
        
        // Show success feedback
        if (toast && toast.showToast) {
          toast.showToast('Din posisjon er nå sentrert på kartet', 'success');
        }
      }
    } catch (error) {
      console.error('[App] Location permission request failed:', error);
      
      // Check the error message to determine the type of error
      const errorMsg = error.message || '';
      
      if (errorMsg.includes('Location access denied by browser') || errorMsg.includes('Permission denied')) {
        // Actual permission denial
        setPermissionStatus('denied');
        if (toast && toast.showToast) {
          toast.showToast('Tilgang til posisjon nektet av nettleseren', 'error');
        }
      } else if (errorMsg.includes('Unable to determine your location')) {
        // GPS hardware issue, but permission might be granted
        setPermissionStatus('granted'); // Permission is likely granted, just GPS failed
        if (toast && toast.showToast) {
          toast.showToast('Kunne ikke bestemme din posisjon. Sjekk GPS-innstillinger.', 'warning');
        }
      } else if (errorMsg.includes('taking longer than expected')) {
        // Timeout, but permission might be granted
        setPermissionStatus('granted'); // Permission is likely granted, just GPS timeout
        if (toast && toast.showToast) {
          toast.showToast('Det tar lengre tid enn forventet å hente posisjon. Prøv igjen.', 'warning');
        }
      } else {
        // Unknown error - don't assume denied
        setPermissionStatus('prompt');
        if (toast && toast.showToast) {
          toast.showToast(`Kunne ikke hente din posisjon: ${errorMsg}`, 'error');
        }
      }
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleTouchStart = (area, index, e) => {
    pressTimerRef.current = setTimeout(() => {
      // Long press detected
      handleAreaSelect(area, index, e.latlng);
    }, 500); // 500ms for a long press
  };

  const handleTouchEnd = () => {
    clearTimeout(pressTimerRef.current);
  };

  // Handler for hamburger menu
  const handleHamburgerClick = () => {
    if (showAreaDropdown) {
      setShowAreaDropdown(false);
    }
    // Optionally, you could add more logic here for other dropdowns
  };

  // Handler for View Areas button
  const handleViewAreas = () => setShowAreaDropdown((v) => !v);
  // Handler for area select in dropdown
  const handleAreaSelectDropdown = (area) => {
    setSelectedAreaForEmployees(area);
    setShowEmployeeList(true);
    setShowAreaDropdown(false);
  };
  // Handler for closing employee modal
  const handleCloseEmployeeList = () => {
    setShowEmployeeList(false);
    setSelectedAreaForEmployees(null);
  };
  
  // Handler for campaign selection — keeps React state, localStorage, AND authService.user
  // in sync so getCampaignId() (body campaign_id + X-Campaign-ID header) resolves immediately.
  const handleCampaignSelect = (campaign) => {
    setSelectedCampaign(campaign);
    authService.setCampaignId(campaign);
  };
    // Enhanced handler for employee select with better fly-to animation and WebSocket integration
  const handleEmployeeSelect = (employee) => {
    // Check if employee is online
    const isOnline = employee.is_online;
    
    // First, always request current location from server
    requestEmployeeLocation(employee.id);
    
    // Try multiple possible location property names
    const position = employee.currentPosition || 
                    employee.last_known_position || 
                    employee.location || 
                    employee.position ||
                    (employee.lat && employee.lng ? { lat: employee.lat, lng: employee.lng } : null) ||
                    (employee.latitude && employee.longitude ? { lat: employee.latitude, lng: employee.longitude } : null) ||
                    null;
    
    const hasLocation = position && position.lat && position.lng;
    
    if (mapRef && hasLocation) {
      // Enhanced fly-to animation with better parameters
      mapRef.flyTo(
        [position.lat, position.lng], 
        18, // Higher zoom level for better detail
        {
          animate: true,
          duration: 1.5, // Slightly longer duration for smoother animation
          easeLinearity: 0.25,
          noMoveStart: false // Allow movement to start immediately
        }
      );
      
      // Add employee to map if not already present
      addEmployee({
        ...employee,
        currentPosition: position
      });
      
      // Show appropriate toast notification
      if (toast && toast.showToast) {
        const statusText = isOnline ? 'Flying to' : 'Flying to last known location of';
        toast.showToast(`${statusText} ${employee.name || employee.full_name || `Employee ${employee.id}`}`, 'info');
      }
      

    } else {

      
      // Show appropriate message based on employee status
      if (toast && toast.showToast) {
        if (!isOnline) {
          toast.showToast(`${employee.name} is offline. Requesting last known location...`, 'info');
        } else {
          toast.showToast('Requesting current location from employee...', 'info');
        }
      }
      
      // Add employee to map - the useEmployeeLocation hook will handle location updates
      addEmployee(employee);
      
      // Register a callback to fly to the employee's location when it becomes available
      onEmployeeLocationAvailable(employee.id, (position) => {
        if (mapRef && position && position.lat && position.lng) {
          mapRef.flyTo([position.lat, position.lng], 18, {
            animate: true,
            duration: 1.5,
            easeLinearity: 0.25,
            noMoveStart: false
          });
          
          // Show success toast
          if (toast && toast.showToast) {
            toast.showToast(`Flying to ${employee.name}'s location`, 'success');
          }
        }
      });
      
      // If we have a map reference, fly to a reasonable zoom level for now
      if (mapRef) {
        const mapCenter = mapRef.getCenter();
        mapRef.flyTo([mapCenter.lat, mapCenter.lng], 13, {
          animate: true,
          duration: 1.0,
          easeLinearity: 0.25
        });
      }
    }
    setShowEmployeeList(false);
  };

  const handleEmployeeMarkerClick = (employee) => {
    setSelectedEmployeeMarker(employee);
    setSelectedEmployeeForDetails(employee);
    setShowEmployeeDetails(true);
  };

  const handleDeleteEmployeeMarker = (employeeId) => {
    removeEmployee(employeeId);
    setSelectedEmployeeMarker(null);
    setSelectedEmployeeForDetails(null);
    setShowEmployeeDetails(false);
  };

  const handleEmployeeFiltersChange = (newFilters) => {
    setEmployeeFilters(newFilters);
  };

  const handleToggleEmployeeFilters = () => {
    setShowEmployeeFilters(prev => !prev);
  };

  const handleFocusEmployeeLocation = (position) => {
    if (mapRef && position) {
      mapRef.flyTo([position.lat, position.lng], 18, {
        animate: true,
        duration: 1.5,
        easeLinearity: 0.25,
        noMoveStart: false
      });
    }
  };

  const handleRemoveEmployeeFromMap = (employeeId) => {
    removeEmployee(employeeId);
    setSelectedEmployeeForDetails(null);
    setShowEmployeeDetails(false);
  };



  // Filter employees based on current filters
  const filteredEmployees = wsEmployeeMarkers.filter(employee => {
    // Status filters
    const isOnline = employee.is_online;
    const isActive = employee.is_active;
    
    if (!employeeFilters.showOnline && isOnline) return false;
    if (!employeeFilters.showOffline && !isOnline) return false;
    if (!employeeFilters.showActive && isActive) return false;
    if (!employeeFilters.showInactive && !isActive) return false;
    
    // Assigned area filter
    if (employeeFilters.showOnlyAssigned && !employee.assigned_area) return false;
    
    // Search filter
    if (employeeFilters.searchQuery) {
      const searchTerm = employeeFilters.searchQuery.toLowerCase();
      const employeeName = (employee.name || employee.full_name || '').toLowerCase();
      const employeeId = employee.id.toString();
      
      if (!employeeName.includes(searchTerm) && !employeeId.includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  });

  // Helper to render both draft and saved areas
  const renderPolygon = (area, index, isDraft = false) => {
    if (!area || !area.polygon_geometry || !area.polygon_geometry.coordinates) return null;
    const currentManagerId = currentUser?.user_info?.id || currentUser?.user_id;
    const coords = area.polygon_geometry.coordinates[0];
    const borderColor = area.color || '#111';
    const fillColor = area.color || '#222';
    const borderWeight = isDraft ? 2 : 3;
    const dashArray = isDraft ? '4, 4' : null;
    const fillOpacity = isDraft ? 0.15 : 0.3;
    return (
      <Polygon
        key={area.id || `draft-${index}`}
        positions={coords.map(coord => [coord[1], coord[0]])}
        pathOptions={{
          color: borderColor,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          weight: borderWeight,
          dashArray: dashArray
        }}
        pane="areasPane"
        eventHandlers={{
          contextmenu: (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            // Suppress map clicks to prevent interference
            suppressNextMapClick(500);
            
            const areaId = area.id || area.properties?.id;
            const isAssigned = Array.isArray(assignedAreas) && assignedAreas.some(a => (a.id || a.properties?.id) === areaId);

            // Always open the AreaDialog for configuration on right-click/long-press
            // - Draft/new areas: open in create mode
            // - Saved areas: open in edit mode (regardless of assignment state)
            // Ensure any legacy Leaflet popups are closed before opening dialog
            try { setSelectedAreaPopup(null); } catch {}
            try { mapRef && mapRef.closePopup && mapRef.closePopup(); } catch {}
            if (isDraft || !area.name) {
              handleAreaEdit(index, true);
            } else {
              handleAreaEdit(index, false);
            }
          },
          click: (e) => {
            // Point-first inside polygon: if a point is near tap, open its popup; otherwise open address placement
            L.DomEvent.stopPropagation(e);
            try {
              if (mapRef) {
                const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
                const tapRadiusPx = isMobile ? 20 : 12;
                const p = mapRef.latLngToContainerPoint(e.latlng);
                const toDist = (pt) => {
                  const cp = mapRef.latLngToContainerPoint(pt.position);
                  const dx = cp.x - p.x; const dy = cp.y - p.y;
                  return Math.sqrt(dx*dx + dy*dy);
                };
                // Vector tiles handle all point detection automatically
              }
            } catch (err) {
            }
            // No point under tap: open address placement at clicked location
            handleMapClick(e.latlng);
          }
        }}
      />
    );
  };

  // Helper: point-in-polygon (ray casting) for [lat,lng] vertices
  const isPointInPolygon = (pointLat, pointLng, polygonCoords) => {
    let inside = false;
    for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
      const yi = polygonCoords[i][0]; // lat
      const xi = polygonCoords[i][1]; // lng
      const yj = polygonCoords[j][0];
      const xj = polygonCoords[j][1];
      const intersect = ((yi > pointLat) !== (yj > pointLat)) &&
        (pointLng < ((xj - xi) * (pointLat - yi)) / (yj - yi + 0.0) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Find area object under a given latlng (checks saved then drafts)
  const findAreaAtLatLng = (latlng) => {
    const { lat, lng } = latlng || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    // Check saved areas first
    if (Array.isArray(areas)) {
      for (let idx = 0; idx < areas.length; idx++) {
        const a = areas[idx];
        const ring = a?.polygon_geometry?.coordinates?.[0];
        if (Array.isArray(ring) && ring.length >= 3) {
          if (isPointInPolygon(lat, lng, ring.map(([x, y]) => [y, x]))) {
            return { area: a, index: idx, isDraft: false };
          }
        }
      }
    }
    // Check drafts
    if (Array.isArray(draftAreas)) {
      for (let idx = 0; idx < draftAreas.length; idx++) {
        const a = draftAreas[idx];
        const ring = a?.polygon_geometry?.coordinates?.[0];
        if (Array.isArray(ring) && ring.length >= 3) {
          if (isPointInPolygon(lat, lng, ring.map(([x, y]) => [y, x]))) {
            return { area: a, index: idx, isDraft: true };
          }
        }
      }
    }
    return null;
  };

  // Robust long-press using pointer events; only arm when starting inside an area
  const { suppressLongPress } = useMapLongPress(mapRef, {
    thresholdMs: 650,
    moveTolerancePx: 8,
    shouldArm: (latlng) => {
      // DON'T arm long press if movement mode is enabled
      if (isMovementMode) {
        return false;
      }
      
      // DON'T arm long press if a marker popup is already open
      if (selectedMarker || clickedInfo) {
        return false;
      }
      
      const hasArea = !!findAreaAtLatLng(latlng);
      return hasArea;
    },
    onLongPress: (latlng) => {
      
      try {
        // CRITICAL: Don't process long press if movement mode is enabled
        if (isMovementMode) {
          return;
        }
        
        // CRITICAL: Don't open area dialog if any popup is already open
        if (clickedInfo || selectedMarker || showAreaDialog) {
          return;
        }
        // Vector tiles handle all point clicks - no manual hit testing needed
      } catch {}

      const hit = findAreaAtLatLng(latlng);
      if (hit) {
        const { index, isDraft } = hit;
        suppressNextMapClick(800);
        suppressLongPress(900);
        try { setSelectedAreaPopup(null); } catch {}
        try { mapRef && mapRef.closePopup && mapRef.closePopup(); } catch {}
        handleAreaEdit(index, !!isDraft);
      }
    }
  });

  // Vector tile click handler - PHASE 2: Enhanced with marker_type routing
  const handleVectorTileClick = useCallback((properties, latlng) => {
    // CRITICAL: Skip feature click handling when in drawing or delete mode
    // Let the click propagate to the drawing handler instead
    if (isDrawingEnabled || isDeleteMode) {
      console.log('[handleVectorTileClick] Skipping - drawing/delete mode active');
      return;
    }
    
    // Track this event for debugging
    if (window.debugVectorTiles) {
      window.debugVectorTiles.trackEvent('handleVectorTileClick', {
        properties,
        latlng,
        propertiesType: typeof properties,
        latlngType: typeof latlng,
        hasProperties: !!properties,
        hasLatLng: !!latlng,
        latlngKeys: latlng ? Object.keys(latlng) : 'null/undefined'
      });
    }

    const zoom = mapRef?.getZoom?.() || 15;
    const markerType = properties.markerType || properties.marker_type;
  
    // Cluster → Zoom in
    if (properties.cluster) {
      pauseClusterRefresh(1000);
      const targetZoom = Math.min(zoom + 2, 19);
      mapRef.flyTo(latlng, targetZoom, { animate: true, duration: 0.6 });
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
        position: latlng,
        creatorName: properties.creator_name,
        creatorType: properties.creator_type
      });
      return;
    }

    // PHASE 2: Uploaded address → Show uploaded popup
    if (markerType === 'uploaded' || properties.isUploadedAddress || properties.source_table === 'uploaded_address') {
      const markerData = {
        id: properties.id,
        position: latlng,
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
      setSelectedMarker(markerData);
      return;
    }

    // PHASE 2: House (or legacy) → Show existing popup
    // Regular address (house marker or legacy without marker_type)
    const clickedInfoData = {
      addressId: properties.id,
      address: properties.address_text,
      position: latlng,
      status: properties.status,
      tags: typeof properties.tags === 'string' ? JSON.parse(properties.tags) : (properties.tags || {}),
      manager_id: properties.manager_id,
      employee_id: properties.employee_id,
      created_by_user_id: properties.created_by_user_id,
      campaign_id: properties.campaign_id,
      source_table: properties.source_table,
      isUploadedAddress: false,
      source: 'vectorTile', // Flag to indicate this came from vector tile click
      creator_name: properties.creator_name,
      creator_type: properties.creator_type
    };
    setClickedInfo(clickedInfoData);
  }, [mapRef, pauseClusterRefresh, setClickedInfo, setSelectedMarker, isDrawingEnabled, isDeleteMode]);

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

  // ===== DELETE MODE HANDLERS (Superuser only) =====
  
  // Toggle delete mode on/off
  const toggleDeleteMode = useCallback(() => {
    console.log('🗑️ [App.toggleDeleteMode] Called:', { isDrawingEnabled, isDeleteMode });
    
    setIsDeleteMode(prev => {
      const newState = !prev;
      console.log('🗑️ [App.toggleDeleteMode] Setting isDeleteMode:', prev, '→', newState);
      
      if (newState) {
        // Entering delete mode
        console.log('[App] Delete mode enabled - will enable drawing mode');
        showToast('Delete mode enabled - draw a polygon to select area for deletion', 'info');
        // Always enable drawing mode when entering delete mode
        // Use setTimeout to ensure state update completes first
        setTimeout(() => {
          console.log('🗑️ [App.toggleDeleteMode] Now calling toggleDrawing(), current isDrawingEnabled:', isDrawingEnabled);
          if (!isDrawingEnabled) {
            toggleDrawing();
          }
        }, 0);
      } else {
        // Exiting delete mode
        console.log('[App] Delete mode disabled');
        // Cancel any in-progress drawing
        if (isDrawingEnabled) {
          cancelDrawing();
        }
        // Clear deletion polygon
        setDeletionPolygon(null);
        setShowDeletionDialog(false);
      }
      return newState;
    });
  }, [isDrawingEnabled, isDeleteMode, toggleDrawing, cancelDrawing, showToast]);

  // Handle successful deletion - refresh tiles and reset state
  const handleDeletionComplete = useCallback((result) => {
    console.log('[App] Deletion completed:', result);
    
    // Step 1: Extract deleted area IDs from response
    const deletedAreaIds = result?.deleted?.areas?.ids || [];
    const deletedAreaCount = result?.deleted?.areas?.count || 0;
    
    if (deletedAreaIds.length > 0) {
      console.log(`[App] Removing ${deletedAreaIds.length} area(s) immediately:`, deletedAreaIds);
      
      // Step 2: Remove areas from React state immediately (optimistic update)
      if (removeAreasByIds) {
        removeAreasByIds(deletedAreaIds);
      }
      
      // Step 3: Visual feedback
      if (showToast && deletedAreaCount > 0) {
        showToast(`${deletedAreaCount} area${deletedAreaCount !== 1 ? 's' : ''} removed from map`, 'success');
      }
    } else if (deletedAreaCount > 0) {
      // Edge case: API returned count but no IDs - fall back to refetch
      console.warn('[App] Deletion returned area count but no IDs - falling back to refetch');
      if (fetchAreasInViewport) {
        fetchAreasInViewport();
      }
    }
    
    // Refresh vector tiles to show updated map (for addresses/markers)
    setTilesVersion(v => v + 1);
    
    // Only refetch areas if we didn't have IDs to remove directly
    // (This handles edge cases where IDs might be missing)
    if (deletedAreaIds.length === 0 && deletedAreaCount > 0 && fetchAreasInViewport) {
      console.log('[App] Refetching areas as fallback (no IDs provided)');
      fetchAreasInViewport();
    }
    
    // Reset delete mode state
    setIsDeleteMode(false);
    setDeletionPolygon(null);
    setShowDeletionDialog(false);
  }, [fetchAreasInViewport, removeAreasByIds, showToast]);

  // Handle deletion dialog close
  const handleDeletionDialogClose = useCallback(() => {
    setShowDeletionDialog(false);
    setDeletionPolygon(null);
    // Keep delete mode active so user can draw another polygon
  }, []);
  

  // Handle address updates with tile refresh
  const handleAddressUpdateWithTileRefresh = useCallback(async (addressData) => {
    try {
      // Show optimistic update
      const optimisticMarker = {
        id: addressData.id || addressData.addressId,
        position: addressData.position,
        status: addressData.status,
        isOptimistic: true
      };
      
      // Add to temporary overlay
      setOptimisticMarkers(prev => [...prev, optimisticMarker]);
      
      // Call the update function with correct signature
      const addressId = addressData.id || addressData.addressId;
      await updateAddress(addressId, addressData);
      
      // Refresh tiles
      refreshTiles(setTilesVersion);
      
      // Remove optimistic marker after delay
      setTimeout(() => {
        setOptimisticMarkers(prev => 
          prev.filter(m => m.id !== optimisticMarker.id)
        );
      }, 1000);
      
      showToast('Address updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update address:', error);
      showToast('Failed to update address', 'error');
      
      // Remove optimistic marker on error
      setOptimisticMarkers(prev => 
        prev.filter(m => m.id !== (addressData.id || addressData.addressId))
      );
    }
  }, [updateAddress, showToast]);

  // DEPRECATED: Age Stats popup handlers - feature temporarily disabled
  // const handleOpenAgeStats = () => {
  //   setShowAgeStatsPopup(true);
  // };

  // const handleCloseAgeStats = () => {
  //   setShowAgeStatsPopup(false);
  //   setIsAgeStatsLoading(false);
  // };

  // const handleFlyToArea = (coords, zoomLevel, area) => {
  //   if (mapRef && coords && coords.lat && coords.lng) {
  //     mapRef.flyTo([coords.lat, coords.lng], zoomLevel, {
  //       animate: true,
  //       duration: 1.5,
  //       easeLinearity: 0.25
  //     });
  //   }
  // };

  // Calculate manager summary info
  const managerName = currentUser?.user_info?.name || currentUser?.username || 'Unknown';
  // Defensive: filter out undefined/null/invalid areas
  const safeAreas = Array.isArray(areas) ? areas.filter(area => area && area.manager_id) : [];
  // Note: We're not filtering areas here anymore since the backend handles this
  // The areas variable contains all areas that the current user can see
  const onlineCount = wsEmployeeMarkers.filter(emp => emp.is_online).length;

  // Continuous location tracking effect + trigger initial nearby load
  useEffect(() => {
    let intervalId = null;
    if (permissionStatus === 'granted') {
      // Immediately get location
      locationService.getCurrentLocation().then(loc => {
        setMyLocation([loc.latitude, loc.longitude]);
      }).catch(() => {});
      // Poll every 30 seconds
      intervalId = setInterval(() => {
        locationService.getCurrentLocation().then(loc => {
          setMyLocation([loc.latitude, loc.longitude]);
        }).catch(() => {});
      }, 30000);
    } else {
      setMyLocation(null);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [permissionStatus]);

  // Handler to request location permission
  const handleLocateMe = async () => {
    try {
      // If we already have location data and tracking is active, center map and toggle visibility
      if (isLocationTrackingActive && myLocation) {
        // Always center the map on user's location first
        if (mapRef) {
          mapRef.flyTo(myLocation, 16, { 
            animate: true, 
            duration: 1.5,
            easeLinearity: 0.25 
          });
        }
        
        // Then toggle marker visibility
        const newShowState = !showMyLocation;
        setShowMyLocation(newShowState);
        if (toast && toast.showToast) {
          toast.showToast(newShowState ? 'Posisjonsmarkør vist' : 'Posisjonsmarkør skjult', 'info');
        }
        return;
      }

      // If we don't have permission, request it
      if (permissionStatus !== 'granted') {
        await handleRequestPermission();
        setIsLocationTrackingActive(true);
        setShowMyLocation(true);
        return;
      }

      // If we have permission but no location yet, start tracking
      if (permissionStatus === 'granted' && !myLocation) {
        await locationService.startTracking();
        setIsLocationTrackingActive(true);
        setShowMyLocation(true);
        if (toast && toast.showToast) {
          toast.showToast('Starter posisjonssporing...', 'info');
        }
        return;
      }

      // If we have permission and location, center map and show marker
      if (permissionStatus === 'granted' && myLocation) {
        // Center the map on user's location
        if (mapRef) {
          mapRef.flyTo(myLocation, 16, { 
            animate: true, 
            duration: 1.5,
            easeLinearity: 0.25 
          });
        }
        
        setIsLocationTrackingActive(true);
        setShowMyLocation(true);
        if (toast && toast.showToast) {
          toast.showToast('Posisjonsmarkør vist', 'info');
        }
        return;
      }
    } catch (e) {
      if (toast && toast.showToast) {
        toast.showToast('Kunne ikke starte posisjonssporing', 'error');
      }
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

  return (
    <div className="app-container">
      {/* Removed Inject Test Location dev button for production */}
      {/* <WebSocketTest />  // Temporarily disabled for now */}
      
      {/* Overlap toolbar removed: overlapping areas are allowed */}
      {isLoading && <LoadingIndicator fullScreen={true} />}
      
      <Toast toast={toast} />

      {/* Toast for location permission */}
      {showLocationToast && (
        <div style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 12px rgba(44,62,80,0.13)',
          padding: '16px 32px',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 16
        }}>
          <span>
            {isRequestingLocation 
              ? 'Henter din posisjon...' 
              : 'Slå på posisjonstjenester for sporing'
            }
          </span>
          {!isRequestingLocation && (
            <button
              style={{
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={handleRequestPermission}
              disabled={isRequestingLocation}
            >
              Tillat
            </button>
          )}
          {isRequestingLocation && (
            <div style={{
              width: 20,
              height: 20,
              border: '2px solid #f3f3f3',
              borderTop: '2px solid #1976d2',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
        </div>
      )}

      <MapContainer
        center={position}
        zoom={13}
        maxZoom={19}
        maxZoomAnimation={!isMobile}
        fadeAnimation={!isMobile}
        markerZoomAnimation={!isMobile}
        style={{ height: '100vh', width: '100%' }}
        ref={setMapRef}
        updateWhenZooming={false}
        updateWhenIdle={true}
        rotate={isRotationEnabled && !isMobile}
        touchRotate={isTouchRotationEnabled && !isMobile}
        // let Leaflet handle mobile tap/long-press → contextmenu
        tap={false}
        preferCanvas={false}
        bearing={isMobile ? 0 : bearing}
      >
        {isDrawingEnabled && <UndoButton onUndo={handleUndo} />}

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          maxNativeZoom={19}
          tileSize={256}
          zoomOffset={0}
        />
        
        {/* Vector Tiles Layer - only show when enabled and at appropriate zoom */}
        {mapRef && useVectorTiles && zoomLevel >= 16 && currentUser && (
          <VectorTileLayer
            baseUrl={`${process.env.REACT_APP_TILE_SERVER_URL || 'http://localhost:8000'}/tiles/{z}/{x}/{y}.pbf`}
            minZoom={16}
            maxZoom={22}
            managerId={currentUser?.manager_id}
            employeeId={currentUser?.employee_id}
            campaignId={authService.getCampaignId()}
            tilesVersion={tilesVersion}
            lastCreatedAddressId={lastCreatedAddressId}
            onFeatureClick={handleVectorTileClick}
            debugMode={process.env.REACT_APP_VECTOR_TILES_DEBUG === 'true' || process.env.NODE_ENV === 'development'}
            isRotationEnabled={isRotationEnabled}
            isDrawingEnabled={isDrawingEnabled}
            isDeleteMode={isDeleteMode}
          />
        )}
        
        {/* Optimistic markers overlay */}
        {useVectorTiles && <OptimisticMarkerOverlay markers={optimisticMarkers} />}
        
        {/* Talkmore enrichment markers (area-based and job-based results) */}
        <TalkmoreMarkersLayer 
          features={[...talkmoreAreaFeatures, ...talkmoreJobFeatures]} 
          enabled={talkmoreAreaFeatures.length > 0 || talkmoreJobFeatures.length > 0}
        />
        
        {/* Talkmore Job Status Panel (optional - only shown if job_id in URL) */}
        {talkmoreJobId && talkmoreJobStatus && (
          <div style={{
            position: 'absolute',
            top: '80px',
            right: '20px',
            zIndex: 1000,
            maxWidth: '400px'
          }}>
            <TalkmoreJobStatusPanel
              jobStatus={talkmoreJobStatus}
              isConnected={talkmoreJobConnected}
              isLoading={talkmoreJobLoading}
              error={talkmoreJobError}
              onRefresh={requestTalkmoreJobStatus}
            />
          </div>
        )}
        
        <Toolbar 
          isDrawingEnabled={isDrawingEnabled} 
          onToggleDrawing={toggleDrawing}
          isMovementMode={isMovementMode}
          onToggleMovement={toggleMovementMode}
          onCleanupAreaState={() => {
            setSelectedAreaPopup(null);
            setShowAreaDialog(false);
          }}
          onFetchAreas={fetchAreasInViewport}
          isFetchingAreas={isFetchingAreas}
          // Delete mode props
          isDeleteMode={isDeleteMode}
          onToggleDeleteMode={toggleDeleteMode}
          // Phase 7: Enrichment job tracking props
          activeEnrichmentJobsCount={activeEnrichmentJobsCount}
          onEnrichmentJobClick={() => setIsEnrichmentJobPopupOpen(true)}
        />
        
        {/* Rotation Control - Desktop Only */}
        {!isMobile && (
          <MapUIControl
            style={{ 
              position: 'absolute', 
              bottom: 88, 
              right: 24, 
              zIndex: 1200 
            }}
          >
            <RotationControl
              bearing={bearing}
              onRotate={rotateTo}
              onReset={resetRotation}
              isEnabled={isRotationEnabled}
            />
          </MapUIControl>
        )}

        {/* (Removed floating compass; heading is now shown on the my-location marker) */}


        
        {/* <DrawControl
          isEnabled={isDrawingEnabled}
          onPolygonCreated={handlePolygonCreated}
          onPolygonEdited={handlePolygonEdited}
          onPolygonDeleted={handlePolygonDeleted}
          getAddressesInPolygon={getAddressesInPolygon}
        /> */}
        
        <MapController onMapReady={setMapRef} />
        {!isMobile && (
          <MapRotationController 
            enableRotation={isRotationEnabled}
            enableTouchRotation={isTouchRotationEnabled}
            enableRotationControl={false}
            initialBearing={bearing}
            onRotationChange={handleRotationChange}
          />
        )}
        <MapEvents 
          onMapClick={(latlng) => { try { suppressLongPress(1200); } catch {}; handleMapClick(latlng); }} 
          onMapMove={handleMapMove} 
          shouldSuppressMapClick={shouldSuppressMapClick}
          onZoomEnd={(zoom) => setZoomLevel(zoom)}
          resolveTap={() => false}
          onContextMenu={(latlng) => {
            // Open Area config dialog via existing selector
            // Reuse the same flow as long-press handler but without requiring an area under cursor.
            // If you have a specific area resolve by latlng, add it here; otherwise create a placeholder selection.
            try {
              // Prevent following click from opening address popup
              suppressNextMapClick(1000);
              if (clickedInfo || selectedMarker) { try { suppressLongPress(800); } catch {}; return; }
              const hit = findAreaAtLatLng(latlng);
              if (hit) {
                const { area, index, isDraft } = hit;
                // Close any legacy popups before opening AreaDialog
                try { setSelectedAreaPopup(null); } catch {}
                try { mapRef && mapRef.closePopup && mapRef.closePopup(); } catch {}
                // Always route to AreaDialog for both draft and saved areas
                if (isDraft || !area.name) {
                  handleAreaEdit(index, true);
                } else {
                  handleAreaEdit(index, false);
                }
              } else {
              }
            } catch (e) {
              // Context menu trigger with no area resolver
            }
          }}
          isDrawingEnabled={isDrawingEnabled}
          finishDrawing={finishDrawing}
          cancelDrawing={cancelDrawing}
          completeDrawingManually={completeDrawingManually}
        />
        
        {/* Display preview line while drawing */}
        {previewLine && (
          <Polyline
            positions={[previewLine.start, previewLine.end]}
            pathOptions={{ 
              color: '#f1c40f', 
              dashArray: '10, 10',
              weight: 3,
              opacity: 0.9
            }}
          />
        )}

        {/* Display current area being drawn */}
        {currentArea.length > 0 && (
          <Polyline 
            positions={currentArea} 
            pathOptions={{ color: currentAreaData.color, weight: 3 }} 
          />
        )}
        
        {/* Manual completion button when drawing */}
        {isDrawingEnabled && currentArea.length >= 3 && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '2px solid #2ecc71'
          }}
          onClick={completeDrawingManually}
          title="Click to complete the area (or press Enter)"
          >
            ✓ Complete Area ({currentArea.length} points)
          </div>
        )}

        {/* Display draft areas using Canvas polygon layer for stability */}
        <CanvasPolygonLayer
          polygons={draftAreas?.map(area => ({
            id: `draft-${area.id}`,
            coordinates: area.polygon_geometry?.coordinates || [],
            color: area.color,
            ...area
          })) || []}
          styleFor={(props) => ({
            color: props.color || '#111',
            fillColor: props.color || '#222',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '4, 4'
          })}
          onPolygonClick={(props, latlng, eventType) => {
            if (eventType === 'contextmenu') {
              // Handle right-click/long-press for draft areas
              const areaId = props.id;
              const index = draftAreas.findIndex(a => a.id === areaId);
              if (index !== -1) {
                suppressNextMapClick(500);
                setSelectedAreaPopup(null);
                if (mapRef && mapRef.closePopup) mapRef.closePopup();
                handleAreaEdit(index, true); // true = isDraft
              }
            } else if (eventType === 'click') {
              // Handle left-click for draft areas
            }
          }}
          isMovementMode={isMovementMode}
        />
        
        {/* Display saved areas using Canvas polygon layer for stability */}
        <CanvasPolygonLayer
          polygons={areas?.map(area => ({
            id: area.id,
            coordinates: area.polygon_geometry?.coordinates || [],
            color: area.color,
            ...area
          })) || []}
          styleFor={(props) => ({
            color: props.color || '#111',
            fillColor: props.color || '#222',
            fillOpacity: 0.3,
            weight: 3,
            dashArray: null
          })}
          onPolygonClick={(props, latlng, eventType) => {
            
            if (eventType === 'contextmenu') {
              // Handle right-click/long-press for saved areas
              const areaId = props.id;
              const index = areas.findIndex(a => a.id === areaId);
              if (index !== -1) {
                suppressNextMapClick(500);
                setSelectedAreaPopup(null);
                if (mapRef && mapRef.closePopup) mapRef.closePopup();
                const isAssigned = Array.isArray(assignedAreas) && assignedAreas.some(a => a.id === areaId);
                handleAreaEdit(index, false); // false = not draft
              }
            } else if (eventType === 'click') {
              // Handle left-click for saved areas
              
            }
          }}
          isMovementMode={isMovementMode}
        />
        
        {/* Display locked areas with different styling */}
        <CanvasPolygonLayer
          polygons={lockedAreas?.map(area => {
            // Handle MultiPolygon geometry properly
            let coordinates = [];
            if (area.polygon_geometry?.coordinates) {
              if (area.polygon_geometry.type === 'MultiPolygon') {
                // For MultiPolygon, we need to flatten the coordinates
                // MultiPolygon: [[[[lng, lat], [lng, lat], ...]]]
                // We need: [[[lng, lat], [lng, lat], ...]]
                coordinates = area.polygon_geometry.coordinates.flat();
              } else {
                // For regular Polygon
                coordinates = area.polygon_geometry.coordinates || [];
              }
            }
            
            return {
              id: area.id,
              coordinates: coordinates,
              color: '#ff6b6b', // Red color for locked areas
              ...area
            };
          }) || []}
          styleFor={(props) => ({
            color: '#ff6b6b',
            fillColor: '#ff6b6b',
            fillOpacity: 0.2,
            weight: 2,
            dashArray: '10, 5' // Dashed border for locked areas
          })}
          onPolygonClick={(props, latlng, eventType) => {
            // Locked areas: prevent all popups - no interaction allowed
            if (eventType === 'click') {
              // Do nothing - no popups should open for any locked areas
              // This prevents both AreaPopup and FloatingAddressPopup
            }
          }}
          isMovementMode={isMovementMode}
          pane="lockedAreasPane"
        />
        
        {/* Render AreaPopup for areas if selected */}
        {selectedAreaPopup && (
          <AreaPopup
            area={{ ...selectedAreaPopup.area, position: selectedAreaPopup.position }}
            index={selectedAreaPopup.index}
            isEditable={selectedAreaPopup.editable}
            onUpdate={selectedAreaPopup.editable ? (index) => handleAreaEdit(index, false) : null}
            onDelete={selectedAreaPopup.editable ? (index) => handleAreaDelete(index) : null}
            onClose={() => setSelectedAreaPopup(null)}
          />
        )}
        



        
        {/* Employee location markers */}
        {filteredEmployees
          .filter(employee => employee.currentPosition && employee.currentPosition.lat && employee.currentPosition.lng)
          .map((employee) => (
            <EmployeeLocationMarker
              key={`employee-${employee.id}`}
              employee={employee}
              onClick={handleEmployeeMarkerClick}
              onDelete={handleDeleteEmployeeMarker}
              isSelected={selectedEmployeeMarker?.id === employee.id}
              showLabels={employeeFilters.showLabels}
            />
          ))}

        {/* Conditional popup rendering based on click source */}
        {clickedInfo && (
          <>
            {clickedInfo.source === 'vectorTile' && (
              <FloatingAddressMarkerPopup
                marker={{
                  addressId: clickedInfo.addressId,
                  address: clickedInfo.address,
                  position: clickedInfo.position,
                  status: clickedInfo.status,
                  tags: clickedInfo.tags,
                  manager_id: clickedInfo.manager_id,
                  employee_id: clickedInfo.employee_id,
                  campaign_id: clickedInfo.campaign_id,
                  source_table: clickedInfo.source_table,
                  isUploadedAddress: false,
                  creator_name: clickedInfo.creator_name,
                  creator_type: clickedInfo.creator_type
                }}
                onClose={closeAddressPopup}
                onDelete={handleDeleteMarker}
                canDelete={canDeleteMarker({
                  addressId: clickedInfo.addressId,
                  manager_id: clickedInfo.manager_id,
                  employee_id: clickedInfo.employee_id,
                  managerId: clickedInfo.manager_id,  // Also include camelCase for compatibility
                  employeeId: clickedInfo.employee_id  // Also include camelCase for compatibility
                })}
                onCopyAddress={handleCopyAddressToSearch}
                onAddressUpdated={(u) => {
                  applyAddressMarkerUpdate(u);
                  setClickedInfo((prev) =>
                    prev?.addressId === u.id
                      ? {
                          ...prev,
                          status: u.status,
                          nei_subcategory: u.nei_subcategory,
                        }
                      : prev
                  );
                }}
              />
            )}

            {clickedInfo.source === 'mapClick' && (
              (() => {
                const activeCampaign = resolveCampaign(selectedCampaign);
                const isTalkmoreNeiCampaign = isTalkmoreCampaign(activeCampaign);
                return (
              <FloatingAddressPopup
                clickedInfo={clickedInfo}
                onClose={closeAddressPopup}
                isCheckingApartments={isGeonorgeLoading}
                onGeonorgeFallback={handleGeonorgeFallback}
                isTalkmoreCampaign={isTalkmoreNeiCampaign}
                onAddMarker={(markerFromPopup) => {
                  /**
                   * Normalize the marker for vector tiles:
                   * - ensure addressId
                   * - ensure position {lat,lng}
                   * - flag it as NOT an uploaded address
                   */
                  const lat = markerFromPopup?.position?.lat ?? clickedInfo?.position?.lat;
                  const lng = markerFromPopup?.position?.lng ?? clickedInfo?.position?.lng;
                  const addressId = markerFromPopup?.addressId || markerFromPopup?.id || (() => {
                    // Simple UUID v4 generator for compatibility
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                      const r = Math.random() * 16 | 0;
                      const v = c === 'x' ? r : (r & 0x3 | 0x8);
                      return v.toString(16);
                    });
                  })();

                  const newMarker = {
                    ...markerFromPopup,
                    addressId,
                    position: { lat, lng },
                    isUploadedAddress: false,
                    // OPTIONAL: keep a concise status for styling/analytics
                    // expected to be one of: 'JA' | 'NEI' | 'IKKE_HEIME'
                    status: markerFromPopup?.status,
                  };

                  addMarkerWithIds(newMarker, useVectorTiles ? () => {
                    setLastCreatedAddressId(newMarker.addressId);
                    
                    // Immediate viewport refresh with ETag revalidation
                    // Backend Redis cache is already updated, browser ETag ensures freshness
                    smartViewportRefresh(
                      setTilesVersion, 
                      mapRef, 
                      newMarker.position
                    );
                    
                    // Also do a viewport refresh after 2 seconds to ensure all neighboring tiles updated
                    setTimeout(() => {
                      forceViewportTileRefresh(setTilesVersion);
                    }, 2000);
                  } : null);
                }}
                onOpenCampaignForm={openCampaignForm}
              />
                );
              })()
            )}
          </>
        )}



        {/* Regular address marker popup (blue markers) */}
        {selectedMarker && !selectedMarker.isUploadedAddress && (
          <FloatingAddressMarkerPopup
            marker={selectedMarker}
            onDelete={handleDeleteMarker}
            onClose={() => handleMarkerClick(null)}
            canDelete={canDeleteMarker(selectedMarker)}
            onAddressUpdated={applyAddressMarkerUpdate}
          />
        )}

        {/* Uploaded address marker popup (dark markers) */}
        {selectedMarker && 
         selectedMarker.isUploadedAddress && 
         selectedMarker.uploadedAddressData && 
         selectedMarker.position && 
         typeof selectedMarker.position.lat === 'number' &&
         typeof selectedMarker.position.lng === 'number' && (
          <FloatingUploadedAddressPopup
            marker={selectedMarker}
            onDelete={handleDeleteMarker}
            onClose={() => {
              closeUploadedAddressPopup();
            }}
            canDelete={canDeleteMarker(selectedMarker)}
          />
        )}
        {showMyLocation && myLocation && (
          <>
            <Marker key={`myloc-${Math.round(typeof heading === 'number' ? heading : (typeof bearing === 'number' ? bearing : 0))}`} position={myLocation} icon={L.divIcon({
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
                  <path d="M12.8 19.2c1.8-2 4.4-2.1 5.2-2.1c.8 0 3.4.1 5.2 2.1c.4.5.6 1 .6 1.6v1.7h-11.6v-1.7c0-.6.2-1.1.6-1.6z" fill="#154c7d"/>
                </svg>
              `,
              iconSize: [36, 36],
              iconAnchor: [18, 30],
              popupAnchor: [0, -30],
            })}>
              <Popup className="my-location-popup">Du</Popup>
            </Marker>
            {typeof myLocationAccuracy === 'number' && myLocationAccuracy > 0 && (
              <Circle
                center={myLocation}
                radius={Math.max(10, myLocationAccuracy)}
                pathOptions={{ color: '#154c7d', fillColor: '#154c7d', fillOpacity: 0.15, weight: 1 }}
              />
            )}
          </>
        )}
        
      </MapContainer>
      

      {/* Search bar */}
      <SearchBar 
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchResults={searchResults}
        isSearching={isSearching}
        onSearchSelect={handleSearchSelect}
      />

      {/* Area configuration dialog */}
              <AreaDialog
          showDialog={showAreaDialog}
          areaData={currentAreaData}
          onDataChange={setCurrentAreaData}
          onConfirm={handleAreaConfirm}
          onCancel={handleAreaCancel}
          onDelete={handleAreaDeleteDialog}
          areaId={(() => {
            if (editingAreaIndex === null) return null;
            if (currentAreaData?.isDraft) return null;
            return areas?.[editingAreaIndex]?.id ?? null;
          })()}
          areaIndex={editingAreaIndex}
          onAddEmployee={openAssignEmployeesModal}
          draftAreas={draftAreas}  // NEW: Pass draftAreas for status syncing
          onShowTalkmoreResults={handleShowTalkmoreResults}  // NEW: Talkmore results handler
          talkmoreResultsLoading={talkmoreAreaLoading}  // NEW: Loading state
          isTalkmoreCampaign={isTalkmoreCampaign(resolveCampaign(selectedCampaign))}  // gate button to Talkmore campaigns
        />

      <ManagerSummaryDropdown
        managerName={managerName}
        onlineCount={onlineCount}
        open={showAreaDropdown}
        onToggle={() => setShowAreaDropdown(v => !v)}
        onAreaSelect={handleAreaSelectDropdown}
        selectedCampaign={selectedCampaign}
        onCampaignSelect={handleCampaignSelect}
      />

      {showEmployeeList && selectedAreaForEmployees && (
        <EmployeeListPopup
          area={selectedAreaForEmployees}
          onEmployeeSelect={handleEmployeeSelect}
          onClose={handleCloseEmployeeList}
        />
      )}

      {/* Employee Details Popup */}
      <EmployeeDetailsPopup
        employee={selectedEmployeeForDetails}
        isOpen={showEmployeeDetails}
        onClose={() => {
          setShowEmployeeDetails(false);
          setSelectedEmployeeForDetails(null);
        }}
        onFocusLocation={handleFocusEmployeeLocation}
        onRemoveEmployee={handleRemoveEmployeeFromMap}
      />

      {/* Campaign Form Popup */}
      <CampaignFormPopup
        isOpen={showCampaignForm}
        onClose={closeCampaignForm}
        campaignId={campaignFormData.campaignId}
        addressId={campaignFormData.addressId}
        salesRepId={campaignFormData.salesRepId}
        addressData={campaignFormData.addressData}
      />

      {/* Locate-me button appears only if permission is granted */}
      {permissionStatus === 'granted' && (
        <button
          className="locate-btn"
          style={{ 
            position: 'absolute', 
            bottom: 24, 
            right: 24, 
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
            transition: 'background 0.2s' 
          }}
          title={isLocationTrackingActive ? 
            (showMyLocation ? "Klikk for å skjule markør (høyreklikk for å stoppe sporing)" : "Klikk for å vise markør (høyreklikk for å stoppe sporing)") 
            : "Start posisjonssporing"}
          onClick={handleLocateMe}
          onContextMenu={(e) => {
            e.preventDefault();
            if (isLocationTrackingActive) {
              stopLocationTracking();
              if (toast && toast.showToast) {
                toast.showToast('Posisjonssporing stoppet', 'info');
              }
            }
          }}
        >
          <FaLocationArrow />
        </button>
      )}

      {/* Touch Rotation Hint for Mobile */}
      {isMobile && (
        <TouchRotationHint
          isVisible={showTouchHint}
          onClose={() => setShowTouchHint(false)}
        />
      )}

      {/* Phase 7: Enrichment Job Popup */}
      <EnrichmentJobPopup
        jobs={getActiveEnrichmentJobs()}
        isOpen={isEnrichmentJobPopupOpen}
        onClose={() => setIsEnrichmentJobPopupOpen(false)}
      />

      {/* Assign Employees Modal */}
      <AssignEmployeesModal
        key={`${showAssignEmployeesModal ? 'open' : 'closed'}-${assignEmployeesModalData.areaId || 'none'}`}
        isOpen={showAssignEmployeesModal}
        onClose={closeAssignEmployeesModal}
        areaId={assignEmployeesModalData.areaId}
        areaName={assignEmployeesModalData.areaName}
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

      {/* DEPRECATED: Age Statistics Popup - feature temporarily disabled */}
      {/* <AgeStatsPopup
        isOpen={showAgeStatsPopup}
        onClose={handleCloseAgeStats}
        onFlyToArea={handleFlyToArea}
        showToast={showToast}
        lockedAreas={lockedAreas}
      /> */}

      {/* Polygon Deletion Confirmation Dialog */}
      <DeletionConfirmDialog
        isOpen={showDeletionDialog}
        onClose={handleDeletionDialogClose}
        polygon={deletionPolygon}
        onDeletionComplete={handleDeletionComplete}
        showToast={showToast}
      />

    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;