/**
 * Mobile Utility Functions
 * 
 * Provides utilities for mobile-specific logic and breakpoint management
 * for the Learning Platform mobile optimization.
 */

/**
 * Breakpoint constants for responsive design
 * These match Tailwind CSS breakpoints for consistency
 */
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

/**
 * Mobile breakpoint (matches useIsMobile hook)
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Check if current viewport is mobile
 * @param width - Optional viewport width (defaults to window.innerWidth)
 * @returns true if viewport is mobile (< 768px)
 */
export const isMobileViewport = (width?: number): boolean => {
  if (typeof window === 'undefined') return false;
  const viewportWidth = width ?? window.innerWidth;
  return viewportWidth < MOBILE_BREAKPOINT;
};

/**
 * Check if current viewport is tablet
 * @param width - Optional viewport width (defaults to window.innerWidth)
 * @returns true if viewport is tablet (768px - 1023px)
 */
export const isTabletViewport = (width?: number): boolean => {
  if (typeof window === 'undefined') return false;
  const viewportWidth = width ?? window.innerWidth;
  return viewportWidth >= BREAKPOINTS.tablet && viewportWidth < BREAKPOINTS.desktop;
};

/**
 * Check if current viewport is desktop
 * @param width - Optional viewport width (defaults to window.innerWidth)
 * @returns true if viewport is desktop (>= 1024px)
 */
export const isDesktopViewport = (width?: number): boolean => {
  if (typeof window === 'undefined') return false;
  const viewportWidth = width ?? window.innerWidth;
  return viewportWidth >= BREAKPOINTS.desktop;
};

/**
 * Get responsive class names based on breakpoint
 * @param mobileClass - Class to apply on mobile
 * @param desktopClass - Class to apply on desktop
 * @returns Combined class string with responsive utilities
 */
export const getResponsiveClasses = (
  mobileClass: string,
  desktopClass: string
): string => {
  return `${mobileClass} ${desktopClass}`;
};

/**
 * Get grid columns based on viewport
 * @param isMobile - Whether current viewport is mobile
 * @returns Number of grid columns
 */
export const getGridColumns = (isMobile: boolean): number => {
  return isMobile ? 1 : 3;
};

/**
 * Get card spacing based on viewport
 * @param isMobile - Whether current viewport is mobile
 * @returns Spacing value (Tailwind class or pixel value)
 */
export const getCardSpacing = (isMobile: boolean): string => {
  return isMobile ? 'gap-4' : 'gap-6';
};

/**
 * Get padding based on viewport
 * @param isMobile - Whether current viewport is mobile
 * @returns Padding value
 */
export const getViewportPadding = (isMobile: boolean): string => {
  return isMobile ? 'px-4 py-4' : 'px-6 py-8';
};

/**
 * Get header height based on viewport
 * @param isMobile - Whether current viewport is mobile
 * @returns Height value
 */
export const getHeaderHeight = (isMobile: boolean): string => {
  return isMobile ? 'h-14' : 'h-16';
};

/**
 * Check if element should be hidden on mobile
 * @param isMobile - Whether current viewport is mobile
 * @param hideOnMobile - Whether to hide on mobile
 * @returns true if element should be hidden
 */
export const shouldHideOnMobile = (
  isMobile: boolean,
  hideOnMobile: boolean
): boolean => {
  return isMobile && hideOnMobile;
};

/**
 * Check if element should be shown on mobile
 * @param isMobile - Whether current viewport is mobile
 * @param showOnMobile - Whether to show on mobile
 * @returns true if element should be shown
 */
export const shouldShowOnMobile = (
  isMobile: boolean,
  showOnMobile: boolean
): boolean => {
  return isMobile && showOnMobile;
};

/**
 * Get touch target size (minimum 44x44px for accessibility)
 * @returns Minimum touch target size in pixels
 */
export const TOUCH_TARGET_SIZE = 44;

/**
 * Check if touch target meets accessibility requirements
 * @param width - Element width
 * @param height - Element height
 * @returns true if touch target is accessible
 */
export const isAccessibleTouchTarget = (
  width: number,
  height: number
): boolean => {
  return width >= TOUCH_TARGET_SIZE && height >= TOUCH_TARGET_SIZE;
};

/**
 * Debounce function for resize events
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for scroll/resize events
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

