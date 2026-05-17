"""
URLs for the dashboard app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ActivityViewSet, SalesViewSet, PerformanceMetricsViewSet,
    DashboardSummaryViewSet, TimeTrackingViewSet, DashboardLeaderboardViewSet,
    ActivityReportView, ActivityExportView, CampaignResponseComparisonView,
    UserReportView, TableDataView, TableDataAddressesView, SalesPageView,
    DashboardStatsView, DashboardTrendsView, DashboardFollowUpsView, DashboardRecentActivitiesView
)
from .views_analytics import (
    AnalyticsThresholdViewSet,
    PreviewAnalyticsAPIView,
    DownloadReportAPIView,
    ManualTriggerReportAPIView,
    WorkTimeStatsAPIView,
)

# Create routers
router = DefaultRouter()
router.register(r'activities', ActivityViewSet, basename='activity')
router.register(r'sales', SalesViewSet, basename='sales')
router.register(r'performance', PerformanceMetricsViewSet, basename='performance')
router.register(r'summaries', DashboardSummaryViewSet, basename='summary')
router.register(r'time-tracking', TimeTrackingViewSet, basename='timetracking')
router.register(r'leaderboard', DashboardLeaderboardViewSet, basename='leaderboard')
router.register(r'analytics/thresholds', AnalyticsThresholdViewSet, basename='analytics-threshold')

urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    
    # Activity reporting and export endpoints
    path('activity/report/', ActivityReportView.as_view(), name='activity-report'),
    path('activity/export/', ActivityExportView.as_view(), name='activity-export'),
    path('activity/compare_responses/', CampaignResponseComparisonView.as_view(), name='activity-compare-responses'),
    
    # New refactored endpoints
    path('activity/user-report/', UserReportView.as_view(), name='user-report'),
    path('activity/table-data/', TableDataView.as_view(), name='table-data'),
    path('activity/table-data/addresses/', TableDataAddressesView.as_view(), name='table-data-addresses'),
    
    # Sales page endpoint
    path('sales-page/', SalesPageView.as_view(), name='sales-page'),
    
    # New dashboard-specific endpoints
    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('trends/', DashboardTrendsView.as_view(), name='dashboard-trends'),
    path('follow-ups/', DashboardFollowUpsView.as_view(), name='dashboard-follow-ups'),
    path('recent-activities/', DashboardRecentActivitiesView.as_view(), name='dashboard-recent-activities'),

    # ─── Analytics / Weekly Report System ────────────────────────────────
    path('analytics/preview/', PreviewAnalyticsAPIView.as_view(), name='analytics-preview'),
    path('analytics/download/', DownloadReportAPIView.as_view(), name='analytics-download'),
    path('analytics/trigger/', ManualTriggerReportAPIView.as_view(), name='analytics-trigger'),
    path('analytics/work-time-stats/', WorkTimeStatsAPIView.as_view(), name='analytics-work-time-stats'),
] 