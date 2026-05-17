import { useState, useCallback, useEffect } from 'react';
import addressService from '../services/addressService';
import { ADDRESS_STATUS_OPTIONS } from '../config/apiConfig';

/**
 * Custom hook for managing address operations
 */
export const useAddresses = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load all addresses
   */
  const loadAddresses = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    setAddresses([]);
    try {
      let buffer = [];
      const flush = () => {
        if (buffer.length === 0) return;
        setAddresses(prev => [...prev, ...buffer]);
        buffer = [];
      };

      await addressService.streamAddressesNdjson(
        (item) => {
          buffer.push(item);
          if (buffer.length >= 200) flush();
        },
        () => {
          flush();
          setLoading(false);
        },
        async () => {
          try {
            const data = await addressService.getAddresses(filters);
            setAddresses(data);
          } catch (err) {
            setError(err.message);
            console.error('Error loading addresses (fallback):', err);
          } finally {
            setLoading(false);
          }
        },
        undefined,
        filters
      );
    } catch (err) {
      setError(err.message);
      setLoading(false);
      console.error('Error starting streaming addresses:', err);
    }
  }, []);

  /**
   * Create a new address
   */
  const createAddress = useCallback(async (addressData) => {
    setLoading(true);
    setError(null);
    try {
      const newAddress = await addressService.createAddress(addressData);
      setAddresses(prev => [...prev, newAddress]);
      return newAddress;
    } catch (err) {
      setError(err.message);
      console.error('Error creating address:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an address
   */
  const updateAddress = useCallback(async (addressId, addressData) => {
    setLoading(true);
    setError(null);
    try {
      const updatedAddress = await addressService.updateAddress(addressId, addressData);
      setAddresses(prev => prev.map(addr => 
        addr.id === addressId ? updatedAddress : addr
      ));
      return updatedAddress;
    } catch (err) {
      setError(err.message);
      console.error('Error updating address:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete an address
   */
  const deleteAddress = useCallback(async (addressId) => {
    setLoading(true);
    setError(null);
    try {
      await addressService.deleteAddress(addressId);
      setAddresses(prev => prev.filter(addr => addr.id !== addressId));
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error deleting address:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    addresses,
    loading,
    error,
    loadAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    clearError,
  };
};

/**
 * Hook for managing a single address
 */
export const useAddress = (addressId) => {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAddress = useCallback(async () => {
    if (!addressId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await addressService.getAddress(addressId);
      setAddress(data);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error loading address:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addressId]);

  const updateAddress = useCallback(async (addressData) => {
    if (!addressId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const updatedAddress = await addressService.updateAddress(addressId, addressData);
      setAddress(updatedAddress);
      return updatedAddress;
    } catch (err) {
      setError(err.message);
      console.error('Error updating address:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addressId]);

  const deleteAddress = useCallback(async () => {
    if (!addressId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await addressService.deleteAddress(addressId);
      setAddress(null);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error deleting address:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addressId]);

  // Load address on mount if addressId is provided
  useEffect(() => {
    if (addressId) {
      loadAddress();
    }
  }, [addressId, loadAddress]);

  return {
    address,
    loading,
    error,
    loadAddress,
    updateAddress,
    deleteAddress,
  };
}; 