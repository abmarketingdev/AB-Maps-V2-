"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { AdminDashboardView } from "@/components/dashboard/v2/AdminDashboardView";

// Oversight page — superusers/admins (isSuperuser folds in admin) OR sales-chiefs; never plain managers.
export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allow={({ isSuperuser, isSalesChief }) => isSuperuser || isSalesChief}>
      <ClientLayout>
        <AdminDashboardView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
