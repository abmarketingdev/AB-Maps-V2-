"""
Views for the learning platform integrated with AB Maps.
"""
from __future__ import annotations
import logging
import time
import traceback
from functools import wraps
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Avg, F, Q, Sum, Case, When, IntegerField, Max
from rest_framework import viewsets, mixins, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.contrib.auth import get_user_model

# Configure logger for learning API
logger = logging.getLogger('learning.views')


def log_api_call(func):
    """Decorator to log API calls with request/response details."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Extract request from args (handles both view methods and viewset actions)
        request = None
        view = None
        for arg in args:
            if hasattr(arg, 'user') and hasattr(arg, 'method'):
                request = arg
            elif hasattr(arg, 'request'):
                view = arg
                request = arg.request
        
        # Get user info
        user_info = "anonymous"
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user_info = f"user_id={request.user.id}, username={request.user.username}"
        
        # Get endpoint info
        endpoint = request.path if request else "unknown"
        method = request.method if request else "unknown"
        
        start_time = time.time()
        
        try:
            response = func(*args, **kwargs)
            elapsed_ms = (time.time() - start_time) * 1000
            
            logger.info(
                f"[LEARNING_API] {method} {endpoint} | {user_info} | "
                f"status={response.status_code} | time={elapsed_ms:.0f}ms"
            )
            
            # Log warning for non-2xx responses
            if response.status_code >= 400:
                logger.warning(
                    f"[LEARNING_API_ERROR] {method} {endpoint} | {user_info} | "
                    f"status={response.status_code} | response={getattr(response, 'data', 'no data')}"
                )
            
            return response
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(
                f"[LEARNING_API_EXCEPTION] {method} {endpoint} | {user_info} | "
                f"error={type(e).__name__}: {str(e)} | time={elapsed_ms:.0f}ms\n"
                f"Traceback:\n{traceback.format_exc()}"
            )
            raise
    
    return wrapper
from .models import (
    Section, Lesson, UserLessonProgress, UserSectionProgress, 
    QuizAttempt, ActivityLog, QuizQuestion, QuizAnswer, LearningMedia
)
from .serializers import (
    SectionSerializer, SectionDetailSerializer, SectionCreateSerializer,
    LessonSerializer, LessonCreateSerializer, LessonDetailSerializer,
    UserLessonProgressSerializer, UserSectionProgressSerializer,
    QuizAttemptSerializer, ActivityLogSerializer, UserLearningStatsSerializer,
    LearningMetricsSerializer, QuizSubmissionSerializer, LessonProgressUpdateSerializer,
    SectionReorderSerializer, LessonReorderSerializer, BulkContentOperationSerializer,
    QuizQuestionSerializer, QuizAnswerSerializer,
    LearningMediaSerializer, LearningMediaUploadSerializer
)
from .permissions import (
    IsLearningManager, IsLearningAdmin, IsLearningContentManager,
    IsLearningProgressManager, IsLearningAnalyticsViewer, IsLearningUser,
    IsLearningContentOwner, IsLearningQuizManager, IsLearningSectionManager,
    IsLearningLessonManager
)
from .services import (
    recalc_section_progress, log_activity, get_user_learning_stats,
    check_section_prerequisites, get_recommended_lessons, update_user_learning_path,
    calculate_learning_metrics
)

User = get_user_model()


class QuizSubmitView(APIView):
    """View for submitting quiz results."""
    permission_classes = [IsAuthenticated]
    
    @log_api_call
    def post(self, request, lesson_id):
        logger.info(f"[QUIZ_SUBMIT] Starting quiz submit for lesson_id={lesson_id}, user={request.user.id}")
        try:
            lesson = Lesson.objects.get(id=lesson_id, is_active=True)
        except Lesson.DoesNotExist:
            logger.warning(f"[QUIZ_SUBMIT] Lesson {lesson_id} not found")
            return Response(
                {'error': 'Lesson not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if lesson is a quiz
        if lesson.kind != Lesson.Kind.QUIZ:
            return Response(
                {'error': 'This lesson is not a quiz'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = QuizSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        score_percent = serializer.validated_data['score_percent']
        duration_seconds = serializer.validated_data['duration_seconds']
        
        # Check if user passed the quiz
        passed = score_percent >= lesson.pass_threshold_percent
        
        # Create quiz attempt
        quiz_attempt = QuizAttempt.objects.create(
            user=request.user,
            lesson=lesson,
            score_percent=score_percent,
            passed=passed,
            duration_seconds=duration_seconds,
            submitted_at=timezone.now()
        )
        
        # If passed, mark lesson as completed
        if passed:
            progress, created = UserLessonProgress.objects.get_or_create(
                user=request.user,
                lesson=lesson
            )
            progress.status = UserLessonProgress.Status.COMPLETED
            progress.completed_at = timezone.now()
            progress.last_activity_at = timezone.now()
            progress.save()
            
            # Update section progress
            recalc_section_progress(request.user, lesson.section)
            
            # Log activity
            log_activity(
                request.user, 
                section=lesson.section, 
                lesson=lesson, 
                event=ActivityLog.Event.QUIZ_SUBMITTED,
                request=request
            )
        
        return Response({
            'success': True,
            'passed': passed,
            'score': score_percent,
            'message': 'Quiz completed!' if passed else 'Try again!',
            'pass_threshold': lesson.pass_threshold_percent
        })


class UserView(APIView):
    """Get information about the current user's learning progress."""
    permission_classes = [IsAuthenticated]
    
    @log_api_call
    def get(self, request):
        logger.info(f"[USER_VIEW] Getting learning stats for user={request.user.id}")
        # Get user's learning statistics
        stats = get_user_learning_stats(request.user)
        
        # Update learning path
        update_user_learning_path(request.user)
        
        # Get recommended lessons
        recommended = get_recommended_lessons(request.user, limit=5)
        
        # Safely format recommended lessons
        recommended_lessons = []
        for rec in recommended:
            lesson = rec.get('lesson')
            if lesson:
                recommended_lessons.append({
                    'id': lesson.id,
                    'title': lesson.title,
                    'section_title': lesson.section.title if lesson.section else 'Unknown Section',
                    'reason': rec.get('reason', ''),
                    'priority': rec.get('priority', 'medium')
                })
        
        return Response({
            'user_id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'learning_stats': stats,
            'recommended_lessons': recommended_lessons
        })


