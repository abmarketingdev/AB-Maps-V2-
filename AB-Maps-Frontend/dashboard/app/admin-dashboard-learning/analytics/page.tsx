"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Users, BookOpen, BarChart3, TrendingUp, Calendar, Activity, Target } from "lucide-react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "@/components/learning/MobileHeader";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { cn } from "@/lib/utils";
import type { LearningStats, StaffStats, SectionCompletionStats, ActivityStats } from "@/services/learningTypes";

const AnalyticsDashboard = () => {
  const [overviewStats, setOverviewStats] = useState<LearningStats | null>(null);
  const [staffProgress, setStaffProgress] = useState<StaffStats[]>([]);
  const [sectionCompletion, setSectionCompletion] = useState<SectionCompletionStats[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const isMobile = useIsMobile(); // Must be called before any conditional returns

  // Check authentication and fetch data (optimized with parallel execution)
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const authService = LearningAuthService.getInstance();
        
        // Run auth checks in parallel for faster response
        const [authenticated, isSuperuser] = await Promise.all([
          authService.isAuthenticated(),
          authService.checkSuperuser().catch(() => false)
        ]);
        
        if (!authenticated) {
          router.push("/learning-platform");
          return;
        }

        if (!isSuperuser) {
          router.push("/learning-dashboard");
          return;
        }

        await fetchAnalyticsData();
      } catch (error) {
        console.error("Authentication error:", error);
        setError("Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchAnalyticsData = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const [overview, staff, sections, activity] = await Promise.all([
        adminService.getOverviewStats(),
        adminService.getStaffStats(),
        adminService.getSectionCompletionStats(),
        adminService.getActivityStats(),
      ]);
      
      setOverviewStats(overview);
      setStaffProgress(staff);
      setSectionCompletion(sections);
      setActivityStats(activity);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setError("Failed to fetch analytics data");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <LoadingState message="Laster analytikk..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Kunne ikke laste analytikk"
        message={error}
        onGoHome={() => router.push("/admin-dashboard-learning")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {isMobile ? (
        <MobileHeader
          title="Analytikk Dashbord"
          userData={null}
          onLogout={() => {}}
          onBack={() => router.push("/admin-dashboard-learning")}
          showBack={true}
        />
      ) : (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin-dashboard-learning" prefetch={true}>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Tilbake til Admin Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytikk Dashbord</h1>
                <p className="text-gray-600">Læringsplattform statistikk og rapporter</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={fetchAnalyticsData}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Oppdater data
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Refresh Button */}
      {isMobile && (
        <div className="px-4 pt-4">
          <Button
            variant="outline"
            onClick={fetchAnalyticsData}
            className="w-full h-12 min-h-[44px]"
          >
            <BarChart3 className="w-5 h-5 mr-2" />
            Oppdater data
          </Button>
        </div>
      )}

      <div className={cn(
        "mx-auto",
        isMobile ? "px-4 py-4" : "max-w-7xl px-6 py-6"
      )}>
        {/* Overview Stats */}
        {overviewStats && (
          <div className={cn(
            "grid gap-4 mb-6",
            isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8"
          )}>
            <Card>
              <CardHeader className={cn(
                "flex flex-row items-center justify-between space-y-0",
                isMobile ? "pb-2 p-4" : "pb-2"
              )}>
                <CardTitle className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Totale brukere
                </CardTitle>
                <Users className={cn(
                  "text-muted-foreground",
                  isMobile ? "h-4 w-4" : "h-4 w-4"
                )} />
              </CardHeader>
              <CardContent className={cn(isMobile && "p-4 pt-0")}>
                <div className={cn(
                  "font-bold",
                  isMobile ? "text-xl" : "text-2xl"
                )}>
                  {overviewStats.total_users}
                </div>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-[10px]" : "text-xs"
                )}>
                  Registrerte brukere
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={cn(
                "flex flex-row items-center justify-between space-y-0",
                isMobile ? "pb-2 p-4" : "pb-2"
              )}>
                <CardTitle className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Aktive seksjoner
                </CardTitle>
                <BookOpen className={cn(
                  "text-muted-foreground",
                  isMobile ? "h-4 w-4" : "h-4 w-4"
                )} />
              </CardHeader>
              <CardContent className={cn(isMobile && "p-4 pt-0")}>
                <div className={cn(
                  "font-bold",
                  isMobile ? "text-xl" : "text-2xl"
                )}>
                  {overviewStats.active_sections}
                </div>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-[10px]" : "text-xs"
                )}>
                  Tilgjengelige seksjoner
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={cn(
                "flex flex-row items-center justify-between space-y-0",
                isMobile ? "pb-2 p-4" : "pb-2"
              )}>
                <CardTitle className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Fullføringsrate
                </CardTitle>
                <Target className={cn(
                  "text-muted-foreground",
                  isMobile ? "h-4 w-4" : "h-4 w-4"
                )} />
              </CardHeader>
              <CardContent className={cn(isMobile && "p-4 pt-0")}>
                <div className={cn(
                  "font-bold",
                  isMobile ? "text-xl" : "text-2xl"
                )}>
                  {overviewStats.completion_rate_percent}%
                </div>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-[10px]" : "text-xs"
                )}>
                  Gjennomsnittlig fullføring
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={cn(
                "flex flex-row items-center justify-between space-y-0",
                isMobile ? "pb-2 p-4" : "pb-2"
              )}>
                <CardTitle className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Gjennomsnittlig tid
                </CardTitle>
                <Calendar className={cn(
                  "text-muted-foreground",
                  isMobile ? "h-4 w-4" : "h-4 w-4"
                )} />
              </CardHeader>
              <CardContent className={cn(isMobile && "p-4 pt-0")}>
                <div className={cn(
                  "font-bold",
                  isMobile ? "text-xl" : "text-2xl"
                )}>
                  {overviewStats.average_time_h_m}
                </div>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-[10px]" : "text-xs"
                )}>
                  Tid brukt på læring
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={cn(
                "flex flex-row items-center justify-between space-y-0",
                isMobile ? "pb-2 p-4" : "pb-2"
              )}>
                <CardTitle className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Aktive ansatte
                </CardTitle>
                <Activity className={cn(
                  "text-muted-foreground",
                  isMobile ? "h-4 w-4" : "h-4 w-4"
                )} />
              </CardHeader>
              <CardContent className={cn(isMobile && "p-4 pt-0")}>
                <div className={cn(
                  "font-bold",
                  isMobile ? "text-xl" : "text-2xl"
                )}>
                  {overviewStats.active_employees_of_total}
                </div>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-[10px]" : "text-xs"
                )}>
                  Aktive av total
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className={cn(
          "grid gap-6",
          isMobile ? "grid-cols-1" : "lg:grid-cols-2 gap-8"
        )}>
          {/* Staff Progress */}
          <Card>
            <CardHeader className={cn(isMobile && "p-4")}>
              <CardTitle className={cn(
                "flex items-center gap-2",
                isMobile ? "text-base" : ""
              )}>
                <Users className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                Ansattprogresjon
              </CardTitle>
              <CardDescription className={cn(isMobile && "text-xs")}>
                Oversikt over ansattes læringsprogresjon
              </CardDescription>
            </CardHeader>
            <CardContent className={cn(isMobile && "p-4")}>
              <div className={cn("space-y-3", isMobile && "space-y-2")}>
                {staffProgress.length > 0 ? (
                  staffProgress.map((staff, index) => (
                    <div
                      key={index}
                      className={cn(
                        "border rounded-lg",
                        isMobile ? "p-2.5" : "p-3"
                      )}
                    >
                      <div className="flex-1">
                        <div className={cn(
                          "flex items-center justify-between mb-2",
                          isMobile && "flex-col gap-1.5 items-stretch"
                        )}>
                          <h4 className={cn(
                            "font-medium",
                            isMobile ? "text-sm" : ""
                          )}>
                            {staff.ansatt}
                          </h4>
                          <Badge
                            className={cn(
                              getStatusColor(staff.status),
                              isMobile && "text-[10px] px-1.5 py-0 self-start"
                            )}
                          >
                            {staff.status}
                          </Badge>
                        </div>
                        <div className={cn(
                          "text-gray-600 mb-2",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {staff.avdeling} • Sist aktiv: {staff.sist_aktiv ? formatDate(staff.sist_aktiv) : 'Aldri'}
                        </div>
                        <div className={cn(
                          "flex items-center gap-2",
                          isMobile && "flex-col gap-1"
                        )}>
                          <Progress
                            value={staff.progresjon_percent}
                            className={cn(
                              "flex-1",
                              isMobile && "w-full"
                            )}
                          />
                          <span className={cn(
                            "font-medium",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {staff.progresjon_percent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={cn(
                    "text-center text-gray-500",
                    isMobile ? "py-6 text-sm" : "py-8"
                  )}>
                    Ingen ansattdata tilgjengelig
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section Completion */}
          <Card>
            <CardHeader className={cn(isMobile && "p-4")}>
              <CardTitle className={cn(
                "flex items-center gap-2",
                isMobile ? "text-base" : ""
              )}>
                <BookOpen className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                Seksjonsfullføring
              </CardTitle>
              <CardDescription className={cn(isMobile && "text-xs")}>
                Fullføringsrate per læringsseksjon
              </CardDescription>
            </CardHeader>
            <CardContent className={cn(isMobile && "p-4")}>
              <div className={cn("space-y-3", isMobile && "space-y-2")}>
                {sectionCompletion.length > 0 ? (
                  sectionCompletion.map((section, index) => (
                    <div
                      key={index}
                      className={cn(
                        "border rounded-lg",
                        isMobile ? "p-2.5" : "p-3"
                      )}
                    >
                      <div className="flex-1">
                        <div className={cn(
                          "flex items-center justify-between mb-2",
                          isMobile && "flex-col gap-1.5 items-stretch"
                        )}>
                          <h4 className={cn(
                            "font-medium",
                            isMobile ? "text-sm" : ""
                          )}>
                            {section.section}
                          </h4>
                          <span className={cn(
                            "font-medium",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {section.completion_percent}%
                          </span>
                        </div>
                        <Progress
                          value={section.completion_percent}
                          className="w-full"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={cn(
                    "text-center text-gray-500",
                    isMobile ? "py-6 text-sm" : "py-8"
                  )}>
                    Ingen seksjonsdata tilgjengelig
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Chart */}
        <Card className={cn(isMobile ? "mt-6" : "mt-8")}>
          <CardHeader className={cn(isMobile && "p-4")}>
            <CardTitle className={cn(
              "flex items-center gap-2",
              isMobile ? "text-base" : ""
            )}>
              <TrendingUp className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
              7-dagers aktivitet
            </CardTitle>
            <CardDescription className={cn(isMobile && "text-xs")}>
              Daglig aktive brukere siste 7 dager
            </CardDescription>
          </CardHeader>
          <CardContent className={cn(isMobile && "p-4")}>
            {activityStats.length > 0 ? (
              <div className={cn(
                "grid gap-2",
                isMobile ? "grid-cols-7 gap-1" : "grid-cols-7 gap-2"
              )}>
                {activityStats.map((day, index) => (
                  <div key={index} className="text-center">
                    <div className={cn(
                      "text-gray-600 mb-1",
                      isMobile ? "text-[10px]" : "text-sm"
                    )}>
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={cn(
                      "bg-blue-100 rounded-lg",
                      isMobile ? "p-1.5" : "p-2"
                    )}>
                      <div className={cn(
                        "font-bold text-blue-800",
                        isMobile ? "text-sm" : "text-lg"
                      )}>
                        {day.active_users}
                      </div>
                      <div className={cn(
                        "text-blue-600",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}>
                        aktive
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn(
                "text-center text-gray-500",
                isMobile ? "py-6 text-sm" : "py-8"
              )}>
                Ingen aktivitetsdata tilgjengelig
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className={cn(isMobile ? "mt-6" : "mt-8")}>
          <CardHeader className={cn(isMobile && "p-4")}>
            <CardTitle className={cn(isMobile && "text-base")}>
              Rask handling
            </CardTitle>
            <CardDescription className={cn(isMobile && "text-xs")}>
              Vanlige administrative oppgaver
            </CardDescription>
          </CardHeader>
          <CardContent className={cn(isMobile && "p-4")}>
            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1" : "md:grid-cols-3"
            )}>
              <Link href="/admin-dashboard-learning/sections" prefetch={true}>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    isMobile && "h-12 min-h-[44px]"
                  )}
                >
                  <BookOpen className={cn("mr-2", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  Administrer seksjoner
                </Button>
              </Link>
              <Link href="/admin-dashboard-learning/lessons" prefetch={true}>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    isMobile && "h-12 min-h-[44px]"
                  )}
                >
                  <BarChart3 className={cn("mr-2", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  Administrer leksjoner
                </Button>
              </Link>
              <Link href="/admin-dashboard-learning/users" prefetch={true}>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    isMobile && "h-12 min-h-[44px]"
                  )}
                >
                  <Users className={cn("mr-2", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  Brukerprogresjon
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
