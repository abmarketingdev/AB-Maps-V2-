"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, RefreshCw, Edit, Eye, Calendar, ChevronRight, FolderOpen, FileText, Video, HelpCircle, Search, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "@/components/learning/MobileHeader";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { MobileDialog, MobileFormField, MobileSelect } from "@/components/admin";
import { cn } from "@/lib/utils";
import type { UserProgressData, AllUsersProgressResponse, IndividualUserProgressResponse, LearningSection, LearningLesson } from "@/services/learningTypes";

// =============================================================================
// TYPES
// =============================================================================

interface SectionWithLessons extends LearningSection {
  lessons: LearningLesson[];
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function getLessonIcon(kind: string) {
  switch (kind) {
    case "VIDEO":
      return <Video className="h-4 w-4 text-purple-600" />;
    case "QUIZ":
      return <HelpCircle className="h-4 w-4 text-orange-600" />;
    default:
      return <FileText className="h-4 w-4 text-blue-600" />;
  }
}

// =============================================================================
// HIERARCHICAL CONTENT SELECTOR
// =============================================================================

interface ContentSelectorProps {
  sections: SectionWithLessons[];
  type: "section" | "lesson" | "both";
  selectedSectionId: number | null;
  selectedLessonId: number | null;
  onSectionChange: (sectionId: number | null) => void;
  onLessonChange: (lessonId: number | null) => void;
  isMobile: boolean;
  showOnlyQuizzes?: boolean;
}

function ContentSelector({
  sections,
  type,
  selectedSectionId,
  selectedLessonId,
  onSectionChange,
  onLessonChange,
  isMobile,
  showOnlyQuizzes = false,
}: ContentSelectorProps) {
  const selectedSection = sections.find(s => s.id === selectedSectionId);
  const availableLessons = useMemo(() => {
    if (!selectedSection) return [];
    let lessons = selectedSection.lessons || [];
    if (showOnlyQuizzes) {
      lessons = lessons.filter(l => l.kind === "QUIZ");
    }
    return lessons;
  }, [selectedSection, showOnlyQuizzes]);

  return (
    <div className="space-y-4">
      {/* Section Selector */}
      <div className="space-y-2">
        <label className={cn(
          "block font-medium text-slate-700",
          isMobile ? "text-sm" : "text-sm"
        )}>
          <FolderOpen className="inline h-4 w-4 mr-1 text-amber-500" />
          Velg seksjon {type === "section" ? "*" : ""}
        </label>
        <Select
          value={selectedSectionId?.toString() || ""}
          onValueChange={(v) => {
            const id = v ? parseInt(v) : null;
            onSectionChange(id);
            onLessonChange(null); // Reset lesson when section changes
          }}
        >
          <SelectTrigger className={cn(isMobile && "min-h-[44px]")}>
            <SelectValue placeholder="Velg en seksjon..." />
          </SelectTrigger>
          <SelectContent>
            {sections.map((section) => (
              <SelectItem key={section.id} value={section.id.toString()}>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                  <span>{section.title}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {section.lessons?.length || 0} leksjoner
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lesson Selector - Only show if type includes lesson and section is selected */}
      {(type === "lesson" || type === "both") && selectedSectionId && (
        <div className="space-y-2">
          <label className={cn(
            "block font-medium text-slate-700",
            isMobile ? "text-sm" : "text-sm"
          )}>
            <FileText className="inline h-4 w-4 mr-1 text-blue-600" />
            Velg leksjon {type === "lesson" ? "*" : "(valgfritt)"}
          </label>
          {availableLessons.length > 0 ? (
            <Select
              value={selectedLessonId?.toString() || ""}
              onValueChange={(v) => onLessonChange(v ? parseInt(v) : null)}
            >
              <SelectTrigger className={cn(isMobile && "min-h-[44px]")}>
                <SelectValue placeholder="Velg en leksjon..." />
              </SelectTrigger>
              <SelectContent>
                {availableLessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={lesson.id.toString()}>
                    <div className="flex items-center gap-2">
                      {getLessonIcon(lesson.kind)}
                      <span>{lesson.title}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {lesson.kind}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className={cn(
              "rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center",
              isMobile ? "text-sm" : "text-sm"
            )}>
              <AlertCircle className="h-5 w-5 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-500">
                {showOnlyQuizzes 
                  ? "Ingen quizzer i denne seksjonen" 
                  : "Ingen leksjoner i denne seksjonen"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selected Summary */}
      {(selectedSectionId || selectedLessonId) && (
        <div className="rounded-lg bg-slate-100 p-3 text-sm">
          <p className="font-medium text-slate-700 mb-1">Valgt innhold:</p>
          <div className="flex items-center gap-2 text-slate-600">
            {selectedSection && (
              <>
                <FolderOpen className="h-4 w-4 text-amber-500" />
                <span>{selectedSection.title}</span>
              </>
            )}
            {selectedLessonId && availableLessons.find(l => l.id === selectedLessonId) && (
              <>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                {getLessonIcon(availableLessons.find(l => l.id === selectedLessonId)?.kind || "TEXT")}
                <span>{availableLessons.find(l => l.id === selectedLessonId)?.title}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const UserProgressManagement = () => {
  const [userProgress, setUserProgress] = useState<UserProgressData[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sections and lessons for selectors
  const [sectionsWithLessons, setSectionsWithLessons] = useState<SectionWithLessons[]>([]);
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<UserProgressData | null>(null);
  const [individualUserProgress, setIndividualUserProgress] = useState<IndividualUserProgressResponse | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  
  // Reset dialog state
  const [resetType, setResetType] = useState<"section" | "lesson">("section");
  const [resetSectionId, setResetSectionId] = useState<number | null>(null);
  const [resetLessonId, setResetLessonId] = useState<number | null>(null);
  
  // Override dialog state
  const [overrideType, setOverrideType] = useState<"completion" | "quiz">("completion");
  const [overrideSectionId, setOverrideSectionId] = useState<number | null>(null);
  const [overrideLessonId, setOverrideLessonId] = useState<number | null>(null);
  const [overrideQuizScore, setOverrideQuizScore] = useState(80);
  const [overrideTimeSpent, setOverrideTimeSpent] = useState(300);
  
  const router = useRouter();
  const isMobile = useIsMobile();

  // Fetch data on mount
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const authService = LearningAuthService.getInstance();
        
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

        await Promise.all([
          fetchUserProgress(),
          fetchSectionsAndLessons()
        ]);
      } catch (error) {
        console.error("Authentication error:", error);
        setError("Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchUserProgress = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const data: AllUsersProgressResponse = await adminService.getUserProgress();
      setUserProgress(data.users_progress);
      setTotalUsers(data.total_users);
    } catch (error) {
      console.error("Error fetching user progress:", error);
      setError("Failed to fetch user progress");
    }
  };

  const fetchSectionsAndLessons = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const [sections, lessons] = await Promise.all([
        adminService.getAdminSections(),
        adminService.getAdminLessons()
      ]);
      
      // Only include active sections
      const activeSections = sections.filter(s => s.is_active);
      
      // Group lessons by section
      const sectionsWithLessonsData: SectionWithLessons[] = activeSections.map(section => ({
        ...section,
        lessons: lessons.filter(l => l.section === section.id && l.is_active)
      }));
      
      setSectionsWithLessons(sectionsWithLessonsData);
    } catch (error) {
      console.error("Error fetching sections and lessons:", error);
    }
  };

  const fetchIndividualUserProgress = async (userId: string) => {
    try {
      const adminService = LearningAdminService.getInstance();
      const data: IndividualUserProgressResponse = await adminService.getIndividualUserProgress(userId);
      setIndividualUserProgress(data);
    } catch (error) {
      console.error("Error fetching individual user progress:", error);
      setError("Failed to fetch individual user progress");
    }
  };

  const handleResetProgress = async () => {
    if (!selectedUser) return;
    
    const contentId = resetType === "section" ? resetSectionId : resetLessonId;
    if (!contentId) {
      setError("Vennligst velg innhold å nullstille");
      return;
    }
    
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.resetUserProgress(selectedUser.user.id, resetType, contentId);
      setIsResetDialogOpen(false);
      resetResetDialogState();
      await fetchUserProgress();
    } catch (error) {
      console.error("Error resetting progress:", error);
      setError("Failed to reset progress");
    }
  };

  const handleOverrideCompletion = async () => {
    if (!selectedUser || !overrideLessonId) {
      setError("Vennligst velg en leksjon");
      return;
    }
    
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.overrideCompletion(selectedUser.user.id, overrideLessonId, overrideTimeSpent);
      setIsOverrideDialogOpen(false);
      resetOverrideDialogState();
      await fetchUserProgress();
    } catch (error) {
      console.error("Error overriding completion:", error);
      setError("Failed to override completion");
    }
  };

  const handleOverrideQuizScore = async () => {
    if (!selectedUser || !overrideLessonId) {
      setError("Vennligst velg en quiz");
      return;
    }
    
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.overrideQuizScore(selectedUser.user.id, overrideLessonId, overrideQuizScore);
      setIsOverrideDialogOpen(false);
      resetOverrideDialogState();
      await fetchUserProgress();
    } catch (error) {
      console.error("Error overriding quiz score:", error);
      setError("Failed to override quiz score");
    }
  };

  const resetResetDialogState = () => {
    setSelectedUser(null);
    setResetType("section");
    setResetSectionId(null);
    setResetLessonId(null);
  };

  const resetOverrideDialogState = () => {
    setSelectedUser(null);
    setOverrideType("completion");
    setOverrideSectionId(null);
    setOverrideLessonId(null);
    setOverrideQuizScore(80);
    setOverrideTimeSpent(300);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "inactive":
        return "bg-red-100 text-red-800 border-red-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Aldri';
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return userProgress;
    const query = searchQuery.toLowerCase();
    return userProgress.filter(user => 
      user.user.first_name.toLowerCase().includes(query) ||
      user.user.last_name.toLowerCase().includes(query) ||
      user.user.email.toLowerCase().includes(query) ||
      user.user.username.toLowerCase().includes(query)
    );
  }, [userProgress, searchQuery]);

  if (loading) {
    return <LoadingState message="Laster brukerprogresjon..." />;
  }

  if (error && !userProgress.length) {
    return (
      <ErrorState
        title="Kunne ikke laste brukerprogresjon"
        message={error}
        onGoHome={() => router.push("/admin-dashboard-learning")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      {isMobile ? (
        <MobileHeader
          title="Brukerprogresjon"
          userData={null}
          onLogout={() => {}}
          onBack={() => router.push("/admin-dashboard-learning")}
          showBack={true}
        />
      ) : (
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin-dashboard-learning" prefetch={true}>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Tilbake
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Brukerprogresjon</h1>
                <p className="text-slate-600 text-sm">Administrer brukeres læringsprogresjon</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => { fetchUserProgress(); fetchSectionsAndLessons(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Oppdater
            </Button>
          </div>
        </header>
      )}

      {/* Mobile Refresh + Search */}
      {isMobile && (
        <div className="px-4 pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk etter bruker..."
              className="pl-9 h-12"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => { fetchUserProgress(); fetchSectionsAndLessons(); }}
            className="w-full h-12"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Oppdater data
          </Button>
        </div>
      )}

      <div className={cn(
        "mx-auto",
        isMobile ? "px-4 py-4" : "max-w-7xl px-6 py-6"
      )}>
        {/* Summary + Search Header */}
        <Card className={cn("mb-6", isMobile && "mb-4")}>
          <CardContent className={cn(isMobile ? "p-4" : "pt-6")}>
            <div className={cn(
              "flex items-center justify-between",
              isMobile ? "flex-col gap-3 items-stretch" : "flex-row"
            )}>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-slate-900 text-white flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className={cn("font-bold text-slate-900", isMobile ? "text-lg" : "text-xl")}>
                    {totalUsers} brukere
                  </h3>
                  <p className={cn("text-slate-500", isMobile ? "text-xs" : "text-sm")}>
                    {filteredUsers.length} vises
                  </p>
                </div>
              </div>
              {!isMobile && (
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Søk etter bruker..."
                    className="pl-9"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User Progress Grid */}
        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3 gap-5"
        )}>
          {filteredUsers.map((user) => (
            <Card key={user.user.id} className="group hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className={cn(isMobile ? "p-4 pb-2" : "pb-2")}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold shrink-0">
                      {user.user.first_name?.[0]}{user.user.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className={cn("truncate", isMobile ? "text-base" : "text-lg")}>
                        {user.user.first_name} {user.user.last_name}
                      </CardTitle>
                      <CardDescription className={cn("truncate", isMobile ? "text-xs" : "text-sm")}>
                        {user.user.email}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={cn(getStatusColor(user.status), "shrink-0 border")}>
                    {user.status === "active" ? "Aktiv" : user.status === "inactive" ? "Inaktiv" : "Venter"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={cn(isMobile ? "p-4 pt-2" : "pt-2")}>
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700">Total progresjon</span>
                      <span className="text-sm font-bold text-slate-900">
                        {user.progress_summary.overall_progress_percent}%
                      </span>
                    </div>
                    <Progress
                      value={user.progress_summary.overall_progress_percent}
                      className="h-2"
                    />
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                      <div className="font-bold text-blue-900">
                        {user.progress_summary.sections_completed}/{user.progress_summary.total_sections}
                      </div>
                      <div className="text-[11px] text-blue-600 font-medium">Seksjoner</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                      <div className="font-bold text-emerald-900">
                        {user.progress_summary.lessons_completed}/{user.progress_summary.total_lessons}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-medium">Leksjoner</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                      <div className="font-bold text-purple-900">
                        {user.progress_summary.quiz_passed}/{user.progress_summary.quiz_attempts}
                      </div>
                      <div className="text-[11px] text-purple-600 font-medium">Quiz bestått</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2.5 text-center">
                      <div className="font-bold text-orange-900">
                        {user.progress_summary.avg_quiz_score}%
                      </div>
                      <div className="text-[11px] text-orange-600 font-medium">Quiz snitt</div>
                    </div>
                  </div>

                  {/* Time and Last Activity */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <span>Tid: {user.progress_summary.total_time_spent}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(user.last_activity)}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className={cn("flex gap-2", isMobile && "flex-col")}>
                    <Button
                      variant="outline"
                      size={isMobile ? "default" : "sm"}
                      onClick={() => {
                        setSelectedUser(user);
                        setIsResetDialogOpen(true);
                      }}
                      className={cn("flex-1", isMobile && "h-11")}
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                      Nullstill
                    </Button>
                    <Button
                      variant="outline"
                      size={isMobile ? "default" : "sm"}
                      onClick={() => {
                        setSelectedUser(user);
                        setIsOverrideDialogOpen(true);
                      }}
                      className={cn("flex-1", isMobile && "h-11")}
                    >
                      <Edit className="w-4 h-4 mr-1.5" />
                      Overstyr
                    </Button>
                    <Button
                      variant="ghost"
                      size={isMobile ? "default" : "sm"}
                      onClick={() => {
                        setSelectedUser(user);
                        fetchIndividualUserProgress(user.user.id);
                        setIsDetailDialogOpen(true);
                      }}
                      className={cn(isMobile && "h-11")}
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      Detaljer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchQuery ? "Ingen brukere funnet" : "Ingen brukere"}
              </h3>
              <p className="text-slate-500">
                {searchQuery 
                  ? `Ingen brukere matcher søket "${searchQuery}"`
                  : "Ingen brukerprogresjon er tilgjengelig."
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ================================================================== */}
      {/* RESET PROGRESS DIALOG */}
      {/* ================================================================== */}
      <MobileDialog
        open={isResetDialogOpen}
        onOpenChange={(open) => {
          setIsResetDialogOpen(open);
          if (!open) resetResetDialogState();
        }}
        title="Nullstill progresjon"
        description={`Nullstill progresjon for ${selectedUser?.user.first_name} ${selectedUser?.user.last_name}`}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsResetDialogOpen(false);
                resetResetDialogState();
              }}
              className={cn(isMobile && "w-full h-12")}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetProgress}
              disabled={resetType === "section" ? !resetSectionId : !resetLessonId}
              className={cn(isMobile && "w-full h-12")}
            >
              Nullstill
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Reset Type Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Hva vil du nullstille?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setResetType("section");
                  setResetLessonId(null);
                }}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  resetType === "section"
                    ? "border-red-500 bg-red-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <FolderOpen className={cn(
                  "h-6 w-6 mb-2",
                  resetType === "section" ? "text-red-600" : "text-amber-500"
                )} />
                <div className="font-semibold text-slate-900">Hel seksjon</div>
                <div className="text-xs text-slate-500 mt-1">
                  Nullstiller alle leksjoner og quizzer i seksjonen
                </div>
              </button>
              <button
                type="button"
                onClick={() => setResetType("lesson")}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  resetType === "lesson"
                    ? "border-red-500 bg-red-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <FileText className={cn(
                  "h-6 w-6 mb-2",
                  resetType === "lesson" ? "text-red-600" : "text-blue-600"
                )} />
                <div className="font-semibold text-slate-900">Enkelt leksjon</div>
                <div className="text-xs text-slate-500 mt-1">
                  Nullstiller kun valgt leksjon
                </div>
              </button>
            </div>
          </div>

          {/* Content Selector */}
          <ContentSelector
            sections={sectionsWithLessons}
            type={resetType}
            selectedSectionId={resetSectionId}
            selectedLessonId={resetLessonId}
            onSectionChange={setResetSectionId}
            onLessonChange={setResetLessonId}
            isMobile={isMobile}
          />

          {/* Warning */}
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Advarsel</p>
                <p className="text-sm text-red-700 mt-1">
                  {resetType === "section"
                    ? "Dette vil nullstille all progresjon for denne seksjonen, inkludert alle leksjoner og quiz-forsøk."
                    : "Dette vil nullstille progresjonen for denne leksjonen og eventuelle quiz-forsøk."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </MobileDialog>

      {/* ================================================================== */}
      {/* OVERRIDE DIALOG */}
      {/* ================================================================== */}
      <MobileDialog
        open={isOverrideDialogOpen}
        onOpenChange={(open) => {
          setIsOverrideDialogOpen(open);
          if (!open) resetOverrideDialogState();
        }}
        title="Overstyr progresjon"
        description={`Overstyr progresjon for ${selectedUser?.user.first_name} ${selectedUser?.user.last_name}`}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsOverrideDialogOpen(false);
                resetOverrideDialogState();
              }}
              className={cn(isMobile && "w-full h-12")}
            >
              Avbryt
            </Button>
            <Button
              onClick={overrideType === "completion" ? handleOverrideCompletion : handleOverrideQuizScore}
              disabled={!overrideLessonId}
              className={cn(isMobile && "w-full h-12")}
            >
              Overstyr
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Override Type Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Hva vil du overstyre?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setOverrideType("completion");
                  setOverrideSectionId(null);
                  setOverrideLessonId(null);
                }}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  overrideType === "completion"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <FileText className={cn(
                  "h-6 w-6 mb-2",
                  overrideType === "completion" ? "text-emerald-600" : "text-blue-600"
                )} />
                <div className="font-semibold text-slate-900">Fullføring</div>
                <div className="text-xs text-slate-500 mt-1">
                  Marker en leksjon som fullført
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverrideType("quiz");
                  setOverrideSectionId(null);
                  setOverrideLessonId(null);
                }}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  overrideType === "quiz"
                    ? "border-orange-500 bg-orange-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <HelpCircle className={cn(
                  "h-6 w-6 mb-2",
                  overrideType === "quiz" ? "text-orange-600" : "text-orange-500"
                )} />
                <div className="font-semibold text-slate-900">Quiz-poeng</div>
                <div className="text-xs text-slate-500 mt-1">
                  Sett en ny quiz-poengsum
                </div>
              </button>
            </div>
          </div>

          {/* Content Selector */}
          <ContentSelector
            sections={sectionsWithLessons}
            type="lesson"
            selectedSectionId={overrideSectionId}
            selectedLessonId={overrideLessonId}
            onSectionChange={setOverrideSectionId}
            onLessonChange={setOverrideLessonId}
            isMobile={isMobile}
            showOnlyQuizzes={overrideType === "quiz"}
          />

          {/* Additional Fields */}
          {overrideType === "completion" && overrideLessonId && (
            <MobileFormField label="Tid brukt (sekunder)" helperText="Valgfritt - tid brukeren brukte på leksjonen">
              <Input
                type="number"
                value={overrideTimeSpent}
                onChange={(e) => setOverrideTimeSpent(parseInt(e.target.value) || 300)}
                placeholder="300"
                min="0"
                className={cn(isMobile && "h-11")}
              />
            </MobileFormField>
          )}

          {overrideType === "quiz" && overrideLessonId && (
            <MobileFormField label="Quiz-poengsum (%)" helperText="Sett poengsum fra 0 til 100">
              <Input
                type="number"
                value={overrideQuizScore}
                onChange={(e) => setOverrideQuizScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                placeholder="80"
                min="0"
                max="100"
                className={cn(isMobile && "h-11")}
              />
              <div className="mt-2">
                <Progress value={overrideQuizScore} className="h-2" />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0%</span>
                  <span className={cn(
                    "font-medium",
                    overrideQuizScore >= 80 ? "text-emerald-600" : "text-orange-600"
                  )}>
                    {overrideQuizScore}% {overrideQuizScore >= 80 ? "(Bestått)" : "(Ikke bestått)"}
                  </span>
                  <span>100%</span>
                </div>
              </div>
            </MobileFormField>
          )}
        </div>
      </MobileDialog>

      {/* ================================================================== */}
      {/* INDIVIDUAL USER PROGRESS DETAIL DIALOG */}
      {/* ================================================================== */}
      <MobileDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        title="Detaljert progresjon"
        description={`${selectedUser?.user.first_name} ${selectedUser?.user.last_name}`}
        maxWidth="max-w-4xl"
        footer={
          <Button
            variant="outline"
            onClick={() => setIsDetailDialogOpen(false)}
            className={cn(isMobile && "w-full h-12")}
          >
            Lukk
          </Button>
        }
      >
        {individualUserProgress && (
          <div className="space-y-6">
            {/* Section Progress */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-amber-500" />
                Seksjonsprogresjon
              </h3>
              <div className="space-y-2">
                {individualUserProgress.section_progress.map((section) => (
                  <Card key={section.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-900">{section.section_title}</h4>
                        <Badge className={cn(getStatusColor(section.status.toLowerCase()), "border")}>
                          {section.status === "COMPLETED" ? "Fullført" : section.status === "IN_PROGRESS" ? "I gang" : "Ikke startet"}
                        </Badge>
                      </div>
                      <Progress value={section.progress_percent} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{section.progress_percent}% fullført</span>
                        <span>Tid: {Math.floor(section.time_spent_seconds / 60)}m</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Lesson Progress */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Leksjonsprogresjon
              </h3>
              <div className="space-y-2">
                {individualUserProgress.lesson_progress.map((lesson) => (
                  <Card key={lesson.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-slate-900">{lesson.lesson_title}</h4>
                          <p className="text-xs text-slate-500">{lesson.section_title}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={cn(getStatusColor(lesson.status.toLowerCase()), "border")}>
                            {lesson.status === "COMPLETED" ? "Fullført" : lesson.status === "IN_PROGRESS" ? "I gang" : "Ikke startet"}
                          </Badge>
                          <p className="text-xs text-slate-500 mt-1">
                            {Math.floor(lesson.time_spent_seconds / 60)}m brukt
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Quiz Attempts */}
            {individualUserProgress.quiz_attempts.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-orange-500" />
                  Quiz-forsøk
                </h3>
                <div className="space-y-2">
                  {individualUserProgress.quiz_attempts.map((quiz) => (
                    <Card key={quiz.id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-slate-900">{quiz.lesson_title}</h4>
                            <p className="text-xs text-slate-500">
                              Varighet: {Math.floor(quiz.duration_seconds / 60)}m {quiz.duration_seconds % 60}s
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={cn(
                              quiz.passed 
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                                : "bg-red-100 text-red-800 border-red-200",
                              "border"
                            )}>
                              {quiz.score_percent}% - {quiz.passed ? "Bestått" : "Ikke bestått"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </MobileDialog>
    </div>
  );
};

export default UserProgressManagement;
