"""
URL configuration for buildings app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BuildingViewSet

# Create router and register viewset
router = DefaultRouter()
router.register(r'buildings', BuildingViewSet, basename='building')

urlpatterns = [
    path('', include(router.urls)),
]

