"""
Serializers for the learning platform integrated with AB Maps.
"""
from __future__ import annotations
from typing import Any
from django.db.models import Count, Q
from rest_framework import serializers
from .models import Section, Lesson, UserLessonProgress, UserSectionProgress, QuizQuestion, QuizAnswer, QuizAttempt, ActivityLog, LearningMedia
from .services import check_section_prerequisites


# =============================================================================
# HTML Sanitization Utility for Rich Text Content
# =============================================================================

def sanitize_html(html_content: str) -> str:
    """
    Sanitize HTML content to prevent XSS attacks while preserving
    allowed formatting tags for rich text editing.
    
    Allowed tags: p, br, strong, b, em, i, u, s, h1-h6, ul, ol, li, a, img, video, source, blockquote, pre, code, span, div
    Allowed attributes: href (on a), src/alt/width/height (on img/video), controls/poster (on video), class, style
    """
    if not html_content:
        return ""
    
    try:
        import bleach
        from bleach.css_sanitizer import CSSSanitizer
        
        # Define allowed tags for rich text content (now includes video!)
        ALLOWED_TAGS = [
            # Text formatting
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
            # Headers
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            # Lists
            'ul', 'ol', 'li',
            # Links, images, and VIDEO
            'a', 'img', 'video', 'source',
            # Block elements
            'blockquote', 'pre', 'code', 'hr',
            # Container elements
            'span', 'div',
            # Tables (optional but useful)
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            # iframes for embedded content (YouTube, etc.) - optional
            'iframe',
        ]
        
        # Define allowed attributes per tag (now includes video attributes!)
        ALLOWED_ATTRIBUTES = {
            '*': ['class', 'id'],
            'a': ['href', 'title', 'target', 'rel'],
            'img': ['src', 'alt', 'title', 'width', 'height', 'loading'],
            'video': ['src', 'controls', 'autoplay', 'muted', 'loop', 'poster', 'width', 'height', 'preload'],
            'source': ['src', 'type'],
            'iframe': ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen'],
            'th': ['colspan', 'rowspan'],
            'td': ['colspan', 'rowspan'],
        }
        
        # Define allowed CSS properties for inline styles
        ALLOWED_CSS_PROPERTIES = [
            'color', 'background-color', 'font-size', 'font-weight', 'font-style',
            'text-align', 'text-decoration', 'margin', 'padding', 'border',
            'width', 'height', 'max-width', 'max-height',
        ]
        
        css_sanitizer = CSSSanitizer(allowed_css_properties=ALLOWED_CSS_PROPERTIES)
        
        # Sanitize the HTML
        cleaned = bleach.clean(
            html_content,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            css_sanitizer=css_sanitizer,
            strip=True
        )
        
        return cleaned
    
    except ImportError:
        # If bleach is not installed, return the content as-is
        # This should not happen in production
        return html_content


class RichTextContentSerializer(serializers.Serializer):
    """
    Serializer for rich text content that sanitizes HTML input.
    Used as a field in other serializers.
    """
    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Rich text content must be a string")
        return sanitize_html(data)
    
    def to_representation(self, value):
        return value


# =============================================================================
# Learning Media Serializers (with 0CodeKit Integration)
# =============================================================================

class LearningMediaSerializer(serializers.ModelSerializer):
    """
    Serializer for learning media uploads.
    
    Supports both local storage and 0CodeKit external storage.
    """
    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    is_video = serializers.SerializerMethodField()
    is_image = serializers.SerializerMethodField()
    
    class Meta:
        model = LearningMedia
        fields = [
            'id', 'url', 'media_type', 'storage_type', 'original_filename', 
            'file_size', 'mime_type', 'width', 'height', 'duration_seconds',
            'alt_text', 'content_type', 'content_id',
            'external_file_id', 'uploaded_by', 'uploaded_by_name', 
            'created_at', 'is_video', 'is_image'
        ]
        read_only_fields = [
            'id', 'url', 'file_size', 'mime_type', 'width', 'height', 
            'duration_seconds', 'uploaded_by', 'created_at', 'external_file_id',
            'storage_type', 'is_video', 'is_image'
        ]
    
    def get_url(self, obj):
        """Return the URL (external from 0CodeKit or local)."""
        return obj.url
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None
    
    def get_is_video(self, obj):
        return obj.is_video
    
    def get_is_image(self, obj):
        return obj.is_image


