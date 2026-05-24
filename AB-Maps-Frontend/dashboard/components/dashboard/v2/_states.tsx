"use client";

/**
 * Shared loading / empty / error panels for live-data views. Used instead of
 * mock fallbacks so an empty/erroring backend is visibly empty (not faked).
 */

import { Loader2, Inbox, AlertTriangle } from "lucide-react";

export function PanelLoading({ label = "Laster…", className }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className ?? ""}`}>
      <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      <p className="text-sm text-white/40">{label}</p>
    </div>
  );
}

export function PanelEmpty({ msg = "Ingen data", sub, className }: { msg?: string; sub?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-16 text-center ${className ?? ""}`}>
      <Inbox className="h-7 w-7 text-white/15" />
      <p className="text-sm text-white/40">{msg}</p>
      {sub && <p className="text-xs text-white/25">{sub}</p>}
    </div>
  );
}

export function PanelError({ onRetry, msg = "Kunne ikke laste data", className }: { onRetry?: () => void; msg?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className ?? ""}`}>
      <AlertTriangle className="h-7 w-7 text-rose-400/70" />
      <p className="text-sm text-white/50">{msg}</p>
      {onRetry && (
        <button onClick={onRetry} className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:border-white/20 transition-all">
          Prøv igjen
        </button>
      )}
    </div>
  );
}
