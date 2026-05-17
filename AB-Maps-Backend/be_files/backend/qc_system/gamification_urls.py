from django.urls import path

from qc_system.gamification_views import (
    gamification_leaderboard,
    gamification_me,
    gamification_xp_event,
)

urlpatterns = [
    path('me', gamification_me, name='gamification-me'),
    path('xp-event', gamification_xp_event, name='gamification-xp-event'),
    path('leaderboard', gamification_leaderboard, name='gamification-leaderboard'),
]

