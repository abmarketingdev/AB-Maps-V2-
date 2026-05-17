/**
 * Apartment Count Calculator Utility
 * 
 * Calculates apartment counts for multiple addresses in batches with throttling,
 * error handling, progress tracking, and caching.
 */

import { fetchLocalLookupForAddress } from '../services/apartmentService';
import authService from '../services/authService';

// Configuration
const BATCH_SIZE = 5; // Number of concurrent requests
const BATCH_DELAY = 200; // Delay between batches (ms)
const MAX_RETRIES = 2; // Maximum retry attempts for failed requests
const RETRY_DELAY = 1000; // Delay before retry (ms)

/**
 * Calculate apartment counts for all addresses in a draft
 * 
 * @param {Array} addresses - Array of address objects from getAddressesInPolygon
 *   Format: [{ address: "Street 123", position: {lat, lng}, tags: {...} }, ...]
 * @param {Function} onProgress - Progress callback: (completed, total, currentAddress) => void
 * @returns {Promise<Array>} Array of addresses with apartment data added:
 *   [{ address, position, tags, apartmentCount, apartments, apartmentStatus, apartmentError }, ...]
 */
export const calculateApartmentCounts = async (addresses, onProgress = null) => {
  if (!addresses || addresses.length === 0) {
    return [];
  }

  const total = addresses.length;
  let completed = 0;
  const results = [];

  // Process addresses in batches
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    
    // Process batch concurrently
    const batchPromises = batch.map(async (addr, batchIndex) => {
      const addressString = addr.address;
      
      // Initialize result with original address data
      const result = {
        ...addr,
        apartmentCount: 0,
        apartments: [],
        apartmentStatus: 'calculating',
        apartmentError: null
      };

      // Try to fetch apartment data with retries
      let lastError = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Add small delay between retries (except first attempt)
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          }

          // Get campaign ID for the API call (optional)
          const campaignId = authService.getCampaignId();
          
          // Call backend local-lookup API
          const apartmentData = await fetchLocalLookupForAddress(addressString, {
            campaignId,
            createdById: null // Not available in batch context
          });
          
          // Extract apartment units
          const units = apartmentData.units || [];
          result.apartmentCount = units.length;
          result.apartments = units;
          result.apartmentStatus = 'completed';
          result.apartmentError = null;
          
          return result;
        } catch (error) {
          lastError = error;
          
          // If this was the last attempt, mark as error
          if (attempt === MAX_RETRIES) {
            result.apartmentStatus = 'error';
            result.apartmentError = error.message || 'Failed to fetch apartment data';
            result.apartmentCount = 0;
            result.apartments = [];
            
            return result;
          }
        }
      }

      // Should never reach here, but just in case
      result.apartmentStatus = 'error';
      result.apartmentError = lastError?.message || 'Unknown error';
      return result;
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Update progress after batch completes
    completed = results.length;
    if (onProgress) {
      const lastAddress = batchResults[batchResults.length - 1]?.address || '';
      onProgress(completed, total, lastAddress);
    }

    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return results;
};

/**
 * Calculate total apartment count from addresses with apartment data
 * 
 * @param {Array} addresses - Array of addresses with apartment data
 * @returns {number} Total apartment count
 */
export const getTotalApartmentCount = (addresses) => {
  if (!addresses || addresses.length === 0) return 0;
  
  return addresses.reduce((total, addr) => {
    return total + (addr.apartmentCount || 0);
  }, 0);
};

/**
 * Get statistics about apartment calculation
 * 
 * @param {Array} addresses - Array of addresses with apartment data
 * @returns {Object} Statistics object
 */
export const getApartmentStats = (addresses) => {
  if (!addresses || addresses.length === 0) {
    return {
      total: 0,
      completed: 0,
      error: 0,
      calculating: 0,
      totalApartments: 0,
      addressesWithApartments: 0,
      addressesWithoutApartments: 0
    };
  }

  const stats = {
    total: addresses.length,
    completed: 0,
    error: 0,
    calculating: 0,
    totalApartments: 0,
    addressesWithApartments: 0,
    addressesWithoutApartments: 0
  };

  addresses.forEach(addr => {
    const status = addr.apartmentStatus || 'unknown';
    
    if (status === 'completed') {
      stats.completed++;
      const count = addr.apartmentCount || 0;
      stats.totalApartments += count;
      if (count > 0) {
        stats.addressesWithApartments++;
      } else {
        stats.addressesWithoutApartments++;
      }
    } else if (status === 'error') {
      stats.error++;
    } else if (status === 'calculating') {
      stats.calculating++;
    }
  });

  return stats;
};

export default {
  calculateApartmentCounts,
  getTotalApartmentCount,
  getApartmentStats
};

