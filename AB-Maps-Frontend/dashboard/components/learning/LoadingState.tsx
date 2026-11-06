"use client";

import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AcademyBrand } from "@/components/learning/AcademyHeader";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * LoadingState Component
 * 
 * Mobile-optimized loading indicator with skeleton screens support.
 * Provides consistent loading experience across the learning platform.
 */
const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Laster...",
  fullScreen = true,
  size = "md",
}) => {
  const isMobile = useIsMobile();

  const sizeClasses = {
    sm: isMobile ? "h-6 w-6" : "h-8 w-8",
    md: isMobile ? "h-10 w-10" : "h-12 w-12",
    lg: isMobile ? "h-16 w-16" : "h-20 w-20",
  };

  const containerClasses = fullScreen
    ? "min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4"
    : "flex items-center justify-center py-8";

  return (
    <div className={containerClasses} role="status" aria-live="polite" aria-label="Laster">
      <div className="flex flex-col items-center text-center">
        {fullScreen && <AcademyBrand size="md" className="mb-8" />}
        <div
          className={cn(
            "animate-spin rounded-full border-[3px] border-emerald-600/15 border-t-emerald-600 mx-auto mb-3 transition-opacity",
            sizeClasses[size]
          )}
          aria-hidden="true"
        />
        <p
          className={cn(
            "text-neutral-500 transition-opacity animate-in fade-in duration-300",
            isMobile ? "text-sm" : "text-base"
          )}
        >
          {message}
        </p>
        <span className="sr-only">{message}</span>
      </div>
    </div>
  );
};

/**
 * SkeletonLoader Component
 * 
 * Skeleton screen for mobile-optimized loading states.
 * Provides visual feedback while content is loading.
 */
export const SkeletonLoader: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className }) => {
  const isMobile = useIsMobile();

  return (
    <div className={cn("space-y-3 animate-pulse", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "bg-black/[0.06] rounded",
            isMobile ? "h-4" : "h-5",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
};

export default LoadingState;

