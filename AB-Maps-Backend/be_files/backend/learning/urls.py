"""
URLs for the learning platform integrated with AB Maps.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserView, SectionViewSet, LessonProgressViewSet,
    SectionAdminViewSet, LessonAdminViewSet, AdminStatsViewSet,
    QuizSubmitView, QuizQuestionAdminViewSet, QuizAnswerAdminViewSet,
    UserProgressAdminViewSet, MeProgressViewSet, CampaignCompletionCheckView,
    MediaUploadView, MediaListView, MediaDeleteView
)

# Create routers
router = DefaultRouter()

# User endpoints
router.register(r"sections", SectionViewSet, basename="sections")
router.register(r"lessons", LessonProgressViewSet, basename="lessons")

# Admin endpoints
router.register(r"admin/sections", SectionAdminViewSet, basename="admin-sections")
router.register(r"admin/lessons", LessonAdminViewSet, basename="admin-lessons")
router.register(r"admin/stats", AdminStatsViewSet, basename="admin-stats")
router.register(r"admin/quiz-questions", QuizQuestionAdminViewSet, basename="admin-quiz-questions")
router.register(r"admin/quiz-answers", QuizAnswerAdminViewSet, basename="admin-quiz-answers")
router.register(r"admin/user-progress", UserProgressAdminViewSet, basename="admin-user-progress")

urlpatterns = [
    # Include router URLs
    path("", include(router.urls)),
    
    # User endpoints
    path("me/", UserView.as_view(), name="user-me"),
    path("me/progress/", include([
        path("", MeProgressViewSet.as_view({'get': 'list'}), name="user-progress"),
        path("detailed/", MeProgressViewSet.as_view({'get': 'detailed'}), name="user-progress-detailed"),
        path("current-path/", MeProgressViewSet.as_view({'get': 'current_learning_path'}), name="user-current-path"),
    ])),
    
    # Quiz submission
    path("lessons/<int:lesson_id>/quiz-submit/", QuizSubmitView.as_view(), name="quiz-submit"),
    
    # Campaign completion check
    path("campaign-completion-check/", CampaignCompletionCheckView.as_view(), name="campaign-completion-check"),
    
    # Media upload endpoints for rich text content
    path("media/", MediaListView.as_view(), name="media-list"),
    path("media/upload/", MediaUploadView.as_view(), name="media-upload"),
    path("media/<int:media_id>/", MediaDeleteView.as_view(), name="media-delete"),
]
