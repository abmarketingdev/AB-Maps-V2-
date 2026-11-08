"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Clock, Video as VideoIcon, FileText, AlertCircle, ArrowRight, ArrowLeft, RotateCcw, Home } from "lucide-react";
import type { LearningLesson, QuizQuestion } from "@/services/learningTypes";
import { LearningService } from "@/services/learningService";
import VideoPlayer from "./VideoPlayer";
import FormattedContent from "./FormattedContent";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface LessonViewerProps {
  lesson: LearningLesson;
  isCompleted: boolean;
  isUnlocked: boolean;
  onComplete: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onGoHome?: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  /** Hide header when parent shows title + description (LessonShell) */
  hideHeader?: boolean;
  previousLessonTitle?: string;
  nextLessonTitle?: string;
  /** Used in quiz result card e.g. "Sertifisert for X" */
  certificationLabel?: string;
}

const LessonViewer: React.FC<LessonViewerProps> = ({
  lesson,
  isCompleted,
  isUnlocked,
  onComplete,
  onNext,
  onPrevious,
  onGoHome,
  hasNext,
  hasPrevious,
  hideHeader = false,
  previousLessonTitle,
  nextLessonTitle,
  certificationLabel = "Kurset",
}) => {
  const isMobile = useIsMobile();
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  
  // Quiz state management
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState<boolean>(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(Date.now());
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizSubmitError, setQuizSubmitError] = useState<string>("");
  // Server verdict per question (true = the learner's answer was right).
  const [quizResults, setQuizResults] = useState<Record<number, boolean>>({});
  // A passed quiz shows «Quiz bestått» instead of empty questions; «Ta quizen på nytt» reopens it.
  const [retake, setRetake] = useState(false);
  
  // Reset quiz state when lesson changes
  useEffect(() => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizPassed(false);
    setQuizStartTime(Date.now());
    setIsSubmittingQuiz(false);
    setQuizSubmitError("");
    setQuizResults({});
    setRetake(false);
  }, [lesson.id]);

  const handleQuizAnswer = (questionId: number, answerIndex: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const handleQuizSubmit = async () => {
    setIsSubmittingQuiz(true);
    setQuizSubmitError("");

    try {
      // The quiz is graded by the server: learners never receive which answer is right,
      // so send the chosen answer IDs ({ "<question_id>": <answer_id> }), not a score.
      const answers: Record<string, number> = {};
      lesson.quiz_questions?.forEach((question) => {
        const idx = quizAnswers[question.id];
        const answer = idx !== undefined ? question.answers[idx] : undefined;
        if (answer) answers[String(question.id)] = answer.id;
      });

      const learningService = LearningService.getInstance();
      const result = await learningService.submitQuiz(lesson.id, answers);

      const verdicts: Record<number, boolean> = {};
      (result.results || []).forEach((r) => { verdicts[r.question_id] = !!r.correct; });
      setQuizResults(verdicts);
      setQuizScore(result.score_percent);
      setQuizPassed(!!result.passed);
      setQuizSubmitted(true);

      // A pass already completed the lesson on the server; tell the page so it
      // marks it «Fullført» and unlocks the next lesson.
      if (result.passed) {
        onComplete();
      }
    } catch (error) {
      console.error('Quiz submission failed:', error);
      setQuizSubmitError(error instanceof Error && error.message ? error.message : 'Kunne ikke sende inn quiz. Prøv igjen.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };
  
  // Reset quiz for retry
  const handleQuizRetry = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizPassed(false);
    setQuizStartTime(Date.now());
    setQuizSubmitError("");
    setQuizResults({});
  };

  // Handle main action button click
  const handleMainAction = () => {
    if (!isCompleted && lesson.kind !== "QUIZ") {
      // Complete and go to next
      onComplete();
      if (hasNext) {
        setTimeout(() => onNext(), 300);
      }
    } else if (hasNext) {
      onNext();
    } else if (onGoHome) {
      onGoHome();
    }
  };

  // Determine main button text and state
  const getMainButtonConfig = () => {
    if (!isCompleted && lesson.kind !== "QUIZ") {
      return {
        text: hasNext ? "Fullfør og fortsett" : "Fullfør leksjon",
        icon: <ArrowRight className="w-5 h-5 ml-2" />,
        variant: "default" as const,
      };
    } else if (hasNext) {
      return {
        text: nextLessonTitle ? `Neste: ${nextLessonTitle}` : "Neste leksjon",
        icon: <ArrowRight className="w-5 h-5 ml-2" />,
        variant: "default" as const,
      };
    } else {
      return {
        text: "Tilbake til oversikt",
        icon: <Home className="w-5 h-5 ml-2" />,
        variant: "outline" as const,
      };
    }
  };

  if (!isUnlocked) {
    return (
      <Card className="p-6 md:p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-[#0A0A0A]">Leksjon låst</h3>
          <p className="text-neutral-600">
            Du må fullføre forrige leksjon før du kan få tilgang til denne.
          </p>
        </div>
      </Card>
    );
  }

  const buttonConfig = getMainButtonConfig();

  return (
    <div className={cn("space-y-6", isMobile && "space-y-4")}>
      {/* Lesson Header – hidden when hideHeader (LessonShell) */}
      {!hideHeader && (
        <div className={cn("bg-white rounded-xl border border-neutral-200 shadow-sm", isMobile ? "p-4" : "p-6")}>
          <div className={cn("flex items-start justify-between", isMobile ? "flex-col gap-3" : "flex-row mb-4")}>
            <div className="flex-1 w-full">
              <div className={cn("flex items-center gap-2 mb-2", isMobile && "flex-wrap")}>
                <h1 className={cn("font-bold text-[#0A0A0A]", isMobile ? "text-xl" : "text-2xl")}>
                  {lesson.title}
                </h1>
                <Badge variant="outline" className={cn("border-neutral-300", isMobile ? "text-[10px] px-1.5 py-0" : "text-xs")}>
                  {lesson.kind === "VIDEO" && <><VideoIcon className={cn(isMobile ? "w-2.5 h-2.5 mr-0.5" : "w-3 h-3 mr-1")} /> VIDEO</>}
                  {lesson.kind === "QUIZ" && <>📝 QUIZ</>}
                  {lesson.kind === "TEXT" && <><FileText className={cn(isMobile ? "w-2.5 h-2.5 mr-0.5" : "w-3 h-3 mr-1")} /> TEKST</>}
                </Badge>
              </div>
              {lesson.description && (
                <div className={cn("text-neutral-600", isMobile ? "text-sm" : "")}>
                  <FormattedContent content={lesson.description} />
                </div>
              )}
            </div>
            <div className={cn("flex items-center gap-2", isMobile && "self-start")}>
              <Clock className={cn(isMobile ? "w-3.5 h-3.5" : "w-4 h-4", "text-neutral-500")} />
              <span className={cn("text-neutral-500", isMobile ? "text-xs" : "text-sm")}>
                {lesson.duration_estimate_minutes} min
              </span>
              {isCompleted && (
                <Badge className={cn("bg-emerald-100 text-emerald-700 border-emerald-200", isMobile ? "text-[10px] px-1.5 py-0" : "")}>
                  <Check className={cn(isMobile ? "w-2.5 h-2.5 mr-0.5" : "w-3 h-3 mr-1")} />
                  Fullført
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lesson Content - Type-specific rendering */}
      {lesson.kind !== "QUIZ" && (
        <Card className="border-neutral-200 shadow-sm overflow-hidden">
          <CardContent className={cn(isMobile ? "p-4" : "p-6 md:p-8")}>
            {lesson.kind === "VIDEO" && lesson.content_url ? (
              // VIDEO: Show embedded video player
              <div className={cn("space-y-4", isMobile && "space-y-3")}>
                <VideoPlayer 
                  url={lesson.content_url}
                  title={lesson.title}
                />
                
                {/* Show content/description below video if exists */}
                {lesson.content && (
                  <div className={cn("bg-emerald-50 rounded-lg border border-emerald-200", isMobile ? "mt-4 p-3" : "mt-6 p-4")}>
                    <h4 className={cn("font-semibold text-emerald-900 mb-2", isMobile ? "text-sm" : "")}>
                      📝 Om denne videoen:
                    </h4>
                    <FormattedContent content={lesson.content} className="text-neutral-700" />
                  </div>
                )}
              </div>
            ) : (
              // TEXT/ARTICLE: Show content with proper formatting
              <div className="text-content">
                <FormattedContent 
                  content={lesson.description || lesson.content || ""} 
                  className={cn(
                    isMobile 
                      ? "text-[15px] leading-[1.6]" 
                      : "text-base leading-[1.7]"
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quiz Section */}
      {lesson.kind === "QUIZ" && lesson.quiz_questions && (
        <div className="space-y-6">
          {/* Quiz Description - shown if hideHeader or no description in header */}
          {lesson.description && hideHeader && (
            <Card className="border-neutral-200 shadow-sm">
              <CardContent className={cn(isMobile ? "p-4" : "p-6")}>
                <FormattedContent 
                  content={lesson.description} 
                  className={cn(
                    isMobile 
                      ? "text-[15px] leading-[1.6]" 
                      : "text-base leading-[1.7]"
                  )}
                />
              </CardContent>
            </Card>
          )}
          
          {/* Already passed (e.g. after a reload): say so instead of showing empty questions */}
          {isCompleted && !quizSubmitted && !retake && (
            <Card className="overflow-hidden border-l-4 border-l-emerald-500">
              <CardContent className={cn(isMobile ? "p-5" : "p-6 md:p-8")}>
                <div className="flex items-start gap-4">
                  <div className={cn("shrink-0 rounded-full bg-emerald-100 flex items-center justify-center", isMobile ? "w-11 h-11" : "w-14 h-14")}>
                    <Check className={cn("text-emerald-600", isMobile ? "w-6 h-6" : "w-7 h-7")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className={cn("font-bold text-[#0A0A0A]", isMobile ? "text-lg" : "text-2xl")}>Quiz bestått</h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      Du har bestått denne quizen. Du kan gå videre, eller ta den på nytt for å øve.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRetake(true)}
                      className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-neutral-200 px-5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Ta quizen på nytt
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result card – shown after submission */}
          {quizSubmitted && quizScore !== null && (
            <Card className={cn(
              "overflow-hidden border-l-4",
              quizPassed ? "border-l-emerald-500" : "border-l-red-500"
            )}>
              <CardContent className={cn(isMobile ? "p-5" : "p-6 md:p-8")}>
                <div className={cn("flex", isMobile ? "flex-row-reverse items-start gap-4" : "flex-col md:flex-row gap-6")}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">Resultat</Badge>
                      <span className="text-xs text-neutral-400">Akkurat nå</span>
                    </div>
                    <h2 className={cn("font-bold text-[#0A0A0A] mb-2", isMobile ? "text-xl" : "text-2xl md:text-3xl")}>
                      {quizPassed ? `Sertifisert for ${certificationLabel}` : "Ikke bestått"}
                    </h2>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={cn(
                        "text-3xl font-bold",
                        quizPassed ? "text-emerald-600" : "text-red-600"
                      )}>
                        {quizScore}%
                      </span>
                      <span className="text-neutral-500">poengsum</span>
                    </div>
                    <p className="text-neutral-600 text-sm">
                      {quizPassed 
                        ? "Gratulerer! Du har bestått quizen og kan fortsette til neste leksjon." 
                        : `Grense for å bestå: ${lesson.pass_threshold_percent || 80}%. Prøv igjen.`}
                    </p>
                  </div>
                  <div className={cn("flex items-center justify-center", isMobile ? "shrink-0" : "md:w-32")}>
                    <div className={cn(
                      "rounded-full flex items-center justify-center",
                      isMobile ? "w-12 h-12" : "w-24 h-24",
                      quizPassed ? "bg-emerald-100" : "bg-red-100"
                    )}>
                      {quizPassed ? (
                        <Check className={cn("text-emerald-600", isMobile ? "w-6 h-6" : "w-12 h-12")} />
                      ) : (
                        <AlertCircle className={cn("text-red-600", isMobile ? "w-6 h-6" : "w-12 h-12")} />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz questions – before submission */}
          {!quizSubmitted && (!isCompleted || retake) && (
            <Card className="border-neutral-200 shadow-sm">
              <CardContent className={cn(isMobile ? "p-4 space-y-7" : "p-6 md:p-8 space-y-8")}>
                {lesson.quiz_questions.map((question, questionIndex) => (
                  <div key={question.id} className="space-y-4">
                    <div>
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Spørsmål {questionIndex + 1} av {lesson.quiz_questions!.length}
                      </span>
                      <h3 className="text-lg md:text-xl font-semibold text-[#0A0A0A] mt-1">
                        {question.question_text}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {question.answers.map((answer, answerIndex) => (
                        <label key={answer.id} className="block cursor-pointer">
                          <input
                            type="radio"
                            name={`quiz-${question.id}`}
                            checked={quizAnswers[question.id] === answerIndex}
                            onChange={() => handleQuizAnswer(question.id, answerIndex)}
                            className="sr-only"
                            disabled={quizSubmitted}
                          />
                          <div className={cn(
                            "flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                            quizAnswers[question.id] === answerIndex
                              ? "border-emerald-600 bg-emerald-50/60"
                              : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                          )}>
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              quizAnswers[question.id] === answerIndex
                                ? "border-emerald-600 bg-emerald-600"
                                : "border-neutral-300"
                            )}>
                              {quizAnswers[question.id] === answerIndex && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-neutral-700 font-medium">{answer.answer_text}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Submit quiz button */}
                <div className="pt-6 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={handleQuizSubmit}
                    disabled={Object.keys(quizAnswers).length < (lesson.quiz_questions?.length || 0) || isSubmittingQuiz}
                    className={cn(
                      "w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all",
                      Object.keys(quizAnswers).length < (lesson.quiz_questions?.length || 0) || isSubmittingQuiz
                        ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99] shadow-sm"
                    )}
                  >
                    {isSubmittingQuiz ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sender inn...
                      </>
                    ) : (
                      <>
                        Send inn quiz
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-sm text-neutral-400 mt-3">
                    Svar på alle {lesson.quiz_questions?.length || 0} spørsmål for å sende inn
                  </p>
                </div>

                {quizSubmitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 p-3 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{quizSubmitError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* After submission: review of answers (phone + desktop) */}
          {quizSubmitted && quizScore !== null && (
            <Card className="border-neutral-200 shadow-sm">
              <CardContent className={cn(isMobile ? "p-4" : "p-6")}>
                <h4 className="font-semibold text-[#0A0A0A] mb-4">Gjennomgang av svar</h4>
                <div className="space-y-3">
                  {lesson.quiz_questions?.map((q, qIdx) => {
                    const si = quizAnswers[q.id];
                    const sel = si !== undefined ? q.answers[si] : null;
                    const ok = quizResults[q.id] === true;
                    return (
                      <div key={q.id} className={cn(
                        "rounded-lg border",
                        isMobile ? "p-3" : "p-4",
                        ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                      )}>
                        <p className="font-medium text-[#0A0A0A] mb-1">
                          {qIdx + 1}. {q.question_text}
                        </p>
                        <p className={cn("text-sm", ok ? "text-emerald-700" : "text-red-700")}>
                          Ditt svar: {sel?.answer_text || "—"} {ok ? "✓" : "✗"}
                        </p>

                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Action Button – ONE big button */}
      {!isMobile && lesson.kind !== "QUIZ" && (
        <div className="pt-6">
          <button
            type="button"
            onClick={handleMainAction}
            className={cn(
              "w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-sm",
              buttonConfig.variant === "outline"
                ? "bg-white border-2 border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99]"
            )}
          >
            {buttonConfig.text}
            {buttonConfig.icon}
          </button>
        </div>
      )}

      {/* Quiz: Action buttons after submission. On a phone «Neste» lives in the bottom bar,
          so only «Prøv igjen» is shown here (full width). */}
      {lesson.kind === "QUIZ" && quizSubmitted && quizScore !== null && (isMobile ? !quizPassed : true) && (
        <div className={cn(isMobile ? "pt-2" : "pt-6 flex gap-4 justify-center")}>
          {!quizPassed && (
            <button
              type="button"
              onClick={handleQuizRetry}
              className={cn(
                "h-12 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border-2 border-neutral-200 text-neutral-700 hover:bg-neutral-50",
                isMobile && "w-full"
              )}
            >
              <RotateCcw className="w-5 h-5" />
              Prøv igjen
            </button>
          )}
          {quizPassed && hasNext && (
            <button
              type="button"
              onClick={onNext}
              className="h-12 px-8 rounded-xl font-semibold flex items-center gap-2 transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            >
              Neste leksjon
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          {quizPassed && !hasNext && onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="h-12 px-8 rounded-xl font-semibold flex items-center gap-2 transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            >
              Tilbake til oversikt
              <Home className="w-5 h-5" />
            </button>
          )}
          {quizPassed && !hasNext && !onGoHome && (
            <p className="text-neutral-600 py-3">
              🎉 Du har fullført alle leksjoner i denne seksjonen!
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonViewer;
