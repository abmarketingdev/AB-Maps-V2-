"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import { Roy } from "@/components/ui-ab";
import { confirmPasswordReset } from "@/lib/api/passwordReset";
import { cn } from "@/lib/utils";

type Phase = "form" | "submitting" | "success" | "invalid";

// Rotating dashed ring around Roy (same flourish as the login loader).
function RoyRing({ state, size = 132 }: { state: "greeting" | "thinking" | "win-big" | "concerned"; size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <Roy state={state} size={size} />
      <svg width={size + 56} height={size + 56} className="pointer-events-none absolute" style={{ left: -28, top: -28 }} aria-hidden>
        <circle cx={(size + 56) / 2} cy={(size + 56) / 2} r={size / 2 + 16} fill="none"
          stroke="var(--ab-accent-9, #00A2C7)" strokeWidth="1.5" strokeDasharray="3 6" opacity="0.4"
          style={{ transformOrigin: "center", animation: "ab-spin-slow 8s linear infinite" }} />
      </svg>
    </div>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [phase, setPhase] = useState<Phase>(uid && token ? "form" : "invalid");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setFieldErrors([]);
    if (pw.length < 8) { setFieldErrors(["Passordet må være minst 8 tegn."]); return; }
    if (pw !== confirm) { setError("Passordene er ikke like."); return; }
    setPhase("submitting");
    const res = await confirmPasswordReset({ uid, token, new_password: pw });
    if (res.ok) {
      setPhase("success");
      redirectTimer.current = setTimeout(() => router.push("/login"), 2800);
      return;
    }
    // 400 — invalid/expired link vs weak password
    if (res.fieldErrors && res.fieldErrors.length) {
      setFieldErrors(res.fieldErrors);
      setError(res.error || "Passordet er for svakt.");
      setPhase("form");
    } else if (/ugyldig|utløpt|invalid|expired/i.test(res.error || "") || res.status === 400) {
      setPhase("invalid");
    } else {
      setError(res.error || "Noe gikk galt. Prøv igjen.");
      setPhase("form");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ab-base p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(circle at 50% 35%, rgba(0,162,199,0.08) 0%, transparent 60%)" }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(var(--ab-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--ab-text-primary) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md rounded-ab-lg border border-ab-line bg-ab-canvas p-8 shadow-2xl">
        <AnimatePresence mode="wait">
          {/* ── Invalid / expired link ── */}
          {phase === "invalid" && (
            <motion.div key="invalid" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center space-y-5">
              <RoyRing state="concerned" />
              <div>
                <div className="eyebrow mb-1 flex items-center justify-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-ab-danger" /> Ugyldig lenke</div>
                <h1 className="font-display text-[24px] font-semibold tracking-tight text-ab-fg">Ugyldig eller utløpt lenke</h1>
                <p className="text-[13px] text-ab-fg-2 mt-2 leading-relaxed">
                  Lenken for tilbakestilling er ikke lenger gyldig. Den varer i 48 timer og kan bare brukes én gang. Be om en ny for å fortsette.
                </p>
              </div>
              <button onClick={() => router.push("/login")} className="ab-btn primary lg w-full justify-center cursor-pointer">
                Be om ny lenke
              </button>
            </motion.div>
          )}

          {/* ── Success ── */}
          {phase === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center space-y-5">
              <RoyRing state="win-big" />
              <div>
                <div className="eyebrow mb-1 flex items-center justify-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-ab-success" /> Fullført</div>
                <h1 className="font-display text-[24px] font-semibold tracking-tight text-ab-fg">Passordet er oppdatert</h1>
                <p className="text-[13px] text-ab-fg-2 mt-2 leading-relaxed">Du kan nå logge inn med det nye passordet ditt. Sender deg til innlogging…</p>
              </div>
              <button onClick={() => router.push("/login")} className="ab-btn primary lg w-full justify-center cursor-pointer">
                Til innlogging
              </button>
            </motion.div>
          )}

          {/* ── Form / submitting ── */}
          {(phase === "form" || phase === "submitting") && (
            <motion.div key="form" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <RoyRing state={phase === "submitting" ? "thinking" : "greeting"} size={108} />
              <div className="text-center mt-4 mb-6">
                <div className="eyebrow">Tilbakestill passord</div>
                <h1 className="font-display text-[26px] font-semibold tracking-tight text-ab-fg mt-1">Lag et nytt passord</h1>
                <p className="text-[13px] text-ab-fg-2 mt-1.5">Velg et sterkt passord du ikke bruker andre steder.</p>
              </div>
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">Nytt passord</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
                    <input type={showPw ? "text" : "password"} value={pw} onChange={(e) => { setPw(e.target.value); setFieldErrors([]); }} placeholder="Min. 8 tegn" required className="ab-input" style={{ paddingLeft: 36, paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowPw(s => !s)} className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-ab-fg-3 hover:text-ab-fg">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {fieldErrors.map((f, i) => <li key={i} className="text-[11px] text-ab-danger flex items-start gap-1"><span>•</span>{f}</li>)}
                    </ul>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">Bekreft passord</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
                    <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Skriv passordet på nytt" required className="ab-input" style={{ paddingLeft: 36 }} />
                  </div>
                  {confirm && pw !== confirm && <p className="text-[11px] text-ab-danger mt-1">Passordene er ikke like.</p>}
                </div>
                {error && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-ab-md border border-[rgba(224,128,112,0.18)] bg-ab-danger-bg text-ab-danger text-[12px]">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
                  </div>
                )}
                <button type="submit" disabled={phase === "submitting" || !pw || !confirm} className={cn("ab-btn primary lg w-full justify-center cursor-pointer", "disabled:opacity-50 disabled:cursor-not-allowed")}>
                  {phase === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Oppdaterer…</> : "Oppdater passord"}
                </button>
                <button type="button" onClick={() => router.push("/login")} className="cursor-pointer mx-auto flex items-center gap-1.5 text-[12px] font-medium text-ab-fg-3 hover:text-ab-fg">
                  <ArrowLeft className="h-3.5 w-3.5" /> Tilbake til innlogging
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ab-base"><Loader2 className="h-6 w-6 animate-spin text-ab-fg-3" /></div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