class LearningMediaUploadSerializer(serializers.Serializer):
    """
    Serializer for uploading media files to 0CodeKit external storage.
    
    Accepts images and videos, uploads them to 0CodeKit permanent storage,
    and stores the URL pointer in the database.
    """
    file = serializers.FileField(
        help_text="The file to upload (image, video, or document)"
    )
    alt_text = serializers.CharField(
        max_length=500, 
        required=False, 
        allow_blank=True,
        help_text="Alt text for accessibility"
    )
    content_type_ref = serializers.CharField(
        max_length=50, 
        required=False, 
        allow_blank=True,
        help_text="Content type reference (e.g., 'section', 'lesson')"
    )
    content_id = serializers.IntegerField(
        required=False, 
        allow_null=True,
        help_text="Content ID reference"
    )
    
    # Allowed file types - now includes video!
    ALLOWED_IMAGE_TYPES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
    ]
    ALLOWED_VIDEO_TYPES = [
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',  # .mov
        'video/x-msvideo',  # .avi
        'video/x-matroska',  # .mkv
    ]
    ALLOWED_DOCUMENT_TYPES = ['application/pdf']
    
    def validate_file(self, value):
        """Validate the uploaded file (images, videos, documents)."""
        from django.conf import settings
        
        content_type = value.content_type
        
        # Determine max size based on file type
        if content_type in self.ALLOWED_VIDEO_TYPES:
            max_size = getattr(settings, 'ZEROCODEKIT_MAX_VIDEO_SIZE', 100 * 1024 * 1024)
            file_category = "video"
        elif content_type in self.ALLOWED_IMAGE_TYPES:
            max_size = getattr(settings, 'ZEROCODEKIT_MAX_IMAGE_SIZE', 10 * 1024 * 1024)
            file_category = "image"
        elif content_type in self.ALLOWED_DOCUMENT_TYPES:
            max_size = getattr(settings, 'ZEROCODEKIT_MAX_IMAGE_SIZE', 10 * 1024 * 1024)
            file_category = "document"
        else:
            allowed_types = self.ALLOWED_IMAGE_TYPES + self.ALLOWED_VIDEO_TYPES + self.ALLOWED_DOCUMENT_TYPES
            raise serializers.ValidationError(
                f"File type '{content_type}' is not allowed. "
                f"Allowed: images (jpeg, png, gif, webp, svg), "
                f"videos (mp4, webm, ogg, mov, avi, mkv), and PDF documents."
            )
        
        # Check file size
        if value.size > max_size:
            raise serializers.ValidationError(
                f"File size ({value.size / 1024 / 1024:.2f}MB) exceeds maximum allowed "
                f"for {file_category} ({max_size / 1024 / 1024}MB)"
            )
        
        return value
    
    def create(self, validated_data):
        """
        Create a LearningMedia instance by uploading to 0CodeKit.
        
        1. Read the file data
        2. Upload to 0CodeKit permanent storage
        3. Store the URL and file_id in the database
        """
        from .zerocodekit_service import upload_media_to_zerocodekit, ZeroCodeKitError
        
        file = validated_data['file']
        content_type = file.content_type
        
        # Determine media type
        if content_type in self.ALLOWED_IMAGE_TYPES:
            media_type = LearningMedia.MediaType.IMAGE
        elif content_type in self.ALLOWED_VIDEO_TYPES:
            media_type = LearningMedia.MediaType.VIDEO
        else:
            media_type = LearningMedia.MediaType.DOCUMENT
        
        # Read file data
        file_data = file.read()
        file_size = len(file_data)
        
        # Upload to 0CodeKit
        try:
            external_url, external_file_id = upload_media_to_zerocodekit(
                file_data=file_data,
                filename=file.name,
                permanent=True  # Always use permanent storage for learning content
            )
        except ZeroCodeKitError as e:
            raise serializers.ValidationError(
                f"Failed to upload to external storage: {e.message}"
            )
        
        # Get image dimensions if it's an image
        width = None
        height = None
        if media_type == LearningMedia.MediaType.IMAGE:
            try:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(file_data))
                width, height = img.size
            except Exception:
                pass
        
        # Create the media object
        media = LearningMedia.objects.create(
            uploaded_by=self.context['request'].user,
            storage_type=LearningMedia.StorageType.ZEROCODEKIT,
            external_url=external_url,
            external_file_id=external_file_id,
            media_type=media_type,
            original_filename=file.name,
            file_size=file_size,
            mime_type=content_type,
            width=width,
            height=height,
            alt_text=validated_data.get('alt_text', ''),
            content_type=validated_data.get('content_type_ref', ''),
            content_id=validated_data.get('content_id')
        )
        
        return media


