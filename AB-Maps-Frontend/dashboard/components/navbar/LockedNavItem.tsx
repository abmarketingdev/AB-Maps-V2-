"use client"

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CampaignCompletionResponse } from '@/services/learningCompletionService';
import { Lock } from 'lucide-react';

interface LockedNavItemProps {
  href: string;
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  isLocked: boolean;
  completionStatus: CampaignCompletionResponse | null;
  isExternal?: boolean;
  onClick?: () => void;
  className?: string;
  /** When true, hide the title text so only the icon shows (used by the
   *  collapsed sidebar rail). The active glow / lock indicator are also
   *  centered around the icon instead of spanning the row. */
  collapsed?: boolean;
}

/**
 * Navbar item component with locking mechanism
 * Locks items when course completion is incomplete (except "AB Academy")
 */
export function LockedNavItem({
  href,
  title,
  icon,
  isActive,
  isLocked,
  completionStatus,
  isExternal = false,
  onClick,
  className,
  collapsed = false,
}: LockedNavItemProps) {
  // "AB Academy" or "Læringsadminpanel" should always be accessible
  const isLearningPlatform = href === '/learning-platform';
  const shouldBeLocked = isLocked && !isLearningPlatform;

  // Generate tooltip message for incomplete sections
  const getTooltipMessage = (): string => {
    if (!completionStatus || completionStatus.all_completed) {
      return '';
    }

    const incompleteCount = completionStatus.incomplete_sections.length;
    if (incompleteCount === 0) {
      return 'Du må fullføre kurset først';
    }

    const sectionNames = completionStatus.incomplete_sections
      .slice(0, 3) // Show max 3 sections
      .map(section => section.section_title)
      .join(', ');
    
    const moreText = incompleteCount > 3 ? ` og ${incompleteCount - 3} flere` : '';
    return `Du må fullføre følgende seksjoner først: ${sectionNames}${moreText}. Gå til AB Academy for å fullføre kurset.`;
  };

  const tooltipMessage = getTooltipMessage();

  // Minimal base — the consuming component (ClientLayout) owns the visual
  // language via the className prop.
  const baseClasses = "relative overflow-hidden flex items-center w-full text-left";

  const lockedClasses = shouldBeLocked
    ? "opacity-50 cursor-not-allowed"
    : "";

  const merged = cn(baseClasses, lockedClasses, className);

  const itemContent = (
    <>
      {/* Active glow halo — soft luminous pool behind the label */}
      {isActive && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-28 rounded-full bg-ab-accent/30 blur-2xl"
        />
      )}
      {/* Active left edge accent bar — slides between items */}
      {isActive && (
        <motion.span
          layoutId="nav-active-bar"
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-ab-accent"
          style={{ boxShadow: "0 0 8px hsl(var(--accent) / 0.6)" }}
        />
      )}
      {shouldBeLocked && (
        <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 relative z-10" />
      )}
      <span
        className={cn(
          "flex-shrink-0 relative z-10 transition-all duration-150 ease-out",
          isActive ? "text-ab-accent" : "text-ab-fg-3 group-hover/nav:text-ab-fg group-hover/nav:scale-[1.05]",
        )}
      >
        {icon}
      </span>
      {!collapsed && (
        <span
          className={cn(
            "truncate relative z-10 transition-colors duration-150",
            isActive ? "text-ab-fg font-semibold" : "text-ab-fg-2 group-hover/nav:text-ab-fg",
          )}
        >
          {title}
        </span>
      )}
    </>
  );

  // If locked, wrap in tooltip
  if (shouldBeLocked && tooltipMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={merged}>
              {itemContent}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-sm">{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Build the interactive element
  let inner: React.ReactNode;
  if (isExternal && onClick) {
    inner = (
      <button onClick={shouldBeLocked ? undefined : onClick} className={merged} disabled={shouldBeLocked}>
        {itemContent}
      </button>
    );
  } else if (isExternal) {
    inner = (
      <a href={shouldBeLocked ? '#' : href} target="_blank" rel="noopener noreferrer" className={merged}
        onClick={shouldBeLocked ? (e) => e.preventDefault() : undefined}>
        {itemContent}
      </a>
    );
  } else {
    inner = (
      <Link href={shouldBeLocked ? '#' : href} className={merged}
        onClick={shouldBeLocked ? (e) => e.preventDefault() : undefined}>
        {itemContent}
      </Link>
    );
  }

  // Collapsed rail → reveal the label as a tooltip on hover.
  if (collapsed && !shouldBeLocked) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{inner}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="font-medium">{title}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return inner;
}

