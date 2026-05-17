"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LearningAuthService } from "@/services/learningAuthService";

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
          router.push("/admin-dashboard-learning");
        } else {
          console.log("Redirecting regular user to learning dashboard");
          router.push("/learning-dashboard");
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/abmarketing.png"
            alt="AB Academy Logo"
            width={180}
            height={48}
            className="object-contain mx-auto mb-6"
          />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Sjekker autentisering...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/abmarketing.png"
            alt="AB Academy Logo"
            width={180}
            height={48}
            className="object-contain mx-auto mb-6"
          />
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <p className="text-gray-600">Omdirigerer til hovedinnlogging...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default LearningPlatform;
