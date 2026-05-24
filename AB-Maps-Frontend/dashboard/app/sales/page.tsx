import ClientLayout from "../ClientLayout";
import { SalesActivityView } from "@/components/dashboard/v2/SalesActivityView";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <SalesActivityView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
