"use client"

/**
 * Employee Layout Component
 *
 * Shared layout component for employee pages (e.g. Min statistikk). Matches the
 * manager sidebar visual language (ab-canvas, grouped sections, accent gradient
 * on active items, avatar dropdown footer).
 */

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  LogOut,
  User,
  MessageSquare,
  Bell,
  Menu,
  BarChart2,
  MapPinned,
  GraduationCap,
  ChevronsLeft,
  ChevronsRight,
  Settings,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authService } from "@/lib/auth/authService";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import CampaignSelector from "@/components/CampaignSelector";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui-ab";

interface EmployeeLayoutProps {
  children: React.ReactNode;
  selectedCampaign?: any;
  onCampaignSelect?: (campaign: any) => void;
  campaigns?: any[];
}

const NAV_ITEM_CLASS = (active: boolean, expanded: boolean) =>
  cn(
    "group/nav w-full h-10 rounded-lg px-3 gap-3 inline-flex items-center overflow-hidden",
    "text-[14px] tracking-[-0.005em] font-medium",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-ab-canvas",
    active
      ? "text-ab-fg bg-gradient-to-r from-ab-accent/10 via-ab-accent/[0.06] to-transparent"
      : "text-ab-fg-2 hover:bg-ab-subtle/70 hover:text-ab-fg",
    !expanded && "justify-center px-0",
  );

const NAV_ITEMS = [
  { href: "/employee", title: "Dashbord", icon: <Home className="h-4 w-4" /> },
  { href: "/employee/stats", title: "Min statistikk", icon: <BarChart2 className="h-4 w-4" /> },
];

