"use client";

import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * MobileLayout Component
 * 
 * Wrapper component that provides mobile-specific layout utilities
 * and conditional rendering based on viewport size.
 * 
 * Usage:
 * ```tsx
 * <MobileLayout
 *   mobileClassName="flex-col"
 *   desktopClassName="flex-row"
 * >
 *   {children}
 * </MobileLayout>
 * ```
 */

interface MobileLayoutProps {
  children: React.ReactNode;
  /**
   * Additional className for mobile viewport
   */
  mobileClassName?: string;
  /**
   * Additional className for desktop viewport
   */
  desktopClassName?: string;
  /**
   * Base className applied to all viewports
   */
  className?: string;
  /**
   * Whether to hide content on mobile
   */
  hideOnMobile?: boolean;
  /**
   * Whether to hide content on desktop
   */
  hideOnDesktop?: boolean;
  /**
   * Whether to show content only on mobile
   */
  showOnlyOnMobile?: boolean;
  /**
   * Whether to show content only on desktop
   */
  showOnlyOnDesktop?: boolean;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  mobileClassName = "",
  desktopClassName = "",
  className = "",
  hideOnMobile = false,
  hideOnDesktop = false,
  showOnlyOnMobile = false,
  showOnlyOnDesktop = false,
}) => {
  const isMobile = useIsMobile();

  // Handle visibility logic
  if (hideOnMobile && isMobile) {
    return null;
  }

  if (hideOnDesktop && !isMobile) {
    return null;
  }

  if (showOnlyOnMobile && !isMobile) {
    return null;
  }

  if (showOnlyOnDesktop && isMobile) {
    return null;
  }

  // Combine class names based on viewport
  const combinedClassName = cn(
    className,
    isMobile ? mobileClassName : desktopClassName
  );

  return <div className={combinedClassName}>{children}</div>;
};

/**
 * MobileOnly Component
 * 
 * Renders children only on mobile viewport
 */
export const MobileOnly: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <MobileLayout showOnlyOnMobile>{children}</MobileLayout>;
};

/**
 * DesktopOnly Component
 * 
 * Renders children only on desktop viewport
 */
export const DesktopOnly: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <MobileLayout showOnlyOnDesktop>{children}</MobileLayout>;
};

/**
 * ResponsiveContainer Component
 * 
 * Provides responsive padding and max-width constraints
 */
interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Maximum width container (default: max-w-7xl)
   */
  maxWidth?: string;
  /**
   * Padding on mobile (default: px-4)
   */
  mobilePadding?: string;
  /**
   * Padding on desktop (default: px-6)
   */
  desktopPadding?: string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = "",
  maxWidth = "max-w-7xl",
  mobilePadding = "px-4",
  desktopPadding = "px-6",
}) => {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "mx-auto",
        maxWidth,
        isMobile ? mobilePadding : desktopPadding,
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveGrid Component
 * 
 * Provides responsive grid layout
 */
interface ResponsiveGridProps {
  children: React.ReactNode;
  /**
   * Number of columns on mobile (default: 1)
   */
  mobileCols?: number;
  /**
   * Number of columns on tablet (default: 2)
   */
  tabletCols?: number;
  /**
   * Number of columns on desktop (default: 3)
   */
  desktopCols?: number;
  /**
   * Gap between grid items on mobile (default: gap-4)
   */
  mobileGap?: string;
  /**
   * Gap between grid items on desktop (default: gap-6)
   */
  desktopGap?: string;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  mobileCols = 1,
  tabletCols = 2,
  desktopCols = 3,
  mobileGap = "gap-4",
  desktopGap = "gap-6",
  className = "",
}) => {
  const isMobile = useIsMobile();

  // Map column numbers to Tailwind classes
  const gridColsMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  const tabletColsMap: Record<number, string> = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  };

  const desktopColsMap: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  };

  // Generate grid columns class
  const gridColsClass = isMobile
    ? gridColsMap[mobileCols] || "grid-cols-1"
    : `${tabletColsMap[tabletCols] || "md:grid-cols-2"} ${desktopColsMap[desktopCols] || "lg:grid-cols-3"}`;

  return (
    <div
      className={cn(
        "grid",
        gridColsClass,
        isMobile ? mobileGap : desktopGap,
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveStack Component
 * 
 * Provides responsive flex layout (column on mobile, row on desktop)
 */
interface ResponsiveStackProps {
  children: React.ReactNode;
  /**
   * Direction on mobile (default: flex-col)
   */
  mobileDirection?: string;
  /**
   * Direction on desktop (default: flex-row)
   */
  desktopDirection?: string;
  /**
   * Gap between items on mobile (default: gap-4)
   */
  mobileGap?: string;
  /**
   * Gap between items on desktop (default: gap-6)
   */
  desktopGap?: string;
  className?: string;
}

export const ResponsiveStack: React.FC<ResponsiveStackProps> = ({
  children,
  mobileDirection = "flex-col",
  desktopDirection = "flex-row",
  mobileGap = "gap-4",
  desktopGap = "gap-6",
  className = "",
}) => {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "flex",
        isMobile ? mobileDirection : desktopDirection,
        isMobile ? mobileGap : desktopGap,
        className
      )}
    >
      {children}
    </div>
  );
};

export default MobileLayout;

