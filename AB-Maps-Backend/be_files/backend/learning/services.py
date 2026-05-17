"""
Services for the learning platform integrated with AB Maps.
"""
from __future__ import annotations
from django.utils import timezone
from django.db.models import Count, Sum, Avg, Q
from django.contrib.auth import get_user_model
from .models import (
    Section, Lesson, UserLessonProgress, UserSectionProgress, ActivityLog,
    QuizAttempt, UserLearningPath
)

User = get_user_model()


def _ensure_section_progress(user, section: Section, allow_create=True) -> UserSectionProgress | None:
    """Ensure section progress record exists for user.
    
    Args:
        allow_create: If False, returns None instead of creating a new record.
                      Used during cascade deletion to avoid orphaned records.
    """
    if allow_create:
        sp, _ = UserSectionProgress.objects.get_or_create(user=user, section=section)
        return sp
    else:
        try:
            return UserSectionProgress.objects.get(user=user, section=section)
        except UserSectionProgress.DoesNotExist:
            return None


def recalc_section_progress(user, section: Section, allow_create=True) -> UserSectionProgress | None:
    """Recalculate section progress based on lesson completion.
    
    Args:
        allow_create: If False, skips if no existing progress record exists.
                      Used during cascade deletion to avoid orphaned records.
    """
    sp = _ensure_section_progress(user, section, allow_create=allow_create)
    if sp is None:
        return None

    total = section.lessons.filter(is_active=True).count()
    
    if total == 0:
        sp.progress_percent = 0
        sp.status = UserSectionProgress.Status.NOT_STARTED
        sp.save(update_fields=["progress_percent", "status"])
        return sp

    completed = UserLessonProgress.objects.filter(
        user=user, 
        lesson__section=section, 
        status=UserLessonProgress.Status.COMPLETED
    ).count()
    
    percent = int(round(100 * completed / total))

    # Status logic
    if completed == 0:
        status = UserSectionProgress.Status.NOT_STARTED
    elif completed == total:
        status = UserSectionProgress.Status.COMPLETED
        if not sp.completed_at:
            sp.completed_at = timezone.now()
    else:
        status = UserSectionProgress.Status.IN_PROGRESS
        if not sp.started_at:
            sp.started_at = timezone.now()

    sp.progress_percent = percent
    sp.status = status
    sp.last_activity_at = timezone.now()
    sp.save()
    return sp


def log_activity(user, section=None, lesson=None, event="LESSON_STARTED", metadata=None, request=None):
    """Log learning activity with optional metadata."""
    activity_data = {
        'user': user,
        'section': section,
        'lesson': lesson,
        'event': event,
        'metadata': metadata or {},
    }
    
    # Add request context if available
    if request:
        activity_data.update({
            'ip_address': request.META.get('REMOTE_ADDR'),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'session_id': request.session.session_key or '',
        })
    
    ActivityLog.objects.create(**activity_data)


