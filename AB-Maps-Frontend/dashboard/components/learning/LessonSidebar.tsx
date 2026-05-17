"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Clock, Video, FileText, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningLesson } from "@/services/learningTypes";

interface LessonSidebarProps {
  lessons: LearningLesson[];
  currentLessonIndex: number;
  completedLessons: Set<number>;
  onLessonSelect: (index: number) => void;
  sectionTitle: string;
}

/**
 * LessonSidebar Component
 * 
 * Displays all lessons in a section with:
 * - Visual completion indicators (green for completed)
 * - Current lesson highlighting (blue border)
 * - Lock status (locked until previous completed)
 * - Progress bar showing completion percentage
 * - Click navigation to unlocked lessons
 * 
 * @param lessons - Array of lessons in the section
 * @param currentLessonIndex - Index of the currently displayed lesson
 * @param completedLessons - Set of completed lesson IDs
 * @param onLessonSelect - Callback when user clicks a lesson
 * @param sectionTitle - Title of the section
 */
const LessonSidebar: React.FC<LessonSidebarProps> = ({
  lessons,
  currentLessonIndex,
  completedLessons,
  onLessonSelect,
  sectionTitle
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

  return (
    <Card className="sticky top-4 h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {/* Header */}
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="text-lg truncate">{sectionTitle}</CardTitle>
        <p className="text-sm text-gray-600">{totalLessons} leksjon{totalLessons !== 1 ? 'er' : ''}</p>
      </CardHeader>

      {/* Lesson List - Scrollable */}
      <CardContent className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {lessons.map((lesson, index) => {
            const isCompleted = completedLessons.has(lesson.id);
            const isCurrent = currentLessonIndex === index;
            const isUnlocked = isLessonUnlocked(index);

            return (
              <div
                key={lesson.id}
                onClick={() => {
                  if (isUnlocked) {
                    onLessonSelect(index);
                  }
                }}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all duration-200",
                  // Completed state
                  isCompleted && "bg-green-50 border-green-200 hover:bg-green-100",
                  // Current state (not completed yet)
                  isCurrent && !isCompleted && "bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-200",
                  // Unlocked but not current or completed
                  !isCompleted && !isCurrent && isUnlocked && "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer",
                  // Locked state
                  !isUnlocked && "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed",
                  // Make completed lessons also clickable for review
                  isCompleted && "cursor-pointer"
                )}
                title={!isUnlocked ? "Fullfør forrige leksjon først" : ""}
                role="button"
                tabIndex={isUnlocked ? 0 : -1}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted ? (
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    ) : !isUnlocked ? (
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                        <Lock className="w-3 h-3 text-gray-600" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                    )}
                  </div>

                  {/* Lesson Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-semibold text-sm mb-1 line-clamp-2",
                      isCompleted && "text-green-700",
                      isCurrent && "text-blue-900",
                      !isCurrent && !isCompleted && isUnlocked && "text-gray-900",
                      !isUnlocked && "text-gray-500"
                    )}>
                      {index + 1}. {lesson.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      {getTypeIcon(lesson.kind)}
                      <span className="font-medium">{getTypeLabel(lesson.kind)}</span>
                      <span className="text-gray-400">•</span>
                      <Clock className="w-3 h-3" />
                      <span>{lesson.duration_estimate_minutes}min</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Progress Footer */}
      <div className="border-t bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-gray-700">Fremgang</span>
            <span className="font-bold text-blue-600">
              {completedCount}/{totalLessons}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-center text-gray-600">
            {progressPercent}% fullført
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LessonSidebar;