export function EmployeeLayout({
  children,
  selectedCampaign,
  onCampaignSelect,
  campaigns = [],
}: EmployeeLayoutProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const changeCampaign = () => {
    if (onCampaignSelect) {
      // delegated to parent
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      router.push("/login");
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleABMapsClick = () => {
    const token = authService.getAccessToken();
    const employeeId = user?.user_info?.id;
    if (!token || !employeeId) {
      alert("Du må være innlogget for å få tilgang til AB Maps.");
      return;
    }
    const authTokens = localStorage.getItem("auth_tokens");
    let refreshToken: string | null = null;
    if (authTokens) {
      try {
        refreshToken = JSON.parse(authTokens).refresh || null;
      } catch (e) {
        console.error("[EmployeeLayout] Error parsing tokens:", e);
      }
    }
    const campaignToUse = selectedCampaign || (campaigns.length > 0 ? campaigns[0] : null);
    const baseUrl = process.env.NEXT_PUBLIC_AB_MAPS_EMPLOYEE_URL;
    let url = `${baseUrl}/?accessToken=${encodeURIComponent(token)}&employee_id=${encodeURIComponent(employeeId)}`;
    if (refreshToken) url += `&refreshToken=${encodeURIComponent(refreshToken)}`;
    if (campaignToUse) url += `&campaign_id=${encodeURIComponent(campaignToUse.id)}`;
    window.location.href = url;
  };

  const userName = user?.user_info?.name || user?.username || "Ansatt";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen bg-ab-base text-ab-fg">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 z-50 hidden md:flex h-full flex-col overflow-hidden",
          "bg-ab-canvas border-r border-ab-line-1",
          "transition-[width] duration-200 ease-out-cubic",
          sidebarOpen ? "w-64" : "w-14",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 h-60 w-60 bg-ab-accent/[0.06] dark:bg-ab-accent/[0.10] rounded-full blur-3xl opacity-60"
        />
        <div className="h-12 px-3 flex items-center justify-between border-b border-ab-line-1">
          <Link href="/employee" className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-ab-md bg-ab-accent/10 border border-ab-accent/30 flex items-center justify-center flex-shrink-0">
              <Image src="/abmarketing.png" alt="AB" width={18} height={18} className="object-contain" priority />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ab-fg leading-none">AB Marketing</div>
                <div className="eyebrow mt-0.5">Ansatt</div>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-ab-sm text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
            aria-label={sidebarOpen ? "Skjul meny" : "Vis meny"}
          >
            {sidebarOpen ? <ChevronsLeft className="h-3.5 w-3.5" /> : <ChevronsRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        {sidebarOpen ? (
          <div className="px-2 pt-3">
            <CampaignSelector
              onCampaignSelect={changeCampaign}
              selectedCampaign={selectedCampaign}
              useCurrentCampaign={true}
              className="w-full"
            />
          </div>
        ) : (
          <div className="pt-3" />
        )}

        <nav className="relative z-10 flex-1 overflow-y-auto px-2 pt-4 pb-3 space-y-5 scrollbar-thin">
          <div>
            {sidebarOpen && <div className="eyebrow px-3 pb-2">ARBEIDSFLATE</div>}
            <div className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={NAV_ITEM_CLASS(active, sidebarOpen)}>
                    <span className="flex-shrink-0">{item.icon}</span>
                    {sidebarOpen && <span className="truncate">{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            {sidebarOpen && <div className="eyebrow px-3 pb-2">TERRITORIUM</div>}
            <div className="space-y-1.5">
              <button onClick={handleABMapsClick} className={NAV_ITEM_CLASS(false, sidebarOpen)}>
                <MapPinned className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">AB Maps</span>}
              </button>
            </div>
          </div>

          <div>
            {sidebarOpen && <div className="eyebrow px-3 pb-2">LÆRING</div>}
            <div className="space-y-1.5">
              <Link
                href="/learning-platform"
                className={NAV_ITEM_CLASS(pathname === "/learning-platform", sidebarOpen)}
              >
                <GraduationCap className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">AB Academy</span>}
              </Link>
            </div>
          </div>
        </nav>

        <div className="border-t border-ab-line-1 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2 p-1.5 rounded-ab-md",
                  "hover:bg-ab-hover transition-colors text-left",
                )}
              >
                <Avatar className="h-7 w-7 ring-1 ring-ab-line">
                  <AvatarImage src="/placeholder.svg" alt={userName} />
                  <AvatarFallback className="bg-ab-active text-ab-fg-2 text-[10px] font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-ab-fg leading-tight truncate">{userName}</div>
                    <div className="text-[10px] text-ab-fg-3 truncate capitalize">{user?.user_type || "Ansatt"}</div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56 mb-2" sideOffset={8}>
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {user?.user_type || "Ansatt"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profil</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Innstillinger</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-ab-danger focus:text-ab-danger focus:bg-ab-danger-bg/40"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logg ut</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-4 top-4 z-50 md:hidden bg-ab-canvas border-ab-line shadow-md hover:bg-ab-hover"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Vis meny</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-ab-canvas border-r border-ab-line-1 flex flex-col">
          <SheetTitle className="sr-only">Navigasjon</SheetTitle>
          <div className="h-12 px-3 flex items-center border-b border-ab-line-1">
            <Link
              href="/employee"
              className="flex items-center gap-2 min-w-0"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="h-7 w-7 rounded-ab-md bg-ab-accent/10 border border-ab-accent/30 flex items-center justify-center flex-shrink-0">
                <Image src="/abmarketing.png" alt="AB" width={18} height={18} className="object-contain" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ab-fg leading-none">AB Marketing</div>
                <div className="eyebrow mt-0.5">Ansatt</div>
              </div>
            </Link>
          </div>

          <div className="px-2 pt-3">
            <CampaignSelector
              onCampaignSelect={changeCampaign}
              selectedCampaign={selectedCampaign}
              useCurrentCampaign={true}
              className="w-full"
            />
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pt-4 pb-3 space-y-5">
            <div>
              <div className="eyebrow px-3 pb-2">ARBEIDSFLATE</div>
              <div className="space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={NAV_ITEM_CLASS(active, true)}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="eyebrow px-3 pb-2">TERRITORIUM</div>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    handleABMapsClick();
                    setMobileMenuOpen(false);
                  }}
                  className={NAV_ITEM_CLASS(false, true)}
                >
                  <MapPinned className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">AB Maps</span>
                </button>
              </div>
            </div>

            <div>
              <div className="eyebrow px-3 pb-2">LÆRING</div>
              <div className="space-y-1.5">
                <Link
                  href="/learning-platform"
                  onClick={() => setMobileMenuOpen(false)}
                  className={NAV_ITEM_CLASS(pathname === "/learning-platform", true)}
                >
                  <GraduationCap className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">AB Academy</span>
                </Link>
              </div>
            </div>
          </nav>

          <div className="border-t border-ab-line-1 p-2">
            <div className="flex items-center gap-2 p-1.5 mb-1">
              <Avatar className="h-7 w-7 ring-1 ring-ab-line">
                <AvatarImage src="/placeholder.svg" alt={userName} />
                <AvatarFallback className="bg-ab-active text-ab-fg-2 text-[10px] font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-ab-fg leading-tight truncate">{userName}</div>
                <div className="text-[10px] text-ab-fg-3 truncate capitalize">{user?.user_type || "Ansatt"}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-ab-md text-[13px] font-medium text-ab-danger hover:bg-ab-danger-bg/40 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span>Logg ut</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-[margin] duration-200",
          sidebarOpen ? "md:ml-64" : "md:ml-14",
        )}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-40 w-full border-b border-ab-line-1 bg-ab-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-ab-canvas/60">
          <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <div className="hidden md:block" />
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <Input type="search" placeholder="Søk..." className="w-64 h-9 bg-ab-elevated border-ab-line" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-9 w-9 text-ab-fg-3 hover:text-ab-fg"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <ThemeToggle className="h-9 w-9" />
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex relative h-9 w-9 text-ab-fg-3 hover:text-ab-fg"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-ab-danger rounded-full" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative rounded-full h-9 w-9">
                    <Avatar className="h-7 w-7 ring-1 ring-ab-line">
                      <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                      <AvatarFallback className="bg-ab-active text-ab-fg-2 text-[10px] font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Min konto</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profil</DropdownMenuItem>
                  <DropdownMenuItem>Innstillinger</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>Logg ut</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 bg-ab-base">{children}</main>
      </div>
    </div>
  );
}
