"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ClientLayout from "./ClientLayout";
import Dashboard from "../dashboard";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";

export default function Page() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Redirect employees to their dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.user_type === "employee") {
        console.log("Employee detected on root page, redirecting to /employee");
        router.push("/employee");
      }
    }
  }, [user, isAuthenticated, isLoading, router]);

  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <Dashboard />
      </ClientLayout>
    </ProtectedRoute>
  );
}
