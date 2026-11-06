"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AcademyBrand } from "@/components/learning/AcademyHeader";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  homeUrl?: string;
  fullScreen?: boolean;
  variant?: "default" | "destructive" | "warning";
}

/**
 * ErrorState Component
 * 
 * Mobile-optimized error display with actionable buttons.
 * Provides consistent error handling across the learning platform.
 */
const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Noe gikk galt",
  message,
  onRetry,
  onGoHome,
  homeUrl,
  fullScreen = true,
  variant = "destructive",
}) => {
  const isMobile = useIsMobile();

  const containerClasses = fullScreen
    ? "min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4"
    : "flex items-center justify-center py-8 px-4";

  const tone =
    variant === "warning"
      ? "bg-amber-50 text-amber-600"
      : variant === "default"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-red-50 text-red-600";

  return (
    <div className={containerClasses} role="alert" aria-live="assertive">
      <div className={cn("flex w-full max-w-md flex-col items-center text-center", isMobile && "max-w-sm")}>
        {fullScreen && <AcademyBrand size="md" className="mb-8" />}
        <div className="w-full rounded-xl border border-black/[0.08] bg-white p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={cn("mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full", tone)}>
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className={cn("font-semibold text-[#0A0A0A]", isMobile ? "text-base" : "text-lg")}>{title}</h2>
          <p className={cn("mt-1.5 text-neutral-500", isMobile ? "text-sm" : "text-[15px]")}>{message}</p>

          {(onRetry || onGoHome || homeUrl) && (
            <div className={cn("mt-6 flex gap-3", isMobile ? "flex-col" : "flex-row justify-center")}>
              {onRetry && (
                <Button
                  onClick={onRetry}
                  variant="outline"
                  className={cn("w-full border-black/[0.12] bg-white text-[#0A0A0A] hover:bg-black/[0.04]", isMobile ? "h-11" : "h-10")}
                  aria-label="Prøv igjen"
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Prøv igjen
                </Button>
              )}
              {(onGoHome || homeUrl) && (
                <Button
                  onClick={onGoHome}
                  className={cn("w-full bg-emerald-600 text-white hover:bg-emerald-700", isMobile ? "h-11" : "h-10")}
                  asChild={!!homeUrl}
                  aria-label="Gå til hjem"
                >
                  {homeUrl ? (
                    <a href={homeUrl}>
                      <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                      Gå til hjem
                    </a>
                  ) : (
                    <>
                      <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                      Gå til hjem
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorState;

