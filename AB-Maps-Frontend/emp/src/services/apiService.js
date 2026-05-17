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
import { fetchWithAuthRefresh } from '../utils/apiInterceptor';
import { getAccessToken } from '../utils/tokenSync';
import { sanitizeAddressWritePayload } from '../constants/neiSubcategory';
import { messageFromErrorResponse } from '../utils/apiFieldErrors';

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

export const getEmployeeProfile = async (token = null) => {
  // Use provided token or get from storage
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}${API_CONFIG.backend.profile}`;
  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch employee profile');
  }
  return await response.json();
};

export const getAssignedAreas = async (token = null) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/assigned_areas/`;
  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch assigned areas');
  }
  return await response.json();
};

export const getAllAreas = async (token = null) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/all_areas/`;
  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch all areas');
  }
  return await response.json();
};

/**
 * Get all areas for the current campaign (for employees)
 * Uses location-based nearby API when coordinates available, falls back to campaign_areas
 */
export const getCampaignAreas = async (token = null, lat = null, lng = null) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  if (lat && lng) {
    // Use nearby API when location is available
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius_m: '145000',
      include_geometry: 'true'
    });

    // Add campaign_id from localStorage
    try {
      const raw = localStorage.getItem('currentCampaign');
      if (raw) {
        let campaignId;
        if (raw.startsWith('{') || raw.startsWith('[')) {
          const campaign = JSON.parse(raw);
          campaignId = campaign?.id;
        } else {
          campaignId = raw;
        }
        if (campaignId) {
          params.append('campaign_id', campaignId);
        }
      }
    } catch (_) { }

    const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/nearby/?${params.toString()}`;
    const response = await fetchWithAuthRefresh(url, {
      method: 'GET',
      headers: getHeadersWithCampaign()
    });

    if (!response.ok) {
      console.warn('Nearby campaign areas API failed, falling back to regular campaign areas');
      // Fallback to regular campaign areas API
      return await getCampaignAreas(); // Recursive call without coordinates
    }

    const data = await response.json();
    // Extract results from paginated response to match old format
    return Array.isArray(data) ? data : (data.results || []);
  } else {
    // Fallback to old API when no location available
    const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/campaign_areas/`;
    const response = await fetchWithAuthRefresh(url, {
      method: 'GET',
      headers: getHeadersWithCampaign()
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Campaign areas API error:', errorText);
      throw new Error(`Failed to fetch campaign areas: ${response.status} - ${errorText}`);
    }
    return await response.json();
  }
};

/**
 * Get headers with campaign_id from localStorage
 * Note: Authorization header is now handled by apiInterceptor
 */
const getHeadersWithCampaign = () => {
  const headers = {
    'accept': 'application/json',
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
export const getAllAddressMarkers = async (token = null) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const initialUrl = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/`;
  const headers = getHeadersWithCampaign();
  // Iterate through paginated results using the "next" attribute
  let url = initialUrl;
  let aggregated = [];
  let count = 0;
  let previous = null;

  const normalizeNextUrl = (nextUrl) => {
    if (!nextUrl) return null;
    try {
      const init = new URL(initialUrl);
      const n = new URL(nextUrl, init.origin);
      // Force same protocol as initial
      n.protocol = init.protocol;
      return n.toString();
    } catch (_) {
      return nextUrl;
    }
  };

  while (url) {
    const response = await fetchWithAuthRefresh(url, {
      method: 'GET',
      headers: headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch address markers');
    }
    const data = await response.json();
    const pageResults = Array.isArray(data) ? data : (data.results || []);
    aggregated = aggregated.concat(pageResults);
    // Prefer backend-provided count from the first page if available
    if (!count && data && typeof data.count === 'number') {
      count = data.count;
    }
    previous = data?.previous ?? previous;
    url = normalizeNextUrl(data?.next) || null;
  }

  // If backend didn't provide a count, use aggregated length
  if (!count) count = aggregated.length;
  return { count, next: null, previous, results: aggregated };
};

// Create a new address marker
export const createAddressMarker = async (token = null, payload) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/`;
  // Ensure tags is an object, not a string
  if (typeof payload.tags === 'string') {
    try {
      payload.tags = JSON.parse(payload.tags);
    } catch (e) {
      payload.tags = {};
    }
  }

  const headers = getHeadersWithCampaign();
  const body = sanitizeAddressWritePayload(
    typeof payload === 'object' && payload !== null ? { ...payload } : {}
  );

  const response = await fetchWithAuthRefresh(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const msg = await messageFromErrorResponse(response);
    throw new Error(msg);
  }
  return await response.json();
};

// Delete an address marker by id
export const deleteAddressMarker = async (token = null, id) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/${id}/`;
  const response = await fetchWithAuthRefresh(url, {
    method: 'DELETE',
    headers: getHeadersWithCampaign()
  });
  if (!response.ok) {
    throw new Error(`Failed to delete address marker: ${response.status}`);
  }
  return true;
};

// Fetch a single address marker by id
export const getAddressMarkerById = async (token = null, id) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/addresses/addresses/${id}/`;
  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: getHeadersWithCampaign()
  });
  if (!response.ok) {
    throw new Error('Failed to fetch address marker');
  }
  return await response.json();
};

export const getTeamAssignedAreas = async (token = null) => {
  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/areas/areas/assigned_to_me/`;
  const headers = getHeadersWithCampaign();
  console.log('Calling assigned_to_me endpoint with headers:', headers);

  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: headers
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Team assigned areas API error:', errorText);
    throw new Error(`Failed to fetch team assigned areas: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  console.log('Assigned areas API response:', data);
  
  // Handle paginated response (object with results) or direct array
  if (Array.isArray(data)) {
    return data;
  } else if (data.results && Array.isArray(data.results)) {
    return data.results;
  } else {
    console.warn('Unexpected response format from assigned_to_me:', data);
    return [];
  }
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

  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/campaigns/campaigns/employee_campaigns/?employee_id=${targetEmployeeId}`;
  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
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

  const accessToken = token || getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/campaigns/campaigns/employee_campaigns/?employee_id=${targetEmployeeId}`;
  console.log('Fetching campaigns from URL:', url);
  console.log('Using employee ID:', targetEmployeeId);

  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
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

/**
 * Fetch Talkmore/Telenor carrier markers for a specific area
 * @param {string} areaId - Area UUID
 * @param {boolean} includeAll - Whether to include all results (default: true)
 * @returns {Promise<Array>} Array of GeoJSON features with carrier information
 */
export const getTalkmoreAreaResults = async (areaId, includeAll = true) => {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }
  
  const url = `${API_CONFIG.backend.baseUrl}/api/talkmore/areas/${areaId}/results/?include_all=${includeAll}`;
  const response = await fetchWithAuthRefresh(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Talkmore area results API error:', errorText);
    throw new Error(`Failed to fetch Talkmore area results: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  // Handle different response formats
  if (Array.isArray(data)) {
    return data;
  } else if (data.results && Array.isArray(data.results)) {
    return data.results;
  } else if (data.features && Array.isArray(data.features)) {
    return data.features;
  } else {
    console.warn('Unexpected response format from Talkmore API:', data);
    return [];
  }
};
