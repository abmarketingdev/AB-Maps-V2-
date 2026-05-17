"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle, Clock, Target, ChevronDown, ChevronUp } from "lucide-react";
import type { LearningProgress } from "@/services/learningTypes";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProgressTrackerProps {
  progress: LearningProgress;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ progress }) => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(isMobile);
  // Use the new progress structure
  const completionPercentage = progress.overall_progress_percent || progress.overall_progress || 0;
  
  // Calculate completed sections from the new structure (fallback to legacy)
  const completedSections = progress.sections?.filter(section => section.status === 'COMPLETED') || [];
  const totalSections = progress.sections?.length || progress.total_sections || 0;
  
  // Calculate completed lessons (fallback to legacy structure)
  const completedLessonsCount = progress.completed_lessons?.length || 0;
  const totalLessons = progress.total_lessons || 0;
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    if (percentage >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-600";
    if (percentage >= 60) return "bg-yellow-600";
    if (percentage >= 40) return "bg-orange-600";
    return "bg-red-600";
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className={cn("p-6", isMobile && "p-4")}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BookOpen className={cn("text-blue-600", isMobile ? "w-5 h-5" : "w-6 h-6")} />
            <h3 className={cn("font-semibold text-gray-900", isMobile ? "text-base" : "text-lg")}>
              Din fremgang
            </h3>
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0"
              aria-label={isCollapsed ? "Expand progress" : "Collapse progress"}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        
        {(!isMobile || !isCollapsed) && (
          <div className={cn("space-y-4", isMobile && "space-y-3")}>
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className={cn("font-medium text-gray-700", isMobile ? "text-xs" : "text-sm")}>
                  Total fremgang
                </span>
                <span className={cn("font-semibold", getProgressColor(completionPercentage), isMobile ? "text-xs" : "text-sm")}>
                  {completionPercentage}%
                </span>
              </div>
              <Progress 
                value={completionPercentage} 
                className={cn(isMobile ? "h-1.5" : "h-2")}
              />
              {progress.total_campaigns !== undefined && (
                <div className={cn("text-gray-500 mt-1 text-center", isMobile ? "text-[10px]" : "text-xs")}>
                  {progress.total_campaigns} kampanje{progress.total_campaigns !== 1 ? 'r' : ''}
                </div>
              )}
            </div>
          
            {/* NEW: Per-Campaign Progress */}
            {progress.campaigns && progress.campaigns.length > 0 && (
              <div className={cn("space-y-3", isMobile && "space-y-2")}>
                <h4 className={cn("font-semibold text-gray-700 flex items-center gap-2", isMobile ? "text-xs" : "text-sm")}>
                  <Target className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
                  Per kampanje
                </h4>
                {progress.campaigns.map((campaign) => (
                  <div key={campaign.campaign_id || 'general'} className={cn("space-y-1", isMobile && "space-y-0.5")}>
                    <div className="flex items-center justify-between">
                      <div className={cn("flex items-center gap-2", isMobile ? "text-[10px]" : "text-xs")}>
                        <span>{campaign.is_general ? '📚' : '🎯'}</span>
                        <span className={cn("font-medium text-gray-700 truncate", isMobile ? "max-w-[100px]" : "max-w-[120px]")}>
                          {campaign.campaign_name}
                        </span>
                      </div>
                      <span className={cn("font-semibold", getProgressColor(campaign.progress_percent), isMobile ? "text-[10px]" : "text-xs")}>
                        {campaign.progress_percent}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full" style={{ height: isMobile ? '4px' : '6px' }}>
                      <div 
                        className={cn(
                          "rounded-full transition-all",
                          campaign.is_general ? "bg-green-500" : "bg-blue-500"
                        )}
                        style={{ 
                          width: `${campaign.progress_percent}%`,
                          height: isMobile ? '4px' : '6px'
                        }}
                      />
                    </div>
                    <div className={cn("flex items-center gap-2 text-gray-500", isMobile ? "text-[10px] gap-2" : "text-xs gap-3")}>
                      <span className="flex items-center gap-1">
                        <CheckCircle className={cn("text-green-600", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                        {campaign.completed_sections}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className={cn("text-yellow-600", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                        {campaign.in_progress_sections}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={cn("rounded-full border-2 border-gray-400", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                        {campaign.not_started_sections}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Statistics (Legacy - show if no campaign data) */}
            {(!progress.campaigns || progress.campaigns.length === 0) && (
              <div className={cn("grid grid-cols-2 gap-4", isMobile && "gap-3")}>
                <div className="text-center">
                  <div className={cn("flex items-center justify-center gap-2 mb-1", isMobile && "gap-1")}>
                    <CheckCircle className={cn("text-green-600", isMobile ? "w-3 h-3" : "w-4 h-4")} />
                    <span className={cn("font-medium text-gray-700", isMobile ? "text-xs" : "text-sm")}>Fullført</span>
                  </div>
                  <div className={cn("font-bold text-green-600", isMobile ? "text-xl" : "text-2xl")}>
                    {completedSections.length}
                  </div>
                  <div className={cn("text-gray-500", isMobile ? "text-[10px]" : "text-xs")}>
                    av {totalSections} seksjoner
                  </div>
                </div>
                
                <div className="text-center">
                  <div className={cn("flex items-center justify-center gap-2 mb-1", isMobile && "gap-1")}>
                    <Clock className={cn("text-blue-600", isMobile ? "w-3 h-3" : "w-4 h-4")} />
                    <span className={cn("font-medium text-gray-700", isMobile ? "text-xs" : "text-sm")}>Leksjoner</span>
                  </div>
                  <div className={cn("font-bold text-blue-600", isMobile ? "text-xl" : "text-2xl")}>
                    {completedLessonsCount}
                  </div>
                  <div className={cn("text-gray-500", isMobile ? "text-[10px]" : "text-xs")}>
                    av {totalLessons} leksjoner
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Collapsed view on mobile - show summary only */}
        {isMobile && isCollapsed && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Total fremgang:</span>
              <span className={cn("text-sm font-semibold", getProgressColor(completionPercentage))}>
                {completionPercentage}%
              </span>
            </div>
            {progress.campaigns && progress.campaigns.length > 0 && (
              <span className="text-xs text-gray-500">
                {progress.campaigns.length} kampanje{progress.campaigns.length !== 1 ? 'r' : ''}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProgressTracker;
