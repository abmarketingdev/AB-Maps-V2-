"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LearningAuthService } from "@/services/learningAuthService";
import LoadingState from "@/components/learning/LoadingState";
import { AcademyBrand, AcademyAvatar } from "@/components/learning/AcademyHeader";
import type { LearningUser } from "@/services/learningTypes";

const BREADCRUMB: Record<string, string> = {
  "/ab-academy/admin": "Oversikt",
  "/ab-academy/admin/sections": "Innhold",
  "/ab-academy/admin/lessons": "Leksjoner",
  "/ab-academy/admin/quizzes": "Quizzer",
  "/ab-academy/admin/users": "Brukere",
  "/ab-academy/admin/analytics": "Analyse",
  "/ab-academy/admin/courses/create": "Opprett kurs",
};

function getBreadcrumb(pathname: string): string {
  if (pathname === "/ab-academy/admin/lessons/new") return "Ny leksjon";
  if (pathname.startsWith("/ab-academy/admin/lessons/") && pathname !== "/ab-academy/admin/lessons")
    return "Rediger leksjon";
  if (pathname === "/ab-academy/admin/sections/new") return "Ny seksjon";
  if (pathname.match(/^\/ab-academy\/admin\/sections\/\d+$/)) return "Rediger seksjon";
  if (pathname === "/ab-academy/admin/courses/create") return "Opprett kurs";
  return BREADCRUMB[pathname] ?? "Admin";
}

export default function AdminLearningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userData, setUserData] = useState<LearningUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);

  useEffect(() => {
    const run = async () => {
      try {
        const auth = LearningAuthService.getInstance();
        const [ok, isSuper] = await Promise.all([
          auth.isAuthenticated(),
          auth.checkSuperuser().catch(() => false),
        ]);
        if (!ok) {
          router.push("/ab-academy/login");
          return;
        }
        if (!isSuper) {
          router.push("/ab-academy/oversikt");
          return;
        }
        const user = await auth.getCurrentUser();
        setUserData(user);
      } catch {
        router.push("/ab-academy/login");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router]);

  if (loading) {
    return <LoadingState message="Laster..." />;
  }

  const isOversikt = pathname === "/ab-academy/admin";
  const isBrukere = pathname.startsWith("/ab-academy/admin/users");
  const isAnalyse = pathname.startsWith("/ab-academy/admin/analytics");
  const isKurs = pathname.startsWith("/ab-academy/admin/courses");

  return (
    <div className="academy-light flex h-[100dvh] w-full overflow-hidden bg-[#F7F7F5] text-[#0A0A0A]">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-black/[0.08] bg-white overflow-y-auto">
        <div className="flex flex-col">
          <div className="flex flex-col gap-1.5 px-6 pb-5 pt-6">
            <AcademyBrand href="/ab-academy/admin" size="sm" />
            <p className="text-xs text-neutral-500">Adminpanel</p>
          </div>
          <nav className="space-y-1 px-4">
            <Link
              href="/ab-academy/admin"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isOversikt ? "bg-emerald-600 text-white" : "text-neutral-600 hover:bg-black/[0.04] hover:text-[#0A0A0A]"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isOversikt ? "icon-filled" : ""}`}>dashboard</span>
              <span className="text-sm font-medium">Oversikt</span>
            </Link>
            <div className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Administrasjon
            </div>
            <Link
              href="/ab-academy/admin/courses/create"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isKurs ? "bg-emerald-600 text-white" : "text-neutral-600 hover:bg-black/[0.04] hover:text-[#0A0A0A]"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isKurs ? "icon-filled" : ""}`}>school</span>
              <span className="text-sm font-medium">Opprett kurs</span>
            </Link>
            <Link
              href="/ab-academy/admin/users"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isBrukere ? "bg-emerald-600 text-white" : "text-neutral-600 hover:bg-black/[0.04] hover:text-[#0A0A0A]"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isBrukere ? "icon-filled" : ""}`}>group</span>
              <span className="text-sm font-medium">Brukere</span>
            </Link>
            <Link
              href="/ab-academy/admin/analytics"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isAnalyse ? "bg-emerald-600 text-white" : "text-neutral-600 hover:bg-black/[0.04] hover:text-[#0A0A0A]"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isAnalyse ? "icon-filled" : ""}`}>bar_chart</span>
              <span className="text-sm font-medium">Analyse</span>
            </Link>
            <div className="px-3 pb-2 pt-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-neutral-600 hover:bg-red-50 hover:text-red-600 transition-colors border border-black/[0.08] hover:border-red-200"
              >
                <span className="material-symbols-outlined text-[20px]">exit_to_app</span>
                <span className="text-sm font-medium">Avslutt AB Academy</span>
              </Link>
            </div>
          </nav>
        </div>
        <div className="border-t border-black/[0.08] p-4">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <AcademyAvatar name={userData?.first_name} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#0A0A0A]">
                {userData ? `${userData.first_name} ${userData.last_name}` : "Administrator"}
              </p>
              <p className="truncate text-xs text-neutral-500">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 md:h-16 shrink-0 items-center justify-between gap-3 border-b border-black/[0.08] bg-white px-4 md:px-6 z-10">
          <div className="md:hidden min-w-0">
            <AcademyBrand href="/ab-academy/admin" size="sm" />
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Link href="/ab-academy/admin" className="text-neutral-500 transition-colors hover:text-[#0A0A0A]">
              Hjem
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="font-medium text-[#0A0A0A]">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 text-[20px] text-neutral-400 -translate-y-1/2">search</span>
              <input
                className="h-9 w-48 rounded-lg border border-black/[0.08] bg-[#F7F7F5] pl-10 pr-4 text-sm transition-all placeholder:text-neutral-400 focus:border-emerald-500/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 md:w-64"
                placeholder="Søk kampanjer..."
                type="text"
              />
            </div>
            <div className="mx-2 hidden h-6 w-px bg-black/[0.08] sm:block" />
            <button
              type="button"
              className="relative rounded-lg p-2 text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-[#0A0A0A]"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-emerald-500" />
            </button>
          </div>
        </header>

        {/* Phone: the sidebar is hidden, so the admin sections become a scrollable tab strip */}
        <nav className="md:hidden flex shrink-0 gap-1 overflow-x-auto border-b border-black/[0.08] bg-white px-3 py-2" aria-label="AB Academy admin">
          {[
            { href: "/ab-academy/admin", label: "Oversikt", active: isOversikt },
            { href: "/ab-academy/admin/courses/create", label: "Opprett kurs", active: isKurs },
            { href: "/ab-academy/admin/users", label: "Brukere", active: isBrukere },
            { href: "/ab-academy/admin/analytics", label: "Analyse", active: isAnalyse },
            { href: "/", label: "Avslutt", active: false },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                item.active ? "bg-emerald-600 text-white" : "text-neutral-600 hover:bg-black/[0.04]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#F7F7F5]">
          {children}
        </div>
      </main>
    </div>
  );
}
