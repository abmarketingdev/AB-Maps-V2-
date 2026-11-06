"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningService, type DetailedProgress, type CurrentPath, type UserOverview } from "@/services/learningService";
import { cn } from "@/lib/utils";
import LessonViewer from "@/components/learning/LessonViewer";
import LessonNavigationDrawer from "@/components/learning/LessonNavigationDrawer";
import MobileBottomNav from "@/components/learning/MobileBottomNav";
import MobileHeader from "@/components/learning/MobileHeader";
import LoadingState from "@/components/learning/LoadingState";
import LessonShell from "@/components/learning/LessonShell";
import AcademyHeader, { AcademyBrand, AcademyAvatar } from "@/components/learning/AcademyHeader";
import FormattedContent from "@/components/learning/FormattedContent";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LearningSection, LearningLesson, LearningProgress, LearningUser, GroupedSectionsResponse } from "@/services/learningTypes";
import { useAuth } from "@/lib/auth/AuthContext";

// Helper to format time
const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}t ${mins}m` : `${hours}t`;
};

// Helper to format date
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "Ikke startet";
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "I dag";
  if (diffDays === 1) return "I går";
  if (diffDays < 7) return `${diffDays} dager siden`;
  
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
};

const LearningDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sections, setSections] = useState<LearningSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState<LearningSection | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(new Set());
  const [userData, setUserData] = useState<LearningUser | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  
  // NEW: Extended data from APIs
  const [userOverview, setUserOverview] = useState<UserOverview | null>(null);
  const [detailedProgress, setDetailedProgress] = useState<DetailedProgress | null>(null);
  const [currentPath, setCurrentPath] = useState<CurrentPath | null>(null);
  
  // Campaign-related state
  const [groupedData, setGroupedData] = useState<GroupedSectionsResponse | null>(null);
  const [activeCampaignTab, setActiveCampaignTab] = useState<string | null>(null);
  
  // Mobile lesson navigation drawer state
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false);
  // Tabs: Moduler, Ressurser, Diskusjoner, Sertifikater (LearnSpace design)
  const [mainTab, setMainTab] = useState<'moduler' | 'ressurser' | 'diskusjoner' | 'sertifikater'>('moduler');
  
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Check authentication and fetch data
  useEffect(() => {
    const checkAuthAndFetchProgress = async () => {
      try {
        const authService = LearningAuthService.getInstance();
        const authenticated = await authService.isAuthenticated();
        console.log("Learning dashboard auth check:", authenticated);
        setIsAuthenticated(authenticated);

        if (authenticated) {
          // Fetch all data in parallel for faster loading
          await fetchAllData();
        }
      } catch (error) {
        console.error("Authentication error:", error);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthAndFetchProgress();
  }, []);

  const fetchAllData = async () => {
    try {
      const learningService = LearningService.getInstance();
      const authService = LearningAuthService.getInstance();
      
      // Fetch all data in parallel
      const [
        groupedSections,
        progressData,
        userOverviewData,
        detailedProgressData,
        currentPathData,
        currentUser
      ] = await Promise.all([
        learningService.getGroupedSections().catch(e => { console.error("getGroupedSections failed:", e); return null; }),
        learningService.getUserProgress().catch(e => { console.error("getUserProgress failed:", e); return null; }),
        learningService.getUserOverview().catch(e => { console.error("getUserOverview failed:", e); return null; }),
        learningService.getDetailedProgress().catch(e => { console.error("getDetailedProgress failed:", e); return null; }),
        learningService.getCurrentPath().catch(e => { console.error("getCurrentPath failed:", e); return null; }),
        authService.getCurrentUser().catch(e => { console.error("getCurrentUser failed:", e); return null; }),
      ]);

      console.log("Grouped sections received:", groupedSections);
      console.log("Progress data received:", progressData);
      console.log("User overview received:", userOverviewData);
      console.log("Detailed progress received:", detailedProgressData);
      console.log("Current path received:", currentPathData);

      // Set extended data
      if (userOverviewData) setUserOverview(userOverviewData);
      if (detailedProgressData) setDetailedProgress(detailedProgressData);
      if (currentPathData) setCurrentPath(currentPathData);
      if (currentUser) setUserData(currentUser);
      if (progressData) setProgress(progressData);

      if (groupedSections) {
        // Flatten all sections from all campaigns
        const allSections = groupedSections.campaigns.flatMap(campaign => campaign.sections);

        // Get lessons for each section
        const sectionsWithLessons = await Promise.all(
          allSections.map(async (section: LearningSection) => {
            try {
              const sectionDetail = await learningService.getSection(section.id);
              return sectionDetail;
            } catch (error) {
              console.error(`Error fetching section ${section.id}:`, error);
              return section;
            }
          })
        );

        setSections(sectionsWithLessons);
        setGroupedData(groupedSections);
        
        // Set first campaign as active tab
        if (groupedSections.campaigns.length > 0 && activeCampaignTab === null) {
          setActiveCampaignTab(groupedSections.campaigns[0].id ?? 'general');
        }
        
        // Parse completed sections and lessons
        const completedSectionsSet = new Set<number>();
        const completedLessonsSet = new Set<number>();
        
        sectionsWithLessons.forEach(section => {
          if (section.status === 'COMPLETED') {
            completedSectionsSet.add(section.id);
          }
          
          if (section.lessons) {
            section.lessons.forEach(lesson => {
              if (lesson.status === 'COMPLETED') {
                completedLessonsSet.add(lesson.id);
              }
            });
          }
        });
        
        // Fallback: Parse from campaign progress structure
        if (progressData?.campaigns) {
          progressData.campaigns.forEach((campaignProgress) => {
            if (campaignProgress.completed_sections > 0) {
              sectionsWithLessons.forEach(section => {
                if (section.campaign_id === campaignProgress.campaign_id && section.status === 'COMPLETED') {
                  completedSectionsSet.add(section.id);
                }
              });
            }
          });
        }
        
        setCompletedSections(completedSectionsSet);
        setCompletedLessons(completedLessonsSet);
        
        console.log("Completed sections:", Array.from(completedSectionsSet));
        console.log("Completed lessons:", Array.from(completedLessonsSet));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    const authService = LearningAuthService.getInstance();
    authService.logout();
    router.push("/login");
  };

  const submitQuiz = async (lessonId: number, score: number, duration: number) => {
    try {
      const learningService = LearningService.getInstance();
      await learningService.submitQuiz(lessonId, score, duration);
      
      const currentLesson = currentSection?.lessons?.find(lesson => lesson.id === lessonId);
      const passThreshold = currentLesson?.pass_threshold_percent || 80;
      
      if (score >= passThreshold) {
        await handleLessonComplete(lessonId);
      } else {
        await fetchAllData();
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
    }
  };

  const handleLessonComplete = async (lessonId: number) => {
    try {
      const learningService = LearningService.getInstance();
      await learningService.completeLesson(lessonId);
      
      setCompletedLessons(prev => new Set([...prev, lessonId]));
      
      if (currentSection?.lessons) {
        const allLessonsCompleted = currentSection.lessons.every(lesson => 
          completedLessons.has(lesson.id) || lesson.id === lessonId
        );
        
        if (allLessonsCompleted && currentSection.id) {
          setCompletedSections(prev => new Set([...prev, currentSection.id]));
          
          setSections(prevSections => 
            prevSections.map(section => 
              section.id === currentSection.id 
                ? { ...section, status: 'COMPLETED' as const }
                : section
            )
          );
        }
      }
      
      await fetchAllData();
      
      console.log("Lesson completed successfully:", lessonId);
    } catch (error) {
      console.error("Error completing lesson:", error);
    }
  };

  const goToNextLesson = () => {
    if (currentSection && currentSection.lessons && currentLessonIndex < currentSection.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  };

  const goToPreviousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  const handleLessonSelect = (index: number) => {
    if (!currentSection || !currentSection.lessons) return;
    
    if (index === 0) {
      setCurrentLessonIndex(index);
      return;
    }
    
    const previousLesson = currentSection.lessons[index - 1];
    const isUnlocked = completedLessons.has(previousLesson.id);
    
    if (isUnlocked) {
      setCurrentLessonIndex(index);
    } else {
      alert("Du må fullføre forrige leksjon først!");
    }
  };

  const handleSectionClick = async (section: LearningSection) => {
    // Start the first lesson when clicking a section
    if (section.lessons && section.lessons.length > 0) {
      const firstLesson = section.lessons[0];
      try {
        const learningService = LearningService.getInstance();
        await learningService.startLesson(firstLesson.id);
      } catch (e) {
        console.log("Could not start lesson:", e);
      }
    }
    setCurrentSection(section);
    setCurrentLessonIndex(0);
  };

  const handleGoHome = () => {
    setCurrentSection(null);
    setCurrentLessonIndex(0);
  };

  // Redirect to login if not authenticated
  if (!isCheckingAuth && !isAuthenticated) {
    console.log("Not authenticated, redirecting to login");
    router.push("/ab-academy/login");
    return null;
  }

  // Show loading state
  if (isCheckingAuth || loading) {
    return <LoadingState message="Laster AB Academy…" />;
  }

  // Section Detail View – AB Academy lesson viewer (same chrome as /ab-academy/<section>)
  if (currentSection) {
    const curLessons = currentSection.lessons || [];
    const currentLesson = curLessons[currentLessonIndex];
    const prevLesson = curLessons[currentLessonIndex - 1];
    const nextLesson = curLessons[currentLessonIndex + 1];
    const currentCampaign = groupedData?.campaigns.find(c => (c.id ?? "general") === (currentSection.campaign_id ?? "general"));

    return (
      <LessonShell
        sectionTitle={currentSection.title}
        sectionOrder={currentSection.order}
        crumbRoot={currentCampaign?.name ?? "Generell opplæring"}
        lessons={curLessons}
        currentLessonIndex={currentLessonIndex}
        completedLessons={completedLessons}
        isMobile={isMobile}
        userName={userData?.first_name || user?.username}
        onBack={handleGoHome}
        onLessonSelect={handleLessonSelect}
        mobileLessonPicker={
          <LessonNavigationDrawer
            lessons={curLessons}
            currentLessonIndex={currentLessonIndex}
            completedLessons={completedLessons}
            onLessonSelect={handleLessonSelect}
            sectionTitle={currentSection.title}
            open={lessonDrawerOpen}
            onOpenChange={setLessonDrawerOpen}
          />
        }
        bottomNav={
          curLessons.length > 0 && currentLesson ? (
            <MobileBottomNav
              hasPrevious={currentLessonIndex > 0}
              hasNext={currentLessonIndex < curLessons.length - 1}
              isCompleted={completedLessons.has(currentLesson.id)}
              onPrevious={goToPreviousLesson}
              onComplete={() => handleLessonComplete(currentLesson.id)}
              onNext={goToNextLesson}
              lessonProgress={`${currentLessonIndex + 1}/${curLessons.length}`}
              isQuiz={currentLesson.kind === "QUIZ"}
              quizSubmitted={false}
            />
          ) : null
        }
      >
        {currentLesson && (
          <LessonViewer
            lesson={currentLesson}
            isCompleted={completedLessons.has(currentLesson.id)}
            isUnlocked
            onComplete={() => handleLessonComplete(currentLesson.id)}
            onNext={goToNextLesson}
            onPrevious={goToPreviousLesson}
            onGoHome={handleGoHome}
            hasNext={currentLessonIndex < curLessons.length - 1}
            hasPrevious={currentLessonIndex > 0}
            hideHeader
            previousLessonTitle={prevLesson?.title}
            nextLessonTitle={nextLesson?.title}
            certificationLabel={currentCampaign?.name ?? currentSection.title}
          />
        )}
      </LessonShell>
    );
  }

  // Sections Grid View – LearnSpace design (student_learning_dashboard)
  const activeCampaign = groupedData?.campaigns.find(c => (c.id ?? 'general') === activeCampaignTab);
  const campaignProgress = progress?.campaigns?.find(cp => (cp.campaign_id ?? 'general') === activeCampaignTab);
  const activeCampaignSections = sections.filter(s => (s.campaign_id ?? 'general') === activeCampaignTab);
  const completedInCampaign = activeCampaignSections.filter(s => completedSections.has(s.id));
  const toCompleteInCampaign = activeCampaignSections.filter(s => !completedSections.has(s.id));
  const overallPercent = progress?.overall_progress_percent ?? 0;
  const userName = userData?.first_name || userOverview?.first_name || user?.username?.split('.')[0] || 'Bruker';
  
  // Get learning streak and stats from detailed progress
  const learningStreak = detailedProgress?.learning_streak_days ?? currentPath?.learning_streak_days ?? 0;
  const totalTimeMinutes = currentPath?.total_learning_time_minutes ?? Math.round((detailedProgress?.lesson_progress?.total_time_spent || 0) / 60);
  const lastLearningDate = currentPath?.last_learning_date;
  const quizAvgScore = detailedProgress?.quiz_stats?.avg_score ?? 0;
  const lessonsCompleted = detailedProgress?.lesson_progress?.completed_lessons ?? 0;
  const totalLessons = detailedProgress?.lesson_progress?.total_lessons ?? 0;

  return (
    <div className="h-[100dvh] bg-[#F7F7F5] text-[#0A0A0A] flex flex-col overflow-hidden">
      {/* AB Academy header: phone keeps its menu sheets, desktop the shared bar */}
      {isMobile ? (
        <MobileHeader title="AB Academy" brand userData={userData} onLogout={handleLogout} />
      ) : (
        <AcademyHeader
          right={
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold leading-none">{userData?.first_name} {userData?.last_name?.[0] ? `${userData.last_name[0]}.` : ''}</p>
                <p className="text-xs text-neutral-500 mt-1 leading-none">Sist aktiv: {formatDate(lastLearningDate ?? null).toLowerCase()}</p>
              </div>
              <AcademyAvatar name={userData?.first_name || user?.username} className="h-9 w-9" />
            </div>
          }
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar – desktop only (LearnSpace) */}
        <aside className={cn(
          "flex-shrink-0 bg-white border-r border-black/[0.08] flex flex-col h-full overflow-y-auto z-20",
          isMobile ? "hidden" : "w-80"
        )}>
          <div className="p-6 flex flex-col gap-8">
            {/* Progress circle + greeting */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative size-40">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                  <path className="text-black/[0.06]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  <path className="text-emerald-600" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${overallPercent}, 100`} strokeLinecap="round" strokeWidth="2.5" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tracking-tight">{Math.round(overallPercent)}%</span>
                  <span className="text-xs text-neutral-500 font-medium uppercase tracking-wide mt-1">Totalt</span>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-sm font-semibold">Klar for feltet, {userName}?</h2>
                <p className="text-xs text-neutral-500 mt-1">
                  {lessonsCompleted} av {totalLessons} leksjoner fullført
                </p>
              </div>
            </div>
            
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#F7F7F5] rounded-xl p-3">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">local_fire_department</span>
                <p className="text-lg font-bold mt-1">{learningStreak}</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Dagers rekke</p>
              </div>
              <div className="bg-[#F7F7F5] rounded-xl p-3">
                <span className="material-symbols-outlined text-blue-500 text-[20px]">schedule</span>
                <p className="text-lg font-bold mt-1">{formatTime(totalTimeMinutes)}</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Total tid</p>
              </div>
              <div className="bg-[#F7F7F5] rounded-xl p-3">
                <span className="material-symbols-outlined text-emerald-500 text-[20px]">quiz</span>
                <p className="text-lg font-bold mt-1">{Math.round(quizAvgScore)}%</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Quiz snitt</p>
              </div>
            </div>
            
            {/* Aktive kampanjer */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Aktive kampanjer</h3>
              {groupedData?.campaigns?.map((c) => {
                const key = c.id ?? 'general';
                const cp = progress?.campaigns?.find(x => (x.campaign_id ?? 'general') === key);
                const pct = cp?.progress_percent ?? 0;
                const total = cp?.total_sections ?? c.sections?.length ?? 1;
                const completed = cp?.completed_sections ?? 0;
                const isActive = activeCampaignTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveCampaignTab(key)}
                    className={cn(
                      "group text-left p-3 rounded-lg transition-all",
                      isActive ? "bg-emerald-50/70 ring-1 ring-emerald-200" : "hover:bg-black/[0.03]"
                    )}
                  >
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className={cn("text-xs font-semibold", pct >= 80 ? "text-emerald-700" : "text-neutral-500")}>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/[0.06] rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-emerald-600" : "bg-emerald-600")} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1.5">{completed}/{total} moduler fullført</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-6 border-t border-black/[0.08]">
              <button 
                className="w-full h-10 px-4 rounded-lg border border-black/[0.12] bg-white text-sm font-semibold text-[#0A0A0A] hover:bg-black/[0.04] transition-colors flex items-center justify-center gap-2"
                onClick={() => {
                  // Check user type and redirect to appropriate dashboard
                  if (user?.user_type === "employee") {
                    router.push("/employee");
                  } else if (user?.user_type === "manager") {
                    router.push("/");
                  } else {
                    // Fallback: try to go back in history, or go to login
                    if (window.history.length > 1) {
                      router.back();
                    } else {
                      router.push("/login");
                    }
                  }
                }}
              >
                <span className="material-symbols-outlined text-[18px]">exit_to_app</span>
                Tilbake til dashboard
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10">
            <div className="max-w-6xl mx-auto">
              {/* Phone: the sidebar is hidden, so show the overall progress on top */}
              {isMobile && (
                <div className="mb-5 flex items-center gap-4 rounded-xl border border-black/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="relative size-16 shrink-0">
                    <svg className="size-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                      <path className="text-black/[0.06]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                      <path className="text-emerald-600" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${overallPercent}, 100`} strokeLinecap="round" strokeWidth="3.5" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{Math.round(overallPercent)}%</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Klar for feltet, {userName}?</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{lessonsCompleted} av {totalLessons} leksjoner fullført</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-amber-500">local_fire_department</span>{learningStreak} d</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-neutral-400">schedule</span>{formatTime(totalTimeMinutes)}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-emerald-600">quiz</span>{Math.round(quizAvgScore)}%</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Campaign title + Stats + Tabs */}
              <div className="mb-8 md:mb-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-8">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-1">{activeCampaign?.name ?? 'Generell opplæring'}</h2>
                    <p className="text-neutral-500 text-sm">
                      {toCompleteInCampaign.length > 0 
                        ? `${toCompleteInCampaign.length} modul${toCompleteInCampaign.length !== 1 ? 'er' : ''} gjenstår`
                        : 'Alle moduler fullført! 🎉'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {learningStreak > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                        <span className="material-symbols-outlined text-amber-500 text-[18px]">local_fire_department</span>
                        <span className="text-sm font-semibold text-amber-700">{learningStreak} dagers rekke!</span>
                      </div>
                    )}
                    <div className="text-right px-4 py-2 bg-white rounded-lg border border-black/[0.08] shadow-sm">
                      <span className="block text-xs text-neutral-500 font-medium uppercase">Progresjon</span>
                      <span className="block text-sm font-bold">{Math.round(campaignProgress?.progress_percent ?? 0)}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Mobile campaign selector */}
                {isMobile && groupedData && groupedData.campaigns.length > 1 && (
                  <div className="mb-4 overflow-x-auto -mx-4 px-4">
                    <div className="flex gap-2 pb-2">
                      {groupedData.campaigns.map((c) => {
                        const key = c.id ?? 'general';
                        const isActive = activeCampaignTab === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setActiveCampaignTab(key)}
                            className={cn(
                              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                              isActive 
                                ? "bg-emerald-600 text-white" 
                                : "bg-white border border-black/[0.08] text-neutral-600"
                            )}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-1 border-b border-black/[0.08] overflow-x-auto">
                  {(['moduler', 'ressurser', 'diskusjoner', 'sertifikater'] as const).map((t) => (
                    <button key={t} onClick={() => setMainTab(t)} className={cn("px-3 md:px-4 py-2.5 text-sm font-medium relative top-[1px] whitespace-nowrap border-b-2 transition-colors", mainTab === t ? "border-emerald-600 text-[#0A0A0A]" : "border-transparent text-neutral-500 hover:text-[#0A0A0A]")}>
                      {t === 'moduler' && 'Moduler'}
                      {t === 'ressurser' && 'Ressurser'}
                      {t === 'diskusjoner' && 'Diskusjoner'}
                      {t === 'sertifikater' && 'Sertifikater'}
                    </button>
                  ))}
                </div>
              </div>

              {mainTab === 'moduler' && (
                <>
                  {/* Skal fullføres */}
                  {toCompleteInCampaign.length > 0 && (
                    <div className="mb-10 md:mb-12">
                      <div className="flex items-center gap-3 mb-4 md:mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Skal fullføres</h3>
                        <span className="px-2 py-0.5 rounded-full bg-black/[0.06] text-xs font-bold text-neutral-600">{toCompleteInCampaign.length}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                        {toCompleteInCampaign.map((section) => {
                          const prev = activeCampaignSections.find(s => s.order === (section.order ?? 0) - 1);
                          const prevDone = prev ? completedSections.has(prev.id) : true;
                          const onlyOne = activeCampaignSections.filter(s => s.is_active).length === 1;
                          const isUnlocked = !!section.is_active && ((section.order ?? 0) === 1 || prevDone || onlyOne);
                          const isInProgress = section.status === 'IN_PROGRESS';
                          const lessonCount = section.lessons?.length || section.lesson_count || 0;
                          const completedLessonsInSection = section.lessons?.filter(l => completedLessons.has(l.id)).length || 0;
                          const progressW = lessonCount > 0 ? Math.round((completedLessonsInSection / lessonCount) * 100) : 0;
                          const sectionDuration = section.duration_estimate_minutes || section.total_duration_minutes || 0;
                          
                          return (
                            <div
                              key={section.id}
                              onClick={() => isUnlocked && handleSectionClick(section)}
                              className={cn(
                                "group bg-white border rounded-xl p-5 min-h-[13rem] md:h-56 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md",
                                isUnlocked ? "border-black/[0.08] hover:border-emerald-300" : "border-black/[0.08] opacity-70 select-none cursor-not-allowed"
                              )}
                            >
                              <div className="absolute top-0 left-0 w-full h-1 bg-black/[0.05]">
                                <div className={cn("h-full transition-all", isInProgress ? "bg-amber-400" : progressW > 0 ? "bg-emerald-500" : "bg-transparent")} style={{ width: `${progressW}%` }} />
                              </div>
                              <div>
                                <div className="flex justify-between items-start mb-3 md:mb-4">
                                  <span className="text-2xl md:text-3xl">{section.icon_emoji || '📚'}</span>
                                  {isUnlocked ? (
                                    <span className={cn("px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded", isInProgress ? "bg-amber-50 text-amber-700" : "bg-black/[0.05] text-neutral-600")}>
                                      {isInProgress ? 'I gang' : 'Ikke startet'}
                                    </span>
                                  ) : (
                                    <span className="material-symbols-outlined text-neutral-400">lock</span>
                                  )}
                                </div>
                                <h4 className="text-base md:text-lg font-bold leading-tight mb-2">{section.title}</h4>
                                <p className="text-xs md:text-sm text-neutral-500 line-clamp-2">{section.description || 'Start denne modulen for å lære mer.'}</p>
                              </div>
                              <div className="flex items-center justify-between mt-4 pt-3 md:pt-4 border-t border-dashed border-black/[0.08]">
                                <div className="flex items-center gap-3 text-xs font-medium text-neutral-500">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                    {sectionDuration} min
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">menu_book</span>
                                    {lessonCount} leksjoner
                                  </span>
                                </div>
                                {isUnlocked ? (
                                  <div className={cn("size-8 rounded-full flex items-center justify-center transition-transform", isInProgress ? "bg-emerald-600 text-white group-hover:translate-x-1" : "bg-white border border-black/[0.12] text-[#0A0A0A] group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 group-hover:translate-x-1")}>
                                    <span className="material-symbols-outlined text-[18px]">{isInProgress ? 'arrow_forward' : 'play_arrow'}</span>
                                  </div>
                                ) : (
                                  <div className="size-8 rounded-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[18px] text-neutral-300">lock</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fullført */}
                  {completedInCampaign.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4 md:mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Fullført</h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">{completedInCampaign.length}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                        {completedInCampaign.map((section) => (
                          <div key={section.id} onClick={() => handleSectionClick(section)} className="group bg-white border border-black/[0.08] rounded-xl p-4 h-44 md:h-48 flex flex-col justify-between cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-colors">
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div className="size-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                  <span className="material-symbols-outlined text-[20px]">check</span>
                                </div>
                                <span className="text-xs text-neutral-400">{formatDate(section.updated_at)}</span>
                              </div>
                              <h4 className="text-base font-bold leading-tight mb-1 text-neutral-600 group-hover:text-[#0A0A0A]">{section.title}</h4>
                              <p className="text-xs text-neutral-400">
                                {section.lessons?.length || section.lesson_count || 0} leksjoner fullført
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Bestått</span>
                              <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide ml-auto">Se gjennom →</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {toCompleteInCampaign.length === 0 && completedInCampaign.length === 0 && (
                    <div className="py-16 text-center bg-white border border-dashed border-black/[0.12] rounded-xl">
                      <span className="material-symbols-outlined text-[56px] text-emerald-600/40 mb-3 block">school</span>
                      <h3 className="text-lg font-semibold text-neutral-600 mb-2">Ingen moduler ennå</h3>
                      <p className="text-neutral-500">Det er ingen moduler tilgjengelig for denne kampanjen ennå.</p>
                    </div>
                  )}
                </>
              )}

              {mainTab !== 'moduler' && (
                <div className="py-16 text-center text-neutral-500 bg-white border border-dashed border-black/[0.12] rounded-xl">
                  <span className="material-symbols-outlined text-[48px] text-neutral-300 mb-4 block">construction</span>
                  <h3 className="text-lg font-semibold text-neutral-600 mb-2">Kommer snart</h3>
                  <p className="text-sm">Denne seksjonen er under utvikling.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LearningDashboard;
