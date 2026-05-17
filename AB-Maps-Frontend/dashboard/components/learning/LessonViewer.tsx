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
  /** Hide header when parent shows title + description (LearnFlow) */
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
  
  // Reset quiz state when lesson changes
  useEffect(() => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizPassed(false);
    setQuizStartTime(Date.now());
    setIsSubmittingQuiz(false);
    setQuizSubmitError("");
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
      // Calculate score based on correct answers
      let correctAnswers = 0;
      const totalQuestions = lesson.quiz_questions?.length || 0;
      
      lesson.quiz_questions?.forEach((question) => {
        const selectedAnswerIndex = quizAnswers[question.id];
        if (selectedAnswerIndex !== undefined) {
          const answer = question.answers[selectedAnswerIndex];
          if (answer?.is_correct) {
            correctAnswers++;
          }
        }
      });
      
      const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
      
      // Calculate quiz duration in seconds
      const duration = Math.floor((Date.now() - quizStartTime) / 1000);
      
      // Check pass threshold
      const passThreshold = lesson.pass_threshold_percent || 80;
      const passed = score >= passThreshold;
      
      // Submit to backend API
      const learningService = LearningService.getInstance();
      await learningService.submitQuiz(lesson.id, score, duration);
      
      // Update state
      setQuizScore(score);
      setQuizPassed(passed);
      setQuizSubmitted(true);
      
      // Only complete lesson if passed
      if (passed) {
        onComplete();
      }
    } catch (error) {
      console.error('Quiz submission failed:', error);
      setQuizSubmitError('Kunne ikke sende inn quiz. Prøv igjen.');
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-slate-900">Leksjon låst</h3>
          <p className="text-slate-600">
            Du må fullføre forrige leksjon før du kan få tilgang til denne.
          </p>
        </div>
      </Card>
    );
  }

  const buttonConfig = getMainButtonConfig();

  return (
    <div className={cn("space-y-6", isMobile && "space-y-4")}>
      {/* Lesson Header – hidden when hideHeader (LearnFlow) */}
      {!hideHeader && (
        <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm", isMobile ? "p-4" : "p-6")}>
          <div className={cn("flex items-start justify-between", isMobile ? "flex-col gap-3" : "flex-row mb-4")}>
            <div className="flex-1 w-full">
              <div className={cn("flex items-center gap-2 mb-2", isMobile && "flex-wrap")}>
                <h1 className={cn("font-bold text-slate-900", isMobile ? "text-xl" : "text-2xl")}>
                  {lesson.title}
                </h1>
                <Badge variant="outline" className={cn("border-slate-300", isMobile ? "text-[10px] px-1.5 py-0" : "text-xs")}>
                  {lesson.kind === "VIDEO" && <><VideoIcon className={cn(isMobile ? "w-2.5 h-2.5 mr-0.5" : "w-3 h-3 mr-1")} /> VIDEO</>}
                  {lesson.kind === "QUIZ" && <>📝 QUIZ</>}
                  {lesson.kind === "TEXT" && <><FileText className={cn(isMobile ? "w-2.5 h-2.5 mr-0.5" : "w-3 h-3 mr-1")} /> TEKST</>}
                </Badge>
              </div>
              {lesson.description && (
                <div className={cn("text-slate-600", isMobile ? "text-sm" : "")}>
                  <FormattedContent content={lesson.description} />
                </div>
              )}
            </div>
            <div className={cn("flex items-center gap-2", isMobile && "self-start")}>
              <Clock className={cn(isMobile ? "w-3.5 h-3.5" : "w-4 h-4", "text-slate-500")} />
              <span className={cn("text-slate-500", isMobile ? "text-xs" : "text-sm")}>
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
        <Card className="border-slate-200 shadow-sm overflow-hidden">
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
                  <div className={cn("bg-blue-50 rounded-lg border border-blue-200", isMobile ? "mt-4 p-3" : "mt-6 p-4")}>
                    <h4 className={cn("font-semibold text-blue-900 mb-2", isMobile ? "text-sm" : "")}>
                      📝 Om denne videoen:
                    </h4>
                    <FormattedContent content={lesson.content} className="text-slate-700" />
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
            <Card className="border-slate-200 shadow-sm">
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
          
          {/* Result card – shown after submission */}
          {quizSubmitted && quizScore !== null && (
            <Card className={cn(
              "overflow-hidden border-l-4",
              quizPassed ? "border-l-emerald-500" : "border-l-red-500"
            )}>
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">Resultat</Badge>
                      <span className="text-xs text-slate-400">Akkurat nå</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                      {quizPassed ? `Sertifisert for ${certificationLabel}` : "Ikke bestått"}
                    </h2>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={cn(
                        "text-3xl font-bold",
                        quizPassed ? "text-emerald-600" : "text-red-600"
                      )}>
                        {quizScore}%
                      </span>
                      <span className="text-slate-500">poengsum</span>
                    </div>
                    <p className="text-slate-600 text-sm">
                      {quizPassed 
                        ? "Gratulerer! Du har bestått quizen og kan fortsette til neste leksjon." 
                        : `Grense for å bestå: ${lesson.pass_threshold_percent || 80}%. Prøv igjen.`}
                    </p>
                  </div>
                  <div className="flex items-center justify-center md:w-32">
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center",
                      quizPassed ? "bg-emerald-100" : "bg-red-100"
                    )}>
                      {quizPassed ? (
                        <Check className="w-12 h-12 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-12 h-12 text-red-600" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz questions – before submission */}
          {!quizSubmitted && (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6 md:p-8 space-y-8">
                {lesson.quiz_questions.map((question, questionIndex) => (
                  <div key={question.id} className="space-y-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Spørsmål {questionIndex + 1} av {lesson.quiz_questions!.length}
                      </span>
                      <h3 className="text-lg md:text-xl font-semibold text-slate-900 mt-1">
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
                              ? "border-slate-900 bg-slate-50"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          )}>
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              quizAnswers[question.id] === answerIndex
                                ? "border-slate-900 bg-slate-900"
                                : "border-slate-300"
                            )}>
                              {quizAnswers[question.id] === answerIndex && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-slate-700 font-medium">{answer.answer_text}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Submit quiz button */}
                <div className="pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleQuizSubmit}
                    disabled={Object.keys(quizAnswers).length < (lesson.quiz_questions?.length || 0) || isSubmittingQuiz}
                    className={cn(
                      "w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all",
                      Object.keys(quizAnswers).length < (lesson.quiz_questions?.length || 0) || isSubmittingQuiz
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99] shadow-lg"
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
                  <p className="text-center text-sm text-slate-400 mt-3">
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

          {/* After submission: Review + Retry / Next (desktop) */}
          {quizSubmitted && quizScore !== null && !isMobile && (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <h4 className="font-semibold text-slate-900 mb-4">Gjennomgang av svar</h4>
                <div className="space-y-3">
                  {lesson.quiz_questions?.map((q, qIdx) => {
                    const si = quizAnswers[q.id];
                    const sel = si !== undefined ? q.answers[si] : null;
                    const ok = sel?.is_correct || false;
                    const correct = q.answers.find(a => a.is_correct);
                    return (
                      <div key={q.id} className={cn(
                        "rounded-lg border p-4",
                        ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                      )}>
                        <p className="font-medium text-slate-900 mb-1">
                          {qIdx + 1}. {q.question_text}
                        </p>
                        <p className={cn("text-sm", ok ? "text-emerald-700" : "text-red-700")}>
                          Ditt svar: {sel?.answer_text || "—"} {ok ? "✓" : "✗"}
                        </p>
                        {!ok && correct && (
                          <p className="text-sm text-emerald-700 mt-1">
                            Riktig svar: {correct.answer_text}
                          </p>
                        )}
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
              "w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg",
              buttonConfig.variant === "outline"
                ? "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]"
            )}
          >
            {buttonConfig.text}
            {buttonConfig.icon}
          </button>
        </div>
      )}

      {/* Quiz: Action buttons after submission */}
      {!isMobile && lesson.kind === "QUIZ" && quizSubmitted && quizScore !== null && (
        <div className="pt-6 flex gap-4 justify-center">
          {!quizPassed && (
            <button
              type="button"
              onClick={handleQuizRetry}
              className="h-12 px-6 rounded-xl font-semibold flex items-center gap-2 transition-all border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="w-5 h-5" />
              Prøv igjen
            </button>
          )}
          {quizPassed && hasNext && (
            <button
              type="button"
              onClick={onNext}
              className="h-12 px-8 rounded-xl font-semibold flex items-center gap-2 transition-all bg-slate-900 text-white hover:bg-slate-800 shadow-lg"
            >
              Neste leksjon
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          {quizPassed && !hasNext && onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="h-12 px-8 rounded-xl font-semibold flex items-center gap-2 transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg"
            >
              Tilbake til oversikt
              <Home className="w-5 h-5" />
            </button>
          )}
          {quizPassed && !hasNext && !onGoHome && (
            <p className="text-slate-600 py-3">
              🎉 Du har fullført alle leksjoner i denne seksjonen!
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonViewer;