def get_user_learning_stats(user):
    """Get comprehensive learning statistics for a user."""
    # Section progress
    section_progress_raw = UserSectionProgress.objects.filter(user=user).aggregate(
        total_sections=Count('id'),
        completed_sections=Count('id', filter=Q(status=UserSectionProgress.Status.COMPLETED)),
        in_progress_sections=Count('id', filter=Q(status=UserSectionProgress.Status.IN_PROGRESS)),
        total_progress=Sum('progress_percent'),
        count=Count('id')
    )
    
    # Calculate average progress safely (avoid division by zero)
    total_sections = section_progress_raw['total_sections'] or 0
    avg_progress = 0.0
    if total_sections > 0 and section_progress_raw['total_progress']:
        avg_progress = round(section_progress_raw['total_progress'] / total_sections, 2)
    
    section_progress = {
        'total_sections': total_sections,
        'completed_sections': section_progress_raw['completed_sections'] or 0,
        'in_progress_sections': section_progress_raw['in_progress_sections'] or 0,
        'avg_progress': avg_progress
    }
    
    # Lesson progress
    lesson_progress_raw = UserLessonProgress.objects.filter(user=user).aggregate(
        total_lessons=Count('id'),
        completed_lessons=Count('id', filter=Q(status=UserLessonProgress.Status.COMPLETED)),
        in_progress_lessons=Count('id', filter=Q(status=UserLessonProgress.Status.IN_PROGRESS)),
        total_time_spent=Sum('time_spent_seconds')
    )
    
    lesson_progress = {
        'total_lessons': lesson_progress_raw['total_lessons'] or 0,
        'completed_lessons': lesson_progress_raw['completed_lessons'] or 0,
        'in_progress_lessons': lesson_progress_raw['in_progress_lessons'] or 0,
        'total_time_spent': lesson_progress_raw['total_time_spent'] or 0
    }
    
    # Quiz attempts
    quiz_stats_raw = QuizAttempt.objects.filter(user=user).aggregate(
        total_attempts=Count('id'),
        passed_attempts=Count('id', filter=Q(passed=True)),
        total_score=Sum('score_percent'),
        count=Count('id')
    )
    
    # Calculate average score safely (avoid division by zero)
    total_attempts = quiz_stats_raw['total_attempts'] or 0
    avg_score = 0.0
    if total_attempts > 0 and quiz_stats_raw['total_score']:
        avg_score = round(quiz_stats_raw['total_score'] / total_attempts, 2)
    
    quiz_stats = {
        'total_attempts': total_attempts,
        'passed_attempts': quiz_stats_raw['passed_attempts'] or 0,
        'avg_score': avg_score
    }
    
    # Learning streak
    from datetime import timedelta
    today = timezone.now().date()
    streak = 0
    current_date = today
    
    # Limit streak calculation to prevent infinite loop
    max_days = 365
    days_checked = 0
    
    while days_checked < max_days:
        if ActivityLog.objects.filter(
            user=user,
            created_at__date=current_date
        ).exists():
            streak += 1
            current_date -= timedelta(days=1)
            days_checked += 1
        else:
            break
    
    last_activity_obj = ActivityLog.objects.filter(user=user).order_by('-created_at').first()
    
    # Serialize last_activity to dict if it exists
    last_activity = None
    if last_activity_obj:
        last_activity = {
            'id': str(last_activity_obj.id),
            'event': last_activity_obj.event,
            'event_display': last_activity_obj.get_event_display(),
            'section_id': str(last_activity_obj.section.id) if last_activity_obj.section else None,
            'section_title': last_activity_obj.section.title if last_activity_obj.section else None,
            'lesson_id': str(last_activity_obj.lesson.id) if last_activity_obj.lesson else None,
            'lesson_title': last_activity_obj.lesson.title if last_activity_obj.lesson else None,
            'created_at': last_activity_obj.created_at.isoformat() if last_activity_obj.created_at else None,
            'metadata': last_activity_obj.metadata or {}
        }
    
    return {
        'section_progress': section_progress,
        'lesson_progress': lesson_progress,
        'quiz_stats': quiz_stats,
        'learning_streak_days': streak,
        'last_activity': last_activity
    }


def check_section_prerequisites(user, section: Section) -> dict:
    """Check if user can access a section based on prerequisites."""
    # First section is always accessible
    if section.order == 1:
        return {'accessible': True, 'reason': 'First section'}
    
    # Check if previous section is completed
    try:
        prev_section = Section.objects.get(order=section.order - 1, is_active=True)
        prev_progress = UserSectionProgress.objects.filter(
            user=user, 
            section=prev_section, 
            status=UserSectionProgress.Status.COMPLETED
        ).exists()
        
        if prev_progress:
            return {'accessible': True, 'reason': 'Previous section completed'}
        else:
            return {
                'accessible': False, 
                'reason': f'Complete section "{prev_section.title}" first',
                'required_section': prev_section.id
            }
    except Section.DoesNotExist:
        return {'accessible': True, 'reason': 'No previous section found'}


