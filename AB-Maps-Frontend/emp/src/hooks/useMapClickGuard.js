import { useRef, useCallback } from 'react';

/**
 * Hook to manage map click suppression for stable popup behavior
 * ENHANCED: Stronger protection and better isolation for uploaded address popups
 */
export default function useMapClickGuard() {
  const suppressClickUntilRef = useRef(0);
  // Removed: pauseClusterUntilRef - no longer needed with vector tiles
  // ENHANCED: Additional protection for uploaded address popups
  const suppressUploadedPopupUntilRef = useRef(0);
  // ENHANCED: Track if we have an uploaded address popup open
  const hasUploadedPopupOpenRef = useRef(false);

  const suppressNextMapClick = useCallback((duration = 500) => {
    suppressClickUntilRef.current = Date.now() + duration;
  }, []);

  const shouldSuppressMapClick = useCallback(() => {
    return Date.now() < suppressClickUntilRef.current;
  }, []);

  // Removed: pauseClusterRefresh and isClusterRefreshPaused - no longer needed with vector tiles

  // ENHANCED: Additional protection specifically for uploaded address popups
  const suppressUploadedPopupInterference = useCallback((duration = 1500) => {
    suppressUploadedPopupUntilRef.current = Date.now() + duration;
  }, []);

  const shouldSuppressUploadedPopupInterference = useCallback(() => {
    return Date.now() < suppressUploadedPopupUntilRef.current;
  }, []);

  // ENHANCED: Track uploaded popup state
  const setUploadedPopupOpen = useCallback((isOpen) => {
    hasUploadedPopupOpenRef.current = isOpen;
  }, []);

  const hasUploadedPopupOpen = useCallback(() => {
    return hasUploadedPopupOpenRef.current;
  }, []);

  // ENHANCED: Track regular address marker popup state
  const hasAddressMarkerPopupOpenRef = useRef(false);

  const setAddressMarkerPopupOpen = useCallback((isOpen) => {
    hasAddressMarkerPopupOpenRef.current = isOpen;
  }, []);

  const hasAddressMarkerPopupOpen = useCallback(() => {
    return hasAddressMarkerPopupOpenRef.current;
  }, []);

  // MOBILE OPTIMIZED: Shorter durations for mobile, longer for desktop
  const protectUploadedAddressClick = useCallback((mapClickDuration, popupDuration) => {
    const isMobile = window.innerWidth <= 768;
    
    // Use passed durations or fallback to mobile/desktop defaults
    const mapDuration = mapClickDuration || (isMobile ? 800 : 1500);
    const popupDur = popupDuration || (isMobile ? 1200 : 2000);
    
    suppressNextMapClick(mapDuration);
    suppressUploadedPopupInterference(popupDur);
    
    // ENHANCED: Mark that we have an uploaded popup open
    setUploadedPopupOpen(true);
  }, [suppressNextMapClick, suppressUploadedPopupInterference, setUploadedPopupOpen]);

  // ENHANCED: Function to clear uploaded popup state
  const clearUploadedPopupState = useCallback(() => {
    setUploadedPopupOpen(false);
    // ENHANCED: Clear any suppression timers to allow immediate map clicks
    suppressClickUntilRef.current = 0;
    suppressUploadedPopupUntilRef.current = 0;
  }, [setUploadedPopupOpen]);

  // ENHANCED: Function to clear address marker popup state
  const clearAddressMarkerPopupState = useCallback(() => {
    hasAddressMarkerPopupOpenRef.current = false;
    // ENHANCED: Clear any suppression timers to allow immediate map clicks
    suppressClickUntilRef.current = 0;
  }, []);

  return {
    suppressNextMapClick,
    shouldSuppressMapClick,
    // Removed: pauseClusterRefresh and isClusterRefreshPaused - no longer needed with vector tiles
    // ENHANCED: New protection methods
    suppressUploadedPopupInterference,
    shouldSuppressUploadedPopupInterference,
    protectUploadedAddressClick,
    // ENHANCED: State tracking methods
    setUploadedPopupOpen,
    hasUploadedPopupOpen,
    clearUploadedPopupState,
    // ENHANCED: Regular address marker popup state tracking
    setAddressMarkerPopupOpen,
    hasAddressMarkerPopupOpen,
    clearAddressMarkerPopupState,
  };
}