class MediaUploadView(APIView):
    """
    View for uploading media (images/videos/documents) to 0CodeKit external storage.
    
    POST /api/learning/media/upload/
    
    Request (multipart/form-data):
    - file: The file to upload (required) - images, videos, or PDFs
    - alt_text: Alt text for accessibility (optional)
    - content_type_ref: Reference content type like 'section' or 'lesson' (optional)
    - content_id: Reference content ID (optional)
    
    Supported file types:
    - Images: jpeg, png, gif, webp, svg (max 10MB)
    - Videos: mp4, webm, ogg, mov, avi, mkv (max 100MB)
    - Documents: PDF (max 10MB)
    
    Returns:
    - success: True/False
    - message: Status message
    - media: Media object with:
        - id: Media ID
        - url: Permanent URL from 0CodeKit storage
        - media_type: 'IMAGE', 'VIDEO', or 'DOCUMENT'
        - storage_type: 'ZEROCODEKIT'
        - original_filename: Original file name
        - file_size: Size in bytes
        - width/height: Dimensions (for images/videos)
        - external_file_id: 0CodeKit file ID
        - is_video: Boolean
        - is_image: Boolean
    
    Example response for video upload:
    {
        "success": true,
        "message": "File uploaded successfully to 0CodeKit",
        "media": {
            "id": 1,
            "url": "https://files.0codekit.com/abc123/training_video.mp4",
            "media_type": "VIDEO",
            "storage_type": "ZEROCODEKIT",
            "original_filename": "training_video.mp4",
            "file_size": 52428800,
            "external_file_id": "abc123",
            "is_video": true,
            "is_image": false
        }
    }
    """
    permission_classes = [IsAuthenticated, IsLearningContentManager]
    
    def post(self, request):
        """Upload a media file to 0CodeKit external storage."""
        serializer = LearningMediaUploadSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Create the media object (uploads to 0CodeKit)
            media = serializer.save()
            
            # Return the created media details
            response_serializer = LearningMediaSerializer(media, context={'request': request})
            
            return Response({
                'success': True,
                'message': 'File uploaded successfully to 0CodeKit',
                'media': response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MediaListView(APIView):
    """
    View for listing uploaded media files from 0CodeKit storage.
    
    GET /api/learning/media/
    Query params:
    - media_type: Filter by 'IMAGE', 'VIDEO', or 'DOCUMENT'
    - storage_type: Filter by 'ZEROCODEKIT' or 'LOCAL'
    - content_type: Filter by content type (e.g., 'section', 'lesson')
    - content_id: Filter by content ID
    - page: Page number (default: 1)
    - page_size: Items per page (default: 20, max: 100)
    """
    permission_classes = [IsAuthenticated, IsLearningContentManager]
    
    def get(self, request):
        """List uploaded media files."""
        queryset = LearningMedia.objects.all().order_by('-created_at')
        
        # Filter by media type (IMAGE, VIDEO, DOCUMENT)
        media_type = request.query_params.get('media_type')
        if media_type:
            queryset = queryset.filter(media_type=media_type.upper())
        
        # Filter by storage type
        storage_type = request.query_params.get('storage_type')
        if storage_type:
            queryset = queryset.filter(storage_type=storage_type.upper())
        
        # Filter by content reference
        content_type = request.query_params.get('content_type')
        content_id = request.query_params.get('content_id')
        if content_type:
            queryset = queryset.filter(content_type=content_type)
        if content_id:
            queryset = queryset.filter(content_id=content_id)
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 100)
        
        start = (page - 1) * page_size
        end = start + page_size
        
        total_count = queryset.count()
        media_items = queryset[start:end]
        
        serializer = LearningMediaSerializer(
            media_items, 
            many=True, 
            context={'request': request}
        )
        
        # Get counts by media type
        type_counts = {
            'images': LearningMedia.objects.filter(media_type='IMAGE').count(),
            'videos': LearningMedia.objects.filter(media_type='VIDEO').count(),
            'documents': LearningMedia.objects.filter(media_type='DOCUMENT').count(),
        }
        
        return Response({
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_count + page_size - 1) // page_size,
            'type_counts': type_counts,
            'results': serializer.data
        })


