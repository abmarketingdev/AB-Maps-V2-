"""
Admin interface for the dashboard app.
"""
from django.contrib import admin
from .models import (
    Activity, Sales, PerformanceMetrics, DashboardSummary,
    TimeTracking, AnalyticsThreshold, AnalyticsReport,
)


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    """Admin interface for Activity model."""
    list_display = ['activity_type', 'employee', 'manager', 'campaign', 'created_at']
    list_filter = ['activity_type', 'created_at', 'employee', 'manager', 'campaign']
    search_fields = ['description', 'employee__name', 'manager__name', 'campaign__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'activity_type', 'description')
        }),
        ('Relationships', {
            'fields': ('employee', 'manager', 'campaign', 'area')
        }),
        ('Metadata', {
            'fields': ('metadata',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Sales)
class SalesAdmin(admin.ModelAdmin):
    """Admin interface for Sales model."""
    list_display = ['contact_name', 'status', 'outcome', 'employee', 'campaign', 'created_at']
    list_filter = ['status', 'outcome', 'created_at', 'employee', 'manager', 'campaign']
    search_fields = ['contact_name', 'contact_phone', 'contact_email', 'notes']
    readonly_fields = ['id', 'created_at', 'updated_at', 'completed_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'contact_name', 'contact_phone', 'contact_email')
        }),
        ('Sales Details', {
            'fields': ('status', 'outcome', 'value', 'commission')
        }),
        ('Relationships', {
            'fields': ('employee', 'manager', 'campaign', 'area')
        }),
        ('Additional Information', {
            'fields': ('notes', 'metadata')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PerformanceMetrics)
class PerformanceMetricsAdmin(admin.ModelAdmin):
    """Admin interface for PerformanceMetrics model."""
    list_display = ['date', 'period_type', 'employee', 'manager', 'total_calls', 'conversion_rate']
    list_filter = ['period_type', 'date', 'employee', 'manager', 'campaign']
    search_fields = ['employee__name', 'manager__name', 'campaign__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    date_hierarchy = 'date'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'date', 'hour', 'period_type')
        }),
        ('Scope', {
            'fields': ('employee', 'manager', 'campaign', 'area')
        }),
        ('Metrics', {
            'fields': (
                'total_calls', 'successful_calls', 'total_sales', 'total_value',
                'conversion_rate', 'avg_call_duration', 'total_work_time'
            )
        }),
        ('Additional Metrics', {
            'fields': ('callback_requests', 'no_answers', 'not_home')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(DashboardSummary)
class DashboardSummaryAdmin(admin.ModelAdmin):
    """Admin interface for DashboardSummary model."""
    list_display = ['date', 'manager', 'employee', 'total_orders', 'online_employees', 'total_employees']
    list_filter = ['date', 'manager', 'employee']
    search_fields = ['manager__name', 'employee__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    date_hierarchy = 'date'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'date', 'manager', 'employee')
        }),
        ('Summary Metrics', {
            'fields': ('total_orders', 'total_calls', 'successful_calls', 'conversion_rate')
        }),
        ('Employee Metrics', {
            'fields': ('online_employees', 'total_employees', 'active_employees')
        }),
        ('Time Metrics', {
            'fields': ('total_work_time', 'total_break_time', 'total_call_time')
        }),
        ('Campaign & Financial', {
            'fields': ('active_campaigns', 'campaign_progress', 'total_revenue', 'total_commission')
        }),
        ('Status Breakdown', {
            'fields': ('status_breakdown',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(AnalyticsThreshold)
class AnalyticsThresholdAdmin(admin.ModelAdmin):
    """Admin interface for AnalyticsThreshold model."""
    list_display = [
        'scope', 'get_target_name', 'min_doors_per_day',
        'min_yes_rate_percent', 'max_no_rate_percent',
        'consecutive_days_threshold', 'is_active', 'updated_at',
    ]
    list_filter = ['scope', 'is_active']
    search_fields = [
        'manager__name', 'campaign__name', 'employee__name',
    ]
    readonly_fields = ['id', 'created_at', 'updated_at']
    list_editable = ['is_active']

    fieldsets = (
        ('Scope', {
            'fields': ('id', 'scope', 'manager', 'campaign', 'employee'),
            'description': (
                'Choose who this threshold applies to. '
                'For "global" leave manager/campaign/employee empty.'
            ),
        }),
        ('Activity Thresholds (Quantity)', {
            'fields': ('min_doors_per_day', 'min_doors_per_week'),
        }),
        ('Quality Thresholds (Percentages)', {
            'fields': (
                'min_yes_rate_percent',
                'max_no_rate_percent',
                'min_contact_rate_percent',
            ),
        }),
        ('Trend & Alert Thresholds', {
            'fields': (
                'consecutive_days_threshold',
                'performance_drop_alert_percent',
                'max_inactive_hours',
            ),
        }),
        ('Status', {
            'fields': ('is_active',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Target')
    def get_target_name(self, obj):
        if obj.scope == 'global':
            return 'All Users'
        if obj.scope == 'manager' and obj.manager:
            return obj.manager.name
        if obj.scope == 'campaign' and obj.campaign:
            return obj.campaign.name
        if obj.scope == 'employee' and obj.employee:
            return obj.employee.name
        return '-'


@admin.register(AnalyticsReport)
class AnalyticsReportAdmin(admin.ModelAdmin):
    """Admin interface for AnalyticsReport model."""
    list_display = [
        'start_date', 'end_date', 'source', 'status',
        'recipient_email', 'total_doors', 'alerts_count',
        'sent_at', 'created_at',
    ]
    list_filter = ['source', 'status', 'start_date', 'end_date', 'sent_at']
    search_fields = ['recipient_email', 'email_subject', 'error_message']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'execution_time_seconds',
        'pdf_size_bytes', 'total_doors', 'unique_workers',
        'alerts_count', 'critical_alerts_count',
    ]
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Report Period', {
            'fields': ('id', 'start_date', 'end_date')
        }),
        ('Source & Status', {
            'fields': ('source', 'status', 'retry_count')
        }),
        ('Email Details', {
            'fields': ('recipient_email', 'email_subject', 'sent_at')
        }),
        ('Report Metrics', {
            'fields': (
                'total_doors', 'unique_workers',
                'alerts_count', 'critical_alerts_count',
            )
        }),
        ('Execution Details', {
            'fields': ('execution_time_seconds', 'pdf_size_bytes'),
            'classes': ('collapse',)
        }),
        ('Error Tracking', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TimeTracking)
class TimeTrackingAdmin(admin.ModelAdmin):
    """Admin interface for TimeTracking model."""
    list_display = ['employee', 'status', 'start_time', 'end_time', 'duration']
    list_filter = ['status', 'start_time', 'employee']
    search_fields = ['employee__name', 'notes']
    readonly_fields = ['id', 'duration', 'created_at', 'updated_at']
    date_hierarchy = 'start_time'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'employee', 'status')
        }),
        ('Time Information', {
            'fields': ('start_time', 'end_time', 'duration')
        }),
        ('Additional Information', {
            'fields': ('notes', 'metadata')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
