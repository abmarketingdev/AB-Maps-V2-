"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningService, completedFromRawProgress } from "@/services/learningService";
import LessonShell from "@/components/learning/LessonShell";
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
          router.push("/ab-academy/login");
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
      // Per-learner status lives only in /me/progress/raw/ (the section endpoint has none),
      // so this is what keeps finished lessons «Fullført» after a reload.
      const raw = await learningService.getRawProgress().catch(() => null);
      setCompletedLessons(completedFromRawProgress(raw).lessons);
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
        onGoHome={() => router.push("/ab-academy/oversikt")}
      />
    );
  }

  const lessons = section.lessons || [];
  const currentLesson = lessons[currentLessonIndex];
  const prevLesson = lessons[currentLessonIndex - 1];
  const nextLesson = lessons[currentLessonIndex + 1];
  const goToOverview = () => router.push("/ab-academy/oversikt");

  return (
    <LessonShell
      sectionTitle={section.title}
      sectionOrder={section.order}
      crumbRoot="AB Academy"
      lessons={lessons}
      currentLessonIndex={currentLessonIndex}
      completedLessons={completedLessons}
      isMobile={isMobile}
      userName={userData?.first_name}
      onBack={goToOverview}
      onLessonSelect={handleLessonSelect}
      mobileLessonPicker={
        <LessonNavigationDrawer
          lessons={lessons}
          currentLessonIndex={currentLessonIndex}
          completedLessons={completedLessons}
          onLessonSelect={handleLessonSelect}
          sectionTitle={section.title}
          open={lessonDrawerOpen}
          onOpenChange={setLessonDrawerOpen}
        />
      }
      bottomNav={
        lessons.length > 0 && currentLesson ? (
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
          hasNext={currentLessonIndex < lessons.length - 1}
          hasPrevious={currentLessonIndex > 0}
          hideHeader
          previousLessonTitle={prevLesson?.title}
          nextLessonTitle={nextLesson?.title}
          certificationLabel={section.title}
        />
      )}
    </LessonShell>
  );
};

export default SectionDetailPage;
