import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import SalesChiefTeamScreen from "@/components/sales-chief/SalesChiefTeamScreen";

export default function Page() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <SalesChiefTeamScreen />
      </ClientLayout>
    </ProtectedRoute>
  );
}
