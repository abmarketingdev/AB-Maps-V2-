"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Edit, Trash2, Copy, HelpCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "@/components/learning/MobileHeader";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { MobileDialog, MobileFormField, MobileSelect, MobileActionMenu, CommonActions } from "@/components/admin";
import type { LearningLesson, LearningSection } from "@/services/learningTypes";

const QuizManagement = () => {
  const [quizzes, setQuizzes] = useState<LearningLesson[]>([]);
  const [sections, setSections] = useState<LearningSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<LearningLesson | null>(null);
  const router = useRouter();
  const isMobile = useIsMobile(); // Must be called before any conditional returns

  // Quiz form data structure
  const [quizFormData, setQuizFormData] = useState({
    sectionId: "",
    title: "",
    description: "",
    passThreshold: 80,
    duration: 15,
    order: 1,
    questions: [
      { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
      { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
      { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] }
    ]
  });

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

        await Promise.all([fetchQuizzes(), fetchSections()]);
      } catch (error) {
        console.error("Authentication error:", error);
        setError("Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchQuizzes = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const allLessons = await adminService.getAdminLessons();
      // Filter only QUIZ type lessons
      const quizLessons = allLessons.filter(lesson => lesson.kind === "QUIZ");
      setQuizzes(quizLessons);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      setError("Failed to fetch quizzes");
    }
  };

  const fetchSections = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const data = await adminService.getAdminSections();
      setSections(data);
    } catch (error) {
      console.error("Error fetching sections:", error);
    }
  };

  const handleCreateQuiz = async () => {
    try {
      // Validate
      if (!quizFormData.sectionId) {
        setError("Please select a section");
        return;
      }

      if (quizFormData.questions.length < 3) {
        setError("Quiz must have at least 3 questions");
        return;
      }

      // Check each question has a correct answer
      for (let i = 0; i < quizFormData.questions.length; i++) {
        const question = quizFormData.questions[i];
        
        if (!question.text.trim()) {
          setError(`Question ${i + 1} text is required`);
          return;
        }

        const hasCorrect = question.options.some(opt => opt.isCorrect);
        if (!hasCorrect) {
          setError(`Question ${i + 1} must have a correct answer`);
          return;
        }

        for (let j = 0; j < question.options.length; j++) {
          if (!question.options[j].text.trim()) {
            setError(`Question ${i + 1}, Option ${j + 1} text is required`);
            return;
          }
        }
      }

      const adminService = LearningAdminService.getInstance();
      
      // Generate base slug from title, append timestamp to ensure uniqueness
      const baseSlug = quizFormData.title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() || 'quiz';
      const slug = `${baseSlug}-${Date.now()}`;

      const result = await adminService.createQuizWithQuestions({
        lesson: {
          section: parseInt(quizFormData.sectionId),
          title: quizFormData.title,
          slug: slug,
          description: quizFormData.description,
          content: quizFormData.description,
          kind: "QUIZ",
          pass_threshold_percent: quizFormData.passThreshold,
          order: quizFormData.order,
          duration_estimate_minutes: quizFormData.duration,
          is_active: false
        },
        questions: quizFormData.questions.map((q, idx) => ({
          question_text: q.text,
          order: idx + 1,
          answers: q.options.map((opt, optIdx) => ({
            answer_text: opt.text,
            is_correct: opt.isCorrect,
            order: optIdx + 1
          }))
        }))
      });

      alert(result.message || 'Quiz created successfully!');
      setIsCreateDialogOpen(false);
      resetQuizForm();
      await fetchQuizzes();
    } catch (error: any) {
      console.error("Error creating quiz:", error);
      setError(error.message || "Failed to create quiz");
    }
  };

  const handleUpdateQuiz = async () => {
    if (!editingQuiz) return;

    try {
      // Validate
      if (quizFormData.questions.length < 3) {
        setError("Quiz must have at least 3 questions");
        return;
      }

      // Check each question has a correct answer
      for (let i = 0; i < quizFormData.questions.length; i++) {
        const hasCorrect = quizFormData.questions[i].options.some(opt => opt.isCorrect);
        if (!hasCorrect) {
          setError(`Question ${i + 1} must have a correct answer`);
          return;
        }
      }

      const adminService = LearningAdminService.getInstance();
      
      const result = await adminService.updateQuizWithQuestions(editingQuiz.id, {
        title: quizFormData.title,
        description: quizFormData.description,
        pass_threshold_percent: quizFormData.passThreshold,
        is_active: editingQuiz.is_active,
        questions: quizFormData.questions.map((q, idx) => ({
          question_text: q.text,
          order: idx + 1,
          answers: q.options.map((opt, optIdx) => ({
            answer_text: opt.text,
            is_correct: opt.isCorrect,
            order: optIdx + 1
          }))
        }))
      });

      // Build success message including info about reset progress if applicable
      let successMessage = result.message || 'Quiz updated successfully!';
      if (result.users_progress_reset > 0) {
        successMessage += `\n\n${result.users_progress_reset} user(s) had their progress reset and will need to retake the quiz.`;
      }
      
      alert(successMessage);
      setIsEditDialogOpen(false);
      setEditingQuiz(null);
      resetQuizForm();
      await fetchQuizzes();
    } catch (error: any) {
      console.error("Error updating quiz:", error);
      setError(error.message || "Failed to update quiz.");
    }
  };

  const handleDeleteQuiz = async (id: number) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return;
    
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.deleteLesson(id);
      await fetchQuizzes();
    } catch (error) {
      console.error("Error deleting quiz:", error);
      setError("Failed to delete quiz");
    }
  };

  const handleDuplicateQuiz = async (id: number) => {
    try {
      const adminService = LearningAdminService.getInstance();
      const result = await adminService.duplicateLesson(id);
      alert(`Quiz duplicated successfully! New quiz ID: ${result.new_lesson_id}`);
      await fetchQuizzes();
    } catch (error) {
      console.error("Error duplicating quiz:", error);
      setError("Failed to duplicate quiz");
    }
  };

  const openEditDialog = async (quiz: LearningLesson) => {
    try {
      // Fetch full quiz details with questions
      const adminService = LearningAdminService.getInstance();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/${quiz.id}/`, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth_tokens') || '{}').access}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch quiz details');
      
      const quizDetails = await response.json();
      
      setEditingQuiz(quizDetails);
      
      // Map quiz data to form format
      setQuizFormData({
        sectionId: quizDetails.section.toString(),
        title: quizDetails.title,
        description: quizDetails.description || "",
        passThreshold: quizDetails.pass_threshold_percent || 80,
        duration: quizDetails.duration_estimate_minutes || 15,
        order: quizDetails.order || 1,
        questions: quizDetails.quiz_questions?.map((q: any) => ({
          text: q.question_text,
          options: q.answers.map((a: any) => ({
            text: a.answer_text,
            isCorrect: a.is_correct
          }))
        })) || [
          { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
          { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
          { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] }
        ]
      });
      
      setIsEditDialogOpen(true);
    } catch (error) {
      console.error("Error loading quiz details:", error);
      setError("Failed to load quiz details");
    }
  };

  const resetQuizForm = () => {
    setQuizFormData({
      sectionId: "",
      title: "",
      description: "",
      passThreshold: 80,
      duration: 15,
      order: 1,
      questions: [
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] },
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] }
      ]
    });
    setError("");
  };

  // Question/Answer management
  const addQuestion = () => {
    setQuizFormData({
      ...quizFormData,
      questions: [
        ...quizFormData.questions,
        { text: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] }
      ]
    });
  };

  const removeQuestion = (qIdx: number) => {
    if (quizFormData.questions.length <= 3) {
      alert("Quiz must have at least 3 questions");
      return;
    }
    const updated = { ...quizFormData };
    updated.questions.splice(qIdx, 1);
    setQuizFormData(updated);
  };

  const updateQuestionText = (qIdx: number, text: string) => {
    const updated = { ...quizFormData };
    updated.questions[qIdx].text = text;
    setQuizFormData(updated);
  };

  const addOption = (qIdx: number) => {
    if (quizFormData.questions[qIdx].options.length >= 6) {
      alert("Maximum 6 options per question");
      return;
    }
    const updated = { ...quizFormData };
    updated.questions[qIdx].options.push({ text: "", isCorrect: false });
    setQuizFormData(updated);
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    if (quizFormData.questions[qIdx].options.length <= 2) {
      alert("Minimum 2 options per question");
      return;
    }
    const updated = { ...quizFormData };
    updated.questions[qIdx].options.splice(optIdx, 1);
    setQuizFormData(updated);
  };

  const updateOptionText = (qIdx: number, optIdx: number, text: string) => {
    const updated = { ...quizFormData };
    updated.questions[qIdx].options[optIdx].text = text;
    setQuizFormData(updated);
  };

  const setCorrectAnswer = (qIdx: number, optIdx: number) => {
    const updated = { ...quizFormData };
    // Set all to false
    updated.questions[qIdx].options.forEach(opt => opt.isCorrect = false);
    // Set selected to true
    updated.questions[qIdx].options[optIdx].isCorrect = true;
    setQuizFormData(updated);
  };

  // Filter quizzes
  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         quiz.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSection = sectionFilter === "all" || quiz.section.toString() === sectionFilter;
    return matchesSearch && matchesSection;
  });

  if (loading) {
    return <LoadingState message="Loading quizzes..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {isMobile ? (
        <MobileHeader
          title="Quiz Management"
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
                  Back to Admin Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Quiz Management</h1>
                <p className="text-gray-600">Manage quizzes and questions</p>
              </div>
            </div>
            <Button onClick={() => { resetQuizForm(); setIsCreateDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Quiz
            </Button>
          </div>
        </header>
      )}

      {/* Mobile Create Button */}
      {isMobile && (
        <div className="px-4 pt-4">
          <Button
            onClick={() => { resetQuizForm(); setIsCreateDialogOpen(true); }}
            className="w-full h-12 min-h-[44px]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Quiz
          </Button>
        </div>
      )}

      <div className={cn(
        "mx-auto",
        isMobile ? "px-4 py-4" : "max-w-7xl px-6 py-6"
      )}>
        {/* Error Display */}
        {error && (
          <div className={cn(
            "mb-6 bg-red-100 border border-red-300 text-red-800 rounded-lg",
            isMobile ? "p-3 text-sm" : "p-4"
          )}>
            {error}
            <button
              onClick={() => setError("")}
              className={cn(
                "ml-4 underline",
                isMobile && "block mt-2"
              )}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filters */}
        <div className={cn(
          "mb-6 flex items-center gap-4",
          isMobile ? "flex-col gap-3" : "flex-row"
        )}>
          <div className={cn("flex-1", isMobile && "w-full")}>
            <div className="relative">
              <Search className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400",
                isMobile ? "w-5 h-5" : "w-4 h-4"
              )} />
              <Input
                placeholder="Search for quiz..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "pl-10",
                  isMobile && "min-h-[44px]"
                )}
              />
            </div>
          </div>
          <div className={cn(isMobile && "w-full")}>
            <MobileSelect
              value={sectionFilter}
              onValueChange={setSectionFilter}
              placeholder="Filter by section"
              options={[
                { value: "all", label: `All sections (${quizzes.length})` },
                ...sections.map(s => ({
                  value: s.id.toString(),
                  label: `${s.title} (${quizzes.filter(q => q.section === s.id).length})`
                }))
              ]}
            />
          </div>
        </div>

        {/* Quiz List */}
        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3 gap-6"
        )}>
          {filteredQuizzes.map((quiz) => {
            const section = sections.find(s => s.id === quiz.section);
            return (
              <Card key={quiz.id} className={cn(
                "relative hover:shadow-lg transition-shadow",
                isMobile && "min-h-[180px]"
              )}>
                <CardHeader className={cn(isMobile ? "p-4" : "")}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "rounded-lg bg-purple-500 flex-shrink-0",
                        isMobile ? "p-1.5" : "p-2"
                      )}>
                        <HelpCircle className={cn(
                          "text-white",
                          isMobile ? "w-4 h-4" : "w-5 h-5"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className={cn(
                          "truncate",
                          isMobile ? "text-base" : "text-lg"
                        )}>
                          {quiz.title}
                        </CardTitle>
                        <CardDescription className={cn(
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {section?.title || `Section ${quiz.section}`}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
                  <p className={cn(
                    "text-gray-600 mb-4 line-clamp-2",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {quiz.description || "No description"}
                  </p>
                  
                  <div className={cn(
                    "flex flex-wrap items-center gap-2 mb-4",
                    isMobile && "gap-1.5"
                  )}>
                    <Badge variant="outline" className={cn(
                      isMobile && "text-[10px] px-1.5 py-0"
                    )}>
                      📝 {quiz.question_count || 0} questions
                    </Badge>
                    <Badge variant="outline" className={cn(
                      isMobile && "text-[10px] px-1.5 py-0"
                    )}>
                      ✅ Pass: {quiz.pass_threshold_percent || 80}%
                    </Badge>
                    <Badge variant="outline" className={cn(
                      isMobile && "text-[10px] px-1.5 py-0"
                    )}>
                      ⏱️ {quiz.duration_estimate_minutes || 15}min
                    </Badge>
                    <Badge
                      variant={quiz.is_active ? "default" : "secondary"}
                      className={cn(isMobile && "text-[10px] px-1.5 py-0")}
                    >
                      {quiz.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className={cn(
                    "flex items-center gap-2",
                    isMobile && "flex-col w-full"
                  )}>
                    <Button
                      variant="outline"
                      size={isMobile ? "default" : "sm"}
                      onClick={() => openEditDialog(quiz)}
                      className={cn(
                        isMobile ? "w-full h-12 min-h-[44px]" : "flex-1"
                      )}
                    >
                      <Edit className={cn("mr-1", isMobile ? "w-4 h-4" : "w-3 h-3")} />
                      Edit
                    </Button>
                    <div className={cn(
                      "flex items-center gap-2",
                      isMobile && "w-full"
                    )}>
                      <Button
                        variant="outline"
                        size={isMobile ? "default" : "sm"}
                        onClick={() => handleDuplicateQuiz(quiz.id)}
                        className={cn(isMobile && "flex-1 h-12 min-h-[44px]")}
                      >
                        <Copy className={cn(isMobile ? "w-4 h-4" : "w-3 h-3")} />
                      </Button>
                      <Button
                        variant="outline"
                        size={isMobile ? "default" : "sm"}
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className={cn(isMobile && "flex-1 h-12 min-h-[44px]")}
                      >
                        <Trash2 className={cn(isMobile ? "w-4 h-4" : "w-3 h-3")} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredQuizzes.length === 0 && (
          <Card className={cn("text-center", isMobile ? "py-8" : "py-12")}>
            <CardContent className={cn(isMobile ? "p-4" : "")}>
              <HelpCircle className={cn(
                "text-gray-400 mx-auto mb-4",
                isMobile ? "w-10 h-10" : "w-12 h-12"
              )} />
              <h3 className={cn(
                "font-medium text-gray-900 mb-2",
                isMobile ? "text-base" : "text-lg"
              )}>
                {searchQuery || sectionFilter !== "all" ? "No quizzes found" : "No quizzes yet"}
              </h3>
              <p className={cn(
                "text-gray-600 mb-4",
                isMobile ? "text-sm" : ""
              )}>
                {searchQuery || sectionFilter !== "all" 
                  ? "Try changing the search or filter" 
                  : "Create your first quiz to get started."}
              </p>
              {!searchQuery && sectionFilter === "all" && (
                <Button
                  onClick={() => { resetQuizForm(); setIsCreateDialogOpen(true); }}
                  className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                >
                  <Plus className={cn("mr-2", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  Create First Quiz
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Quiz Dialog */}
      <QuizFormDialog
        isOpen={isCreateDialogOpen || isEditDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setEditingQuiz(null);
          resetQuizForm();
        }}
        isEdit={isEditDialogOpen}
        formData={quizFormData}
        setFormData={setQuizFormData}
        sections={sections}
        onSubmit={isEditDialogOpen ? handleUpdateQuiz : handleCreateQuiz}
        addQuestion={addQuestion}
        removeQuestion={removeQuestion}
        updateQuestionText={updateQuestionText}
        addOption={addOption}
        removeOption={removeOption}
        updateOptionText={updateOptionText}
        setCorrectAnswer={setCorrectAnswer}
      />
    </div>
  );
};

// Quiz Form Dialog Component
interface QuizFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isEdit: boolean;
  formData: any;
  setFormData: (data: any) => void;
  sections: LearningSection[];
  onSubmit: () => void;
  addQuestion: () => void;
  removeQuestion: (qIdx: number) => void;
  updateQuestionText: (qIdx: number, text: string) => void;
  addOption: (qIdx: number) => void;
  removeOption: (qIdx: number, optIdx: number) => void;
  updateOptionText: (qIdx: number, optIdx: number, text: string) => void;
  setCorrectAnswer: (qIdx: number, optIdx: number) => void;
}

const QuizFormDialog: React.FC<QuizFormDialogProps> = ({
  isOpen,
  onClose,
  isEdit,
  formData,
  setFormData,
  sections,
  onSubmit,
  addQuestion,
  removeQuestion,
  updateQuestionText,
  addOption,
  removeOption,
  updateOptionText,
  setCorrectAnswer,
}) => {
  const isMobile = useIsMobile();
  
  if (!isOpen) return null;

  return (
    <MobileDialog
      open={isOpen}
      onOpenChange={onClose}
      title={isEdit ? "Edit Quiz" : "Create New Quiz"}
      description={isEdit ? "Update the quiz and questions" : "Fill in the information for the new quiz (minimum 3 questions)"}
      maxWidth="max-w-4xl"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              if (formData.sectionId)
                window.open(`/learning-platform/${formData.sectionId}`, "_blank", "noopener,noreferrer");
            }}
            disabled={!formData.sectionId}
            title={!formData.sectionId ? "Velg seksjon for å forhåndsvise" : "Åpner seksjonen i ny fane"}
            className={cn(isMobile && "w-full h-12 min-h-[44px]")}
          >
            <span className="material-symbols-outlined text-[18px] mr-1">visibility</span>
            Forhåndsvis
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className={cn(isMobile && "w-full h-12 min-h-[44px]")}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            className={cn(isMobile && "w-full h-12 min-h-[44px]")}
          >
            {isEdit ? "Update Quiz" : "Create Quiz"}
          </Button>
        </>
      }
    >

      <div className={cn("space-y-6", isMobile && "space-y-4")}>
        {/* Basic Quiz Info */}
        <div className="space-y-4">
          <MobileFormField label="Section" required>
            <MobileSelect
              value={formData.sectionId}
              onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
              placeholder="Select section"
              options={sections.map(s => ({
                value: s.id.toString(),
                label: s.campaign_name ? `${s.campaign_name} - ${s.title}` : s.title
              }))}
            />
          </MobileFormField>

          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-2"
          )}>
            <MobileFormField label="Quiz Title" required>
              <Input
                placeholder="e.g. Product Knowledge Quiz"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={cn(isMobile && "min-h-[44px]")}
              />
            </MobileFormField>
            <MobileFormField label="Order">
              <Input
                type="number"
                min="1"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                className={cn(isMobile && "min-h-[44px]")}
              />
            </MobileFormField>
          </div>

          <MobileFormField label="Description">
            <Textarea
              placeholder="What does this quiz cover?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={isMobile ? 3 : 2}
              className={cn(isMobile && "min-h-[80px]")}
            />
          </MobileFormField>

          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-2"
          )}>
            <MobileFormField label={`Pass Threshold: ${formData.passThreshold}%`}>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.passThreshold}
                onChange={(e) => setFormData({ ...formData, passThreshold: parseInt(e.target.value) })}
                className={cn(
                  "w-full",
                  isMobile && "h-8"
                )}
              />
            </MobileFormField>
            <MobileFormField label="Duration (minutes)">
              <Input
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 15 })}
                className={cn(isMobile && "min-h-[44px]")}
              />
            </MobileFormField>
          </div>
        </div>

        {/* Questions */}
        <div className={cn("border-t", isMobile ? "pt-4" : "pt-6")}>
          <div className={cn(
            "flex items-center justify-between mb-4",
            isMobile ? "flex-col gap-3 items-stretch" : "flex-row"
          )}>
            <h3 className={cn(
              "font-semibold",
              isMobile ? "text-base" : "text-lg"
            )}>
              Questions (minimum 3)
            </h3>
            <Button
              type="button"
              variant="outline"
              size={isMobile ? "default" : "sm"}
              onClick={addQuestion}
              className={cn(isMobile && "w-full h-12 min-h-[44px]")}
            >
              <Plus className={cn("mr-1", isMobile ? "w-5 h-5" : "w-4 h-4")} />
              Add Question
            </Button>
          </div>

          <div className={cn("space-y-4", isMobile && "space-y-3")}>
            {formData.questions.map((question: any, qIdx: number) => (
              <Card key={qIdx} className="bg-blue-50 border-blue-200">
                <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                  <div className={cn(
                    "flex items-center justify-between mb-3",
                    isMobile && "flex-col gap-2 items-stretch"
                  )}>
                    <h4 className={cn(
                      "font-semibold text-blue-900",
                      isMobile ? "text-sm" : ""
                    )}>
                      Question {qIdx + 1}
                    </h4>
                    {formData.questions.length > 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size={isMobile ? "default" : "sm"}
                        onClick={() => removeQuestion(qIdx)}
                        className={cn(
                          isMobile && "w-full h-12 min-h-[44px]"
                        )}
                      >
                        <Trash2 className={cn(
                          "text-red-600",
                          isMobile ? "w-5 h-5 mr-2" : "w-4 h-4"
                        )} />
                        {isMobile && "Remove Question"}
                      </Button>
                    )}
                  </div>

                  <Input
                    placeholder="Enter the question here"
                    value={question.text}
                    onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                    className={cn(
                      "mb-3 bg-white",
                      isMobile && "min-h-[44px]"
                    )}
                  />

                  <div className="space-y-2">
                    <label className={cn(
                      "font-medium text-gray-700 block",
                      isMobile ? "text-xs mb-2" : "text-sm"
                    )}>
                      Answer Options (2-6) - Mark correct answer with radio button:
                    </label>
                    {question.options.map((option: any, optIdx: number) => (
                      <div
                        key={optIdx}
                        className={cn(
                          "flex items-center gap-2 bg-white rounded border",
                          isMobile ? "p-2.5 flex-col items-stretch" : "p-2"
                        )}
                      >
                        <div className={cn(
                          "flex items-center gap-2 w-full",
                          isMobile && "mb-2"
                        )}>
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={option.isCorrect}
                            onChange={() => setCorrectAnswer(qIdx, optIdx)}
                            className={cn(
                              "text-green-600 flex-shrink-0",
                              isMobile ? "w-5 h-5" : "w-4 h-4"
                            )}
                            title="Mark as correct answer"
                            aria-label="Correct answer"
                          />
                          <Input
                            placeholder={`Option ${optIdx + 1}`}
                            value={option.text}
                            onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                            className={cn(
                              "flex-1",
                              isMobile && "min-h-[44px]"
                            )}
                          />
                          {question.options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size={isMobile ? "default" : "sm"}
                              onClick={() => removeOption(qIdx, optIdx)}
                              className={cn(
                                "flex-shrink-0",
                                isMobile && "h-12 min-h-[44px] w-12"
                              )}
                            >
                              <Trash2 className={cn(
                                "text-red-600",
                                isMobile ? "w-5 h-5" : "w-4 h-4"
                              )} />
                            </Button>
                          )}
                        </div>
                        {isMobile && option.isCorrect && (
                          <div className="text-xs text-green-600 font-medium">
                            ✓ Correct Answer
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {question.options.length < 6 && (
                      <Button
                        type="button"
                        variant="outline"
                        size={isMobile ? "default" : "sm"}
                        onClick={() => addOption(qIdx)}
                        className={cn(
                          "w-full",
                          isMobile && "h-12 min-h-[44px]"
                        )}
                      >
                        <Plus className={cn("mr-1", isMobile ? "w-5 h-5" : "w-3 h-3")} />
                        Add Option
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </MobileDialog>
  );
};

export default QuizManagement;

