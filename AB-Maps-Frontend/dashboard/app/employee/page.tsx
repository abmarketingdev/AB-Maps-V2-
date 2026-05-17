"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useRouter, usePathname } from "next/navigation";
import { Home, LogOut, User, Bell, Badge, Map, Menu, BarChart2, TrendingUp, Target, Flame, Award, Briefcase, CheckCircle, ChevronRight, Calendar, LayoutGrid, List, MapPin, PlusCircle, Receipt, AlertCircle, ChevronDown, ChevronUp, MapPinned, GraduationCap, ChevronsLeft, ChevronsRight, Settings } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Employee, getEmployeeById, getManagerById } from "@/services/employeeService";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { getAssignedAreasForEmployee, Area } from "@/services/areaService";
import { authService } from "@/lib/auth/authService";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { fetchAssignedCampaignsForEmployee, fetchEmployeeCampaignsDirect } from '@/services/campaignService';
import { buildApiUrl } from '@/lib/config/apiConfig';
import CampaignSelector from '@/components/CampaignSelector';
import RegisterSalePopup from '@/components/RegisterSalePopup';
import { fetchSalesPageData, SalesPageData } from '@/services/activitiesService';
import { 
  checkCampaignCompletion, 
  type CampaignCompletionResponse,
  clearCompletionCache 
} from "@/services/learningCompletionService";
import { CompletionCheckPopup } from "@/components/learning/CompletionCheckPopup";
import { useToast } from "@/hooks/use-toast";
import { LockedNavItem } from "@/components/navbar/LockedNavItem";
import { Card, CardContent } from "@/components/ui/card";
import { MoodMascot } from "@/components/gamification/MoodMascot";
import { computeMood } from "@/components/gamification/lib/mood";
import { Sparkline, ThemeToggle } from "@/components/ui-ab";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";

// Mascot thresholds — match production Terskler defaults.
// TODO(backend): source from analyticsService.getThresholds() when wired.
const EMP_MIN_JA_PROSENT = 3.0;
const EMP_MIN_DORER_PER_DAG = 70;

  const navItems = [
  {
    href: "/employee",
    title: "Dashbord",
    icon: <Home className="h-4 w-4" />,
    variant: "default" as const,
  },
  {
    href: "/employee/stats",
    title: "Min statistikk",
    icon: <BarChart2 className="h-4 w-4" />,
    variant: "default" as const,
  },
];

// Shared nav item class — mirrors the manager sidebar pattern so both feel
// like the same product. Active state uses a soft accent gradient; idle items
// drop to fg-2 with a subtle hover wash.
const EMP_NAV_ITEM_CLASS = (active: boolean, expanded: boolean) => cn(
  "group/nav w-full h-10 rounded-lg px-3 gap-3 inline-flex items-center overflow-hidden",
  "text-[14px] tracking-[-0.005em] font-medium",
  "transition-all duration-150 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-ab-canvas",
  active
    ? "text-ab-fg bg-gradient-to-r from-ab-accent/10 via-ab-accent/[0.06] to-transparent"
    : "text-ab-fg-2 hover:bg-ab-subtle/70 hover:text-ab-fg",
  !expanded && "justify-center px-0",
);

// Campaign badge component
const CampaignBadge: React.FC<{ campaign: any }> = ({ campaign }) => {
  // Generate a consistent color based on campaign name
  const getCampaignColor = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <span 
      className={`inline-flex items-center text-xs px-2 py-1 mr-1 mb-1 rounded-full border ${getCampaignColor(campaign.name)}`}
      title={`Assigned: ${new Date(campaign.assigned_at).toLocaleDateString()}`}
    >
      {campaign.name}
    </span>
  );
};



