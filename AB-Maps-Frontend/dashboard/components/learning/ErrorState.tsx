"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
    ? "min-h-screen bg-gray-50 flex items-center justify-center px-4"
    : "flex items-center justify-center py-8 px-4";

  return (
    <div className={containerClasses} role="alert" aria-live="assertive">
      <div className={cn("text-center max-w-md w-full", isMobile && "max-w-sm")}>
        <Alert
          variant={variant}
          className={cn(
            "mb-4 transition-all animate-in fade-in slide-in-from-top-4 duration-300",
            isMobile ? "p-3" : "p-4"
          )}
        >
          <AlertCircle
            className={cn(
              "h-4 w-4",
              isMobile ? "h-4 w-4" : "h-5 w-5"
            )}
            aria-hidden="true"
          />
          <AlertTitle className={cn(
            "font-semibold",
            isMobile ? "text-base mb-2" : "text-lg mb-2"
          )}>
            {title}
          </AlertTitle>
          <AlertDescription>
            <p className={cn(
              "text-gray-700",
              isMobile ? "text-sm" : "text-base"
            )}>
              {message}
            </p>
          </AlertDescription>
        </Alert>

        <div className={cn(
          "flex gap-3 transition-all animate-in fade-in duration-300 delay-100",
          isMobile ? "flex-col" : "flex-row justify-center"
        )}>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className={cn(
                "w-full transition-all hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isMobile && "h-12 min-h-[44px]"
              )}
              aria-label="Prøv igjen"
            >
              <RefreshCw className={cn("mr-2", isMobile ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
              Prøv igjen
            </Button>
          )}
          {(onGoHome || homeUrl) && (
            <Button
              onClick={onGoHome}
              variant={onRetry ? "default" : "outline"}
              className={cn(
                "w-full transition-all hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isMobile && "h-12 min-h-[44px]"
              )}
              asChild={!!homeUrl}
              aria-label="Gå til hjem"
            >
              {homeUrl ? (
                <a href={homeUrl}>
                  <Home className={cn("mr-2", isMobile ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
                  Gå til hjem
                </a>
              ) : (
                <>
                  <Home className={cn("mr-2", isMobile ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
                  Gå til hjem
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorState;

