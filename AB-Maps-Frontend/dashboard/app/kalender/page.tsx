import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { TeamKalenderView } from "@/components/dashboard/kalender/team/TeamKalenderView";

// Teamkalender (client design 08 Nov): work days, daily goals, no-shows and
// move requests per team. Manager-level logins only (sales chief, team
// leader/co-leader, admin); promoters use /employee/kalender. Per-team rights
// (edit vs read-only) come from GET /api/scheduling/teams/ (`can_edit`),
// enforced by the backend on every write.
export default function Page() {
  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <TeamKalenderView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
