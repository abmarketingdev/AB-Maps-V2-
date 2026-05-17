import type { 
  LearningSection, 
  LearningSectionCreate, 
  LearningSectionUpdate,
  LearningLesson, 
  LearningLessonCreate, 
  LearningLessonUpdate,
  LearningStats,
  StaffStats,
  SectionCompletionStats,
  ActivityStats,
  AllUsersProgressResponse,
  IndividualUserProgressResponse,
  PaginatedResponse,
  GroupedSectionsResponse,  // NEW - for grouped sections endpoint
  LessonDeletionPreview,
  LessonDeletionResponse,
  LessonDeletionWarningResponse,
  LessonDeletionSuccessResponse
} from './learningTypes';

// Admin learning management service
export class LearningAdminService {
  private static instance: LearningAdminService;
  
  static getInstance(): LearningAdminService {
    if (!LearningAdminService.instance) {
      LearningAdminService.instance = new LearningAdminService();
    }
    return LearningAdminService.instance;
  }

  private getAuthHeaders() {
    const tokens = localStorage.getItem('auth_tokens');
    if (!tokens) {
      throw new Error('No authentication tokens found');
    }
    
    try {
      const tokenData = JSON.parse(tokens);
      return {
        'Authorization': `Bearer ${tokenData.access}`,
        'Content-Type': 'application/json',
      };
    } catch {
      throw new Error('Invalid authentication tokens');
    }
  }

  // Helper to fetch all pages from a paginated endpoint
  private async fetchAllPages<T>(baseUrl: string): Promise<T[]> {
    const allResults: T[] = [];
    let url: string | null = baseUrl;
    
    while (url) {
      const response: Response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) throw new Error(`Failed to fetch from ${baseUrl}`);
      const data: { results?: T[]; next?: string | null } | T[] = await response.json();
      
      // Handle both paginated and non-paginated responses
      if (!Array.isArray(data) && data.results) {
        allResults.push(...data.results);
        
        // Fix for production: The API returns absolute URLs with potentially wrong protocol/host
        // Extract page parameter and construct URL using our configured API URL
        if (data.next) {
          try {
            const nextUrl = new URL(data.next);
            const page = nextUrl.searchParams.get('page');
            if (page) {
              // Construct next URL using the configured API base URL
              const separator = baseUrl.includes('?') ? '&' : '?';
              url = `${baseUrl}${separator}page=${page}`;
            } else {
              url = null;
            }
          } catch {
            // If URL parsing fails, try using the next URL directly
            url = data.next;
          }
        } else {
          url = null;
        }
      } else if (Array.isArray(data)) {
        allResults.push(...data);
        url = null;
      } else {
        url = null;
      }
    }
    
