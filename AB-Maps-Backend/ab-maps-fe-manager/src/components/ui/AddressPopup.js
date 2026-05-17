import React, { useState, useEffect } from 'react';
import { Popup } from 'react-leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTimes, faSave, faSpinner } from '@fortawesome/free-solid-svg-icons';
import addressService from '../../services/addressService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Component for displaying address information and status selection buttons
 */
const AddressPopup = ({ position, addresses, statusOptions, onClose, onAddMarker, onOpenCampaignForm }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedStatuses, setSavedStatuses] = useState({});
  const [addressData, setAddressData] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);

  if (!position || !addresses || addresses.length === 0) return null;

  const isLoading = addresses[0] === 'Henter adresse...';
  const isError = addresses[0] === 'Kunne ikke hente adresse' || addresses[0] === 'Fant ingen adresse';

  // Enhanced status options with icons
  const enhancedStatusOptions = [
    {
      value: 'ja',
      label: 'Ja',
      color: '#2ecc71',
      icon: faCheck
    },
    {
      value: 'ikke_hjemme',
      label: 'Ikke hjemme',
      color: '#f1c40f',
      icon: faClock
    },
    {
      value: 'nei',
      label: 'Nei',
      color: '#e74c3c',
      icon: faTimes
    }
  ];

  /**
   * Get campaign ID from localStorage
   */
  const getCampaignId = () => {
    const campaignData = localStorage.getItem('currentCampaign');
    if (campaignData) {
      try {
        const campaign = JSON.parse(campaignData);
        console.log('Campaign data from localStorage:', campaign);
        return campaign.id;
      } catch (error) {
        console.error('Error parsing campaign data:', error);
        // If parsing fails, assume it's already just the ID
        console.log('Using campaign data as direct ID:', campaignData);
        return campaignData;
      }
    }
    console.log('No campaign data found in localStorage');
    return null;
  };

  /**
   * Handle status selection with backend integration
   */
  const handleStatusSelect = async (e, address, statusValue) => {
    if (e) e.stopPropagation();
    setLoading(true);
    setSavingAddress(true);
    setError(null);
    try {
      let geoJsonPosition = null;
      if (typeof position === 'object' && position.lat && position.lng) {
        geoJsonPosition = {
          type: 'Point',
          coordinates: [position.lng, position.lat]
        };
      } else if (typeof position === 'string') {
        geoJsonPosition = position;
      }
      
      // Get campaign ID from localStorage
      const campaignId = getCampaignId();
      
      // Create address (marker) in backend
      const payload = {
        address_text: address,
        status: statusValue,
        position: geoJsonPosition,
        tags: { source: 'map_click', timestamp: new Date().toISOString() },
        employee_id: user.user_type === 'employee' ? user.user_info?.id : null,
        manager_id: user.user_type === 'manager' ? user.user_info?.id : null,
        campaign_id: campaignId, // Add campaign_id to payload
      };
      
      console.log('Creating address with payload:', payload);
      const createdAddress = await addressService.createAddress(payload);
      if (createdAddress && createdAddress.id) {
        const newMarker = {
          address: address,
          status: statusValue,
          position: position,
          addressId: createdAddress.id,
        };
        if (onAddMarker) {
          onAddMarker(newMarker);
        }
        setSavedStatuses(prev => ({
          ...prev,
          [address]: {
            status: statusValue,
            addressId: createdAddress.id,
            timestamp: new Date().toISOString(),
            user: user.username || user.user_info?.name || 'Unknown'
          }
        }));
      } else {
        setError('Kunne ikke opprette adresse. Prøv igjen.');
      }
      
      // If status is "ja", automatically open campaign form
      if (statusValue === 'ja' && onOpenCampaignForm) {
        const addressData = {
          address_text: address,
          postnummer: '',
          posted: ''
        };
        // Small delay to ensure address is saved before opening form
        setTimeout(() => {
          onOpenCampaignForm(campaignId, createdAddress?.id, user?.user_info?.id, addressData);
        }, 500);
      }
      
      setTimeout(() => {
        setSavedStatuses(prev => {
          const newState = { ...prev };
          delete newState[address];
          return newState;
        });
      }, 2000);
    } catch (err) {
      setError(err.message || 'Kunne ikke lagre adresse');
      console.error('Error saving address:', err);
    } finally {
      setLoading(false);
      setSavingAddress(false);
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (statusValue) => {
    const option = enhancedStatusOptions.find(opt => opt.value === statusValue);
    return option ? option.icon : faCheck;
  };

  /**
   * Get status color
   */
  const getStatusColor = (statusValue) => {
    const option = enhancedStatusOptions.find(opt => opt.value === statusValue);
    return option ? option.color : '#95a5a6';
  };

  return (
    <Popup 
      position={position}
      onClose={onClose}
      closeButton={true}
      className="address-popup-enhanced"
    >
      <div className="address-popup">
        {error && (
          <div className="error-message" style={{
            background: '#e74c3c',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        
        <div className="address-list">
          {addresses.map((address, index) => {
            const savedStatus = savedStatuses[address];
            const isSaving = loading && savedStatus;
            
            return (
              <div key={index} className="address-item" style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
                background: savedStatus ? '#f8f9fa' : 'white'
              }}>
                <p style={{
                  margin: '0 0 8px 0',
                  fontWeight: '500',
                  fontSize: '14px',
                  color: '#333'
                }}>
                  {address}
                </p>
                
                {savedStatus && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px',
                    padding: '4px 8px',
                    background: getStatusColor(savedStatus.status),
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <FontAwesomeIcon 
                      icon={isSaving ? faSpinner : getStatusIcon(savedStatus.status)} 
                      spin={isSaving}
                      style={{ marginRight: '6px' }}
                    />
                    <span>{savedStatus.status === 'ja' ? 'Ja' : 
                           savedStatus.status === 'ikke_hjemme' ? 'Ikke hjemme' : 'Nei'}</span>
                    {!isSaving && (
                      <FontAwesomeIcon 
                        icon={faSave} 
                        style={{ marginLeft: 'auto', fontSize: '10px' }}
                      />
                    )}
                  </div>
                )}
                
                {!isLoading && !isError && !savedStatus && (
                  <div className="status-buttons" style={{
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap'
                  }}>
                    {enhancedStatusOptions.map((option, i) => (
                      <button
                        key={i}
                        className="status-button"
                        style={{
                          backgroundColor: option.color,
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: loading || savingAddress ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          opacity: loading || savingAddress ? 0.6 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        onClick={(e) => handleStatusSelect(e, address, option.value)}
                        disabled={loading || savingAddress}
                        title={option.label}
                      >
                        <FontAwesomeIcon icon={option.icon} style={{ fontSize: '10px' }} />
                        <span>{option.label}</span>
                      </button>
                    ))}
                    

                  </div>
                )}
                
                {loading && !savedStatus && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    color: '#666',
                    fontSize: '12px'
                  }}>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '6px' }} />
                    Lagrer status...
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {user && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#666',
            textAlign: 'center'
          }}>
            Logget inn som: {user.username || user.user_info?.name || 'Unknown'} ({user.user_type})
          </div>
        )}
      </div>
    </Popup>
  );
};

export default AddressPopup;
