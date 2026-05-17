import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user is on a mobile device
 */
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      
      // Primary check: User agent detection
      const isMobileByUserAgent = mobileRegex.test(userAgent);
      
      // Secondary check: Only consider touch if it's a mobile user agent
      const hasTouchSupport = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isMobileByTouch = isMobileByUserAgent && hasTouchSupport;
      
      // Screen size check for additional mobile detection
      const isSmallScreen = window.innerWidth <= 768;
      const isMobileByScreen = isMobileByUserAgent && isSmallScreen;
      
      // Final determination: Mobile if user agent is mobile OR if it's a small screen with touch
      const isMobileDevice = isMobileByUserAgent || isMobileByTouch || isMobileByScreen;
      
      console.log('Mobile Detection:', {
        userAgent,
        isMobileByUserAgent,
        hasTouchSupport,
        isMobileByTouch,
        isSmallScreen,
        isMobileByScreen,
        finalResult: isMobileDevice
      });
      
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return isMobile;
};

export default useMobileDetection; 