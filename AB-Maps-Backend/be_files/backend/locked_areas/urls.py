"""
URL patterns for the locked_areas app.
"""
from django.urls import path
from . import views

app_name = 'locked_areas'

urlpatterns = [
    # Admin areas (available areas to lock) - NO PAGINATION
    path('admin-areas/', views.AdminAreasListView.as_view(), name='admin-areas-list'),
    
    # Simplified hierarchical structure - NO PAGINATION
    path('hierarchy/', views.simplified_hierarchy, name='simplified-hierarchy'),
    
    # Campaign-specific locked areas - NO PAGINATION
    path('campaigns/<uuid:campaign_id>/locked-areas/', 
         views.LockedAreasListView.as_view(), name='locked-areas-list'),
    path('campaigns/<uuid:campaign_id>/locked-areas/<uuid:pk>/', 
         views.LockedAreaDetailView.as_view(), name='locked-area-detail'),
    
    # Hierarchical view - NO PAGINATION
    path('campaigns/<uuid:campaign_id>/hierarchical-areas/', 
         views.hierarchical_areas, name='hierarchical-areas'),
    
    # Available areas (not locked) - NO PAGINATION
    path('campaigns/<uuid:campaign_id>/available-areas/', 
         views.available_areas, name='available-areas'),
    
    # Bulk operations
    path('campaigns/<uuid:campaign_id>/bulk-lock/', 
         views.bulk_lock_areas, name='bulk-lock-areas'),
    path('campaigns/<uuid:campaign_id>/bulk-unlock/', 
         views.bulk_unlock_areas, name='bulk-unlock-areas'),
    
    # Statistics
    path('campaigns/<uuid:campaign_id>/statistics/', 
         views.area_statistics, name='area-statistics'),
    
    # Spatial queries - NO PAGINATION
    path('campaigns/<uuid:campaign_id>/spatial-query/', 
         views.spatial_query, name='spatial-query'),
    
    # Map areas endpoint - NO PAGINATION
    path('campaigns/<uuid:campaign_id>/map-areas/', 
         views.campaign_locked_areas_map, name='campaign-locked-areas-map'),
    
    # Age statistics endpoint
    path('age-stats/', views.locked_areas_age_stats, name='locked-areas-age-stats'),
    
    # Grunnkrets statistics API (for map click popups)
    path('grunnkrets/<str:code>/stats/', 
         views.GrunnkretsStatsView.as_view(), name='grunnkrets-stats'),
]
