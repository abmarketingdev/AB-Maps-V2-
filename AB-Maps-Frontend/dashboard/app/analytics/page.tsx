"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { AnalyticsView } from "@/components/dashboard/v2/AnalyticsView";

// Analytics is restricted to admins/superusers and sales-chiefs. A plain manager
// (user_type='manager', is_sales_chief=false) and employees are blocked.
export default function AnalyticsPage() {
  return (
    <ProtectedRoute allow={({ isAdmin, isSalesChief }) => isAdmin || isSalesChief}>
      <ClientLayout>
        <AnalyticsView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
