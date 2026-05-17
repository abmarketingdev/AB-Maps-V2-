"""
Models for the learning platform integrated with AB Maps.
"""
from __future__ import annotations
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()


class Section(models.Model):
    """Learning section/category model."""
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.PROTECT,
        related_name='learning_sections',
        null=True,
        blank=True,
        help_text="Campaign this section belongs to. NULL = General Training"
    )
    title = models.CharField(max_length=200)
    slug = models.SlugField(blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(db_index=True, blank=True, help_text="Display order (1,2,3..)")
    is_active = models.BooleanField(default=True)
    duration_estimate_minutes = models.PositiveIntegerField(default=0)
    icon_emoji = models.CharField(max_length=10, default="📚", blank=True)
    icon_color = models.CharField(max_length=20, default="bg-green-500", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'learning_section'
        unique_together = [("campaign", "slug"), ("campaign", "order")]
        ordering = ["campaign", "order"]
        verbose_name = "Learning Section"
        verbose_name_plural = "Learning Sections"
        indexes = [
            models.Index(fields=['campaign', 'is_active', 'order']),
            models.Index(fields=['campaign', 'slug']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self) -> str:
        return f"{self.order}. {self.title}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.order < 0:
            raise ValidationError("Order must be positive")
        
        # Ensure unique order within campaign (NULL campaign == General Training)
        if self.is_active:
            existing = Section.objects.filter(
                is_active=True,
                campaign=self.campaign,
                order=self.order
            ).exclude(pk=self.pk)
            if existing.exists():
                campaign_name = self.campaign.name if self.campaign else "General Training"
                raise ValidationError(f"Order must be unique within {campaign_name}")

    @property
    def total_duration_minutes(self):
        """Calculate total duration from all lessons."""
        return self.lessons.filter(is_active=True).aggregate(
            total=models.Sum('duration_estimate_minutes')
        )['total'] or 0
    
    @property
    def lesson_count(self):
        """Count of active lessons."""
        return self.lessons.filter(is_active=True).count()

    @property
    def campaign_name(self):
        """Return campaign name or 'General Training' for NULL campaign."""
        return self.campaign.name if self.campaign else "General Training"

    @property
    def is_general_training(self):
        return self.campaign is None


class Lesson(models.Model):
    """Individual learning unit within a section."""
    class Kind(models.TextChoices):
        VIDEO = "VIDEO", "Video"
        TEXT = "TEXT", "Text"
        QUIZ = "QUIZ", "Quiz"

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    slug = models.SlugField(blank=True)
    description = models.TextField(blank=True)
    content = models.TextField(blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    content_url = models.TextField(blank=True, help_text="URL or reference (can be empty for quiz)")
    order = models.PositiveIntegerField(db_index=True, blank=True)
    is_active = models.BooleanField(default=True)
    duration_estimate_minutes = models.PositiveIntegerField(default=0)
    # For QUIZ:
    pass_threshold_percent = models.PositiveSmallIntegerField(
        default=80,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )

    class Meta:
        db_table = 'learning_lesson'
        unique_together = [("section", "order"), ("section", "slug")]
        ordering = ["section__order", "order"]
        verbose_name = "Learning Lesson"
        verbose_name_plural = "Learning Lessons"
        indexes = [
            models.Index(fields=['section', 'is_active', 'order']),
            models.Index(fields=['kind', 'is_active']),
        ]

    def __str__(self) -> str:
        return f"{self.section.order}.{self.order} {self.title}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.kind == self.Kind.QUIZ and not self.quiz_questions.exists():
            raise ValidationError("Quiz lessons must have questions")
        
        if self.kind == self.Kind.VIDEO and not self.content_url:
            raise ValidationError("Video lessons must have content URL")

    def save(self, *args, **kwargs):
        # Auto-generate slug if not provided
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    @property
    def is_quiz(self):
        return self.kind == self.Kind.QUIZ
    
    @property
    def question_count(self):
        return self.quiz_questions.count() if self.is_quiz else 0


class QuizQuestion(models.Model):
    """Quiz questions for quiz-type lessons."""
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="quiz_questions")
    question_text = models.TextField()
    order = models.PositiveIntegerField(default=1)
    
    class Meta:
        db_table = 'learning_quiz_question'
        ordering = ["order"]
        unique_together = [("lesson", "order")]
        verbose_name = "Quiz Question"
        verbose_name_plural = "Quiz Questions"

    def __str__(self) -> str:
        return f"Question {self.order}: {self.question_text[:50]}..."


class QuizAnswer(models.Model):
    """Answer options for quiz questions."""
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name="answers")
    answer_text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=1)
    
    class Meta:
        db_table = 'learning_quiz_answer'
        ordering = ["order"]
        unique_together = [("question", "order")]
        verbose_name = "Quiz Answer"
        verbose_name_plural = "Quiz Answers"

    def __str__(self) -> str:
        return f"Answer {self.order}: {self.answer_text[:50]}..."


class UserLessonProgress(models.Model):
    """Track user progress through individual lessons."""
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not Started"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progress")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'learning_user_lesson_progress'
        unique_together = [("user", "lesson")]
        verbose_name = "User Lesson Progress"
        verbose_name_plural = "User Lesson Progress"
        indexes = [
            models.Index(fields=["user", "lesson"]),
            models.Index(fields=["lesson", "status"]),
            models.Index(fields=["last_activity_at"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.lesson.title} ({self.status})"


class UserSectionProgress(models.Model):
    """Track user progress through entire sections."""
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not Started"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_section_progress")
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="progress")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    progress_percent = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    time_spent_seconds = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'learning_user_section_progress'
        unique_together = [("user", "section")]
        verbose_name = "User Section Progress"
        verbose_name_plural = "User Section Progress"
        indexes = [
            models.Index(fields=["user", "section"]),
            models.Index(fields=["section", "status"]),
            models.Index(fields=["last_activity_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.section.title} ({self.progress_percent}%)"

    def calculate_progress(self):
        """Recalculate progress based on lesson completion."""
        total_lessons = self.section.lessons.filter(is_active=True).count()
        if total_lessons == 0:
            return 0
        
        completed_lessons = UserLessonProgress.objects.filter(
            user=self.user,
            lesson__section=self.section,
            status=UserLessonProgress.Status.COMPLETED
        ).count()
        
        return int(round(100 * completed_lessons / total_lessons))
    
    def update_progress(self):
        """Update progress and status."""
        self.progress_percent = self.calculate_progress()
        
        if self.progress_percent == 0:
            self.status = self.Status.NOT_STARTED
        elif self.progress_percent == 100:
            self.status = self.Status.COMPLETED
            if not self.completed_at:
                self.completed_at = timezone.now()
        else:
            self.status = self.Status.IN_PROGRESS
            if not self.started_at:
                self.started_at = timezone.now()
        
        self.last_activity_at = timezone.now()
        self.save()


class QuizAttempt(models.Model):
    """Track user quiz attempts and scores."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_quiz_attempts")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="quiz_attempts")
    score_percent = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    passed = models.BooleanField(default=False)
    started_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(default=timezone.now)
    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'learning_quiz_attempt'
        verbose_name = "Quiz Attempt"
        verbose_name_plural = "Quiz Attempts"
        indexes = [
            models.Index(fields=["lesson", "user", "submitted_at"]),
            models.Index(fields=["user", "passed"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.lesson.title} ({self.score_percent}%)"


class ActivityLog(models.Model):
    """Log all learning activities for analytics and compliance."""
    class Event(models.TextChoices):
        LESSON_STARTED = "LESSON_STARTED", "Lesson Started"
        LESSON_COMPLETED = "LESSON_COMPLETED", "Lesson Completed"
        LESSON_PAUSED = "LESSON_PAUSED", "Lesson Paused"
        LESSON_RESUMED = "LESSON_RESUMED", "Lesson Resumed"
        QUIZ_SUBMITTED = "QUIZ_SUBMITTED", "Quiz Submitted"
        QUIZ_FAILED = "QUIZ_FAILED", "Quiz Failed"
        SECTION_STARTED = "SECTION_STARTED", "Section Started"
        SECTION_COMPLETED = "SECTION_COMPLETED", "Section Completed"
        USER_LOGIN = "USER_LOGIN", "User Login"
        USER_LOGOUT = "USER_LOGOUT", "User Logout"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_activity")
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True)
    event = models.CharField(max_length=32, choices=Event.choices)
    metadata = models.JSONField(default=dict, blank=True)  # Store additional context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    session_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'learning_activity_log'
        verbose_name = "Learning Activity Log"
        verbose_name_plural = "Learning Activity Logs"
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["user", "event"]),
            models.Index(fields=["section", "event"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.event} at {self.created_at}"


class LearningPrerequisite(models.Model):
    """Define prerequisites for sections/lessons."""
    section = models.ForeignKey(Section, on_delete=models.CASCADE, null=True, blank=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, null=True, blank=True)
    prerequisite_section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='unlocks_sections')
    prerequisite_lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='unlocks_lessons')
    
    class Meta:
        db_table = 'learning_prerequisite'
        verbose_name = "Learning Prerequisite"
        verbose_name_plural = "Learning Prerequisites"
        # Either section or lesson must be set, not both
        constraints = [
            models.CheckConstraint(
                check=models.Q(section__isnull=False, lesson__isnull=True) |
                      models.Q(section__isnull=True, lesson__isnull=False),
                name='prerequisite_target_constraint'
            )
        ]

    def __str__(self) -> str:
        if self.section:
            return f"Section '{self.section.title}' requires completion of '{self.prerequisite_section.title}'"
        else:
            return f"Lesson '{self.lesson.title}' requires completion of '{self.prerequisite_lesson.title}'"


class UserLearningPath(models.Model):
    """Track user's learning journey and progress."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_path")
    current_section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True)
    current_lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True)
    learning_streak_days = models.PositiveIntegerField(default=0)
    total_learning_time_minutes = models.PositiveIntegerField(default=0)
    last_learning_date = models.DateField(null=True)

    class Meta:
        db_table = 'learning_user_learning_path'
        verbose_name = "User Learning Path"
        verbose_name_plural = "User Learning Paths"

    def __str__(self) -> str:
        return f"{self.user.username} - Learning Path"


class LearningMedia(models.Model):
    """
    Store uploaded media (images/videos) for learning content.
    
    Supports both local storage (file field) and external storage via 0CodeKit.
    When using 0CodeKit, the external_url and external_file_id fields are populated.
    """
    class MediaType(models.TextChoices):
        IMAGE = "IMAGE", "Image"
        VIDEO = "VIDEO", "Video"
        DOCUMENT = "DOCUMENT", "Document"
    
    class StorageType(models.TextChoices):
        LOCAL = "LOCAL", "Local Storage"
        ZEROCODEKIT = "ZEROCODEKIT", "0CodeKit External Storage"
    
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name="learning_media_uploads"
    )
    
    # Storage type indicator
    storage_type = models.CharField(
        max_length=20, 
        choices=StorageType.choices, 
        default=StorageType.ZEROCODEKIT,
        help_text="Where the file is stored"
    )
    
    # External storage fields (0CodeKit)
    external_url = models.URLField(
        max_length=2000, 
        blank=True, 
        null=True,
        help_text="Permanent URL from 0CodeKit storage"
    )
    external_file_id = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text="File ID from 0CodeKit for management"
    )
    
    # Media metadata
    media_type = models.CharField(max_length=20, choices=MediaType.choices, default=MediaType.IMAGE)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True, help_text="Image/video width in pixels")
    height = models.PositiveIntegerField(null=True, blank=True, help_text="Image/video height in pixels")
    duration_seconds = models.PositiveIntegerField(null=True, blank=True, help_text="Video duration in seconds")
    alt_text = models.CharField(max_length=500, blank=True, help_text="Alt text for accessibility")
    
    # Soft reference to content (not FK to allow flexibility)
    content_type = models.CharField(max_length=50, blank=True, help_text="e.g., 'section', 'lesson'")
    content_id = models.PositiveIntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'learning_media'
        verbose_name = "Learning Media"
        verbose_name_plural = "Learning Media"
        indexes = [
            models.Index(fields=['content_type', 'content_id']),
            models.Index(fields=['uploaded_by', 'created_at']),
            models.Index(fields=['media_type']),
            models.Index(fields=['storage_type']),
            models.Index(fields=['external_file_id']),
        ]

    def __str__(self) -> str:
        return f"{self.original_filename} ({self.media_type})"
    
    @property
    def url(self):
        """Return the file URL (external or local)."""
        if self.storage_type == self.StorageType.ZEROCODEKIT and self.external_url:
            return self.external_url
        return None
    
    @property
    def is_video(self):
        """Check if this is a video file."""
        return self.media_type == self.MediaType.VIDEO
    
    @property
    def is_image(self):
        """Check if this is an image file."""
        return self.media_type == self.MediaType.IMAGE