const EmployeeDashboard: React.FC = () => {
  const { user, logout, isSuperuser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<CampaignCompletionResponse | null>(null);
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);

  const [manager, setManager] = useState<any | null>(null);
  const [managerLoading, setManagerLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [assignedAreas, setAssignedAreas] = useState<Area[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [employeeCampaigns, setEmployeeCampaigns] = useState<Record<string, any[]>>({});
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [registerSaleOpen, setRegisterSaleOpen] = useState(false);
  const [salesDateFilter, setSalesDateFilter] = useState<string>('');
  const [salesPageData, setSalesPageData] = useState<SalesPageData[]>([]);
  const [salesPageLoading, setSalesPageLoading] = useState(false);
  const [salesPageError, setSalesPageError] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [isNorskFolkehjelp, setIsNorskFolkehjelp] = useState(false);

  // Fetch campaigns for an employee
  // this is the one we need to fetch campaigns for the Campaign Seletor in employee dashboard
  const fetchEmployeeCampaigns = async (employeeId: string) => {
    if (employeeCampaigns[employeeId]) return; // Already loaded
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const apiUrl = `${baseUrl}/api/campaigns/campaigns/employee_campaigns/?employee_id=${employeeId}`;
      const accessToken = authService.getAccessToken();
      
      if (!accessToken) {
        console.error('No access token available');
        setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
        return;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmployeeCampaigns(prev => ({ 
          ...prev, 
          [employeeId]: data.map((item: any) => item.campaign) 
        }));
      } else {
        console.error('Failed to fetch campaigns for employee:', employeeId);
        setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
      }
    } catch (error) {
      console.error('Error fetching campaigns for employee:', employeeId, error);
      setEmployeeCampaigns(prev => ({ ...prev, [employeeId]: [] }));
    }
  };



  useEffect(() => {
    setManagerLoading(true);
    if (user?.user_info?.manager_id) {
      getManagerById(user.user_info.manager_id)
        .then(setManager)
        .catch(console.error)
        .finally(() => setManagerLoading(false));
    } else {
      setManagerLoading(false);
    }
  }, [user?.user_info?.manager_id]);

  useEffect(() => {
    setCampaignsLoading(true);
    fetchEmployeeCampaignsDirect()
      .then((campaignsData) => {
        console.log('Campaigns data received:', campaignsData);
        // Transform the data to match the expected format
        const transformedCampaigns = campaignsData.map((item: any) => ({
          id: item.campaign.id,
          name: item.campaign.name,
          description: item.campaign.description || '',

          areaIds: [],
          created_at: item.campaign.created_at,
          updated_at: item.campaign.updated_at,
          assigned_at: item.assigned_at,
        }));
        setCampaigns(transformedCampaigns);
        // Removed: Do not set currentCampaign in localStorage here
      })
      .catch((error) => {
        console.error('Failed to fetch campaigns:', error);
        setCampaigns([]);
      })
      .finally(() => setCampaignsLoading(false));
  }, []);

  useEffect(() => {
    // Only fetch areas if we have campaigns loaded
    if (campaigns.length === 0) {
      console.log('No campaigns available yet, skipping areas fetch');
      return;
    }
    
    setAreasLoading(true);
    // Use the first campaign's ID
    const campaignId = campaigns[0].id;
    console.log('Fetching areas for campaign:', campaignId);
    
    getAssignedAreasForEmployee(campaignId)
      .then((areas) => {
        console.log('Areas fetched successfully:', areas);
        setAssignedAreas(areas);
      })
      .catch((error) => {
        console.error('Failed to fetch assigned areas:', error);
        setAssignedAreas([]);
      })
      .finally(() => setAreasLoading(false));
  }, [campaigns]); // Add campaigns as dependency

  // Load current campaign from localStorage and check completion
  useEffect(() => {
    const checkCompletionForStoredCampaign = async () => {
      const storedCampaign = localStorage.getItem('currentCampaign');
      if (storedCampaign) {
        try {
          const campaign = JSON.parse(storedCampaign);
          
          // Edge case: Invalid campaign data
          if (!campaign || typeof campaign !== 'object') {
            console.warn('[Employee Dashboard] Invalid campaign data in localStorage');
            localStorage.removeItem('currentCampaign');
            toast({
              title: 'Ugyldig kampanje',
              description: 'Kampanjen i lokal lagring er ugyldig. Vennligst velg en kampanje på nytt.',
              variant: 'destructive',
            });
            setIsNorskFolkehjelp(false);
            return;
          }
          
          // Edge case: Campaign has no ID
          if (!campaign.id) {
            console.warn('[Employee Dashboard] Campaign in localStorage has no ID');
            localStorage.removeItem('currentCampaign');
            toast({
              title: 'Ugyldig kampanje',
              description: 'Kampanjen mangler ID. Vennligst velg en kampanje på nytt.',
              variant: 'destructive',
            });
            setIsNorskFolkehjelp(false);
            return;
          }
          
          setSelectedCampaign(campaign);
          setIsNorskFolkehjelp(campaign.name === 'Norsk folkehjelp');
          
          // Check completion if user is not superuser
          if (!isSuperuser && user && campaign?.id) {
            const userId = user.user_info?.id || user.user_id;
            
            if (userId) {
              setIsCheckingCompletion(true);
              try {
                console.log('[Employee Dashboard] Checking completion for stored campaign:', {
                  campaignId: campaign.id,
                  userId,
                  userType: 'employee'
                });
                
                const completion = await checkCampaignCompletion({
                  campaignId: campaign.id,
                  userId,
                  userType: 'employee'
                });
                
                // Edge case: User not assigned to campaign
                if (!completion.is_assigned_to_campaign) {
                  console.warn('[Employee Dashboard] User not assigned to campaign');
                  toast({
                    title: 'Ikke tilknyttet kampanje',
                    description: 'Du er ikke tilknyttet denne kampanjen. Vennligst velg en annen kampanje.',
                    variant: 'destructive',
                  });
                  setCompletionStatus(null);
                  return;
                }
                
                // Edge case: Campaign has no sections
                if (completion.total_sections === 0) {
                  console.warn('[Employee Dashboard] Campaign has no sections');
                  toast({
                    title: 'Ingen seksjoner',
                    description: 'Denne kampanjen har ingen seksjoner å fullføre.',
                    variant: 'default',
                  });
                  setCompletionStatus(null);
                  return;
                }
                
                setCompletionStatus(completion);
                console.log('[Employee Dashboard] Completion check result:', {
                  all_completed: completion.all_completed,
                  incomplete_count: completion.incomplete_sections.length
                });
                
                // Show popup if course is incomplete
                if (!completion.all_completed) {
                  setShowCompletionPopup(true);
                }
              } catch (error) {
                console.error('[Employee Dashboard] Error checking completion:', error);
                
                // Show user-friendly error message
                const errorMessage = error instanceof Error 
                  ? error.message 
                  : 'Kunne ikke sjekke kursfullføring. Vennligst prøv igjen.';
                
                toast({
                  title: 'Feil ved sjekk av kursfullføring',
                  description: errorMessage,
                  variant: 'destructive',
                });
                
                setCompletionStatus(null);
              } finally {
                setIsCheckingCompletion(false);
              }
            } else {
              console.warn('[Employee Dashboard] Cannot check completion - missing userId');
              toast({
                title: 'Manglende brukerinformasjon',
                description: 'Kunne ikke sjekke kursfullføring. Vennligst logg inn på nytt.',
                variant: 'destructive',
              });
            }
          } else if (isSuperuser) {
            // Superuser - clear any previous completion status and allow full access
            setCompletionStatus(null);
            clearCompletionCache();
          }
        } catch (error) {
          // Edge case: Invalid JSON in localStorage
          console.error('[Employee Dashboard] Error parsing stored campaign:', error);
          localStorage.removeItem('currentCampaign');
          setIsNorskFolkehjelp(false);
          toast({
            title: 'Ugyldig kampanje',
            description: 'Kunne ikke lese kampanje fra lokal lagring. Vennligst velg en kampanje på nytt.',
            variant: 'destructive',
          });
        }
      } else {
        // Edge case: No campaign selected - this is normal
        setIsNorskFolkehjelp(false);
      }
    };
    
    checkCompletionForStoredCampaign();
  }, [user, isSuperuser, toast]);

  // Check completion status when user returns from learning dashboard
  useEffect(() => {
    const checkCompletionOnReturn = async () => {
      // Only check if user is authenticated, not superuser, and has a campaign selected
      if (!user || isSuperuser) {
        return;
      }

      const storedCampaign = localStorage.getItem('currentCampaign');
      if (!storedCampaign) {
        return;
      }

      try {
        const campaign = JSON.parse(storedCampaign);
        if (!campaign?.id) {
          return;
        }

        const userId = user.user_info?.id || user.user_id;
        if (!userId) {
          return;
        }

        console.log('[Employee Dashboard] Checking completion on return from learning dashboard:', {
          campaignId: campaign.id,
          userId,
          userType: 'employee'
        });

        // Clear cache to ensure we get fresh data after returning from learning-platform
        clearCompletionCache(campaign.id, userId, 'employee');

        setIsCheckingCompletion(true);
        try {
          const completion = await checkCampaignCompletion({
            campaignId: campaign.id,
            userId,
            userType: 'employee'
          });

          // Edge case: User not assigned to campaign
          if (!completion.is_assigned_to_campaign) {
            setCompletionStatus(null);
            return;
          }

          // Edge case: Campaign has no sections
          if (completion.total_sections === 0) {
            setCompletionStatus(null);
            return;
          }

          setCompletionStatus(completion);
          console.log('[Employee Dashboard] Completion check on return result:', {
            all_completed: completion.all_completed,
            incomplete_count: completion.incomplete_sections.length,
            was_locked: completionStatus !== null && !completionStatus.all_completed,
            now_locked: !completion.all_completed
          });

          // If course was incomplete and is now complete, unlock features
          if (completion.all_completed) {
            setShowCompletionPopup(false);
          } else if (!completion.all_completed) {
            // Still incomplete, show popup if it wasn't shown before
            if (!showCompletionPopup) {
              setShowCompletionPopup(true);
            }
          }
        } catch (error) {
          console.error('[Employee Dashboard] Error checking completion on return:', error);
          // Don't show error toast on automatic check, just log it
        } finally {
          setIsCheckingCompletion(false);
        }
      } catch (error) {
        console.error('[Employee Dashboard] Error parsing campaign on return:', error);
      }
    };

    // Check when page becomes visible (user returns from learning-platform)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to ensure page is fully loaded
        setTimeout(() => {
          checkCompletionOnReturn();
        }, 500);
      }
    };

    // Check when window gains focus (user switches back to tab)
    const handleFocus = () => {
      setTimeout(() => {
        checkCompletionOnReturn();
      }, 500);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, isSuperuser, completionStatus, showCompletionPopup, toast]);

  // Fetch sales page data when campaign changes
  useEffect(() => {
    const fetchSalesPage = async () => {
      if (!selectedCampaign || !user?.user_info?.id) return;
      setSalesPageLoading(true);
      setSalesPageError(null);
      try {
        const data = await fetchSalesPageData(selectedCampaign.id, user.user_info.id);
        setSalesPageData(data);
      } catch (err: any) {
        setSalesPageError(err.message || 'Kunne ikke hente salgsdata.');
        setSalesPageData([]);
      } finally {
        setSalesPageLoading(false);
      }
    };
    fetchSalesPage();
  }, [selectedCampaign, user?.user_info?.id]);

  // Filtered sales page data - memoized to prevent infinite loops
  const filteredSalesPageData = useMemo(() => {
    return salesPageData.filter(item => {
      // Date filter
      if (salesDateFilter && item.date.split('T')[0] !== salesDateFilter) return false;
      return true;
    });
  }, [salesPageData, salesDateFilter]);

  // Calculate quick stats from existing sales data
  const quickStats = useMemo(() => {
    if (!salesPageData || salesPageData.length === 0) {
      return {
        todayCount: 0,
        weekCount: 0,
        streakDays: 0,
        successRate: 0,
        last7Days: [] as number[],
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Today's activities
    const todayCount = salesPageData.filter(item => {
      const saleDate = new Date(item.date);
      return saleDate >= today;
    }).length;

    // This week's sales
    const weekCount = salesPageData.filter(item => {
      const saleDate = new Date(item.date);
      return saleDate >= weekAgo;
    }).length;

    // Calculate streak (consecutive days with sales)
    const salesByDate = new Set<string>();
    salesPageData.forEach(item => {
      const dateStr = item.date.split('T')[0];
      salesByDate.add(dateStr);
    });

    let streakDays = 0;
    const checkDate = new Date(today);
    
    // Check from today backwards
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (salesByDate.has(dateStr)) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Success rate - using gavebelop > 0 as proxy for successful sales
    const totalSales = salesPageData.length;
    const successfulSales = salesPageData.filter(item => item.gavebelop && item.gavebelop > 0).length;
    const successRate = totalSales > 0 ? Math.round((successfulSales / totalSales) * 100) : 0;

    // Last 7 days as a daily activity series (oldest → newest), for the
    // hero-tile sparkline. Falls back to an empty array if nothing fell
    // inside the 7-day window so the tile can hide the chart gracefully.
    const last7Days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const count = salesPageData.filter((item) => {
        const t = new Date(item.date).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      last7Days.push(count);
    }

    return {
      todayCount,
      weekCount,
      streakDays,
      successRate,
      last7Days,
    };
  }, [salesPageData]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const changeCampaign = useCallback(() => {
    setCampaignModalOpen(true);
  }, []);

  const handleCampaignSelect = useCallback(async (campaign: any) => {
    setSelectedCampaign(campaign);
    
    // Store campaign in localStorage (CampaignSelector also does this, but ensure it's done)
    localStorage.setItem('currentCampaign', JSON.stringify(campaign));
    
    console.log('[Employee Dashboard] Campaign selected:', {
      campaignId: campaign?.id,
      campaignName: campaign?.name,
      isSuperuser,
      userType: user?.user_type,
      userId: user?.user_id,
      userInfoId: user?.user_info?.id
    });
    
    // Check completion status if user is not superuser
    if (!isSuperuser && user && campaign?.id) {
      const userId = user.user_info?.id || user.user_id;
      
      console.log('[Employee Dashboard] Preparing to check completion:', {
        userId,
        campaignId: campaign.id,
        hasUserId: !!userId
      });
      
      if (userId) {
        setIsCheckingCompletion(true);
        try {
          console.log('[Employee Dashboard] Calling completion check API:', {
            campaignId: campaign.id,
            userId,
            userType: 'employee',
            apiUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/learning/campaign-completion-check/?campaign_id=${campaign.id}&employee_id=${userId}`
          });
          
          const completion = await checkCampaignCompletion({
            campaignId: campaign.id,
            userId,
            userType: 'employee'
          });
          
          // Edge case: User not assigned to campaign
          if (!completion.is_assigned_to_campaign) {
            console.warn('[Employee Dashboard] User not assigned to campaign');
            toast({
              title: 'Ikke tilknyttet kampanje',
              description: 'Du er ikke tilknyttet denne kampanjen. Vennligst velg en annen kampanje.',
              variant: 'destructive',
            });
            setCompletionStatus(null);
            return;
          }
          
          // Edge case: Campaign has no sections
          if (completion.total_sections === 0) {
            console.warn('[Employee Dashboard] Campaign has no sections');
            toast({
              title: 'Ingen seksjoner',
              description: 'Denne kampanjen har ingen seksjoner å fullføre.',
              variant: 'default',
            });
            setCompletionStatus(null);
            return;
          }
          
          setCompletionStatus(completion);
          console.log('[Employee Dashboard] Completion check result:', {
            all_completed: completion.all_completed,
            incomplete_count: completion.incomplete_sections.length,
            campaign_name: completion.campaign_name
          });
          
          // Show popup if course is incomplete
          if (!completion.all_completed) {
            setShowCompletionPopup(true);
          } else {
            // Show success toast when campaign is successfully selected and completed
            toast({
              title: "🎯 Kampanje endret",
              description: `Du arbeider nå med ${campaign.name}`,
            });
          }
        } catch (error) {
          console.error('[Employee Dashboard] Error checking completion:', error);
          
          // Show user-friendly error message
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Kunne ikke sjekke kursfullføring. Vennligst prøv igjen.';
          
          toast({
            title: 'Feil ved sjekk av kursfullføring',
            description: errorMessage,
            variant: 'destructive',
          });
          
          // On error, assume incomplete to be safe (lock navbar)
          setCompletionStatus(null);
        } finally {
          setIsCheckingCompletion(false);
        }
      } else {
        console.warn('[Employee Dashboard] Cannot check completion - missing userId');
        toast({
          title: 'Manglende brukerinformasjon',
          description: 'Kunne ikke sjekke kursfullføring. Vennligst logg inn på nytt.',
          variant: 'destructive',
        });
      }
    } else if (isSuperuser) {
      // Superuser - clear any previous completion status and allow full access
      console.log('[Employee Dashboard] User is superuser, skipping completion check');
      setCompletionStatus(null);
      clearCompletionCache();
      // Show success toast for superuser
      toast({
        title: "🎯 Kampanje endret",
        description: `Du arbeider nå med ${campaign.name}`,
      });
    } else {
      // Edge case: No campaign ID
      if (!campaign?.id) {
        console.warn('[Employee Dashboard] Campaign has no ID');
        toast({
          title: 'Ugyldig kampanje',
          description: 'Kampanjen mangler ID. Vennligst velg en annen kampanje.',
          variant: 'destructive',
        });
        return;
      }
      
      // Edge case: No user
      if (!user) {
        console.warn('[Employee Dashboard] No user available');
        toast({
          title: 'Manglende brukerinformasjon',
          description: 'Kunne ikke sjekke kursfullføring. Vennligst logg inn på nytt.',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('[Employee Dashboard] Skipping completion check:', {
        isSuperuser,
        hasUser: !!user,
        hasCampaignId: !!campaign?.id
      });
    }
    setIsNorskFolkehjelp(campaign.name === 'Norsk folkehjelp');
    setCampaignModalOpen(false);
  }, [isSuperuser, user, toast]);

  const userName = user?.user_info?.name || user?.username || "Employee";
  const userEmail = user?.email || "";
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Helper function to get consistent gradient for campaign
  const getCampaignGradient = (campaignName: string): string => {
    const gradients = [
      'bg-gradient-to-br from-blue-500 to-cyan-400',
      'bg-gradient-to-br from-purple-500 to-pink-400',
      'bg-gradient-to-br from-orange-500 to-red-400',
      'bg-gradient-to-br from-green-500 to-emerald-400',
      'bg-gradient-to-br from-indigo-500 to-blue-400',
      'bg-gradient-to-br from-pink-500 to-rose-400',
      'bg-gradient-to-br from-teal-500 to-cyan-400',
      'bg-gradient-to-br from-amber-500 to-orange-400',
    ];
    
    // Consistent color based on campaign name
    const index = campaignName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
    return gradients[index];
  };

  // Helper function to group sales by date
  const groupSalesByDate = (sales: SalesPageData[]): Record<string, SalesPageData[]> => {
    return sales.reduce((groups, sale) => {
      const date = sale.date.split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(sale);
      return groups;
    }, {} as Record<string, SalesPageData[]>);
  };

  // Helper function to format date header
  const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'I dag';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'I går';
    } else {
      return date.toLocaleDateString('no-NO', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  // Handle sale click - memoized
  const handleSaleClick = useCallback((sale: SalesPageData) => {
    // Could navigate to sale details or show more info
    console.log('Sale clicked:', sale);
  }, []);

  // Handle register sale popup close - refetch data if sale was registered
  const handleRegisterSaleClose = useCallback(() => {
    setRegisterSaleOpen(false);
    // Refetch sales data when popup closes (in case a sale was registered)
    if (selectedCampaign && user?.user_info?.id) {
      fetchSalesPageData(selectedCampaign.id, user.user_info.id)
        .then(data => {
          setSalesPageData(data);
          toast({
            title: "✅ Salg registrert!",
            description: "Ditt salg er registrert og vil vises i listen din.",
          });
        })
        .catch(err => {
          console.error('Error refetching sales:', err);
        });
    }
  }, [selectedCampaign, user?.user_info?.id, toast]);

  // Toggle date expansion
  const toggleDateExpansion = useCallback((date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  }, []);

  // Expand all dates by default when data loads - only when sales data actually changes
  useEffect(() => {
    if (filteredSalesPageData.length > 0) {
      const dates = Object.keys(groupSalesByDate(filteredSalesPageData));
      const datesString = dates.sort().join(',');
      
      // Only update if dates have actually changed
      setExpandedDates(prev => {
        const prevDatesString = Array.from(prev).sort().join(',');
        if (prevDatesString === datesString && prev.size === dates.length) {
          return prev; // No change, return same reference
        }
        return new Set(dates);
      });
    } else {
      // Clear expanded dates if no data
      setExpandedDates(new Set());
    }
  }, [filteredSalesPageData]);

  const isNavLocked = !isSuperuser && completionStatus !== null && !completionStatus.all_completed;

  const handleABMapsClick = () => {
    if (isNavLocked) return;
    const token = authService.getAccessToken();
    const employeeId = user?.user_info?.id;
    if (!token || !employeeId) {
      alert('Du må være innlogget for å få tilgang til AB Maps.');
      return;
    }
    const authTokens = localStorage.getItem('auth_tokens');
    let tokens: any = null;
    if (authTokens) {
      try {
        tokens = JSON.parse(authTokens);
        window.dispatchEvent(new CustomEvent('tokenUpdated', {
          detail: { source: 'dashboard', tokens }
        }));
      } catch (error) {
        console.error('[EmployeeDashboard] Error parsing tokens:', error);
      }
    }
    const campaignToUse = selectedCampaign || (campaigns.length > 0 ? campaigns[0] : null);
    const baseUrl = process.env.NEXT_PUBLIC_AB_MAPS_EMPLOYEE_URL;
    const refreshToken = tokens?.refresh || null;
    let url = `${baseUrl}/?accessToken=${encodeURIComponent(token)}&employee_id=${encodeURIComponent(employeeId)}`;
    if (refreshToken) url += `&refreshToken=${encodeURIComponent(refreshToken)}`;
    if (campaignToUse) url += `&campaign_id=${encodeURIComponent(campaignToUse.id)}`;
    window.open(url, '_blank');
  };

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
          {/* ARBEIDSFLATE */}
          <div>
            {sidebarOpen && <div className="eyebrow px-3 pb-2">ARBEIDSFLATE</div>}
            <div className="space-y-1.5">
              {navItems.map((item) => (
                <LockedNavItem
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  icon={item.icon}
                  isActive={pathname === item.href}
                  isLocked={isNavLocked}
                  completionStatus={completionStatus}
                  collapsed={!sidebarOpen}
                  className={EMP_NAV_ITEM_CLASS(pathname === item.href, sidebarOpen)}
                />
              ))}
            </div>
          </div>

          {/* TERRITORIUM */}
          <div>
            {sidebarOpen && <div className="eyebrow px-3 pb-2">TERRITORIUM</div>}
            <div className="space-y-1.5">
              <LockedNavItem
                href="#"
                title="AB Maps"
                icon={<MapPinned className="h-4 w-4" />}
                isActive={false}
                isLocked={isNavLocked}
                completionStatus={completionStatus}
                isExternal
                onClick={handleABMapsClick}
                collapsed={!sidebarOpen}
                className={EMP_NAV_ITEM_CLASS(false, sidebarOpen)}
              />
            </div>
          </div>

          {/* LÆRING */}
          <div>
            {sidebarOpen && <div className="eyebrow px-3 pb-2">LÆRING</div>}
            <div className="space-y-1.5">
              <Link
                href="/learning-platform"
                className={EMP_NAV_ITEM_CLASS(pathname === "/learning-platform", sidebarOpen)}
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
                  <p className="text-xs leading-none text-muted-foreground">{user?.email || ""}</p>
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
            className="fixed left-4 top-4 z-40 md:hidden bg-ab-canvas border-ab-line"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Vis meny</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-ab-canvas border-r border-ab-line-1 flex flex-col">
          <SheetTitle className="sr-only">Navigasjon</SheetTitle>
          <div className="h-12 px-3 flex items-center border-b border-ab-line-1">
            <Link href="/employee" className="flex items-center gap-2 min-w-0" onClick={() => setMobileMenuOpen(false)}>
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
                {navItems.map((item) => (
                  <LockedNavItem
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    icon={item.icon}
                    isActive={pathname === item.href}
                    isLocked={isNavLocked}
                    completionStatus={completionStatus}
                    className={EMP_NAV_ITEM_CLASS(pathname === item.href, true)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow px-3 pb-2">TERRITORIUM</div>
              <div className="space-y-1.5">
                <LockedNavItem
                  href="#"
                  title="AB Maps"
                  icon={<MapPinned className="h-4 w-4" />}
                  isActive={false}
                  isLocked={isNavLocked}
                  completionStatus={completionStatus}
                  isExternal
                  onClick={handleABMapsClick}
                  className={EMP_NAV_ITEM_CLASS(false, true)}
                />
              </div>
            </div>

            <div>
              <div className="eyebrow px-3 pb-2">LÆRING</div>
              <div className="space-y-1.5">
                <Link
                  href="/learning-platform"
                  onClick={() => setMobileMenuOpen(false)}
                  className={EMP_NAV_ITEM_CLASS(pathname === "/learning-platform", true)}
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

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-h-screen bg-ab-base transition-[margin] duration-200",
        sidebarOpen ? "md:ml-64" : "md:ml-14"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-ab-line-1 bg-ab-canvas/80 backdrop-blur-md">
          <div className="flex h-14 md:h-16 items-center justify-end px-4 md:px-6 gap-3">
            {/* Welcome Message - Desktop Only */}
            <div className="hidden md:flex flex-1 items-center">
              <div>
                <p className="text-sm text-muted-foreground">Velkommen tilbake,</p>
                <p className="font-semibold">{userName}</p>
              </div>
            </div>
            
            {/* Theme toggle */}
            <ThemeToggle className="h-9 w-9" />

            {/* Notification Bell - Redesigned */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="sr-only">Vis varsler</span>
                  {/* Only show badge if there are notifications */}
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                    3
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Varsler</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Ny oppgave tildelt</DropdownMenuItem>
                <DropdownMenuItem>Teammøte kl. 14:00</DropdownMenuItem>
                <DropdownMenuItem>Leder har sendt en melding</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                    <AvatarFallback>{userInitials}</AvatarFallback>
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
        </header>
        {/* Main Dashboard Content */}
        <main className="flex-1 w-full bg-ab-base">
          {/* HERO — bento grid (operator tone, mood-driven) */}
          {(() => {
            const firstName = userName.split(/\s+/)[0] || userName;
            const successRateNum = quickStats.successRate || 0;
            // Compute mascot mood from existing client-side derived stats.
            // dorerPerDag proxy: this week count / 7. Falls back to 'new' if no data.
            const empMood = computeMood({
              jaProsent: successRateNum,
              dorerPerDag: quickStats.weekCount / 7,
              minJaProsent: EMP_MIN_JA_PROSENT,
              minDorerPerDag: EMP_MIN_DORER_PER_DAG,
              daysOnPlatform:
                salesPageData && salesPageData.length === 0 ? 0 : undefined,
            });
            const moodLine =
              empMood.mood === "on-fire"
                ? "Du brenner i dag. Fortsett slik."
                : empMood.mood === "on-track"
                ? "Du holder målene. Solid jobb."
                : empMood.mood === "working-hard"
                ? "Mye banking — ja-en kommer."
                : empMood.mood === "needs-attention"
                ? "Ny dag, nye dører. Du klarer dette."
                : "Velkommen om bord. Vi heier på deg.";
            const todayDoorsTarget = EMP_MIN_DORER_PER_DAG;
            const todayPct = Math.min(
              100,
              Math.round((quickStats.todayCount / todayDoorsTarget) * 100),
            );
            const todayPctColor =
              todayPct >= 100
                ? "var(--ab-success-fg)"
                : todayPct >= 60
                ? "var(--ab-accent-9)"
                : "var(--ab-warning-fg)";
            const jaRateColor =
              successRateNum >= EMP_MIN_JA_PROSENT * 1.5
                ? "var(--ab-success-fg)"
                : successRateNum >= EMP_MIN_JA_PROSENT
                ? "var(--ab-accent-9)"
                : "var(--ab-warning-fg)";
            return (
              <section className="w-full border-b border-ab-line-1 relative overflow-hidden">
                {/* Atmospheric mood-tinted glow top-left */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full blur-3xl opacity-50"
                  style={{
                    background:
                      empMood.mood === "on-fire"
                        ? "hsl(38 92% 50% / 0.10)"
                        : empMood.mood === "on-track"
                        ? "hsl(160 84% 39% / 0.10)"
                        : empMood.mood === "working-hard"
                        ? "hsl(217 91% 60% / 0.10)"
                        : empMood.mood === "needs-attention"
                        ? "hsl(0 84% 60% / 0.08)"
                        : "hsl(330 81% 60% / 0.08)",
                  }}
                />
                {(() => {
                  // Brighter mood palette for the hero zone — sky/cyan replaces
                  // muted blue for working-hard. Used by the header mascot ring,
                  // the hero tile gradient stack, and the sparkline stroke.
                  const moodHex =
                    empMood.mood === "on-fire"
                      ? "#fbbf24"
                      : empMood.mood === "on-track"
                      ? "#34d399"
                      : empMood.mood === "working-hard"
                      ? "#38bdf8"
                      : empMood.mood === "needs-attention"
                      ? "#fb7185"
                      : "#f472b6";
                  // Dark theme bumps gradient opacities ~50% so the pools register
                  // against the near-black bg without washing out the number.
                  const a1 = isDark ? 0.33 : 0.22; // top-right pool
                  const a2 = isDark ? 0.18 : 0.12; // bottom-left pool
                  const a3 = isDark ? 0.12 : 0.08; // diagonal wash
                  const heroBg = `
                    radial-gradient(circle at 70% 30%, ${moodHex}${Math.round(a1 * 255).toString(16).padStart(2, "0")}, transparent 60%),
                    radial-gradient(circle at 20% 80%, ${moodHex}${Math.round(a2 * 255).toString(16).padStart(2, "0")}, transparent 50%),
                    linear-gradient(135deg, ${moodHex}${Math.round(a3 * 255).toString(16).padStart(2, "0")} 0%, transparent 100%),
                    var(--ab-bg-elevated)
                  `;
                  const moodDescription = empMood.description;
                  return (
                <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-6 md:pb-8">
                  {/* Greeting strip — mascot anchors a personal signature next
                      to the operator-tone mood line. Click → /employee/stats. */}
                  <div className="mb-6 flex items-center gap-4">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href="/employee/stats"
                            aria-label={`${empMood.label} — ${moodDescription}. Se min statistikk.`}
                            className="block shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ab-accent/40"
                          >
                            <motion.span
                              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.28, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                              whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                              className={cn(
                                "relative inline-block rounded-full cursor-pointer",
                                empMood.mood === "on-fire" && "ring-2 ring-amber-400/50",
                              )}
                              style={
                                empMood.mood === "on-fire"
                                  ? { filter: "drop-shadow(0 0 8px hsl(38 92% 50% / 0.4))" }
                                  : undefined
                              }
                            >
                              <MoodMascot
                                seed={user?.user_info?.id || userName}
                                mood={empMood}
                                size="lg"
                                showMoodIndicator
                                disablePulseGlow
                                bare
                              />
                            </motion.span>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[260px]">
                          <div className="text-[12px]">
                            <span className="font-semibold">{empMood.label}</span>
                            <span className="text-ab-fg-2"> — {moodDescription}</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-[28px] font-semibold tracking-tight text-ab-fg">
                        Hei {firstName}.
                      </h1>
                      <p className="text-[13px] text-ab-fg-2 mt-1">{moodLine}</p>
                    </div>
                  </div>

                  {/* Bento grid */}
                  <div
                    className="grid grid-cols-2 md:grid-cols-4 gap-5"
                    style={{ gridAutoRows: "180px" }}
                  >
                    {/* HERO TILE — pure stat card. Mascot now lives in the
                        page header; this tile carries the number alone. */}
                    <div
                      className="col-span-2 row-span-2 relative overflow-hidden rounded-2xl p-6 flex flex-col"
                      style={{
                        background: heroBg,
                        boxShadow: `inset 0 0 0 1px ${moodHex}26, 0 0 0 1px ${moodHex}14`,
                      }}
                    >
                      {/* On-fire ambient shimmer — a soft glow pool drifts
                          between two anchor points over 4s, disabled under
                          prefers-reduced-motion. */}
                      {empMood.mood === "on-fire" && !prefersReducedMotion && (
                        <motion.span
                          aria-hidden
                          className="pointer-events-none absolute h-56 w-56 rounded-full blur-3xl"
                          initial={{ top: "5%", left: "55%" }}
                          animate={{
                            top: ["5%", "55%", "5%"],
                            left: ["55%", "10%", "55%"],
                          }}
                          transition={{
                            duration: 4,
                            ease: "easeInOut",
                            repeat: Infinity,
                          }}
                          style={{ background: `${moodHex}40` }}
                        />
                      )}

                      <div className="relative flex items-start justify-between">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                          I DAG
                        </div>
                        {quickStats.streakDays >= 2 && (
                          <span
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border"
                            style={{
                              background: "hsl(38 92% 50% / 0.12)",
                              borderColor: "hsl(38 92% 50% / 0.30)",
                              color: "hsl(38 92% 50%)",
                            }}
                            title={`${quickStats.streakDays} dager på rad`}
                          >
                            <Flame className="h-3 w-3" />
                            {quickStats.streakDays}d
                          </span>
                        )}
                      </div>

                      <div className="relative flex-1 flex flex-col items-center justify-center text-center py-2">
                        <div className="text-[64px] font-bold tracking-tight leading-none tabular-nums text-ab-fg">
                          {quickStats.todayCount}
                        </div>
                        <div className="mt-2 text-[13px] text-ab-fg-2">
                          {quickStats.todayCount === 1
                            ? "aktivitet i dag"
                            : "aktiviteter i dag"}
                        </div>
                        <div className="mt-3">
                          <span
                            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium border"
                            style={{
                              background: `${moodHex}26`,
                              borderColor: `${moodHex}66`,
                              color: moodHex,
                            }}
                          >
                            {empMood.label}
                          </span>
                        </div>
                        {quickStats.last7Days.length === 7 &&
                          quickStats.last7Days.some((n) => n > 0) && (
                            <div className="mt-3">
                              <Sparkline
                                data={quickStats.last7Days}
                                width={120}
                                height={24}
                                stroke={moodHex}
                                fill={false}
                              />
                            </div>
                          )}
                      </div>

                      <div className="relative flex justify-end">
                        <Link
                          href="/employee/stats"
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-ab-accent hover:text-ab-accent-2 transition-colors"
                        >
                          Se min statistikk
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* TILE 2 — Denne uken (1×1) */}
                    <div className="col-span-1 row-span-1 rounded-xl border border-ab-line bg-ab-elevated p-5 relative overflow-hidden hover:border-ab-line-2 transition-colors duration-150">
                      <span
                        aria-hidden
                        className="absolute -top-6 -right-6 h-20 w-20 rounded-full blur-2xl bg-ab-success/15 pointer-events-none"
                      />
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                          DENNE UKEN
                        </div>
                        <TrendingUp className="h-4 w-4 text-ab-success" />
                      </div>
                      <div className="mt-3 text-[32px] font-semibold tracking-tight tabular-nums text-ab-fg leading-none">
                        {quickStats.weekCount}
                      </div>
                      <div className="mt-1 text-[11px] text-ab-fg-3">
                        {quickStats.weekCount === 1 ? "salg" : "salg"}
                      </div>
                    </div>

                    {/* TILE 3 — Ja-rate (1×1) */}
                    <div className="col-span-1 row-span-1 rounded-xl border border-ab-line bg-ab-elevated p-5 relative overflow-hidden hover:border-ab-line-2 transition-colors duration-150">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                          JA-RATE
                        </div>
                        <Award className="h-4 w-4 text-ab-fg-3" />
                      </div>
                      <div
                        className="mt-3 text-[32px] font-semibold tracking-tight tabular-nums leading-none"
                        style={{ color: jaRateColor }}
                      >
                        {successRateNum}%
                      </div>
                      <div className="mt-2 h-1 w-full rounded-full bg-ab-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.min(100, successRateNum * 10)}%`,
                            background: jaRateColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* TILE 4 — Dagens mål-progress (1×1) */}
                    <div className="col-span-1 row-span-1 rounded-xl border border-ab-line bg-ab-elevated p-5 relative overflow-hidden hover:border-ab-line-2 transition-colors duration-150">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                          DAGENS MÅL
                        </div>
                        <Target className="h-4 w-4 text-ab-accent" />
                      </div>
                      <div
                        className="mt-3 text-[32px] font-semibold tracking-tight tabular-nums leading-none"
                        style={{ color: todayPctColor }}
                      >
                        {todayPct}%
                      </div>
                      <div className="mt-1 text-[11px] text-ab-fg-3 tabular-nums">
                        {quickStats.todayCount} / {todayDoorsTarget} mål
                      </div>
                      <div className="mt-2 h-1 w-full rounded-full bg-ab-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${todayPct}%`,
                            background: todayPctColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* TILE 5 — Streak (1×1) */}
                    <div
                      className="col-span-1 row-span-1 rounded-xl border bg-ab-elevated p-5 relative overflow-hidden hover:border-ab-line-2 transition-colors duration-150"
                      style={{
                        borderColor:
                          quickStats.streakDays >= 2
                            ? "hsl(38 92% 50% / 0.25)"
                            : "var(--ab-border-default)",
                        background:
                          quickStats.streakDays >= 2
                            ? "linear-gradient(135deg, hsl(38 92% 50% / 0.08), transparent 70%), var(--ab-bg-elevated)"
                            : "var(--ab-bg-elevated)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                          STREAK
                        </div>
                        <Flame
                          className="h-4 w-4"
                          style={{
                            color:
                              quickStats.streakDays >= 2
                                ? "hsl(38 92% 50%)"
                                : "var(--ab-text-tertiary)",
                          }}
                        />
                      </div>
                      {quickStats.streakDays >= 2 ? (
                        <>
                          <div className="mt-3 text-[32px] font-semibold tracking-tight tabular-nums leading-none text-ab-fg">
                            {quickStats.streakDays}
                          </div>
                          <div className="mt-1 text-[11px] text-ab-fg-3">
                            dager på rad
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 text-[12px] italic text-ab-fg-3 leading-relaxed">
                          Start din streak — registrer en aktivitet i dag.
                        </div>
                      )}
                    </div>

                    {/* WIDE CTA — 4-col span */}
                    <button
                      type="button"
                      onClick={() => {
                        const token = authService.getAccessToken();
                        const employeeId = user?.user_info?.id;
                        if (token && employeeId) {
                          const authTokens = localStorage.getItem('auth_tokens');
                          let tokens = null;
                          if (authTokens) {
                            try { tokens = JSON.parse(authTokens); } catch {}
                          }
                          const campaignToUse = selectedCampaign || (campaigns.length > 0 ? campaigns[0] : null);
                          const baseUrl = process.env.NEXT_PUBLIC_AB_MAPS_EMPLOYEE_URL;
                          const refreshToken = tokens?.refresh || null;
                          let url = `${baseUrl}/?accessToken=${encodeURIComponent(token)}&employee_id=${encodeURIComponent(employeeId)}`;
                          if (refreshToken) url += `&refreshToken=${encodeURIComponent(refreshToken)}`;
                          if (campaignToUse) url += `&campaign_id=${encodeURIComponent(campaignToUse.id)}`;
                          window.open(url, '_blank');
                        }
                      }}
                      className="col-span-2 md:col-span-4 row-span-1 rounded-xl border border-ab-line bg-ab-elevated px-6 flex items-center justify-between text-left hover:border-ab-accent/40 hover:bg-ab-subtle/40 transition-all duration-150 group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span
                          aria-hidden
                          className="h-10 w-10 rounded-lg bg-ab-accent/10 text-ab-accent inline-flex items-center justify-center shrink-0"
                        >
                          <Map className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-ab-fg">
                            {selectedCampaign
                              ? `Fortsett ruten — ${selectedCampaign.name}`
                              : "Åpne AB Maps og start ruten"}
                          </div>
                          <div className="text-[12px] text-ab-fg-3 mt-0.5">
                            {selectedCampaign
                              ? "Du jobber på denne kampanjen akkurat nå."
                              : "Velg en kampanje fra sidefeltet for å komme i gang."}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-ab-fg-3 group-hover:text-ab-accent group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
                    </button>
                  </div>
                </div>
                  );
                })()}
              </section>
            );
          })()}

          {/* Main Content */}
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            {/* Campaigns Section - Full Width */}
            <section className="w-full mb-6 md:mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Dine kampanjer</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {campaigns.length} aktive kampanje{campaigns.length !== 1 ? 'r' : ''}
                  </p>
                </div>
              </div>
              
              {campaignsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="h-48 animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                        <div className="h-3 bg-muted rounded w-full mb-2" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ab-line bg-ab-subtle/40 py-16 px-6 text-center">
                  <Briefcase className="h-12 w-12 text-ab-fg-3 opacity-50 mx-auto mb-3" strokeWidth={1.25} />
                  <p className="text-[15px] font-medium text-ab-fg">Ingen kampanjer tildelt ennå</p>
                  <p className="text-[12px] text-ab-fg-3 mt-1">Spør lederen din om å bli tildelt en kampanje.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {campaigns.map(campaign => {
                    const isActive = selectedCampaign?.id === campaign.id;
                    const campaignColor = getCampaignGradient(campaign.name);
                    
                    return (
                      <div
                        key={campaign.id}
                        className={cn(
                          "group relative overflow-hidden bg-ab-elevated border border-ab-line rounded-xl p-5 cursor-pointer",
                          "hover:border-ab-line-2 hover:shadow-md transition-all duration-200",
                          isActive && "ring-2 ring-ab-accent/30 border-transparent",
                        )}
                        onClick={() => handleCampaignSelect(campaign)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCampaignSelect(campaign);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Velg kampanje ${campaign.name}`}
                      >
                        {/* Brand-color corner glow — small flourish, not a wash */}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-40 blur-3xl"
                          style={{
                            background: campaign.brand_color_hex || "hsl(217 91% 60%)",
                          }}
                        />

                        {/* Top row: brand dot + name + AKTIV pill */}
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              aria-hidden
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{
                                background: campaign.brand_color_hex || "hsl(217 91% 60%)",
                              }}
                            />
                            <h3 className="text-[15px] font-semibold text-ab-fg truncate">
                              {campaign.name}
                            </h3>
                          </div>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-ab-success/25 bg-ab-success/10 text-ab-success shrink-0">
                              <CheckCircle className="h-3 w-3" />
                              Aktiv
                            </span>
                          )}
                        </div>

                        {/* Description — em-dash if missing, never "Ingen beskrivelse" repeated */}
                        <p className="relative mt-2 text-[12px] text-ab-fg-3 line-clamp-2 leading-relaxed min-h-[32px]">
                          {campaign.description && campaign.description.trim()
                            ? campaign.description
                            : "—"}
                        </p>

                        {/* Footer — assigned date + open chevron */}
                        <div className="relative mt-4 pt-3 border-t border-ab-line-1 flex items-center justify-between">
                          <div className="inline-flex items-center gap-1.5 text-[11px] text-ab-fg-3 mono tabular">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Tildelt {campaign.assigned_at
                                ? new Date(campaign.assigned_at).toLocaleDateString('no-NO', {
                                    day: 'numeric',
                                    month: 'short',
                                  })
                                : "—"}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[12px] font-medium transition-all duration-150",
                              isActive
                                ? "text-ab-accent"
                                : "text-ab-fg-3 group-hover:text-ab-fg",
                            )}
                          >
                            Åpne
                            <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Areas Section - Enhanced Design */}
            <section className="w-full mb-6 md:mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Tildelte områder</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {assignedAreas.length} område{assignedAreas.length !== 1 ? 'r' : ''} tilgjengelig
                  </p>
                </div>
                
                {/* View Toggle */}
                <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg p-1" role="group" aria-label="Visningsmodus">
                  <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8"
                    aria-label="Vis som rutenett"
                    aria-pressed={viewMode === 'grid'}
                  >
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-8"
                    aria-label="Vis som liste"
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              
              {areasLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="h-40 animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-muted rounded w-2/3 mb-3" />
                        <div className="h-3 bg-muted rounded w-full mb-2" />
                        <div className="h-3 bg-muted rounded w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : assignedAreas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ab-line bg-ab-subtle/40 py-16 px-6 text-center">
                  <MapPin className="h-12 w-12 text-ab-fg-3 opacity-50 mx-auto mb-3" strokeWidth={1.25} />
                  <p className="text-[15px] font-medium text-ab-fg">Ingen områder tildelt ennå</p>
                  <p className="text-[12px] text-ab-fg-3 mt-1">Spør lederen din om å bli tildelt et område.</p>
                </div>
              ) : (
                <div className={cn(
                  viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "flex flex-col gap-3"
                )}>
                  {assignedAreas.map((area, index) => {
                    // Calculate progress - since we don't have completed_houses, we'll use a placeholder
                    // In a real scenario, this would come from the API
                    const completedHouses = 0; // Placeholder - would need API data
                    const progress = area.house_count && area.house_count > 0 
                      ? ((completedHouses / area.house_count) * 100) 
                      : 0;
                    const isCompleted = progress === 100;
                    
                    return (
                      <Card 
                        key={area.id}
                        className={cn(
                          "group overflow-hidden cursor-pointer",
                          "hover:shadow-lg transition-all duration-300 focus-within:ring-2 focus-within:ring-primary",
                          "border-l-4",
                          isCompleted && "bg-green-50/50"
                        )}
                        style={{ borderLeftColor: area.color }}
                        onClick={() => {
                          // Handle area click - could navigate to area details or open map
                          console.log('Area clicked:', area);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            console.log('Area clicked:', area);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Åpne område ${area.name}`}
                      >
                        <CardContent className={cn(
                          "p-4 md:p-6",
                          viewMode === 'list' && "flex items-center gap-4"
                        )}>
                          {/* Area Icon/Number */}
                          <div className={cn(
                            "flex items-center justify-between mb-4",
                            viewMode === 'list' && "mb-0"
                          )}>
                            <div className="flex items-center gap-3">
                              <div 
                                className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0"
                                style={{ backgroundColor: area.color }}
                              >
                                #{index + 1}
                              </div>
                              <div className={viewMode === 'list' ? 'flex-1' : ''}>
                                <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
                                  {area.name}
                                  {isCompleted && (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  )}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant={area.status === 'open' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {area.status === 'open' ? 'Åpen' : area.status || 'Ukjent'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            {viewMode === 'grid' && (
                              <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                            )}
                          </div>
                          
                          {/* Stats Grid */}
                          <div className={cn(
                            "grid grid-cols-2 gap-3 mb-4",
                            viewMode === 'list' && "grid-cols-4 flex-1 mb-0"
                          )}>
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-xs text-muted-foreground">Boliger</p>
                                <p className="font-semibold">{area.house_count || 0}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-xs text-muted-foreground">Fullført</p>
                                <p className="font-semibold">{completedHouses}</p>
                              </div>
                            </div>
                            
                            {viewMode === 'list' && (
                              <>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Opprettet</p>
                                    <p className="font-semibold text-xs">
                                      {new Date(area.created_at).toLocaleDateString('no-NO', {
                                        day: 'numeric',
                                        month: 'short'
                                      })}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Fremgang</p>
                                    <p className="font-semibold">{progress.toFixed(0)}%</p>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          
                          {/* Progress Bar */}
                          {viewMode === 'grid' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Fremgang</span>
                                <span className="font-semibold">{progress.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all duration-500 rounded-full",
                                    isCompleted ? "bg-green-500" : "bg-primary"
                                  )}
                                  style={{ width: `${Math.max(progress, 5)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Sales Section - Timeline Design */}
            <section className="w-full">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Salgsregistreringer</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filteredSalesPageData.length} registrering{filteredSalesPageData.length !== 1 ? 'er' : ''}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Date Filter */}
                  <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="date"
                      className="text-sm outline-none bg-transparent"
                      value={salesDateFilter}
                      onChange={e => setSalesDateFilter(e.target.value)}
                    />
                  </div>
                  
                  {/* Register Sale Button */}
                  {isNorskFolkehjelp && (
                    <Button 
                      onClick={() => setRegisterSaleOpen(true)}
                      className="shadow-sm"
                      aria-label="Registrer nytt salg"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                      <span className="hidden sm:inline">Registrer salg manuelt</span>
                      <span className="sm:hidden">Nytt</span>
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Sales Timeline */}
              {salesPageLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-muted rounded w-32 mb-4" />
                        <div className="space-y-3">
                          <div className="h-20 bg-muted rounded" />
                          <div className="h-20 bg-muted rounded" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : salesPageError ? (
                <Card className="border-destructive">
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                    <p className="text-destructive font-semibold">Feil ved lasting</p>
                    <p className="text-sm text-muted-foreground mt-1">{salesPageError}</p>
                  </CardContent>
                </Card>
              ) : filteredSalesPageData.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ab-line bg-ab-subtle/40 py-16 px-6 text-center">
                  <Receipt className="h-12 w-12 text-ab-fg-3 opacity-50 mx-auto mb-3" strokeWidth={1.25} />
                  <p className="text-[15px] font-medium text-ab-fg">
                    {salesDateFilter
                      ? "Ingen salg funnet for valgt dato"
                      : "Ingen salg registrert ennå"}
                  </p>
                  <p className="text-[12px] text-ab-fg-3 mt-1">
                    {salesDateFilter
                      ? "Prøv en annen dato eller nullstill filteret."
                      : "Salg du registrerer i dag vises her."}
                  </p>
                  {salesDateFilter && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setSalesDateFilter("")}
                    >
                      Nullstill filter
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupSalesByDate(filteredSalesPageData)).map(([date, sales]) => {
                    const isExpanded = expandedDates.has(date);
                    return (
                      <div key={date} className="space-y-3">
                        {/* Date Header with Sticky - Clickable */}
                        <div 
                          className="sticky top-14 md:top-16 z-10 bg-background/80 backdrop-blur-md border-y py-3 -mx-4 px-4 md:mx-0 md:px-0 md:border-x-0 cursor-pointer hover:bg-background/90 transition-colors"
                          onClick={() => toggleDateExpansion(date)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleDateExpansion(date);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${isExpanded ? 'Skjul' : 'Vis'} salg for ${formatDateHeader(date)}`}
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold">
                                  {formatDateHeader(date)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {sales.length} salg
                                  {isNorskFolkehjelp && (
                                    <span className="ml-2">
                                      • {sales.reduce((sum, s) => sum + (s.gavebelop || 0), 0)} kr total
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Sales Cards - Conditionally Rendered */}
                        {isExpanded && (
                          <div className="space-y-2">
                        {sales.map((sale, index) => (
                          <Card 
                            key={index}
                            className="group hover:shadow-md transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-primary"
                            onClick={() => handleSaleClick(sale)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSaleClick(sale);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Vis detaljer for salg fra ${sale.campaign_name} den ${new Date(sale.date).toLocaleDateString('no-NO')}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                {/* Time Badge */}
                                <div className="flex flex-col items-center shrink-0">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {new Date(sale.date).toLocaleTimeString('no-NO', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Badge>
                                </div>
                                
                                {/* Sale Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex-1">
                                      <p className="font-semibold text-base mb-1">
                                        {sale.campaign_name}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Selger: {sale.seller}
                                      </p>
                                    </div>
                                    
                                    {isNorskFolkehjelp && sale.gavebelop && (
                                      <div className="text-right shrink-0">
                                        <p className="font-bold text-lg text-primary">
                                          {sale.gavebelop} kr
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Gavebeløp
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Arrow Icon */}
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <RegisterSalePopup 
                open={registerSaleOpen} 
                onClose={handleRegisterSaleClose} 
              />
            </section>
          </div>
        </main>
      </div>

      {/* Campaign Selection Modal */}
      {campaignModalOpen && (
        <CampaignSelector 
          isOpen={campaignModalOpen}
          onClose={() => setCampaignModalOpen(false)}
          onCampaignSelect={handleCampaignSelect}
          selectedCampaign={selectedCampaign}
          useCurrentCampaign={true}
        />
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
          .mobile-table {
            font-size: 12px;
          }
          
          .mobile-table th,
          .mobile-table td {
            padding: 8px 4px;
          }
          
          .mobile-card {
            margin-bottom: 16px;
          }
          
          .mobile-text {
            font-size: 14px;
          }
          
          .mobile-heading {
            font-size: 18px;
          }
        }
      `}</style>
      
      {/* Completion Check Popup */}
      <CompletionCheckPopup
        open={showCompletionPopup}
        onOpenChange={setShowCompletionPopup}
        completionStatus={completionStatus}
      />
    </div>
  );
};

export default function EmployeeDashboardProtected() {
  return (
    <ProtectedRoute requiredUserType="employee">
      <EmployeeDashboard />
    </ProtectedRoute>
  );
} 