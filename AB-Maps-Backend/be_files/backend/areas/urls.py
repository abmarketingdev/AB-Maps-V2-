"""
URLs for the areas app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AreaViewSet, AreaEmployeeViewSet
from locked_areas.views import GrunnkretsStatsView

router = DefaultRouter()
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'area-employees', AreaEmployeeViewSet, basename='areaemployee')

urlpatterns = [
    path('', include(router.urls)),
    # Grunnkrets statistics API (for map click popups)
    path('grunnkrets/<str:code>/stats/', 
         GrunnkretsStatsView.as_view(), name='grunnkrets-stats'),
] 