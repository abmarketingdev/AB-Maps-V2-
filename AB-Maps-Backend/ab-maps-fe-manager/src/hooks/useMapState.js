import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { faPlus, faEye, faBan, faCheck } from '@fortawesome/free-solid-svg-icons';
import * as turf from '@turf/turf';
import { getAddressesInPolygon, searchAddress } from '../services/apiService';
import { isPointInPolygon } from '../utils/addressUtils';
import useAddressLookup from './useAddressLookup';
import { areaService } from '../services/areaService';
import { useAuth } from '../contexts/AuthContext';
import addressService from '../services/addressService';

/**
 * Custom hook for managing map state and interactions
 */
const useMapState = () => {
  // Map state
  const [position] = useState([59.9139, 10.7522]); // Oslo center
  const [clickedInfo, setClickedInfo] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [areas, setAreas] = useState([]);
  const [currentArea, setCurrentArea] = useState([]);
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [editingAreaIndex, setEditingAreaIndex] = useState(null);
  const [previewLine, setPreviewLine] = useState(null);
  const [drawingTooltip, setDrawingTooltip] = useState({ visible: false, content: '', position: { x: 0, y: 0 } });
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [currentAreaData, setCurrentAreaData] = useState({
    title: '',
    color: '#2b2d42',
    houseCount: 0
  });

  const searchTimeoutRef = useRef(null);
  const { lookupAddressAtPoint, isLoading: isAddressLoading } = useAddressLookup();
  const [markersLoaded, setMarkersLoaded] = useState(false);
  const [draftAreas, setDraftAreas] = useState([]); // For areas not yet saved to backend
  const [showOverlapToolbar, setShowOverlapToolbar] = useState(false);
  
  // Campaign form popup state
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignFormData, setCampaignFormData] = useState({
    campaignId: null,
    addressId: null,
    salesRepId: null,
    addressData: null
  });

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

  // Helper to convert address objects to marker objects
  const convertAddressesToMarkers = (addresses) => {
    return addresses.map(addr => {
      if (!addr.position || !addr.position.coordinates) return null;
      return {
        address: addr.address_text,
        status: addr.status,
        position: {
          lat: addr.position.coordinates[1],
          lng: addr.position.coordinates[0]
        },
        addressId: addr.id,
        managerId: addr.manager?.id || null,
        employeeId: addr.employee?.id || null,
        recordedAt: addr.recorded_at,
        user: addr.manager?.name || addr.employee?.name || 'Unknown'
      };
    }).filter(marker => marker !== null);
  };

  // Load areas from service on mount
  useEffect(() => {
    if (!currentUser) return;
    const loadAreas = async () => {
      try {
        const areasData = await areaService.getAllAreas();
        setAreas(areasData);
        console.log('[DEBUG] Loaded areas from service:', areasData);
      } catch (error) {
        console.error('Error loading areas:', error);
        showToast('Failed to load areas', 'error');
      }
    };
    loadAreas();
  }, [currentUser]);



  // Load markers from backend on mount and after creation
  const loadMarkersFromBackend = useCallback(async () => {
    if (!currentUser) return;
    try {
      const addresses = await addressService.getAddresses();
      const markersFromBackend = convertAddressesToMarkers(addresses);
      setMarkers(markersFromBackend);
      setMarkersLoaded(true);
    } catch (error) {
      console.error('Error loading markers from backend:', error);
      showToast('Failed to load markers from backend', 'error');
      setMarkersLoaded(true);
    }
  }, [currentUser]);

  useEffect(() => {
    loadMarkersFromBackend();
  }, [currentUser, loadMarkersFromBackend]);

  // Debug markers changes (no longer persisting to IndexedDB)
  useEffect(() => {
    if (markersLoaded) {
      console.log('[DEBUG] Markers updated:', markers);
      console.log('[DEBUG] Markers count:', markers.length);
    }
  }, [markers, markersLoaded]);

  // Handler for map clicks
  const handleMapClick = async (latlng) => {
    // Close any other popups before opening a new one
    setSelectedMarker(null);
    setSelectedArea(null);

    // Process map clicks for drawing mode
    if (isDrawingEnabled) {
      // Check if user is closing the polygon by clicking the first point
      if (currentArea.length >= 3 && mapRef) {
        const firstPoint = mapRef.latLngToContainerPoint(currentArea[0]);
        const clickedPoint = mapRef.latLngToContainerPoint(latlng);
        const distance = firstPoint.distanceTo(clickedPoint);

        if (distance < 20) { // 20 pixels threshold
          finishDrawing();
          return;
        }
      }

      const newArea = [...currentArea, latlng];
      setCurrentArea(newArea);
    } else {
      // Immediately show popup with a loading message
      setClickedInfo({
        position: latlng,
        addresses: ['Henter adresse...']
      });

      try {
        const addresses = await lookupAddressAtPoint(latlng);
        const finalAddresses = addresses.length > 0 ? addresses : ['Fant ingen adresse'];
        setClickedInfo({
          position: latlng,
          addresses: finalAddresses,
        });
      } catch (err) {
        console.error('Error looking up address:', err);
        setClickedInfo({
          position: latlng,
          addresses: ['Kunne ikke hente adresse'],
        });
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
    if (isDrawingEnabled) {
      const tooltipPos = e.containerPoint;
      let content = 'Klikk for å legge til et punkt';
      if (currentArea.length === 0) {
        content = 'Klikk for å starte tegningen';
      } else if (currentArea.length >= 3) {
        content = 'Klikk for å legge til et punkt eller fullfør';
      }
      setDrawingTooltip({ visible: true, content, position: tooltipPos });
    }
  }, [isDrawingEnabled, currentArea, mapRef]);

  const showToast = (message, type = 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: '', type: '' });
    }, 3000);
  };

  // Finish drawing an area
  const finishDrawing = async () => {
    if (currentArea.length >= 3) {
      // Create new polygon as GeoJSON
      const newPolygon = turf.polygon([
        currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])
      ]);
      // Check for overlap with existing areas
      const overlaps = areas.some(area => {
        if (!area.polygon_geometry) return false;
        const existingPolygon = turf.polygon(area.polygon_geometry.coordinates);
        return turf.booleanOverlap(newPolygon, existingPolygon) || turf.booleanIntersects(newPolygon, existingPolygon);
      });
      if (overlaps) {
        setShowOverlapToolbar(true);
        // Removed showToast to prevent double notification
        return;
      } else {
        setShowOverlapToolbar(false);
      }
      // Calculate address count for the new area
      const addresses = await getAddressesInPolygon(currentArea);
      const addressCount = addresses.length;
      // Add a draft area to state (not saved to backend)
      const draftId = `draft-${Date.now()}`;
      setDraftAreas(prev => [
        ...prev,
        {
          id: draftId,
          name: '',
          color: '#2b2d42',
          house_count: addressCount,
          polygon_geometry: {
            type: 'Polygon',
            coordinates: [currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])]
          },
          isDraft: true
        }
      ]);
      setCurrentArea([]);
      setIsDrawingEnabled(false);
    }
  };



  // Get marker icon based on status
  const getMarkerIcon = (status) => {
    let color = '#3498db'; // default blue
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
      html: `<div style="background-color: ${color}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white;">
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
          setDrawingTooltip({ visible: true, content: 'Klikk for å starte tegningen', position: { x: 0, y: 0 } });
        } else {
          mapContainer.classList.remove('drawing-mode');
          setDrawingTooltip({ visible: false, content: '', position: { x: 0, y: 0 } });
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
    if (!isDraft && area.manager_id !== currentUser.id) {
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
      isDraft: !!isDraft
    });
    setEditingAreaIndex(index);
    setShowAreaDialog(true);
  };

  // Handle area deletion
  const handleAreaDelete = async (index) => {
    const area = areas[index];
    
    // Check if area is editable by current user
    if (area.manager_id !== currentUser.id) {
      showToast('You can only delete your own areas', 'error');
      return;
    }
    
    try {
      await areaService.deleteArea(area.id);
      setAreas(prev => prev.filter((_, i) => i !== index));
      setSelectedArea(null);
      showToast('Area deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting area:', error);
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
    const addresses = await getAddressesInPolygon(currentArea);
    const totalAddresses = addresses.length;
    if (currentAreaData.isDraft && editingAreaIndex !== null) {
      // Save draft area to backend
      const draft = draftAreas[editingAreaIndex];
      const newAreaData = {
        name: currentAreaData.title,
        color: currentAreaData.color,
        house_count: totalAddresses,
        polygon_geometry: draft.polygon_geometry
      };
      try {
        const createdArea = await areaService.createArea(newAreaData);
        setAreas(prev => [...prev, createdArea]);
        setDraftAreas(prev => prev.filter((_, i) => i !== editingAreaIndex));
        showToast('Area created successfully', 'success');
      } catch (error) {
        console.error('Error creating area:', error);
        showToast('Failed to create area', 'error');
      }
    } else if (editingAreaIndex !== null) {
      // Update existing area
      const area = areas[editingAreaIndex];
      const updateData = {
        name: currentAreaData.title,
        color: currentAreaData.color,
        house_count: totalAddresses,
        polygon_geometry: {
          type: 'Polygon',
          coordinates: [currentArea.map(point => [point.lng, point.lat]).concat([[currentArea[0].lng, currentArea[0].lat]])]
        }
      };
      try {
        const updatedArea = await areaService.updateArea(area.id, updateData);
        setAreas(prev => prev.map((a, index) => index === editingAreaIndex ? updatedArea : a));
        showToast('Area updated successfully', 'success');
      } catch (error) {
        console.error('Error updating area:', error);
        showToast('Failed to update area', 'error');
      }
    }
    // Reset state
    setCurrentArea([]);
    setCurrentAreaData({
      title: '',
      color: '#2b2d42',
      houseCount: 0
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
      houseCount: 0
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
    setDrawingTooltip({ visible: false, content: '', position: { x: 0, y: 0 } });
    if (mapRef) {
      const mapContainer = mapRef.getContainer();
      mapContainer.classList.remove('drawing-mode');
    }
  };

  const handleAreaUpdate = async (index, newProperties) => {
    const area = areas[index];
    
    // Check if area is editable by current user
    if (area.manager_id !== currentUser.id) {
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
      console.error('Error updating area:', error);
      showToast('Failed to update area', 'error');
    }
  };

  const handleUndo = useCallback(() => {
    setCurrentArea(prevArea => {
      const newArea = prevArea.slice(0, -1);
      return newArea;
    });
  }, []); // Empty dependency array ensures this function is stable

  const handleMarkerClick = (marker, index) => {
    // Close other popups
    setClickedInfo(null);
    setSelectedArea(null);
    
    console.log('[Click] Marker clicked:', {
      marker: marker,
      index: index,
      hasAddressId: !!marker?.addressId,
      hasStatusId: !!marker?.statusId,
      addressId: marker?.addressId,
      statusId: marker?.statusId
    });
    
    setSelectedMarker({ ...marker, index });
  };

  // Helper to add a marker and refresh
  const addMarkerWithIds = (marker) => {
    // After creating a marker, reload all markers from backend
    loadMarkersFromBackend();
  };

  /**
   * Check if a marker belongs to the current user
   */
  const canDeleteMarker = (marker) => {
    if (!currentUser || !marker) return false;
    
    // Check if marker has user information
    if (marker.managerId && currentUser.user_type === 'manager') {
      return marker.managerId === currentUser.user_info.id;
    }
    
    if (marker.employeeId && currentUser.user_type === 'employee') {
      return marker.employeeId === currentUser.user_info.id;
    }
    
    // If no user info in marker, we can't determine ownership
    return false;
  };

  const handleDeleteMarker = async (markerOrIndex) => {
    let marker = markerOrIndex;
    if (typeof markerOrIndex === 'number') {
      marker = markers[markerOrIndex];
    }
    console.log('[Delete] Marker object:', marker);
    if (!marker) return;

    // Check if user can delete this marker
    if (!canDeleteMarker(marker)) {
      showToast('Du kan kun slette dine egne punkter', 'error');
      return;
    }

    // Validate that marker has required IDs
    if (!marker.addressId) {
      console.warn('[Delete] Marker missing addressId:', { 
        addressId: marker.addressId, 
        marker: marker 
      });
      showToast('Kunne ikke slette punktet - mangler nødvendig informasjon', 'error');
      return;
    }

    try {
      // Delete address
      console.log('[Delete] Deleting address:', marker.addressId);
      await addressService.deleteAddress(marker.addressId);
      console.log('[Delete] Address deleted successfully');

      // Reload markers from backend to get the latest data
      const reloadMarkers = async () => {
        try {
          const addresses = await addressService.getAddresses();
          console.log('[DEBUG] Reloaded addresses after deletion:', addresses);
          
          const markersFromBackend = convertAddressesToMarkers(addresses);
          setMarkers(markersFromBackend);
          console.log('[DEBUG] Updated markers after deletion reload:', markersFromBackend);
        } catch (error) {
          console.error('Error reloading markers after deletion:', error);
        }
      };
      
      reloadMarkers();
      setSelectedMarker(null);
      showToast('Punktet ble slettet', 'success');
    } catch (error) {
      console.error('Error deleting marker/address:', error);
      showToast('Kunne ikke slette punktet', 'error');
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
      const area = areas[editingAreaIndex];
      if (area.manager_id !== currentUser.id) {
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
          houseCount: 0
        });
        showToast('Området ble slettet', 'success');
      } catch (error) {
        showToast('Kunne ikke slette området', 'error');
      }
    }
  };

  // Expose a function to close the address popup
  const closeAddressPopup = () => setClickedInfo(null);
  
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


  return {
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
    currentArea,
    showAreaDialog,
    editingAreaIndex,
    previewLine,
    drawingTooltip,
    toast,
    currentAreaData,
    statusOptions,
    currentUser,
    draftAreas,
    showOverlapToolbar,
    setShowOverlapToolbar,
    // Campaign form state
    showCampaignForm,
    campaignFormData,
    // Setters
    setMapRef,
    setCurrentAreaData,
    // Handlers
    handleMapClick,
    handleMapMove,
    finishDrawing,
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
    // Campaign form handlers
    openCampaignForm,
    closeCampaignForm,
  };
};

export default useMapState;
