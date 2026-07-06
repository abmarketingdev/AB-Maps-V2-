"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { AdminDashboardView } from "@/components/dashboard/v2/AdminDashboardView";

// Admin dashboard — superusers/admins ONLY (never sales chiefs or plain managers).
export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allow={({ isSuperuser }) => isSuperuser}>
      <ClientLayout>
        <AdminDashboardView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
