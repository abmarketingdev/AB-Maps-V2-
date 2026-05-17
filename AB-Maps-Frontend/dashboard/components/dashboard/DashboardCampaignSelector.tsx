"use client"

/**
 * Dashboard Campaign Selector Component
 * 
 * Multi-select campaign selector with "All Campaigns" option.
 * Supports selecting multiple campaigns (comma-separated UUIDs) or "All Campaigns".
 */

import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { fetchAllCampaigns, Campaign } from '@/services/campaignService';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/utils';

interface DashboardCampaignSelectorProps {
  value: string | null; // Comma-separated campaign IDs or null for "All Campaigns"
  onChange: (value: string | null) => void;
  className?: string;
  availableCampaigns?: Campaign[]; // Optional: Filter campaigns to this list (for employees)
}

export function DashboardCampaignSelector({
  value,
  onChange,
  className,
  availableCampaigns
}: DashboardCampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  // Load campaigns on mount
  useEffect(() => {
    if (availableCampaigns) {
      // Use provided campaigns (for employees)
      setCampaigns(availableCampaigns);
    } else {
      // Load all campaigns (for managers)
      loadCampaigns();
    }
  }, [availableCampaigns]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const allCampaigns = await fetchAllCampaigns();
      setCampaigns(allCampaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  // Parse selected campaign IDs
  const selectedIds = value ? value.split(',').filter(Boolean) : [];

  // Get selected campaign objects
  const selectedCampaigns = campaigns.filter(c => selectedIds.includes(c.id));

  const handleToggleCampaign = (campaignId: string) => {
    const currentIds = selectedIds;
    const isSelected = currentIds.includes(campaignId);
    
    let newIds: string[];
    if (isSelected) {
      // Remove campaign
      newIds = currentIds.filter(id => id !== campaignId);
    } else {
      // Add campaign
      newIds = [...currentIds, campaignId];
    }
    
    // If no campaigns selected, set to "All Campaigns" (null)
    onChange(newIds.length > 0 ? newIds.join(',') : null);
  };

  const handleSelectAll = () => {
    // Set to null for "All Campaigns"
    onChange(null);
  };

  const handleClearAll = () => {
    onChange(null);
  };

  const displayText = () => {
    if (!value || selectedIds.length === 0) {
      return 'Alle kampanjer';
    }
    if (selectedIds.length === 1) {
      const campaign = campaigns.find(c => c.id === selectedIds[0]);
      return campaign?.name || '1 kampanje valgt';
    }
    return `${selectedIds.length} kampanjer valgt`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{displayText()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Søk kampanjer..." />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Laster kampanjer...' : 'Ingen kampanjer funnet.'}
            </CommandEmpty>
            <CommandGroup>
              {/* All Campaigns Option */}
              <CommandItem
                onSelect={handleSelectAll}
                className={cn(
                  "cursor-pointer",
                  !value && "bg-accent"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="font-medium">Alle kampanjer</span>
              </CommandItem>
              
              {/* Individual Campaigns */}
              {campaigns.map((campaign) => {
                const isSelected = selectedIds.includes(campaign.id);
                return (
                  <CommandItem
                    key={campaign.id}
                    onSelect={() => handleToggleCampaign(campaign.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{campaign.name}</div>
                      {campaign.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {campaign.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        
        {/* Selected Campaigns Display */}
        {selectedCampaigns.length > 0 && (
          <div className="border-t p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Valgt:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-6 px-2 text-xs"
              >
                Fjern alle
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedCampaigns.map((campaign) => (
                <Badge
                  key={campaign.id}
                  variant="secondary"
                  className="text-xs"
                >
                  {campaign.name}
                  <button
                    onClick={() => handleToggleCampaign(campaign.id)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default DashboardCampaignSelector;

