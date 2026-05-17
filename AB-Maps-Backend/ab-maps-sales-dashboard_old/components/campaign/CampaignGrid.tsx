import React from "react";
import CampaignCard from "./CampaignCard";
import { useAuth } from "@/lib/auth/AuthContext";

interface CampaignGridProps {
  campaigns: any[];
  onEdit: (campaign: any) => void;
  onDelete: (campaign: any) => void;
  onAssignEmployees: (campaign: any) => void;
}

export default function CampaignGrid({ 
  campaigns, 
  onEdit, 
  onDelete, 
  onAssignEmployees 
}: CampaignGridProps) {
  const { user } = useAuth();
  const currentUserId = user?.user_info?.id || user?.user_id;

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen kampanjer funnet</h3>
        <p className="text-gray-500 max-w-md">
          Det er ingen kampanjer tilgjengelig for øyeblikket. Opprett en ny kampanje for å komme i gang.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {campaigns.map((campaign) => {
        // All managers can edit/delete any campaign
        const isOwner = true;
        
        return (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onEdit={onEdit}
            onDelete={onDelete}
            onAssignEmployees={onAssignEmployees}
            isOwner={isOwner}
          />
        );
      })}
    </div>
  );
} 