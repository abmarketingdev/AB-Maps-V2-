"""
URLs for the campaigns app.

Router registers list/detail at /api/campaigns/campaigns/...
We also expose /api/campaigns/<uuid>/ for campaign detail (PATCH/GET/PUT/DELETE) so
frontends can use a shorter path without the duplicate "campaigns" segment.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CampaignViewSet, CampaignFormViewSet, CampaignAreaViewSet, CampaignEmployeeViewSet

router = DefaultRouter()
router.register(r'campaigns', CampaignViewSet, basename='campaign')
router.register(r'campaign-forms', CampaignFormViewSet, basename='campaignform')
router.register(r'campaign-areas', CampaignAreaViewSet, basename='campaignarea')
router.register(r'campaign-employees', CampaignEmployeeViewSet, basename='campaignemployee')

campaign_detail = CampaignViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})

urlpatterns = [
    path('', include(router.urls)),
    path('<uuid:pk>/', campaign_detail, name='campaign-detail-short'),
] 