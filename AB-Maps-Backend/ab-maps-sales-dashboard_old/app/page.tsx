import ClientLayout from "./ClientLayout";
import Dashboard from "../dashboard";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function Page() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <Dashboard />
      </ClientLayout>
    </ProtectedRoute>
  );
}
