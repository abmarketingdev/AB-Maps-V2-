// Learning platform TypeScript interfaces
export interface LearningUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
}

export interface LearningLoginRequest {
  username: string;
  password: string;
}

export interface LearningLoginResponse {
  access: string;
  refresh: string;
  user: LearningUser;
}

export interface LearningSection {
  id: number;
  title: string;
  slug: string;
  description: string;
  order: number;
  is_active: boolean;
  duration_estimate_minutes: number;
  icon_emoji?: string;
  icon_color?: string;
  lessons?: LearningLesson[];
  created_at: string;
  updated_at: string;
  
  // Campaign fields (NEW)
  campaign: string | null;           // UUID or null for General Training
  campaign_id: string | null;        // Same as campaign (alias)
  campaign_name: string;              // Display name (e.g., "General Training" or campaign name)
  is_general_training: boolean;       // true if campaign is null
  
  // User-specific fields (from list endpoint)
  progress_percent?: number;          // 0-100
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  locked?: boolean;                   // Based on prerequisites
  lesson_count?: number;              // Number of lessons in section
  total_duration_minutes?: number;    // Total duration of all lessons
}

export interface LearningSectionCreate {
  campaign?: string | null;          // Campaign UUID or null for General Training (NEW)
  title: string;
  slug?: string;                     // Optional - auto-generated if not provided
  description: string;
  order: number;                     // Required - unique per campaign (not globally)
  is_active: boolean;
  duration_estimate_minutes: number;
  icon_emoji?: string;
  icon_color?: string;
}

export interface LearningSectionUpdate extends Partial<LearningSectionCreate> {}

export interface LearningLesson {
  id: number;
  title: string;
  slug: string;
  description: string;
  content: string;
  section: number;
  order: number;
  is_active: boolean;
  duration_estimate_minutes: number;
  kind: string;
  content_url?: string;
  pass_threshold_percent?: number;
  quiz_questions?: QuizQuestion[];
  created_at: string;
  updated_at: string;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  locked?: boolean;
  question_count?: number;
}

export interface LearningLessonCreate {
  title: string;
  slug: string;
  description: string;
  content: string;
  section: number;
  order?: number;
  is_active: boolean;
  duration_estimate_minutes: number;
  kind: string;
  content_url?: string;
  pass_threshold_percent?: number;
}

export interface LearningLessonUpdate extends Partial<LearningLessonCreate> {}

export interface QuizQuestion {
  id: number;
  question_text: string;
  order: number;
  answers: QuizAnswer[];
}

export interface QuizAnswer {
  id: number;
  answer_text: string;
  is_correct: boolean;
  order: number;
}

export interface QuizSubmission {
  score_percent: number;
  duration_seconds?: number;
}

export interface SectionProgress {
  section__id: number;
  section__title: string;
  section__order: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  progress_percent: number;
  last_activity_at: string;
}

export interface LearningProgress {
  overall_progress_percent: number;
  total_campaigns: number;              // NEW - Total number of campaigns
  campaigns: CampaignProgress[];        // NEW - Per-campaign progress
  
  // Legacy fields (keep for backward compatibility)
  sections?: SectionProgress[];
  completed_sections?: number[];
  completed_lessons?: number[];
  quiz_scores?: Record<number, number>;
  current_path?: string;
  overall_progress?: number;
  total_sections?: number;
  total_lessons?: number;
}

export interface UserProgressSummary {
  overall_progress_percent: number;
  sections_completed: number;
  total_sections: number;
  lessons_completed: number;
  total_lessons: number;
  lessons_in_progress: number;
  quiz_attempts: number;
  quiz_passed: number;
  avg_quiz_score: number;
  total_time_spent: string;  // Added: "0h 15m" format
}

