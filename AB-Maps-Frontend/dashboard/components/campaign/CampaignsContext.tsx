"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchAllCampaigns, createCampaign as serviceCreateCampaign, updateCampaign as serviceUpdateCampaign, deleteCampaign as serviceDeleteCampaign, Campaign } from "@/services/campaignService";
import { useAuth } from "@/lib/auth/AuthContext";

interface CampaignsContextType {
  campaigns: Campaign[];
  loading: boolean;
  refresh: () => Promise<void>;
  createCampaign: (data: Omit<Campaign, "id">) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<Campaign | undefined>;
  deleteCampaign: (id: string) => Promise<void>;
}

const CampaignsContext = createContext<CampaignsContextType | undefined>(undefined);

export function useCampaigns(): CampaignsContextType {
  const context = useContext(CampaignsContext);
  if (!context) {
    throw new Error("useCampaigns must be used within a CampaignsProvider");
  }
  return context;
}

export function CampaignsProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  // Get manager ID from authenticated user
  const managerId = user?.user_info?.manager_id || user?.user_info?.id || user?.user_id || "";

  const refresh = async () => {
    if (!isAuthenticated || !managerId || user?.user_type !== "manager") {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const data = await fetchAllCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [isAuthenticated, managerId]);

  const createCampaign = async (data: Omit<Campaign, "id">) => {
    const newCampaign = await serviceCreateCampaign(data);
    await refresh();
    return newCampaign;
  };

  const updateCampaign = async (id: string, data: Partial<Campaign>) => {
    const updated = await serviceUpdateCampaign(id, data);
    await refresh();
    return updated;
  };

  const deleteCampaign = async (id: string) => {
    await serviceDeleteCampaign(id);
    await refresh();
  };

  return (
    <CampaignsContext.Provider value={{ campaigns, loading, refresh, createCampaign, updateCampaign, deleteCampaign }}>
      {children}
    </CampaignsContext.Provider>
  );
} 