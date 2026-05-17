"""
Signals for the learning platform integrated with AB Maps.
"""
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import UserLessonProgress, UserSectionProgress, QuizAttempt
from .services import recalc_section_progress, update_user_learning_path

logger = logging.getLogger('learning.signals')


@receiver(post_save, sender=UserLessonProgress)
def update_section_progress_on_lesson_progress(sender, instance, **kwargs):
    """Update section progress when lesson progress changes."""
    recalc_section_progress(instance.user, instance.lesson.section)
    
    # Update user's learning path
    update_user_learning_path(instance.user)


@receiver(post_save, sender=QuizAttempt)
def update_progress_on_quiz_attempt(sender, instance, **kwargs):
    """Update lesson progress when quiz is passed."""
    if instance.passed:
        # Mark lesson as completed
        progress, created = UserLessonProgress.objects.get_or_create(
            user=instance.user,
            lesson=instance.lesson
        )
        
        if progress.status != UserLessonProgress.Status.COMPLETED:
            progress.status = UserLessonProgress.Status.COMPLETED
            progress.completed_at = instance.submitted_at
            progress.last_activity_at = instance.submitted_at
            progress.save()
            
            # Update section progress
            recalc_section_progress(instance.user, instance.lesson.section)
            
            # Update user's learning path
            update_user_learning_path(instance.user)


@receiver(post_delete, sender=UserLessonProgress)
def update_section_progress_on_lesson_progress_delete(sender, instance, **kwargs):
    """Update section progress when lesson progress is deleted.
    
    Uses allow_create=False to prevent creating new records during cascade
    deletion (e.g. Manager -> User -> learning records). Without this guard,
    the signal would re-create UserLearningPath/UserSectionProgress for a user
    that is about to be deleted, causing FK violations at commit time.
    """
    try:
        recalc_section_progress(instance.user, instance.lesson.section, allow_create=False)
        update_user_learning_path(instance.user, allow_create=False)
    except Exception as e:
        logger.debug(f"Skipped post_delete recalc for UserLessonProgress (user={instance.user_id}): {e}")


@receiver(post_delete, sender=UserSectionProgress)
def update_learning_path_on_section_progress_delete(sender, instance, **kwargs):
    """Update learning path when section progress is deleted.
    
    Uses allow_create=False to prevent creating new records during cascade
    deletion. See update_section_progress_on_lesson_progress_delete for details.
    """
    try:
        update_user_learning_path(instance.user, allow_create=False)
    except Exception as e:
        logger.debug(f"Skipped post_delete recalc for UserSectionProgress (user={instance.user_id}): {e}")
