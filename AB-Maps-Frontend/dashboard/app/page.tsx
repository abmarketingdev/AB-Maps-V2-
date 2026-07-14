"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BriefingView } from "@/components/dashboard/v2/BriefingView";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";

export default function Page() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Employees go straight to their own dashboard; the Briefing is for managers/admins.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.user_type === "employee") {
      router.push("/employee");
    }
  }, [user, isAuthenticated, isLoading, router]);

  // While auth resolves, or for an employee mid-redirect, don't mount the manager BriefingView
  // (it would call the manager-only /api/dashboard/briefing/ → 403 and flash a manager screen).
  if (isLoading || user?.user_type === "employee") {
    return <div className="min-h-screen bg-ab-base" />;
  }

  return (
    <ProtectedRoute requiredUserType="manager">
      <BriefingView />
    </ProtectedRoute>
  );
}
