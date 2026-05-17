/**
 * @deprecated This service is DEPRECATED as of Phase 4 cleanup.
 * 
 * MIGRATION NOTE:
 * Direct Geonorge API calls are no longer needed. The new backend handles apartment data:
 * - Use buildingService.bulkCreateApartments() to create buildings with apartments
 * - Use buildingService.getApartments() to fetch apartments for a building
 * - Use buildingService.updateApartmentStatus() to update apartment status
 * 
 * The Discovery Flow (in useMapState.js) now uses fetchLocalLookupForAddress() which calls
 * the backend API /api/apartments/local-lookup/ instead of Geonorge.
 * 
 * Geonorge code is kept but disabled for reference.
 * 
 * Original description:
 * Apartment Lookup Service
 * Integrates with Geonorge API to find apartments (bruksenhetsnummer) for Norwegian addresses
 */

import { API_CONFIG } from '../config/apiConfig';
import { fetchWithAuthRefresh } from '../utils/apiInterceptor';

// DISABLED: Geonorge API constants (kept for reference - only used in disabled code)
const GEONORGE_BASE = "https://ws.geonorge.no/adresser/v1/sok"; // DISABLED
const UA = "Mozilla/5.0 AB-Maps/ApartmentLookup"; // DISABLED
const TIMEOUT = 10000; // 10 seconds - DISABLED

// Apostrophe variants that need to be normalized
const APOSTROPHE_VARIANTS = {
  '\u2019': "'", // Right single quotation mark
  '\u2018': "'", // Left single quotation mark
  '\u02BC': "'", // Modifier letter apostrophe
  '\u2032': "'"  // Prime
};

// Cache for apartment lookup results
const apartmentCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Normalize apostrophes in address string
 * @param {string} s - Address string
 * @returns {string} Normalized string
 */
const normalizeApostrophes = (s) => {
  let normalized = s;
  for (const [variant, standard] of Object.entries(APOSTROPHE_VARIANTS)) {
    normalized = normalized.replace(new RegExp(variant, 'g'), standard);
  }
  return normalized;
};

/**
 * Normalize whitespace (multiple spaces → single space, trim)
 * @param {string} s - Address string
 * @returns {string} Normalized string
 */
const squashSpaces = (s) => {
  return s.replace(/\s+/g, ' ').trim();
};

/**
 * Parse OSM-style address into components
 * Supports both full format (with postnummer) and loose format (without postnummer)
 * @param {string} addr - Address string
 * @returns {Object} { street, number, bokstav, postnummer, poststed }
 * @throws {Error} If address cannot be parsed
 */
const parseOSMAddressLoose = (addr) => {
  const s = normalizeApostrophes(squashSpaces(addr));

  // Full form with postnummer: "Osterhaus' gate 12B, 0183 Oslo"
  const fullFormRegex = /^(.+?)[\s,]+(\d+)\s*([A-Za-zÆØÅæøå]?)\s*,?\s*(\d{4})(?:[\s,]+([A-Za-zÆØÅæøå.\- ]+))?\s*$/;
  const fullMatch = s.match(fullFormRegex);
  
  if (fullMatch) {
    return {
      street: fullMatch[1].trim(),
      number: fullMatch[2],
      bokstav: (fullMatch[3] || '').toUpperCase(),
      postnummer: fullMatch[4],
      poststed: (fullMatch[5] || '').trim() || null
    };
  }

  // Loose form without postnummer: "Skogveien 162D"
  const looseFormRegex = /^(.+?)[\s,]+(\d+)\s*([A-Za-zÆØÅæøå]?)\s*$/;
  const looseMatch = s.match(looseFormRegex);
  
  if (looseMatch) {
    return {
      street: looseMatch[1].trim(),
      number: looseMatch[2],
      bokstav: (looseMatch[3] || '').toUpperCase(),
      postnummer: null,
      poststed: null
    };
  }

  throw new Error(
    "Kunne ikke tolke adressen. Eksempler: 'Skogveien 162D' eller 'Osterhaus' gate 12B, 0183 Oslo'."
  );
};

