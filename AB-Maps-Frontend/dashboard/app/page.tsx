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

  return (
    <ProtectedRoute requiredUserType="manager">
      <BriefingView />
    </ProtectedRoute>
  );
}
