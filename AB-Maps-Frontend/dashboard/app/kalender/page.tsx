import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { KalenderView } from "@/components/dashboard/kalender/KalenderView";

// Shift calendar + daily goals. Manager-level logins only (sales chief, team
// leader/co-leader, admin); promoters use /emp. Per-team rights (edit vs
// read-only) come from GET /api/scheduling/teams/ (`can_edit`), enforced by
// the backend on every write.
export default function Page() {
  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <KalenderView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
