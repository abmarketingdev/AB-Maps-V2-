"use client"
import type React from "react"
import { createContext, useContext } from "react"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { Home, BarChart, DollarSign, Bell, Search, Menu, X, MessageSquare, Calendar, FileText, UserPlus, Map, Lock, Users, MapPinned, User, Settings, LogOut } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {  
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import ChatBot from "@/components/chat-bot"
import CampaignSelector from "@/components/CampaignSelector"
import StandaloneCampaignModal from "@/components/campaign/StandaloneCampaignModal"
import { useAuth } from "@/lib/auth/AuthContext"
import type { Campaign } from "../services/campaignService"

// Navigation item interface
interface NavItem {
  href: string;
  title: string;
  icon: React.ReactNode;
  variant?: "default" | "ghost";
  external?: boolean;
  onClick?: () => void;
}

// Add this before the ClientLayout function
export const CampaignContext = createContext({
  currentCampaign: "",
  managerId: "", // Will be set from auth context
})

export function useCampaignContext() {
  return useContext(CampaignContext)
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatbotOpen, setChatbotOpen] = useState(false)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()
  const { user, logout: authLogout, isAuthenticated, isLoading } = useAuth()
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)

  // Load current campaign from localStorage for AB Maps manager frontend
  useEffect(() => {
    const storedCampaign = localStorage.getItem('currentCampaign');
    if (storedCampaign) {
      try {
        const campaign = JSON.parse(storedCampaign);
        setSelectedCampaign(campaign);
      } catch (error) {
        console.error('Error parsing stored campaign:', error);
        localStorage.removeItem('currentCampaign');
      }
    }
  }, []);

  const changeCampaign = () => {
    setCampaignModalOpen(true);
  };

  const handleCampaignSelect = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCampaignModalOpen(false);
  };

  const navItems: NavItem[] = [
    {
      href: "/",
      title: "Dashbord",
      icon: <Home className="h-5 w-5" />,
      variant: "default" as const,
    },
    {
      href: "/sales",
      title: "Salg",
      icon: <DollarSign className="h-5 w-5" />,
      variant: "ghost" as const,
    },
    {
      href: "/rapport",
      title: "Rapport",
      icon: <FileText className="h-5 w-5" />,
      variant: "ghost" as const,
    },
    {
      href: "/teams",
      title: "Teams",
      icon: <Users className="h-5 w-5" />,
      variant: "ghost" as const,
    },
    {
      href: "#",
      title: "AB Maps",
      icon: <MapPinned className="h-5 w-5" />,
      external: true,
      onClick: () => {
        const tokens = localStorage.getItem('auth_tokens');
        const campaignData = localStorage.getItem('currentCampaign');
        console.log('Raw tokens from localStorage:', tokens);
        console.log('Campaign data from localStorage:', campaignData);
        console.log('All localStorage keys:', Object.keys(localStorage));
        
        if (tokens) {
          try {
            const tokenData = JSON.parse(tokens);
            console.log('Parsed token data:', tokenData);
            
            // Check if we have the access token
            if (!tokenData.access) {
              console.error('No access token found in token data');
              alert('Invalid authentication token. Please log in again.');
              window.location.href = '/login';
              return;
            }
            
            // Extract campaign ID from campaign data
            let campaignId = null;
            if (campaignData) {
              try {
                const campaign = JSON.parse(campaignData);
                campaignId = campaign.id;
                console.log('Extracted campaign ID:', campaignId);
              } catch (error) {
                console.error('Error parsing campaign data:', error);
                // If parsing fails, assume it's already just the ID
                campaignId = campaignData;
              }
            }
            
            // Build URL with campaign_id parameter if available
            let url = `/manager/?token=${encodeURIComponent(JSON.stringify(tokenData))}`;
            if (campaignId) {
              url += `&campaign_id=${encodeURIComponent(campaignId)}`;
              console.log('Campaign ID will be included in URL:', campaignId);
            } else {
              console.log('No campaign ID found, URL will not include campaign_id parameter');
            }
            
            console.log('Opening AB Maps URL:', url);
            window.open(url, '_blank');
          } catch (error) {
            console.error('Error parsing auth tokens:', error);
            alert('Authentication error. Please log in again.');
            window.location.href = '/login';
          }
        } else {
          console.error('No auth tokens found in localStorage');
          alert('No authentication token found. Please log in again.');
          window.location.href = '/login';
        }
      }
    },
    {
      href: "/areas",
      title: "Areas",
      icon: <Map className="h-5 w-5" />,
      variant: "ghost" as const,
    },
    {
      href: "/manager/",
      title: "Lås opp/lås områder",
      icon: <Lock className="h-5 w-5" />,
      external: true,
    },
    {
      href: "/campaigns",
      title: "Campaign",
      icon: <MapPinned className="h-5 w-5" />,
      variant: "ghost" as const,
    },
  ]

  // Updated logout handler to use auth context
  const handleLogout = async () => {
    try {
      await authLogout()
      // Clear campaign selection (authService.clearAuthData already handles this, but just to be sure)
      localStorage.removeItem("selectedCampaign")
      localStorage.removeItem("currentCampaign")
      router.push("/login")
    } catch (error) {
      console.error("Logout failed:", error)
      // Force redirect even if logout API fails
      localStorage.removeItem("selectedCampaign")
      localStorage.removeItem("currentCampaign")
      router.push("/login")
    }
  }

  // Show loading if auth is being checked
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Don't render dashboard if not authenticated (will be handled by ProtectedRoute)
  if (!isAuthenticated) {
    return null
  }

  // Get user display info
  const userName = user?.user_info?.name || user?.username || "User"
  const userEmail = user?.email || ""
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const managerId = user?.user_info?.manager_id || user?.user_info?.id || user?.user_id || ""

  return (
    <CampaignContext.Provider value={{ currentCampaign: "", managerId }}>
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 z-50 flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out",
            sidebarOpen ? "w-64" : "w-[70px]",
            "hidden md:flex",
          )}
        >
          <div className="flex h-16 items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <BarChart className="h-6 w-6" />
              {sidebarOpen && <span>AB Salgsdashbord</span>}
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8">
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {/* Campaign Selector Button - Above Dashboard */}
            <div className="mb-4">
              <CampaignSelector 
                onCampaignSelect={changeCampaign}
                selectedCampaign={selectedCampaign}
                useCurrentCampaign={true}
                className="w-full"
              />
            </div>

            {/* Regular Navigation Items */}
            {navItems.map((item, index) =>
              item.external ? (
                item.onClick ? (
                  <button
                    key={index}
                    onClick={item.onClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors w-full text-left",
                      "text-muted-foreground hover:bg-muted hover:text-primary",
                    )}
                  >
                    {item.icon}
                    {sidebarOpen && <span>{item.title}</span>}
                  </button>
                ) : (
                  <a
                    key={index}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      "text-muted-foreground hover:bg-muted hover:text-primary",
                    )}
                  >
                    {item.icon}
                    {sidebarOpen && <span>{item.title}</span>}
                  </a>
                )
              ) : (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground hover:bg-muted hover:text-primary",
                  )}
                >
                  {item.icon}
                  {sidebarOpen && <span>{item.title}</span>}
                </Link>
              )
            )}
          </nav>
          <div className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full p-0 h-auto justify-start hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Avatar>
                      <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    {sidebarOpen && (
                      <div className="space-y-1 flex-1 text-left">
                        <p className="text-sm font-medium leading-none">{userName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                        <p className="text-xs leading-none text-muted-foreground capitalize">
                          {user?.user_type || 'User'}
                        </p>
                      </div>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                side="top" 
                className="w-56 mb-2"
                sideOffset={8}
              >
                <DropdownMenuLabel>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {user?.user_type || 'User'}
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
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
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
            <Button variant="outline" size="icon" className="fixed left-4 top-4 z-40 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Vis Meny</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-16 items-center border-b px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <BarChart className="h-6 w-6" />
                <span>AB Salgsdashbord</span>
              </Link>
            </div>
            <nav className="grid gap-1 p-4">
              {/* Campaign Selector for Mobile */}
              <div className="mb-4">
                <CampaignSelector 
                  onCampaignSelect={changeCampaign}
                  selectedCampaign={selectedCampaign}
                  className="w-full"
                />
              </div>
              
              {navItems.map((item, index) =>
                item.external ? (
                  item.onClick ? (
                    <button
                      key={index}
                      onClick={item.onClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors w-full text-left",
                        "text-muted-foreground hover:bg-muted hover:text-primary",
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </button>
                  ) : (
                    <a
                      key={index}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                        "text-muted-foreground hover:bg-muted hover:text-primary",
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </a>
                  )
                ) : (
                  <Link
                    key={index}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-muted hover:text-primary",
                    )}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                )
              )}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className={cn("flex flex-1 flex-col", "md:pl-[70px]", sidebarOpen && "md:pl-64")}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
            <div className="flex flex-1 items-center justify-end gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Søk..." className="w-64 pl-8" />
              </div>

              {/* Chatbot Button */}
              <Button variant="outline" size="icon" className="relative" onClick={() => setChatbotOpen(true)}>
                <MessageSquare className="h-5 w-5" />
                <span className="sr-only">Åpne AI-assistent</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Vis varsler</span>
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                      3
                    </Badge>
                  </Button>
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
                  <Button variant="ghost" size="icon" className="relative rounded-full md:hidden">
                    <Avatar>
                      <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
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
          <main className="flex-1">
            <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
          </main>

          {/* Chatbot Component */}
          <ChatBot isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
        </div>
      </div>

      {/* Campaign Selection Modal */}
      <StandaloneCampaignModal
        open={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCampaignSelect={handleCampaignSelect}
      />
    </CampaignContext.Provider>
  )
}

import "./globals.css"
