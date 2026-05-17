import type { 
  LearningSection, 
  LearningLesson, 
  LearningProgress, 
  QuizSubmission,
  PaginatedResponse,
  GroupedSectionsResponse
} from './learningTypes';

// Extended types for the new APIs
export interface UserOverview {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  learning_statistics: {
    total_sections: number;
    completed_sections: number;
    total_lessons: number;
    completed_lessons: number;
    total_quizzes: number;
    passed_quizzes: number;
    avg_quiz_score: number;
  };
  recommended_lessons: LearningLesson[];
}

export interface DetailedProgress {
  section_progress: {
    total_sections: number;
    completed_sections: number;
    in_progress_sections: number;
    avg_progress: number;
  };
  lesson_progress: {
    total_lessons: number;
    completed_lessons: number;
    in_progress_lessons: number;
    total_time_spent: number; // seconds
  };
  quiz_stats: {
    total_attempts: number;
    passed_attempts: number;
    avg_score: number;
  };
  learning_streak_days: number;
  last_activity: {
    timestamp: string;
    type: string;
    title: string;
  } | null;
}

export interface CurrentPath {
  current_section: {
    id: number;
    title: string;
  } | null;
  current_lesson: {
    id: number;
    title: string;
  } | null;
  learning_streak_days: number;
  total_learning_time_minutes: number;
  last_learning_date: string | null;
}

export interface CampaignCompletionCheck {
  all_completed: boolean;
  campaign_id: string;
  campaign_name: string;
  total_sections: number;
  completed_sections: number;
  incomplete_sections: {
    section_id: string;
    section_title: string;
    progress_percent: number;
    status: string;
  }[];
  is_assigned_to_campaign: boolean;
}

export interface QuizSubmitResponse {
  success: boolean;
  passed: boolean;
  score: number;
  message: string;
  pass_threshold: number;
}

// Main learning platform API service for employees
export class LearningService {
  private static instance: LearningService;
  
  static getInstance(): LearningService {
    if (!LearningService.instance) {
      LearningService.instance = new LearningService();
    }
    return LearningService.instance;
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

  // ============================================
  // 1. User Information and Overview
  // ============================================
  
  /**
   * GET /api/learning/me/
   * Returns user info, learning statistics, and recommended lessons
   */
  async getUserOverview(): Promise<UserOverview> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/me/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch user overview');
    return response.json();
  }

  // Alias for backwards compatibility
  async getUserProfile(): Promise<UserOverview> {
    return this.getUserOverview();
  }

  // ============================================
  // 2. Progress Summary (by campaign)
  // ============================================
  
