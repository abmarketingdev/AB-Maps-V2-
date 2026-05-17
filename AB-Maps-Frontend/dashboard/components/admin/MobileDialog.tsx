"use client";

import React, { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Maximum width on desktop (default: "max-w-[600px]")
   */
  maxWidth?: string;
  /**
   * Whether to show close button in header (default: true)
   */
  showCloseButton?: boolean;
  /**
   * Custom className for dialog content
   */
  className?: string;
}

/**
 * MobileDialog Component
 * 
 * A mobile-optimized dialog wrapper that:
 * - Renders full-screen or near full-screen on mobile
 * - Renders centered modal on desktop
 * - Handles safe areas for iOS devices
 * - Provides touch-friendly close buttons
 * - Ensures proper scrolling for long content
 */
const MobileDialog: React.FC<MobileDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-[600px]",
  showCloseButton = true,
  className,
}) => {
  const isMobile = useIsMobile();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLElement>(null);

  // Focus management: Focus close button when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is rendered
      setTimeout(() => {
        if (showCloseButton && closeButtonRef.current) {
          closeButtonRef.current.focus();
        } else if (firstFocusableRef.current) {
          firstFocusableRef.current.focus();
        }
      }, 100);
    }
  }, [open, showCloseButton]);

  // Keyboard navigation: Close on Escape (handled by Dialog component)
  // Trap focus within dialog (handled by Dialog component)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Mobile: Full-screen or near full-screen
          isMobile
            ? "w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] m-4 p-0 flex flex-col transition-all duration-200 ease-in-out"
            : // Desktop: Centered modal
              `${maxWidth} max-h-[90vh] m-4 transition-all duration-200 ease-in-out`,
          className
        )}
        style={
          isMobile
            ? {
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }
            : undefined
        }
        aria-labelledby="mobile-dialog-title"
        aria-describedby={description ? "mobile-dialog-description" : undefined}
      >
        {/* Header */}
        <DialogHeader
          className={cn(
            "relative flex-shrink-0 border-b",
            isMobile ? "px-4 py-3 pr-14" : "px-6 py-4 pr-14"
          )}
        >
          <DialogTitle
            id="mobile-dialog-title"
            className={cn(
              "font-semibold",
              isMobile ? "text-lg" : "text-xl"
            )}
          >
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription
              id="mobile-dialog-description"
              className={cn("mt-1", isMobile ? "text-sm" : "")}
            >
              {description}
            </DialogDescription>
          )}
          {showCloseButton && (
            <div className="absolute right-4 top-4">
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex-shrink-0 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isMobile ? "h-10 w-10" : "h-8 w-8"
                )}
                aria-label="Lukk dialog"
                aria-describedby="mobile-dialog-title"
              >
                <X className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Scrollable Content */}
        <div
          className={cn(
            "flex-1 overflow-y-auto",
            isMobile ? "px-4 py-4" : "px-6 py-4"
          )}
          role="region"
          aria-label="Dialog content"
          tabIndex={-1}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <DialogFooter
            className={cn(
              "flex-shrink-0 border-t",
              isMobile
                ? "px-4 py-3 flex-col gap-2"
                : "px-6 py-4 flex-row gap-2"
            )}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MobileDialog;

