"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { AnalyticsView } from "@/components/dashboard/v2/AnalyticsView";

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <AnalyticsView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