def get_recommended_lessons(user, limit=5):
    """Get recommended lessons for a user based on their progress."""
    # Get user's current progress
    user_progress = UserSectionProgress.objects.filter(
        user=user,
        status__in=[UserSectionProgress.Status.IN_PROGRESS, UserSectionProgress.Status.NOT_STARTED]
    ).select_related('section').order_by('section__order')
    
    recommended = []
    
    for progress in user_progress:
        if progress.status == UserSectionProgress.Status.NOT_STARTED:
            # Recommend first lesson of section
            first_lesson = progress.section.lessons.filter(is_active=True).order_by('order').first()
            if first_lesson:
                recommended.append({
                    'lesson': first_lesson,
                    'reason': f'Start section: {progress.section.title}',
                    'priority': 'high'
                })
        elif progress.status == UserSectionProgress.Status.IN_PROGRESS:
            # Recommend next incomplete lesson
            completed_lessons = UserLessonProgress.objects.filter(
                user=user,
                lesson__section=progress.section,
                status=UserLessonProgress.Status.COMPLETED
            ).values_list('lesson__order', flat=True)
            
            if completed_lessons:
                next_order = max(completed_lessons) + 1
                next_lesson = progress.section.lessons.filter(
                    is_active=True, 
                    order=next_order
                ).first()
                
                if next_lesson:
                    recommended.append({
                        'lesson': next_lesson,
                        'reason': f'Continue section: {progress.section.title}',
                        'priority': 'medium'
                    })
        
        if len(recommended) >= limit:
            break
    
    return recommended


def update_user_learning_path(user, allow_create=True):
    """Update user's learning path and current position.
    
    Args:
        allow_create: If False, returns None instead of creating a new record.
                      Used during cascade deletion to avoid orphaned records.
    """
    # Find current section and lesson
    current_section = None
    current_lesson = None
    
    # Get in-progress or next section
    in_progress_section = UserSectionProgress.objects.filter(
        user=user,
        status=UserSectionProgress.Status.IN_PROGRESS
    ).order_by('section__order').first()
    
    if in_progress_section:
        current_section = in_progress_section.section
        # Find current lesson in section
        current_lesson = UserLessonProgress.objects.filter(
            user=user,
            lesson__section=current_section,
            status__in=[
                UserLessonProgress.Status.IN_PROGRESS,
                UserLessonProgress.Status.NOT_STARTED
            ]
        ).order_by('lesson__order').first()
        
        if current_lesson:
            current_lesson = current_lesson.lesson
    
    # Update or create learning path - handle potential duplicates gracefully
    # First, try to get existing record(s)
    existing_paths = UserLearningPath.objects.filter(user=user).order_by('id')
    
    if existing_paths.exists():
        # Use the first one and clean up any duplicates
        learning_path = existing_paths.first()
        
        # Delete any duplicate records (keep only the first one)
        duplicate_count = existing_paths.count()
        if duplicate_count > 1:
            import logging
            logger = logging.getLogger('learning.services')
            logger.warning(f"[DUPLICATE_CLEANUP] Found {duplicate_count} UserLearningPath records for user {user.id}, cleaning up duplicates")
            existing_paths.exclude(id=learning_path.id).delete()
    elif allow_create:
        # Create new if none exists (only when not in cascade deletion context)
        learning_path = UserLearningPath.objects.create(user=user)
    else:
        # During cascade deletion, don't create new records for a user
        # that is about to be deleted - this would cause FK violations
        return None
    
    learning_path.current_section = current_section
    learning_path.current_lesson = current_lesson
    learning_path.last_learning_date = timezone.now().date()
    learning_path.save()
    
    return learning_path


def calculate_completion_rate_fixed():
    """Calculate completion rate as per-user average."""
    try:
        # Step 1: Calculate average progress per user
        user_averages = UserSectionProgress.objects.filter(
            section__is_active=True
        ).values('user').annotate(
            user_avg_progress=Avg('progress_percent')
        ).aggregate(
            overall_avg=Avg('user_avg_progress')
        )['overall_avg'] or 0
        
        return round(user_averages, 1)
    except Exception as e:
        # Log error and return safe default
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error calculating completion rate: {e}")
        return 0.0


