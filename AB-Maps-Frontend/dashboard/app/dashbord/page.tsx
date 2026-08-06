"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ClientLayout from "../ClientLayout";
import { SalgslederDashboard } from "@/components/dashboard/leader/SalgslederDashboard";
import { AdminDashboard } from "@/components/dashboard/leader/AdminDashboard";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";

// Role-branched dashboard entry (2026-08-06 — 3-dashboard model).
//   admin / superuser → AdminDashboard (Salgssjefer hierarchical grouping)
//   sales chief / manager / team lead → SalgslederDashboard (flat teams they own)
//   employee → redirect to /employee (PromoterDashboard)
function DashbordSwitch() {
  const { isSuperuser } = useAuth();
  return isSuperuser ? <AdminDashboard /> : <SalgslederDashboard />;
}

export default function Page() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.user_type === "employee") {
      router.push("/employee");
    }
  }, [user, isAuthenticated, isLoading, router]);

  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <DashbordSwitch />
      </ClientLayout>
    </ProtectedRoute>
  );
}
