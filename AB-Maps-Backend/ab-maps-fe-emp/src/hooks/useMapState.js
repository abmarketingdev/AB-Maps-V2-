import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { faPlus, faEye, faBan, faCheck } from '@fortawesome/free-solid-svg-icons';
import { saveData, loadData, addToSyncQueue, getSyncQueue, clearSyncQueue } from '../services/persistenceService';
import useAddressLookup from './useAddressLookup';
import { getAllAddressMarkers, createAddressMarker, deleteAddressMarker } from '../services/apiService';
// Helper to fetch statuses for an address
const getAddressStatuses = async (token, addressId) => {
  const url = `${process.env.REACT_APP_API_BASE_URL || 'https://ab-maps-backend-production.onrender.com'}/api/addresses/statuses/?address=${addressId}`;
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
const useMapState = (token, employee, selectedAreaId) => {
  // Map state
  const [position] = useState([59.9139, 10.7522]); // Oslo center
  const [clickedInfo, setClickedInfo] = useState(null);
  const [addressMarkers, setAddressMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const { lookupAddressAtPoint, isLoading: isAddressLoading } = useAddressLookup();
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false); // <-- Add loading state
  
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
    { label: 'Ja', color: '#2ecc71', icon: faPlus },
    { label: 'Ikke hjemme', color: '#f1c40f', icon: faEye },
    { label: 'Nei', color: '#e74c3c', icon: faBan },
  ];

  // Fetch all address markers from backend on mount
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await getAllAddressMarkers(token);
        // The API returns { count, next, previous, results }
        setAddressMarkers(data.results || []);
      } catch (err) {
        setToast({ visible: true, message: 'Failed to load address markers', type: 'error' });
      }
    })();
  }, [token]);

  // Handler for map clicks
  const handleMapClick = async (latlng) => {
    // Close any other popups before opening a new one
    setSelectedMarker(null);

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
  };

  const showToast = (message, type = 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: '', type: '' });
    }, 5000);
  };

  // Handle status selection for an address
  const handleStatusSelect = async (e, addressText, status) => {
    if (e) e.stopPropagation();
    if (!clickedInfo || !token || !employee) return;
    if (!selectedAreaId) {
      showToast('You must select an area before placing a sale.', 'error');
      return;
    }
    if (isStatusSubmitting) return; // Prevent double submit
    setIsStatusSubmitting(true);
    try {
      // 1. Create address marker with status, employee info, and area_id
      const statusMap = {
        'Ja': 'ja',
        'Ikke hjemme': 'ikke_hjemme',
        'Nei': 'nei'
      };
      const backendStatus = statusMap[status] || status.toLowerCase();
      
      // Get campaign ID from localStorage
      const getCampaignId = () => {
        const campaignData = localStorage.getItem('currentCampaign');
        if (campaignData) {
          // Check if it's a UUID (campaign ID) or JSON object
          if (campaignData.startsWith('{') || campaignData.startsWith('[')) {
            try {
              const campaign = JSON.parse(campaignData);
              console.log('Campaign data from localStorage (employee):', campaign);
              return campaign.id;
            } catch (error) {
              console.error('Error parsing campaign JSON data (employee):', error);
              return null;
            }
          } else {
            // It's a direct campaign ID (UUID)
            console.log('Using campaign data as direct ID (employee):', campaignData);
            return campaignData;
          }
        }
        console.log('No campaign data found in localStorage (employee)');
        return null;
      };
      
      const campaignId = getCampaignId();
      
      const markerPayload = {
        address_text: addressText,
        status: backendStatus,
        position: {
          type: 'Point',
          coordinates: [clickedInfo.position.lng, clickedInfo.position.lat]
        },
        tags: { source: 'map_click', timestamp: new Date().toISOString() },
        employee_id: employee.id,
        area_id: selectedAreaId,
        campaign_id: campaignId, // Add campaign_id to payload
      };
      console.log('Submitting address marker:', markerPayload); // <-- Debug log
      const createdMarker = await createAddressMarker(token, markerPayload);
      setAddressMarkers(prev => [...prev, createdMarker]);
      setClickedInfo(null);
      setToast({ visible: true, message: 'Marker added!', type: 'success' });
      
      // If status is "Ja", automatically open campaign form
      if (status === 'Ja' && campaignId) {
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
    } catch (err) {
      setToast({ visible: true, message: 'Failed to add marker', type: 'error' });
      console.error('Failed to add marker:', err); // <-- Debug log
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  // Handle marker deletion
  const handleDeleteMarker = async (index, id) => {
    if (!token || !employee) return;
    try {
      // Remove marker from state instantly
      setAddressMarkers(prev => prev.filter(m => (m.id || m.addressId) !== id));
      setSelectedMarker(null);
      setToast({ visible: true, message: 'Marker deleted!', type: 'success' });
    } catch (err) {
      setToast({ visible: true, message: 'Failed to delete marker', type: 'error' });
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

  // For now, just set the selected marker
  const handleMarkerClick = (marker, index) => {
    setClickedInfo(null);
    // Debug: log marker object
    console.log('Clicked marker:', marker);
    // Always pass backend id and token if available
    let markerId = marker.id;
    // If marker.id is missing but marker.addressId exists, use that
    if (!markerId && marker.addressId) markerId = marker.addressId;
    setSelectedMarker({ ...marker, index, id: markerId, token });
  };

  // (Marker deletion will be handled in a later step)

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
    addressMarkers,
    selectedMarker,
    mapRef,
    toast,
    statusOptions,
    isStatusSubmitting, // <-- Expose loading state
    // Campaign form state
    showCampaignForm,
    campaignFormData,
    
    // Setters
    setMapRef,
    setClickedInfo,
    
    // Handlers
    handleMapClick,
    handleStatusSelect,
    getMarkerIcon,
    handleMarkerClick,
    handleDeleteMarker,
    showToast,
    // Campaign form handlers
    openCampaignForm,
    closeCampaignForm,
  };
};

export default useMapState;
