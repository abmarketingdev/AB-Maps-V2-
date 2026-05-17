"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Search, MapPin, Calendar, User } from "lucide-react";
import { fetchAllCampaigns } from "@/services/campaignService";
import { toast } from "@/components/ui/use-toast";

interface StandaloneCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onCampaignSelect: (campaign: any) => void;
}

export default function StandaloneCampaignModal({ 
  open, 
  onClose,
  onCampaignSelect 
}: StandaloneCampaignModalProps) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      loadCampaigns();
    }
  }, [open]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await fetchAllCampaigns();
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

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.created_by?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCampaignSelect = (campaign: any) => {
    // Store campaign in localStorage for AB Maps manager frontend
    localStorage.setItem('currentCampaign', JSON.stringify(campaign));
    onCampaignSelect(campaign);
    onClose();
    toast({
      title: 'Campaign Selected',
      description: `You are now working with "${campaign.name}" campaign.`,
    });
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">
              Velg kampanje
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ab-accent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading campaigns...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Velg kampanje
          </DialogTitle>
          <p className="text-center text-muted-foreground mt-2">
            Velg kampanjen du tilhører
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Søk kampanjen du tilhører"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-ab-elevated border border-ab-line rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ab-accent/30 focus:border-ab-accent transition-colors"
            />
          </div>

          {/* Campaigns List */}
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {filteredCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {searchTerm ? 'No campaigns found' : 'No campaigns available'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm
                    ? 'Try adjusting your search terms.'
                    : 'There are no campaigns in the system yet.'
                  }
                </p>
              </div>
            ) : (
              filteredCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  onClick={() => handleCampaignSelect(campaign)}
                  className="p-4 bg-ab-elevated border border-ab-line rounded-lg hover:border-ab-accent/40 hover:bg-ab-active cursor-pointer transition-colors duration-200 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-ab-accent transition-colors">
                          {campaign.name}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>

                      <p className="text-muted-foreground mb-3 line-clamp-2">
                        {campaign.description || "Ingen beskrivelse lagt inn"}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{campaign.created_by || "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(campaign.created_at)}</span>
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
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ab-line pt-4">
            <p className="text-sm text-muted-foreground text-center">
              Du kan når som helst endre den valgte kampanjen ved å trykke på nytt fra navigasjonen
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 