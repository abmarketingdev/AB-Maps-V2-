"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ClientLayout from "../ClientLayout";
import { SalgslederDashboard } from "@/components/dashboard/leader/SalgslederDashboard";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";

// Role-branched dashboard entry.
//   All non-employee roles (manager / admin / superuser / sales_chief) →
//   SalgslederDashboard (the redesigned team-leader view).
//   Employees are redirected to /employee below (unchanged behaviour).
//   The old <Dashboard /> fallback is intentionally NOT wired here anymore
//   — boss decision 2026-08-05 to collapse all 4 non-employee roles to
//   the same view. Old import kept OUT of this file so the fallback bundle
//   isn't shipped; if we ever need it back, re-import "../../dashboard".
function DashbordSwitch() {
  return <SalgslederDashboard />;
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
