"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { RichTextEditor, FormattedContent } from "@/components/admin/RichTextEditor";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Video,
  HelpCircle,
  Plus,
  MoreHorizontal,
  Search,
  FolderOpen,
  GripVertical,
  Trash2,
  Copy,
  Eye,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type {
  LearningSection,
  LearningLesson,
  GroupedSectionsResponse,
  CampaignGroup,
  LessonDeletionPreview,
  LessonDeletionResponse,
} from "@/services/learningTypes";

// =============================================================================
// TYPES
// =============================================================================

interface Campaign {
  id: string;
  name: string;
}

type SelectedNode =
  | { type: "section"; id: number }
  | { type: "lesson"; id: number }
  | null;

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function getLessonIcon(kind: string) {
  switch (kind) {
    case "VIDEO":
      return <Video className="h-4 w-4 shrink-0 text-purple-600" />;
    case "QUIZ":
      return <HelpCircle className="h-4 w-4 shrink-0 text-orange-600" />;
    default:
      return <FileText className="h-4 w-4 shrink-0 text-blue-600" />;
  }
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        isActive
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      )}
    >
      {isActive ? "Publisert" : "Utkast"}
    </span>
  );
}

// =============================================================================
// TREE ITEM COMPONENTS
// =============================================================================

interface SectionTreeItemProps {
  section: LearningSection;
  lessons: LearningLesson[];
  isExpanded: boolean;
  isSelected: boolean;
  selectedLessonId: number | null;
  onToggle: () => void;
  onSelect: () => void;
  onSelectLesson: (lessonId: number) => void;
  onAddLesson: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDuplicateLesson?: (lessonId: number) => void;
  onDeleteLesson?: (lessonId: number) => void;
}

