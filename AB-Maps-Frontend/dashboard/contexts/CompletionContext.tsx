"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { 
  CampaignCompletionResponse, 
  checkCampaignCompletion,
  CheckCompletionParams,
  clearCompletionCache as clearServiceCache
} from '@/services/learningCompletionService';
import { useAuth } from '@/lib/auth/AuthContext';

interface CompletionContextType {
  // Completion data
  all_completed: boolean;
  campaign_id: string | null;
  incomplete_sections: Array<{
    section_id: string;
    section_title: string;
    section_order: number;
    progress_percent: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    completed_at: string | null;
  }>;
  isChecking: boolean;
  
  // Full completion status object (for backward compatibility)
  completionStatus: CampaignCompletionResponse | null;
  
  // Computed properties
  isLocked: boolean; // True if navbar should be locked (incomplete and not superuser)
  
  // Methods
  checkCompletion: (params: CheckCompletionParams) => Promise<CampaignCompletionResponse | null>;
  clearCompletionStatus: () => void;
  updateCompletionStatus: (status: CampaignCompletionResponse | null) => void;
  refreshCompletion: (campaignId?: string) => Promise<void>;
}

const CompletionContext = createContext<CompletionContextType | undefined>(undefined);

export function CompletionProvider({ children }: { children: ReactNode }) {
  const { user, isSuperuser } = useAuth();
  const [completionStatus, setCompletionStatus] = useState<CampaignCompletionResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Extract data from completion status for easier access
  const all_completed = completionStatus?.all_completed ?? false;
  const campaign_id = completionStatus?.campaign_id ?? null;
  const incomplete_sections = completionStatus?.incomplete_sections ?? [];

  // Navbar is locked if completion status exists and all_completed is false
  const isLocked = completionStatus !== null && !completionStatus.all_completed;

  /**
   * Check completion for a campaign
   */
  const checkCompletion = useCallback(async (params: CheckCompletionParams): Promise<CampaignCompletionResponse | null> => {
    // Don't check if user is superuser
    if (isSuperuser) {
      console.log('[CompletionContext] User is superuser, skipping completion check');
      return null;
    }

    setIsChecking(true);
    try {
      const result = await checkCampaignCompletion(params);
      setCompletionStatus(result);
      return result;
    } catch (error) {
      console.error('[CompletionContext] Error checking completion:', error);
      setCompletionStatus(null);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [isSuperuser]);

  /**
   * Clear completion status
   */
  const clearCompletionStatus = useCallback(() => {
    setCompletionStatus(null);
    clearServiceCache();
    console.log('[CompletionContext] Completion status cleared');
  }, []);

  /**
   * Update completion status manually
   */
  const updateCompletionStatus = useCallback((status: CampaignCompletionResponse | null) => {
    setCompletionStatus(status);
    console.log('[CompletionContext] Completion status updated:', {
      all_completed: status?.all_completed,
      campaign_id: status?.campaign_id,
      incomplete_count: status?.incomplete_sections.length
    });
  }, []);

  /**
   * Refresh completion status for current campaign
   */
  const refreshCompletion = useCallback(async (campaignId?: string) => {
    if (!user || isSuperuser) {
      return;
    }

    // Get campaign ID from parameter or localStorage
    let targetCampaignId = campaignId;
    if (!targetCampaignId) {
      const storedCampaign = localStorage.getItem('currentCampaign');
      if (storedCampaign) {
        try {
          const campaign = JSON.parse(storedCampaign);
          targetCampaignId = campaign.id;
        } catch (e) {
          console.error('[CompletionContext] Error parsing campaign from localStorage:', e);
          return;
        }
      }
    }

    if (!targetCampaignId) {
      console.warn('[CompletionContext] No campaign ID available for refresh');
      return;
    }

    const userId = user.user_type === 'manager' 
      ? (user.user_info?.id || user.user_id)
      : (user.user_info?.id || user.user_id);

    if (!userId) {
      console.warn('[CompletionContext] No user ID available for refresh');
      return;
    }

    const userType = user.user_type === 'manager' ? 'manager' : 'employee';
    
    await checkCompletion({
      campaignId: targetCampaignId,
      userId,
      userType
    });
  }, [user, isSuperuser, checkCompletion]);

  return (
    <CompletionContext.Provider
      value={{
        // Data fields
        all_completed,
        campaign_id,
        incomplete_sections,
        isChecking,
        completionStatus,
        
        // Computed properties
        isLocked,
        
        // Methods
        checkCompletion,
        clearCompletionStatus,
        updateCompletionStatus,
        refreshCompletion,
      }}
    >
      {children}
    </CompletionContext.Provider>
  );
}

export function useCompletion() {
  const context = useContext(CompletionContext);
  if (context === undefined) {
    throw new Error('useCompletion must be used within a CompletionProvider');
  }
  return context;
}

