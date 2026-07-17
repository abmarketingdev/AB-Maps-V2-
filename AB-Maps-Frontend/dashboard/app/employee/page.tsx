"use client";

/**
 * /employee — briefing is disabled for now; forward straight to the employee dashboard.
 * To re-enable the briefing, restore the commented render below.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
// import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
// import { EmployeeBriefingView } from "@/components/dashboard/v2/employee/EmployeeBriefingView";

export default function EmployeePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/employee/dashbord");
  }, [router]);

  return <div className="min-h-screen bg-ab-base" />;

  // ── Employee briefing (commented out for now) ─────────────────────────────
  // return (
  //   <ProtectedRoute requiredUserType="employee">
  //     <EmployeeBriefingView />
  //   </ProtectedRoute>
  // );
}
