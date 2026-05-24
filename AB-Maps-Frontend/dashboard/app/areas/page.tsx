"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { OmraderView } from "@/components/dashboard/v2/OmraderView";

export default function AreasPage() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <OmraderView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
