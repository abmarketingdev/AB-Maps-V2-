"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
// Briefing landing is disabled for now — see the commented return below to re-enable.
// import { BriefingView } from "@/components/dashboard/v2/BriefingView";
// import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function Page() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Briefing is turned off for now: route users straight from "/" to the right place.
  //  - still resolving auth  → wait (blank splash)
  //  - not logged in         → /login   (was missing → root showed a blank page)
  //  - employee              → /employee (forwards to /employee/dashbord)
  //  - manager/admin         → /dashbord
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }
    router.replace(user.user_type === "employee" ? "/employee" : "/dashbord");
  }, [user, isAuthenticated, isLoading, router]);

  return <div className="min-h-screen bg-ab-base" />;

  // ── Briefing (commented out for now) ──────────────────────────────────────
  // return (
  //   <ProtectedRoute requiredUserType="manager">
  //     <BriefingView />
  //   </ProtectedRoute>
  // );
}
