"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { SalgssjefTeamView } from "@/components/dashboard/v2/SalgssjefTeamView";

export default function Page() {
  return (
    <ProtectedRoute allow={({ isSuperuser, isSalesChief }) => isSuperuser || isSalesChief}>
      <ClientLayout>
        <SalgssjefTeamView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
