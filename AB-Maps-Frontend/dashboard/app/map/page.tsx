"use client";

import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { AdminDemographicsMap } from "@/components/demographics-map/AdminDemographicsMap";

export default function MapPage() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="h-[calc(100vh-4rem)] w-full">
          <AdminDemographicsMap />
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
}
