"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { AdminDashboardView } from "@/components/dashboard/v2/AdminDashboardView";

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <AdminDashboardView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
