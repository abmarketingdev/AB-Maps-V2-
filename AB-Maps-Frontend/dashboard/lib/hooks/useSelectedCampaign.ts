"use client";

import { useEffect, useState } from "react";
import { getStoredCampaign, type PickCampaign } from "@/components/dashboard/v2/CampaignPicker";

/**
 * The app-wide selected campaign (from CampaignPicker). Pages pass `campaignId`
 * to their data adapters to scope team-wide endpoints to one campaign.
 * `undefined` = no campaign selected → team-wide.
 */
export function useSelectedCampaign(): { campaignId: string | undefined; campaign: PickCampaign | null } {
  const [campaign, setCampaign] = useState<PickCampaign | null>(null);

  useEffect(() => {
    setCampaign(getStoredCampaign());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      // The event carries {id,name,color}; re-read the full stored object for completeness.
      setCampaign(getStoredCampaign() ?? (detail ? ({ id: detail.id, name: detail.name, color: detail.color } as PickCampaign) : null));
    };
    window.addEventListener("ab:campaign-changed", onChange);
    return () => window.removeEventListener("ab:campaign-changed", onChange);
  }, []);

  return { campaignId: campaign?.id, campaign };
}
