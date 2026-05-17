import { useState, useEffect, useCallback } from 'react';

/**
 * Mobile optimization hook for better performance on Vercel deployment
 * Handles device detection, performance settings, and mobile-specific behaviors
 */
export const useMobileOptimization = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLowPerformance, setIsLowPerformance] = useState(false);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);

  // Device detection and performance assessment
  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth <= 768;
      const pixelRatio = window.devicePixelRatio || 1;
      
      // Low performance indicators
      const lowPerf = mobile && (
        // High pixel density mobile devices
        pixelRatio > 2 ||
        // Connection quality indicators
        navigator.connection?.effectiveType === 'slow-2g' ||
        navigator.connection?.effectiveType === '2g' ||
        navigator.connection?.effectiveType === '3g' ||
        // Memory constraints
        navigator.deviceMemory && navigator.deviceMemory < 4
      );

      setIsMobile(mobile);
      setIsLowPerformance(lowPerf);
      setDevicePixelRatio(pixelRatio);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Mobile-optimized timing values
  const getOptimizedTiming = useCallback((baseDesktop, baseMobile) => {
    if (isLowPerformance) {
      return baseMobile * 0.7; // Even faster for low-performance devices
    }
    return isMobile ? baseMobile : baseDesktop;
  }, [isMobile, isLowPerformance]);

  // Performance-aware popup delays
  const getPopupDelay = useCallback(() => {
    if (isLowPerformance) return 100; // Very fast for low-performance
    return isMobile ? 200 : 800;
  }, [isMobile, isLowPerformance]);

  // Map interaction delays
  const getMapClickDelay = useCallback(() => {
    return getOptimizedTiming(800, 400);
  }, [getOptimizedTiming]);

  // Removed: getClusterDelay - no longer needed with vector tiles

  // Animation preferences
  const shouldReduceAnimations = useCallback(() => {
    return isLowPerformance || 
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, [isLowPerformance]);

  // Portal optimization
  const getPortalStrategy = useCallback(() => {
    return {
      useBodyFallback: isMobile, // Use body on mobile for better performance
      preloadPortal: !isLowPerformance, // Preload portal target if performance allows
      useAnimation: !shouldReduceAnimations()
    };
  }, [isMobile, isLowPerformance, shouldReduceAnimations]);

  return {
    isMobile,
    isLowPerformance,
    devicePixelRatio,
    getOptimizedTiming,
    getPopupDelay,
    getMapClickDelay,
    // Removed: getClusterDelay - no longer needed with vector tiles
    shouldReduceAnimations,
    getPortalStrategy
  };
};

export default useMobileOptimization;
