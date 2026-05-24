import ClientLayout from "../ClientLayout";
import { StatistikkView } from "@/components/dashboard/v2/StatistikkView";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <StatistikkView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