/**
 * Resolve postnummer using free-text search via Geonorge API
 * @param {string} street - Street name
 * @param {string} number - House number
 * @param {string} bokstav - House letter (optional)
 * @param {string|null} poststed - City name (optional)
 * @returns {Promise<Object>} { postnummer, rawResponse }
 */
const resolvePostnummer = async (street, number, bokstav, poststed) => {
  const q = `${street} ${number}${bokstav}`.trim();
  console.log('[ApartmentService] Resolving postnummer:', { street, number, bokstav, poststed, query: q });
  
  try {
    const params = new URLSearchParams({
      sok: q,
      treffPerSide: '200',
      side: '0'
    });

    const url = `${GEONORGE_BASE}?${params.toString()}`;
    console.log('[ApartmentService] Free-text search request:', { url, query: q });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    console.log('[ApartmentService] Free-text search response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      duration: `${duration}ms`
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ApartmentService] Free-text search error:', {
        url,
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('[ApartmentService] Free-text search success:', {
      url,
      totalHits: data.metadata?.totaltAntallTreff || 0,
      addressesFound: data.adresser?.length || 0
    });
    const candidates = [];

    // Filter candidates by matching number, bokstav, and street name
    for (const adr of (data.adresser || [])) {
      if (String(adr.nummer || '') !== String(number)) {
        continue;
      }

      const adrBokstav = (adr.bokstav || '').toUpperCase();
      if (bokstav && adrBokstav !== bokstav) {
        continue;
      }

      if ((adr.adressenavn || '').trim().toLowerCase() !== street.trim().toLowerCase()) {
        continue;
      }

      candidates.push(adr);
    }

    if (candidates.length === 0) {
      return { postnummer: null, rawResponse: data };
    }

    // If poststed is provided, try to match it
    if (poststed) {
      for (const adr of candidates) {
        if ((adr.poststed || '').trim().toLowerCase() === poststed.trim().toLowerCase()) {
          return { postnummer: adr.postnummer, rawResponse: data };
        }
      }
    }

    // Count postnummer occurrences and return the most common one
    const counts = {};
    for (const adr of candidates) {
      const pn = adr.postnummer;
      if (pn) {
        counts[pn] = (counts[pn] || 0) + 1;
      }
    }

    if (Object.keys(counts).length === 0) {
      return { postnummer: null, rawResponse: data };
    }

    const best = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0][0];

    return { postnummer: best, rawResponse: data };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

/**
 * Extract apartment units (bruksenhetsnummer) from Geonorge response
 * @param {Object} geoData - Geonorge API response
 * @returns {Array<string>} Sorted array of unit numbers
 */
const extractUnits = (geoData) => {
  const units = new Set();

  for (const adr of (geoData.adresser || [])) {
    // Handle different possible field names
    let bn = adr.bruksenhetsnummer || 
             adr.bruksenhetsnummere || 
             adr.bruksenhetsnummerer;

    if (!bn) {
      continue;
    }

    // Handle both single values and arrays
    if (Array.isArray(bn)) {
      for (const x of bn) {
        if (x) {
          units.add(String(x).trim());
        }
      }
    } else {
      units.add(String(bn).trim());
    }
  }

  // Sort units numerically if possible, otherwise alphabetically
  return Array.from(units).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
};

/**
 * Get cached result for an address
 * @param {string} address - Normalized address
 * @returns {Object|null} Cached result or null
 */
const getCachedResult = (address) => {
  const normalized = squashSpaces(normalizeApostrophes(address.toLowerCase()));
  const cached = apartmentCache.get(normalized);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  return null;
};

/**
 * Set cached result for an address
 * @param {string} address - Normalized address
 * @param {Object} data - Result data to cache
 */
const setCachedResult = (address, data) => {
  const normalized = squashSpaces(normalizeApostrophes(address.toLowerCase()));
  apartmentCache.set(normalized, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Call Geonorge API with exact query parameters
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} API response
 */
const geonorge = async (params) => {
  const queryParams = new URLSearchParams();
  
  // Add all parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      queryParams.append(key, String(value));
    }
  });

  const url = `${GEONORGE_BASE}?${queryParams.toString()}`;
  console.log('[ApartmentService] Geonorge API Request:', {
    url,
    params,
    method: 'GET'
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    console.log('[ApartmentService] Geonorge API Response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      duration: `${duration}ms`,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ApartmentService] Geonorge API Error Response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      // Handle 502 Bad Gateway specifically - might be temporary server issue
      if (response.status === 502) {
        throw new Error(`Geonorge API server error (502 Bad Gateway). This is usually a temporary issue with the Geonorge service. Please try again in a moment.`);
      }
      
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('[ApartmentService] Geonorge API Success:', {
      url,
      totalHits: data.metadata?.totaltAntallTreff || 0,
      addressesFound: data.adresser?.length || 0,
      data: data
    });

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[ApartmentService] Geonorge API Exception:', {
      url,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    });
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

/**
 * Fetch apartment units using backend local-lookup API
 * 
 * This replaces the Geonorge API call with a backend endpoint that handles
 * apartment lookup server-side.
 * 
 * @param {string} addressLine - Address string (e.g., "Hammerfestgata 2D, 0565 Oslo")
 * @param {Object} options - Optional parameters
 * @param {string} options.campaignId - Campaign ID (optional)
 * @param {string} options.createdById - Created by ID (optional)
 * @returns {Promise<Object>} Response matching Geonorge format:
 *   {
 *     units: [...],  // Array of apartment numbers
 *     base_address: string,
 *     campaign_id: string,
 *     position: { lat, lon },
 *     created_by_id: string
 *   }
 */
export const fetchLocalLookupForAddress = async (addressLine, options = {}) => {
  console.log('[ApartmentService] fetchLocalLookupForAddress called:', { addressLine, options });
  
  // Check cache first
  const cached = getCachedResult(addressLine);
  if (cached && cached.units) {
    console.log('[ApartmentService] Using cached result:', { addressLine, units: cached.units });
    return cached;
  }

  try {
    const BASE_URL = API_CONFIG.backend.baseUrl;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('address', addressLine);
    
    if (options.campaignId) {
      queryParams.append('campaign_id', options.campaignId);
    }
    
    if (options.createdById) {
      queryParams.append('created_by_id', options.createdById);
    }
    
    const url = `${BASE_URL}/api/apartments/local-lookup/?${queryParams.toString()}`;
    console.log('[ApartmentService] Local lookup API request:', { url, addressLine });
    
    const response = await fetchWithAuthRefresh(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ApartmentService] Local lookup API error:', {
        status: response.status,
        body: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[ApartmentService] Local lookup API success:', {
      addressLine,
      apartmentCount: data.apartment_numbers?.length || 0,
      data
    });

    // Transform response to match expected format (with units array)
    const result = {
      units: data.apartment_numbers || [],
      base_address: data.base_address,
      campaign_id: data.campaign_id,
      position: data.position,
      created_by_id: data.created_by_id
    };

    // Cache the result
    setCachedResult(addressLine, result);
    
    return result;
  } catch (error) {
    console.error('[ApartmentService] Local lookup failed:', error);
    
    // Return empty result on error (matching Geonorge behavior)
    const errorResult = {
      units: [],
      base_address: addressLine,
      campaign_id: null,
      position: null,
      created_by_id: null,
      note: `local_lookup_error: ${error.message}`
    };
    
    // Cache error result for a shorter duration (5 minutes)
    setCachedResult(addressLine, errorResult);
    return errorResult;
  }
};

