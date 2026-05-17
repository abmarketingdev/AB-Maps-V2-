/**
 * Mobile Typography Utilities
 * 
 * Provides consistent typography classes for mobile and desktop.
 * Ensures optimal readability and visual hierarchy across devices.
 */

import { cn } from "@/lib/utils";

/**
 * Typography size utilities for mobile optimization
 */
export const mobileTypography = {
  // Headings
  h1: (isMobile: boolean) => cn(
    isMobile ? "text-2xl" : "text-3xl",
    "font-bold leading-tight"
  ),
  h2: (isMobile: boolean) => cn(
    isMobile ? "text-xl" : "text-2xl",
    "font-bold leading-tight"
  ),
  h3: (isMobile: boolean) => cn(
    isMobile ? "text-lg" : "text-xl",
    "font-semibold leading-snug"
  ),
  h4: (isMobile: boolean) => cn(
    isMobile ? "text-base" : "text-lg",
    "font-semibold leading-snug"
  ),
  
  // Body text
  body: (isMobile: boolean) => cn(
    isMobile ? "text-sm leading-[1.6]" : "text-base leading-[1.7]"
  ),
  bodyLarge: (isMobile: boolean) => cn(
    isMobile ? "text-base leading-[1.6]" : "text-lg leading-[1.7]"
  ),
  bodySmall: (isMobile: boolean) => cn(
    isMobile ? "text-xs leading-[1.5]" : "text-sm leading-[1.6]"
  ),
  
  // Labels and captions
  label: (isMobile: boolean) => cn(
    isMobile ? "text-xs" : "text-sm",
    "font-medium"
  ),
  caption: (isMobile: boolean) => cn(
    isMobile ? "text-[10px]" : "text-xs",
    "text-gray-600"
  ),
};

/**
 * Spacing utilities for mobile optimization
 * Ensures adequate padding for touch targets (minimum 44x44px)
 */
export const mobileSpacing = {
  // Container padding
  container: (isMobile: boolean) => cn(
    isMobile ? "px-4 py-4" : "px-6 py-6"
  ),
  containerHorizontal: (isMobile: boolean) => cn(
    isMobile ? "px-4" : "px-6"
  ),
  containerVertical: (isMobile: boolean) => cn(
    isMobile ? "py-4" : "py-6"
  ),
  
  // Card padding
  card: (isMobile: boolean) => cn(
    isMobile ? "p-4" : "p-6"
  ),
  cardHorizontal: (isMobile: boolean) => cn(
    isMobile ? "px-4" : "px-6"
  ),
  cardVertical: (isMobile: boolean) => cn(
    isMobile ? "py-4" : "py-6"
  ),
  
  // Button padding (ensures minimum 44px touch target)
  button: (isMobile: boolean) => cn(
    isMobile ? "px-4 py-3 min-h-[44px]" : "px-4 py-2"
  ),
  
  // Gap spacing
  gap: (isMobile: boolean, size: "sm" | "md" | "lg" = "md") => {
    const sizes = {
      sm: isMobile ? "gap-2" : "gap-3",
      md: isMobile ? "gap-3" : "gap-4",
      lg: isMobile ? "gap-4" : "gap-6",
    };
    return sizes[size];
  },
  
  // Section spacing
  section: (isMobile: boolean) => cn(
    isMobile ? "space-y-4" : "space-y-6"
  ),
};

/**
 * Touch target utilities
 * Ensures all interactive elements meet minimum touch target size (44x44px)
 */
export const touchTargets = {
  minimum: "min-h-[44px] min-w-[44px]",
  button: "min-h-[44px]",
  icon: "min-h-[44px] min-w-[44px] flex items-center justify-center",
};

