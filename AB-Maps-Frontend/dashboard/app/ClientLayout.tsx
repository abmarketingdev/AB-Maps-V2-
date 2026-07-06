"use client"
import type React from "react"
import { createContext, useContext } from "react"

import { useState, useEffect, Suspense, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Home,
  DollarSign,
  Bell,
  Menu,
  X,
  FileText,
  Map as MapIcon,
  Lock,
  MapPinned,
  User,
  Settings,
  LogOut,
  Shield,
  Plus,
  BookOpen,
  CheckSquare,
  Globe,
  Users,
  BarChart3,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { checkSuperuserStatus, clearSuperuserStatusCache } from "../services/userService"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import CampaignSelector from "@/components/CampaignSelector"
import { CampaignPicker, getStoredCampaign } from "@/components/dashboard/v2/CampaignPicker"
import StandaloneCampaignModal from "@/components/campaign/StandaloneCampaignModal"
import { useAuth } from "@/lib/auth/AuthContext"
import { launchMap, currentCampaignId } from "@/lib/maps/launchMap"
import type { Campaign } from "../services/campaignService"
import {
  checkCampaignCompletion,
  type CampaignCompletionResponse,
  clearCompletionCache,
} from "@/services/learningCompletionService"
import { LockedNavItem } from "@/components/navbar/LockedNavItem"
import { CompletionCheckPopup } from "@/components/learning/CompletionCheckPopup"
import { useToast } from "@/hooks/use-toast"
import { StatusPill, ThemeToggle } from "@/components/ui-ab"

interface NavItem {
  href: string
  title: string
  icon: React.ReactNode
  group: NavGroup
  variant?: "default" | "ghost"
  external?: boolean
  onClick?: () => void
}

type NavGroup = "ARBEIDSFLATE" | "TERRITORIUM" | "TEAM" | "LÆRING" | "ADMIN" | "FORHÅNDSVISNING"

const GROUP_ORDER: NavGroup[] = ["ARBEIDSFLATE", "TERRITORIUM", "TEAM", "LÆRING", "ADMIN", "FORHÅNDSVISNING"]

const PAGE_TITLES: Record<string, string> = {
  "/": "Hjem",
  "/dashbord": "Dashbord",
  "/sales": "Statistikk",
  "/rapport": "Rapport",
  "/todo": "Oppgaver",
  "/map": "Kart",
  "/areas": "Områder",
  "/las-opp-las-omrader": "Lås opp / lås områder",
  "/las-opp-las-omrader/lock-areas": "Lås områder",
  "/las-opp-las-omrader/unlock-areas": "Lås opp områder",
  "/campaigns": "Kampanje",
  "/employee": "Ansatt",
  "/learning-platform": "AB Academy",
  "/learning-dashboard": "Læringsoversikt",
  "/admin-dashboard": "Admin Dashboard",
  "/analytics": "Analytics",
  "/admin/tasks": "Tildel oppgaver",
  "/uploaded-addresses": "Legg til adresse",
  "/teams": "Team",
}

export const CampaignContext = createContext({
  currentCampaign: "",
  managerId: "",
})

export function useCampaignContext() {
  return useContext(CampaignContext)
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false) // pinned-open; default = slim rail
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const expanded = sidebarOpen || sidebarHovered // visual expansion (hover floats over content)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  // Selected-campaign color → drives the subtle ambient accent in the chrome.
  const [campaignColor, setCampaignColor] = useState<string | null>(null)
  useEffect(() => {
    setCampaignColor(getStoredCampaign()?.color ?? null)
    const onChange = (e: Event) => setCampaignColor((e as CustomEvent)?.detail?.color ?? null)
    window.addEventListener("ab:campaign-changed", onChange)
    return () => window.removeEventListener("ab:campaign-changed", onChange)
  }, [])
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [isCheckingSuperuser, setIsCheckingSuperuser] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  // Global ⌘K / Ctrl+K to open command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCommandOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const { user, logout: authLogout, isAuthenticated, isLoading, isSuperuser: authIsSuperuser, isSalesChief, isStaff } = useAuth()
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [completionStatus, setCompletionStatus] = useState<CampaignCompletionResponse | null>(null)
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(false)
  const [showCompletionPopup, setShowCompletionPopup] = useState(false)

  // Load current campaign from localStorage and check completion
  useEffect(() => {
    const checkCompletionForStoredCampaign = async () => {
      const storedCampaign = localStorage.getItem("currentCampaign")
      if (storedCampaign) {
        try {
          const campaign = JSON.parse(storedCampaign)

          if (!campaign || typeof campaign !== "object") {
            localStorage.removeItem("currentCampaign")
            toast({
              title: "Ugyldig kampanje",
              description: "Kampanjen i lokal lagring er ugyldig. Vennligst velg en kampanje på nytt.",
              variant: "destructive",
            })
            return
          }
          if (!campaign.id) {
            localStorage.removeItem("currentCampaign")
            toast({
              title: "Ugyldig kampanje",
              description: "Kampanjen mangler ID. Vennligst velg en kampanje på nytt.",
              variant: "destructive",
            })
            return
          }
          setSelectedCampaign(campaign)

          const userIsSuperuser = isSuperuser || authIsSuperuser
          if (!userIsSuperuser && user && campaign?.id) {
            const userType = user.user_type === "manager" ? "manager" : "employee"
            const userId =
              user.user_type === "manager"
                ? user.user_info?.id || user.user_id
                : user.user_info?.id || user.user_id
            if (userId) {
              setIsCheckingCompletion(true)
              try {
                const completion = await checkCampaignCompletion({ campaignId: campaign.id, userId, userType })
                if (!completion.is_assigned_to_campaign) {
                  toast({
                    title: "Ikke tilknyttet kampanje",
                    description: "Du er ikke tilknyttet denne kampanjen. Vennligst velg en annen kampanje.",
                    variant: "destructive",
                  })
                  setCompletionStatus(null)
                  return
                }
                if (completion.total_sections === 0) {
                  toast({ title: "Ingen seksjoner", description: "Denne kampanjen har ingen seksjoner å fullføre.", variant: "default" })
                  setCompletionStatus(null)
                  return
                }
                setCompletionStatus(completion)
                if (!completion.all_completed) setShowCompletionPopup(true)
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Kunne ikke sjekke kursfullføring. Vennligst prøv igjen."
                toast({ title: "Feil ved sjekk av kursfullføring", description: errorMessage, variant: "destructive" })
                setCompletionStatus(null)
              } finally {
                setIsCheckingCompletion(false)
              }
            } else {
              toast({
                title: "Manglende brukerinformasjon",
                description: "Kunne ikke sjekke kursfullføring. Vennligst logg inn på nytt.",
                variant: "destructive",
              })
            }
          } else if (userIsSuperuser) {
            setCompletionStatus(null)
            clearCompletionCache()
          }
        } catch (error) {
          console.error("[ClientLayout] Error parsing stored campaign:", error)
          localStorage.removeItem("currentCampaign")
          toast({
            title: "Ugyldig kampanje",
            description: "Kunne ikke lese kampanje fra lokal lagring. Vennligst velg en kampanje på nytt.",
            variant: "destructive",
          })
        }
      }
    }
    if (isAuthenticated && user && !isCheckingSuperuser) checkCompletionForStoredCampaign()
  }, [isAuthenticated, user, isSuperuser, authIsSuperuser, isCheckingSuperuser, toast])

  // Check completion status when user returns from learning dashboard
  useEffect(() => {
    const checkCompletionOnReturn = async () => {
      const userIsSuperuser = isSuperuser || authIsSuperuser
      if (!isAuthenticated || userIsSuperuser || !user || isCheckingSuperuser) return
      const storedCampaign = localStorage.getItem("currentCampaign")
      if (!storedCampaign) return
      try {
        const campaign = JSON.parse(storedCampaign)
        if (!campaign?.id) return
        const userType = user.user_type === "manager" ? "manager" : "employee"
        const userId = user.user_type === "manager" ? user.user_info?.id || user.user_id : user.user_info?.id || user.user_id
        if (!userId) return
        clearCompletionCache(campaign.id, userId, userType)
        setIsCheckingCompletion(true)
        try {
          const completion = await checkCampaignCompletion({ campaignId: campaign.id, userId, userType })
          if (!completion.is_assigned_to_campaign || completion.total_sections === 0) {
            setCompletionStatus(null)
            return
          }
          setCompletionStatus(completion)
          if (completion.all_completed) setShowCompletionPopup(false)
          else if (!showCompletionPopup) setShowCompletionPopup(true)
        } catch (error) {
          console.error("[ClientLayout] Error checking completion on return:", error)
        } finally {
          setIsCheckingCompletion(false)
        }
      } catch (error) {
        console.error("[ClientLayout] Error parsing campaign on return:", error)
      }
    }
    const handleVisibilityChange = () => { if (document.visibilityState === "visible") setTimeout(() => checkCompletionOnReturn(), 500) }
    const handleFocus = () => setTimeout(() => checkCompletionOnReturn(), 500)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [isAuthenticated, user, isSuperuser, authIsSuperuser, isCheckingSuperuser, completionStatus, showCompletionPopup, toast])

  // Superuser caching
  useEffect(() => {
    const checkSuperuser = async () => {
      if (isAuthenticated && !isCheckingSuperuser) {
        const cached = sessionStorage.getItem("superuser_status")
        const userId = user?.user_id || user?.user_info?.id
        const cacheKey = userId ? `superuser_status_${userId}` : "superuser_status"
        if (cached) {
          try {
            const cachedData = JSON.parse(cached)
            if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
              setIsSuperuser(cachedData.status)
              return
            }
          } catch {}
        }
        setIsCheckingSuperuser(true)
        try {
          const superuserStatus = await checkSuperuserStatus()
          setIsSuperuser(superuserStatus)
          if (userId) sessionStorage.setItem(cacheKey, JSON.stringify({ status: superuserStatus, timestamp: Date.now() }))
        } catch {
          setIsSuperuser(false)
        } finally {
          setIsCheckingSuperuser(false)
        }
      } else if (!isAuthenticated) {
        setIsSuperuser(false)
        sessionStorage.removeItem("superuser_status")
        sessionStorage.removeItem(`superuser_status_${user?.user_id || user?.user_info?.id}`)
        clearSuperuserStatusCache()
      }
    }
    checkSuperuser()
  }, [isAuthenticated, user?.user_id, user?.user_info?.id])

  const changeCampaign = () => setCampaignModalOpen(true)

  const handleCampaignSelect = async (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setCampaignModalOpen(false)
    localStorage.setItem("currentCampaign", JSON.stringify(campaign))
    const userIsSuperuser = isSuperuser || authIsSuperuser
    if (!userIsSuperuser && user && campaign.id) {
      const userType = user.user_type === "manager" ? "manager" : "employee"
      const userId = user.user_type === "manager" ? user.user_info?.id || user.user_id : user.user_info?.id || user.user_id
      if (userId) {
        setIsCheckingCompletion(true)
        try {
          const completion = await checkCampaignCompletion({ campaignId: campaign.id, userId, userType })
          if (!completion.is_assigned_to_campaign) {
            toast({ title: "Ikke tilknyttet kampanje", description: "Du er ikke tilknyttet denne kampanjen. Vennligst velg en annen kampanje.", variant: "destructive" })
            setCompletionStatus(null)
            return
          }
          if (completion.total_sections === 0) {
            toast({ title: "Ingen seksjoner", description: "Denne kampanjen har ingen seksjoner å fullføre.", variant: "default" })
            setCompletionStatus(null)
            return
          }
          setCompletionStatus(completion)
          if (!completion.all_completed) setShowCompletionPopup(true)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Kunne ikke sjekke kursfullføring. Vennligst prøv igjen."
          toast({ title: "Feil ved sjekk av kursfullføring", description: errorMessage, variant: "destructive" })
          setCompletionStatus(null)
        } finally {
          setIsCheckingCompletion(false)
        }
      } else {
        toast({ title: "Manglende brukerinformasjon", description: "Kunne ikke sjekke kursfullføring. Vennligst logg inn på nytt.", variant: "destructive" })
      }
    } else if (userIsSuperuser) {
      setCompletionStatus(null)
      clearCompletionCache()
    }
  }

  // Role-based launch (this layout renders for manager/admin/superuser -> MANAGER map).
  const openAbMaps = () => launchMap(user, { campaignId: currentCampaignId() })

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { href: "/dashbord",  title: "Dashbord",  icon: <Home className="h-4 w-4" />,        group: "ARBEIDSFLATE" },
      { href: "/sales",     title: "Statistikk",icon: <DollarSign className="h-4 w-4" />,  group: "ARBEIDSFLATE" },
      { href: "/rapport",   title: "Rapport",   icon: <FileText className="h-4 w-4" />,    group: "ARBEIDSFLATE" },
      { href: "/todo",      title: "Oppgaver",  icon: <CheckSquare className="h-4 w-4" />, group: "ARBEIDSFLATE" },
    ]
    // Hidden per request — route still exists at /admin/tasks but not surfaced
    // in the sidebar.
    // if (isSuperuser) {
    //   items.push({ href: "/admin/tasks", title: "Tildel oppgaver", icon: <Users className="h-4 w-4" />, group: "ARBEIDSFLATE" })
    // }
    items.push(
      { href: "/map",                  title: "Kart",                 icon: <Globe className="h-4 w-4" />,     group: "TERRITORIUM" },
      { href: "#",                     title: "AB Maps",              icon: <MapPinned className="h-4 w-4" />, group: "TERRITORIUM", external: true, onClick: openAbMaps },
      { href: "/areas",                title: "Områder",              icon: <MapIcon className="h-4 w-4" />,   group: "TERRITORIUM" },
      { href: "/campaigns",            title: "Kampanje",             icon: <MapPinned className="h-4 w-4" />, group: "TERRITORIUM" },
    )
    // Lås opp/lås områder — oversight page, superusers/admins + sales-chiefs only.
    if (isSuperuser || isSalesChief) {
      items.push({ href: "/las-opp-las-omrader", title: "Lås opp/lås områder", icon: <Lock className="h-4 w-4" />, group: "TERRITORIUM" })
    }
    // Campaign teams — managers (own teams), sales chiefs + admins (all teams).
    if (isStaff || isSuperuser || isSalesChief) {
      items.push({ href: "/teams", title: "Team", icon: <Users className="h-4 w-4" />, group: "TEAM" })
    }
    items.push({
      href: "/learning-platform",
      title: isSuperuser ? "Læringsadminpanel" : "AB Academy",
      icon: <BookOpen className="h-4 w-4" />,
      group: "LÆRING",
    })
    // Analytics — admins/superusers + sales-chiefs only (plain managers excluded).
    // Sales chiefs get a team-only Analytics view (enforced inside AnalyticsView).
    if (isSuperuser || isSalesChief) {
      items.push({ href: "/analytics", title: "Analytics", icon: <BarChart3 className="h-4 w-4" />, group: "ADMIN" })
    }
    // Admin Dashboard — superusers/admins ONLY (sales chiefs must not see it).
    if (isSuperuser) {
      items.push({ href: "/admin-dashboard", title: "Admin Dashboard", icon: <Shield className="h-4 w-4" />, group: "ADMIN" })
    }
    // Add-address oversight — superusers + sales chiefs.
    if (isSuperuser || isSalesChief) {
      items.push({ href: "/uploaded-addresses", title: "Legg til adresse", icon: <Plus className="h-4 w-4" />, group: "ADMIN" })
    }
    return items
  }, [isSuperuser, isSalesChief, isStaff])

  const groupedNav = useMemo(() => {
    const groups = new Map<NavGroup, NavItem[]>()
    GROUP_ORDER.forEach((g) => groups.set(g, []))
    navItems.forEach((item) => groups.get(item.group)?.push(item))
    return GROUP_ORDER.map((g) => ({ group: g, items: groups.get(g) || [] })).filter((g) => g.items.length > 0)
  }, [navItems])

  const handleLogout = async () => {
    try {
      await authLogout()
      localStorage.removeItem("selectedCampaign")
      localStorage.removeItem("currentCampaign")
      clearSuperuserStatusCache()
      router.push("/login")
    } catch (error) {
      console.error("Logout failed:", error)
      localStorage.removeItem("selectedCampaign")
      localStorage.removeItem("currentCampaign")
      clearSuperuserStatusCache()
      router.push("/login")
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ab-base">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-ab-line border-t-ab-accent animate-spin" />
          <p className="text-[12px] text-ab-fg-3 uppercase tracking-wider">Laster dashbord…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const userName = user?.user_info?.name || user?.username || "Bruker"
  const userEmail = user?.email || ""
  const userInitials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  const managerId = user?.user_info?.manager_id || user?.user_info?.id || user?.user_id || ""

  const userIsSuperuser = isSuperuser || authIsSuperuser
  const isLocked = !userIsSuperuser && completionStatus !== null && !completionStatus.all_completed

  const currentTitle = PAGE_TITLES[pathname] || ""

  const renderNavItem = (item: NavItem, expanded: boolean, mobile: boolean = false) => {
    const active = pathname === item.href;
    const isCollapsed = !expanded && !mobile;
    return (
      <LockedNavItem
        href={item.href}
        title={item.title}
        icon={item.icon}
        isActive={active}
        isLocked={isLocked}
        completionStatus={completionStatus}
        isExternal={item.external}
        onClick={item.onClick}
        collapsed={isCollapsed}
        className={cn(
          "group/nav w-full h-10 rounded-lg px-3 gap-3 overflow-hidden",
          "text-[14px] tracking-[-0.005em] font-medium",
          "transition-all duration-150 ease-out",
          "hover:bg-ab-subtle/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-ab-canvas",
          active && "bg-gradient-to-r from-ab-accent/10 via-ab-accent/[0.06] to-transparent",
          isCollapsed && "justify-center px-0",
        )}
      />
    )
  }

  return (
    <CampaignContext.Provider value={{ currentCampaign: "", managerId }}>
      <div className="flex min-h-screen bg-ab-base text-ab-fg">
        {/* Desktop Sidebar — slim rail that expands on hover (floats over content) */}
        <aside
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
          className={cn(
            "fixed inset-y-0 z-50 hidden md:flex h-full flex-col overflow-hidden",
            "bg-ab-canvas border-r border-ab-line-1",
            "transition-[width,box-shadow] duration-200 ease-out-cubic",
            expanded ? "w-64" : "w-16",
            sidebarHovered && !sidebarOpen && "shadow-[12px_0_40px_-12px_rgba(0,0,0,0.55)]",
          )}
        >
          {/* Subtle top-left accent glow — premium depth.
              position:fixed on the aside already creates a containing block,
              so this absolute child anchors to the aside without a `relative` class
              (which would otherwise alphabetically override `fixed` in Tailwind). */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 h-60 w-60 bg-ab-accent/[0.06] dark:bg-ab-accent/[0.10] rounded-full blur-3xl opacity-60 transition-colors duration-700"
            style={campaignColor ? { background: `${campaignColor}1f` } : undefined}
          />
          <div className={cn("h-14 flex items-center justify-between border-b border-ab-line-1", expanded ? "px-3" : "px-0 justify-center")}>
            <Link href="/dashbord" className={cn("flex items-center gap-2.5 min-w-0", !expanded && "justify-center")}>
              <div className="h-8 w-8 rounded-ab-md bg-ab-accent/10 border border-ab-accent/30 flex items-center justify-center flex-shrink-0">
                <Image src="/abmarketing.png" alt="AB" width={18} height={18} className="object-contain" priority />
              </div>
              {expanded && (
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ab-fg leading-tight">AB Marketing</div>
                  <div className="eyebrow mt-0.5">Oslo Øst</div>
                </div>
              )}
            </Link>
            {expanded && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-ab-sm text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors shrink-0"
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
            {groupedNav.map(({ group, items }, gi) => (
              <div key={group}>
                {expanded
                  ? <div className="eyebrow px-3 pb-2">{group}</div>
                  : gi > 0 && <div className="mx-3 mb-2 h-px bg-ab-line-1/70" />}
                <div className="space-y-1">
                  {items.map((item, idx) => (
                    <div key={`${item.href}-${idx}`}>{renderNavItem(item, expanded)}</div>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-ab-line-1 p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center gap-2 p-1.5 rounded-ab-md",
                    "hover:bg-ab-hover transition-colors text-left",
                    !expanded && "justify-center",
                  )}
                >
                  <Avatar className="h-7 w-7 ring-1 ring-ab-line">
                    <AvatarImage src="/placeholder.svg" alt={userName} />
                    <AvatarFallback className="bg-ab-active text-ab-fg-2 text-[10px] font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {expanded && (
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-ab-fg leading-tight truncate">{userName}</div>
                      <div className="text-[10px] text-ab-fg-3 truncate capitalize">{user?.user_type || "Bruker"}</div>
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
                      {user?.user_type || "User"}
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
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed left-3 top-3 z-40 md:hidden h-9 w-9 bg-ab-elevated border-ab-line hover:bg-ab-hover"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Vis Meny</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-ab-canvas border-ab-line">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="h-12 px-3 flex items-center border-b border-ab-line-1">
              <Link href="/dashbord" className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-ab-md bg-ab-accent/10 border border-ab-accent/30 flex items-center justify-center">
                  <Image src="/abmarketing.png" alt="AB" width={18} height={18} className="object-contain" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-ab-fg leading-none">AB Marketing</div>
                  <div className="eyebrow mt-0.5">Oslo Øst</div>
                </div>
              </Link>
            </div>
            <div className="px-2 pt-3">
              <CampaignPicker className="w-full" />
            </div>
            <nav className="px-2 pt-4 pb-3 space-y-5 overflow-y-auto">
              {groupedNav.map(({ group, items }) => (
                <div key={group}>
                  <div className="eyebrow px-2.5 pb-2">{group}</div>
                  <div className="space-y-0.5">
                    {items.map((item, idx) => (
                      <div key={`${item.href}-${idx}`}>{renderNavItem(item, true, true)}</div>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className={cn("flex flex-1 flex-col min-w-0 transition-[padding] duration-200 ease-out-cubic", sidebarOpen ? "md:pl-64" : "md:pl-16")}>
          <header className="relative overflow-hidden sticky top-0 z-30 h-12 flex items-center gap-3 px-3 md:px-5 bg-ab-base/85 backdrop-blur-md border-b border-ab-line-1">
            {/* Subtle campaign-color accent — ambient identity, not branding */}
            {campaignColor && (
              <>
                <span aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-700"
                  style={{ background: `linear-gradient(90deg, ${campaignColor}14, transparent 42%)` }} />
                <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] transition-opacity duration-700"
                  style={{ background: `linear-gradient(90deg, ${campaignColor}, ${campaignColor}55 35%, transparent 70%)` }} />
              </>
            )}
            <div className="relative hidden md:flex items-center gap-2 min-w-0">
              <span className="text-[12px] text-ab-fg-3">AB Marketing</span>
              <span className="text-ab-fg-4">/</span>
              <span className="text-[12px] text-ab-fg-3">Oslo Øst</span>
              {currentTitle && (
                <>
                  <span className="text-ab-fg-4">/</span>
                  <span className="text-[12px] text-ab-fg font-medium">{currentTitle}</span>
                </>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Søk eller kommando"
                className={cn(
                  "hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-ab-md",
                  "border border-ab-line bg-ab-elevated text-[12px] text-ab-fg-3",
                  "hover:bg-ab-hover hover:text-ab-fg hover:border-ab-line-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent/30",
                )}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Søk eller kommando…</span>
                <span className="kbd ml-1">⌘K</span>
              </button>

              <StatusPill tone="live" className="hidden lg:inline-flex">LIVE</StatusPill>

              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "relative h-8 w-8 inline-flex items-center justify-center rounded-ab-md",
                      "border border-ab-line bg-ab-elevated text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors",
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-ab-accent" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Varsler</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Ny bestilling mottatt</DropdownMenuItem>
                  <DropdownMenuItem>Samtale planlagt om 15 minutter</DropdownMenuItem>
                  <DropdownMenuItem>Teammøte kl. 14:00</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-full border border-ab-line bg-ab-elevated">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src="/placeholder.svg" alt={userName} />
                      <AvatarFallback className="bg-ab-active text-ab-fg-2 text-[10px] font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Min Konto</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profil</DropdownMenuItem>
                  <DropdownMenuItem>Innstillinger</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>Logg ut</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 min-w-0">
            <Suspense fallback={<div className="p-6 text-ab-fg-3">Laster…</div>}>{children}</Suspense>
          </main>
        </div>
      </div>

      <StandaloneCampaignModal
        open={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCampaignSelect={handleCampaignSelect}
      />

      {/* Global ⌘K command palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Søk sider, kommandoer…" />
        <CommandList>
          <CommandEmpty>Ingen treff.</CommandEmpty>
          {groupedNav.map(({ group, items }) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={`${item.href}-${item.title}`}
                  value={`${item.title} ${item.href} ${group}`}
                  onSelect={() => {
                    setCommandOpen(false)
                    if (item.external && item.onClick) item.onClick()
                    else if (item.href !== "#") router.push(item.href)
                  }}
                >
                  <span className="mr-2 flex h-4 w-4 items-center justify-center text-ab-fg-3">
                    {item.icon}
                  </span>
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="SYSTEM">
            <CommandItem
              value="bytt tema theme light dark"
              onSelect={() => {
                setCommandOpen(false)
                // theme toggle handled by ThemeToggle button; just close
              }}
            >
              <span className="mr-2 flex h-4 w-4 items-center justify-center text-ab-fg-3">
                <Settings className="h-3.5 w-3.5" />
              </span>
              <span>Innstillinger</span>
            </CommandItem>
            <CommandItem
              value="logg ut sign out logout"
              onSelect={() => {
                setCommandOpen(false)
                handleLogout()
              }}
            >
              <span className="mr-2 flex h-4 w-4 items-center justify-center text-ab-danger">
                <LogOut className="h-3.5 w-3.5" />
              </span>
              <span>Logg ut</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <CompletionCheckPopup
        open={showCompletionPopup}
        onOpenChange={setShowCompletionPopup}
        completionStatus={completionStatus}
      />
    </CampaignContext.Provider>
  )
}
