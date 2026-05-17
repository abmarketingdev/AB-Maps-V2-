"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAuthService } from "@/lib/auth/adminAuthService";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Info,
  Loader2,
} from "lucide-react";

const ADMIN_DASHBOARD_MAIN = "/admin-dashboard/admin-main-dashboard";

const AdminDashboardLogin: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminAuthService.login({ username, password });
      router.push(ADMIN_DASHBOARD_MAIN);
    } catch (err: any) {
      setError(err.message || "Innlogging feilet");
      setLoading(false);
    }
  };

  const disabled = loading || !username.trim() || !password.trim();

  return (
    <div className="relative min-h-screen bg-ab-base text-ab-fg grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] overflow-hidden">
      {/* Dotted-grid background pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent 70%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black, transparent 70%)",
        }}
      />

      {/* LEFT — brand/atmosphere panel (desktop only) */}
      <aside
        aria-hidden
        className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-ab-accent/[0.10] via-ab-accent/[0.04] to-transparent dark:from-ab-accent/[0.14] dark:via-ab-accent/[0.06] dark:to-transparent border-r border-ab-line-1"
      >
        {/* Atmospheric top-left glow */}
        <span className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-ab-accent/[0.12] dark:bg-ab-accent/[0.18] blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <span className="text-[22px] tracking-[0.18em] font-medium text-ab-fg">AB</span>
          <span className="text-[22px] text-ab-fg-3">|</span>
          <span className="text-[22px] tracking-[0.18em] font-medium text-ab-fg">
            MARKETING
          </span>
        </div>

        {/* Middle copy */}
        <div className="relative z-10 max-w-[440px]">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
            PLATTFORM · INNLOGGING
          </div>
          <h2 className="mt-2 text-[32px] font-semibold tracking-tight text-ab-fg leading-tight">
            Velkommen tilbake.
          </h2>
          <p className="mt-3 text-[14px] text-ab-fg-2 leading-relaxed max-w-[340px]">
            Logg inn for å administrere brukere, kampanjer og områder på AB
            Marketing-plattformen.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 flex items-center justify-between">
          <ul className="space-y-2">
            {[
              "Sanntids analyse og innsikt",
              "Full kontroll over salgsteamet",
              "Sikker tilgangsstyring",
            ].map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 text-[12px] text-ab-fg-2"
              >
                <span className="h-4 w-4 rounded-full inline-flex items-center justify-center bg-ab-success/15 text-ab-success">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                {label}
              </li>
            ))}
          </ul>
          <span className="text-[11px] text-ab-fg-3 self-end">
            © AB Marketing {new Date().getFullYear()}
          </span>
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="relative flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px] lg:bg-transparent bg-ab-elevated lg:border-0 border border-ab-line rounded-2xl lg:rounded-none lg:shadow-none shadow-sm p-8 lg:p-0 mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <span className="text-[18px] tracking-[0.18em] font-medium text-ab-fg">AB</span>
            <span className="text-[18px] text-ab-fg-3">|</span>
            <span className="text-[18px] tracking-[0.18em] font-medium text-ab-fg">
              MARKETING
            </span>
          </div>

          {/* Header */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
              ADMIN-INNLOGGING
            </div>
            <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-ab-fg">
              Logg inn
            </h1>
            <p className="mt-1.5 text-[13px] text-ab-fg-2">
              Få tilgang til AB Maps admin dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-[12px] font-medium text-ab-fg-2 mb-1.5"
              >
                Brukernavn
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Skriv inn brukernavn"
                disabled={loading}
                autoFocus
                required
                className="ab-input h-11 w-full text-[15px] rounded-lg bg-ab-canvas border-ab-line focus:border-ab-accent focus:ring-2 focus:ring-ab-accent/20 transition-colors"
                style={{ paddingLeft: 14 }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-[12px] font-medium text-ab-fg-2 mb-1.5"
              >
                Passord
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Skriv inn passord"
                  disabled={loading}
                  required
                  className="ab-input h-11 w-full text-[15px] rounded-lg bg-ab-canvas border-ab-line focus:border-ab-accent focus:ring-2 focus:ring-ab-accent/20 transition-colors"
                  style={{ paddingLeft: 14, paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Skjul passord" : "Vis passord"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="bg-ab-danger/[0.06] border border-ab-danger/25 text-ab-danger rounded-md px-3 py-2.5 text-[12px] flex items-start gap-2 animate-ab-fade-in"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={disabled}
              className={cn(
                "h-11 w-full rounded-lg bg-ab-accent text-ab-on-accent font-medium text-[14px]",
                "transition-all duration-150",
                "hover:bg-ab-accent/90 active:scale-[0.99]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ab-base",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "inline-flex items-center justify-center gap-2",
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logger inn…
                </>
              ) : (
                <>
                  Logg inn
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Helper line */}
          <div className="mt-6 flex items-start gap-2 text-[12px] text-ab-fg-3">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>Har du problemer? Kontakt systemadministratoren din.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardLogin;
