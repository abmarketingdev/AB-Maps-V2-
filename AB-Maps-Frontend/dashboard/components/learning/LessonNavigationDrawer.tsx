"use client";

import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Clock, Video, FileText, HelpCircle, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningLesson } from "@/services/learningTypes";

interface LessonNavigationDrawerProps {
  lessons: LearningLesson[];
  currentLessonIndex: number;
  completedLessons: Set<number>;
  onLessonSelect: (index: number) => void;
  sectionTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * LessonNavigationDrawer Component
 * 
 * Mobile-friendly drawer that shows all lessons in a section.
 * Replaces the desktop sidebar on mobile devices.
 * 
 * Features:
 * - Shows all lessons with completion status
 * - Current lesson indicator
 * - Lock status for locked lessons
 * - Progress indicator
 * - Touch-friendly navigation
 */
const LessonNavigationDrawer: React.FC<LessonNavigationDrawerProps> = ({
  lessons,
  currentLessonIndex,
  completedLessons,
  onLessonSelect,
  sectionTitle,
  open,
  onOpenChange,
}) => {
  // Calculate progress
  const completedCount = lessons.filter(l => completedLessons.has(l.id)).length;
  const totalLessons = lessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  /**
   * Check if a lesson is unlocked
   * - First lesson (index 0) is always unlocked
   * - Other lessons unlock when previous lesson is completed
   */
  const isLessonUnlocked = (index: number): boolean => {
    if (index === 0) return true; // First lesson always unlocked
    const previousLesson = lessons[index - 1];
    return completedLessons.has(previousLesson.id);
  };

  /**
   * Get icon for lesson type
   */
  const getTypeIcon = (kind: string) => {
    switch (kind) {
      case "VIDEO":
        return <Video className="w-4 h-4" />;
      case "QUIZ":
        return <HelpCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  /**
   * Get display label for lesson type
   */
  const getTypeLabel = (kind: string) => {
    switch (kind) {
      case "VIDEO":
        return "VIDEO";
      case "QUIZ":
        return "QUIZ";
      case "TEXT":
        return "ARTICLE";
      default:
        return kind;
    }
  };

  const handleLessonClick = (index: number) => {
    if (isLessonUnlocked(index)) {
      onLessonSelect(index);
      onOpenChange(false); // Close drawer after selection
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3"
          aria-label="Show lessons"
        >
          <List className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Leksjoner</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="text-lg">{sectionTitle}</SheetTitle>
          <p className="text-sm text-neutral-600">{totalLessons} leksjon{totalLessons !== 1 ? 'er' : ''}</p>
        </SheetHeader>

        {/* Progress Section */}
        <div className="mt-6 mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-neutral-700">Fremgang</span>
            <span className="text-sm font-bold text-emerald-600">
              {completedCount}/{totalLessons}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-center text-neutral-600 mt-1">
            {progressPercent}% fullført
          </p>
        </div>

        {/* Lesson List - Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {lessons.map((lesson, index) => {
            const isCompleted = completedLessons.has(lesson.id);
            const isCurrent = currentLessonIndex === index;
            const isUnlocked = isLessonUnlocked(index);

            return (
              <div
                key={lesson.id}
                onClick={() => handleLessonClick(index)}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all duration-200 min-h-[72px]",
                  // Completed state
                  isCompleted && "bg-emerald-50 border-emerald-200",
                  // Current state (not completed yet)
                  isCurrent && !isCompleted && "bg-emerald-50 border-emerald-600 shadow-md ring-2 ring-emerald-200",
                  // Unlocked but not current or completed
                  !isCompleted && !isCurrent && isUnlocked && "bg-white border-neutral-200 hover:border-emerald-300 hover:shadow-sm cursor-pointer active:bg-emerald-50",
                  // Locked state
                  !isUnlocked && "bg-neutral-50 border-neutral-200 opacity-60 cursor-not-allowed",
                  // Make completed lessons also clickable for review
                  isCompleted && "cursor-pointer active:bg-emerald-100"
                )}
                title={!isUnlocked ? "Fullfør forrige leksjon først" : ""}
                role="button"
                tabIndex={isUnlocked ? 0 : -1}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted ? (
                      <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    ) : !isUnlocked ? (
                      <div className="w-6 h-6 bg-neutral-300 rounded-full flex items-center justify-center">
                        <Lock className="w-3 h-3 text-neutral-600" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-neutral-300 rounded-full" />
                    )}
                  </div>

                  {/* Lesson Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-semibold text-sm mb-1 line-clamp-2",
                      isCompleted && "text-emerald-700",
                      isCurrent && "text-emerald-900",
                      !isCurrent && !isCompleted && isUnlocked && "text-[#0A0A0A]",
                      !isUnlocked && "text-neutral-500"
                    )}>
                      {index + 1}. {lesson.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-600 flex-wrap">
                      {getTypeIcon(lesson.kind)}
                      <span className="font-medium">{getTypeLabel(lesson.kind)}</span>
                      <span className="text-neutral-400">•</span>
                      <Clock className="w-3 h-3" />
                      <span>{lesson.duration_estimate_minutes}min</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LessonNavigationDrawer;

