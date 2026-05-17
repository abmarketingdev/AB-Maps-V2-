"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningService, type DetailedProgress, type CurrentPath, type UserOverview } from "@/services/learningService";
import { cn } from "@/lib/utils";
import LessonViewer from "@/components/learning/LessonViewer";
import LessonNavigationDrawer from "@/components/learning/LessonNavigationDrawer";
import MobileBottomNav from "@/components/learning/MobileBottomNav";
import MobileHeader from "@/components/learning/MobileHeader";
import LoadingState from "@/components/learning/LoadingState";
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
    router.push("/learning-platform/login");
    return null;
  }

  // Show loading state
  if (isCheckingAuth || loading) {
    return <LoadingState message="Laster læringsplattform..." />;
  }

  // Section Detail View – AB Academy (student_lesson_viewer)
  if (currentSection) {
    const curLessons = currentSection.lessons || [];
    const currentLesson = curLessons[currentLessonIndex];
    const prevLesson = curLessons[currentLessonIndex - 1];
    const nextLesson = curLessons[currentLessonIndex + 1];
    const currentCampaign = groupedData?.campaigns.find(c => (c.id ?? "general") === (currentSection.campaign_id ?? "general"));
    const completedInSection = curLessons.filter(l => completedLessons.has(l.id)).length;
    const progressPercent = curLessons.length > 0 ? Math.round((completedInSection / curLessons.length) * 100) : 0;
    const isLessonUnlocked = (i: number) => i === 0 || (curLessons[i - 1] && completedLessons.has(curLessons[i - 1].id));
    
    // Calculate remaining time
    const remainingLessons = curLessons.slice(currentLessonIndex);
    const remainingMinutes = remainingLessons.reduce((acc, l) => acc + (l.duration_estimate_minutes || 0), 0);

    return (
      <div className="flex h-screen w-full flex-col bg-white text-[#141414] antialiased overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
        {/* AB Academy Header */}
        <header className="flex h-16 w-full shrink-0 items-center justify-between border-b border-[#E8EBF0] bg-white px-4 md:px-6 z-20">
          <div className="flex items-center gap-4">
            {isMobile && (
              <button type="button" onClick={handleGoHome} className="p-2 -ml-2 hover:bg-neutral-100 rounded" aria-label="Tilbake">
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
            )}
            <Image
              src="/abmarketing.png"
              alt="AB Academy Logo"
              width={120}
              height={32}
              className="object-contain h-8"
            />
            {!isMobile && (
              <nav className="hidden md:flex gap-6">
                <button type="button" onClick={handleGoHome} className="text-sm font-medium hover:opacity-60 transition-opacity">Oversikt</button>
                <button type="button" onClick={handleGoHome} className="text-sm font-medium hover:opacity-60 transition-opacity">Kurs</button>
                <button type="button" className="text-sm font-medium hover:opacity-60 transition-opacity">Profil</button>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 transition-colors">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              {userData?.first_name?.[0] || user?.username?.[0] || 'U'}
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar – desktop */}
          <aside className="w-80 flex-shrink-0 flex flex-col border-r border-[#E8EBF0] bg-white overflow-y-auto hidden md:flex">
            <div className="p-6 pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Seksjon {currentSection.order ?? 1}: {currentSection.title}
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                {curLessons.length} Leksjoner • {formatTime(remainingMinutes)} gjenstår
              </p>
            </div>
            <div className="flex flex-col py-2">
              {curLessons.map((les, idx) => {
                const completed = completedLessons.has(les.id);
                const current = currentLessonIndex === idx;
                const unlocked = isLessonUnlocked(idx);
                return (
                  <button
                    key={les.id}
                    type="button"
                    onClick={() => unlocked && handleLessonSelect(idx)}
                    className={cn(
                      "group flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors border-l-4 text-left w-full",
                      current ? "bg-neutral-50 border-[#141414]" : "border-transparent",
                      !unlocked && "opacity-60 cursor-not-allowed"
                    )}
                    disabled={!unlocked}
                  >
                    <div className="flex-shrink-0">
                      {completed && <span className="material-symbols-outlined fill-current text-[22px] text-[#2FB86F]">check_circle</span>}
                      {!completed && current && <span className="material-symbols-outlined text-[22px] text-[#2FA3FB]" style={{ fontVariationSettings: "'FILL' 1" }}>circle</span>}
                      {!completed && !current && !unlocked && <span className="material-symbols-outlined text-[22px] text-[#B3B3B3]">lock</span>}
                      {!completed && !current && unlocked && <span className="material-symbols-outlined text-[22px] text-[#B3B3B3]">circle</span>}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={cn("text-sm", completed && "text-neutral-400 line-through", current && "font-bold text-[#141414]", !current && !completed && "text-neutral-500 font-medium")}>{les.title}</span>
                      {current && <span className="text-xs text-neutral-500 font-medium">Leses nå</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-auto p-6 border-t border-[#E8EBF0]">
              <div className="rounded-lg bg-neutral-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">KURSPROGRESJON</span>
                  <span className="text-xs font-bold">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-300 rounded-full overflow-hidden">
                  <div className="h-full bg-[#141414] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto bg-white relative flex flex-col">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#E8EBF0] px-4 py-4 md:px-8 lg:px-12">
              <nav className="flex items-center text-sm font-medium text-neutral-500 flex-wrap gap-x-1">
                <button type="button" onClick={handleGoHome} className="hover:text-[#141414] transition-colors">
                  {currentCampaign?.name ?? "Generell opplæring"}
                </button>
                <span className="text-neutral-300">/</span>
                <span className="hover:text-[#141414]">Seksjon {currentSection.order ?? 1}</span>
                <span className="text-neutral-300">/</span>
                <span className="text-[#141414] font-semibold">Leksjon {currentLessonIndex + 1}</span>
              </nav>
            </div>

            <div className="mx-auto max-w-4xl w-full px-4 py-6 md:px-8 lg:px-12 pb-24 flex-1">
              {currentLesson ? (
                <>
                  {isMobile && curLessons.length > 0 && (
                    <div className="mb-4 flex justify-between items-center">
                      <LessonNavigationDrawer
                        lessons={curLessons}
                        currentLessonIndex={currentLessonIndex}
                        completedLessons={completedLessons}
                        onLessonSelect={handleLessonSelect}
                        sectionTitle={currentSection.title}
                        open={lessonDrawerOpen}
                        onOpenChange={setLessonDrawerOpen}
                      />
                      <span className="text-sm text-neutral-500">{currentLessonIndex + 1} / {curLessons.length}</span>
                    </div>
                  )}
                  <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-[#141414] leading-[1.1] mb-6">
                      {currentLesson.title}
                    </h1>
                    {currentLesson.kind !== "TEXT" && currentLesson.description && (
                      <p className="text-lg md:text-xl font-light text-neutral-600 leading-relaxed border-l-4 border-[#141414] pl-6">
                        {currentLesson.description}
                      </p>
                    )}
                  </div>
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
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-600">Ingen leksjoner tilgjengelig i denne seksjonen.</p>
                </div>
              )}
            </div>
          </main>
        </div>

        {isMobile && curLessons.length > 0 && currentLesson && (
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
        )}
      </div>
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
    <div className="min-h-screen bg-[#f8f7f7] text-[#141414] flex flex-col overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Mobile: top header */}
      {isMobile && (
        <MobileHeader title="AB Academy" userData={userData} onLogout={handleLogout} />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar – desktop only (LearnSpace) */}
        <aside className={cn(
          "flex-shrink-0 bg-white border-r border-[#E8EBF0] flex flex-col h-full overflow-y-auto z-20",
          isMobile ? "hidden" : "w-80"
        )}>
          <div className="p-6 pb-4 border-b border-[#E8EBF0] flex items-center gap-3">
            <Image
              src="/abmarketing.png"
              alt="AB Academy Logo"
              width={140}
              height={36}
              className="object-contain h-9"
            />
          </div>
          <div className="p-6 flex flex-col gap-8">
            {/* Progress circle + greeting */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative size-40">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                  <path className="text-gray-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  <path className="text-[#141414]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${overallPercent}, 100`} strokeLinecap="round" strokeWidth="2.5" />
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
              <div className="bg-neutral-50 rounded-lg p-3">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">local_fire_department</span>
                <p className="text-lg font-bold mt-1">{learningStreak}</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Dagers rekke</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <span className="material-symbols-outlined text-blue-500 text-[20px]">schedule</span>
                <p className="text-lg font-bold mt-1">{formatTime(totalTimeMinutes)}</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Total tid</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
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
                      isActive ? "bg-neutral-100 border border-neutral-200" : "hover:bg-neutral-50"
                    )}
                  >
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className={cn("text-xs font-semibold", pct >= 80 ? "text-[#33A34E]" : "text-neutral-500")}>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-[#33A34E]" : "bg-[#141414]")} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1.5">{completed}/{total} moduler fullført</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-6 border-t border-[#E8EBF0]">
              <button 
                className="w-full py-2.5 px-4 rounded-md border border-[#E8EBF0] text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
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
          {/* Desktop header */}
          {!isMobile && (
            <header className="h-16 flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-[#E8EBF0] px-8 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <span className="material-symbols-outlined text-neutral-400">search</span>
                <input className="bg-transparent border-none p-0 text-sm w-full placeholder-neutral-400 focus:ring-0 focus:outline-none" placeholder="Søk etter emner, moduler eller tagger..." />
              </div>
              <div className="flex items-center gap-6">
                <button className="relative text-neutral-500 hover:text-[#141414] transition-colors">
                  <span className="material-symbols-outlined">notifications</span>
                  <span className="absolute top-0 right-0 size-2 bg-red-500 rounded-full border-2 border-white" />
                </button>
                <div className="h-8 w-px bg-[#E8EBF0]" />
                <button className="flex items-center gap-3 group">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold leading-none">{userData?.first_name} {userData?.last_name?.[0] || ''}.</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-none">
                      {formatDate(lastLearningDate ?? null)}
                    </p>
                  </div>
                  <div className="size-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold border border-[#E8EBF0]">
                    {userData?.first_name?.[0] || 'U'}
                  </div>
                </button>
              </div>
            </header>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10">
            <div className="max-w-6xl mx-auto">
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
                    <div className="text-right px-4 py-2 bg-white rounded-md border border-[#E8EBF0] shadow-sm">
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
                                ? "bg-[#141414] text-white" 
                                : "bg-white border border-[#E8EBF0] text-neutral-600"
                            )}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 border-b border-[#E8EBF0] pb-1 overflow-x-auto">
                  {(['moduler', 'ressurser', 'diskusjoner', 'sertifikater'] as const).map((t) => (
                    <button key={t} onClick={() => setMainTab(t)} className={cn("px-4 md:px-5 py-2 md:py-2.5 rounded-t-md text-sm font-medium relative top-[1px] whitespace-nowrap", mainTab === t ? "bg-[#141414] text-white" : "text-neutral-500 hover:bg-white/50")}>
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
                        <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">{toCompleteInCampaign.length}</span>
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
                                "group bg-white border rounded-xl p-5 h-52 md:h-56 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all hover:shadow-md",
                                isUnlocked ? "border-[#E8EBF0] hover:border-neutral-400" : "border-[#E8EBF0] opacity-70 select-none"
                              )}
                            >
                              <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
                                <div className={cn("h-full transition-all", isInProgress ? "bg-amber-400" : progressW > 0 ? "bg-emerald-500" : "bg-transparent")} style={{ width: `${progressW}%` }} />
                              </div>
                              <div>
                                <div className="flex justify-between items-start mb-3 md:mb-4">
                                  <span className="text-2xl md:text-3xl">{section.icon_emoji || '📚'}</span>
                                  {isUnlocked ? (
                                    <span className={cn("px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded", isInProgress ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-neutral-600")}>
                                      {isInProgress ? 'I gang' : 'Ikke startet'}
                                    </span>
                                  ) : (
                                    <span className="material-symbols-outlined text-neutral-400">lock</span>
                                  )}
                                </div>
                                <h4 className="text-base md:text-lg font-bold leading-tight mb-2">{section.title}</h4>
                                <p className="text-xs md:text-sm text-neutral-500 line-clamp-2">{section.description || 'Start denne modulen for å lære mer.'}</p>
                              </div>
                              <div className="flex items-center justify-between mt-4 pt-3 md:pt-4 border-t border-dashed border-[#E8EBF0]">
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
                                  <div className={cn("size-8 rounded-full flex items-center justify-center transition-transform", isInProgress ? "bg-[#141414] text-white group-hover:translate-x-1" : "bg-white border border-neutral-200 text-[#141414] group-hover:bg-[#141414] group-hover:text-white group-hover:border-[#141414] group-hover:translate-x-1")}>
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
                        <span className="px-2 py-0.5 rounded-full bg-[#33A34E]/10 text-xs font-bold text-[#33A34E]">{completedInCampaign.length}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                        {completedInCampaign.map((section) => (
                          <div key={section.id} onClick={() => handleSectionClick(section)} className="group bg-white border border-[#E8EBF0] rounded-xl p-4 h-44 md:h-48 flex flex-col justify-between cursor-pointer hover:border-[#33A34E] transition-colors">
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div className="size-8 rounded bg-[#33A34E]/10 flex items-center justify-center text-[#33A34E]">
                                  <span className="material-symbols-outlined text-[20px]">check</span>
                                </div>
                                <span className="text-xs text-neutral-400">{formatDate(section.updated_at)}</span>
                              </div>
                              <h4 className="text-base font-bold leading-tight mb-1 text-neutral-600 group-hover:text-[#141414]">{section.title}</h4>
                              <p className="text-xs text-neutral-400">
                                {section.lessons?.length || section.lesson_count || 0} leksjoner fullført
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#33A34E] bg-[#33A34E]/5 px-2 py-1 rounded">Bestått</span>
                              <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide ml-auto">Se gjennom →</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {toCompleteInCampaign.length === 0 && completedInCampaign.length === 0 && (
                    <div className="py-16 text-center">
                      <span className="material-symbols-outlined text-[64px] text-neutral-300 mb-4">school</span>
                      <h3 className="text-lg font-semibold text-neutral-600 mb-2">Ingen moduler ennå</h3>
                      <p className="text-neutral-500">Det er ingen moduler tilgjengelig for denne kampanjen ennå.</p>
                    </div>
                  )}
                </>
              )}

              {mainTab !== 'moduler' && (
                <div className="py-16 text-center text-neutral-500 border border-dashed border-neutral-300 rounded-lg">
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
