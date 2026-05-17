/**
 * API service for handling external data requests
 */

/**
 * Fetches addresses within a polygon using Overpass API
 * @param {Array} points - Array of {lat, lng} points forming a polygon
 * @returns {Array} Array of formatted address strings
 */
import { API_CONFIG } from '../config/apiConfig';
import { formatNorwegianAddress, isPointInPolygon } from '../utils/addressUtils';

export const getAddressesInPolygon = async (points) => {
  if (!points || points.length < 3) return [];

  const bounds = points.reduce((acc, point) => {
    return {
      minLat: Math.min(acc.minLat, point.lat),
      maxLat: Math.max(acc.maxLat, point.lat),
      minLng: Math.min(acc.minLng, point.lng),
      maxLng: Math.max(acc.maxLng, point.lng)
    };
  }, {
    minLat: points[0].lat,
    maxLat: points[0].lat,
    minLng: points[0].lng,
    maxLng: points[0].lng
  });

  try {
    // Use Overpass API to get all addresses in the bounding box
    const query = `
      [out:json][timeout:${API_CONFIG.overpass.timeout}];
      (
        way["addr:housenumber"](${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng});
        node["addr:housenumber"](${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch(API_CONFIG.overpass.baseUrl, {
      method: 'POST',
      body: query
    });

    const data = await response.json();
    const addresses = [];

    // Process nodes with address information
    const nodes = data.elements.filter(el => el.type === 'node' && el.tags && el.tags['addr:housenumber']);
    for (const node of nodes) {
      const { lat, lon } = node;
      const tags = node.tags;
      
      // Check if the point is inside the polygon
      if (isPointInPolygon([lat, lon], points.map(p => [p.lat, p.lng]))) {
        const address = formatAddressFromTags(tags);
        if (address) {
          addresses.push({
            address,
            position: { lat, lng: lon },
            tags
          });
        }
      }
    }

    // Process ways with address information
    const ways = data.elements.filter(el => el.type === 'way' && el.tags && el.tags['addr:housenumber']);
    const nodeMap = new Map(data.elements.filter(el => el.type === 'node').map(node => [node.id, node]));
    
    for (const way of ways) {
      if (way.nodes && way.nodes.length > 0) {
        // Calculate centroid of the way
        let sumLat = 0, sumLon = 0;
        let count = 0;
        
        for (const nodeId of way.nodes) {
          const node = nodeMap.get(nodeId);
          if (node) {
            sumLat += node.lat;
            sumLon += node.lon;
            count++;
          }
        }
        
        if (count > 0) {
          const lat = sumLat / count;
          const lon = sumLon / count;
          
          // Check if the centroid is inside the polygon
          if (isPointInPolygon([lat, lon], points.map(p => [p.lat, p.lng]))) {
            const address = formatAddressFromTags(way.tags);
            if (address) {
              addresses.push({
                address,
                position: { lat, lng: lon },
                tags: way.tags
              });
            }
          }
        }
      }
    }

    return addresses;
  } catch (error) {
    console.error('Error fetching addresses in polygon:', error);
    return [];
  }
};

/**
 * Format address from OSM tags
 * @param {Object} tags - OSM tags
 * @returns {string} - Formatted address
 */
function formatAddressFromTags(tags) {
  const street = tags['addr:street'] || '';
  const housenumber = tags['addr:housenumber'] || '';
  const postcode = tags['addr:postcode'] || '';
  const city = tags['addr:city'] || '';
  
  if (street && housenumber) {
    return `${street} ${housenumber}${postcode ? ', ' + postcode : ''}${city ? ' ' + city : ''}`;
  }
  return '';
}

/**
 * Search for an address using Nominatim API
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of search results
 */
export const searchAddress = async (query) => {
  if (!query || query.trim() === '') return [];

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `${API_CONFIG.nominatim.baseUrl}/search?format=json&q=${encodedQuery}&countrycodes=${API_CONFIG.nominatim.countryCode}&addressdetails=1&limit=${API_CONFIG.nominatim.limit}`;
    
    const response = await fetch(url, {
      headers: API_CONFIG.nominatim.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map(item => ({
      display_name: formatNorwegianAddress(item.address),
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      address: item.address
    }));
  } catch (error) {
    console.error('Error searching for address:', error);
    return [];
  }
};

/**
 * Reverse geocode a location using Nominatim API
 * @param {Object} latlng - { lat, lng } object
 * @returns {Promise<Object>} - Address data
 */
export const reverseGeocode = async (latlng) => {
  try {
    const url = `${API_CONFIG.nominatim.baseUrl}/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=${API_CONFIG.nominatim.zoom}&addressdetails=1&countrycodes=${API_CONFIG.nominatim.countryCode}`;
    
    const response = await fetch(url, {
      headers: API_CONFIG.nominatim.headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    throw error;
  }
};

/**
 * Search for nearby addresses
 * @param {string} street - Street name
 * @param {string} city - City name
 * @param {string} postcode - Postal code
 * @returns {Promise<Array>} - Array of nearby addresses
 */
export const searchNearbyAddresses = async (street, city, postcode) => {
  try {
    const params = new URLSearchParams({
      format: 'json',
      street: street || '',
      city: city || '',
      postalcode: postcode || '',
      countrycodes: API_CONFIG.nominatim.countryCode,
      addressdetails: 1,
      limit: API_CONFIG.nominatim.limit
    });
    
    const url = `${API_CONFIG.nominatim.baseUrl}/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: API_CONFIG.nominatim.headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching for nearby addresses:', error);
    throw error;
  }
};

