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

/**
 * Check if the current campaign is NRC (case-insensitive)
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
  
  // Try to open the URL - check if popup was blocked
  const newWindow = window.open(fullUrl, '_blank');
  
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    // Popup was blocked - try alternative approach
    console.warn('[NRC] Popup was blocked, trying alternative approach');
    
    // Create a temporary link and click it (sometimes works when window.open doesn't)
    const link = document.createElement('a');
    link.href = fullUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
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
  
  // Try to open the URL - check if popup was blocked
  const newWindow = window.open(fullUrl, '_blank');
  
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    // Popup was blocked - try alternative approach
    console.warn('[NRC] Popup was blocked, trying alternative approach');
    
    // Create a temporary link and click it (sometimes works when window.open doesn't)
    const link = document.createElement('a');
    link.href = fullUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