function SectionTreeItem({
  section,
  lessons,
  isExpanded,
  isSelected,
  selectedLessonId,
  onToggle,
  onSelect,
  onSelectLesson,
  onAddLesson,
  onDuplicate,
  onDelete,
  onDuplicateLesson,
  onDeleteLesson,
}: SectionTreeItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="select-none">
      {/* Section row */}
      <div
        className={cn(
          "group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors",
          isSelected
            ? "bg-emerald-600 text-white"
            : "hover:bg-slate-100 text-slate-700"
        )}
        onClick={onSelect}
        role="treeitem"
        aria-expanded={isExpanded}
        aria-selected={isSelected}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "p-0.5 rounded hover:bg-black/10",
            isSelected ? "text-white/80" : "text-slate-400"
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <FolderOpen
          className={cn(
            "h-4 w-4 shrink-0",
            isSelected ? "text-white" : "text-amber-500"
          )}
        />
        <span className="flex-1 truncate text-sm font-medium">
          {section.title}
        </span>
        <StatusBadge isActive={section.is_active} />
        <span
          className={cn(
            "text-[10px] tabular-nums",
            isSelected ? "text-white/70" : "text-slate-400"
          )}
        >
          {lessons.length}
        </span>
        {/* Context menu trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((p) => !p);
            }}
            className={cn(
              "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
              isSelected ? "hover:bg-white/20" : "hover:bg-slate-200"
            )}
            aria-label="Section actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onAddLesson();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Legg til leksjon
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDuplicate();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" />
                  Dupliser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Slett
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lessons (children) */}
      {isExpanded && lessons.length > 0 && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
          {lessons.map((lesson) => (
            <LessonTreeItem
              key={lesson.id}
              lesson={lesson}
              isSelected={selectedLessonId === lesson.id}
              onSelect={() => onSelectLesson(lesson.id)}
              onDuplicate={onDuplicateLesson ? () => onDuplicateLesson(lesson.id) : undefined}
              onDelete={onDeleteLesson ? () => onDeleteLesson(lesson.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LessonTreeItemProps {
  lesson: LearningLesson;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function LessonTreeItem({ lesson, isSelected, onSelect, onDuplicate, onDelete }: LessonTreeItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors",
        isSelected
          ? "bg-emerald-600 text-white"
          : "hover:bg-slate-100 text-slate-600"
      )}
      onClick={onSelect}
      role="treeitem"
      aria-selected={isSelected}
    >
      {getLessonIcon(lesson.kind)}
      <span className="flex-1 truncate text-sm">{lesson.title}</span>
      <StatusBadge isActive={lesson.is_active} />
      {/* Context menu trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((p) => !p);
          }}
          className={cn(
            "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            isSelected ? "hover:bg-white/20" : "hover:bg-slate-200"
          )}
          aria-label="Lesson actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {onDuplicate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDuplicate();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" />
                  Dupliser
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Slett
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EDITOR PANELS
// =============================================================================

interface SectionEditorPanelProps {
  section: LearningSection | null;
  isNew: boolean;
  campaigns: Campaign[];
  selectedCampaignId: string | null;
  saving: boolean;
  onSave: (data: Partial<LearningSection>, publish?: boolean) => void;
  onCancel: () => void;
  onLiveChange?: (data: { title?: string; description?: string; duration?: number }) => void;
}

function SectionEditorPanel({
  section,
  isNew,
  campaigns,
  selectedCampaignId,
  saving,
  onSave,
  onCancel,
  onLiveChange,
}: SectionEditorPanelProps) {
  const [title, setTitle] = useState(section?.title || "");
  const [description, setDescription] = useState(section?.description || "");
  const [duration, setDuration] = useState(
    section?.duration_estimate_minutes || 30
  );
  const [campaign, setCampaign] = useState<string | null>(
    section?.campaign_id || selectedCampaignId
  );

  useEffect(() => {
    setTitle(section?.title || "");
    setDescription(section?.description || "");
    setDuration(section?.duration_estimate_minutes || 30);
    setCampaign(section?.campaign_id || selectedCampaignId);
  }, [section, selectedCampaignId]);

  // Notify parent of live changes for preview (don't include onLiveChange in deps to avoid infinite loop)
  useEffect(() => {
    onLiveChange?.({ title, description, duration });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, duration]);

  const handleSaveDraft = () => {
    onSave(
      {
        title,
        description,
        duration_estimate_minutes: duration,
        campaign: campaign === "general" ? null : campaign,
        is_active: false,
      } as any,
      false
    );
  };

  const handlePublish = () => {
    onSave(
      {
        title,
        description,
        duration_estimate_minutes: duration,
        campaign: campaign === "general" ? null : campaign,
        is_active: true,
      } as any,
      true
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-900">
            {isNew ? "Ny seksjon" : "Rediger seksjon"}
          </h2>
          {section && <StatusBadge isActive={section.is_active} />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Avbryt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving || !title.trim()}
          >
            {saving ? "Lagrer..." : "Lagre utkast"}
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={saving || !title.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Publiser endringer
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Campaign selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Kampanje
            </label>
            <Select
              value={campaign || "general"}
              onValueChange={(v) => setCampaign(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Velg kampanje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Generell opplæring</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Seksjontittel *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Introduksjon til salg"
              className="text-base"
            />
          </div>

          {/* Description */}
          <RichTextEditor
            label="Beskrivelse"
            value={description}
            onChange={setDescription}
            placeholder="Beskriv innholdet i denne seksjonen..."
            minHeight={200}
            showPreview={true}
          />

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estimert varighet (minutter)
            </label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              min={1}
              className="w-32"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuizQuestion {
  text: string;
  options: { text: string; isCorrect: boolean }[];
}

interface LessonEditorPanelProps {
  lesson: LearningLesson | null;
  isNew: boolean;
  sections: LearningSection[];
  preselectedSectionId: number | null;
  saving: boolean;
  onSave: (data: Partial<LearningLesson>, publish?: boolean) => void;
  onSaveQuiz?: (lessonData: any, questions: QuizQuestion[], publish?: boolean) => void;
  onCancel: () => void;
  onLiveChange?: (data: { title?: string; description?: string; content?: string; kind?: string; duration?: number; questions?: QuizQuestion[] }) => void;
}

function LessonEditorPanel({
  lesson,
  isNew,
  sections,
  preselectedSectionId,
  saving,
  onSave,
  onSaveQuiz,
  onCancel,
  onLiveChange,
}: LessonEditorPanelProps) {
  // For TEXT type, content is stored in `description` field in the API
  // For VIDEO/QUIZ type, description is used for description
  const getInitialContent = () => {
    if (!lesson) return "";
    // For TEXT type, the content is stored in description field
    if (lesson.kind === "TEXT") {
      return lesson.description || lesson.content || "";
    }
    return lesson.content || "";
  };
  
  const getInitialDescription = () => {
    if (!lesson) return "";
    // For VIDEO/QUIZ, use description field
    if (lesson.kind !== "TEXT") {
      return lesson.description || "";
    }
    return "";
  };

  const getInitialQuestions = (): QuizQuestion[] => {
    if (!lesson || lesson.kind !== "QUIZ" || !lesson.quiz_questions?.length) {
      // Default 3 empty questions
      return [
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] }
      ];
    }
    return lesson.quiz_questions.map((q: any) => ({
      text: q.question_text,
      options: q.answers.map((a: any) => ({
        text: a.answer_text,
        isCorrect: a.is_correct
      }))
    }));
  };

  const [title, setTitle] = useState(lesson?.title || "");
  const [description, setDescription] = useState(getInitialDescription());
  const [content, setContent] = useState(getInitialContent());
  const [kind, setKind] = useState(lesson?.kind || "TEXT");
  const [contentUrl, setContentUrl] = useState((lesson as any)?.content_url || "");
  const [duration, setDuration] = useState(
    lesson?.duration_estimate_minutes || 10
  );
  const [sectionId, setSectionId] = useState<number>(
    lesson?.section || preselectedSectionId || sections[0]?.id || 0
  );
  const [passThreshold, setPassThreshold] = useState(
    (lesson as any)?.pass_threshold_percent || 80
  );
  
  // Quiz questions state
  const [questions, setQuestions] = useState<QuizQuestion[]>(getInitialQuestions());
  const [quizError, setQuizError] = useState("");

  useEffect(() => {
    setTitle(lesson?.title || "");
    // For TEXT type, content is stored in description field
    if (lesson?.kind === "TEXT") {
      setContent(lesson?.description || lesson?.content || "");
      setDescription("");
    } else {
      setDescription(lesson?.description || "");
      setContent(lesson?.content || "");
    }
    setKind(lesson?.kind || "TEXT");
    setContentUrl((lesson as any)?.content_url || "");
    setDuration(lesson?.duration_estimate_minutes || 10);
    setSectionId(lesson?.section || preselectedSectionId || sections[0]?.id || 0);
    setPassThreshold((lesson as any)?.pass_threshold_percent || 80);
    
    // Reset questions when lesson changes
    if (lesson?.kind === "QUIZ" && lesson.quiz_questions?.length) {
      setQuestions(lesson.quiz_questions.map((q: any) => ({
        text: q.question_text,
        options: q.answers.map((a: any) => ({
          text: a.answer_text,
          isCorrect: a.is_correct
        }))
      })));
    } else if (!lesson || lesson.kind !== "QUIZ") {
      setQuestions([
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] }
      ]);
    }
  }, [lesson, preselectedSectionId, sections]);

  // Quiz question management functions
  const addQuestion = () => {
    setQuestions([
      ...questions,
      { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] }
    ]);
  };

  const removeQuestion = (qIdx: number) => {
    if (questions.length <= 3) {
      setQuizError("Quiz må ha minst 3 spørsmål");
      return;
    }
    const updated = [...questions];
    updated.splice(qIdx, 1);
    setQuestions(updated);
  };

  const updateQuestionText = (qIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].text = text;
    setQuestions(updated);
  };

  const addOption = (qIdx: number) => {
    if (questions[qIdx].options.length >= 6) {
      setQuizError("Maks 6 alternativer per spørsmål");
      return;
    }
    const updated = [...questions];
    updated[qIdx].options.push({ text: "", isCorrect: false });
    setQuestions(updated);
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    if (questions[qIdx].options.length <= 2) {
      setQuizError("Minimum 2 alternativer per spørsmål");
      return;
    }
    const updated = [...questions];
    updated[qIdx].options.splice(optIdx, 1);
    setQuestions(updated);
  };

  const updateOptionText = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx].text = text;
    setQuestions(updated);
  };

  const setCorrectAnswer = (qIdx: number, optIdx: number) => {
    const updated = [...questions];
    // Set all to false first
    updated[qIdx].options.forEach(opt => opt.isCorrect = false);
    // Set selected to true
    updated[qIdx].options[optIdx].isCorrect = true;
    setQuestions(updated);
  };

  // Validate quiz before saving
  const validateQuiz = (): boolean => {
    setQuizError("");
    
    if (questions.length < 3) {
      setQuizError("Quiz må ha minst 3 spørsmål");
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      if (!question.text.trim()) {
        setQuizError(`Spørsmål ${i + 1} mangler tekst`);
        return false;
      }

      const hasCorrect = question.options.some(opt => opt.isCorrect);
      if (!hasCorrect) {
        setQuizError(`Spørsmål ${i + 1} må ha et riktig svar`);
        return false;
      }

      for (let j = 0; j < question.options.length; j++) {
        if (!question.options[j].text.trim()) {
          setQuizError(`Spørsmål ${i + 1}, alternativ ${j + 1} mangler tekst`);
          return false;
        }
      }
    }

    return true;
  };

  // Notify parent of live changes for preview (don't include onLiveChange in deps to avoid infinite loop)
  // For TEXT type, we send content as the main content (which will be stored in description)
  useEffect(() => {
    onLiveChange?.({ 
      title, 
      description: kind === "TEXT" ? "" : description, 
      content: kind === "TEXT" ? content : content, 
      kind, 
      duration,
      questions: kind === "QUIZ" ? questions : undefined
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, content, kind, duration, questions]);

  const handleSaveDraft = () => {
    // For QUIZ type, use special quiz API
    if (kind === "QUIZ") {
      if (!validateQuiz()) return;
      
      const lessonData = {
        title,
        description,
        content: description,
        kind: "QUIZ",
        duration_estimate_minutes: duration,
        section: sectionId,
        pass_threshold_percent: passThreshold,
        is_active: false,
      };
      onSaveQuiz?.(lessonData, questions, false);
      return;
    }
    
    // For TEXT type, store content in description field (API expectation)
    const saveData = {
      title,
      description: kind === "TEXT" ? content : description,
      content: kind === "TEXT" ? "" : content,
      kind,
      content_url: contentUrl,
      duration_estimate_minutes: duration,
      section: sectionId,
      pass_threshold_percent: passThreshold,
      is_active: false,
    };
    onSave(saveData as any, false);
  };

  const handlePublish = () => {
    // For QUIZ type, use special quiz API
    if (kind === "QUIZ") {
      if (!validateQuiz()) return;
      
      const lessonData = {
        title,
        description,
        content: description,
        kind: "QUIZ",
        duration_estimate_minutes: duration,
        section: sectionId,
        pass_threshold_percent: passThreshold,
        is_active: true,
      };
      onSaveQuiz?.(lessonData, questions, true);
      return;
    }
    
    // For TEXT type, store content in description field (API expectation)
    const saveData = {
      title,
      description: kind === "TEXT" ? content : description,
      content: kind === "TEXT" ? "" : content,
      kind,
      content_url: contentUrl,
      duration_estimate_minutes: duration,
      section: sectionId,
      pass_threshold_percent: passThreshold,
      is_active: true,
    };
    onSave(saveData as any, true);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          {getLessonIcon(kind)}
          <h2 className="text-lg font-bold text-slate-900">
            {isNew ? "Ny leksjon" : "Rediger leksjon"}
          </h2>
          {lesson && <StatusBadge isActive={lesson.is_active} />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Avbryt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving || !title.trim() || !sectionId}
          >
            {saving ? "Lagrer..." : "Lagre utkast"}
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={saving || !title.trim() || !sectionId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Publiser endringer
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Section selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Seksjon *
            </label>
            <Select
              value={String(sectionId)}
              onValueChange={(v) => setSectionId(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Velg seksjon" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Leksjonstittel *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Introduksjon"
              className="text-base"
            />
          </div>

          {/* Kind selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Leksjonstype
            </label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Tekst
                  </div>
                </SelectItem>
                <SelectItem value="VIDEO">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-purple-600" />
                    Video
                  </div>
                </SelectItem>
                <SelectItem value="QUIZ">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-orange-600" />
                    Quiz
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Video URL (if VIDEO) */}
          {kind === "VIDEO" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Video URL
              </label>
              <Input
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {/* Quiz Settings and Questions */}
          {kind === "QUIZ" && (
            <>
              {/* Quiz Error Display */}
              {quizError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                  <span className="text-sm">{quizError}</span>
                  <button 
                    type="button"
                    onClick={() => setQuizError("")}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Quiz Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Bestått terskel: {passThreshold}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Estimert varighet (min)
                  </label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 10)}
                    min={1}
                    className="w-24"
                  />
                </div>
              </div>

              {/* Quiz Description */}
              <RichTextEditor
                label="Quiz beskrivelse / regler"
                value={description}
                onChange={setDescription}
                placeholder="Beskriv quizzen og eventuelle regler. F.eks: 'Du må svare riktig på minst 80% av spørsmålene for å bestå.'"
                minHeight={120}
                showPreview={true}
              />

              {/* Questions Section */}
              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Spørsmål ({questions.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Minimum 3 spørsmål, merk riktig svar med radioknappen
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addQuestion}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Legg til spørsmål
                  </Button>
                </div>

                <div className="space-y-4">
                  {questions.map((question, qIdx) => (
                    <div
                      key={qIdx}
                      className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-orange-900 text-sm">
                          Spørsmål {qIdx + 1}
                        </h4>
                        {questions.length > 3 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(qIdx)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <Input
                        placeholder="Skriv spørsmålet her..."
                        value={question.text}
                        onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                        className="mb-3 bg-white"
                      />

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 block">
                          Svaralternativer (velg riktig svar):
                        </label>
                        {question.options.map((option, optIdx) => (
                          <div
                            key={optIdx}
                            className={cn(
                              "flex items-center gap-2 bg-white rounded-lg border p-2",
                              option.isCorrect ? "border-green-400 bg-green-50" : "border-slate-200"
                            )}
                          >
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={option.isCorrect}
                              onChange={() => setCorrectAnswer(qIdx, optIdx)}
                              className="w-4 h-4 text-green-600 cursor-pointer"
                              title="Marker som riktig svar"
                            />
                            <Input
                              placeholder={`Alternativ ${optIdx + 1}`}
                              value={option.text}
                              onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                              className="flex-1 border-0 focus:ring-0 bg-transparent"
                            />
                            {question.options.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOption(qIdx, optIdx)}
                                className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            {option.isCorrect && (
                              <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                                ✓ Riktig
                              </span>
                            )}
                          </div>
                        ))}
                        
                        {question.options.length < 6 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addOption(qIdx)}
                            className="w-full text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 hover:border-slate-400"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Legg til alternativ
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Content (for TEXT) - single rich text editor for all content */}
          {kind === "TEXT" && (
            <RichTextEditor
              label="Leksjonsinnhold"
              value={content}
              onChange={setContent}
              placeholder="Skriv leksjonsinnholdet her. Bruk formatering for overskrifter, lister, bilder og lenker..."
              minHeight={400}
              showPreview={true}
            />
          )}

          {/* Description (for VIDEO and QUIZ only) */}
          {(kind === "VIDEO" || kind === "QUIZ") && (
            <RichTextEditor
              label="Leksjonsbeskrivelse"
              value={description}
              onChange={setDescription}
              placeholder="Beskriv innholdet i denne leksjonen..."
              minHeight={150}
              showPreview={true}
            />
          )}

          {/* Duration (for TEXT and VIDEO only - QUIZ has it in quiz settings) */}
          {kind !== "QUIZ" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Estimert varighet (minutter)
              </label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                min={1}
                className="w-32"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PREVIEW PANEL
// =============================================================================

interface PreviewPanelProps {
  selectedNode: SelectedNode;
  sections: LearningSection[];
  lessons: LearningLesson[];
  // Live editor content (for real-time preview)
  liveTitle?: string;
  liveDescription?: string;
  liveContent?: string;
  liveKind?: string;
  liveDuration?: number;
  liveQuestions?: QuizQuestion[];
}

function PreviewPanel({
  selectedNode,
  sections,
  lessons,
  liveTitle,
  liveDescription,
  liveContent,
  liveKind,
  liveDuration,
  liveQuestions,
}: PreviewPanelProps) {
  const [previewRole, setPreviewRole] = useState<"ansatt" | "leder">("ansatt");

  const selectedSection = selectedNode?.type === "section"
    ? sections.find((s) => s.id === selectedNode.id)
    : selectedNode?.type === "lesson"
    ? sections.find((s) => s.id === lessons.find((l) => l.id === selectedNode.id)?.section)
    : null;

  const selectedLesson = selectedNode?.type === "lesson"
    ? lessons.find((l) => l.id === selectedNode.id)
    : null;

  const previewUrl = selectedSection
    ? `/learning-platform/${selectedSection.id}`
    : null;

  // Use live content if available, otherwise fall back to saved content
  const displayTitle = liveTitle || selectedLesson?.title || selectedSection?.title || "Velg innhold";
  const displayDescription = liveDescription || selectedSection?.description || "";
  // For TEXT type lessons, content is stored in description field in the API
  const lessonKind = liveKind || selectedLesson?.kind;
  const displayContent = liveContent || (lessonKind === "TEXT" ? selectedLesson?.description : selectedLesson?.content) || "";
  const displayKind = lessonKind || "SEKSJON";
  const displayDuration = liveDuration || selectedLesson?.duration_estimate_minutes || selectedSection?.duration_estimate_minutes || 0;
  
  // Get quiz questions - use live questions if available, otherwise from lesson
  const displayQuestions = liveQuestions || (selectedLesson?.kind === "QUIZ" && selectedLesson?.quiz_questions 
    ? selectedLesson.quiz_questions.map((q: any) => ({
        text: q.question_text,
        options: q.answers.map((a: any) => ({
          text: a.answer_text,
          isCorrect: a.is_correct
        }))
      }))
    : null);

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sanntidsforhåndsvisning
          </span>
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Role toggle */}
      <div className="flex border-b border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setPreviewRole("ansatt")}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors",
            previewRole === "ansatt"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          Ansatt
        </button>
        <button
          type="button"
          onClick={() => setPreviewRole("leder")}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors",
            previewRole === "leder"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          Leder
        </button>
      </div>

      {/* Device frame */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-[280px]">
          {/* Phone frame */}
          <div className="rounded-[2rem] bg-slate-900 p-2 shadow-xl">
            <div className="rounded-[1.5rem] bg-slate-800 overflow-hidden">
              {/* Notch */}
              <div className="flex justify-center py-2">
                <div className="h-4 w-20 rounded-full bg-slate-700" />
              </div>

              {/* Screen content */}
              <div className="bg-white min-h-[400px] px-4 py-4 overflow-y-auto max-h-[450px]">
                {selectedNode || liveTitle ? (
                  <>
                    <p className="text-[10px] text-slate-400 mb-1">
                      lms.company.com/kurs/{selectedSection?.id || "ny"}
                    </p>
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      {displayTitle}
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase mb-4">
                      {displayKind} • {displayDuration} MIN
                    </p>

                    {/* Content preview - formatted */}
                    <div className="text-xs text-slate-700">
                      {/* Quiz Preview */}
                      {displayKind === "QUIZ" && displayQuestions ? (
                        <div className="space-y-4">
                          {/* Quiz Description */}
                          {displayDescription && (
                            <FormattedContent
                              content={displayDescription}
                              className="prose-xs [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_a]:text-blue-600 mb-4"
                            />
                          )}
                          
                          {/* Quiz Questions */}
                          <div className="space-y-3">
                            {displayQuestions.map((question, qIdx) => (
                              <div key={qIdx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <h4 className="font-semibold text-slate-900 mb-2 text-xs">
                                  Spørsmål {qIdx + 1}: {question.text || "Spørsmålstekst..."}
                                </h4>
                                <div className="space-y-1.5">
                                  {question.options.map((option, optIdx) => (
                                    <div
                                      key={optIdx}
                                      className={cn(
                                        "flex items-center gap-2 bg-white rounded border p-2 text-[10px]",
                                        option.isCorrect ? "border-green-400 bg-green-50" : "border-slate-200"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-3 h-3 rounded-full border-2 flex-shrink-0",
                                        option.isCorrect ? "border-green-500 bg-green-100" : "border-slate-300"
                                      )}>
                                        {option.isCorrect && (
                                          <div className="w-full h-full rounded-full bg-green-500" />
                                        )}
                                      </div>
                                      <span className="flex-1">{option.text || `Alternativ ${optIdx + 1}`}</span>
                                      {option.isCorrect && (
                                        <span className="text-green-600 font-medium text-[9px]">✓</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Quiz Info */}
                          <div className="mt-4 pt-3 border-t border-slate-200">
                            <p className="text-[10px] text-slate-500">
                              Bestått terskel: {(selectedLesson as any)?.pass_threshold_percent || 80}%
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {displayQuestions.length} {displayQuestions.length === 1 ? "spørsmål" : "spørsmål"}
                            </p>
                          </div>
                        </div>
                      ) : displayContent ? (
                        <FormattedContent
                          content={displayContent}
                          className="prose-xs [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_a]:text-blue-600 [&_img]:max-w-full [&_img]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-[10px]"
                        />
                      ) : displayDescription ? (
                        <FormattedContent
                          content={displayDescription}
                          className="prose-xs [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_a]:text-blue-600"
                        />
                      ) : (
                        <p className="text-slate-400 italic">
                          Skriv innhold for å se forhåndsvisning
                        </p>
                      )}
                    </div>

                    {/* Navigation button */}
                    <div className="mt-8">
                      <div className="w-full rounded-lg bg-white border border-slate-200 py-3 text-center text-xs font-medium text-slate-900 flex items-center justify-center gap-2">
                        Neste leksjon
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <FolderOpen className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">
                      Velg en seksjon eller leksjon for å forhåndsvise
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview CTA */}
          {previewUrl && (
            <div className="mt-4 text-center">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Eye className="h-4 w-4" />
                Åpne i ny fane
              </a>
            </div>
          )}
        </div>

        {/* Help text */}
        <p className="mt-4 text-center text-[10px] text-slate-400">
          Forhåndsvisningen oppdateres automatisk etter hvert som du gjør
          endringer i editoren.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// DELETE LESSON DIALOG
// =============================================================================

interface DeleteLessonDialogProps {
  isOpen: boolean;
  lesson: LearningLesson | null;
  preview: LessonDeletionPreview | null;
  loading: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: (force: boolean, cleanupMedia: boolean) => void;
}

function DeleteLessonDialog({
  isOpen,
  lesson,
  preview,
  loading,
  deleting,
  onClose,
  onConfirm,
}: DeleteLessonDialogProps) {
  const [cleanupMedia, setCleanupMedia] = useState(false);

  if (!isOpen) return null;

  const hasUsage = preview && (
    preview.will_be_deleted.progress_records > 0 ||
    preview.will_be_deleted.quiz_attempts > 0 ||
    preview.users_affected.with_progress > 0
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "rounded-full p-2",
              hasUsage ? "bg-amber-100" : "bg-red-100"
            )}>
              {hasUsage ? (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              ) : (
                <Trash2 className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Slett leksjon
              </h2>
              <p className="text-sm text-slate-500">
                {lesson?.title || "Laster..."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <span className="ml-3 text-sm text-slate-500">Laster informasjon...</span>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* Lesson info */}
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  {getLessonIcon(preview.lesson.kind)}
                  <div>
                    <p className="font-medium text-slate-900">{preview.lesson.title}</p>
                    <p className="text-sm text-slate-500">
                      {preview.lesson.kind} • {preview.lesson.section.title}
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning if lesson has usage */}
              {hasUsage && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">
                        Denne leksjonen har blitt brukt av ansatte
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        Å slette vil fjerne all fremgangsdata og påvirke statistikk.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Impact summary */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Hva vil bli påvirket:
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {preview.users_affected.with_progress > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-900">
                        {preview.users_affected.with_progress}
                      </span>
                      <span className="ml-1 text-slate-600">brukere med fremgang</span>
                    </div>
                  )}
                  {preview.will_be_deleted.progress_records > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-900">
                        {preview.will_be_deleted.progress_records}
                      </span>
                      <span className="ml-1 text-slate-600">fremgangsoppføringer</span>
                    </div>
                  )}
                  {preview.will_be_deleted.quiz_attempts > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-900">
                        {preview.will_be_deleted.quiz_attempts}
                      </span>
                      <span className="ml-1 text-slate-600">quiz-forsøk</span>
                    </div>
                  )}
                  {preview.will_be_deleted.quiz_questions > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-900">
                        {preview.will_be_deleted.quiz_questions}
                      </span>
                      <span className="ml-1 text-slate-600">quiz-spørsmål</span>
                    </div>
                  )}
                  {preview.will_be_updated.activity_logs_set_to_null > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-900">
                        {preview.will_be_updated.activity_logs_set_to_null}
                      </span>
                      <span className="ml-1 text-slate-600">aktivitetslogger</span>
                    </div>
                  )}
                  {preview.media.associated_media_files > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-900">
                        {preview.media.associated_media_files}
                      </span>
                      <span className="ml-1 text-slate-600">mediafiler</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="space-y-1">
                  {preview.warnings.map((warning, idx) => (
                    <p key={idx} className={cn(
                      "text-sm",
                      warning.level === "error" ? "text-red-600" : "text-amber-600"
                    )}>
                      ⚠️ {warning.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Section will be empty warning */}
              {preview.lesson.section.will_be_empty && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-700">
                    <strong>Merk:</strong> Seksjonen "{preview.lesson.section.title}" vil bli tom etter denne slettingen.
                  </p>
                </div>
              )}

              {/* Cleanup media option */}
              {preview.media.associated_media_files > 0 && (
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={cleanupMedia}
                    onChange={(e) => setCleanupMedia(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Slett tilknyttede mediafiler
                    </p>
                    <p className="text-xs text-slate-500">
                      Fjerner {preview.media.associated_media_files} mediafil(er) permanent
                    </p>
                  </div>
                </label>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-red-600">
              Kunne ikke laste informasjon om leksjonen.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleting}
          >
            Avbryt
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(hasUsage || false, cleanupMedia)}
            disabled={loading || deleting || !preview}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sletter...
              </>
            ) : hasUsage ? (
              "Slett likevel"
            ) : (
              "Slett leksjon"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CourseBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ---------------------------------------------
  // STATE MODEL (from documentation)
  // ---------------------------------------------
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    searchParams.get("campaign") || "general"
  );
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(null);
  const [groupedSections, setGroupedSections] =
    useState<GroupedSectionsResponse | null>(null);
  const [lessons, setLessons] = useState<LearningLesson[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // Cache for full lesson/section data (with content/description)
  const [fullLessonCache, setFullLessonCache] = useState<Map<number, LearningLesson>>(new Map());
  const [fullSectionCache, setFullSectionCache] = useState<Map<number, LearningSection>>(new Map());

  // Derived maps (for performance)
  const sectionsByCampaignId = useMemo(() => {
    const map = new Map<string | null, LearningSection[]>();
    if (!groupedSections) return map;
    for (const cg of groupedSections.campaigns) {
      map.set(cg.id, cg.sections);
    }
    return map;
  }, [groupedSections]);

  const lessonsBySectionId = useMemo(() => {
    const map = new Map<number, LearningLesson[]>();
    for (const l of lessons) {
      const existing = map.get(l.section) || [];
      existing.push(l);
      map.set(l.section, existing);
    }
    // Sort by order
    for (const [k, v] of map) {
      map.set(
        k,
        v.sort((a, b) => a.order - b.order)
      );
    }
    return map;
  }, [lessons]);

  const sectionById = useMemo(() => {
    const map = new Map<number, LearningSection>();
    if (!groupedSections) return map;
    for (const cg of groupedSections.campaigns) {
      for (const s of cg.sections) {
        map.set(s.id, s);
      }
    }
    return map;
  }, [groupedSections]);

  const lessonById = useMemo(() => {
    const map = new Map<number, LearningLesson>();
    for (const l of lessons) {
      map.set(l.id, l);
    }
    return map;
  }, [lessons]);

  // Editor state
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Live preview state (for real-time preview updates)
  const [livePreview, setLivePreview] = useState<{
    title?: string;
    description?: string;
    content?: string;
    kind?: string;
    duration?: number;
    questions?: QuizQuestion[];
  }>({});

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [creatingLessonInSection, setCreatingLessonInSection] = useState<
    number | null
  >(null);
  
  // Delete lesson dialog state
  const [deleteLessonDialogOpen, setDeleteLessonDialogOpen] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<LearningLesson | null>(null);
  const [deletionPreview, setDeletionPreview] = useState<LessonDeletionPreview | null>(null);
  const [deletionPreviewLoading, setDeletionPreviewLoading] = useState(false);
  const [deletingLesson, setDeletingLesson] = useState(false);

  // ---------------------------------------------
  // DATA LOADING
  // ---------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = LearningAuthService.getInstance();
      const [authenticated, isSuperuser] = await Promise.all([
        auth.isAuthenticated(),
        auth.checkSuperuser().catch(() => false),
      ]);

      if (!authenticated) {
        router.push("/learning-platform/login");
        return;
      }
      if (!isSuperuser) {
        router.push("/learning-dashboard");
        return;
      }

      const admin = LearningAdminService.getInstance();

      // Parallel fetch: campaigns + sections (ALL including drafts) + lessons
      const [campaignsRes, sectionsRes, lessonsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/campaigns/`, {
          headers: {
            Authorization: `Bearer ${
              JSON.parse(localStorage.getItem("auth_tokens") || "{}").access
            }`,
            "Content-Type": "application/json",
          },
        }).then((r) => (r.ok ? r.json() : { results: [] })),
        admin.getAdminSections(), // Use admin endpoint to get ALL sections including drafts
        admin.getAdminLessons(),
      ]);

      const campaignList = (campaignsRes.results || campaignsRes).map(
        (c: any) => ({
          id: c.id,
          name: c.name,
        })
      );
      setCampaigns(campaignList);
      setLessons(lessonsRes);

      // Manually group sections by campaign (to include drafts)
      const campaignMap = new Map<string, CampaignGroup>();
      
      // Add "General Training" group for sections without campaign
      campaignMap.set("general", {
        id: "general",
        name: "Generell opplæring",
        sections: []
      });
      
      // Add campaign groups
      for (const c of campaignList) {
        campaignMap.set(c.id, {
          id: c.id,
          name: c.name,
          sections: []
        });
      }
      
      // Distribute sections to their campaigns
      for (const section of sectionsRes) {
        // Handle null/undefined campaign as "general"
        const campaignId = section.campaign || section.campaign_id;
        const targetCampaignId = campaignId ? campaignId : "general";
        const group = campaignMap.get(targetCampaignId);
        if (group) {
          group.sections.push(section);
        } else {
          // If campaign not found, add to general
          campaignMap.get("general")?.sections.push(section);
        }
      }
      
      // Convert to GroupedSectionsResponse format
      // Include ALL campaigns (including "general" always for creating new sections)
      const groupedRes: GroupedSectionsResponse = {
        campaigns: Array.from(campaignMap.values())
          .sort((a, b) => {
            // Put "general" at the beginning for easy access
            if (a.id === "general") return -1;
            if (b.id === "general") return 1;
            return a.name.localeCompare(b.name);
          })
      };
      
      setGroupedSections(groupedRes);

      // Set default campaign if none selected (default to "general")
      if (!selectedCampaignId && groupedRes.campaigns.length > 0) {
        // Try to find "general" first, otherwise use first campaign
        const generalCampaign = groupedRes.campaigns.find(c => c.id === "general");
        const firstCampaign = generalCampaign || groupedRes.campaigns[0];
        setSelectedCampaignId(firstCampaign.id || "general");
      }
    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Kunne ikke laste data. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }, [router, selectedCampaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------
  // CURRENT CAMPAIGN SECTIONS
  // ---------------------------------------------
  const currentCampaignSections = useMemo(() => {
    // Use the selectedCampaignId directly - "general" is used for sections without a campaign
    const sections = sectionsByCampaignId.get(selectedCampaignId || "general") || [];
    return sections.sort((a, b) => a.order - b.order);
  }, [sectionsByCampaignId, selectedCampaignId]);

  // All sections for lesson dropdown
  const allSections = useMemo(() => {
    if (!groupedSections) return [];
    return groupedSections.campaigns.flatMap((c) => c.sections);
  }, [groupedSections]);

  // Filtered tree (by search)
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return currentCampaignSections;
    const q = searchQuery.toLowerCase();
    return currentCampaignSections.filter((s) => {
      const sectionMatch = s.title.toLowerCase().includes(q);
      const sectionLessons = lessonsBySectionId.get(s.id) || [];
      const lessonMatch = sectionLessons.some((l) =>
        l.title.toLowerCase().includes(q)
      );
      return sectionMatch || lessonMatch;
    });
  }, [currentCampaignSections, lessonsBySectionId, searchQuery]);

  // ---------------------------------------------
  // HANDLERS
  // ---------------------------------------------
  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleSelectSection = async (sectionId: number) => {
    setSelectedNode({ type: "section", id: sectionId });
    setCreatingSection(false);
    setCreatingLessonInSection(null);
    setExpandedSections((prev) => new Set([...prev, sectionId]));
    
    // Fetch full section data if not cached
    if (!fullSectionCache.has(sectionId)) {
      try {
        const admin = LearningAdminService.getInstance();
        const fullSection = await admin.getAdminSection(sectionId);
        setFullSectionCache((prev) => new Map(prev).set(sectionId, fullSection));
      } catch (e) {
        console.error("Failed to load full section:", e);
      }
    }
  };

  const handleSelectLesson = async (lessonId: number) => {
    setSelectedNode({ type: "lesson", id: lessonId });
    setCreatingSection(false);
    setCreatingLessonInSection(null);
    
    // Fetch full lesson data if not cached
    if (!fullLessonCache.has(lessonId)) {
      try {
        const admin = LearningAdminService.getInstance();
        const fullLesson = await admin.getAdminLesson(lessonId);
        setFullLessonCache((prev) => new Map(prev).set(lessonId, fullLesson));
      } catch (e) {
        console.error("Failed to load full lesson:", e);
      }
    }
  };

  const handleCreateSection = () => {
    setSelectedNode(null);
    setCreatingSection(true);
    setCreatingLessonInSection(null);
  };

  const handleCreateLessonInSection = (sectionId: number) => {
    setSelectedNode(null);
    setCreatingSection(false);
    setCreatingLessonInSection(sectionId);
    setExpandedSections((prev) => new Set([...prev, sectionId]));
  };

  const handleDuplicateSection = async (sectionId: number) => {
    try {
      const admin = LearningAdminService.getInstance();
      await admin.duplicateSection(sectionId);
      await loadData();
    } catch (e) {
      console.error("Failed to duplicate section:", e);
      setError("Kunne ikke duplisere seksjon");
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (!confirm("Er du sikker på at du vil slette denne seksjonen?")) return;
    try {
      const admin = LearningAdminService.getInstance();
      await admin.deleteSection(sectionId);
      if (selectedNode?.type === "section" && selectedNode.id === sectionId) {
        setSelectedNode(null);
      }
      await loadData();
    } catch (e) {
      console.error("Failed to delete section:", e);
      setError("Kunne ikke slette seksjon");
    }
  };

  // Duplicate lesson handler
  const handleDuplicateLesson = async (lessonId: number) => {
    try {
      const admin = LearningAdminService.getInstance();
      const result = await admin.duplicateLesson(lessonId);
      // Select the new lesson
      if (result.new_lesson_id) {
        // Expand the section containing the lesson
        const originalLesson = lessonById.get(lessonId);
        if (originalLesson) {
          setExpandedSections((prev) => new Set([...prev, originalLesson.section]));
        }
      }
      await loadData();
    } catch (e) {
      console.error("Failed to duplicate lesson:", e);
      setError("Kunne ikke duplisere leksjon");
    }
  };

  // Open delete lesson dialog and load preview
  const handleOpenDeleteLessonDialog = async (lessonId: number) => {
    const lesson = lessonById.get(lessonId);
    if (!lesson) return;

    setLessonToDelete(lesson);
    setDeleteLessonDialogOpen(true);
    setDeletionPreview(null);
    setDeletionPreviewLoading(true);

    try {
      const admin = LearningAdminService.getInstance();
      const preview = await admin.getLessonDeletionPreview(lessonId);
      setDeletionPreview(preview);
    } catch (e) {
      console.error("Failed to load deletion preview:", e);
      setError("Kunne ikke laste informasjon om sletting");
    } finally {
      setDeletionPreviewLoading(false);
    }
  };

  // Close delete lesson dialog
  const handleCloseDeleteLessonDialog = () => {
    setDeleteLessonDialogOpen(false);
    setLessonToDelete(null);
    setDeletionPreview(null);
    setDeletionPreviewLoading(false);
    setDeletingLesson(false);
  };

  // Confirm delete lesson
  const handleConfirmDeleteLesson = async (force: boolean, cleanupMedia: boolean) => {
    if (!lessonToDelete) return;

    setDeletingLesson(true);
    setError("");

    try {
      const admin = LearningAdminService.getInstance();
      const response = await admin.deleteLesson(lessonToDelete.id, { 
        force, 
        cleanupMedia 
      });

      // Check if it's a warning (lesson has usage and we didn't force)
      if (admin.isLessonDeletionWarning(response)) {
        // This shouldn't happen if we're using the dialog properly, 
        // but handle it just in case
        console.log("Deletion requires force:", response.message);
        // Try again with force
        const forceResponse = await admin.deleteLesson(lessonToDelete.id, { 
          force: true, 
          cleanupMedia 
        });
        
        if (admin.isLessonDeletionSuccess(forceResponse)) {
          // Clear selection if we deleted the currently selected lesson
          if (selectedNode?.type === "lesson" && selectedNode.id === lessonToDelete.id) {
            setSelectedNode(null);
          }
          handleCloseDeleteLessonDialog();
          await loadData();
        }
      } else if (admin.isLessonDeletionSuccess(response)) {
        // Successfully deleted
        // Clear selection if we deleted the currently selected lesson
        if (selectedNode?.type === "lesson" && selectedNode.id === lessonToDelete.id) {
          setSelectedNode(null);
        }
        handleCloseDeleteLessonDialog();
        await loadData();
      }
    } catch (e: any) {
      console.error("Failed to delete lesson:", e);
      setError(e.message || "Kunne ikke slette leksjon");
    } finally {
      setDeletingLesson(false);
    }
  };

  const handleSaveSection = async (data: any, publish?: boolean) => {
    setSaving(true);
    setError("");
    try {
      const admin = LearningAdminService.getInstance();

      if (creatingSection) {
        // Create new section
        const nextOrder =
          Math.max(0, ...currentCampaignSections.map((s) => s.order)) + 1;
        const slug =
          data.title
            ?.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim() || `section-${Date.now()}`;

        // Determine campaign value: use data.campaign if provided, otherwise use selectedCampaignId
        // Convert "general" to null for API
        const campaignValue = data.campaign !== undefined 
          ? (data.campaign === "general" ? null : data.campaign)
          : (selectedCampaignId === "general" ? null : selectedCampaignId);

        const payload: any = {
          title: data.title,
          description: data.description || "",
          duration_estimate_minutes: data.duration_estimate_minutes || 30,
          order: nextOrder,
          is_active: publish || false,
          slug,
          campaign: campaignValue, // Always include campaign field (required by API)
        };

        const created = await admin.createSection(payload);
        // Cache the new section
        setFullSectionCache((prev) => new Map(prev).set(created.id, created));
        setCreatingSection(false);
        setSelectedNode({ type: "section", id: created.id });
        await loadData();
      } else if (selectedNode?.type === "section") {
        // Update existing section
        const section = sectionById.get(selectedNode.id);
        if (!section) return;

        // Ensure campaign field is always included (required by API)
        // Convert "general" to null if present
        const campaignValue = data.campaign !== undefined 
          ? (data.campaign === "general" ? null : data.campaign)
          : (section.campaign_id === null ? null : section.campaign_id);

        const updated = await admin.updateSection(selectedNode.id, {
          ...data,
          slug: section.slug,
          order: section.order, // Include order field (required by API)
          is_active: publish ?? section.is_active,
          campaign: campaignValue, // Always include campaign field (required by API)
        });
        // Update cache
        setFullSectionCache((prev) => new Map(prev).set(selectedNode.id, updated));
        await loadData();
      }

      setSavedAt(new Date());
    } catch (e: any) {
      console.error("Failed to save section:", e);
      setError(e.message || "Kunne ikke lagre seksjon");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLesson = async (data: any, publish?: boolean) => {
    setSaving(true);
    setError("");
    try {
      const admin = LearningAdminService.getInstance();

      if (creatingLessonInSection !== null) {
        // Create new lesson
        // Fetch fresh lessons from API to avoid order conflicts
        const allLessons = await admin.getAdminLessons();
        const sectionLessons = allLessons.filter((l) => l.section === data.section);
        const nextOrder =
          sectionLessons.length > 0
            ? Math.max(...sectionLessons.map((l) => l.order)) + 1
            : 1;
        // Generate base slug from title
        const baseSlug =
          data.title
            ?.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim() || "lesson";
        // Append timestamp to ensure uniqueness within section
        const slug = `${baseSlug}-${Date.now()}`;

        const payload: any = {
          title: data.title,
          description: data.description || "",
          content: data.content || "",
          kind: data.kind || "TEXT",
          content_url: data.content_url,
          section: data.section,
          order: nextOrder,
          is_active: publish || false,
          duration_estimate_minutes: data.duration_estimate_minutes || 10,
          pass_threshold_percent: data.pass_threshold_percent || 80,
          slug,
        };

        const created = await admin.createLesson(payload);
        // Optimistic update: Add to lessons state immediately for instant UI update
        setLessons((prev) => [...prev, created]);
        // Cache the new lesson
        setFullLessonCache((prev) => new Map(prev).set(created.id, created));
        // Expand the section so the new lesson is visible
        setExpandedSections((prev) => new Set(prev).add(data.section));
        setCreatingLessonInSection(null);
        setSelectedNode({ type: "lesson", id: created.id });
        // Refresh data to ensure consistency
        await loadData();
      } else if (selectedNode?.type === "lesson") {
        // Update existing lesson
        const lesson = lessonById.get(selectedNode.id);
        if (!lesson) return;

        const updated = await admin.updateLesson(selectedNode.id, {
          ...data,
          slug: lesson.slug,
          order: lesson.order, // Include order field (required by API)
          is_active: publish ?? lesson.is_active,
        });
        // Update cache
        setFullLessonCache((prev) => new Map(prev).set(selectedNode.id, updated));
        await loadData();
      }

      setSavedAt(new Date());
    } catch (e: any) {
      console.error("Failed to save lesson:", e);
      setError(e.message || "Kunne ikke lagre leksjon");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuiz = async (lessonData: any, questions: QuizQuestion[], publish?: boolean) => {
    setSaving(true);
    setError("");
    try {
      const admin = LearningAdminService.getInstance();

      // Format questions for API
      const formattedQuestions = questions.map((q, idx) => ({
        question_text: q.text,
        order: idx + 1,
        answers: q.options.map((opt, optIdx) => ({
          answer_text: opt.text,
          is_correct: opt.isCorrect,
          order: optIdx + 1
        }))
      }));

      if (creatingLessonInSection !== null) {
        // Create new quiz with questions
        // Fetch fresh lessons from API to avoid order conflicts
        const allLessons = await admin.getAdminLessons();
        const sectionLessons = allLessons.filter((l) => l.section === lessonData.section);
        const nextOrder =
          sectionLessons.length > 0
            ? Math.max(...sectionLessons.map((l) => l.order)) + 1
            : 1;
        // Generate base slug from title
        const baseSlug =
          lessonData.title
            ?.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim() || "quiz";
        // Append timestamp to ensure uniqueness within section
        const slug = `${baseSlug}-${Date.now()}`;

        const result = await admin.createQuizWithQuestions({
          lesson: {
            title: lessonData.title,
            description: lessonData.description || "",
            content: lessonData.description || "",
            kind: "QUIZ",
            section: lessonData.section,
            order: nextOrder,
            is_active: publish || false,
            duration_estimate_minutes: lessonData.duration_estimate_minutes || 15,
            pass_threshold_percent: lessonData.pass_threshold_percent || 80,
            slug,
          },
          questions: formattedQuestions
        });

        // Optimistic update: Add to lessons state immediately for instant UI update
        if (result.lesson) {
          setLessons((prev) => [...prev, result.lesson]);
          setFullLessonCache((prev) => new Map(prev).set(result.lesson.id, result.lesson));
          // Expand the section so the new lesson is visible
          setExpandedSections((prev) => new Set(prev).add(lessonData.section));
          setSelectedNode({ type: "lesson", id: result.lesson.id });
        }
        setCreatingLessonInSection(null);
        // Refresh data to ensure consistency
        await loadData();
      } else if (selectedNode?.type === "lesson") {
        // Update existing quiz with questions
        const lesson = lessonById.get(selectedNode.id);
        if (!lesson) return;

        const updateResult = await admin.updateQuizWithQuestions(selectedNode.id, {
          title: lessonData.title,
          description: lessonData.description,
          pass_threshold_percent: lessonData.pass_threshold_percent,
          is_active: publish !== undefined ? publish : lesson.is_active,
          questions: formattedQuestions
        });

        // Notify user if progress was reset for some users
        if (updateResult.users_progress_reset > 0) {
          // Use a timeout to show the alert after the UI updates
          setTimeout(() => {
            alert(`Quiz updated successfully.\n\n${updateResult.users_progress_reset} user(s) had their progress reset and will need to retake the quiz.`);
          }, 100);
        }

        // Fetch updated lesson and cache it
        const updated = await admin.getAdminLesson(selectedNode.id);
        setFullLessonCache((prev) => new Map(prev).set(selectedNode.id, updated));
        await loadData();
      }

      setSavedAt(new Date());
    } catch (e: any) {
      console.error("Failed to save quiz:", e);
      setError(e.message || "Kunne ikke lagre quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setSelectedNode(null);
    setCreatingSection(false);
    setCreatingLessonInSection(null);
    setLivePreview({});
  };

  // ---------------------------------------------
  // RENDER
  // ---------------------------------------------
  if (loading) {
    return <LoadingState message="Laster kursbygger..." />;
  }

  if (error && !groupedSections) {
    return (
      <ErrorState
        title="Kunne ikke laste data"
        message={error}
        onGoHome={() => router.push("/admin-dashboard-learning")}
      />
    );
  }

  const currentCampaignName =
    campaigns.find((c) => c.id === selectedCampaignId)?.name ||
    (selectedCampaignId === "general" ? "Generell opplæring" : "Ukjent kampanje");

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Page toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Campaign filter */}
          <Select
            value={selectedCampaignId || "general"}
            onValueChange={(v) => setSelectedCampaignId(v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Velg kampanje" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Generell opplæring</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk seksjoner og leksjoner..."
              className="w-64 pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-slate-500">
              Lagret {savedAt.toLocaleTimeString("no-NO")}
            </span>
          )}
          {error && (
            <span className="text-xs text-red-600">{error}</span>
          )}
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Course tree */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
          <div className="p-4">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Kursstruktur
              </h3>
              {selectedNode?.type === "section" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCreateLessonInSection(selectedNode.id)}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Leksjon
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateSection}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Seksjon
                </Button>
              )}
            </div>

            {/* Tree */}
            <div className="space-y-1" role="tree">
              {filteredSections.length === 0 ? (
                <div className="py-8 text-center">
                  <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">
                    Ingen seksjoner ennå
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateSection}
                    className="mt-3"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Opprett seksjon
                  </Button>
                </div>
              ) : (
                filteredSections.map((section) => (
                  <SectionTreeItem
                    key={section.id}
                    section={section}
                    lessons={lessonsBySectionId.get(section.id) || []}
                    isExpanded={expandedSections.has(section.id)}
                    isSelected={
                      selectedNode?.type === "section" &&
                      selectedNode.id === section.id
                    }
                    selectedLessonId={
                      selectedNode?.type === "lesson" ? selectedNode.id : null
                    }
                    onToggle={() => toggleSection(section.id)}
                    onSelect={() => handleSelectSection(section.id)}
                    onSelectLesson={handleSelectLesson}
                    onAddLesson={() => handleCreateLessonInSection(section.id)}
                    onDuplicate={() => handleDuplicateSection(section.id)}
                    onDelete={() => handleDeleteSection(section.id)}
                    onDuplicateLesson={handleDuplicateLesson}
                    onDeleteLesson={handleOpenDeleteLessonDialog}
                  />
                ))
              )}
            </div>

            {/* Bottom action */}
            {filteredSections.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateSection}
                  className="w-full justify-start gap-2 text-slate-600"
                >
                  <Plus className="h-4 w-4" />
                  Legg til seksjon
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: Editor */}
        <main className="flex-1 overflow-hidden bg-slate-50">
          {creatingSection ? (
            <SectionEditorPanel
              section={null}
              isNew={true}
              campaigns={campaigns}
              selectedCampaignId={selectedCampaignId}
              saving={saving}
              onSave={handleSaveSection}
              onCancel={handleCancelEdit}
              onLiveChange={(data) => setLivePreview({ ...data, content: undefined, kind: "SEKSJON" })}
            />
          ) : creatingLessonInSection !== null ? (
            <LessonEditorPanel
              lesson={null}
              isNew={true}
              sections={allSections}
              preselectedSectionId={creatingLessonInSection}
              saving={saving}
              onSave={handleSaveLesson}
              onSaveQuiz={handleSaveQuiz}
              onCancel={handleCancelEdit}
              onLiveChange={(data) => setLivePreview(data)}
            />
          ) : selectedNode?.type === "section" ? (
            <SectionEditorPanel
              section={fullSectionCache.get(selectedNode.id) || sectionById.get(selectedNode.id) || null}
              isNew={false}
              campaigns={campaigns}
              selectedCampaignId={selectedCampaignId}
              saving={saving}
              onSave={handleSaveSection}
              onCancel={handleCancelEdit}
              onLiveChange={(data) => setLivePreview({ ...data, content: undefined, kind: "SEKSJON" })}
            />
          ) : selectedNode?.type === "lesson" ? (
            <LessonEditorPanel
              lesson={fullLessonCache.get(selectedNode.id) || lessonById.get(selectedNode.id) || null}
              isNew={false}
              sections={allSections}
              preselectedSectionId={null}
              saving={saving}
              onSave={handleSaveLesson}
              onSaveQuiz={handleSaveQuiz}
              onCancel={handleCancelEdit}
              onLiveChange={(data) => setLivePreview(data)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center">
              <FolderOpen className="h-16 w-16 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                Velkommen til kursbyggeren
              </h3>
              <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
                Velg en seksjon eller leksjon fra treet til venstre, eller
                opprett nytt innhold.
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCreateSection}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Ny seksjon
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT: Preview */}
        <aside className="hidden w-80 shrink-0 lg:block">
          <PreviewPanel
            selectedNode={selectedNode}
            sections={allSections}
            lessons={lessons}
            liveTitle={livePreview.title}
            liveDescription={livePreview.description}
            liveContent={livePreview.content}
            liveKind={livePreview.kind}
            liveDuration={livePreview.duration}
            liveQuestions={livePreview.questions}
          />
        </aside>
      </div>

      {/* Delete Lesson Dialog */}
      <DeleteLessonDialog
        isOpen={deleteLessonDialogOpen}
        lesson={lessonToDelete}
        preview={deletionPreview}
        loading={deletionPreviewLoading}
        deleting={deletingLesson}
        onClose={handleCloseDeleteLessonDialog}
        onConfirm={handleConfirmDeleteLesson}
      />
    </div>
  );
}
