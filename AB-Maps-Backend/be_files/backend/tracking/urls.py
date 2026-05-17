"""
URLs for the tracking app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LocationPingViewSet, SyncQueueItemViewSet, WorkSessionViewSet

router = DefaultRouter()
router.register(r'locations', LocationPingViewSet, basename='locationping')
router.register(r'queue', SyncQueueItemViewSet, basename='syncqueueitem')
router.register(r'work-sessions', WorkSessionViewSet, basename='worksession')

urlpatterns = [
    path('', include(router.urls)),
] 