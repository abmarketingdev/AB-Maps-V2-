"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningService } from "@/services/learningService";
import { cn } from "@/lib/utils";
import LessonViewer from "@/components/learning/LessonViewer";
import LessonNavigationDrawer from "@/components/learning/LessonNavigationDrawer";
import MobileBottomNav from "@/components/learning/MobileBottomNav";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LearningSection, LearningLesson, LearningUser } from "@/services/learningTypes";

const SectionDetailPage = () => {
  const [section, setSection] = useState<LearningSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(new Set());
  const [userData, setUserData] = useState<LearningUser | null>(null);
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const sectionId = params.section as string;
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkAuthAndFetchSection = async () => {
      try {
        const authService = LearningAuthService.getInstance();
        const authenticated = await authService.isAuthenticated();
        if (!authenticated) {
          router.push("/learning-platform/login");
          return;
        }
        await fetchSection();
        await fetchUserData();
      } catch (e) {
        console.error("Error:", e);
        setError("Kunne ikke laste seksjon");
      } finally {
        setLoading(false);
      }
    };
    if (sectionId) checkAuthAndFetchSection();
  }, [sectionId, router]);

  const fetchSection = async () => {
    try {
      const learningService = LearningService.getInstance();
      const data = await learningService.getSection(parseInt(sectionId));
      setSection(data);
      const progress = await learningService.getUserProgress();
      if (progress.completed_lessons) {
        setCompletedLessons(new Set(progress.completed_lessons));
      }
    } catch (e) {
      console.error("Error fetching section:", e);
      setError("Kunne ikke hente seksjon");
    }
  };

  const fetchUserData = async () => {
    try {
      const authService = LearningAuthService.getInstance();
      setUserData(await authService.getCurrentUser());
    } catch (e) {
      console.error("Error fetching user:", e);
    }
  };

  const handleLessonComplete = async (lessonId: number) => {
    try {
      const learningService = LearningService.getInstance();
      await learningService.completeLesson(lessonId);
      setCompletedLessons((prev) => new Set([...prev, lessonId]));
    } catch (e) {
      console.error("Error completing lesson:", e);
    }
  };

  const handleLessonSelect = (index: number) => {
    if (!section?.lessons) return;
    if (index === 0) {
      setCurrentLessonIndex(index);
      return;
    }
    const prev = section.lessons[index - 1];
    if (completedLessons.has(prev.id)) {
      setCurrentLessonIndex(index);
    } else {
      alert("Du må fullføre forrige leksjon først!");
    }
  };

  const goToNextLesson = () => {
    if (section?.lessons && currentLessonIndex < section.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  };

  const goToPreviousLesson = () => {
    if (currentLessonIndex > 0) setCurrentLessonIndex(currentLessonIndex - 1);
  };

  if (loading) return <LoadingState message="Laster seksjon..." />;

  if (error || !section) {
    return (
      <ErrorState
        title="Kunne ikke laste seksjon"
        message={error || "Seksjon ikke funnet"}
        onGoHome={() => router.push("/learning-dashboard")}
      />
    );
  }

  const lessons = section.lessons || [];
  const currentLesson = lessons[currentLessonIndex];
  const prevLesson = lessons[currentLessonIndex - 1];
  const nextLesson = lessons[currentLessonIndex + 1];
  const completedInSection = lessons.filter((l) => completedLessons.has(l.id)).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedInSection / lessons.length) * 100) : 0;
  const isLessonUnlocked = (i: number) => i === 0 || (lessons[i - 1] && completedLessons.has(lessons[i - 1].id));

  // —— Del 1: LearnFlow header ——
  const LearnFlowHeader = () => (
    <header className="flex h-16 w-full shrink-0 items-center justify-between border-b border-[#E8EBF0] bg-white px-4 md:px-6 z-20">
      <div className="flex items-center gap-4">
        {isMobile && (
          <button
            type="button"
            onClick={() => router.push("/learning-dashboard")}
            className="p-2 -ml-2 hover:bg-neutral-100 rounded"
            aria-label="Tilbake"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded bg-[#141414] text-white">
          <span className="material-symbols-outlined text-[20px]">school</span>
        </div>
        <span className="text-lg font-bold tracking-tight">LearnFlow</span>
        {!isMobile && (
          <nav className="hidden md:flex gap-6">
            <button type="button" onClick={() => router.push("/learning-dashboard")} className="text-sm font-medium hover:opacity-60 transition-opacity">Oversikt</button>
            <button type="button" onClick={() => router.push("/learning-dashboard")} className="text-sm font-medium hover:opacity-60 transition-opacity">Kurs</button>
            <button type="button" className="text-sm font-medium opacity-50 cursor-not-allowed" onClick={() => alert("DUMMY DATA")}>Profil</button>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>
        <div className="h-8 w-8 rounded-full bg-neutral-200 overflow-hidden" />
      </div>
    </header>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-white text-[#141414] antialiased overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      <LearnFlowHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* —— Del 2: Sidebar student_lesson_viewer —— */}
        <aside className="w-80 flex-shrink-0 flex flex-col border-r border-[#E8EBF0] bg-white overflow-y-auto hidden md:flex">
          <div className="p-6 pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Seksjon {section.order ?? 1}: {section.title}</h2>
            <p className="text-xs text-neutral-400 mt-1">{lessons.length} Leksjoner • 55m gjenstår</p>
          </div>
          <div className="flex flex-col py-2">
            {lessons.map((les, idx) => {
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
                <div className="h-full bg-[#141414] rounded-full" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
        </aside>

        {/* —— Del 3–5: Main: breadcrumbs, tittel+ingress, LessonViewer —— */}
        <main className="flex-1 overflow-y-auto bg-white relative flex flex-col">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#E8EBF0] px-4 py-4 md:px-8 lg:px-12">
            <nav className="flex items-center text-sm font-medium text-neutral-500 flex-wrap gap-x-1">
              <button type="button" onClick={() => router.push("/learning-dashboard")} className="hover:text-[#141414] transition-colors">DUMMY DATA</button>
              <span className="text-neutral-300">/</span>
              <span className="hover:text-[#141414]">Seksjon {section.order ?? 1}</span>
              <span className="text-neutral-300">/</span>
              <span className="text-[#141414] font-semibold">Leksjon {currentLessonIndex + 1}</span>
            </nav>
          </div>

          <div className="mx-auto max-w-4xl w-full px-4 py-6 md:px-8 lg:px-12 pb-24 flex-1">
            {currentLesson ? (
              <>
                {/* —— Del 6: Mobil – drawer + telling —— */}
                {isMobile && lessons.length > 0 && (
                  <div className="mb-4 flex justify-between items-center">
                    <LessonNavigationDrawer
                      lessons={lessons}
                      currentLessonIndex={currentLessonIndex}
                      completedLessons={completedLessons}
                      onLessonSelect={handleLessonSelect}
                      sectionTitle={section.title}
                      open={lessonDrawerOpen}
                      onOpenChange={setLessonDrawerOpen}
                    />
                    <span className="text-sm text-neutral-500">{currentLessonIndex + 1} / {lessons.length}</span>
                  </div>
                )}

                <div className="mb-8">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#141414] leading-[1.1] mb-6">{currentLesson.title}</h1>
                  <p className="text-xl md:text-2xl font-light text-neutral-600 leading-relaxed border-l-4 border-[#141414] pl-6">{currentLesson.description || "DUMMY DATA"}</p>
                </div>

                <LessonViewer
                  lesson={currentLesson}
                  isCompleted={completedLessons.has(currentLesson.id)}
                  isUnlocked
                  onComplete={() => handleLessonComplete(currentLesson.id)}
                  onNext={goToNextLesson}
                  onPrevious={goToPreviousLesson}
                  hasNext={currentLessonIndex < lessons.length - 1}
                  hasPrevious={currentLessonIndex > 0}
                  hideHeader
                  previousLessonTitle={prevLesson?.title}
                  nextLessonTitle={nextLesson?.title}
                  certificationLabel={section.title}
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

      {/* —— Del 7: Mobil bunnnav, quiz håndteres i LessonViewer —— */}
      {isMobile && lessons.length > 0 && currentLesson && (
        <MobileBottomNav
          hasPrevious={currentLessonIndex > 0}
          hasNext={currentLessonIndex < lessons.length - 1}
          isCompleted={completedLessons.has(currentLesson.id)}
          onPrevious={goToPreviousLesson}
          onComplete={() => handleLessonComplete(currentLesson.id)}
          onNext={goToNextLesson}
          lessonProgress={`${currentLessonIndex + 1}/${lessons.length}`}
          isQuiz={currentLesson.kind === "QUIZ"}
          quizSubmitted={false}
        />
      )}
    </div>
  );
};

export default SectionDetailPage;
