export const SAFE_RENDER_MODE =
  (process.env.NEXT_PUBLIC_SAFE_RENDER_MODE ?? 'true') === 'true';

export const DISABLE_ROTATION_ON_MOBILE =
  (process.env.NEXT_PUBLIC_DISABLE_ROTATION_ON_MOBILE ?? 'true') === 'true';

// Enhanced mobile detection that matches the existing useMobileDetection hook
export const isMobile = () => {
  if (typeof navigator === 'undefined') return false;
  
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
  return isMobileByUserAgent || isMobileByTouch || isMobileByScreen;
};