export interface UserProgressData {
  user: {
    id: string;  // Changed: UUID string instead of number
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  progress_summary: UserProgressSummary;
  last_activity: string | null;  // Changed: can be null
  status: string;
}

export interface AllUsersProgressResponse {
  total_users: number;
  users_progress: UserProgressData[];
}

// NEW: Individual User Progress Response
export interface IndividualUserProgressResponse {
  user: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  section_progress: SectionProgressDetail[];
  lesson_progress: LessonProgressDetail[];
  quiz_attempts: QuizAttemptDetail[];
}

export interface SectionProgressDetail {
  id: number;
  section: number;
  section_title: string;
  section_order: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  progress_percent: number;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
}

export interface LessonProgressDetail {
  id: number;
  lesson: number;
  lesson_title: string;
  section_title: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
}

export interface QuizAttemptDetail {
  id: number;
  lesson: number;
  lesson_title: string;
  score_percent: number;
  passed: boolean;
  started_at: string;
  submitted_at: string;
  duration_seconds: number;
}

export interface LearningStats {
  total_users: number;
  active_sections: number;
  completion_rate_percent: number;
  average_time_h_m: string;
  active_employees_of_total: string;
  at_risk_employees: number;
  inactive_employees: number;
  never_started_employees: number;
  last_updated: string;
  // NEW: Content Status
  content_status?: {
    drafts_pending: {
      count: number;
      sections: number;
      lessons: number;
    };
    missing_media: {
      count: number;
    };
    low_questions: {
      count: number;
    };
  };
  // NEW: Recent Activity
  recent_activity?: {
    count: number;
    activities: ActivityItem[];
  };
}

export interface ActivityItem {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
  };
  event: string;
  event_display: string;
  section: {
    id: string;
    title: string;
    campaign: {
      id: string;
      name: string;
    } | null;
  } | null;
  lesson: {
    id: string;
    title: string;
    kind: string;
  } | null;
  created_at: string;
  time_ago: string;
  metadata: Record<string, any>;
}

export interface StaffStats {
  ansatt: string;
  avdeling: string;
  progresjon_percent: number;
  status: string;
  sist_aktiv: string | null;
}

export interface SectionCompletionStats {
  section_id: number;
  section: string;
  completion_percent: number;
}

export interface ActivityStats {
  date: string;
  active_users: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// NEW: Campaign-related interfaces for grouped sections endpoint
export interface CampaignGroup {
  id: string | null;                  // Campaign UUID or null for General Training
  name: string;                        // Campaign name or "General Training"
  is_general: boolean;                 // true if id is null
  sections: LearningSection[];         // Sections in this campaign
}

export interface GroupedSectionsResponse {
  campaigns: CampaignGroup[];          // Array of campaigns with their sections
  total_campaigns: number;             // Total number of campaigns
}

// NEW: Per-campaign progress tracking
export interface CampaignProgress {
  campaign_id: string | null;         // Campaign UUID or null for General Training
  campaign_name: string;               // Campaign name or "General Training"
  is_general: boolean;                 // true if campaign_id is null
  total_sections: number;              // Total sections in this campaign
  completed_sections: number;          // Number of completed sections
  in_progress_sections: number;        // Number of in-progress sections
  not_started_sections: number;        // Number of not-started sections
  progress_percent: number;            // 0-100
}

// Lesson Deletion Types
export interface LessonDeletionPreview {
  lesson: {
    id: number;
    title: string;
    kind: string;
    section: {
      id: number;
      title: string;
      total_active_lessons: number;
      will_be_empty: boolean;
    };
  };
  will_be_deleted: {
    progress_records: number;
    quiz_attempts: number;
    quiz_questions: number;
    quiz_answers: number;
  };
  will_be_updated: {
    activity_logs_set_to_null: number;
    learning_paths_set_to_null: number;
  };
  users_affected: {
    with_progress: number;
    with_quiz_attempts: number;
    with_current_lesson: number;
  };
  prerequisites: {
    used_as_prerequisite_by: number;
    has_prerequisites: number;
  };
  media: {
    associated_media_files: number;
  };
  warnings: Array<{ level: string; message: string }>;
}

export interface LessonDeletionWarningResponse {
  warning: true;
  message: string;
  lesson: {
    id: number;
    title: string;
    kind: string;
    section_id: number;
    section_title: string;
    order: number;
  };
  usage_stats: {
    users_with_progress: number;
    quiz_attempts: number;
    activity_logs: number;
    quiz_questions: number;
    used_as_prerequisite: number;
    associated_media: number;
  };
  hint: string;
}

export interface LessonDeletionSuccessResponse {
  success: true;
  message: string;
  deleted_lesson: {
    id: number;
    title: string;
    kind: string;
    section_id: number;
    section_title: string;
    order: number;
  };
  affected_data: {
    progress_records_deleted: number;
    quiz_attempts_deleted: number;
    quiz_questions_deleted: number;
    activity_logs_updated: number;
    prerequisites_cleaned: number;
    media_unlinked: number;
    users_progress_recalculated: number;
    learning_paths_updated: number;
  };
}

export type LessonDeletionResponse = LessonDeletionWarningResponse | LessonDeletionSuccessResponse;