export const getEmployeeProfile = async (token) => {
  const url = `${API_CONFIG.backend.baseUrl}${API_CONFIG.backend.profile}`;
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch employee profile');
  }
  return await response.json();
};

export const getAssignedAreas = async (token) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/assigned_areas/`;
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch assigned areas');
  }
  return await response.json();
};

export const getAllAreas = async (token) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/all_areas/`;
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch all areas');
  }
  return await response.json();
};

/**
 * Get all areas for the current campaign (for employees)
 * This uses the new campaign_areas endpoint that filters by campaign_id
 */
export const getCampaignAreas = async (token) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/campaign_areas/`;
  const response = await fetch(url, {
    headers: getHeadersWithCampaign(token)
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Campaign areas API error:', errorText);
    throw new Error(`Failed to fetch campaign areas: ${response.status} - ${errorText}`);
  }
  return await response.json();
};

/**
 * Get headers with campaign_id from localStorage
 */
const getHeadersWithCampaign = (token) => {
  const headers = {
    'accept': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  // Get campaign_id from localStorage
  const campaignData = localStorage.getItem('currentCampaign');
  if (campaignData) {
    // Check if it's a UUID (campaign ID) or JSON object
    if (campaignData.startsWith('{') || campaignData.startsWith('[')) {
      try {
        const campaign = JSON.parse(campaignData);
        headers['X-Campaign-ID'] = campaign.id;
        console.log('Added campaign ID to headers:', campaign.id);
      } catch (error) {
        console.error('Error parsing campaign JSON data:', error);
        // If JSON parsing fails, don't add the header
      }
    } else {
      // It's a direct campaign ID (UUID)
      headers['X-Campaign-ID'] = campaignData;
      console.log('Added campaign ID to headers (direct):', campaignData);
    }
  } else {
    console.log('No campaign data found in localStorage - API calls may fail');
    // Don't add X-Campaign-ID header if no campaign data is available
    // This will cause the backend to return an error, which is better than silent failures
  }
  
  return headers;
};

// Fetch all address markers from the backend
export const getAllAddressMarkers = async (token) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/`;
  const response = await fetch(url, {
    headers: getHeadersWithCampaign(token)
  });
  if (!response.ok) {
    throw new Error('Failed to fetch address markers');
  }
  return await response.json();
};

// Create a new address marker
export const createAddressMarker = async (token, payload) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/`;
  // Ensure tags is an object, not a string
  if (typeof payload.tags === 'string') {
    try {
      payload.tags = JSON.parse(payload.tags);
    } catch (e) {
      payload.tags = {};
    }
  }
  
  const headers = getHeadersWithCampaign(token);
  headers['Content-Type'] = 'application/json';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Failed to create address marker');
  }
  return await response.json();
};

// Delete an address marker by id
export const deleteAddressMarker = async (token, id) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/${id}/`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeadersWithCampaign(token)
  });
  if (!response.ok) {
    throw new Error('Failed to delete address marker');
  }
  return true;
};

