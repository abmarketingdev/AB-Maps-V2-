import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function KalenderLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <ClientLayout>{children}</ClientLayout>
    </ProtectedRoute>
  );
}
