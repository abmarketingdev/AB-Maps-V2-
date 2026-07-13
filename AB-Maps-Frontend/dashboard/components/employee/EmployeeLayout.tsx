"use client"

/**
 * Employee Layout Component
 *
 * Shared layout component for employee pages (e.g. Min statistikk). Matches the
 * manager sidebar visual language (ab-canvas, grouped sections, accent gradient
 * on active items, avatar dropdown footer).
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthContext";
import { launchMap, currentCampaignId } from "@/lib/maps/launchMap";
import { useRouter, usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { CampaignPicker } from "@/components/dashboard/v2/CampaignPicker";
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

// One unified nav row used everywhere (rail, expanded, mobile). Active state
// gets a sliding accent bar (Framer layoutId) + soft gradient wash; collapsed
// rows reveal their label as a right-side tooltip.
interface EmpNavItem { title: string; icon: React.ReactNode; href?: string; onClick?: () => void }

const NAV_ITEM_BASE = cn(
  "group/nav relative w-full h-10 rounded-xl px-3 gap-3 inline-flex items-center overflow-hidden text-left",
  "text-[14px] tracking-[-0.005em] font-medium",
  "transition-all duration-150 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b1222]",
);

const WORK_ITEMS: EmpNavItem[] = [
  { href: "/employee/dashbord", title: "Dashbord", icon: <Home className="h-4 w-4" /> },
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
  const [sidebarOpen, setSidebarOpen] = useState(false); // pinned-open; default = slim rail
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const expanded = sidebarOpen || sidebarHovered; // hover floats over content
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Close the mobile drawer on navigation so it never lingers over the destination.
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

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

  // Role-based launch (this layout renders for employees -> EMPLOYEE map).
  // Read the campaign from localStorage FIRST — that's the source of truth the CampaignPicker
  // writes on select. The `selectedCampaign` prop can be stale (the picker isn't wired to it),
  // which is why the map used to open with no campaign. Mirrors the manager launcher.
  const handleABMapsClick = () => {
    const campaignId =
      currentCampaignId() || selectedCampaign?.id || (campaigns.length > 0 ? campaigns[0]?.id : null) || null;
    launchMap(user, { campaignId });
  };

  const userName = user?.user_info?.name || user?.username || "Ansatt";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Nav groups. AB Maps + AB Academy keep their original behavior (handler/href);
  // only their presentation is unified with the rest of the rail.
  const NAV_GROUPS: { group: string; items: EmpNavItem[] }[] = [
    { group: "ARBEIDSFLATE", items: WORK_ITEMS },
    { group: "TERRITORIUM", items: [{ title: "AB Maps", icon: <MapPinned className="h-4 w-4" />, onClick: handleABMapsClick }] },
    { group: "LÆRING", items: [{ href: "/learning-platform", title: "AB Academy", icon: <GraduationCap className="h-4 w-4" /> }] },
  ];

  const renderNav = (item: EmpNavItem, isExpanded: boolean, mobile = false) => {
    const active = !!item.href && pathname === item.href;
    const collapsed = !isExpanded && !mobile;
    const cls = cn(
      NAV_ITEM_BASE,
      active
        ? "text-white bg-gradient-to-r from-blue-500/[0.16] via-blue-500/[0.07] to-transparent border border-blue-400/20"
        : "text-white/55 hover:bg-white/[0.05] hover:text-white border border-transparent",
      collapsed && "justify-center px-0",
    );
    const inner = (
      <>
        {active && (
          <motion.span
            layoutId="emp-nav-active-bar"
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            aria-hidden
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-blue-400"
            style={{ boxShadow: "0 0 10px rgba(96,165,250,0.7)" }}
          />
        )}
        <span className={cn("flex-shrink-0 relative z-10 transition-transform duration-150 ease-out group-hover/nav:scale-[1.08]", active ? "text-blue-300" : "text-white/55 group-hover/nav:text-white")}>
          {item.icon}
        </span>
        {!collapsed && <span className="truncate relative z-10">{item.title}</span>}
      </>
    );
    const el = item.href
      ? <Link href={item.href} className={cls} onClick={mobile ? () => setMobileMenuOpen(false) : undefined}>{inner}</Link>
      : <button type="button" className={cls} onClick={() => { item.onClick?.(); if (mobile) setMobileMenuOpen(false); }}>{inner}</button>;

    if (!collapsed) return el;
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{el}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="font-medium">{item.title}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#0a0f1e] text-white">
      {/* Desktop Sidebar — slim rail that expands on hover (floats over content) */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={cn(
          "fixed inset-y-0 z-50 hidden md:flex h-full flex-col overflow-hidden",
          "bg-[#0b1222]/95 backdrop-blur-xl border-r border-white/[0.07]",
          "transition-[width,box-shadow] duration-200 ease-out-cubic",
          expanded ? "w-64" : "w-16",
          sidebarHovered && !sidebarOpen && "shadow-[16px_0_48px_-16px_rgba(0,0,0,0.7)]",
        )}
      >
        {/* soft blue depth glow, top-left */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -left-10 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl"
        />
        <div className={cn("h-16 flex items-center justify-between border-b border-white/[0.06]", expanded ? "px-3.5" : "px-0 justify-center")}>
          <Link href="/employee/dashbord" className={cn("flex items-center gap-2.5 min-w-0", !expanded && "justify-center")}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/25 to-blue-600/10 border border-blue-400/25 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_-4px_rgba(59,130,246,0.5)]">
              <Image src="/abmarketing.png" alt="AB" width={18} height={18} className="object-contain" priority />
            </div>
            {expanded && (
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-white leading-tight">AB Marketing</div>
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/35 mt-0.5">Ansatt</div>
              </div>
            )}
          </Link>
          {expanded && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/[0.07] transition-colors shrink-0"
              aria-label={sidebarOpen ? "Lås opp meny" : "Lås meny åpen"}
              title={sidebarOpen ? "Lås opp meny" : "Lås meny åpen"}
            >
              {sidebarOpen ? <ChevronsLeft className="h-3.5 w-3.5" /> : <ChevronsRight className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {expanded ? (
          <div className="px-2 pt-3">
            <CampaignPicker className="w-full" />
          </div>
        ) : (
          <div className="pt-3" />
        )}

        <nav className="relative z-10 flex-1 overflow-y-auto px-2 pt-4 pb-3 space-y-5 scrollbar-thin">
          {NAV_GROUPS.map(({ group, items }, gi) => (
            <div key={group}>
              {expanded
                ? <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{group}</div>
                : gi > 0 && <div className="mx-3 mb-2 h-px bg-white/[0.07]" />}
              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div key={`${item.href ?? item.title}-${idx}`}>{renderNav(item, expanded)}</div>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 p-1.5 rounded-xl",
                  "hover:bg-white/[0.05] transition-colors text-left",
                  !expanded && "justify-center",
                )}
              >
                <Avatar className="h-8 w-8 ring-1 ring-white/10">
                  <AvatarImage src="/placeholder.svg" alt={userName} />
                  <AvatarFallback className="bg-blue-500/20 text-blue-200 text-[10px] font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {expanded && (
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-white leading-tight truncate">{userName}</div>
                    <div className="text-[10px] text-white/40 truncate capitalize">{user?.user_type || "Ansatt"}</div>
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
            className="fixed left-4 top-4 z-50 md:hidden bg-[#0b1222] border-white/10 text-white shadow-md hover:bg-white/[0.06]"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Vis meny</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-[#0b1222] border-r border-white/[0.07] text-white flex flex-col">
          <SheetTitle className="sr-only">Navigasjon</SheetTitle>
          <div className="h-16 px-3.5 flex items-center border-b border-white/[0.06]">
            <Link
              href="/employee/dashbord"
              className="flex items-center gap-2.5 min-w-0"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/25 to-blue-600/10 border border-blue-400/25 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_-4px_rgba(59,130,246,0.5)]">
                <Image src="/abmarketing.png" alt="AB" width={18} height={18} className="object-contain" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-white leading-tight">AB Marketing</div>
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/35 mt-0.5">Ansatt</div>
              </div>
            </Link>
          </div>

          {/* Campaign selection on mobile lives in the top bar (header chip), NOT here — a
              picker modal opened from inside this Radix Sheet inherits the sheet's
              pointer-events:none + scroll-lock, which breaks taps and scrolling. */}
          <nav className="flex-1 overflow-y-auto px-2 pt-4 pb-3 space-y-5">
            {NAV_GROUPS.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{group}</div>
                <div className="space-y-1.5">
                  {items.map((item, idx) => (
                    <div key={`${item.href ?? item.title}-${idx}`}>{renderNav(item, true, true)}</div>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/[0.06] p-2">
            <div className="flex items-center gap-2.5 p-1.5 mb-1">
              <Avatar className="h-8 w-8 ring-1 ring-white/10">
                <AvatarImage src="/placeholder.svg" alt={userName} />
                <AvatarFallback className="bg-blue-500/20 text-blue-200 text-[10px] font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-white leading-tight truncate">{userName}</div>
                <div className="text-[10px] text-white/40 truncate capitalize">{user?.user_type || "Ansatt"}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
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
          "flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ease-out-cubic",
          sidebarOpen ? "md:ml-64" : "md:ml-16",
        )}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#0a0f1e]/80 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:px-8">
            <div className="flex items-center gap-4 min-w-0 pl-11 md:pl-0">
              {/* Mobile: one-tap campaign selector (no need to open the drawer). */}
              <div className="md:hidden min-w-0 max-w-[210px]">
                <CampaignPicker className="w-full h-9 py-0 text-[13px] rounded-lg bg-white/[0.05] text-white/85 border-white/10 hover:bg-white/10 hover:text-white" />
              </div>
              <div className="hidden md:block" />
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <Input type="search" placeholder="Søk..." className="w-64 h-9 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-500/40" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-9 w-9 text-white/45 hover:text-white hover:bg-white/[0.06]"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <ThemeToggle className="h-9 w-9" />
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex relative h-9 w-9 text-white/45 hover:text-white hover:bg-white/[0.06]"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-rose-500 rounded-full" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative rounded-full h-9 w-9 hover:bg-white/[0.06]">
                    <Avatar className="h-7 w-7 ring-1 ring-white/10">
                      <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                      <AvatarFallback className="bg-blue-500/20 text-blue-200 text-[10px] font-semibold">
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
        <main className="flex-1 bg-[#0a0f1e] pt-3 md:pt-0">{children}</main>
      </div>
    </div>
  );
}
