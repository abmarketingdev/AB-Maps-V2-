import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { TeamsView } from "@/components/dashboard/v2/TeamsView";

// Manager/chief/admin only — employees are redirected (and backend returns 403).
export default function Page() {
  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <TeamsView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
