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

  // React to campaign switches from ANY picker in the app.
  // CampaignPicker dispatches `ab:campaign-changed` when the user picks a
  // campaign in the sidebar; the storage event fires when a sibling tab
  // updates localStorage. Without these listeners the guard's selectedCampaign
  // state stays stale — my consumers (Salgsleder team panel, Topplister) then
  // scope to the OLD campaign, showing e.g. NORSK teams under CARE (reported
  // 2026-08-05). See fix commit for details.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onCampaignChanged = () => checkCampaignSelection();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "currentCampaign") checkCampaignSelection();
    };
    window.addEventListener("ab:campaign-changed", onCampaignChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ab:campaign-changed", onCampaignChanged);
      window.removeEventListener("storage", onStorage);
    };
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

export const useSelectedCampaign = (): CampaignContextType => {
  const context = useContext(CampaignContext);
  // Return safe defaults when the provider isn't in the tree — happens
  // during Next.js SSG prerender (CampaignGuard returns children without
  // the provider when isAuthenticated is false, which it is at build time)
  // and on routes that bypass the guard. Runtime consumers still get the
  // real context because CampaignGuard mounts before any authenticated
  // page renders.
  return context ?? { selectedCampaign: null, changeCampaign: () => {} };
}; 