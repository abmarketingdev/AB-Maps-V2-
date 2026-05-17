/**
 * NRC Campaign URL Helper
 * 
 * Handles NRC campaign detection and URL construction for the external
 * NRC donation form at https://nrc.givingpage.org/ab-marketing-fadder
 * 
 * URL Parameters:
 * - custom_m17YiDQsC7fhyQc: Street name and number
 * - custom_Fb6iOcUbz258wiV: Postal code (4 digits)
 * - custom_UTKPnZDT8qqVJuk: City name
 */

import { getCampaignById } from '../services/campaignFormService';

/**
 * Check if the current campaign is NRC (case-insensitive) - SYNCHRONOUS VERSION
 * Only checks localStorage, does not fetch from API
 * @returns {boolean}
 */
export const isNRCCampaign = () => {
  const campaignData = localStorage.getItem('currentCampaign');
  console.log('[NRC] Checking campaign data:', campaignData);
  
  if (!campaignData) {
    console.log('[NRC] No campaign data found in localStorage');
    return false;
  }
  
  try {
    const campaign = JSON.parse(campaignData);
    console.log('[NRC] Parsed campaign:', campaign);
    
    const name = campaign.name?.toLowerCase().trim();
    console.log('[NRC] Campaign name:', name);
    
    const isNRC = name === 'nrc';
    console.log('[NRC] Is NRC campaign:', isNRC);
    
    return isNRC;
  } catch (error) {
    console.error('[NRC] Error parsing campaign data:', error);
    return false;
  }
};

/**
 * Check if the current campaign is NRC (case-insensitive) - ASYNC VERSION
 * Fetches campaign from API if name is missing (same pattern as ManagerToolbar)
 * @returns {Promise<boolean>}
 */
