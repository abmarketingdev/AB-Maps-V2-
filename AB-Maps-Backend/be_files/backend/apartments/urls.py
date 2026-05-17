"""
URL configuration for apartments app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ApartmentViewSet,
    LocalApartmentsLookupView,
    BuildingLocalApartmentsMatchView,
    LocalApartmentsBuildingMatchView,
    GeometryComparisonView
)

# Create router and register viewset
router = DefaultRouter()
router.register(r'apartments', ApartmentViewSet, basename='apartment')

urlpatterns = [
    # Custom endpoints must come BEFORE router to avoid conflicts
    path('apartments/local-lookup/', LocalApartmentsLookupView.as_view(), name='apartments-local-lookup'),
    path('apartments/building-local-match/', BuildingLocalApartmentsMatchView.as_view(), name='apartments-building-local-match'),
    path('apartments/local-building-match/', LocalApartmentsBuildingMatchView.as_view(), name='apartments-local-building-match'),
    path('apartments/geometry-comparison/', GeometryComparisonView.as_view(), name='apartments-geometry-comparison'),
    # Router URLs come after
    path('', include(router.urls)),
]

