"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, User as UserIcon, AlertCircle, Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";
import { StatusPill, Roy } from "@/components/ui-ab";
import { requestPasswordReset } from "@/lib/api/passwordReset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Phase = "login" | "auth" | "loading";

const LoginPage: React.FC = () => {
  const [userType, setUserType] = useState<"manager" | "employee">("manager");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("login");
  const [progress, setProgress] = useState(0);
  // Forgot-password sub-view
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const targetRef = useRef<string>("/");

  useEffect(() => {
    if (!authLoading && isAuthenticated && user && phase === "login") {
      router.push(user.user_type === "employee" ? "/employee" : "/");
    }
  }, [isAuthenticated, authLoading, user, router, phase]);

  // ─── Progress driver for the loading phase ───
  useEffect(() => {
    if (phase !== "loading") return;
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 7 + Math.random() * 9);
      setProgress(Math.round(p));
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => router.push(targetRef.current), 350);
      }
    }, 110);
    return () => clearInterval(iv);
  }, [phase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Vennligst skriv inn både brukernavn og passord");
      return;
    }
    setError("");
    setPhase("auth");
    try {
      const response = await login({
        username: username.trim(),
        password: password.trim(),
        user_type: userType,
      });
      targetRef.current = response.user_type === "employee" ? "/employee" : "/";
      // brief "Autentiserer…" beat then move to the progress loader
      setTimeout(() => setPhase("loading"), 700);
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err?.message || "Innlogging feilet. Vennligst prøv igjen.");
      setPhase("login");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!EMAIL_RE.test(forgotEmail.trim())) { setForgotError("Skriv inn en gyldig e-postadresse."); return; }
    setForgotSending(true);
    const res = await requestPasswordReset(forgotEmail.trim());
    setForgotSending(false);
    if (res.rateLimited) { setForgotError(res.message); return; }
    setForgotSent(true);
  };
  const backToLogin = () => { setMode("login"); setForgotSent(false); setForgotError(""); setForgotEmail(""); };

  // ───────────────────────────────────────────────────────────────────────
  // Auth-checking spinner on first mount (before user state hydrates)
  // ───────────────────────────────────────────────────────────────────────
  if (authLoading && phase === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ab-base">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-ab-line border-t-ab-accent animate-spin" />
          <p className="eyebrow">Sjekker autentisering…</p>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // LOADING SCREEN — Roy mascot + progress bar + step list (from redesign)
  // ───────────────────────────────────────────────────────────────────────
  if (phase === "auth" || phase === "loading") {
    const steps = [
      { l: "Verifiserer legitimasjon", done: progress > 5 || phase === "loading" },
      { l: "Henter Oslo Øst-data", done: progress > 35 },
      { l: "Synkroniserer salg & ruter", done: progress > 65 },
      { l: "Klargjør dashbord", done: progress > 90 },
    ];
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-ab-canvas">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 40%, rgba(0,162,199,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex w-[340px] flex-col items-center gap-6">
          {/* Roy + rotating dashed ring */}
          <div className="relative">
            <Roy state={phase === "auth" ? "thinking" : "ready"} size={140} />
            <svg
              width="200"
              height="200"
              className="pointer-events-none absolute -left-[30px] -top-[30px]"
              aria-hidden
            >
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="var(--ab-accent-9, #00A2C7)"
                strokeWidth="1.5"
                strokeDasharray="3 6"
                opacity="0.4"
                style={{
                  transformOrigin: "100px 100px",
                  animation: "ab-spin-slow 8s linear infinite",
                }}
              />
            </svg>
          </div>

          {/* Heading */}
          <div className="text-center">
            <div className="font-display text-[18px] font-semibold tracking-tight text-ab-fg">
              {phase === "auth" ? "Autentiserer…" : "Klargjør arbeidsdagen"}
            </div>
            <div className="mono mt-1 text-[11px] text-ab-fg-3">
              {username}@ab-marketing.no
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-ab-elevated">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, var(--ab-accent-9, #00A2C7), var(--ab-accent-11, #4DD0E1))",
                transition: "width 220ms cubic-bezier(0.33, 1, 0.68, 1)",
                boxShadow: "0 0 12px rgba(0,162,199,0.6)",
              }}
            />
          </div>

          {/* Step list */}
          <div className="flex w-full flex-col gap-2">
            {steps.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 text-[12px] transition-opacity"
                style={{
                  color: s.done ? "var(--ab-fg-2, #c8d0db)" : "var(--ab-fg-4, #6b7484)",
                  opacity: s.done ? 1 : 0.6,
                }}
              >
                <div
                  className="flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all"
                  style={{
                    border: `1.5px solid ${s.done ? "var(--ab-accent-9, #00A2C7)" : "var(--ab-line, #2a3340)"}`,
                    background: s.done ? "var(--ab-accent-9, #00A2C7)" : "transparent",
                    color: "#06181F",
                  }}
                >
                  {s.done && "✓"}
                </div>
                {s.l}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ───────────────────────────────────────────────────────────────────────
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
          <Roy state="greeting" size={96} className="mb-6 -ml-2" />
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
          <StatusPill tone="live">LIVE</StatusPill>
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
        {mode === "forgot" ? (
          <div className="w-full max-w-sm space-y-6 animate-ab-fade-in">
            <button type="button" onClick={backToLogin} className="cursor-pointer flex items-center gap-1.5 text-[12px] font-medium text-ab-fg-3 hover:text-ab-fg">
              <ArrowLeft className="h-3.5 w-3.5" /> Tilbake til innlogging
            </button>
            {forgotSent ? (
              <div className="text-center space-y-4 py-4">
                <Roy state="win-small" size={96} className="mx-auto" />
                <div>
                  <div className="eyebrow mb-1">Sjekk innboksen</div>
                  <h1 className="font-display text-[24px] font-semibold tracking-tight text-ab-fg">Sjekk innboksen din</h1>
                  <p className="text-[13px] text-ab-fg-2 mt-2 leading-relaxed">
                    Hvis det finnes en konto med <span className="text-ab-fg">{forgotEmail}</span>, har vi sendt en lenke for å tilbakestille passordet. Lenken er gyldig i 48 timer.
                  </p>
                </div>
                <button type="button" onClick={backToLogin} className="ab-btn primary lg w-full justify-center cursor-pointer">
                  Tilbake til innlogging
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-6">
                <div>
                  <div className="eyebrow">Tilbakestill passord</div>
                  <h1 className="font-display text-[28px] font-semibold tracking-tight text-ab-fg mt-1">Glemt passord?</h1>
                  <p className="text-[13px] text-ab-fg-2 mt-1.5">
                    Skriv inn e-posten din, så sender vi en lenke for å lage et nytt passord.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">E-post</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
                    <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="navn@firma.no" autoFocus required className="ab-input" style={{ paddingLeft: 36 }} />
                  </div>
                </div>
                {forgotError && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-ab-md border border-[rgba(224,128,112,0.18)] bg-ab-danger-bg text-ab-danger text-[12px]">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{forgotError}</span>
                  </div>
                )}
                <button type="submit" disabled={forgotSending || !forgotEmail.trim()} className="ab-btn primary lg w-full justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {forgotSending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sender…</> : "Send lenke"}
                </button>
              </form>
            )}
          </div>
        ) : (
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
              Logg inn med brukernavnet og passordet ditt.
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
                  className={cn(
                    "h-8 text-[12px] font-medium rounded-[4px] transition-colors cursor-pointer",
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
                autoFocus
                required
                className="ab-input"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
                Passord
              </label>
              <button type="button" onClick={() => setMode("forgot")} className="cursor-pointer text-[11px] font-medium text-ab-accent hover:underline">
                Glemt passord?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            disabled={!username.trim() || !password.trim()}
            className={cn(
              "ab-btn primary lg w-full justify-center cursor-pointer",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            Logg inn <span className="kbd">↵</span>
          </button>

          <p className="text-[11px] text-ab-fg-3 text-center">
            AB Marketing · AB Maps
          </p>
        </form>
        )}
      </main>
    </div>
  );
};

export default LoginPage;
