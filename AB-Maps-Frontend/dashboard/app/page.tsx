"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { demoAuth } from "@/lib/auth/demoAuth";
// Briefing landing is disabled for now — see the commented return below to re-enable.
// import { BriefingView } from "@/components/dashboard/v2/BriefingView";
// import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function Page() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Briefing is turned off for now: route users straight from "/" to the right place.
  //  - DEMO MODE + no role picked → /demo (role picker)
  //  - still resolving auth  → wait (blank splash)
  //  - not logged in         → /login
  //  - employee              → /employee (forwards to /employee/dashbord)
  //  - manager/admin         → /dashbord
  useEffect(() => {
    // In demo mode, "/" ALWAYS routes to the role picker — even if a role
    // is already selected — so the boss can easily switch dashboards by just
    // hitting localhost:3000 in the URL bar.
    if (demoAuth.DEMO) {
      router.replace("/demo");
      return;
    }
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
