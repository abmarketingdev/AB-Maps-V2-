"use client";

/**
 * /employee — standalone post-login Briefing for salespeople (no sidebar).
 * Mirrors the manager's `/` Briefing. The dense gamified dashboard lives at
 * /employee/dashbord (reached via the "Gå til dashbord" button). MOCK DATA.
 */

import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { EmployeeBriefingView } from "@/components/dashboard/v2/employee/EmployeeBriefingView";

export default function EmployeePage() {
  return (
    <ProtectedRoute requiredUserType="employee">
      <EmployeeBriefingView />
    </ProtectedRoute>
  );
}