class MediaDeleteView(APIView):
    """
    View for deleting uploaded media files from 0CodeKit storage.
    
    DELETE /api/learning/media/<id>/
    
    Also attempts to delete the file from 0CodeKit permanent storage.
    """
    permission_classes = [IsAuthenticated, IsLearningContentManager]
    
    def delete(self, request, media_id):
        """Delete a media file from 0CodeKit and database."""
        try:
            media = LearningMedia.objects.get(id=media_id)
        except LearningMedia.DoesNotExist:
            return Response(
                {'error': 'Media not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Try to delete from 0CodeKit if it has an external file ID
        zerocodekit_deleted = False
        if media.storage_type == LearningMedia.StorageType.ZEROCODEKIT and media.external_file_id:
            try:
                from .zerocodekit_service import get_zerocodekit_service
                service = get_zerocodekit_service()
                service.delete_from_permanent_storage(media.external_file_id)
                zerocodekit_deleted = True
            except Exception as e:
                # Log the error but continue with database deletion
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to delete file {media.external_file_id} from 0CodeKit: {e}")
        
        # Delete the database record
        media.delete()
        
        return Response({
            'success': True,
            'message': 'Media deleted successfully',
            'zerocodekit_deleted': zerocodekit_deleted
        })


class SectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing learning sections."""
    queryset = Section.objects.all().order_by('campaign', 'order')
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated, IsLearningContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'order', 'campaign']
    search_fields = ['title', 'description']
    ordering_fields = ['order', 'created_at', 'title', 'campaign']
    ordering = ['campaign', 'order']

    def get_queryset(self):
        """Filter sections based on user's campaign assignments."""
        user = self.request.user
        base_queryset = super().get_queryset()
        if user.is_superuser:
            return base_queryset
        if hasattr(user, 'manager') and user.manager:
            from campaigns.models import CampaignEmployee
            # Managers can see sections from campaigns they created OR campaigns they're assigned to
            assigned_campaigns = CampaignEmployee.objects.filter(
                manager=user.manager
            ).values_list('campaign_id', flat=True)
            return base_queryset.filter(
                Q(campaign__created_by=user.manager) | 
                Q(campaign_id__in=assigned_campaigns) | 
                Q(campaign__isnull=True)
            )
        if hasattr(user, 'employee') and user.employee:
            from campaigns.models import CampaignEmployee
            assigned_campaigns = CampaignEmployee.objects.filter(
                employee=user.employee
            ).values_list('campaign_id', flat=True)
            return base_queryset.filter(
                Q(campaign_id__in=assigned_campaigns) | Q(campaign__isnull=True)
            )
        return base_queryset.filter(campaign__isnull=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SectionDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SectionCreateSerializer
        return SectionSerializer

    @action(detail=False, methods=['get'])
    def public(self, request):
        """Get all active sections for regular users (filtered by campaign)."""
        queryset = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def grouped_by_campaign(self, request):
        """Get sections grouped by campaign for better frontend display."""
        queryset = self.get_queryset().filter(is_active=True).select_related('campaign')
        grouped = {}
        for section in queryset:
            key = str(section.campaign_id) if section.campaign_id else 'general'
            if key not in grouped:
                grouped[key] = {
                    'id': section.campaign_id,
                    'name': section.campaign.name if section.campaign else "General Training",
                    'is_general': section.campaign is None,
                    'sections': []
                }
            grouped[key]['sections'].append(
                SectionSerializer(section, context={'request': request}).data
            )
        return Response({'campaigns': list(grouped.values()), 'total_campaigns': len(grouped)})

    @action(detail=True, methods=['get'])
    def prerequisites(self, request, pk=None):
        """Check if user can access this section."""
        section = self.get_object()
        user = request.user
        
        # Check prerequisites
        prereq_check = check_section_prerequisites(user, section)
        
        return Response({
            'section_id': section.id,
            'section_title': section.title,
            'accessible': prereq_check['accessible'],
            'reason': prereq_check['reason'],
            'required_section': prereq_check.get('required_section')
        })

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder sections within a campaign."""
        from django.db import transaction
        serializer = SectionReorderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        section_orders = serializer.validated_data['section_orders']
        if not section_orders:
            return Response({'error': 'section_orders cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)
        first = Section.objects.filter(id=section_orders[0]['id']).first()
        if not first:
            return Response({'error': 'Section not found'}, status=status.HTTP_404_NOT_FOUND)
        target_campaign = first.campaign
        ids = [item['id'] for item in section_orders]
        sections = Section.objects.filter(id__in=ids)
        if sections.count() != len(ids):
            return Response({'error': 'One or more sections not found'}, status=status.HTTP_404_NOT_FOUND)
        for s in sections:
            if s.campaign != target_campaign:
                return Response({'error': 'All sections must belong to the same campaign'}, status=status.HTTP_400_BAD_REQUEST)
        orders = [item['order'] for item in section_orders]
        if len(orders) != len(set(orders)):
            return Response({'error': 'Duplicate order numbers not allowed'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for item in section_orders:
                Section.objects.filter(id=item['id']).update(order=item['order'])
        campaign_name = target_campaign.name if target_campaign else "General Training"
        return Response({'message': f'Sections in {campaign_name} reordered successfully'})

    @action(detail=False, methods=['post'])
    def bulk_operations(self, request):
        """Perform bulk operations on sections."""
        serializer = BulkContentOperationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        operation = serializer.validated_data['operation']
        content_ids = serializer.validated_data['content_ids']
        
        if operation == 'activate':
            Section.objects.filter(id__in=content_ids).update(is_active=True)
            message = f'{len(content_ids)} sections activated'
        elif operation == 'deactivate':
            Section.objects.filter(id__in=content_ids).update(is_active=False)
            message = f'{len(content_ids)} sections deactivated'
        elif operation == 'delete':
            Section.objects.filter(id__in=content_ids).delete()
            message = f'{len(content_ids)} sections deleted'
        
        return Response({'message': message})


class LessonProgressViewSet(viewsets.GenericViewSet):
    """ViewSet for managing lesson progress."""
    queryset = Lesson.objects.filter(is_active=True)
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated, IsLearningUser]

    @action(detail=True, methods=["POST"], url_path="start")
    @log_api_call
    def start(self, request, pk=None):
        """Start a lesson and track progress."""
        logger.info(f"[LESSON_START] Starting lesson pk={pk}, user={request.user.id}")
        user = request.user
        lesson = self.get_object()
        
        # Check if lesson is accessible
        prereq_check = check_section_prerequisites(user, lesson.section)
        if not prereq_check['accessible']:
            logger.warning(f"[LESSON_START] Lesson {pk} not accessible for user {user.id}: {prereq_check['reason']}")
            return Response({
                'error': 'Lesson not accessible',
                'reason': prereq_check['reason']
            }, status=status.HTTP_403_FORBIDDEN)
        
        lp, created = UserLessonProgress.objects.get_or_create(user=user, lesson=lesson)
        if lp.status == UserLessonProgress.Status.NOT_STARTED:
            lp.status = UserLessonProgress.Status.IN_PROGRESS
            lp.started_at = lp.started_at or timezone.now()
        
        lp.last_activity_at = timezone.now()
        lp.save()
        
        recalc_section_progress(user, lesson.section)
        log_activity(
            user, 
            section=lesson.section, 
            lesson=lesson, 
            event=ActivityLog.Event.LESSON_STARTED,
            request=request
        )
        
        return Response({"success": True, "status": lp.status})

    @action(detail=True, methods=["POST"], url_path="complete")
    @log_api_call
    def complete(self, request, pk=None):
        """Complete a lesson."""
        logger.info(f"[LESSON_COMPLETE] Completing lesson pk={pk}, user={request.user.id}")
        user = request.user
        lesson = self.get_object()
        
        serializer = LessonProgressUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"[LESSON_COMPLETE] Invalid data for lesson {pk}: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        lp, _ = UserLessonProgress.objects.get_or_create(user=user, lesson=lesson)
        lp.status = UserLessonProgress.Status.COMPLETED
        lp.completed_at = timezone.now()
        lp.last_activity_at = timezone.now()
        
        # Add time spent if provided
        seconds = serializer.validated_data.get("seconds", 0)
        if seconds > 0:
            lp.time_spent_seconds = F("time_spent_seconds") + seconds
        
        lp.save()
        recalc_section_progress(user, lesson.section)
        
        log_activity(
            user, 
            section=lesson.section, 
            lesson=lesson, 
            event=ActivityLog.Event.LESSON_COMPLETED,
            request=request
        )
        
        return Response({"success": True, "status": lp.status})

    @action(detail=True, methods=["POST"], url_path="pause")
    def pause(self, request, pk=None):
        """Pause a lesson."""
        user = request.user
        lesson = self.get_object()
        
        lp, _ = UserLessonProgress.objects.get_or_create(user=user, lesson=lesson)
        lp.last_activity_at = timezone.now()
        lp.save()
        
        log_activity(
            user, 
            section=lesson.section, 
            lesson=lesson, 
            event=ActivityLog.Event.LESSON_PAUSED,
            request=request
        )
        
        return Response({"success": True})

    @action(detail=True, methods=["POST"], url_path="resume")
    def resume(self, request, pk=None):
        """Resume a paused lesson."""
        user = request.user
        lesson = self.get_object()
        
        lp, _ = UserLessonProgress.objects.get_or_create(user=user, lesson=lesson)
        lp.last_activity_at = timezone.now()
        lp.save()
        
        log_activity(
            user, 
            section=lesson.section, 
            lesson=lesson, 
            event=ActivityLog.Event.LESSON_RESUMED,
            request=request
        )
        
        return Response({"success": True})


class MeProgressViewSet(viewsets.ViewSet):
    """ViewSet for user's own progress."""
    permission_classes = [IsAuthenticated, IsLearningUser]

    @log_api_call
    def list(self, request):
        """Get user's progress grouped by campaign."""
        logger.info(f"[ME_PROGRESS] Getting progress list for user={request.user.id}")
        from .services import get_all_campaigns_progress
        user = request.user
        campaigns_progress = get_all_campaigns_progress(user)
        if campaigns_progress:
            # Only include campaigns with actual content (total_sections > 0)
            campaigns_with_content = [c for c in campaigns_progress if c['total_sections'] > 0]
            
            if campaigns_with_content:
                # Calculate overall progress based on actual content
                total_sections_with_content = sum(c['total_sections'] for c in campaigns_with_content)
                completed_sections_with_content = sum(c['completed_sections'] for c in campaigns_with_content)
                overall = round((completed_sections_with_content / total_sections_with_content) * 100, 1)
            else:
                overall = 0
        else:
            overall = 0
        return Response({
            "overall_progress_percent": overall,
            "campaigns": campaigns_progress,
            "total_campaigns": len(campaigns_progress)
        })

    @action(detail=False, methods=['get'])
    def detailed(self, request):
        """Get detailed progress information."""
        user = request.user
        stats = get_user_learning_stats(user)
        
        return Response(stats)

    @action(detail=False, methods=['get'])
    @log_api_call
    def current_learning_path(self, request):
        """Get user's current learning path."""
        logger.info(f"[CURRENT_PATH] Getting current learning path for user={request.user.id}")
        user = request.user
        learning_path = update_user_learning_path(user)
        
        return Response({
            'current_section': {
                'id': learning_path.current_section.id,
                'title': learning_path.current_section.title
            } if learning_path.current_section else None,
            'current_lesson': {
                'id': learning_path.current_lesson.id,
                'title': learning_path.current_lesson.title
            } if learning_path.current_lesson else None,
            'learning_streak_days': learning_path.learning_streak_days,
            'total_learning_time_minutes': learning_path.total_learning_time_minutes,
            'last_learning_date': learning_path.last_learning_date
        })


# ---------- Admin endpoints ----------

class SectionAdminViewSet(viewsets.ModelViewSet):
    """Admin ViewSet for managing sections."""
    queryset = Section.objects.all().prefetch_related("lessons")
    serializer_class = SectionDetailSerializer
    permission_classes = [IsAuthenticated, IsLearningSectionManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'order']
    search_fields = ['title', 'description']
    ordering_fields = ['order', 'created_at', 'title']
    ordering = ['order']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SectionCreateSerializer
        return SectionDetailSerializer

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a section with all its lessons."""
        from django.db import transaction
        import uuid
        section = self.get_object()
        # Generate unique slug
        unique_suffix = uuid.uuid4().hex[:6]
        new_slug = f"{section.slug}-copy-{unique_suffix}"
        # Determine next order inside same campaign (NULL matches NULL)
        from django.db.models import Max
        max_order = Section.objects.filter(campaign=section.campaign).aggregate(m=Max('order'))['m'] or 0
        # Create new section in same campaign
        with transaction.atomic():
            new_section = Section.objects.create(
                campaign=section.campaign,
                title=f"{section.title} (Copy)",
                slug=new_slug,
                description=section.description,
                order=max_order + 1,
                is_active=False,  # Start as inactive
                duration_estimate_minutes=section.duration_estimate_minutes,
                icon_emoji=section.icon_emoji,
                icon_color=section.icon_color
            )
        
        # Duplicate lessons
        for lesson in section.lessons.all():
            new_lesson = Lesson.objects.create(
                section=new_section,
                title=lesson.title,
                slug=f"{lesson.slug}-copy",
                description=lesson.description,
                content=lesson.content,
                kind=lesson.kind,
                content_url=lesson.content_url,
                order=lesson.order,
                is_active=False,
                duration_estimate_minutes=lesson.duration_estimate_minutes,
                pass_threshold_percent=lesson.pass_threshold_percent
            )
            
            # Duplicate quiz questions and answers if it's a quiz
            if lesson.kind == Lesson.Kind.QUIZ:
                for question in lesson.quiz_questions.all():
                    new_question = QuizQuestion.objects.create(
                        lesson=new_lesson,
                        question_text=question.question_text,
                        order=question.order
                    )
                    
                    for answer in question.answers.all():
                        QuizAnswer.objects.create(
                            question=new_question,
                            answer_text=answer.answer_text,
                            is_correct=answer.is_correct,
                            order=answer.order
                        )
        
        return Response({
            'message': 'Section duplicated successfully',
            'new_section_id': new_section.id
        })


class LessonAdminViewSet(viewsets.ModelViewSet):
    """Admin ViewSet for managing lessons."""
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated, IsLearningLessonManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['section', 'kind', 'is_active']
    search_fields = ['title', 'description']
    ordering_fields = ['order', 'created_at', 'title']
    ordering = ['section__order', 'order']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return LessonCreateSerializer
        elif self.action == 'retrieve':
            return LessonDetailSerializer
        return LessonSerializer
    
    @action(detail=False, methods=['post'])
    def create_with_quiz(self, request):
        """Create a quiz lesson with all questions and answers in one API call."""
        from django.db import transaction
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        # Extract data
        lesson_data = request.data.get('lesson', {})
        questions_data = request.data.get('questions', [])
        
        # Validation 1: Must be QUIZ kind
        if lesson_data.get('kind') != Lesson.Kind.QUIZ:
            return Response(
                {'error': 'This endpoint is for QUIZ lessons only. Use /admin/lessons/ for TEXT/VIDEO lessons.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation 2: Minimum questions
        if len(questions_data) < 3:
            return Response(
                {'error': 'Quiz must have at least 3 questions'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation 3: Validate each question structure
        for idx, q_data in enumerate(questions_data, 1):
            answers_data = q_data.get('answers', [])
            
            # Check minimum answers
            if len(answers_data) < 2:
                return Response(
                    {'error': f'Question {idx} must have at least 2 answers'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check maximum answers
            if len(answers_data) > 6:
                return Response(
                    {'error': f'Question {idx} cannot have more than 6 answers'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check exactly 1 correct answer
            correct_count = sum(1 for a in answers_data if a.get('is_correct'))
            if correct_count == 0:
                return Response(
                    {'error': f'Question {idx} must have exactly 1 correct answer'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if correct_count > 1:
                return Response(
                    {'error': f'Question {idx} can only have 1 correct answer (found {correct_count})'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create everything in transaction
        try:
            with transaction.atomic():
                # Create lesson
                lesson = Lesson.objects.create(
                    section_id=lesson_data['section'],
                    title=lesson_data['title'],
                    kind=lesson_data['kind'],
                    description=lesson_data.get('description', ''),
                    slug=lesson_data.get('slug', ''),
                    order=lesson_data['order'],
                    is_active=lesson_data.get('is_active', False),
                    duration_estimate_minutes=lesson_data.get('duration_estimate_minutes', 0),
                    pass_threshold_percent=lesson_data.get('pass_threshold_percent', 80)
                )
                
                # Create questions and answers
                for q_data in questions_data:
                    answers_data = q_data.pop('answers')
                    
                    # Create question
                    question = QuizQuestion.objects.create(
                        lesson=lesson,
                        question_text=q_data['question_text'],
                        order=q_data['order']
                    )
                    
                    # Create answers
                    for a_data in answers_data:
                        QuizAnswer.objects.create(
                            question=question,
                            answer_text=a_data['answer_text'],
                            is_correct=a_data['is_correct'],
                            order=a_data['order']
                        )
                
                # Return full lesson with nested data
                serializer = LessonDetailSerializer(lesson, context={'request': request})
                
                return Response({
                    'success': True,
                    'message': f'Quiz created successfully with {len(questions_data)} questions',
                    'lesson': serializer.data
                }, status=status.HTTP_201_CREATED)
        
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except KeyError as e:
            return Response(
                {'error': f'Missing required field: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to create quiz: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['put'])
    def update_with_quiz(self, request, pk=None):
        """Update a quiz lesson with all questions and answers in one API call."""
        from django.db import transaction
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        lesson = self.get_object()
        
        # Validation: Must be a quiz
        if lesson.kind != Lesson.Kind.QUIZ:
            return Response(
                {'error': 'This endpoint is for QUIZ lessons only'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        questions_data = request.data.get('questions', [])
        
        # Validate minimum questions
        if len(questions_data) < 3:
            return Response(
                {'error': 'Quiz must have at least 3 questions'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate each question structure
        for idx, q_data in enumerate(questions_data, 1):
            answers_data = q_data.get('answers', [])
            
            if len(answers_data) < 2:
                return Response(
                    {'error': f'Question {idx} must have at least 2 answers'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if len(answers_data) > 6:
                return Response(
                    {'error': f'Question {idx} cannot have more than 6 answers'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            correct_count = sum(1 for a in answers_data if a.get('is_correct'))
            if correct_count != 1:
                return Response(
                    {'error': f'Question {idx} must have exactly 1 correct answer'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Update lesson and recreate questions/answers
        try:
            with transaction.atomic():
                # If users have taken this quiz, reset their progress so they must retake it
                affected_user_ids = list(
                    QuizAttempt.objects.filter(lesson=lesson).values_list('user_id', flat=True).distinct()
                )
                users_reset_count = len(affected_user_ids)
                
                # Delete all quiz attempts for this lesson
                QuizAttempt.objects.filter(lesson=lesson).delete()
                
                # Reset lesson progress for affected users
                UserLessonProgress.objects.filter(lesson=lesson, user_id__in=affected_user_ids).update(
                    status=UserLessonProgress.Status.NOT_STARTED,
                    completed_at=None,
                )
                
                # Update lesson fields
                lesson.title = request.data.get('title', lesson.title)
                lesson.description = request.data.get('description', lesson.description)
                lesson.pass_threshold_percent = request.data.get('pass_threshold_percent', lesson.pass_threshold_percent)
                lesson.duration_estimate_minutes = request.data.get('duration_estimate_minutes', lesson.duration_estimate_minutes)
                lesson.is_active = request.data.get('is_active', lesson.is_active)
                lesson.save()
                
                # Delete existing questions and answers (CASCADE)
                lesson.quiz_questions.all().delete()
                
                # Create new questions and answers
                for q_data in questions_data:
                    answers_data = q_data.pop('answers')
                    
                    question = QuizQuestion.objects.create(
                        lesson=lesson,
                        question_text=q_data['question_text'],
                        order=q_data['order']
                    )
                    
                    for a_data in answers_data:
                        QuizAnswer.objects.create(
                            question=question,
                            answer_text=a_data['answer_text'],
                            is_correct=a_data['is_correct'],
                            order=a_data['order']
                        )
                
                # Recalculate section progress for affected users
                for uid in affected_user_ids:
                    try:
                        user = User.objects.get(pk=uid)
                        recalc_section_progress(user, lesson.section)
                    except User.DoesNotExist:
                        pass  # User was deleted, skip
                
                # Return updated lesson
                serializer = LessonDetailSerializer(lesson, context={'request': request})
                
                return Response({
                    'success': True,
                    'message': f'Quiz updated successfully with {len(questions_data)} questions',
                    'users_progress_reset': users_reset_count,
                    'lesson': serializer.data
                })
        
        except Exception as e:
            return Response(
                {'error': f'Failed to update quiz: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a lesson."""
        lesson = self.get_object()
        
        new_lesson = Lesson.objects.create(
            section=lesson.section,
            title=f"{lesson.title} (Copy)",
            slug=f"{lesson.slug}-copy",
            description=lesson.description,
            content=lesson.content,
            kind=lesson.kind,
            content_url=lesson.content_url,
            order=lesson.section.lessons.count() + 1,
            is_active=False,
            duration_estimate_minutes=lesson.duration_estimate_minutes,
            pass_threshold_percent=lesson.pass_threshold_percent
        )
        
        # Duplicate quiz questions and answers if it's a quiz
        if lesson.kind == Lesson.Kind.QUIZ:
            for question in lesson.quiz_questions.all():
                new_question = QuizQuestion.objects.create(
                    lesson=new_lesson,
                    question_text=question.question_text,
                    order=question.order
                )
                
                for answer in question.answers.all():
                    QuizAnswer.objects.create(
                        question=new_question,
                        answer_text=answer.answer_text,
                        is_correct=answer.is_correct,
                        order=answer.order
                    )
        
        return Response({
            'message': 'Lesson duplicated successfully',
            'new_lesson_id': new_lesson.id
        })

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder lessons within a section."""
        serializer = LessonReorderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        lesson_orders = serializer.validated_data['lesson_orders']
        
        for item in lesson_orders:
            lesson_id = item.get('id')
            new_order = item.get('order')
            if lesson_id and new_order is not None:
                Lesson.objects.filter(id=lesson_id).update(order=new_order)
        
        return Response({'message': 'Lessons reordered successfully'})

    def destroy(self, request, *args, **kwargs):
        """
        Delete a lesson with proper cleanup of related data.
        
        DELETE /api/learning/admin/lessons/{id}/
        
        This method:
        1. Stores section reference before deletion
        2. Identifies all affected users (progress, learning paths)
        3. Deletes the lesson (Django CASCADE handles related data)
        4. Recalculates section progress for all affected users
        5. Updates learning paths for users who had this lesson as current
        6. Optionally cleans up orphaned media references
        
        Query params:
        - force: Set to 'true' to skip usage warnings (default: false)
        - cleanup_media: Set to 'true' to unlink associated media (default: false)
        
        Returns:
        - success: True/False
        - message: Status message
        - deleted_lesson: Details of the deleted lesson
        - affected_data: Summary of affected/cleaned up data
        """
        from django.db import transaction
        from .models import UserLearningPath, LearningMedia, LearningPrerequisite
        
        lesson = self.get_object()
        
        # Store lesson info before deletion
        lesson_info = {
            'id': lesson.id,
            'title': lesson.title,
            'kind': lesson.kind,
            'section_id': lesson.section.id,
            'section_title': lesson.section.title,
            'order': lesson.order
        }
        
        # Store section reference for progress recalculation
        section = lesson.section
        
        # Check query params
        force = request.query_params.get('force', 'false').lower() == 'true'
        cleanup_media = request.query_params.get('cleanup_media', 'false').lower() == 'true'
        
        # ========== PRE-DELETION ANALYSIS ==========
        
        # Count affected data for response summary
        progress_count = UserLessonProgress.objects.filter(lesson=lesson).count()
        quiz_attempt_count = QuizAttempt.objects.filter(lesson=lesson).count()
        activity_log_count = ActivityLog.objects.filter(lesson=lesson).count()
        question_count = lesson.quiz_questions.count() if lesson.kind == Lesson.Kind.QUIZ else 0
        
        # Get users who have progress in this lesson's section (for recalculation)
        affected_user_ids = list(
            UserLessonProgress.objects.filter(
                lesson__section=section
            ).values_list('user_id', flat=True).distinct()
        )
        
        # Get users who have this lesson as their current_lesson
        learning_path_user_ids = list(
            UserLearningPath.objects.filter(
                current_lesson=lesson
            ).values_list('user_id', flat=True)
        )
        
        # Check if lesson is used as a prerequisite
        prerequisite_count = LearningPrerequisite.objects.filter(
            prerequisite_lesson=lesson
        ).count()
        
        # Check for associated media
        media_count = LearningMedia.objects.filter(
            content_type='lesson',
            content_id=lesson.id
        ).count()
        
        # ========== USAGE WARNING (unless forced) ==========
        
        if not force and (progress_count > 0 or quiz_attempt_count > 0):
            return Response({
                'warning': True,
                'message': 'This lesson has been used by employees. Use force=true to confirm deletion.',
                'lesson': lesson_info,
                'usage_stats': {
                    'users_with_progress': progress_count,
                    'quiz_attempts': quiz_attempt_count,
                    'activity_logs': activity_log_count,
                    'quiz_questions': question_count,
                    'used_as_prerequisite': prerequisite_count,
                    'associated_media': media_count
                },
                'hint': 'Add ?force=true to the URL to proceed with deletion'
            }, status=status.HTTP_409_CONFLICT)
        
        # ========== DELETION PHASE ==========
        
        try:
            with transaction.atomic():
                # Delete prerequisites where this lesson is the prerequisite
                # (This prevents orphaned prerequisite chains)
                LearningPrerequisite.objects.filter(prerequisite_lesson=lesson).delete()
                LearningPrerequisite.objects.filter(lesson=lesson).delete()
                
                # Optionally clean up media references
                if cleanup_media:
                    LearningMedia.objects.filter(
                        content_type='lesson',
                        content_id=lesson.id
                    ).update(content_type='', content_id=None)
                
                # Delete the lesson (CASCADE handles: quiz_questions, answers, progress, quiz_attempts)
                # SET_NULL handles: activity_log.lesson, user_learning_path.current_lesson
                lesson.delete()
                
                # ========== POST-DELETION CLEANUP ==========
                
                # Recalculate section progress for all affected users
                users_recalculated = 0
                for user_id in affected_user_ids:
                    try:
                        user = User.objects.get(id=user_id)
                        recalc_section_progress(user, section)
                        users_recalculated += 1
                    except User.DoesNotExist:
                        continue
                
                # Update learning paths for users who had this lesson as current
                learning_paths_updated = 0
                for user_id in learning_path_user_ids:
                    try:
                        user = User.objects.get(id=user_id)
                        update_user_learning_path(user)
                        learning_paths_updated += 1
                    except User.DoesNotExist:
                        continue
            
            return Response({
                'success': True,
                'message': f'Lesson "{lesson_info["title"]}" deleted successfully',
                'deleted_lesson': lesson_info,
                'affected_data': {
                    'progress_records_deleted': progress_count,
                    'quiz_attempts_deleted': quiz_attempt_count,
                    'quiz_questions_deleted': question_count,
                    'activity_logs_updated': activity_log_count,
                    'prerequisites_cleaned': prerequisite_count,
                    'media_unlinked': media_count if cleanup_media else 0,
                    'users_progress_recalculated': users_recalculated,
                    'learning_paths_updated': learning_paths_updated
                }
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to delete lesson {lesson_info['id']}: {str(e)}", exc_info=True)
            
            return Response({
                'success': False,
                'error': f'Failed to delete lesson: {str(e)}',
                'lesson': lesson_info
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def deletion_preview(self, request, pk=None):
        """
        Preview what will be affected if this lesson is deleted.
        
        GET /api/learning/admin/lessons/{id}/deletion_preview/
        
        Returns a summary of all data that will be affected/deleted.
        Use this before calling DELETE to understand the impact.
        """
        from .models import UserLearningPath, LearningMedia, LearningPrerequisite
        
        lesson = self.get_object()
        
        # Count affected data
        progress_records = UserLessonProgress.objects.filter(lesson=lesson)
        quiz_attempts = QuizAttempt.objects.filter(lesson=lesson)
        activity_logs = ActivityLog.objects.filter(lesson=lesson)
        quiz_questions = lesson.quiz_questions.all() if lesson.kind == Lesson.Kind.QUIZ else []
        
        # Users affected
        users_with_progress = progress_records.values('user').distinct().count()
        users_with_attempts = quiz_attempts.values('user').distinct().count()
        
        # Learning paths affected
        learning_paths = UserLearningPath.objects.filter(current_lesson=lesson)
        
        # Prerequisites affected
        as_prerequisite = LearningPrerequisite.objects.filter(prerequisite_lesson=lesson)
        has_prerequisite = LearningPrerequisite.objects.filter(lesson=lesson)
        
        # Media affected
        media = LearningMedia.objects.filter(content_type='lesson', content_id=lesson.id)
        
        # Get section stats
        section_lessons_count = lesson.section.lessons.filter(is_active=True).count()
        is_last_lesson = section_lessons_count == 1
        
        return Response({
            'lesson': {
                'id': lesson.id,
                'title': lesson.title,
                'kind': lesson.kind,
                'section': {
                    'id': lesson.section.id,
                    'title': lesson.section.title,
                    'total_active_lessons': section_lessons_count,
                    'will_be_empty': is_last_lesson
                }
            },
            'will_be_deleted': {
                'progress_records': progress_records.count(),
                'quiz_attempts': quiz_attempts.count(),
                'quiz_questions': len(quiz_questions),
                'quiz_answers': sum(q.answers.count() for q in quiz_questions) if quiz_questions else 0
            },
            'will_be_updated': {
                'activity_logs_set_to_null': activity_logs.count(),
                'learning_paths_set_to_null': learning_paths.count()
            },
            'users_affected': {
                'with_progress': users_with_progress,
                'with_quiz_attempts': users_with_attempts,
                'with_current_lesson': learning_paths.count()
            },
            'prerequisites': {
                'used_as_prerequisite_by': as_prerequisite.count(),
                'has_prerequisites': has_prerequisite.count()
            },
            'media': {
                'associated_media_files': media.count()
            },
            'warnings': self._get_deletion_warnings(lesson, is_last_lesson, as_prerequisite.count())
        })
    
    def _get_deletion_warnings(self, lesson, is_last_lesson, prerequisite_count):
        """Generate warnings for lesson deletion."""
        warnings = []
        
        if is_last_lesson:
            warnings.append({
                'level': 'warning',
                'message': f'This is the last lesson in section "{lesson.section.title}". The section will be empty after deletion.'
            })
        
        if prerequisite_count > 0:
            warnings.append({
                'level': 'warning',
                'message': f'This lesson is used as a prerequisite by {prerequisite_count} other lesson(s). Those prerequisites will be removed.'
            })
        
        if lesson.kind == Lesson.Kind.QUIZ:
            attempt_count = QuizAttempt.objects.filter(lesson=lesson).count()
            if attempt_count > 0:
                warnings.append({
                    'level': 'info',
                    'message': f'This quiz has {attempt_count} attempt(s). All attempt history will be lost.'
                })
        
        return warnings


class QuizQuestionAdminViewSet(viewsets.ModelViewSet):
    """Admin ViewSet for managing quiz questions."""
    queryset = QuizQuestion.objects.all()
    serializer_class = QuizQuestionSerializer
    permission_classes = [IsAuthenticated, IsLearningQuizManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['lesson']
    search_fields = ['question_text']
    ordering_fields = ['order', 'lesson__title']
    ordering = ['lesson__section__order', 'lesson__order', 'order']


class QuizAnswerAdminViewSet(viewsets.ModelViewSet):
    """Admin ViewSet for managing quiz answers."""
    queryset = QuizAnswer.objects.all()
    serializer_class = QuizAnswerSerializer
    permission_classes = [IsAuthenticated, IsLearningQuizManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['question']
    search_fields = ['answer_text']
    ordering_fields = ['order', 'question__question_text']
    ordering = ['question__lesson__section__order', 'question__lesson__order', 'question__order', 'order']


class AdminStatsViewSet(viewsets.ViewSet):
    """Admin ViewSet for learning analytics."""
    permission_classes = [IsAuthenticated, IsLearningAnalyticsViewer]

    @action(detail=False, methods=["GET"], url_path="overview")
    def overview(self, request):
        """Get system-wide learning metrics with content status and recent activity."""
        from django.db.models import Count, Q
        from django.contrib.humanize.templatetags.humanize import naturaltime
        
        # Get query parameters
        include_content_status = request.query_params.get('include_content_status', 'true').lower() == 'true'
        include_recent_activity = request.query_params.get('include_recent_activity', 'true').lower() == 'true'
        activity_limit = min(int(request.query_params.get('activity_limit', 20)), 100)
        
        # Get base metrics (existing functionality)
        metrics = calculate_learning_metrics()
        
        # Add content status if requested
        if include_content_status:
            # Drafts pending
            draft_sections = Section.objects.filter(is_active=False)
            draft_lessons = Lesson.objects.filter(is_active=False)
            
            # Missing media (VIDEO lessons without content_url)
            missing_media = Lesson.objects.filter(
                kind=Lesson.Kind.VIDEO
            ).filter(
                Q(content_url__isnull=True) | Q(content_url='')
            )
            
            # Low questions (QUIZ lessons with < 3 questions)
            low_questions = Lesson.objects.filter(
                kind=Lesson.Kind.QUIZ
            ).annotate(
                q_count=Count('quiz_questions')
            ).filter(q_count__lt=3)
            
            metrics['content_status'] = {
                'drafts_pending': {
                    'count': draft_sections.count() + draft_lessons.count(),
                    'sections': draft_sections.count(),
                    'lessons': draft_lessons.count()
                },
                'missing_media': {
                    'count': missing_media.count()
                },
                'low_questions': {
                    'count': low_questions.count()
                }
            }
        
        # Add recent activity if requested
        if include_recent_activity:
            activities_queryset = ActivityLog.objects.all().select_related(
                'user', 'section', 'lesson', 'section__campaign'
            ).order_by('-created_at')[:activity_limit]
            
            activities_data = []
            for activity in activities_queryset:
                activities_data.append({
                    'id': str(activity.id),
                    'user': {
                        'id': str(activity.user.id),
                        'name': f"{activity.user.first_name} {activity.user.last_name}".strip() or activity.user.username,
                        'email': activity.user.email,
                        'username': activity.user.username
                    },
                    'event': activity.event,
                    'event_display': activity.get_event_display(),
                    'section': {
                        'id': str(activity.section.id),
                        'title': activity.section.title,
                        'campaign': {
                            'id': str(activity.section.campaign.id),
                            'name': activity.section.campaign.name
                        } if activity.section and activity.section.campaign else None
                    } if activity.section else None,
                    'lesson': {
                        'id': str(activity.lesson.id),
                        'title': activity.lesson.title,
                        'kind': activity.lesson.kind
                    } if activity.lesson else None,
                    'created_at': activity.created_at.isoformat(),
                    'time_ago': naturaltime(activity.created_at),
                    'metadata': activity.metadata
                })
            
            metrics['recent_activity'] = {
                'count': len(activities_data),
                'activities': activities_data
            }
        
        return Response(metrics)

    @action(detail=False, methods=["GET"], url_path="staff")
    def staff(self, request):
        """Get staff progress overview."""
        users = User.objects.filter(is_active=True).values("id", "first_name", "last_name", "email")

        # Progress per user (average over active sections)
        section_progress = (UserSectionProgress.objects
            .filter(section__is_active=True)
            .values("user_id")
            .annotate(
                progress=Avg("progress_percent"),
                last_active=Max("last_activity_at")
            )
        )
        prog_map = {row["user_id"]: row for row in section_progress}

        rows = []
        for u in users:
            p = prog_map.get(u["id"], None)
            progress = round(p["progress"], 1) if p and p["progress"] is not None else 0.0
            last_active = p["last_active"] if p else None
            status = "Active" if last_active and (timezone.now() - last_active) <= timedelta(days=7) else "Inactive"
            
            rows.append({
                "employee": f'{u["first_name"]} {u["last_name"]}'.strip() or u["email"],
                "email": u["email"],
                "progress_percent": progress,
                "status": status,
                "last_active": last_active,
            })
        
        return Response(rows)

    @action(detail=False, methods=["GET"], url_path="section-completion")
    def section_completion(self, request):
        """Get completion rates for each section."""
        total_users = User.objects.filter(is_active=True).count() or 1
        data = []
        
        for s in Section.objects.filter(is_active=True).order_by("order"):
            completed = UserSectionProgress.objects.filter(
                section=s, 
                status=UserSectionProgress.Status.COMPLETED
            ).count()
            pct = round(100 * completed / total_users, 1)
            
            data.append({
                "section_id": s.id, 
                "section": s.title, 
                "completion_percent": pct,
                "total_users": total_users,
                "completed_users": completed
            })
        
        return Response(data)

    @action(detail=False, methods=["GET"], url_path="activity-7d")
    def activity_7d(self, request):
        """Get daily active users for last 7 days."""
        start = (timezone.now() - timedelta(days=6)).date()
        end = timezone.now().date()
        
        # Get daily active users
        from django.db.models.functions import TruncDate
        qs = (ActivityLog.objects
              .filter(created_at__date__gte=start, created_at__date__lte=end)
              .annotate(day=TruncDate("created_at"))
              .values("day")
              .annotate(active_users=Count("user", distinct=True))
              .order_by("day"))
        
        # Fill any missing days
        day_map = {row["day"]: row["active_users"] for row in qs}
        days = []
        cur = start
        
        while cur <= end:
            days.append({
                "date": cur, 
                "active_users": day_map.get(cur, 0)
            })
            cur += timedelta(days=1)
        
        return Response(days)

    @action(detail=False, methods=["GET"], url_path="user-progress")
    def user_progress(self, request):
        """Get detailed progress for a specific user."""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id parameter required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        stats = get_user_learning_stats(user)
        return Response(stats)


class UserProgressAdminViewSet(viewsets.ViewSet):
    """Admin ViewSet for managing user progress."""
    permission_classes = [IsAuthenticated, IsLearningProgressManager]

    @action(detail=False, methods=['get'])
    def user_progress(self, request):
        """Get detailed progress for a specific user."""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id parameter required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get section progress
        section_progress = UserSectionProgress.objects.filter(user=user).select_related('section')
        section_serializer = UserSectionProgressSerializer(section_progress, many=True)
        
        # Get lesson progress
        lesson_progress = UserLessonProgress.objects.filter(user=user).select_related('lesson', 'lesson__section')
        lesson_serializer = UserLessonProgressSerializer(lesson_progress, many=True)
        
        # Get quiz attempts
        quiz_attempts = QuizAttempt.objects.filter(user=user).select_related('lesson')
        quiz_serializer = QuizAttemptSerializer(quiz_attempts, many=True)
        
        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name
            },
            'section_progress': section_serializer.data,
            'lesson_progress': lesson_serializer.data,
            'quiz_attempts': quiz_serializer.data
        })

    @action(detail=False, methods=['get'])
    def all_users_progress(self, request):
        """Get progress overview for all users (employees and managers)."""
        from datetime import timedelta
        from django.db.models import Prefetch
        
        # PERFORMANCE OPTIMIZATION: Get all active users with prefetch_related
        users = User.objects.filter(is_active=True).select_related().values(
            'id', 'username', 'email', 'first_name', 'last_name'
        )
        
        # PERFORMANCE OPTIMIZATION: Get all user IDs for bulk queries
        user_ids = [user['id'] for user in users]
        
        # PERFORMANCE OPTIMIZATION: Bulk fetch all progress data
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)
        
        # Get all section progress data in one query
        section_progress_data = {}
        section_progress_queryset = UserSectionProgress.objects.filter(
            user_id__in=user_ids,
            section__is_active=True
        ).values('user_id').annotate(
            total_sections=Count('id'),
            completed_sections=Count('id', filter=Q(status=UserSectionProgress.Status.COMPLETED)),
            avg_progress=Avg('progress_percent')
        )
        
        for data in section_progress_queryset:
            section_progress_data[data['user_id']] = data
        
        # Get all lesson progress data in one query
        lesson_progress_data = {}
        lesson_progress_queryset = UserLessonProgress.objects.filter(
            user_id__in=user_ids,
            lesson__is_active=True
        ).values('user_id').annotate(
            total_lessons=Count('id'),
            completed_lessons=Count('id', filter=Q(status=UserLessonProgress.Status.COMPLETED)),
            in_progress_lessons=Count('id', filter=Q(status=UserLessonProgress.Status.IN_PROGRESS)),
            total_time=Sum('time_spent_seconds')
        )
        
        for data in lesson_progress_queryset:
            lesson_progress_data[data['user_id']] = data
        
        # Get all quiz stats data in one query
        quiz_stats_data = {}
        quiz_stats_queryset = QuizAttempt.objects.filter(
            user_id__in=user_ids
        ).values('user_id').annotate(
            total_attempts=Count('id'),
            passed_attempts=Count('id', filter=Q(passed=True)),
            avg_score=Avg('score_percent')
        )
        
        for data in quiz_stats_queryset:
            quiz_stats_data[data['user_id']] = data
        
        # Get all recent activity data in one query
        recent_activity_data = set(
            UserSectionProgress.objects.filter(
                user_id__in=user_ids,
                last_activity_at__gte=seven_days_ago
            ).values_list('user_id', flat=True)
        )
        
        # Get last activity data in one query
        last_activity_data = {}
        last_activity_queryset = UserSectionProgress.objects.filter(
            user_id__in=user_ids
        ).values('user_id').annotate(
            last_activity=Max('last_activity_at')
        )
        
        for data in last_activity_queryset:
            last_activity_data[data['user_id']] = data['last_activity']
        
        # Get overall progress for each user
        user_progress_list = []
        
        for user_data in users:
            user_id = user_data['id']
            
            # Get cached data
            section_progress = section_progress_data.get(user_id, {
                'total_sections': 0, 'completed_sections': 0, 'avg_progress': 0
            })
            lesson_progress = lesson_progress_data.get(user_id, {
                'total_lessons': 0, 'completed_lessons': 0, 'in_progress_lessons': 0, 'total_time': 0
            })
            quiz_stats = quiz_stats_data.get(user_id, {
                'total_attempts': 0, 'passed_attempts': 0, 'avg_score': 0
            })
            
            # PERFORMANCE OPTIMIZATION: Use cached activity data
            recent_activity = user_id in recent_activity_data
            last_activity = last_activity_data.get(user_id)
            
            # Calculate overall completion percentage
            total_sections = section_progress['total_sections'] or 0
            completed_sections = section_progress['completed_sections'] or 0
            overall_progress = section_progress['avg_progress'] or 0
            
            # Calculate time in hours and minutes
            total_time_seconds = lesson_progress['total_time'] or 0
            hours = int(total_time_seconds // 3600)
            minutes = int((total_time_seconds % 3600) // 60)
            time_formatted = f"{hours}h {minutes}m"
            
            # PERFORMANCE OPTIMIZATION: Determine user role without additional queries
            user_role = 'Employee'  # Default role
            
            user_progress_list.append({
                'user': {
                    'id': user_id,
                    'username': user_data['username'],
                    'email': user_data['email'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'role': user_role
                },
                'progress_summary': {
                    'overall_progress_percent': round(overall_progress, 1),
                    'sections_completed': completed_sections,
                    'total_sections': total_sections,
                    'lessons_completed': lesson_progress['completed_lessons'] or 0,
                    'total_lessons': lesson_progress['total_lessons'] or 0,
                    'lessons_in_progress': lesson_progress['in_progress_lessons'] or 0,
                    'quiz_attempts': quiz_stats['total_attempts'] or 0,
                    'quiz_passed': quiz_stats['passed_attempts'] or 0,
                    'avg_quiz_score': round(quiz_stats['avg_score'] or 0, 1),
                    'total_time_spent': time_formatted  # NEW: Added time tracking
                },
                'last_activity': last_activity,
                'status': 'Active' if recent_activity else 'Inactive'  # FIXED: Consistent activity definition
            })
        
        # Sort by overall progress (descending)
        user_progress_list.sort(key=lambda x: x['progress_summary']['overall_progress_percent'], reverse=True)
        
        return Response({
            'total_users': len(user_progress_list),
            'users_progress': user_progress_list
        })

    @action(detail=False, methods=['post'])
    def reset_progress(self, request):
        """Reset user progress for a section or lesson."""
        user_id = request.data.get('user_id')
        content_type = request.data.get('content_type')  # 'section' or 'lesson'
        content_id = request.data.get('content_id')
        
        if not all([user_id, content_type, content_id]):
            return Response(
                {'error': 'user_id, content_type, and content_id required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if content_type == 'section':
            UserSectionProgress.objects.filter(
                user=user, 
                section_id=content_id
            ).delete()
            
            # Also reset all lesson progress in this section
            UserLessonProgress.objects.filter(
                user=user,
                lesson__section_id=content_id
            ).delete()
            
            # PHASE 2 FIX: Also delete quiz attempts for lessons in this section
            QuizAttempt.objects.filter(
                user=user,
                lesson__section_id=content_id
            ).delete()
            
            message = 'Section progress reset successfully'
        elif content_type == 'lesson':
            UserLessonProgress.objects.filter(
                user=user, 
                lesson_id=content_id
            ).delete()
            
            # PHASE 2 FIX: Also delete quiz attempts for this lesson
            QuizAttempt.objects.filter(
                user=user,
                lesson_id=content_id
            ).delete()
            
            # Recalculate section progress
            lesson = Lesson.objects.get(id=content_id)
            recalc_section_progress(user, lesson.section)
            
            message = 'Lesson progress reset successfully'
        else:
            return Response(
                {'error': 'content_type must be "section" or "lesson"'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({'message': message})

    @action(detail=False, methods=['post'])
    @log_api_call
    def override_completion(self, request):
        """Manually mark a lesson as completed for a user."""
        logger.info(f"[OVERRIDE_COMPLETION] Admin override by user={request.user.id}, data={request.data}")
        user_id = request.data.get('user_id')
        lesson_id = request.data.get('lesson_id')
        
        if not all([user_id, lesson_id]):
            logger.warning(f"[OVERRIDE_COMPLETION] Missing required fields: user_id={user_id}, lesson_id={lesson_id}")
            return Response(
                {'error': 'user_id and lesson_id required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
            lesson = Lesson.objects.get(id=lesson_id)
        except (User.DoesNotExist, Lesson.DoesNotExist):
            logger.warning(f"[OVERRIDE_COMPLETION] User or lesson not found: user_id={user_id}, lesson_id={lesson_id}")
            return Response(
                {'error': 'User or lesson not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create or update lesson progress
        progress, created = UserLessonProgress.objects.get_or_create(
            user=user, 
            lesson=lesson
        )
        
        progress.status = UserLessonProgress.Status.COMPLETED
        progress.completed_at = timezone.now()
        progress.last_activity_at = timezone.now()
        
        # PHASE 2 FIX: Add time tracking for overridden completions
        time_spent_seconds = request.data.get('time_spent_seconds')
        if time_spent_seconds is not None:
            progress.time_spent_seconds = time_spent_seconds
        elif not progress.time_spent_seconds:  # Only set if not already set
            # Use lesson's estimated duration as default time
            progress.time_spent_seconds = (lesson.duration_estimate_minutes or 10) * 60
        
        progress.save()
        
        # Update section progress
        recalc_section_progress(user, lesson.section)
        
        # Log activity
        log_activity(
            user, 
            section=lesson.section, 
            lesson=lesson, 
            event=ActivityLog.Event.LESSON_COMPLETED,
            request=request
        )
        
        return Response({'message': 'Lesson marked as completed'})

    @action(detail=False, methods=['post'])
    def override_quiz_score(self, request):
        """Override quiz score for a user."""
        user_id = request.data.get('user_id')
        lesson_id = request.data.get('lesson_id')
        score_percent = request.data.get('score_percent')
        
        if not all([user_id, lesson_id, score_percent]):
            return Response(
                {'error': 'user_id, lesson_id, and score_percent required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
            lesson = Lesson.objects.get(id=lesson_id)
        except (User.DoesNotExist, Lesson.DoesNotExist):
            return Response(
                {'error': 'User or lesson not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if lesson is a quiz
        if lesson.kind != Lesson.Kind.QUIZ:
            return Response(
                {'error': 'This lesson is not a quiz'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or update quiz attempt
        quiz_attempt, created = QuizAttempt.objects.get_or_create(
            user=user,
            lesson=lesson,
            defaults={
                'score_percent': score_percent,
                'passed': score_percent >= lesson.pass_threshold_percent,
                'submitted_at': timezone.now()
            }
        )
        
        if not created:
            quiz_attempt.score_percent = score_percent
            quiz_attempt.passed = score_percent >= lesson.pass_threshold_percent
            quiz_attempt.save()
        
        # If passed, mark lesson as completed
        if quiz_attempt.passed:
            progress, created = UserLessonProgress.objects.get_or_create(
                user=user,
                lesson=lesson
            )
            progress.status = UserLessonProgress.Status.COMPLETED
            progress.completed_at = timezone.now()
            progress.last_activity_at = timezone.now()
            progress.save()
            
            # Update section progress
            recalc_section_progress(user, lesson.section)
        
        # PHASE 2 FIX: Add activity logging for quiz override
        log_activity(
            user, 
            section=lesson.section, 
            lesson=lesson, 
            event=ActivityLog.Event.QUIZ_SUBMITTED,
            request=request
        )
        
        return Response({
            'message': 'Quiz score updated successfully',
            'passed': quiz_attempt.passed
        })


class CampaignCompletionCheckView(APIView):
    """
    Check if a user (employee or manager) has completed all sections 
    for a specific campaign.
    
    GET /api/learning/campaign-completion-check/
    Query params:
        - user_id: UUID (employee_id OR manager_id)
        - campaign_id: UUID (required)
        OR
        - employee_id: UUID
        - manager_id: UUID
        - campaign_id: UUID (required)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from campaigns.models import Campaign, CampaignEmployee
        from users.models import Employee, Manager
        from .services import check_campaign_section_completion
        
        # Get parameters
        user_id = request.query_params.get('user_id')
        employee_id = request.query_params.get('employee_id')
        manager_id = request.query_params.get('manager_id')
        campaign_id = request.query_params.get('campaign_id')
        
        # Validate campaign_id is provided
        if not campaign_id:
            return Response({
                'error': 'campaign_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get User from employee_id or manager_id
        user = None
        
        if user_id:
            # Try as employee_id first
            try:
                employee = Employee.objects.get(id=user_id)
                user = employee.user
            except Employee.DoesNotExist:
                # Try as manager_id
                try:
                    manager = Manager.objects.get(id=user_id)
                    user = manager.user
                except Manager.DoesNotExist:
                    return Response({
                        'error': f'User not found with id: {user_id}'
                    }, status=status.HTTP_404_NOT_FOUND)
        elif employee_id:
            try:
                employee = Employee.objects.get(id=employee_id)
                user = employee.user
            except Employee.DoesNotExist:
                return Response({
                    'error': f'Employee not found with id: {employee_id}'
                }, status=status.HTTP_404_NOT_FOUND)
        elif manager_id:
            try:
                manager = Manager.objects.get(id=manager_id)
                user = manager.user
            except Manager.DoesNotExist:
                return Response({
                    'error': f'Manager not found with id: {manager_id}'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({
                'error': 'Either user_id, employee_id, or manager_id must be provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not user:
            return Response({
                'error': 'User account not found for this employee/manager'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get campaign
        try:
            campaign = Campaign.objects.get(id=campaign_id)
        except Campaign.DoesNotExist:
            return Response({
                'error': f'Campaign not found with id: {campaign_id}'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Verify user is assigned to campaign (optional check)
        is_assigned = False
        if hasattr(user, 'employee') and user.employee:
            is_assigned = CampaignEmployee.objects.filter(
                campaign=campaign,
                employee=user.employee
            ).exists()
        elif hasattr(user, 'manager') and user.manager:
            is_assigned = CampaignEmployee.objects.filter(
                campaign=campaign,
                manager=user.manager
            ).exists()
        
        # Check completion
        result = check_campaign_section_completion(user, campaign)
        
        # Add assignment verification
        result['is_assigned_to_campaign'] = is_assigned
        
        return Response(result, status=status.HTTP_200_OK)
