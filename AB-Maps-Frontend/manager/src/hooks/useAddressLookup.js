import { useState, useCallback } from 'react';
import { reverseGeocode, searchNearbyAddresses } from '../services/apiService';
import { formatNorwegianAddress } from '../utils/addressUtils';

/**
 * Custom hook for address lookup functionality
 * @returns {Object} - Address lookup methods and state
 */
const useAddressLookup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Lookup address at a specific point on the map
   * @param {Object} latlng - { lat, lng } object
   * @returns {Promise<Array>} - Array of formatted addresses
   */
  const lookupAddressAtPoint = useCallback(async (latlng) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // More generous timeout for external API calls
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Address lookup timeout')), 15000); // 15 second timeout
      });
      
      const addressLookupPromise = (async () => {
        // Add delay between requests to avoid rate limiting
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        
        try {
          // First, get the exact clicked location with individual timeout
          const reverseGeocodePromise = reverseGeocode(latlng);
          const reverseGeocodeTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Reverse geocoding timeout')), 8000); // 8s for first call
          });
          
          const data = await Promise.race([reverseGeocodePromise, reverseGeocodeTimeout]);
          
          if (!data.address) {
            throw new Error('No address data found');
          }

          // Get precise address components
          const street = data.address.road || data.address.pedestrian || data.address.street || '';
          const houseNumber = data.address.house_number || '';
          const postcode = data.address.postcode || '';
          const city = data.address.city || data.address.town || data.address.village || '';
          
          // Format the main address
          const mainAddress = formatNorwegianAddress(data.address);
          
          // If we have a precise address (with house number), use it directly
          if (street && houseNumber) {
            return [mainAddress];
          } else {
            // Wait a bit before making the second request to avoid rate limiting
            await delay(500); // Reduced from 1000ms to 500ms
            
            // Search for nearby addresses with individual timeout
            const nearbyPromise = searchNearbyAddresses(street, city, postcode);
            const nearbyTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Nearby search timeout')), 6000); // 6s for second call
            });
            
            const nearbyData = await Promise.race([nearbyPromise, nearbyTimeout]);
            
            // Format and filter nearby addresses
            const nearbyAddresses = nearbyData
              .map(addr => formatNorwegianAddress(addr.address))
              .filter(addr => addr && addr.trim() !== '');
            
            return nearbyAddresses;
          }
        } catch (apiError) {
          // If any API call fails, return coordinates as fallback
          console.warn('API call failed, using coordinate fallback:', apiError.message);
          const fallbackAddress = `Koordinater: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
          return [fallbackAddress];
        }
      })();
      
      // Race between overall timeout and address lookup
      const result = await Promise.race([addressLookupPromise, timeoutPromise]);
      
      // If we get here, the request was successful
      return result;
      
    } catch (err) {
      // Provide more user-friendly error messages
      let errorMessage = 'Kunne ikke hente adresse';
      if (err.message.includes('timeout')) {
        errorMessage = 'Adresseoppslag tok for lang tid. Prøver koordinater som alternativ.';
      } else if (err.message.includes('rate limit')) {
        errorMessage = 'For mange forespørsler. Prøver koordinater som alternativ.';
      }
      
      setError(errorMessage);
      console.error('Error looking up address:', err);
      
      // Return a fallback address based on coordinates
      const fallbackAddress = `Koordinater: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
      return [fallbackAddress];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    lookupAddressAtPoint,
    isLoading,
    error,
    clearError: () => setError(null)
  };
};

export default useAddressLookup;
