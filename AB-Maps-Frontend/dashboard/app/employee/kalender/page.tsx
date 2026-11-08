"use client";

/**
 * /employee/kalender — «Min kalender» for promoters (client HTML, 06 Nov):
 * own work days with goals and numbers, ask to move a day, change the day's
 * goal. Leaders plan from /kalender. Data: /api/scheduling/week/ (own days
 * only, enforced by the backend).
 */

import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { EmployeeLayout } from "@/components/employee/EmployeeLayout";
import { MinKalenderView } from "@/components/dashboard/kalender/min/MinKalenderView";
import { useAuth } from "@/lib/auth/AuthContext";

export default function EmployeeKalenderPage() {
  const { user } = useAuth();
  const name = user?.user_info?.name || user?.username || "";
  return (
    <ProtectedRoute requiredUserType="employee">
      <EmployeeLayout>
        <MinKalenderView fallbackName={name} />
      </EmployeeLayout>
    </ProtectedRoute>
  );
}
