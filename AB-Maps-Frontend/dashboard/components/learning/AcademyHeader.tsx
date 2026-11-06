"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * AB Academy brand block: the AB Marketing logo + «AB Academy». Used by every academy page
 * (learner header, admin sidebar, loading / error / splash screens) so the product reads as one.
 */
export function AcademyBrand({
  href,
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const logoH = size === "lg" ? "h-8" : size === "sm" ? "h-5" : "h-6";
  const text = size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-[15px]";
  const inner = (
    <span className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <Image src="/ab-logo.webp" alt="AB Marketing" width={120} height={32} className={cn(logoH, "w-auto object-contain shrink-0")} priority />
      <span className="h-5 w-px bg-black/15 shrink-0" aria-hidden="true" />
      <span className={cn(text, "font-semibold tracking-tight text-[#0A0A0A] whitespace-nowrap")}>
        AB <span className="text-emerald-600">Academy</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="AB Academy" className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Round initial avatar in the academy colour. */
export function AcademyAvatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <div
      className={cn(
        "h-8 w-8 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold uppercase",
        className
      )}
      aria-hidden="true"
    >
      {(name || "U").trim()[0] || "U"}
    </div>
  );
}

/**
 * The one AB Academy top bar (learner pages). Sticky, white, 56px on a phone / 64px on desktop.
 * `onBack` shows a back arrow (phone lesson view); `children` go in the middle (desktop nav);
 * `right` replaces the default avatar.
 */
export default function AcademyHeader({
  onBack,
  userName,
  right,
  children,
  className,
}: {
  onBack?: () => void;
  userName?: string | null;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 md:h-16 w-full shrink-0 items-center justify-between gap-3 border-b border-black/[0.08] bg-white/95 backdrop-blur px-3 md:px-6",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-black/[0.04] hover:text-[#0A0A0A] transition-colors"
            aria-label="Tilbake"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
        )}
        <AcademyBrand href="/ab-academy" size="md" className="max-md:[&_img]:h-5" />
        {children && <nav className="hidden md:flex items-center gap-1">{children}</nav>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{right ?? <AcademyAvatar name={userName} />}</div>
    </header>
  );
}

/** Desktop nav link/button for the academy header. */
export function AcademyNavButton({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "bg-emerald-50 text-emerald-700" : "text-neutral-600 hover:bg-black/[0.04] hover:text-[#0A0A0A]"
      )}
    >
      {children}
    </button>
  );
}