    return allResults;
  }

  // Admin Section APIs
  async getAdminSections(): Promise<LearningSection[]> {
    return this.fetchAllPages<LearningSection>(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/sections/`
    );
  }

  // NEW: Get admin sections grouped by campaign
  // Uses admin endpoint to include ALL sections (including drafts with is_active: false)
  async getAdminGroupedSections(): Promise<GroupedSectionsResponse> {
    // Fetch all sections using admin endpoint (includes drafts)
    const sections = await this.getAdminSections();
    
    // Fetch campaigns to get campaign names
    const campaignsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/campaigns/`,
      { headers: this.getAuthHeaders() }
    );
    
    const campaignsData = campaignsResponse.ok ? await campaignsResponse.json() : { results: [] };
    const campaigns = (campaignsData.results || campaignsData) as Array<{ id: string; name: string }>;
    
    // Build campaign map for grouping
    const campaignMap = new Map<string, { id: string | null; name: string; is_general: boolean; sections: LearningSection[] }>();
    
    // Add "General Training" group for sections without campaign
    campaignMap.set("general", {
      id: null,
      name: "Generell opplæring",
      is_general: true,
      sections: []
    });
    
    // Add campaign groups
    for (const c of campaigns) {
      campaignMap.set(c.id, {
        id: c.id,
        name: c.name,
        is_general: false,
        sections: []
      });
    }
    
    // Distribute sections to their campaigns
    for (const section of sections) {
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
    
    // Sort sections by order within each campaign
    for (const group of campaignMap.values()) {
      group.sections.sort((a, b) => a.order - b.order);
    }
    
    // Convert to GroupedSectionsResponse format
    const filteredCampaigns = Array.from(campaignMap.values())
      .filter(g => g.sections.length > 0 || g.id === null) // Keep general even if empty
      .sort((a, b) => {
        if (a.id === null) return -1;
        if (b.id === null) return 1;
        return a.name.localeCompare(b.name);
      });
    
    return {
      campaigns: filteredCampaigns,
      total_campaigns: filteredCampaigns.length
    };
  }

  async getAdminSection(id: number): Promise<LearningSection> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/sections/${id}/`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch section');
    return response.json();
  }

  async createSection(sectionData: LearningSectionCreate): Promise<LearningSection> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/sections/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(sectionData),
    });
    
    if (!response.ok) {
      const text = await response.text();
      let err: Record<string, unknown> = {};
      try {
        err = text ? JSON.parse(text) : {};
      } catch {
        throw new Error((text && text.length > 200 ? text.slice(0, 200) + "…" : text) || `Kunne ikke opprette seksjon (${response.status})`);
      }
      // detail: streng eller [str]
      const d = err.detail;
      if (typeof d === "string" && d) throw new Error(d);
      if (Array.isArray(d) && d.length) throw new Error(String(d[0]));
      // error
      if (typeof err.error === "string" && err.error) throw new Error(err.error);
      // feltfeil fra DRF: { order: ["..."], slug: ["..."] } eller { order: "..." }
      const parts: string[] = [];
      for (const k of Object.keys(err)) {
        if (k === "detail" || k === "error") continue;
        const v = err[k];
        if (Array.isArray(v) && v.length) parts.push(`${k}: ${String(v[0])}`);
        else if (typeof v === "string" && v) parts.push(`${k}: ${v}`);
      }
      if (parts.length) throw new Error(parts.join(". "));
      // ukjent strukturer – vis rå respons for feilsøking
      if (Object.keys(err).length) throw new Error(`Kunne ikke opprette seksjon (${response.status}). ${JSON.stringify(err)}`);
      throw new Error(`Kunne ikke opprette seksjon (${response.status})`);
    }
    return response.json();
  }

  async updateSection(id: number, sectionData: LearningSectionUpdate): Promise<LearningSection> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/sections/${id}/`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(sectionData),
    });
    
    if (!response.ok) throw new Error('Failed to update section');
    return response.json();
  }

  async deleteSection(id: number): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/sections/${id}/`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to delete section');
  }

  // UPDATED: New format - accepts array of {id, order} objects instead of just IDs
  async reorderSections(sectionOrders: { id: number; order: number }[]): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/sections/reorder/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ section_orders: sectionOrders }),  // Changed from section_ids
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to reorder sections' }));
      throw new Error(error.error || 'Failed to reorder sections');
    }
  }

  async bulkOperations(operation: string, contentIds: number[], contentType: 'sections' | 'lessons' = 'sections'): Promise<void> {
    const endpoint = contentType === 'sections' 
      ? '/api/learning/admin/sections/bulk_operations/'
      : '/api/learning/admin/lessons/bulk_operations/';
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ 
        operation, 
        content_ids: contentIds 
      }),
    });
    
    if (!response.ok) throw new Error('Failed to perform bulk operation');
  }

  // UPDATED: Returns message and new_section_id instead of full section object
  async duplicateSection(sectionId: number): Promise<{ message: string; new_section_id: number }> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/sections/${sectionId}/duplicate/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to duplicate section');
    return response.json();  // Returns { message, new_section_id }
  }

  // Admin Lesson APIs
  async getAdminLessons(): Promise<LearningLesson[]> {
    return this.fetchAllPages<LearningLesson>(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/`
    );
  }

  async getAdminLesson(id: number): Promise<LearningLesson> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/${id}/`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch lesson');
    return response.json();
  }

  async createLesson(lessonData: LearningLessonCreate): Promise<LearningLesson> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(lessonData),
    });
    if (!response.ok) {
      const text = await response.text();
      let err: Record<string, unknown> = {};
      try {
        err = text ? JSON.parse(text) : {};
      } catch {
        throw new Error((text && text.length > 200 ? text.slice(0, 200) + "…" : text) || `Kunne ikke opprette leksjon (${response.status})`);
      }
      const d = err.detail;
      if (typeof d === "string" && d) throw new Error(d);
      if (Array.isArray(d) && d.length) throw new Error(String(d[0]));
      if (typeof err.error === "string" && err.error) throw new Error(err.error);
      const parts: string[] = [];
      for (const k of Object.keys(err)) {
        if (k === "detail" || k === "error") continue;
        const v = err[k];
        if (Array.isArray(v) && v.length) parts.push(`${k}: ${String(v[0])}`);
        else if (typeof v === "string" && v) parts.push(`${k}: ${v}`);
      }
      if (parts.length) throw new Error(parts.join(". "));
      if (Object.keys(err).length) throw new Error(`Kunne ikke opprette leksjon (${response.status}). ${JSON.stringify(err)}`);
      throw new Error(`Kunne ikke opprette leksjon (${response.status})`);
    }
    return response.json();
  }

  async updateLesson(id: number, lessonData: LearningLessonUpdate): Promise<LearningLesson> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/${id}/`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(lessonData),
    });
    
    if (!response.ok) throw new Error('Failed to update lesson');
    return response.json();
  }

  // Get deletion preview to see what will be affected before deleting
  async getLessonDeletionPreview(id: number): Promise<LessonDeletionPreview> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/${id}/deletion_preview/`,
      { headers: this.getAuthHeaders() }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get deletion preview' }));
      throw new Error(error.error || error.detail || 'Failed to get deletion preview');
    }
    return response.json();
  }

  // Delete a lesson with optional force flag and media cleanup
  // Returns warning response if lesson has usage and force is false
  // Returns success response if deleted
  async deleteLesson(
    id: number, 
    options?: { force?: boolean; cleanupMedia?: boolean }
  ): Promise<LessonDeletionResponse> {
    const params = new URLSearchParams();
    if (options?.force) {
      params.append('force', 'true');
    }
    if (options?.cleanupMedia) {
      params.append('cleanup_media', 'true');
    }
    
    const queryString = params.toString();
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/${id}/${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete lesson' }));
      throw new Error(error.error || error.detail || 'Failed to delete lesson');
    }
    
    return response.json();
  }

  // Helper to check if deletion response is a warning
  isLessonDeletionWarning(response: LessonDeletionResponse): response is LessonDeletionWarningResponse {
    return 'warning' in response && response.warning === true;
  }

  // Helper to check if deletion response is a success
  isLessonDeletionSuccess(response: LessonDeletionResponse): response is LessonDeletionSuccessResponse {
    return 'success' in response && response.success === true;
  }

  async reorderLessons(lessonIds: number[]): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/reorder/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ lesson_ids: lessonIds }),
    });
    
    if (!response.ok) throw new Error('Failed to reorder lessons');
  }

  async duplicateLesson(lessonId: number): Promise<{ message: string; new_lesson_id: number }> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/${lessonId}/duplicate/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to duplicate lesson');
    return response.json();
  }

  // NEW: Create quiz with questions in one API call (bulk endpoint)
  async createQuizWithQuestions(quizData: {
    lesson: LearningLessonCreate;
    questions: Array<{
      question_text: string;
      order: number;
      answers: Array<{
        answer_text: string;
        is_correct: boolean;
        order: number;
      }>;
    }>;
  }): Promise<{ success: boolean; message: string; lesson: any }> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/create_with_quiz/`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(quizData),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create quiz');
    }
    return response.json();
  }

  // NEW: Update quiz with questions (bulk endpoint)
  // API now automatically resets user progress if quiz was taken, instead of returning an error
  async updateQuizWithQuestions(lessonId: number, quizData: {
    title?: string;
    description?: string;
    pass_threshold_percent?: number;
    is_active?: boolean;
    questions: Array<{
      question_text: string;
      order: number;
      answers: Array<{
        answer_text: string;
        is_correct: boolean;
        order: number;
      }>;
    }>;
  }): Promise<{ success: boolean; message: string; users_progress_reset: number; lesson?: any }> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/lessons/${lessonId}/update_with_quiz/`,
      {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(quizData),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update quiz');
    }
    return response.json();
  }

  // Quiz Management APIs
  async getQuizQuestions(): Promise<any[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/quiz-questions/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch quiz questions');
    const data = await response.json();
    return data.results || data;
  }

  async createQuizQuestion(questionData: any): Promise<any> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/quiz-questions/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(questionData),
    });
    
    if (!response.ok) throw new Error('Failed to create quiz question');
    return response.json();
  }

  async updateQuizQuestion(id: number, questionData: any): Promise<any> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/quiz-questions/${id}/`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(questionData),
    });
    
    if (!response.ok) throw new Error('Failed to update quiz question');
    return response.json();
  }

  async deleteQuizQuestion(id: number): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/quiz-questions/${id}/`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to delete quiz question');
  }

  // Analytics & Reporting APIs
  async getOverviewStats(options?: {
    include_content_status?: boolean;
    include_recent_activity?: boolean;
    activity_limit?: number;
  }): Promise<LearningStats> {
    const params = new URLSearchParams();
    
    if (options?.include_content_status !== undefined) {
      params.append('include_content_status', String(options.include_content_status));
    }
    if (options?.include_recent_activity !== undefined) {
      params.append('include_recent_activity', String(options.include_recent_activity));
    }
    if (options?.activity_limit !== undefined) {
      params.append('activity_limit', String(options.activity_limit));
    }
    
    const queryString = params.toString();
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/stats/overview/`;
    const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch overview stats' }));
      throw new Error(error.error || 'Failed to fetch overview stats');
    }
    return response.json();
  }

  async getStaffStats(): Promise<StaffStats[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/stats/staff/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch staff stats');
    const data = await response.json();
    return data.results || data;
  }

  async getSectionCompletionStats(): Promise<SectionCompletionStats[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/stats/section-completion/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch section completion stats');
    const data = await response.json();
    return data.results || data;
  }

  async getActivityStats(): Promise<ActivityStats[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/stats/activity-7d/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch activity stats');
    const data = await response.json();
    return data.results || data;
  }

  async getUserProgress(): Promise<AllUsersProgressResponse> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/user-progress/all_users_progress/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch user progress');
    return response.json();
  }

  // NEW: Get individual user progress
  async getIndividualUserProgress(userId: string): Promise<IndividualUserProgressResponse> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/user-progress/user_progress/?user_id=${userId}`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch individual user progress');
    return response.json();
  }

  async resetUserProgress(userId: string, contentType: 'lesson' | 'section', contentId: number): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/user-progress/reset_progress/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ 
        user_id: userId,
        content_type: contentType,
        content_id: contentId
      }),
    });
    
    if (!response.ok) throw new Error('Failed to reset user progress');
  }

  async overrideCompletion(userId: string, lessonId: number, timeSpentSeconds?: number): Promise<void> {
    const payload: any = { 
      user_id: userId, 
      lesson_id: lessonId 
    };
    
    if (timeSpentSeconds !== undefined) {
      payload.time_spent_seconds = timeSpentSeconds;
    }
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/user-progress/override_completion/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) throw new Error('Failed to override completion');
  }

  async overrideQuizScore(userId: string, lessonId: number, score: number): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/admin/user-progress/override_quiz_score/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ 
        user_id: userId, 
        lesson_id: lessonId,
        score_percent: score 
      }),
    });
    
    if (!response.ok) throw new Error('Failed to override quiz score');
  }
}
