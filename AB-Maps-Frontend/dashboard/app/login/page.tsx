"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, User as UserIcon, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";
import { StatusPill, Roy } from "@/components/ui-ab";

const LoginPage: React.FC = () => {
  const [userType, setUserType] = useState<"manager" | "employee">("manager");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.user_type === "employee") {
        router.push("/employee");
      } else {
        router.push("/");
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Vennligst skriv inn både brukernavn og passord");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const loginResponse = await login({
        username: username.trim(),
        password: password.trim(),
        user_type: userType,
      });
      if (loginResponse.user_type === "employee") {
        router.push("/employee");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        setError("Ugyldig brukernavn eller passord. Vennligst prøv igjen.");
      } else if (err.message?.includes("403") || err.message?.includes("Forbidden")) {
        setError("Tilgang nektet. Vennligst sjekk dine tillatelser.");
      } else if (err.message?.includes("network") || err.message?.includes("fetch")) {
        setError("Kunne ikke koble til serveren. Vennligst sjekk internettforbindelsen din.");
      } else {
        setError(err.message || "Innlogging feilet. Vennligst prøv igjen.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ab-base">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-ab-line border-t-ab-accent animate-spin" />
          <p className="eyebrow">Sjekker autentisering…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ab-base text-ab-fg flex">
      {/* Left hero column */}
      <aside className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden border-r border-ab-line-1 bg-ab-canvas">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-ab-md bg-ab-accent/10 border border-ab-accent/30 flex items-center justify-center">
            <Image src="/abmarketing.png" alt="AB" width={22} height={22} className="object-contain" priority />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-ab-fg leading-none">AB Marketing</div>
            <div className="eyebrow mt-1">AB MAPS · v4.0</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <Roy state={loading ? "thinking" : "greeting"} size={88} className="mb-6 -ml-2" />
          <div className="eyebrow mb-3">Norsk dør-til-dør</div>
          <h2 className="font-display text-[40px] leading-[1.05] font-semibold tracking-tight text-ab-fg">
            Døren er din arbeidsplass.
          </h2>
          <p className="mt-4 text-[14px] text-ab-fg-2 leading-relaxed">
            Sanntidsoversikt over salgsteamene dine. Tildel områder, lås ned territorium, og se hvert salg etter hvert som det skjer.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "OMRÅDER", value: "342" },
              { label: "SELGERE", value: "11" },
              { label: "OPPETID", value: "99.98%" },
            ].map((s) => (
              <div key={s.label} className="ab-card p-3">
                <div className="eyebrow">{s.label}</div>
                <div className="mono text-[18px] font-semibold text-ab-fg mt-1">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <StatusPill tone="live">SYSTEMER NORMALE</StatusPill>
          <div className="text-[11px] text-ab-fg-4 mono">build · {new Date().getFullYear()}.05</div>
        </div>

        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--ab-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--ab-text-primary) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </aside>

      {/* Right form column */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 animate-ab-fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-ab-md bg-ab-accent/10 border border-ab-accent/30 flex items-center justify-center">
              <Image src="/abmarketing.png" alt="AB" width={18} height={18} className="object-contain" />
            </div>
            <span className="text-[13px] font-semibold">AB Marketing</span>
          </div>

          <div>
            <div className="eyebrow">Logg inn</div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-ab-fg mt-1">
              Velkommen tilbake
            </h1>
            <p className="text-[13px] text-ab-fg-2 mt-1.5">
              Få tilgang til AB Maps dashbordet ditt.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
              Kontotype
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-ab-elevated border border-ab-line rounded-ab-md">
              {(["manager", "employee"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setUserType(t)}
                  disabled={loading}
                  className={cn(
                    "h-8 text-[12px] font-medium rounded-[4px] transition-colors",
                    userType === t ? "bg-ab-hover text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg",
                  )}
                >
                  {t === "manager" ? "Leder" : "Ansatt"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
              Brukernavn
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="brukernavn"
                disabled={loading}
                autoFocus
                required
                className="ab-input"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
              Passord
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
                className="ab-input"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-ab-md border border-[rgba(224,128,112,0.18)] bg-ab-danger-bg text-ab-danger text-[12px]">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className={cn(
              "ab-btn primary lg w-full justify-center",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-[var(--ab-text-on-accent)]/40 border-t-[var(--ab-text-on-accent)] animate-spin" />
                <span>Logger inn…</span>
              </>
            ) : (
              <>Logg inn <span className="kbd">↵</span></>
            )}
          </button>

          <p className="text-[11px] text-ab-fg-3 text-center">
            Har du problemer? Kontakt systemadministratoren din.
          </p>
        </form>
      </main>
    </div>
  );
};

export default LoginPage;