def user_section_locked(user, section: Section) -> bool:
    """Check if a section is locked for a user based on prerequisites within same campaign."""
    active_sections = list(
        Section.objects.filter(
            is_active=True,
            campaign=section.campaign
        ).order_by("order").values_list("id", flat=True)
    )
    if not active_sections:
        return True
    first_id = active_sections[0]
    if section.id == first_id:
        return False
    try:
        idx = active_sections.index(section.id)
        if idx == 0:
            return False
        prev_id = active_sections[idx - 1]
        prev_completed = UserSectionProgress.objects.filter(
            user=user, 
            section_id=prev_id, 
            status=UserSectionProgress.Status.COMPLETED
        ).exists()
        return not prev_completed
    except ValueError:
        return True


class QuizAnswerSerializer(serializers.ModelSerializer):
    """Serializer for quiz answers."""
    class Meta:
        model = QuizAnswer
        fields = ["id", "answer_text", "is_correct", "order"]


class QuizQuestionSerializer(serializers.ModelSerializer):
    """Serializer for quiz questions with answers."""
    answers = QuizAnswerSerializer(many=True, read_only=True)
    
    class Meta:
        model = QuizQuestion
        fields = ["id", "question_text", "order", "answers"]


class LessonCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating lessons with HTML sanitization for rich text fields."""
    class Meta:
        model = Lesson
        fields = [
            "title", "slug", "description", "content", "kind", "content_url", 
            "order", "is_active", "duration_estimate_minutes", 
            "pass_threshold_percent", "section"
        ]
    
    def validate_description(self, value):
        """Sanitize HTML in description field."""
        return sanitize_html(value) if value else value
    
    def validate_content(self, value):
        """Sanitize HTML in content field."""
        return sanitize_html(value) if value else value


class LessonSerializer(serializers.ModelSerializer):
    """Serializer for lessons with user progress."""
    status = serializers.SerializerMethodField()
    locked = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id", "title", "slug", "description", "content", "kind", "content_url", 
            "order", "is_active", "duration_estimate_minutes", "pass_threshold_percent", 
            "status", "locked", "section", "question_count"
        ]

    def get_status(self, obj):
        """Get user's progress status for this lesson."""
        user = self.context["request"].user
        lp = UserLessonProgress.objects.filter(user=user, lesson=obj).first()
        return lp.status if lp else "NOT_STARTED"

    def get_locked(self, obj):
        """Check if lesson is locked for user."""
        user = self.context["request"].user
        return user_section_locked(user, obj.section)

    def get_question_count(self, obj):
        """Get number of quiz questions if this is a quiz lesson."""
        return obj.question_count


