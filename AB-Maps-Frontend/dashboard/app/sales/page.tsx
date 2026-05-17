import ClientLayout from "../ClientLayout";
import SalesScreen from "../../sales-screen";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <SalesScreen />
      </ClientLayout>
    </ProtectedRoute>
  );
}
