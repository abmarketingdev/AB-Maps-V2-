import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FaUserCircle } from 'react-icons/fa';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Components
import MapController from './components/map/MapController';
import MapEvents from './components/map/MapEvents';
import DrawControl from './components/DrawControl';
import Toolbar from './components/ui/Toolbar';
import SearchBar from './components/ui/SearchBar';
import AddressPopup from './components/ui/AddressPopup';
import AreaPopup from './components/ui/AreaPopup';
import AreaDialog from './components/ui/AreaDialog';
import LoadingIndicator from './components/ui/LoadingIndicator';
import DrawingTooltip from './components/ui/DrawingTooltip';
import Toast from './components/ui/Toast';
import UndoButton from './components/ui/UndoButton';
import MarkerDeletePopup from './components/ui/MarkerDeletePopup';
import ManagerSummaryDropdown from './components/ui/ManagerToolbar';
import EmployeeListPopup from './components/ui/EmployeeListPopup';
// import WebSocketTest from './components/ui/WebSocketTest';
import EmployeeLocationMarker from './components/EmployeeLocationMarker';
import EmployeeDetailsPopup from './components/EmployeeDetailsPopup';
import CampaignFormPopup from './components/ui/CampaignFormPopup';

// Hooks
import useMapState from './hooks/useMapState';
import { useEmployeeLocation } from './hooks/useEmployeeLocation';

// Services
import { getAddressesInPolygon, reverseGeocode } from './services/apiService';
import managerWebSocketService from './services/managerWebSocketService';

// Utils
import { formatNorwegianAddress } from './utils/addressUtils';



// Styles
import './App.css';

