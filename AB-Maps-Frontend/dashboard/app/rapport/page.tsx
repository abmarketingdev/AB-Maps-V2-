import ClientLayout from "../ClientLayout";
import { RapportView } from "@/components/dashboard/v2/RapportView";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <RapportView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