  /**
   * GET /api/learning/me/progress/
   * Returns overall progress percentage, progress per campaign
   */
  async getUserProgress(): Promise<LearningProgress> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/me/progress/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch progress');
    return response.json();
  }

  // ============================================
  // 3. Detailed Progress Statistics
  // ============================================
  
  /**
   * GET /api/learning/me/progress/detailed/
   * Returns section progress, lesson progress, quiz statistics, streak
   */
  async getDetailedProgress(): Promise<DetailedProgress> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/me/progress/detailed/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch detailed progress');
    return response.json();
  }

  // ============================================
  // 4. Current Learning Path
  // ============================================
  
  /**
   * GET /api/learning/me/progress/current-path/
   * Returns current section, current lesson, streak, total time
   */
  async getCurrentPath(): Promise<CurrentPath> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/me/progress/current-path/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch current path');
    return response.json();
  }

  // ============================================
  // 5. View Sections
  // ============================================
  
  /**
   * GET /api/learning/sections/
   * Query params: campaign, is_active, search, ordering
   */
  async getSections(params?: {
    campaign?: string | null;
    is_active?: boolean;
    search?: string;
    ordering?: string;
  }): Promise<LearningSection[]> {
    let url = `${process.env.NEXT_PUBLIC_API_URL}/api/learning/sections/`;
    
    const queryParams = new URLSearchParams();
    if (params?.campaign !== undefined) {
      queryParams.append('campaign', params.campaign === null ? 'null' : params.campaign);
    }
    if (params?.is_active !== undefined) {
      queryParams.append('is_active', params.is_active.toString());
    }
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    if (params?.ordering) {
      queryParams.append('ordering', params.ordering);
    }
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch sections');
    const data = await response.json();
    return data.results || data;
  }

  // ============================================
  // 6. View Sections Grouped by Campaign
  // ============================================
  
  /**
   * GET /api/learning/sections/grouped_by_campaign/
   * Returns sections grouped by campaign for easier display
   */
  async getGroupedSections(): Promise<GroupedSectionsResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning/sections/grouped_by_campaign/`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch grouped sections');
    return response.json();
  }

  // ============================================
  // 7. View Public/Active Sections
  // ============================================
  
  /**
   * GET /api/learning/sections/public/
   * Returns only active sections visible to the user
   */
  async getPublicSections(): Promise<LearningSection[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/sections/public/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch public sections');
    const data = await response.json();
    return data.results || data;
  }

  // ============================================
  // 8. Get Section Details
  // ============================================
  
  /**
   * GET /api/learning/sections/{id}/
   * Returns full section details including all lessons
   */
  async getSection(id: number): Promise<LearningSection> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/sections/${id}/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch section');
    return response.json();
  }

  // ============================================
  // 9. Check Section Prerequisites
  // ============================================
  
  /**
   * GET /api/learning/sections/{id}/prerequisites/
   * Returns whether section is accessible and reason if locked
   */
  async checkSectionPrerequisites(sectionId: number): Promise<{
    accessible: boolean;
    reason?: string;
    required_section?: { id: number; title: string };
  }> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/sections/${sectionId}/prerequisites/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to check prerequisites');
    return response.json();
  }

  // ============================================
  // 10. View Lessons
  // ============================================
  
  /**
   * GET /api/learning/lessons/
   * Query params: section, kind, search
   */
  async getLessons(params?: {
    section?: number;
    kind?: 'TEXT' | 'VIDEO' | 'QUIZ';
    search?: string;
  }): Promise<LearningLesson[]> {
    let url = `${process.env.NEXT_PUBLIC_API_URL}/api/learning/lessons/`;
    
    const queryParams = new URLSearchParams();
    if (params?.section) {
      queryParams.append('section', params.section.toString());
    }
    if (params?.kind) {
      queryParams.append('kind', params.kind);
    }
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch lessons');
    const data = await response.json();
    return data.results || data;
  }

  // ============================================
  // 11. Get Lesson Details
  // ============================================
  
  /**
   * GET /api/learning/lessons/{id}/
   * Returns full lesson details including quiz questions if quiz
   */
  async getLesson(id: number): Promise<LearningLesson> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/lessons/${id}/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to fetch lesson');
    return response.json();
  }

  // ============================================
  // 12. Start a Lesson
  // ============================================
  
  /**
   * POST /api/learning/lessons/{id}/start/
   * Marks lesson as started, tracks progress
   */
  async startLesson(lessonId: number): Promise<{ success: boolean; status: string }> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/lessons/${lessonId}/start/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to start lesson');
    return response.json();
  }

  // ============================================
  // 13. Complete a Lesson
  // ============================================
  
  /**
   * POST /api/learning/lessons/{id}/complete/
   * Body: { seconds?: number } - optional time spent
   */
  async completeLesson(lessonId: number, seconds?: number): Promise<{ success: boolean; status: string }> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/lessons/${lessonId}/complete/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: seconds ? JSON.stringify({ seconds }) : undefined,
    });
    
    if (!response.ok) throw new Error('Failed to complete lesson');
    return response.json();
  }

  // ============================================
  // 14. Submit Quiz
  // ============================================
  
  /**
   * POST /api/learning/lessons/{lesson_id}/quiz-submit/
   * Body: { score_percent: number, duration_seconds: number }
   */
  async submitQuiz(lessonId: number, score: number, duration: number): Promise<QuizSubmitResponse> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/lessons/${lessonId}/quiz-submit/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        score_percent: score,
        duration_seconds: duration,
      } as QuizSubmission),
    });
    
    if (!response.ok) throw new Error('Failed to submit quiz');
    return response.json();
  }

  // ============================================
  // 15. Check Campaign Completion
  // ============================================
  
  /**
   * GET /api/learning/campaign-completion-check/
   * Query params: user_id (optional), campaign_id (required)
   */
  async checkCampaignCompletion(campaignId: string, userId?: string): Promise<CampaignCompletionCheck> {
    let url = `${process.env.NEXT_PUBLIC_API_URL}/api/learning/campaign-completion-check/?campaign_id=${campaignId}`;
    if (userId) {
      url += `&user_id=${userId}`;
    }
    
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to check campaign completion');
    return response.json();
  }

  // ============================================
  // Utility Methods
  // ============================================
  
  async pauseLesson(lessonId: number): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/lessons/${lessonId}/pause/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to pause lesson');
  }

  async resumeLesson(lessonId: number): Promise<void> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/learning/lessons/${lessonId}/resume/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to resume lesson');
  }
}
