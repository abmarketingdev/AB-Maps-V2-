"use client"

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CampaignCompletionResponse, IncompleteSection } from '@/services/learningCompletionService';
import { BookOpen, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CompletionCheckPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completionStatus: CampaignCompletionResponse | null;
  onGoToLearningPlatform?: () => void;
}

/**
 * Popup component that displays incomplete sections when course completion is incomplete
 */
export function CompletionCheckPopup({
  open,
  onOpenChange,
  completionStatus,
  onGoToLearningPlatform,
}: CompletionCheckPopupProps) {
  const router = useRouter();

  if (!completionStatus || completionStatus.all_completed) {
    return null;
  }

  const handleGoToLearningPlatform = () => {
    if (onGoToLearningPlatform) {
      onGoToLearningPlatform();
    } else {
      router.push('/learning-platform');
    }
    onOpenChange(false);
  };

  const handleDismiss = () => {
    onOpenChange(false);
  };

  const incompleteSections = completionStatus.incomplete_sections || [];
  const completedCount = completionStatus.completed_sections || 0;
  const totalCount = completionStatus.total_sections || 0;
  const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Get status icon and color
  const getStatusInfo = (status: IncompleteSection['status']) => {
    switch (status) {
      case 'NOT_STARTED':
        return {
          icon: <Clock className="h-4 w-4" />,
          label: 'Ikke startet',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
        };
      case 'IN_PROGRESS':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          label: 'Pågår',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
        };
      case 'COMPLETED':
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: 'Fullført',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          label: 'Ukjent',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
        };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">
                Kurset er ikke fullført
              </DialogTitle>
              <DialogDescription className="mt-1">
                Kampanje: <span className="font-medium">{completionStatus.campaign_name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Overall Progress */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Total fremgang
              </span>
              <span className="text-sm font-semibold">
                {completedCount} av {totalCount} seksjoner fullført
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {overallProgress.toFixed(0)}% fullført
            </p>
          </div>

          {/* Incomplete Sections List */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-foreground">
              Ufullstendige seksjoner ({incompleteSections.length})
            </h3>
            <div className="space-y-3">
              {incompleteSections
                .sort((a, b) => a.section_order - b.section_order)
                .map((section) => {
                  const statusInfo = getStatusInfo(section.status);
                  return (
                    <div
                      key={section.section_id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={cn(
                                'p-1.5 rounded-md',
                                statusInfo.bgColor
                              )}
                            >
                              <div className={cn(statusInfo.color)}>
                                {statusInfo.icon}
                              </div>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              Seksjon {section.section_order}
                            </span>
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full font-medium',
                                statusInfo.bgColor,
                                statusInfo.color
                              )}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm mb-2">
                            {section.section_title}
                          </h4>
                          {section.status === 'IN_PROGRESS' && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Fremgang
                                </span>
                                <span className="font-medium">
                                  {section.progress_percent.toFixed(0)}%
                                </span>
                              </div>
                              <Progress
                                value={section.progress_percent}
                                className="h-1.5"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Info Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900">
                  Du må fullføre alle seksjoner i kurset før du kan få tilgang til alle funksjoner i dashbordet.
                  Gå til AB Academy for å fullføre de manglende seksjonene.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Lukk
          </Button>
          <Button
            onClick={handleGoToLearningPlatform}
            className="w-full sm:w-auto"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Gå til AB Academy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