def calculate_average_time_fixed():
    """Calculate average time using lesson-level data."""
    try:
        # Calculate per-user total time from lessons
        user_total_times = UserLessonProgress.objects.filter(
            lesson__is_active=True,
            lesson__section__is_active=True
        ).values('user').annotate(
            user_total_time=Sum('time_spent_seconds')
        ).aggregate(
            overall_avg=Avg('user_total_time')
        )['overall_avg'] or 0
        
        # Convert to hours and minutes
        hours = int(user_total_times // 3600)
        minutes = int((user_total_times % 3600) // 60)
        
        return f"{hours}h {minutes}m"
    except Exception as e:
        # Log error and return safe default
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error calculating average time: {e}")
        return "0h 0m"


def calculate_active_employees_fixed():
    """Calculate active employees based on recent activity."""
    try:
        from datetime import timedelta
        from django.utils import timezone
        
        now = timezone.now()
        total_users = User.objects.filter(is_active=True).count()
        
        # Active: Activity in last 7 days
        active_7d = UserSectionProgress.objects.filter(
            last_activity_at__gte=now - timedelta(days=7)
        ).values('user_id').distinct().count()
        
        # At Risk: Activity 8-30 days ago
        at_risk = UserSectionProgress.objects.filter(
            last_activity_at__gte=now - timedelta(days=30),
            last_activity_at__lt=now - timedelta(days=7)
        ).values('user_id').distinct().count()
        
        # Inactive: No activity in 30+ days (but have progress)
        inactive_with_progress = UserSectionProgress.objects.filter(
            last_activity_at__lt=now - timedelta(days=30)
        ).values('user_id').distinct().count()
        
        # Never started: No progress records at all
        users_with_progress = UserSectionProgress.objects.values('user_id').distinct().count()
        never_started = total_users - users_with_progress
        
        return {
            'active_employees_of_total': f"{active_7d}/{total_users}",
            'at_risk': at_risk,
            'inactive': inactive_with_progress,
            'never_started': never_started
        }
    except Exception as e:
        # Log error and return safe defaults
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error calculating active employees: {e}")
        return {
            'active_employees_of_total': "0/0",
            'at_risk': 0,
            'inactive': 0,
            'never_started': 0
        }


def calculate_learning_metrics():
    """Calculate system-wide learning metrics with comprehensive error handling."""
    import logging
    from django.utils import timezone
    
    logger = logging.getLogger(__name__)
    
    try:
        # 1. Total Users (unchanged)
        total_users = User.objects.filter(is_active=True).count()
        
        # 2. Active Sections (unchanged)
        active_sections = Section.objects.filter(is_active=True).count()
        
        # 3. Completion Rate (FIXED: per-user average)
        if total_users > 0 and active_sections > 0:
            completion_rate = calculate_completion_rate_fixed()
        else:
            completion_rate = 0
        
        # 4. Average Time (FIXED: use lesson-level data)
        average_time = calculate_average_time_fixed()
        
        # 5. Active Employees (FIXED: time-based activity)
        active_employees_data = calculate_active_employees_fixed()
        
        return {
            'total_users': total_users,
            'active_sections': active_sections,
            'completion_rate_percent': completion_rate,
            'average_time_h_m': average_time,
            'active_employees_of_total': active_employees_data['active_employees_of_total'],
            # New fields for enhanced insights
            'at_risk_employees': active_employees_data['at_risk'],
            'inactive_employees': active_employees_data['inactive'],
            'never_started_employees': active_employees_data['never_started'],
            'last_updated': timezone.now().isoformat()
        }
        
    except Exception as e:
        # Log error and return safe defaults
        logger.error(f"Error calculating learning metrics: {e}", exc_info=True)
        return {
            'total_users': 0,
            'active_sections': 0,
            'completion_rate_percent': 0,
            'average_time_h_m': "0h 0m",
            'active_employees_of_total': "0/0",
            'at_risk_employees': 0,
            'inactive_employees': 0,
            'never_started_employees': 0,
            'error': str(e),
            'last_updated': timezone.now().isoformat()
        }


def get_campaign_progress(user, campaign=None):
    """Calculate a user's progress for a specific campaign (None = General Training)."""
    sections = Section.objects.filter(campaign=campaign, is_active=True)
    total_sections = sections.count()
    if total_sections == 0:
        return {
            'campaign_id': campaign.id if campaign else None,
            'campaign_name': campaign.name if campaign else "General Training",
            'is_general': campaign is None,
            'total_sections': 0,
            'completed_sections': 0,
            'in_progress_sections': 0,
            'not_started_sections': 0,
            'progress_percent': 0
        }
    completed = UserSectionProgress.objects.filter(
        user=user,
        section__in=sections,
        status=UserSectionProgress.Status.COMPLETED
    ).count()
    in_progress = UserSectionProgress.objects.filter(
        user=user,
        section__in=sections,
        status=UserSectionProgress.Status.IN_PROGRESS
    ).count()
    not_started = total_sections - completed - in_progress
    progress_percent = int(round(100 * completed / total_sections))
    return {
        'campaign_id': campaign.id if campaign else None,
        'campaign_name': campaign.name if campaign else "General Training",
        'is_general': campaign is None,
        'total_sections': total_sections,
        'completed_sections': completed,
        'in_progress_sections': in_progress,
        'not_started_sections': not_started,
        'progress_percent': progress_percent
    }


def get_all_campaigns_progress(user):
    """Get a list of campaign progress for the user's accessible campaigns."""
    from campaigns.models import Campaign, CampaignEmployee
    results = []
    # General Training
    results.append(get_campaign_progress(user, campaign=None))
    if hasattr(user, 'employee') and user.employee:
        campaigns = Campaign.objects.filter(campaign_employees__employee=user.employee).distinct()
        for c in campaigns:
            results.append(get_campaign_progress(user, campaign=c))
    elif hasattr(user, 'manager') and user.manager:
        campaigns = Campaign.objects.filter(created_by=user.manager).distinct()
        for c in campaigns:
            results.append(get_campaign_progress(user, campaign=c))
    return results


def check_campaign_section_completion(user, campaign):
    """
    Check if user has completed all sections for a specific campaign.
    
    Args:
        user: Django User instance
        campaign: Campaign instance (or None for General Training)
    
    Returns:
        dict with completion status and incomplete sections info
    """
    from django.conf import settings
    
    # TEMPORARY: Bypass completion check for testing
    # When LEARNING_COMPLETION_CHECK_ENABLED is False, always return all_completed=True
    if not getattr(settings, 'LEARNING_COMPLETION_CHECK_ENABLED', True):
        return {
            'all_completed': True,  # HARDCODED for testing
            'campaign_id': str(campaign.id) if campaign else None,
            'campaign_name': campaign.name if campaign else "General Training",
            'total_sections': 0,
            'completed_sections': 0,
            'incomplete_sections': []
        }
    
    # Get all active sections for this campaign
    sections = Section.objects.filter(
        campaign=campaign,
        is_active=True
    ).order_by('order')
    
    total_sections = sections.count()
    
    if total_sections == 0:
        return {
            'all_completed': True,  # No sections = technically completed
            'campaign_id': str(campaign.id) if campaign else None,
            'campaign_name': campaign.name if campaign else "General Training",
            'total_sections': 0,
            'completed_sections': 0,
            'incomplete_sections': []
        }
    
    # Get all section progress records for this user and campaign
    section_progress = UserSectionProgress.objects.filter(
        user=user,
        section__in=sections
    ).select_related('section')
    
    # Create a dict for quick lookup
    progress_dict = {sp.section_id: sp for sp in section_progress}
    
    completed_count = 0
    incomplete_sections = []
    
    for section in sections:
        # Verify actual completion by checking lessons (more robust than relying on cached status)
        total_lessons = section.lessons.filter(is_active=True).count()
        
        if total_lessons == 0:
            # Section with no lessons - consider it completed (nothing to complete)
            completed_count += 1
            continue
        
        # Count actually completed lessons for this user
        completed_lessons = UserLessonProgress.objects.filter(
            user=user,
            lesson__section=section,
            lesson__is_active=True,
            status=UserLessonProgress.Status.COMPLETED
        ).count()
        
        # Section is completed if all lessons are completed
        if completed_lessons == total_lessons:
            completed_count += 1
        else:
            # Section is incomplete - get progress info
            progress = progress_dict.get(section.id)
            progress_percent = int(round(100 * completed_lessons / total_lessons)) if total_lessons > 0 else 0
            
            # Determine status
            if completed_lessons == 0:
                status = 'NOT_STARTED'
            elif completed_lessons == total_lessons:
                status = 'COMPLETED'
            else:
                status = 'IN_PROGRESS'
            
            incomplete_sections.append({
                'section_id': str(section.id),
                'section_title': section.title,
                'section_order': section.order,
                'progress_percent': progress_percent,
                'status': status,
                'completed_lessons': completed_lessons,
                'total_lessons': total_lessons,
                'completed_at': progress.completed_at if progress and progress.status == UserSectionProgress.Status.COMPLETED else None
            })
    
    all_completed = completed_count == total_sections
    
    return {
        'all_completed': all_completed,
        'campaign_id': str(campaign.id) if campaign else None,
        'campaign_name': campaign.name if campaign else "General Training",
        'total_sections': total_sections,
        'completed_sections': completed_count,
        'incomplete_sections': incomplete_sections
    }
