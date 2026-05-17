"""
Admin interface for the learning platform integrated with AB Maps.
"""
from django.contrib import admin
from .models import (
    Section, Lesson, QuizQuestion, QuizAnswer, UserLessonProgress,
    UserSectionProgress, QuizAttempt, ActivityLog, LearningPrerequisite,
    UserLearningPath
)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    """Admin interface for learning sections."""
    list_display = ['order', 'title', 'is_active', 'lesson_count', 'total_duration_minutes', 'created_at']
    list_filter = ['is_active', 'created_at', 'updated_at']
    search_fields = ['title', 'description', 'slug']
    ordering = ['order']
    prepopulated_fields = {'slug': ('title',)}
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'slug', 'description', 'order', 'is_active')
        }),
        ('Display Settings', {
            'fields': ('icon_emoji', 'icon_color', 'duration_estimate_minutes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['created_at', 'updated_at']
    
    def lesson_count(self, obj):
        return obj.lesson_count
    lesson_count.short_description = 'Lessons'
    
    def total_duration_minutes(self, obj):
        return obj.total_duration_minutes
    total_duration_minutes.short_description = 'Total Duration (min)'


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    """Admin interface for learning lessons."""
    list_display = ['section', 'order', 'title', 'kind', 'is_active', 'duration_estimate_minutes', 'question_count']
    list_filter = ['section', 'kind', 'is_active']
    search_fields = ['title', 'description', 'slug']
    ordering = ['section__order', 'order']
    prepopulated_fields = {'slug': ('title',)}
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('section', 'title', 'slug', 'description', 'order', 'is_active')
        }),
        ('Content', {
            'fields': ('content', 'kind', 'content_url')
        }),
        ('Settings', {
            'fields': ('duration_estimate_minutes', 'pass_threshold_percent')
        }),
    )
    
    def question_count(self, obj):
        return obj.question_count
    question_count.short_description = 'Questions'


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    """Admin interface for quiz questions."""
    list_display = ['lesson', 'order', 'question_text_short', 'answer_count']
    list_filter = ['lesson__section', 'lesson']
    search_fields = ['question_text']
    ordering = ['lesson__section__order', 'lesson__order', 'order']
    
    def question_text_short(self, obj):
        return obj.question_text[:100] + '...' if len(obj.question_text) > 100 else obj.question_text
    question_text_short.short_description = 'Question'
    
    def answer_count(self, obj):
        return obj.answers.count()
    answer_count.short_description = 'Answers'


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    """Admin interface for quiz answers."""
    list_display = ['question', 'order', 'answer_text_short', 'is_correct']
    list_filter = ['is_correct', 'question__lesson__section', 'question__lesson']
    search_fields = ['answer_text']
    ordering = ['question__lesson__section__order', 'question__lesson__order', 'question__order', 'order']
    
    def answer_text_short(self, obj):
        return obj.answer_text[:100] + '...' if len(obj.answer_text) > 100 else obj.answer_text
    answer_text_short.short_description = 'Answer'


