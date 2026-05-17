"use client";

import React, { useState, useEffect, ReactNode, createContext, useContext } from "react";
import CampaignSelectionModal from "./CampaignSelectionModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePathname } from "next/navigation";

interface CampaignGuardProps {
  children: ReactNode;
}

// Routes that don't require campaign selection
const BYPASS_ROUTES = [
  '/campaigns',
  '/areas',
  '/login',
  '/unauthorized'
];

export default function CampaignGuard({ children }: CampaignGuardProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isAuthenticated) {
      checkCampaignSelection();
    }
  }, [isAuthenticated]);

  const checkCampaignSelection = () => {
    const storedCampaign = localStorage.getItem('currentCampaign');
    if (storedCampaign) {
      try {
        const campaign = JSON.parse(storedCampaign);
        setSelectedCampaign(campaign);
        setShowModal(false);
      } catch (error) {
        console.error('Error parsing stored campaign:', error);
        localStorage.removeItem('currentCampaign');
        // Don't show modal automatically - let user select from navbar
        setShowModal(false);
      }
    } else {
      // Don't show modal automatically - let user select from navbar
      setShowModal(false);
    }
  };

  const handleCampaignSelect = (campaign: any) => {
    setSelectedCampaign(campaign);
    setShowModal(false);
  };

  const handleChangeCampaign = () => {
    setShowModal(true);
  };

  // If not authenticated, render children (allow login page to show)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Always render children with campaign context, regardless of campaign selection
  // Users can select campaign from navbar when needed
  return (
    <>
      {/* Campaign Selection Modal - only shown when explicitly requested */}
      <CampaignSelectionModal
        open={showModal}
        onCampaignSelect={handleCampaignSelect}
      />
      
      {/* Campaign Context Provider - Always provide context */}
      <CampaignContext.Provider value={{ 
        selectedCampaign, 
        changeCampaign: handleChangeCampaign 
      }}>
        {children}
      </CampaignContext.Provider>
    </>
  );
}

// Create a context for the selected campaign
interface CampaignContextType {
  selectedCampaign: any;
  changeCampaign: () => void;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export const useSelectedCampaign = () => {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useSelectedCampaign must be used within a CampaignGuard');
  }
  return context;
}; 