function AppContent() {
  const [isLoading, setIsLoading] = useState(false);
  console.log('[AppContent] is mounting');
  const {
    // State
    position,
    clickedInfo,
    markers,
    selectedMarker,
    selectedArea,
    mapRef,
    searchQuery,
    searchResults,
    isSearching,
    isDrawingEnabled,
    areas,
    draftAreas,
    currentArea,
    showAreaDialog,
    previewLine,
    currentAreaData,
    statusOptions,
    drawingTooltip,
    toast,
    currentUser,
    showOverlapToolbar,
    setShowOverlapToolbar,
    showCampaignForm,
    campaignFormData,
    
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
    addMarkerWithIds,
    closeAddressPopup,
  } = useMapState();

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

  // Debug markers changes
  useEffect(() => {
    console.log('[DEBUG] Markers changed:', markers);
    console.log('[DEBUG] Markers count:', markers.length);
  }, [markers]);

  // Update selectedEmployeeForDetails when employee status changes
  useEffect(() => {
    if (selectedEmployeeForDetails && wsEmployeeMarkers.length > 0) {
      const updatedEmployee = wsEmployeeMarkers.find(emp => emp.id === selectedEmployeeForDetails.id);
      if (updatedEmployee && (
        updatedEmployee.is_online !== selectedEmployeeForDetails.is_online ||
        updatedEmployee.status !== selectedEmployeeForDetails.status ||
        updatedEmployee.last_seen !== selectedEmployeeForDetails.last_seen
      )) {
        console.log('Updating selectedEmployeeForDetails with new status:', updatedEmployee);
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

  // Load selected campaign from localStorage on mount
  useEffect(() => {
    console.log('Loading campaign from localStorage...');
    
    // Log all localStorage items to see what's available
    console.log('All localStorage items:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      console.log(`${key}:`, value);
    }
    
    // Check for different possible localStorage keys
    const storedCampaign = localStorage.getItem('currentCampaign') || localStorage.getItem('selectedCampaign');
    console.log('Stored campaign:', storedCampaign);
    
    if (storedCampaign) {
      try {
        const campaign = JSON.parse(storedCampaign);
        console.log('Parsed campaign:', campaign);
        setSelectedCampaign(campaign);
      } catch (error) {
        console.error('Error parsing stored campaign:', error);
        // If parsing fails, try to get campaign by ID
        const campaignId = storedCampaign;
        if (campaignId) {
          fetchCampaignById(campaignId);
        }
      }
          } else {
        // Check if there's a campaign_id in localStorage or URL
        const campaignId = localStorage.getItem('campaign_id') || new URLSearchParams(window.location.search).get('campaign_id');
        if (campaignId) {
          console.log('Found campaign_id:', campaignId);
          fetchCampaignById(campaignId);
        } else {
        // Set a default campaign for manager
        const defaultCampaign = {
          id: 'c333b56c-a938-41bc-9387-4592c8548b95',
          name: 'Nosk Folk',
          description: 'Default campaign for manager view'
        };
        console.log('Setting default campaign:', defaultCampaign);
        setSelectedCampaign(defaultCampaign);
        localStorage.setItem('currentCampaign', JSON.stringify(defaultCampaign));
      }
    }
  }, []);

  // Function to fetch campaign by ID
  const fetchCampaignById = async (campaignId) => {
    try {
      console.log('Fetching campaign by ID:', campaignId);
      const response = await fetch(`https://ab-maps-backend-production.onrender.com/api/campaigns/${campaignId}/`);
      if (response.ok) {
        const campaign = await response.json();
        console.log('Fetched campaign:', campaign);
        setSelectedCampaign(campaign);
        localStorage.setItem('currentCampaign', JSON.stringify(campaign));
      } else {
        console.error('Failed to fetch campaign:', response.status);
        // Fallback to default campaign
        const defaultCampaign = {
          id: campaignId,
          name: 'Nosk Folk',
          description: 'Campaign'
        };
        setSelectedCampaign(defaultCampaign);
        localStorage.setItem('currentCampaign', JSON.stringify(defaultCampaign));
      }
    } catch (error) {
      console.error('Error fetching campaign:', error);
      // Fallback to default campaign
      const defaultCampaign = {
        id: campaignId,
        name: 'Nosk Folk',
        description: 'Campaign'
      };
      setSelectedCampaign(defaultCampaign);
      localStorage.setItem('currentCampaign', JSON.stringify(defaultCampaign));
    }
  };

  // WebSocket connection setup
  console.log('before useEffect');
  useEffect(() => {
      console.log('if condition:', !!currentUser, !!currentUser?.accessToken, (currentUser && currentUser.accessToken));
  console.log('[Before Going INTO IF] currentUser', currentUser);
  console.log('[Before Going INTO IF] currentUser.accessToken', currentUser?.accessToken);
  if (currentUser?.accessToken) {
      console.log('Setting up WebSocket connection for manager dashboard');
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
          console.log('Manager WebSocket connected successfully');
          
          // Request initial employee data
          requestAllEmployees();
          // Subscribe to real-time employee updates
        } catch (error) {
          console.error('Failed to connect to Manager WebSocket:', error);
          console.log('WebSocket connection failed, but continuing with app...');
          // Don't close the window on WebSocket failure - just log the error
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
  
  // Handler for campaign selection
  const handleCampaignSelect = (campaign) => {
    setSelectedCampaign(campaign);
    // Store campaign in localStorage for persistence
    localStorage.setItem('currentCampaign', JSON.stringify(campaign));
  };
    // Enhanced handler for employee select with better fly-to animation and WebSocket integration
  const handleEmployeeSelect = (employee) => {
    console.log('Employee selected:', employee);
    console.log('Employee keys:', Object.keys(employee));
    console.log('Employee location data:', {
      currentPosition: employee.currentPosition,
      location: employee.location,
      position: employee.position,
      lat: employee.lat,
      lng: employee.lng,
      recent_locations: employee.recent_locations
    });
    
    // Check if employee is online
    const isOnline = employee.is_online;
    
    // First, always request current location from server
    requestEmployeeLocation(employee.id);
    console.log(`Requested current location for employee ${employee.id}`);
    
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
      
      console.log(`Flying to employee: ${employee.name || employee.full_name} at position:`, position);
    } else {
      console.log('Employee has no immediate location data, adding to map and requesting location...');
      
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
          console.log(`Flying to employee ${employee.name} at position:`, position);
          
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
        eventHandlers={{
          contextmenu: (e) => {
            L.DomEvent.stopPropagation(e);
            if (isDraft || !area.name) {
              handleAreaEdit(index, true);
            } else if (area.manager_id === currentUser.id) {
              handleAreaEdit(index, false);
            } else {
              setSelectedAreaPopup({ area, index, editable: false, position: e.latlng });
            }
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            if (!isDraft && area.manager_id !== currentUser.id) {
              setSelectedAreaPopup({ area, index, editable: false, position: e.latlng });
            } else {
              handleMapClick(e.latlng);
            }
          }
        }}
      />
    );
  };

  // Calculate manager summary info
  const managerName = currentUser?.user_info?.name || currentUser?.username || 'Unknown';
  // Defensive: filter out undefined/null/invalid areas
  const safeAreas = Array.isArray(areas) ? areas.filter(area => area && area.manager_id) : [];
  console.log('DEBUG: areas from backend:', areas);
  console.log('DEBUG: currentUser:', currentUser);
  console.log('DEBUG: markers array:', markers);
  console.log('DEBUG: markers count:', markers.length);
  // Note: We're not filtering areas here anymore since the backend handles this
  // The areas variable contains all areas that the current user can see
  const onlineCount = wsEmployeeMarkers.filter(emp => emp.is_online).length;

  return (
    <div className="app-container">
      {/* <WebSocketTest />  // Temporarily disabled for now */}
      
      {showOverlapToolbar && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          background: '#e74c3c',
          color: 'white',
          zIndex: 2000,
          padding: '16px 0',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
        }}>
          Området overlapper et eksisterende område! <button style={{marginLeft: 16, background: 'white', color: '#e74c3c', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 'bold', cursor: 'pointer'}} onClick={() => setShowOverlapToolbar(false)}>Lukk</button>
        </div>
      )}
      {isLoading && <LoadingIndicator fullScreen={true} />}
      
      <Toast toast={toast} />

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
        {isDrawingEnabled && <UndoButton onUndo={handleUndo} />}

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
          maxNativeZoom={18}
          tileSize={256}
          zoomOffset={0}
        />
        
        <Toolbar 
          isDrawingEnabled={isDrawingEnabled} 
          onToggleDrawing={toggleDrawing} 
        />
        
        {/* <DrawControl
          isEnabled={isDrawingEnabled}
          onPolygonCreated={handlePolygonCreated}
          onPolygonEdited={handlePolygonEdited}
          onPolygonDeleted={handlePolygonDeleted}
          getAddressesInPolygon={getAddressesInPolygon}
        /> */}
        
        <MapController onMapReady={setMapRef} />
        <MapEvents 
          onMapClick={handleMapClick} 
          onMapMove={handleMapMove} 
          isDrawingEnabled={isDrawingEnabled}
          finishDrawing={finishDrawing}
          cancelDrawing={cancelDrawing}
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

        {/* Display draft areas */}
        {draftAreas && draftAreas.map((area, index) => renderPolygon(area, index, true))}
        {/* Display saved areas */}
        {areas && areas.map((area, index) => renderPolygon(area, index, false))}
        
        {/* Render AreaPopup for non-editable area if selected */}
        {selectedAreaPopup && !selectedAreaPopup.editable && (
          <AreaPopup
            area={{ ...selectedAreaPopup.area, position: selectedAreaPopup.position }}
            index={selectedAreaPopup.index}
            isEditable={false}
            onUpdate={null}
            onDelete={null}
            onClose={() => setSelectedAreaPopup(null)}
          />
        )}
        
        {/* Address markers (temporarily without clustering for debugging) */}
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
          {markers.map((marker, index) => (
            <Marker
              key={marker.addressId || `marker-${index}`}
              position={[marker.position.lat, marker.position.lng]}
              icon={getMarkerIcon(marker.status)}
              eventHandlers={{
                click: () => handleMarkerClick(marker, index),
              }}
            />
          ))}
        </MarkerClusterGroup>
        
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

        {/* Address popup for clicked locations */}
        {clickedInfo && (
          <AddressPopup
            position={clickedInfo.position}
            addresses={clickedInfo.addresses}
            onClose={closeAddressPopup}
            onAddMarker={(marker) => {
              addMarkerWithIds(marker);
              closeAddressPopup(); // Close popup after adding marker
            }}
            onOpenCampaignForm={openCampaignForm}
          />
        )}

        {/* Area configuration dialog */}
        {showAreaDialog && (
          <AreaDialog
            areaData={currentAreaData}
            onDataChange={setCurrentAreaData}
            onConfirm={handleAreaConfirm}
            onCancel={handleAreaCancel}
            onDelete={handleAreaDeleteDialog}
          />
        )}

        {/* Marker delete popup */}
        {selectedMarker && (
          <MarkerDeletePopup
            marker={selectedMarker}
            onDelete={handleDeleteMarker}
            onClose={() => handleMarkerClick(null)}
            canDelete={canDeleteMarker(selectedMarker)}
          />
        )}
      </MapContainer>
      
      <DrawingTooltip tooltip={drawingTooltip} />

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
      />

      <ManagerSummaryDropdown
        managerName={managerName}
        onlineCount={onlineCount}
        open={showAreaDropdown}
        onToggle={() => setShowAreaDropdown(v => !v)}
        onAreaSelect={handleAreaSelectDropdown}
        onOpenCampaignForm={() => openCampaignForm('c333b56c-a938-41bc-9387-4592c8548b95', null, currentUser?.id)}
        selectedCampaign={selectedCampaign}
      />
      {console.log('App.js - selectedCampaign being passed:', selectedCampaign)}
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