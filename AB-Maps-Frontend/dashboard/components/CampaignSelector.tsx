"use client";
import './campaign-selector.css';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, MapPin, User, X } from 'lucide-react';
import { fetchAllCampaigns, fetchAssignedCampaignsForEmployee, Campaign } from '@/services/campaignService';
import { useAuth } from '@/lib/auth/AuthContext';
import { toast } from '@/components/ui/use-toast';

interface CampaignSelectorProps {
  onCampaignSelect?: (campaign: Campaign) => void;
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  selectedCampaign?: Campaign | null;
  useCurrentCampaign?: boolean; // If true, use 'currentCampaign' for AB Maps, otherwise use 'selectedCampaign' for sales
}

export default function CampaignSelector({ 
  onCampaignSelect, 
  className = '', 
  isOpen = false, 
  onClose,
  selectedCampaign: propSelectedCampaign,
  useCurrentCampaign = false
}: CampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const { user } = useAuth();
  const [noCampaignSelected, setNoCampaignSelected] = useState(false);

  // Load campaigns on component mount
  useEffect(() => {
    loadCampaigns();
  }, []);

  // Use prop selectedCampaign if provided, otherwise load from localStorage
  useEffect(() => {
    if (propSelectedCampaign) {
      setSelectedCampaign(propSelectedCampaign);
    } else {
      const storageKey = useCurrentCampaign ? 'currentCampaign' : 'selectedCampaign';
      const storedCampaign = localStorage.getItem(storageKey);
      if (storedCampaign && campaigns.length > 0) {
        try {
          const campaign = JSON.parse(storedCampaign);
          const foundCampaign = campaigns.find(c => c.id === campaign.id);
          if (foundCampaign) {
            setSelectedCampaign(foundCampaign);
          }
        } catch (error) {
          console.error('Error parsing stored campaign:', error);
          localStorage.removeItem(storageKey);
        }
      }
    }
  }, [campaigns, propSelectedCampaign, useCurrentCampaign]);

  useEffect(() => {
    const checkCampaign = () => {
      const campaign = localStorage.getItem('currentCampaign');
      setNoCampaignSelected(!campaign);
    };
    checkCampaign();
    window.addEventListener('storage', checkCampaign);

    // Also update when selectedCampaign prop changes
    if (selectedCampaign) {
      setNoCampaignSelected(false);
    }

    return () => window.removeEventListener('storage', checkCampaign);
  }, [selectedCampaign]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      // Determine user type and use appropriate API
      const userType = user?.user_type;
      const isEmployee = userType === 'employee';
      
      let allCampaigns: Campaign[];
      
      if (isEmployee) {
        const employeeId = user?.user_info?.id;
        if (!employeeId) {
          console.warn('No employeeId found for employee user');
          setCampaigns([]);
          setLoading(false);
          return;
        }
        // Use employee-specific API
        console.log('Loading campaigns for employee using fetchAssignedCampaignsForEmployee');
        allCampaigns = await fetchAssignedCampaignsForEmployee(employeeId);
      } else {
        // Use manager API
        console.log('Loading campaigns for manager using fetchAllCampaigns');
        allCampaigns = await fetchAllCampaigns();
      }
      
      setCampaigns(allCampaigns);
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

  const handleCampaignSelect = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    const storageKey = useCurrentCampaign ? 'currentCampaign' : 'selectedCampaign';
    localStorage.setItem(storageKey, JSON.stringify(campaign));
    setNoCampaignSelected(false); // Remove highlight immediately
    // Call the callback if provided
    if (onCampaignSelect) {
      onCampaignSelect(campaign);
    }
    toast({
      title: 'Campaign Selected',
      description: `Selected campaign: ${campaign.name}`,
    });
  };

  const handleClearSelection = () => {
    setSelectedCampaign(null);
    const storageKey = useCurrentCampaign ? 'currentCampaign' : 'selectedCampaign';
    localStorage.removeItem(storageKey);
    setNoCampaignSelected(true); // Add highlight immediately
    toast({
      title: 'Selection Cleared',
      description: 'Campaign selection has been cleared.',
    });
  };

  // Group campaigns by creator
  const campaignsByCreator = campaigns.reduce((acc, campaign) => {
    const creator = campaign.created_by || 'Unknown';
    if (!acc[creator]) {
      acc[creator] = [];
    }
    acc[creator].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  // If modal mode is enabled, render as dialog
  if (isOpen === true) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Velg kampanje</span>
              {selectedCampaign && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-6 px-2 text-xs"
                >
                  Clear Selection
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Loading campaigns...</span>
              </div>
            ) : (
              <>
                {Object.entries(campaignsByCreator).map(([creator, creatorCampaigns]) => (
                  <div key={creator} className="space-y-2">
                    <div className="flex items-center text-sm font-medium text-muted-foreground border-b pb-2">
                      <User className="mr-2 h-4 w-4" />
                      {creator}
                    </div>
                    <div className="grid gap-2">
                      {creatorCampaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          onClick={() => handleCampaignSelect(campaign)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedCampaign?.id === campaign.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-lg">{campaign.name}</div>
                              {campaign.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {campaign.description}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-2">
                                Created: {new Date(campaign.created_at || '').toLocaleDateString()}
                              </div>
                            </div>
                            {selectedCampaign?.id === campaign.id && (
                              <div className="ml-4 text-primary">
                                <MapPin className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {campaigns.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No campaigns available
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Default dropdown mode - trigger campaign selection modal
  if (loading) {
    return (
      <Button variant="outline" disabled className={className}>
        <MapPin className="mr-2 h-4 w-4" />
        Loading campaigns...
      </Button>
    );
  }

  // If onCampaignSelect is provided but not in modal mode, render trigger button
  if (onCampaignSelect && !isOpen) {
    return (
      <Button 
        variant="outline" 
        onClick={() => {
          // Open the campaign selection modal by calling the callback
          onCampaignSelect(null as any);
        }}
        className={
          `${className} ${noCampaignSelected ? 'highlight-campaign-btn' : ''}`
        }
      >
        <MapPin className="mr-2 h-4 w-4" />
        {selectedCampaign ? selectedCampaign.name : 'Velg kampanje'}
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`min-w-[200px] justify-between ${className} ${noCampaignSelected ? 'highlight-campaign-btn' : ''}`}>
          <div className="flex items-center">
            <MapPin className="mr-2 h-4 w-4" />
            {selectedCampaign ? (
              <span className="truncate">{selectedCampaign.name}</span>
            ) : (
              <span>Velg kampanje</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Velg kampanje</span>
          {selectedCampaign && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleClearSelection();
              }}
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(campaignsByCreator).map(([creator, creatorCampaigns]) => (
          <div key={creator}>
            <DropdownMenuLabel className="flex items-center text-xs text-muted-foreground font-normal px-2 py-1">
              <User className="mr-2 h-3 w-3" />
              {creator}
            </DropdownMenuLabel>
            {creatorCampaigns.map((campaign) => (
              <DropdownMenuItem
                key={campaign.id}
                onClick={() => handleCampaignSelect(campaign)}
                className={`cursor-pointer ${selectedCampaign?.id === campaign.id ? 'bg-accent' : ''}`}
              >
                <div className="flex flex-col items-start w-full">
                  <div className="font-medium">{campaign.name}</div>
                  {campaign.description && (
                    <div className="text-xs text-muted-foreground truncate w-full">
                      {campaign.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(campaign.created_at || '').toLocaleDateString()}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
        
        {campaigns.length === 0 && (
          <DropdownMenuItem disabled>
            <div className="text-center w-full py-4 text-muted-foreground">
              No campaigns available
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 