import { API_CONFIG } from '../config/apiConfig';
import authService from './authService';

/**
 * Campaign Form Service
 * Handles all API calls related to campaign forms
 */

const CAMPAIGN_FORM_ENDPOINTS = {
  forms: `${API_CONFIG.backend.baseUrl}/campaigns/campaign-forms/`,
  campaigns: `${API_CONFIG.backend.baseUrl}/campaigns/campaigns/`,
};

/**
 * Get authentication headers
 */
const getAuthHeaders = () => {
  // Try to get token from authService first, then fallback to localStorage
  let token = authService.getAccessToken();
  
  // Fallback to localStorage if authService doesn't have token
  if (!token) {
    token = localStorage.getItem('accessToken') || localStorage.getItem('access_token');
  }
  
  console.log('Token for campaign form API:', token ? 'Present' : 'Missing');
  
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

/**
 * Create a new campaign form
 * @param {Object} formData - The form data to submit
 * @returns {Promise<Object>} The created form data
 */
export const createCampaignForm = async (formData) => {
  try {
    console.log('Creating campaign form with data:', formData);
    console.log('Using endpoint:', CAMPAIGN_FORM_ENDPOINTS.forms);
    
    const headers = getAuthHeaders();
    console.log('Request headers:', headers);
    
    const response = await fetch(CAMPAIGN_FORM_ENDPOINTS.forms, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(formData)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response text:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (parseError) {
        errorData = { detail: errorText };
      }
      
      throw new Error(errorData.detail || `HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Campaign form created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error creating campaign form:', error);
    throw error;
  }
};

/**
 * Get campaign forms by campaign ID
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Array>} Array of campaign forms
 */
export const getCampaignFormsByCampaign = async (campaignId) => {
  try {
    const response = await fetch(`${CAMPAIGN_FORM_ENDPOINTS.forms}by_campaign/?campaign=${campaignId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch campaign forms');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching campaign forms:', error);
    throw error;
  }
};

/**
 * Get campaign forms by sales representative ID
 * @param {string} salesRepId - The sales representative ID
 * @returns {Promise<Array>} Array of campaign forms
 */
export const getCampaignFormsBySalesRep = async (salesRepId) => {
  try {
    const response = await fetch(`${CAMPAIGN_FORM_ENDPOINTS.forms}by_sales_rep/?sales_rep_id=${salesRepId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch campaign forms');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching campaign forms:', error);
    throw error;
  }
};

/**
 * Get current user's campaign forms
 * @returns {Promise<Array>} Array of campaign forms
 */
export const getMyCampaignForms = async () => {
  try {
    const response = await fetch(`${CAMPAIGN_FORM_ENDPOINTS.forms}my_forms/`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch campaign forms');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching campaign forms:', error);
    throw error;
  }
};

/**
 * Update campaign form status
 * @param {string} formId - The form ID
 * @param {string} status - The new status ('done' or 'not_done')
 * @returns {Promise<Object>} The updated form data
 */
export const updateCampaignFormStatus = async (formId, status) => {
  try {
    const response = await fetch(`${CAMPAIGN_FORM_ENDPOINTS.forms}${formId}/update_status/`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update campaign form status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating campaign form status:', error);
    throw error;
  }
};

/**
 * Get all campaigns
 * @returns {Promise<Array>} Array of campaigns
 */
export const getCampaigns = async () => {
  try {
    const response = await fetch(CAMPAIGN_FORM_ENDPOINTS.campaigns, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch campaigns');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    throw error;
  }
};

/**
 * Get a specific campaign by ID
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Object>} The campaign data
 */
export const getCampaignById = async (campaignId) => {
  try {
    const response = await fetch(`${CAMPAIGN_FORM_ENDPOINTS.campaigns}${campaignId}/`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch campaign');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching campaign:', error);
    throw error;
  }
};

/**
 * Get current user information
 * @returns {Promise<Object>} The current user data
 */
export const getCurrentUser = async () => {
  try {
    const response = await fetch(`${API_CONFIG.backend.baseUrl}/users/me/`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch user data');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

/**
 * Validate form data before submission
 * @param {Object} formData - The form data to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export const validateFormData = (formData) => {
  const errors = [];

  // Required fields validation
  const requiredFields = [
    'first_name', 'last_name', 'email', 'sms_phone_number', 
    'date_of_birth', 'address_text', 'postnummer', 'posted',
    'kontonummer', 'gavebeløp'
  ];

  requiredFields.forEach(field => {
    if (!formData[field] || formData[field].toString().trim() === '') {
      errors.push(`${field.replace('_', ' ')} is required`);
    }
  });

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (formData.email && !emailRegex.test(formData.email)) {
    errors.push('Invalid email format');
  }

  // Phone number validation (basic)
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (formData.sms_phone_number && !phoneRegex.test(formData.sms_phone_number)) {
    errors.push('Invalid phone number format');
  }

  // Postal code validation (Norwegian format)
  const postalRegex = /^\d{4}$/;
  if (formData.postnummer && !postalRegex.test(formData.postnummer)) {
    errors.push('Postal code must be 4 digits');
  }

  // National ID validation (if provided)
  const nationalIdRegex = /^\d{11}$/;
  if (formData.skattefradrag_fødselsnummer && !nationalIdRegex.test(formData.skattefradrag_fødselsnummer)) {
    errors.push('National ID must be 11 digits');
  }

  // Amount validation
  if (formData.gavebeløp && (isNaN(formData.gavebeløp) || parseFloat(formData.gavebeløp) <= 0)) {
    errors.push('Donation amount must be a positive number');
  }

  if (formData.beløpsgrense && (isNaN(formData.beløpsgrense) || parseFloat(formData.beløpsgrense) <= 0)) {
    errors.push('Amount limit must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}; 