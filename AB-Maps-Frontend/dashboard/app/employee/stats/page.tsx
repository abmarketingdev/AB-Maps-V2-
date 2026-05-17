"use client"

import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { EmployeeLayout } from "@/components/employee/EmployeeLayout";
import EmployeeStatsDashboard from "@/components/employee/EmployeeStatsDashboard";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchAssignedCampaignsForEmployee } from '@/services/campaignService';
import { 
  checkCampaignCompletion, 
  type CampaignCompletionResponse,
  clearCompletionCache 
} from "@/services/learningCompletionService";
import { CompletionCheckPopup } from "@/components/learning/CompletionCheckPopup";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeStatsPage() {
  const { user, isSuperuser } = useAuth();
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [completionStatus, setCompletionStatus] = useState<CampaignCompletionResponse | null>(null);
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);

  // Helper function to check completion for a campaign
  const checkCompletionForCampaign = useCallback(async (campaign: any) => {
    if (!campaign?.id || !user) return;
    
    // Check completion if user is not superuser
    if (!isSuperuser && user) {
      const userId = user.user_info?.id || user.user_id;
      
      if (userId) {
        setIsCheckingCompletion(true);
        try {
          console.log('[Employee Stats] Checking completion for campaign:', {
            campaignId: campaign.id,
            userId,
            userType: 'employee'
          });
          
          const completion = await checkCampaignCompletion({
            campaignId: campaign.id,
            userId,
            userType: 'employee'
          });
          
          // Edge case: User not assigned to campaign
          if (!completion.is_assigned_to_campaign) {
            console.warn('[Employee Stats] User not assigned to campaign');
            toast({
              title: 'Ikke tilknyttet kampanje',
              description: 'Du er ikke tilknyttet denne kampanjen. Vennligst velg en annen kampanje.',
              variant: 'destructive',
            });
            setCompletionStatus(null);
            return;
          }
          
          // Edge case: Campaign has no sections
          if (completion.total_sections === 0) {
            console.warn('[Employee Stats] Campaign has no sections');
            toast({
              title: 'Ingen seksjoner',
              description: 'Denne kampanjen har ingen seksjoner å fullføre.',
              variant: 'default',
            });
            setCompletionStatus(null);
            return;
          }
          
          setCompletionStatus(completion);
          console.log('[Employee Stats] Completion check result:', {
            all_completed: completion.all_completed,
            incomplete_count: completion.incomplete_sections.length
          });
          
          // Show popup if course is incomplete
          if (!completion.all_completed) {
            setShowCompletionPopup(true);
          }
        } catch (error) {
          console.error('[Employee Stats] Error checking completion:', error);
          
          // Show user-friendly error message
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Kunne ikke sjekke kursfullføring. Vennligst prøv igjen.';
          
          toast({
            title: 'Feil ved sjekk av kursfullføring',
            description: errorMessage,
            variant: 'destructive',
          });
          
          setCompletionStatus(null);
        } finally {
          setIsCheckingCompletion(false);
        }
      }
    } else if (isSuperuser) {
      setCompletionStatus(null);
      clearCompletionCache();
    }
  }, [user, isSuperuser]);

  // Fetch campaigns for the layout
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (user?.user_info?.id) {
        try {
          const fetchedCampaigns = await fetchAssignedCampaignsForEmployee(user.user_info.id);
          setCampaigns(fetchedCampaigns);
          if (fetchedCampaigns.length > 0 && !selectedCampaign) {
            const firstCampaign = fetchedCampaigns[0];
            setSelectedCampaign(firstCampaign);
            // Store in localStorage
            localStorage.setItem('currentCampaign', JSON.stringify(firstCampaign));
            // Check completion for auto-selected campaign
            await checkCompletionForCampaign(firstCampaign);
          }
        } catch (error) {
          console.error('Failed to fetch campaigns:', error);
        }
      }
    };
    fetchCampaigns();
  }, [user?.user_info?.id, selectedCampaign, checkCompletionForCampaign]);

  const handleCampaignSelect = async (campaign: any) => {
    setSelectedCampaign(campaign);
    
    // Store campaign in localStorage
    if (campaign) {
      localStorage.setItem('currentCampaign', JSON.stringify(campaign));
      // Check completion for selected campaign
      await checkCompletionForCampaign(campaign);
    }
  };

  return (
    <ProtectedRoute requiredUserType="employee">
      <EmployeeLayout
        selectedCampaign={selectedCampaign}
        onCampaignSelect={handleCampaignSelect}
        campaigns={campaigns}
      >
        <EmployeeStatsDashboard />
      </EmployeeLayout>
      
      {/* Completion Check Popup */}
      <CompletionCheckPopup
        open={showCompletionPopup}
        onOpenChange={setShowCompletionPopup}
        completionStatus={completionStatus}
      />
    </ProtectedRoute>
  );
}

