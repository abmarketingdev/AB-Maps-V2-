"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";

const LearningPlatform = () => {
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const authService = LearningAuthService.getInstance();
        
        // Run auth checks in parallel for faster response
        const [isAuthenticated, isSuperuser] = await Promise.all([
          authService.isAuthenticated(),
          authService.checkSuperuser().catch(() => false)
        ]);
        
        if (!isAuthenticated) {
          console.log("User not authenticated, redirecting to main login");
          // Redirect to main dashboard login if not authenticated
          window.location.href = "/login";
          return;
        }

        console.log("User authenticated, isSuperuser:", isSuperuser);

        // Redirect based on role
        if (isSuperuser) {
          console.log("Redirecting superuser to admin dashboard");
          router.push("/ab-academy/admin");
        } else {
          console.log("Redirecting regular user to learning dashboard");
          router.push("/ab-academy/oversikt");
        }
      } catch (error) {
        console.error("Authentication check error:", error);
        setError("Autentiseringsfeil. Vennligst logg inn på hoveddashboardet først.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 3000);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  if (isChecking) {
    return <LoadingState message="Sjekker tilgang…" />;
  }

  if (error) {
    return <ErrorState title="Ingen tilgang" message={`${error} Omdirigerer til innlogging…`} variant="warning" />;
  }

  return <LoadingState message="Åpner AB Academy…" />;
};

export default LearningPlatform;
