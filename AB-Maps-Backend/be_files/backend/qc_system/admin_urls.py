"""
Admin-only QC API routes (mounted at /api/admin/).
"""
from django.urls import path

from qc_system.admin_analytics import admin_analytics_daily_view

urlpatterns = [
    path('analytics/daily/', admin_analytics_daily_view, name='qc-admin-analytics-daily'),
]
