import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Search, MapPin, Calendar, User, Plus } from "lucide-react";
import { fetchAllCampaigns, fetchAssignedCampaignsForEmployee } from "@/services/campaignService";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface CampaignSelectionModalProps {
  open: boolean;
  onCampaignSelect: (campaign: any) => void;
}

export default function CampaignSelectionModal({ 
  open, 
  onCampaignSelect 
}: CampaignSelectionModalProps) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      loadCampaigns();
    }
  }, [open]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      
      // Determine user type and use appropriate API
      const userType = user?.user_type;
      const isEmployee = userType === 'employee';
      
      let data: any[];
      
      if (isEmployee) {
        // Use employee-specific API
        console.log('Loading campaigns for employee using fetchAssignedCampaignsForEmployee');
        data = await fetchAssignedCampaignsForEmployee();
      } else {
        // Use manager API
        console.log('Loading campaigns for manager using fetchAllCampaigns');
        data = await fetchAllCampaigns();
      }
      
      setCampaigns(data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaigns. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    // Handle different data formats for employee vs manager
    const campaignData = campaign.campaign || campaign; // Employee has nested campaign, manager has flat
    const name = campaignData.name || '';
    const description = campaignData.description || '';
    const createdBy = campaignData.created_by?.name || campaignData.created_by || '';
    
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           description.toLowerCase().includes(searchTerm.toLowerCase()) ||
           createdBy.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCampaignSelect = (campaign: any) => {
    // Extract campaign data based on format
    const campaignData = campaign.campaign || campaign; // Employee has nested campaign, manager has flat
    
    // Store campaign in localStorage for AB Maps manager frontend
    localStorage.setItem('currentCampaign', JSON.stringify(campaignData));
    onCampaignSelect(campaignData);
    toast({
      title: 'Campaign Selected',
      description: `You are now working with "${campaignData.name}" campaign.`,
    });
  };

  const handleCreateButtonClick = () => {
    console.log('Create Campaign button clicked - redirecting to campaigns page');
    // Close the modal first
    onCampaignSelect(null);
    // Redirect to campaigns page
    router.push('/campaigns');
    toast({
      title: 'Redirecting',
      description: 'Taking you to the campaigns page to create a new campaign.',
    });
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">
              Welcome to AB Sales Dashboard
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading campaigns...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Welcome to AB Sales Dashboard
          </DialogTitle>
          <p className="text-center text-gray-600 mt-2">
            Please select a campaign to continue
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Søk kampanjen du tilhører"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Campaigns List */}
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {filteredCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'No campaigns found' : 'No campaigns available'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm 
                    ? 'Try adjusting your search terms.' 
                    : 'There are no campaigns in the system yet.'
                  }
                </p>
                
                {/* Show Create Campaign button only for managers when no campaigns exist */}
                {!searchTerm && user?.user_type !== 'employee' && (
                  <Button 
                    onClick={handleCreateButtonClick}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Campaign
                  </Button>
                )}
              </div>
            ) : (
              filteredCampaigns.map((campaign) => {
                // Handle different data formats for employee vs manager
                const campaignData = campaign.campaign || campaign; // Employee has nested campaign, manager has flat
                const assignedAt = campaign.assigned_at; // Only available for employee data
                
                return (
                  <div
                    key={campaignData.id}
                    onClick={() => handleCampaignSelect(campaign)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                            {campaignData.name}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            Active
                          </Badge>
                          {assignedAt && (
                            <Badge variant="secondary" className="text-xs">
                              Assigned: {formatDate(assignedAt)}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {campaignData.description || "Ingen beskrivelse lagt inn"}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{campaignData.created_by?.name || campaignData.created_by || "Unknown"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(campaignData.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <Button
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          Velg kampanje
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 text-center">
              Du kan når som helst endre den valgte kampanjen ved å trykke på nytt fra navigasjonen
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 