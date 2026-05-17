"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  hasPrevious: boolean;
  hasNext: boolean;
  isCompleted: boolean;
  onPrevious: () => void;
  onComplete: () => void;
  onNext: () => void;
  lessonProgress?: string; // e.g., "2/4"
  /**
   * Whether this is a quiz lesson (quiz has its own completion logic)
   */
  isQuiz?: boolean;
  /**
   * Whether quiz is submitted (for quiz lessons)
   */
  quizSubmitted?: boolean;
}

/**
 * MobileBottomNav Component
 * 
 * Sticky bottom navigation bar for mobile lesson navigation.
 * Provides Previous, Complete, and Next buttons with progress indicator.
 * 
 * Features:
 * - Sticky positioning at bottom of viewport
 * - Touch-friendly button sizes (minimum 44x44px)
 * - Progress indicator
 * - Disabled states for unavailable actions
 * - Smooth transitions
 */
const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  hasPrevious,
  hasNext,
  isCompleted,
  onPrevious,
  onComplete,
  onNext,
  lessonProgress,
  isQuiz = false,
  quizSubmitted = false,
}) => {
  // Don't show complete button for quiz lessons (quiz handles its own completion)
  const showCompleteButton = !isQuiz && !isCompleted;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Progress Indicator */}
      {lessonProgress && (
        <div className="px-4 pt-2 pb-1">
          <div className="text-xs text-center text-gray-500">
            Leksjon {lessonProgress}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Previous Button */}
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className={cn(
            "flex-1 h-12 min-h-[44px]",
            !hasPrevious && "opacity-50 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span className="hidden xs:inline">Forrige</span>
        </Button>

        {/* Complete Button (only show if not completed and not a quiz) */}
        {showCompleteButton && (
          <Button
            onClick={onComplete}
            className="flex-1 h-12 min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-4 w-4 mr-1" />
            <span className="hidden xs:inline">Fullfør</span>
            <span className="xs:hidden">✓</span>
          </Button>
        )}

        {/* Next Button */}
        {hasNext && (
          <Button
            onClick={onNext}
            disabled={!isCompleted && isQuiz && !quizSubmitted}
            className={cn(
              "flex-1 h-12 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white",
              !isCompleted && isQuiz && !quizSubmitted && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="hidden xs:inline">Neste</span>
            <span className="xs:hidden">→</span>
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}

        {/* Show message if no next lesson */}
        {!hasNext && isCompleted && (
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500">
              Alle leksjoner fullført
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileBottomNav;

