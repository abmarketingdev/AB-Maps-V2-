"use client";

// S-SSO (11.11): landing page for «Admin dashboard» in the HR menu. HR opens
// /sso?code=<one-time 60 s code>; we strip the code from the address bar at once,
// exchange it with auth for a normal maps session (same body as a password login),
// store it like the login page does, and go to /admin-dashboard. The admin-dashboard
// gate (ProtectedRoute isSuperuser) still decides on its own.

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { authService } from "@/lib/auth/authService";

export default function SsoPage() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The code works once: never exchange twice (React strict mode runs effects twice).
    if (started.current) return;
    started.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code") || "";
    // Remove the code from the address bar and history before anything else.
    window.history.replaceState(null, "", "/sso");

    if (!code) {
      setError("Lenken mangler innloggingskode. Åpne Admin dashboard fra HR-menyen på nytt.");
      return;
    }
    authService
      .exchangeHandoffCode(code)
      .then(() => {
        // Full navigation so AuthContext re-hydrates from the stored session.
        window.location.replace("/admin-dashboard");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error && e.message ? e.message : "Innloggingen fra HR feilet.");
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="sso-page">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        {error ? (
          <>
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" aria-hidden />
            <h1 className="text-base font-semibold mb-2">Kunne ikke logge inn fra HR</h1>
            <p className="text-sm text-muted-foreground mb-4" data-testid="sso-error">{error}</p>
            <a href="/login" className="text-sm font-medium underline">Logg inn på maps</a>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Logger deg inn på admin-dashbordet …</p>
          </>
        )}
      </div>
    </main>
  );
}