@admin.register(UserLessonProgress)
class UserLessonProgressAdmin(admin.ModelAdmin):
    """Admin interface for user lesson progress."""
    list_display = ['user', 'lesson', 'status', 'time_spent_seconds', 'started_at', 'completed_at']
    list_filter = ['status', 'lesson__section', 'lesson__kind', 'started_at', 'completed_at']
    search_fields = ['user__username', 'user__email', 'lesson__title']
    ordering = ['user__username', 'lesson__section__order', 'lesson__order']
    readonly_fields = ['started_at', 'completed_at', 'last_activity_at']
    
    fieldsets = (
        ('User & Lesson', {
            'fields': ('user', 'lesson')
        }),
        ('Progress', {
            'fields': ('status', 'time_spent_seconds')
        }),
        ('Timestamps', {
            'fields': ('started_at', 'completed_at', 'last_activity_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(UserSectionProgress)
class UserSectionProgressAdmin(admin.ModelAdmin):
    """Admin interface for user section progress."""
    list_display = ['user', 'section', 'status', 'progress_percent', 'time_spent_seconds', 'started_at', 'completed_at']
    list_filter = ['status', 'section', 'started_at', 'completed_at']
    search_fields = ['user__username', 'user__email', 'section__title']
    ordering = ['user__username', 'section__order']
    readonly_fields = ['started_at', 'completed_at', 'last_activity_at']
    
    fieldsets = (
        ('User & Section', {
            'fields': ('user', 'section')
        }),
        ('Progress', {
            'fields': ('status', 'progress_percent', 'time_spent_seconds')
        }),
        ('Timestamps', {
            'fields': ('started_at', 'completed_at', 'last_activity_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    """Admin interface for quiz attempts."""
    list_display = ['user', 'lesson', 'score_percent', 'passed', 'duration_seconds', 'submitted_at']
    list_filter = ['passed', 'lesson__section', 'lesson__kind', 'submitted_at']
    search_fields = ['user__username', 'user__email', 'lesson__title']
    ordering = ['-submitted_at']
    readonly_fields = ['started_at', 'submitted_at']
    
    fieldsets = (
        ('User & Lesson', {
            'fields': ('user', 'lesson')
        }),
        ('Results', {
            'fields': ('score_percent', 'passed', 'duration_seconds')
        }),
        ('Timestamps', {
            'fields': ('started_at', 'submitted_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    """Admin interface for activity logs."""
    list_display = ['user', 'event', 'section', 'lesson', 'created_at']
    list_filter = ['event', 'section', 'lesson__kind', 'created_at']
    search_fields = ['user__username', 'user__email', 'section__title', 'lesson__title']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('User & Content', {
            'fields': ('user', 'section', 'lesson')
        }),
        ('Activity', {
            'fields': ('event', 'metadata')
        }),
        ('Context', {
            'fields': ('ip_address', 'user_agent', 'session_id'),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(LearningPrerequisite)
class LearningPrerequisiteAdmin(admin.ModelAdmin):
    """Admin interface for learning prerequisites."""
    list_display = ['get_target', 'get_prerequisite', 'get_type']
    list_filter = ['prerequisite_section', 'prerequisite_lesson']
    search_fields = ['section__title', 'lesson__title', 'prerequisite_section__title', 'prerequisite_lesson__title']
    
    def get_target(self, obj):
        if obj.section:
            return f"Section: {obj.section.title}"
        else:
            return f"Lesson: {obj.lesson.title}"
    get_target.short_description = 'Target'
    
    def get_prerequisite(self, obj):
        if obj.prerequisite_section:
            return f"Section: {obj.prerequisite_section.title}"
        else:
            return f"Lesson: {obj.prerequisite_lesson.title}"
    get_prerequisite.short_description = 'Prerequisite'
    
    def get_type(self, obj):
        if obj.section:
            return "Section Prerequisite"
        else:
            return "Lesson Prerequisite"
    get_type.short_description = 'Type'


@admin.register(UserLearningPath)
class UserLearningPathAdmin(admin.ModelAdmin):
    """Admin interface for user learning paths."""
    list_display = ['user', 'current_section', 'current_lesson', 'learning_streak_days', 'total_learning_time_minutes', 'last_learning_date']
    list_filter = ['current_section', 'last_learning_date']
    search_fields = ['user__username', 'user__email']
    ordering = ['user__username']
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Current Position', {
            'fields': ('current_section', 'current_lesson')
        }),
        ('Statistics', {
            'fields': ('learning_streak_days', 'total_learning_time_minutes', 'last_learning_date')
        }),
    )


# Custom admin actions
@admin.action(description="Activate selected sections")
def activate_sections(modeladmin, request, queryset):
    queryset.update(is_active=True)
    modeladmin.message_user(request, f"{queryset.count()} sections activated successfully.")

@admin.action(description="Deactivate selected sections")
def deactivate_sections(modeladmin, request, queryset):
    queryset.update(is_active=False)
    modeladmin.message_user(request, f"{queryset.count()} sections deactivated successfully.")

@admin.action(description="Activate selected lessons")
def activate_lessons(modeladmin, request, queryset):
    queryset.update(is_active=True)
    modeladmin.message_user(request, f"{queryset.count()} lessons activated successfully.")

@admin.action(description="Deactivate selected lessons")
def deactivate_lessons(modeladmin, request, queryset):
    queryset.update(is_active=False)
    modeladmin.message_user(request, f"{queryset.count()} lessons deactivated successfully.")

# Add actions to admin classes
SectionAdmin.actions = [activate_sections, deactivate_sections]
LessonAdmin.actions = [activate_lessons, deactivate_lessons]
