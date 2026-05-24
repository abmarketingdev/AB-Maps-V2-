"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { AddAddressView } from "@/components/dashboard/v2/AddAddressView";

export default function UploadedAddressesPage() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <AddAddressView />
      </ClientLayout>
    </ProtectedRoute>
  );
}
