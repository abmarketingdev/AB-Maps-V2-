"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { KampanjeView } from "@/components/dashboard/v2/KampanjeView";

export default function CampaignPage() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <KampanjeView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