class LessonDetailSerializer(LessonSerializer):
    """Detailed lesson serializer with quiz questions."""
    quiz_questions = QuizQuestionSerializer(many=True, read_only=True)
    
    class Meta(LessonSerializer.Meta):
        fields = LessonSerializer.Meta.fields + ["quiz_questions"]


class SectionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating sections with HTML sanitization for rich text fields."""
    class Meta:
        model = Section
        fields = [
            "campaign",
            "title", "slug", "description", "order", "is_active", 
            "duration_estimate_minutes", "icon_emoji", "icon_color"
        ]

    def validate_description(self, value):
        """Sanitize HTML in description field."""
        return sanitize_html(value) if value else value

    def validate(self, attrs):
        """Validate per-campaign uniqueness for order."""
        campaign = attrs.get('campaign')
        order = attrs.get('order')
        if order is not None:
            existing = Section.objects.filter(campaign=campaign, order=order)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                campaign_name = campaign.name if campaign else "General Training"
                raise serializers.ValidationError(
                    {"order": f"Order {order} already exists in {campaign_name}"}
                )
        return attrs


class SectionSerializer(serializers.ModelSerializer):
    """Serializer for sections with user progress."""
    progress_percent = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    locked = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()
    total_duration_minutes = serializers.SerializerMethodField()
    campaign_id = serializers.UUIDField(source='campaign.id', read_only=True, allow_null=True)
    campaign_name = serializers.SerializerMethodField()
    is_general_training = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            "id", "title", "slug", "description", "order", "is_active",
            "duration_estimate_minutes", "icon_emoji", "icon_color", 
            "progress_percent", "status", "locked", "created_at", "updated_at",
            "lesson_count", "total_duration_minutes",
            "campaign", "campaign_id", "campaign_name", "is_general_training"
        ]

    def get_progress_percent(self, obj):
        """Get user's progress percentage for this section."""
        user = self.context["request"].user
        sp = UserSectionProgress.objects.filter(user=user, section=obj).first()
        return sp.progress_percent if sp else 0

    def get_status(self, obj):
        """Get user's progress status for this section."""
        user = self.context["request"].user
        sp = UserSectionProgress.objects.filter(user=user, section=obj).first()
        return sp.status if sp else "NOT_STARTED"

    def get_locked(self, obj):
        """Check if section is locked for user."""
        user = self.context["request"].user
        return user_section_locked(user, obj)

    def get_lesson_count(self, obj):
        """Get number of active lessons in this section."""
        return obj.lesson_count

    def get_total_duration_minutes(self, obj):
        """Get total estimated duration for this section."""
        return obj.total_duration_minutes

    def get_campaign_name(self, obj):
        return obj.campaign.name if obj.campaign else "General Training"

    def get_is_general_training(self, obj):
        return obj.campaign is None


class SectionDetailSerializer(SectionSerializer):
    """Detailed section serializer with lessons."""
    lessons = LessonDetailSerializer(many=True, read_only=True)

    class Meta(SectionSerializer.Meta):
        fields = SectionSerializer.Meta.fields + ["lessons"]


class UserLessonProgressSerializer(serializers.ModelSerializer):
    """Serializer for user lesson progress."""
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    section_title = serializers.CharField(source='lesson.section.title', read_only=True)
    
    class Meta:
        model = UserLessonProgress
        fields = [
            "id", "lesson", "lesson_title", "section_title", "status", 
            "time_spent_seconds", "started_at", "completed_at", "last_activity_at"
        ]
        read_only_fields = ["id", "started_at", "completed_at", "last_activity_at"]


class UserSectionProgressSerializer(serializers.ModelSerializer):
    """Serializer for user section progress."""
    section_title = serializers.CharField(source='section.title', read_only=True)
    section_order = serializers.IntegerField(source='section.order', read_only=True)
    
    class Meta:
        model = UserSectionProgress
        fields = [
            "id", "section", "section_title", "section_order", "status", 
            "progress_percent", "time_spent_seconds", "started_at", 
            "completed_at", "last_activity_at"
        ]
        read_only_fields = ["id", "started_at", "completed_at", "last_activity_at"]