// Fetch a single address marker by id
export const getAddressMarkerById = async (token, id) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/${id}/`;
  const response = await fetch(url, {
    headers: getHeadersWithCampaign(token)
  });
  if (!response.ok) {
    throw new Error('Failed to fetch address marker');
  }
  return await response.json();
};

export const getTeamAssignedAreas = async (token) => {
  const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/assigned_to_me/`;
  const headers = getHeadersWithCampaign(token);
  console.log('Calling assigned_to_me endpoint with headers:', headers);
  
  const response = await fetch(url, {
    headers: headers
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Team assigned areas API error:', errorText);
    throw new Error(`Failed to fetch team assigned areas: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  console.log('Assigned areas API response:', data);
  return data;
};

// Get campaign IDs for the current employee
export const getEmployeeCampaignIds = async (token, employeeId = null) => {
  // If employeeId is not provided, try to get it from localStorage or profile
  let targetEmployeeId = employeeId;
  
  if (!targetEmployeeId) {
    // Try to get employee ID from localStorage first
    const employeeProfile = localStorage.getItem('employeeProfile');
    if (employeeProfile) {
      try {
        const profile = JSON.parse(employeeProfile);
        targetEmployeeId = profile.id || profile.employee?.id;
      } catch (error) {
        console.error('Error parsing employee profile from localStorage:', error);
      }
    }
    
    // If still no employee ID, fetch the profile
    if (!targetEmployeeId) {
      try {
        const profile = await getEmployeeProfile(token);
        targetEmployeeId = profile.id || profile.employee?.id;
        // Store profile in localStorage for future use
        localStorage.setItem('employeeProfile', JSON.stringify(profile));
      } catch (error) {
        console.error('Error fetching employee profile:', error);
        throw new Error('Failed to get employee ID for campaign lookup');
      }
    }
  }
  
  if (!targetEmployeeId) {
    throw new Error('Employee ID is required to fetch campaigns');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/campaigns/campaigns/employee_campaigns/?employee_id=${targetEmployeeId}`;
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch employee campaign IDs');
  }
  
  const campaignsData = await response.json();
  // Extract just the campaign IDs
  const campaignIds = campaignsData.map(item => item.campaign.id);
  return { campaign_ids: campaignIds };
};

// Get full campaign details for the current employee
export const getEmployeeCampaigns = async (token, employeeId = null) => {
  // If employeeId is not provided, try to get it from localStorage or profile
  let targetEmployeeId = employeeId;
  
  if (!targetEmployeeId) {
    // Try to get employee ID from localStorage first
    const employeeProfile = localStorage.getItem('employeeProfile');
    if (employeeProfile) {
      try {
        const profile = JSON.parse(employeeProfile);
        targetEmployeeId = profile.id || profile.employee?.id;
      } catch (error) {
        console.error('Error parsing employee profile from localStorage:', error);
      }
    }
    
    // If still no employee ID, fetch the profile
    if (!targetEmployeeId) {
      try {
        const profile = await getEmployeeProfile(token);
        targetEmployeeId = profile.id || profile.employee?.id;
        // Store profile in localStorage for future use
        localStorage.setItem('employeeProfile', JSON.stringify(profile));
      } catch (error) {
        console.error('Error fetching employee profile:', error);
        throw new Error('Failed to get employee ID for campaign lookup');
      }
    }
  }
  
  if (!targetEmployeeId) {
    throw new Error('Employee ID is required to fetch campaigns');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/campaigns/campaigns/employee_campaigns/?employee_id=${targetEmployeeId}`;
  console.log('Fetching campaigns from URL:', url);
  console.log('Using employee ID:', targetEmployeeId);
  
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  console.log('Response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error response:', errorText);
    throw new Error(`Failed to fetch employee campaigns: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('API Response data:', data);
  return data;
};
