import { useState, useEffect, useCallback } from 'react';
import managerWebSocketService from '../services/managerWebSocketService';

/**
 * Custom hook to manage employee location state and WebSocket updates
 */
export const useEmployeeLocation = () => {
  const [employeeMarkers, setEmployeeMarkers] = useState([]);
  const [employeeLocationData, setEmployeeLocationData] = useState(new Map());
  const [locationCallbacks, setLocationCallbacks] = useState(new Map());

  // Handle employee location updates from WebSocket
  const handleEmployeeLocationUpdate = useCallback((employeeData) => {
    // Log the exact payload received from the backend
    console.log('[useEmployeeLocation] Raw employee location payload received:', employeeData);
    console.log('Employee location update received:', employeeData);
    console.log('Employee data structure:', {
      id: employeeData.id,
      name: employeeData.name,
      currentPosition: employeeData.currentPosition,
      recent_locations: employeeData.recent_locations,
      locationAccuracy: employeeData.locationAccuracy,
      lastSeen: employeeData.lastSeen
    });
    
    if (employeeData && employeeData.id) {
      // Check if this is a real-time update (has currentPosition)
      const isRealTimeUpdate = employeeData.currentPosition && 
        employeeData.currentPosition.lat && 
        employeeData.currentPosition.lng;
      
      // Check if this has recent_locations data (from employee_request response)
      const hasRecentLocations = employeeData.recent_locations && 
        employeeData.recent_locations.length > 0;
      
      // Show toast for real-time updates
      if (isRealTimeUpdate && window.toast && window.toast.showToast) {
        const accuracy = employeeData.locationAccuracy ? `±${employeeData.locationAccuracy.toFixed(1)}m` : '';
        window.toast.showToast(
          `${employeeData.name} location updated ${accuracy}`.trim(),
          'success'
        );
      }
      
      setEmployeeLocationData(prev => {
        const newMap = new Map(prev);
        newMap.set(employeeData.id, employeeData);
        return newMap;
      });

      // Update employee markers if this employee is already on the map
      setEmployeeMarkers(prev => {
        const existingIndex = prev.findIndex(emp => emp.id === employeeData.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...employeeData,
            // Handle both real-time updates and historical data
            currentPosition: employeeData.currentPosition || 
              (hasRecentLocations
                ? {
                    lat: employeeData.recent_locations[0].latitude,
                    lng: employeeData.recent_locations[0].longitude
                  }
                : null),
            locationAccuracy: employeeData.locationAccuracy || 
              (hasRecentLocations ? employeeData.recent_locations[0].accuracy : null),
            lastSeen: employeeData.lastSeen || employeeData.last_seen
          };
          return updated;
        } else {
          // Add new employee to map if not already present
          return [...prev, {
            ...employeeData,
            currentPosition: employeeData.currentPosition || 
              (hasRecentLocations
                ? {
                    lat: employeeData.recent_locations[0].latitude,
                    lng: employeeData.recent_locations[0].longitude
                  }
                : null),
            locationAccuracy: employeeData.locationAccuracy || 
              (hasRecentLocations ? employeeData.recent_locations[0].accuracy : null),
            lastSeen: employeeData.lastSeen || employeeData.last_seen
          }];
        }
      });

      // Execute callback if we have one for this employee and now have location data
      // Check for both real-time updates and recent locations data
      if (isRealTimeUpdate || hasRecentLocations) {
        setLocationCallbacks(prev => {
          const callback = prev.get(employeeData.id);
          if (callback && typeof callback === 'function') {
            // Execute callback with the location data
            const position = employeeData.currentPosition || 
              (hasRecentLocations
                ? {
                    lat: employeeData.recent_locations[0].latitude,
                    lng: employeeData.recent_locations[0].longitude
                  }
                : null);
            callback(position);
            // Remove the callback after executing
            const newMap = new Map(prev);
            newMap.delete(employeeData.id);
            return newMap;
          }
          return prev;
        });
      }
    }
  }, []);

  // Handle employee status updates from WebSocket
  const handleEmployeeStatusUpdate = useCallback((employeesData) => {
    console.log('Employee status update received:', employeesData);
    
    if (Array.isArray(employeesData)) {
      // Update status for all employees
      setEmployeeMarkers(prev => {
        return prev.map(emp => {
          const updatedEmp = employeesData.find(newEmp => newEmp.id === emp.id);
          if (updatedEmp) {
            return {
              ...emp,
              is_online: updatedEmp.is_online,
              status: updatedEmp.status,
              last_seen: updatedEmp.last_seen
            };
          }
          return emp;
        });
      });
    }
  }, []);

  // Add employee to map
  const addEmployee = useCallback((employee) => {
    console.log('Adding employee to map:', employee);
    
    setEmployeeMarkers(prev => {
      // Check if employee already exists
      const existingIndex = prev.findIndex(emp => emp.id === employee.id);
      if (existingIndex >= 0) {
        // Update existing employee
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...employee };
        return updated;
      } else {
        // Add new employee
        return [...prev, employee];
      }
    });
  }, []);

  // Remove employee from map
  const removeEmployee = useCallback((employeeId) => {
    console.log('Removing employee from map:', employeeId);
    
    setEmployeeMarkers(prev => prev.filter(emp => emp.id !== employeeId));
    setEmployeeLocationData(prev => {
      const newMap = new Map(prev);
      newMap.delete(employeeId);
      return newMap;
    });
  }, []);

  // Request employee location data
  const requestEmployeeLocation = useCallback((employeeId) => {
    if (managerWebSocketService.getConnectionStatus()) {
      managerWebSocketService.requestEmployeeLocation(employeeId);
    }
  }, []);

  // Request all employees data
  const requestAllEmployees = useCallback(() => {
    if (managerWebSocketService.getConnectionStatus()) {
      managerWebSocketService.requestAllEmployees();
    }
  }, []);

  // Register a callback to be executed when location data becomes available for an employee
  const onEmployeeLocationAvailable = useCallback((employeeId, callback) => {
    setLocationCallbacks(prev => {
      const newMap = new Map(prev);
      newMap.set(employeeId, callback);
      return newMap;
    });
  }, []);

  // Set up WebSocket listeners
  useEffect(() => {
    managerWebSocketService.addEmployeeLocationListener(handleEmployeeLocationUpdate);
    managerWebSocketService.addEmployeeStatusListener(handleEmployeeStatusUpdate);

    // Add connection status listener
    const handleConnectionStatus = (isConnected) => {
      if (isConnected) {
        console.log('[useEmployeeLocation] WebSocket connected successfully');
      }
    };
    managerWebSocketService.addStatusListener(handleConnectionStatus);

    return () => {
      managerWebSocketService.removeEmployeeLocationListener(handleEmployeeLocationUpdate);
      managerWebSocketService.removeEmployeeStatusListener(handleEmployeeStatusUpdate);
      managerWebSocketService.removeStatusListener(handleConnectionStatus);
    };
  }, [handleEmployeeLocationUpdate, handleEmployeeStatusUpdate]);

  return {
    employeeMarkers,
    employeeLocationData,
    addEmployee,
    removeEmployee,
    requestEmployeeLocation,
    requestAllEmployees,
    onEmployeeLocationAvailable
  };
}; 