import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { getEmployeeCampaigns } from '../../services/apiService';
import './CampaignSelector.css';

const CampaignSelector = ({ token, employee, onCampaignSelect, selectedCampaign }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load campaigns on component mount
  useEffect(() => {
    if (token && employee && employee.id) {
      console.log('CampaignSelector: Employee data loaded, loading campaigns for employee:', employee.id);
      loadCampaigns();
    } else {
      console.log('CampaignSelector: Waiting for employee data...', { 
        hasToken: !!token, 
        hasEmployee: !!employee, 
        employeeId: employee?.id 
      });
    }
  }, [token, employee]);

  const loadCampaigns = async () => {
    setLoading(true);
    setError(null);
    
    console.log('Loading campaigns with:', { 
      token: !!token, 
      employee: employee?.id, 
      employeeName: employee?.name,
      employeeType: typeof employee?.id 
    });
    
    // Ensure we have a valid employee ID
    if (!employee?.id) {
      setError('Employee ID not available');
      setLoading(false);
      return;
    }
    
    try {
      const campaignsData = await getEmployeeCampaigns(token, employee.id);
      console.log('Campaigns loaded:', campaignsData);
      
      // Transform the data to match the expected format
      const transformedCampaigns = campaignsData.map(item => ({
        id: item.campaign.id,
        name: item.campaign.name,
        description: item.campaign.description,
        assigned_at: item.assigned_at,
        created_by: item.campaign.created_by
      }));
      
      console.log('Transformed campaigns:', transformedCampaigns);
      setCampaigns(transformedCampaigns);
      
      // Auto-select first campaign if none selected
      if (transformedCampaigns.length > 0 && !selectedCampaign) {
        const firstCampaign = transformedCampaigns[0];
        console.log('Auto-selecting first campaign:', firstCampaign);
        handleCampaignSelect(firstCampaign);
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
      console.error('Error details:', err.message, err.stack);
      setError('Failed to load campaigns. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignSelect = (campaign) => {
    // Store campaign in localStorage
    localStorage.setItem('currentCampaign', JSON.stringify(campaign));
    
    if (onCampaignSelect) {
      onCampaignSelect(campaign);
    }
    
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="campaign-selector">
        <div className="campaign-selector-button loading">
          <FaMapMarkerAlt className="campaign-icon" />
          <span>Loading campaigns...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="campaign-selector">
        <div className="campaign-selector-button error">
          <FaMapMarkerAlt className="campaign-icon" />
          <span>Error loading campaigns</span>
        </div>
      </div>
    );
  }

  console.log('CampaignSelector render state:', { 
    campaignsCount: campaigns.length, 
    selectedCampaign, 
    isOpen, 
    loading, 
    error 
  });

  return (
    <div className="campaign-selector">
      <div className="campaign-selector-button" onClick={toggleDropdown}>
        <FaMapMarkerAlt className="campaign-icon" />
        <span className="campaign-text">
          {selectedCampaign ? selectedCampaign.name : 'Select Campaign'}
        </span>
        {isOpen ? <FaChevronUp className="chevron" /> : <FaChevronDown className="chevron" />}
      </div>
      
      {isOpen && (
        <div className="campaign-dropdown">
          {console.log('Dropdown content - campaigns:', campaigns)}
          {campaigns.length > 0 ? (
            <div className="campaigns-list">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={`campaign-item ${selectedCampaign?.id === campaign.id ? 'selected' : ''}`}
                  onClick={() => handleCampaignSelect(campaign)}
                >
                  <div className="campaign-info">
                    <div className="campaign-name">{campaign.name}</div>
                    <div className="campaign-description">{campaign.description}</div>
                    <div className="campaign-date">Assigned: {formatDate(campaign.assigned_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-campaigns">
              <div className="no-campaigns-icon">📋</div>
              <div className="no-campaigns-text">No campaigns available</div>
              <div className="no-campaigns-subtext">Contact your manager for assignments</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CampaignSelector; 