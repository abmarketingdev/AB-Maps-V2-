"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LearningAuthService } from "@/services/learningAuthService";
import LoadingState from "@/components/learning/LoadingState";
import type { LearningUser } from "@/services/learningTypes";

const BREADCRUMB: Record<string, string> = {
  "/admin-dashboard-learning": "Oversikt",
  "/admin-dashboard-learning/sections": "Innhold",
  "/admin-dashboard-learning/lessons": "Leksjoner",
  "/admin-dashboard-learning/quizzes": "Quizzer",
  "/admin-dashboard-learning/users": "Brukere",
  "/admin-dashboard-learning/analytics": "Analyse",
  "/admin-dashboard-learning/courses/create": "Opprett kurs",
};

function getBreadcrumb(pathname: string): string {
  if (pathname === "/admin-dashboard-learning/lessons/new") return "Ny leksjon";
  if (pathname.startsWith("/admin-dashboard-learning/lessons/") && pathname !== "/admin-dashboard-learning/lessons")
    return "Rediger leksjon";
  if (pathname === "/admin-dashboard-learning/sections/new") return "Ny seksjon";
  if (pathname.match(/^\/admin-dashboard-learning\/sections\/\d+$/)) return "Rediger seksjon";
  if (pathname === "/admin-dashboard-learning/courses/create") return "Opprett kurs";
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
          router.push("/learning-platform/login");
          return;
        }
        if (!isSuper) {
          router.push("/learning-dashboard");
          return;
        }
        const user = await auth.getCurrentUser();
        setUserData(user);
      } catch {
        router.push("/learning-platform/login");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router]);

  if (loading) {
    return <LoadingState message="Laster..." />;
  }

  const isOversikt = pathname === "/admin-dashboard-learning";
  const isBrukere = pathname.startsWith("/admin-dashboard-learning/users");
  const isAnalyse = pathname.startsWith("/admin-dashboard-learning/analytics");
  const isKurs = pathname.startsWith("/admin-dashboard-learning/courses");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f7f7f7] text-[#141414]">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-[#E0E0E0] bg-white overflow-y-auto">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <span className="material-symbols-outlined text-[20px]">campaign</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-none text-[#141414]">AB Marketing</h1>
              <p className="mt-1 text-xs text-slate-600">Adminpanel v2.4</p>
            </div>
          </div>
          <nav className="space-y-1 px-4">
            <Link
              href="/admin-dashboard-learning"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isOversikt ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-700/80 hover:text-white"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isOversikt ? "icon-filled" : ""}`}>dashboard</span>
              <span className="text-sm font-medium">Oversikt</span>
            </Link>
            <div className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Administrasjon
            </div>
            <Link
              href="/admin-dashboard-learning/courses/create"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isKurs ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-700/80 hover:text-white"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isKurs ? "icon-filled" : ""}`}>school</span>
              <span className="text-sm font-medium">Opprett kurs</span>
            </Link>
            <Link
              href="/admin-dashboard-learning/users"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isBrukere ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-700/80 hover:text-white"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isBrukere ? "icon-filled" : ""}`}>group</span>
              <span className="text-sm font-medium">Brukere</span>
            </Link>
            <Link
              href="/admin-dashboard-learning/analytics"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isAnalyse ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-700/80 hover:text-white"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isAnalyse ? "icon-filled" : ""}`}>bar_chart</span>
              <span className="text-sm font-medium">Analyse</span>
            </Link>
            <div className="px-3 pb-2 pt-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-200 hover:border-red-200"
              >
                <span className="material-symbols-outlined text-[20px]">exit_to_app</span>
                <span className="text-sm font-medium">Avslutt læringsplattform</span>
              </Link>
            </div>
          </nav>
        </div>
        <div className="border-t border-slate-700/50 p-4">
          <div className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-700/80">
            <div className="h-9 w-9 shrink-0 rounded-full border border-slate-600 bg-slate-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {userData ? `${userData.first_name} ${userData.last_name}` : "Administrator"}
              </p>
              <p className="truncate text-xs text-slate-400">Administrator</p>
            </div>
            <span className="material-symbols-outlined ml-auto text-[18px] text-slate-400">more_vert</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 z-10">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/admin-dashboard-learning" className="text-slate-500 transition-colors hover:text-slate-900">
              Hjem
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 text-[20px] text-slate-400 -translate-y-1/2">search</span>
              <input
                className="h-9 w-48 rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm transition-all placeholder:text-slate-400 focus:border-emerald-500/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 md:w-64"
                placeholder="Søk kampanjer..."
                type="text"
              />
            </div>
            <div className="mx-2 hidden h-6 w-px bg-slate-200 sm:block" />
            <button
              type="button"
              className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-emerald-500" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}
