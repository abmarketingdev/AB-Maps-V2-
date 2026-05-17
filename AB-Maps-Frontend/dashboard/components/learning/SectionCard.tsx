"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Lock } from "lucide-react";
import type { LearningSection } from "@/services/learningTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  section: LearningSection;
  isCompleted: boolean;
  isUnlocked: boolean;
  onClick: () => void;
}

const SectionCard: React.FC<SectionCardProps> = ({
  section,
  isCompleted,
  isUnlocked,
  onClick,
}) => {
  const isMobile = useIsMobile();
  const getStatusIcon = () => {
    const iconSize = isMobile ? "w-5 h-5" : "w-6 h-6";
    if (isCompleted) {
      return <Check className={cn(iconSize, "text-green-600")} />;
    }
    if (isUnlocked) {
      return (
        <div className={cn(
          "bg-blue-500 rounded-full flex items-center justify-center",
          isMobile ? "w-6 h-6" : "w-7 h-7"
        )}>
          <span className={cn("text-white", isMobile ? "text-[10px]" : "text-xs")}>→</span>
        </div>
      );
    }
    return <Lock className={cn(iconSize, "text-gray-400")} />;
  };

  const getStatusColor = () => {
    if (isCompleted) return "border-green-200 bg-green-50";
    if (isUnlocked) return "border-blue-200 bg-blue-50";
    return "border-gray-200 bg-gray-50";
  };

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer",
        isMobile 
          ? "active:scale-[0.98] min-h-[88px]" // Touch feedback and minimum touch target
          : "hover:shadow-md",
        getStatusColor()
      )}
      onClick={onClick}
    >
      <CardContent className={cn(isMobile ? "p-4" : "p-6")}>
        <div className={cn("flex items-start", isMobile ? "gap-3" : "gap-4")}>
          <div className={cn(
            "rounded-full flex items-center justify-center text-white flex-shrink-0",
            isMobile ? "w-10 h-10 text-lg" : "w-12 h-12 text-xl",
            section.icon_color || 'bg-green-500'
          )}>
            {section.icon_emoji || "📚"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "font-semibold mb-2 truncate",
              isMobile ? "text-base" : "text-lg"
            )}>
              {section.title}
            </h3>
            <p className={cn(
              "text-gray-600 mb-3 line-clamp-2",
              isMobile ? "text-xs" : "text-sm"
            )}>
              {section.description}
            </p>
            
            {/* NEW: Optional Campaign Badge */}
            {section.campaign_name && (
              <div className={cn("mb-2", isMobile && "mb-1.5")}>
                <Badge 
                  variant={section.is_general_training ? "outline" : "secondary"}
                  className={cn(isMobile ? "text-[10px] px-1.5 py-0" : "text-xs")}
                >
                  {section.is_general_training ? '📚' : '🎯'} {section.campaign_name}
                </Badge>
              </div>
            )}
            
            <div className={cn(
              "flex items-center gap-2 text-gray-500",
              isMobile ? "text-xs" : "text-sm"
            )}>
              <Clock className={cn(isMobile ? "w-3.5 h-3.5" : "w-4 h-4")} />
              <span>{section.duration_estimate_minutes}min</span>
            </div>
          </div>
          <div className="flex-shrink-0">
            {isMobile ? (
              <div className={cn(
                "flex items-center justify-center",
                isCompleted ? "w-8 h-8" : "w-7 h-7"
              )}>
                {getStatusIcon()}
              </div>
            ) : (
              getStatusIcon()
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SectionCard;