export const isNRCCampaignAsync = async () => {
  const stored = localStorage.getItem('currentCampaign');
  console.log('[NRC Async] Checking campaign data:', stored);
  
  if (!stored) {
    console.log('[NRC Async] No campaign data found in localStorage');
    return false;
  }
  
  try {
    let parsed = null;
    try {
      parsed = JSON.parse(stored);
    } catch {
      // Not JSON, treat as ID string
      console.log('[NRC Async] Campaign data is ID string, not JSON');
    }
    
    // If we have a name, check it directly
    if (parsed && parsed.name) {
      const name = parsed.name.toLowerCase().trim();
      console.log('[NRC Async] Campaign name from localStorage:', name);
      const isNRC = name === 'nrc';
      console.log('[NRC Async] Is NRC campaign:', isNRC);
      return isNRC;
    }
    
    // If it's an ID string or object without name, fetch campaign by ID
    const campaignId = parsed && parsed.id ? parsed.id : stored;
    console.log('[NRC Async] Name missing, fetching campaign by ID:', campaignId);
    
    if (campaignId) {
      try {
        const campaign = await getCampaignById(campaignId);
        console.log('[NRC Async] Fetched campaign:', campaign);
        
        // Update localStorage with full campaign data
        if (campaign && campaign.name) {
          const updatedCampaign = { id: campaignId, name: campaign.name };
          localStorage.setItem('currentCampaign', JSON.stringify(updatedCampaign));
          console.log('[NRC Async] Updated localStorage with campaign name:', updatedCampaign);
          
          const name = campaign.name.toLowerCase().trim();
          const isNRC = name === 'nrc';
          console.log('[NRC Async] Is NRC campaign:', isNRC);
          return isNRC;
        }
      } catch (err) {
        console.error('[NRC Async] Error fetching campaign:', err);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[NRC Async] Error checking campaign:', error);
    return false;
  }
};

/**
 * Parse Norwegian address to extract components
 * Handles formats like:
 * - "Storgata 10, 0184 Oslo"
 * - "Osterhaus' gate 12B, 0183 Oslo"
 * - "Skogveien 162D" (no postal code)
 * - "Storgata 10, H0201" (with apartment number)
 * - "Storgata 10, 0184 Oslo, H0201" (full with apartment)
 * 
 * @param {string} addressText - Full address string
 * @param {string} [apartmentNumber] - Optional apartment number to append
 * @returns {{ street: string, postalCode: string, city: string }}
 */
export const parseNorwegianAddress = (addressText, apartmentNumber = null) => {
  if (!addressText) {
    return { street: '', postalCode: '', city: '' };
  }

  let street = '';
  let postalCode = '';
  let city = '';

  // Pattern 1: Full format "Street Name Number, PostalCode City"
  // Example: "Storgata 10, 0184 Oslo"
  const fullPattern = /^(.+?),?\s+(\d{4})\s+(.+)$/;
  const fullMatch = addressText.match(fullPattern);
  
  if (fullMatch) {
    street = fullMatch[1].trim();
    postalCode = fullMatch[2];
    city = fullMatch[3].trim();
    
    // Remove any apartment number from city if present (e.g., "Oslo, H0201")
    const cityCommaIndex = city.indexOf(',');
    if (cityCommaIndex !== -1) {
      city = city.substring(0, cityCommaIndex).trim();
    }
  } else {
    // Pattern 2: Just street with possible apartment "Street Number, ApartmentNumber"
    // Example: "Storgata 10, H0201"
    const streetWithAptPattern = /^(.+?),\s*([A-Za-z]?\d+)$/;
    const streetWithAptMatch = addressText.match(streetWithAptPattern);
    
    if (streetWithAptMatch) {
      street = streetWithAptMatch[1].trim();
      // Apartment number is in match[2], but we don't need it for the URL
    } else {
      // Fallback: just use the whole thing as street
      street = addressText.trim();
    }
  }

  // If apartment number provided, append to street
  if (apartmentNumber) {
    street = `${street}, ${apartmentNumber}`;
  }

  return { street, postalCode, city };
};

/**
 * Construct NRC URL and open in new tab
 * @param {string} addressText - Full address string (e.g., "Storgata 10, 0184 Oslo")
 * @param {string} [apartmentNumber] - Optional apartment number to include
 */
export const openNRCUrl = (addressText, apartmentNumber = null) => {
  const { street, postalCode, city } = parseNorwegianAddress(addressText, apartmentNumber);
  
  const baseUrl = 'https://nrc.givingpage.org/ab-marketing-fadder';
  const params = new URLSearchParams();
  
  // Street name and number (required)
  if (street) {
    params.set('custom_m17YiDQsC7fhyQc', street);
  }
  
  // Postal code (optional)
  if (postalCode) {
    params.set('custom_Fb6iOcUbz258wiV', postalCode);
  }
  
  // City (optional)
  if (city) {
    params.set('custom_UTKPnZDT8qqVJuk', city);
  }
  
  const fullUrl = `${baseUrl}?${params.toString()}`;
  console.log('[NRC] Opening URL:', fullUrl);
  console.log('[NRC] Parsed address:', { street, postalCode, city, apartmentNumber });
  
  window.open(fullUrl, '_blank');
};

/**
 * Construct NRC URL for apartment addresses
 * NOTE: For NRC, we do NOT include the apartment number (H0101, H201, etc.)
 * We only send the building address (street name and number)
 * 
 * @param {string} baseAddress - Building address (e.g., "Storgata 10, 0184 Oslo")
 * @param {string} apartmentNumber - Apartment identifier (e.g., "H0201") - NOT used in URL
 */
export const openNRCUrlForApartment = (baseAddress, apartmentNumber) => {
  // For NRC apartments, we only use the base address WITHOUT apartment number
  // Parse the base address
  const { street, postalCode, city } = parseNorwegianAddress(baseAddress);
  
  const baseUrl = 'https://nrc.givingpage.org/ab-marketing-fadder';
  const params = new URLSearchParams();
  
  // Only include street (without apartment number)
  if (street) {
    params.set('custom_m17YiDQsC7fhyQc', street);
  }
  if (postalCode) {
    params.set('custom_Fb6iOcUbz258wiV', postalCode);
  }
  if (city) {
    params.set('custom_UTKPnZDT8qqVJuk', city);
  }
  
  const fullUrl = `${baseUrl}?${params.toString()}`;
  console.log('[NRC] Opening apartment URL (without apt number):', fullUrl);
  console.log('[NRC] Parsed address:', { 
    baseAddress, 
    apartmentNumber: `${apartmentNumber} (not included in URL)`, 
    street, 
    postalCode, 
    city 
  });
  
  window.open(fullUrl, '_blank');
};
