"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Copy, Eye } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /**
   * Whether this action is destructive (e.g., delete)
   */
  destructive?: boolean;
  /**
   * Whether this action is disabled
   */
  disabled?: boolean;
}

interface MobileActionMenuProps {
  /**
   * Action items to display
   */
  actions: ActionItem[];
  /**
   * Whether to show as inline buttons on mobile (default: false, uses dropdown)
   */
  inlineOnMobile?: boolean;
  /**
   * Custom className
   */
  className?: string;
}

/**
 * MobileActionMenu Component
 * 
 * A mobile-optimized action menu component that:
 * - Shows as a dropdown menu on desktop
 * - Shows as inline buttons or dropdown on mobile (configurable)
 * - Provides touch-friendly action buttons
 * - Handles destructive actions with proper styling
 */
const MobileActionMenu: React.FC<MobileActionMenuProps> = ({
  actions,
  inlineOnMobile = false,
  className,
}) => {
  const isMobile = useIsMobile();

  // Mobile: Show inline buttons if requested
  if (isMobile && inlineOnMobile) {
    return (
      <div className={cn("flex flex-col gap-2", className)} role="menu" aria-label="Actions">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.destructive ? "destructive" : "outline"}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              "w-full justify-start min-h-[44px] transition-all hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              action.destructive && "text-red-600 hover:text-red-700"
            )}
            role="menuitem"
            aria-label={action.label}
          >
            {action.icon && <span className="mr-2" aria-hidden="true">{action.icon}</span>}
            {action.label}
          </Button>
        ))}
      </div>
    );
  }

  // Desktop or Mobile Dropdown: Show dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 transition-all hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            isMobile && "h-10 w-10 min-h-[44px] min-w-[44px]"
          )}
          aria-label="Handlingsmeny"
          aria-haspopup="true"
          aria-expanded="false"
        >
          <MoreHorizontal className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          isMobile && "min-w-[200px]",
          "transition-all animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        {actions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              isMobile && "min-h-[44px]",
              action.destructive && "text-red-600 focus:text-red-600",
              "transition-colors"
            )}
            aria-label={action.label}
          >
            {action.icon && <span className="mr-2" aria-hidden="true">{action.icon}</span>}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Common action presets for convenience
 */
export const CommonActions = {
  edit: (onClick: () => void): ActionItem => ({
    label: "Rediger",
    icon: <Edit className="h-4 w-4" />,
    onClick,
  }),
  delete: (onClick: () => void): ActionItem => ({
    label: "Slett",
    icon: <Trash2 className="h-4 w-4" />,
    onClick,
    destructive: true,
  }),
  duplicate: (onClick: () => void): ActionItem => ({
    label: "Dupliser",
    icon: <Copy className="h-4 w-4" />,
    onClick,
  }),
  view: (onClick: () => void): ActionItem => ({
    label: "Vis",
    icon: <Eye className="h-4 w-4" />,
    onClick,
  }),
};

export default MobileActionMenu;