class QuizAttemptSerializer(serializers.ModelSerializer):
    """Serializer for quiz attempts."""
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    
    class Meta:
        model = QuizAttempt
        fields = [
            "id", "lesson", "lesson_title", "score_percent", "passed", 
            "started_at", "submitted_at", "duration_seconds"
        ]
        read_only_fields = ["id", "passed", "started_at", "submitted_at"]


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for activity logs."""
    section_title = serializers.CharField(source='section.title', read_only=True)
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = [
            "id", "section", "section_title", "lesson", "lesson_title", 
            "event", "metadata", "created_at"
        ]
        read_only_fields = ["id", "created_at"]


class UserLearningStatsSerializer(serializers.Serializer):
    """Serializer for user learning statistics."""
    section_progress = serializers.DictField()
    lesson_progress = serializers.DictField()
    quiz_stats = serializers.DictField()
    learning_streak_days = serializers.IntegerField()
    last_activity = ActivityLogSerializer()


class LearningMetricsSerializer(serializers.Serializer):
    """Serializer for system-wide learning metrics."""
    total_users = serializers.IntegerField()
    active_sections = serializers.IntegerField()
    completion_rate_percent = serializers.FloatField()
    average_time_h_m = serializers.CharField()
    active_employees_of_total = serializers.CharField()


class QuizSubmissionSerializer(serializers.Serializer):
    """Serializer for quiz submissions."""
    score_percent = serializers.IntegerField(
        min_value=0, 
        max_value=100,
        help_text="Quiz score as percentage (0-100)"
    )
    duration_seconds = serializers.IntegerField(
        min_value=0,
        help_text="Time spent on quiz in seconds"
    )


class LessonProgressUpdateSerializer(serializers.Serializer):
    """Serializer for updating lesson progress."""
    seconds = serializers.IntegerField(
        min_value=0,
        required=False,
        help_text="Additional time spent in seconds"
    )


class SectionReorderSerializer(serializers.Serializer):
    """Serializer for reordering sections."""
    section_orders = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of section IDs with new orders"
    )


class LessonReorderSerializer(serializers.Serializer):
    """Serializer for reordering lessons within a section."""
    lesson_orders = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of lesson IDs with new orders"
    )


class BulkContentOperationSerializer(serializers.Serializer):
    """Serializer for bulk content operations."""
    operation = serializers.ChoiceField(
        choices=['activate', 'deactivate', 'delete'],
        help_text="Type of bulk operation"
    )
    content_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of content IDs to operate on"
    )
    content_type = serializers.ChoiceField(
        choices=['sections', 'lessons'],
        help_text="Type of content to operate on"
    )


class IncompleteSectionSerializer(serializers.Serializer):
    """Serializer for incomplete section information."""
    section_id = serializers.UUIDField()
    section_title = serializers.CharField()
    section_order = serializers.IntegerField()
    progress_percent = serializers.IntegerField()
    status = serializers.CharField()
    completed_at = serializers.DateTimeField(allow_null=True)


class CampaignCompletionCheckSerializer(serializers.Serializer):
    """Serializer for campaign section completion check response."""
    all_completed = serializers.BooleanField(
        help_text="True if all sections are completed, False otherwise"
    )
    campaign_id = serializers.UUIDField(
        allow_null=True,
        help_text="Campaign UUID (null for General Training)"
    )
    campaign_name = serializers.CharField(
        help_text="Name of the campaign"
    )
    total_sections = serializers.IntegerField(
        help_text="Total number of active sections in campaign"
    )
    completed_sections = serializers.IntegerField(
        help_text="Number of completed sections"
    )
    incomplete_sections = IncompleteSectionSerializer(
        many=True,
        help_text="List of incomplete sections with details"
    )
    is_assigned_to_campaign = serializers.BooleanField(
        required=False,
        help_text="Whether the user is assigned to this campaign"
    )