/**
 * DISABLED: Master function: Fetch apartment units for an address using Geonorge API
 * 
 * This function is disabled in favor of fetchLocalLookupForAddress() which uses
 * the backend API /api/apartments/local-lookup/
 * 
 * Process:
 * 1. Parse address (with/without postnummer)
 * 2. If postnummer missing, resolve it via free-text search
 * 3. Perform exact query with postnummer
 * 4. Extract apartment units
 * 
 * @param {string} addressLine - Address string (e.g., "Hausmanns gate 19A, 0182 Oslo")
 * @returns {Promise<Object>} Structured response:
 *   {
 *     input: { address, parsed: {...} },
 *     resolved: { postnummer, source: 'given'|'resolved'|'unknown' },
 *     exact_query_params: {...} | null,
 *     raw_response: {...} | null,
 *     units: [...],  // Array of apartment numbers
 *     note: 'ok' | 'parser_error' | 'postnummer_not_resolved' | ...
 *   }
 */
export const fetchGeonorgeForAddress = async (addressLine) => {
  // RE-ENABLED: Used as fallback when local-lookup returns 0 apartments
  console.log('[ApartmentService] fetchGeonorgeForAddress called (fallback):', { addressLine });
  
  // Use a different cache key for Geonorge to avoid conflicts with local-lookup cache
  // Declare once at the top to avoid redeclaration errors
  const geonorgeCacheKey = `geonorge:${addressLine}`;
  const normalizedGeonorgeKey = squashSpaces(normalizeApostrophes(geonorgeCacheKey.toLowerCase()));
  const cachedGeonorge = apartmentCache.get(normalizedGeonorgeKey);
  
  if (cachedGeonorge && Date.now() - cachedGeonorge.timestamp < CACHE_DURATION) {
    const cachedData = cachedGeonorge.data;
    if (cachedData && cachedData.units && cachedData.units.length > 0) {
      console.log('[ApartmentService] Using cached Geonorge result:', { addressLine, units: cachedData.units });
      return cachedData;
    }
    // If cached result has 0 units, still try fresh API call (cache might be stale)
    console.log('[ApartmentService] Cached Geonorge result has 0 units, making fresh API call');
  }


  let parsed;
  try {
    parsed = parseOSMAddressLoose(addressLine);
    console.log('[ApartmentService] Address parsed:', { addressLine, parsed });
  } catch (error) {
    console.error('[ApartmentService] Address parsing error:', { addressLine, error: error.message });
    const errorResult = {
      input: {
        address: addressLine,
        parsed: null
      },
      resolved: {
        postnummer: null,
        source: 'unknown'
      },
      exact_query_params: null,
      raw_response: null,
      units: [],
      note: `parser_error: ${error.message}`
    };
    
    // Cache error result with Geonorge-specific key
    setCachedResult(geonorgeCacheKey, errorResult);
    return errorResult;
  }

  const { street, number, bokstav, postnummer: givenPostnummer, poststed } = parsed;
  let postnummer = givenPostnummer;
  let resolvedSource = givenPostnummer ? 'given' : 'resolved';
  let fritekstRaw = null;

  // If postnummer is missing, try to resolve it
  if (!postnummer) {
    try {
      const resolved = await resolvePostnummer(street, number, bokstav, poststed);
      postnummer = resolved.postnummer;
      fritekstRaw = resolved.rawResponse;
      
      if (!postnummer) {
        // Could not resolve postnummer
        const unresolvedResult = {
          input: {
            address: addressLine,
            parsed: {
              adressenavn: street,
              nummer: number,
              bokstav: bokstav || null,
              postnummer: null,
              poststed: poststed || null
            }
          },
          resolved: {
            postnummer: null,
            source: 'unknown'
          },
          exact_query_params: null,
          raw_response: fritekstRaw,
          units: [],
          note: 'postnummer_not_resolved; returning free-text search response'
        };
        
        setCachedResult(geonorgeCacheKey, unresolvedResult);
        return unresolvedResult;
      }
    } catch (error) {
      const errorResult = {
        input: {
          address: addressLine,
          parsed: {
            adressenavn: street,
            nummer: number,
            bokstav: bokstav || null,
            postnummer: null,
            poststed: poststed || null
          }
        },
        resolved: {
          postnummer: null,
          source: 'unknown'
        },
        exact_query_params: null,
        raw_response: null,
        units: [],
        note: `resolve_postnummer_error: ${error.message}`
      };
      
      setCachedResult(geonorgeCacheKey, errorResult);
      return errorResult;
    }
  }

  // We have a postnummer -> do exact query
  const exactParams = {
    adressenavn: street,
    nummer: number,
    postnummer: postnummer,
    treffPerSide: '100',
    side: '0'
  };

  if (bokstav) {
    exactParams.bokstav = bokstav;
  }

  console.log('[ApartmentService] Performing exact query:', { 
    addressLine, 
    exactParams,
    resolvedPostnummer: postnummer,
    resolvedSource 
  });

  let exactRaw;
  try {
    exactRaw = await geonorge(exactParams);
  } catch (error) {
    console.error('[ApartmentService] Exact query error:', { 
      addressLine, 
      exactParams, 
      error: error.message,
      errorStack: error.stack 
    });
    const errorResult = {
      input: {
        address: addressLine,
        parsed: {
          adressenavn: street,
          nummer: number,
          bokstav: bokstav || null,
          postnummer: postnummer,
          poststed: poststed || null
        }
      },
      resolved: {
        postnummer: postnummer,
        source: resolvedSource
      },
      exact_query_params: exactParams,
      raw_response: null,
      units: [],
      note: `exact_query_http_error: ${error.message}`
    };
    
    setCachedResult(geonorgeCacheKey, errorResult);
    return errorResult;
  }

  const units = extractUnits(exactRaw);
  console.log('[ApartmentService] Extracted units:', { addressLine, units, unitCount: units.length });

  // If exact query returns nothing, still return the response
  if (!(exactRaw.adresser && exactRaw.adresser.length > 0)) {
    console.warn('[ApartmentService] No addresses found in exact query:', { addressLine, exactParams });
    const noMatchesResult = {
      input: {
        address: addressLine,
        parsed: {
          adressenavn: street,
          nummer: number,
          bokstav: bokstav || null,
          postnummer: postnummer,
          poststed: poststed || null
        }
      },
      resolved: {
        postnummer: postnummer,
        source: resolvedSource
      },
      exact_query_params: exactParams,
      raw_response: exactRaw,
      units: units,
      note: 'no_exact_matches_for_params'
    };
    
    setCachedResult(geonorgeCacheKey, noMatchesResult);
    return noMatchesResult;
  }

  // Success path: return exact raw + extracted units
  const successResult = {
    input: {
      address: addressLine,
      parsed: {
        adressenavn: street,
        nummer: number,
        bokstav: bokstav || null,
        postnummer: postnummer,
        poststed: poststed || null
      }
    },
    resolved: {
      postnummer: postnummer,
      source: resolvedSource
    },
    exact_query_params: exactParams,
    raw_response: exactRaw,
    units: units,
    note: 'ok'
  };

  console.log('[ApartmentService] Success result:', { 
    addressLine, 
    units, 
    unitCount: units.length,
    note: successResult.note 
  });

  // Cache with Geonorge-specific key
  setCachedResult(geonorgeCacheKey, successResult);
  return successResult;
};

/**
 * Clear the apartment lookup cache
 * Useful for testing or when cache needs to be invalidated
 */
export const clearCache = () => {
  apartmentCache.clear();
};

/**
 * Get cache statistics (for debugging)
 * @returns {Object} Cache stats
 */
export const getCacheStats = () => {
  return {
    size: apartmentCache.size,
    entries: Array.from(apartmentCache.keys())
  };
};

export default {
  fetchGeonorgeForAddress, // DISABLED - kept for reference
  fetchLocalLookupForAddress, // NEW - active function
  clearCache,
  getCacheStats
};

