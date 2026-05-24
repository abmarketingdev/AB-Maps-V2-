"use client";

/**
 * /employee/dashbord — the gamified daily dashboard inside the employee shell.
 * MOCK DATA. AB Maps + AB Academy in EmployeeLayout are untouched.
 */

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { EmployeeLayout } from "@/components/employee/EmployeeLayout";
import { EmployeeDashboardView } from "@/components/dashboard/v2/employee/EmployeeDashboardView";

export default function EmployeeDashbordPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  // Pick up the locally stored campaign (set by the sidebar selector) without
  // hitting the backend — mock-friendly.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("currentCampaign");
      if (stored) setSelectedCampaign(JSON.parse(stored));
    } catch {}
  }, []);

  return (
    <ProtectedRoute requiredUserType="employee">
      <EmployeeLayout
        selectedCampaign={selectedCampaign}
        onCampaignSelect={setSelectedCampaign}
      >
        <EmployeeDashboardView />
      </EmployeeLayout>
    </ProtectedRoute>
  );
}
