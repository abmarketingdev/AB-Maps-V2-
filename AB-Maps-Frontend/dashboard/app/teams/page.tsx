import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { SalgsorgView } from "@/components/dashboard/v2/SalgsorgView";

// Salgsorganisasjon (S-ORG): super admins + sales chiefs only. HR decides — team
// leaders get 403 → «Ingen tilgang»; employees are redirected by ProtectedRoute.
export default function Page() {
  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <SalgsorgView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
