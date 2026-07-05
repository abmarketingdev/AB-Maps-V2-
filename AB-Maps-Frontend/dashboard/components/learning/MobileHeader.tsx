"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LogOut, User, Menu, Home, BarChart3, Map, DollarSign, FileText, MapPinned } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { LearningAuthService } from "@/services/learningAuthService";
import { launchMap, currentCampaignId } from "@/lib/maps/launchMap";

interface MobileHeaderProps {
  title: string;
  userData?: {
    first_name: string;
    last_name: string;
    email?: string;
  } | null;
  onLogout: () => void;
  /**
   * Optional back button handler
   */
  onBack?: () => void;
  /**
   * Show back button
   */
  showBack?: boolean;
  /**
   * Additional header actions (desktop only)
   */
  desktopActions?: React.ReactNode;
}

interface NavItem {
  href: string;
  title: string;
  icon: React.ReactNode;
  external?: boolean;
  onClick?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  userData,
  onLogout,
  onBack,
  showBack = false,
  desktopActions,
}) => {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isManager, setIsManager] = useState<boolean | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  // Check if user is manager or employee
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setUserInfo(userData);
          // Check if user_type is 'manager' or if is_staff is true
          const isManagerUser = userData?.user_type === 'manager' || userData?.is_staff === true;
          setIsManager(isManagerUser);
        } else {
          // Try to get from LearningAuthService
          try {
            const authService = LearningAuthService.getInstance();
            const currentUser = await authService.getCurrentUser();
            setIsManager(currentUser.is_staff || false);
          } catch (e) {
            console.error('Error checking user role:', e);
            setIsManager(false); // Default to employee
          }
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        setIsManager(false); // Default to employee
      }
    };

    checkUserRole();
  }, []);

  // Manager navigation items (Norwegian)
  const managerNavItems: NavItem[] = [
    {
      href: "/",
      title: "Dashbord",
      icon: <Home className="w-4 h-4" />,
    },
    {
      href: "/sales",
      title: "Salg",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      href: "/rapport",
      title: "Rapport",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      href: "#",
      title: "AB Maps",
      icon: <MapPinned className="w-4 h-4" />,
      external: true,
      onClick: () => {
        setHamburgerMenuOpen(false);
        // Manager nav list -> MANAGER map (same tab on mobile).
        launchMap({ user_type: "manager" }, { campaignId: currentCampaignId(), sameTab: true });
      },
    },
  ];

  // Employee navigation items (Norwegian)
  const employeeNavItems: NavItem[] = [
    {
      href: "/employee",
      title: "Dashbord",
      icon: <Home className="w-4 h-4" />,
    },
    {
      href: "/employee/stats",
      title: "Stats Dashbord",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      href: "#",
      title: "AB Maps",
      icon: <Map className="w-4 h-4" />,
      external: true,
      onClick: () => {
        setHamburgerMenuOpen(false);
        // Employee nav list -> EMPLOYEE map (same tab on mobile).
        let employeeId: string | null = null;
        try {
          employeeId = JSON.parse(localStorage.getItem("user_data") || "{}")?.user_info?.id ?? null;
        } catch {
          /* ignore */
        }
        launchMap(
          { user_type: "employee", user_info: { id: employeeId } },
          { campaignId: currentCampaignId(), sameTab: true }
        );
      },
    },
  ];

  // Mobile header with hamburger menu
  if (isMobile) {
    return (
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left: Back button or Menu */}
            <div className="flex items-center gap-2">
              {showBack && onBack ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="h-9 w-9 p-0"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </Button>
              ) : (
                <Sheet open={hamburgerMenuOpen} onOpenChange={setHamburgerMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      aria-label="Open navigation menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle>Navigasjon</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-2">
                      {/* Show navigation items based on user role */}
                      {isManager === null ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          Laster...
                        </div>
                      ) : (
                        <>
                          {(isManager ? managerNavItems : employeeNavItems).map((item) => (
                            <Button
                              key={item.href}
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => {
                                setHamburgerMenuOpen(false);
                                if (item.onClick) {
                                  item.onClick();
                                } else if (!item.external) {
                                  router.push(item.href);
                                }
                              }}
                            >
                              {item.icon}
                              <span className="ml-2">{item.title}</span>
                            </Button>
                          ))}
                          
                          <div className="pt-4 border-t mt-4">
                            <p className="text-xs text-gray-500 mb-2 px-2">Læringsplattform</p>
                            <div className="text-sm text-gray-700 px-2 font-medium">
                              {title}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {title}
              </h1>
            </div>

            {/* Right: User icon (opens user menu) */}
            {!showBack && (
              <Sheet open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 rounded-full"
                    aria-label="User menu"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Bruker</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {userData && (
                      <div className="pb-4 border-b">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {userData.first_name} {userData.last_name}
                            </p>
                            {userData.email && (
                              <p className="text-sm text-gray-500">{userData.email}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logg ut
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Desktop header (original design)
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {showBack && onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="mr-4"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Tilbake
              </Button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center space-x-4">
            {userData && (
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {userData.first_name} {userData.last_name}
                </span>
              </div>
            )}
            {desktopActions}
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logg ut
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;

