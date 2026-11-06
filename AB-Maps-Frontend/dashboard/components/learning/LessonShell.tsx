"use client";

import React from "react";
import { cn } from "@/lib/utils";
import AcademyHeader, { AcademyNavButton } from "@/components/learning/AcademyHeader";
import type { LearningLesson } from "@/services/learningTypes";

function formatMinutes(minutes: number): string {
  if (!minutes) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} t ${m} min` : `${h} t`;
}

/**
 * AB Academy lesson view chrome (header, lesson list, breadcrumb, title). Pure layout: every
 * action (select lesson, back, complete) comes from the page, so the course rules and data calls
 * stay exactly where they were. Used by /ab-academy/<section> and the oversikt lesson view.
 */
export default function LessonShell({
  sectionTitle,
  sectionOrder,
  crumbRoot,
  lessons,
  currentLessonIndex,
  completedLessons,
  isMobile,
  userName,
  onBack,
  onLessonSelect,
  mobileLessonPicker,
  bottomNav,
  children,
}: {
  sectionTitle: string;
  sectionOrder?: number | null;
  crumbRoot: string;
  lessons: LearningLesson[];
  currentLessonIndex: number;
  completedLessons: Set<number>;
  isMobile: boolean;
  userName?: string | null;
  onBack: () => void;
  onLessonSelect: (index: number) => void;
  /** Phone only: the lesson drawer trigger shown above the lesson. */
  mobileLessonPicker?: React.ReactNode;
  /** Phone only: the fixed bottom navigation. */
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const currentLesson = lessons[currentLessonIndex];
  const completedCount = lessons.filter((l) => completedLessons.has(l.id)).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const remainingMinutes = lessons
    .slice(currentLessonIndex)
    .reduce((acc, l) => acc + (l.duration_estimate_minutes || 0), 0);
  const isLessonUnlocked = (i: number) => i === 0 || (lessons[i - 1] && completedLessons.has(lessons[i - 1].id));
  const order = sectionOrder ?? 1;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F7F7F5] text-[#0A0A0A] antialiased">
      <AcademyHeader onBack={isMobile ? onBack : undefined} userName={userName}>
        <AcademyNavButton onClick={onBack}>Oversikt</AcademyNavButton>
        <AcademyNavButton active>Kurs</AcademyNavButton>
      </AcademyHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Lesson list – desktop */}
        <aside className="hidden md:flex w-80 flex-shrink-0 flex-col border-r border-black/[0.08] bg-white overflow-y-auto">
          <div className="px-6 pt-6 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Seksjon {order}</p>
            <h2 className="mt-1 text-base font-semibold leading-snug text-[#0A0A0A]">{sectionTitle}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {lessons.length} leksjoner · {formatMinutes(remainingMinutes)} gjenstår
            </p>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2">
            {lessons.map((les, idx) => {
              const completed = completedLessons.has(les.id);
              const current = currentLessonIndex === idx;
              const unlocked = isLessonUnlocked(idx);
              return (
                <button
                  key={les.id}
                  type="button"
                  onClick={() => unlocked && onLessonSelect(idx)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                    current ? "bg-emerald-50" : "hover:bg-black/[0.03]",
                    !unlocked && "cursor-not-allowed opacity-60"
                  )}
                  disabled={!unlocked}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {completed ? (
                      <span className="material-symbols-outlined text-[22px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : current ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      </span>
                    ) : !unlocked ? (
                      <span className="material-symbols-outlined text-[20px] text-neutral-400">lock</span>
                    ) : (
                      <span className="h-5 w-5 rounded-full border-2 border-neutral-300" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "text-sm leading-snug",
                        current ? "font-semibold text-[#0A0A0A]" : completed ? "text-neutral-500" : "font-medium text-neutral-600"
                      )}
                    >
                      {les.title}
                    </span>
                    {current && <span className="text-xs font-medium text-emerald-700">Leses nå</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto border-t border-black/[0.08] p-6">
            <div className="rounded-xl bg-[#F7F7F5] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Kursprogresjon</span>
                <span className="text-xs font-semibold tabular-nums text-[#0A0A0A]">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
        </aside>

        {/* Lesson */}
        <main className="relative flex flex-1 flex-col overflow-y-auto">
          <div className="border-b border-black/[0.06] bg-white/70 px-4 py-3 md:px-8 lg:px-12">
            <nav className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-neutral-500" aria-label="Brødsmuler">
              <button type="button" onClick={onBack} className="hover:text-[#0A0A0A] transition-colors truncate max-w-[45vw]">
                {crumbRoot}
              </button>
              <span className="text-neutral-300">/</span>
              <span>Seksjon {order}</span>
              <span className="text-neutral-300">/</span>
              <span className="font-semibold text-[#0A0A0A]">Leksjon {currentLessonIndex + 1}</span>
            </nav>
          </div>

          <div className={cn("mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8 md:py-10", isMobile ? "pb-28" : "pb-24")}>
            {currentLesson ? (
              <>
                {isMobile && lessons.length > 0 && (
                  <div className="mb-4 flex items-center justify-between gap-3">
                    {mobileLessonPicker}
                    <span className="shrink-0 text-sm tabular-nums text-neutral-500">
                      {currentLessonIndex + 1} / {lessons.length}
                    </span>
                  </div>
                )}
                {isMobile && (
                  <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progressPercent}%` }} />
                  </div>
                )}
                <div className="mb-8">
                  <h1 className="mb-4 text-2xl font-bold leading-tight tracking-tight text-[#0A0A0A] md:text-4xl">
                    {currentLesson.title}
                  </h1>
                  {currentLesson.kind !== "TEXT" && currentLesson.kind !== "QUIZ" && currentLesson.description && (
                    <p className="border-l-4 border-emerald-600 pl-4 text-base leading-relaxed text-neutral-600 md:pl-5 md:text-lg">
                      {currentLesson.description}
                    </p>
                  )}
                </div>
                {children}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-black/[0.12] bg-white py-12 text-center">
                <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">menu_book</span>
                <p className="text-neutral-600">Ingen leksjoner tilgjengelig i denne seksjonen.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {isMobile && bottomNav}
    </div>
  );
}
