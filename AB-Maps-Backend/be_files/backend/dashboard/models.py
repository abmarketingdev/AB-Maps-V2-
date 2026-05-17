"""
Models for the dashboard app.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from users.models import Manager, Employee
from campaigns.models import Campaign
from areas.models import Area
from addresses.models import Address

User = get_user_model()


class Activity(models.Model):
    """
    Model to track user activities for dashboard analytics.
    """
    ACTIVITY_TYPES = [
        ('address_contact', 'Address Contact'),
        ('location_update', 'Location Update'),
        ('area_assignment', 'Area Assignment'),
        ('status_change', 'Status Change'),
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('campaign_start', 'Campaign Start'),
        ('campaign_end', 'Campaign End'),
        ('vipps_contact', 'VIPPS Contact'),
        ('avtalegiro_contact', 'Avtalegiro Contact'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    manager = models.ForeignKey(Manager, on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    area = models.ForeignKey(Area, on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)  # Store additional data
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Activities'
        indexes = [
            models.Index(fields=['activity_type', 'created_at']),
            models.Index(fields=['employee', 'created_at']),
            models.Index(fields=['manager', 'created_at']),
            models.Index(fields=['campaign', 'created_at']),
        ]

    def __str__(self):
        return f"{self.activity_type} - {self.employee or self.manager} - {self.created_at}"


class Sales(models.Model):
    """
    Model to track sales interactions and outcomes.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('callback', 'Callback Requested'),
        ('no_answer', 'No Answer'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='sales')
    manager = models.ForeignKey(Manager, on_delete=models.CASCADE, related_name='sales')
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='sales')
    area = models.ForeignKey(Area, on_delete=models.CASCADE, null=True, blank=True, related_name='sales')
    
    contact_name = models.CharField(max_length=255)
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    outcome = models.CharField(max_length=100, blank=True)  # "Ja", "Nei", "Tilbakeringing", etc.
    
    value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    commission = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    sale_date = models.DateField(
        null=True,
        blank=True,
        help_text="Registration date of the sale (when the sale was made). Used for display and date filtering; if null, created_at is used.",
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Sales'
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['employee', 'created_at']),
            models.Index(fields=['campaign', 'created_at']),
            models.Index(fields=['outcome', 'created_at']),
        ]

    def __str__(self):
        return f"{self.contact_name} - {self.status} - {self.created_at}"

    def save(self, *args, **kwargs):
        if self.status == 'completed' and not self.completed_at:
            self.completed_at = timezone.now()
        super().save(*args, **kwargs)


class PerformanceMetrics(models.Model):
    """
    Model to store calculated performance metrics for caching and reporting.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Time period
    date = models.DateField()
    hour = models.IntegerField(null=True, blank=True)  # For hourly metrics
    period_type = models.CharField(max_length=20, choices=[
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ])
    
    # Scope
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True, related_name='performance_metrics')
    manager = models.ForeignKey(Manager, on_delete=models.CASCADE, null=True, blank=True, related_name='performance_metrics')
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True, related_name='performance_metrics')
    area = models.ForeignKey(Area, on_delete=models.CASCADE, null=True, blank=True, related_name='performance_metrics')
    
    # Metrics
    total_calls = models.IntegerField(default=0)
    successful_calls = models.IntegerField(default=0)
    total_sales = models.IntegerField(default=0)
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    conversion_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    avg_call_duration = models.IntegerField(default=0)  # in seconds
    total_work_time = models.IntegerField(default=0)  # in minutes
    
    # Additional metrics
    callback_requests = models.IntegerField(default=0)
    no_answers = models.IntegerField(default=0)
    not_home = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-hour']
        verbose_name_plural = 'Performance Metrics'
        unique_together = ['date', 'hour', 'period_type', 'employee', 'manager', 'campaign', 'area']
        indexes = [
            models.Index(fields=['date', 'period_type']),
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['campaign', 'date']),
            models.Index(fields=['area', 'date']),
        ]

    def __str__(self):
        scope = f"{self.employee or self.manager or self.campaign or self.area or 'All'}"
        return f"{scope} - {self.date} - {self.period_type}"


class DashboardSummary(models.Model):
    """
    Model to store dashboard summary data for quick access.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Scope
    manager = models.ForeignKey(Manager, on_delete=models.CASCADE, null=True, blank=True, related_name='dashboard_summaries')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True, related_name='dashboard_summaries')
    
    # Date
    date = models.DateField()
    
    # Summary metrics
    total_orders = models.IntegerField(default=0)
    total_calls = models.IntegerField(default=0)
    successful_calls = models.IntegerField(default=0)
    conversion_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Employee metrics
    online_employees = models.IntegerField(default=0)
    total_employees = models.IntegerField(default=0)
    active_employees = models.IntegerField(default=0)
    
    # Time metrics
    total_work_time = models.IntegerField(default=0)  # in minutes
    total_break_time = models.IntegerField(default=0)  # in minutes
    total_call_time = models.IntegerField(default=0)  # in minutes
    
    # Campaign metrics
    active_campaigns = models.IntegerField(default=0)
    campaign_progress = models.JSONField(default=dict, blank=True)  # Store campaign-specific progress
    
    # Financial metrics
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Status breakdown
    status_breakdown = models.JSONField(default=dict, blank=True)  # Store status counts
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name_plural = 'Dashboard Summaries'
        unique_together = ['date', 'manager', 'employee']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['manager', 'date']),
            models.Index(fields=['employee', 'date']),
        ]

    def __str__(self):
        scope = f"{self.manager or self.employee or 'System'}"
        return f"{scope} - {self.date}"


class AnalyticsThreshold(models.Model):
    """
    Admin-configurable performance thresholds for analytics alerts.
    
    Thresholds define "red lines" — minimum acceptable performance levels.
    When an employee/campaign/team falls below a threshold for a configurable
    number of consecutive days, an alert is triggered in the weekly report.
    
    Threshold Hierarchy (highest priority first):
        1. Employee-specific
        2. Campaign-specific
        3. Manager-specific (team-level)
        4. Global default
    """
    SCOPE_CHOICES = [
        ('global', 'Global - All Users'),
        ('manager', 'Manager-Specific'),
        ('campaign', 'Campaign-Specific'),
        ('employee', 'Employee-Specific'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # --- Scope: who does this threshold apply to? ---
    scope = models.CharField(
        max_length=20,
        choices=SCOPE_CHOICES,
        default='global',
        help_text="Who this threshold applies to"
    )
    manager = models.ForeignKey(
        Manager,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='analytics_thresholds',
        help_text="Required when scope is 'manager'"
    )
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='analytics_thresholds',
        help_text="Required when scope is 'campaign'"
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='analytics_thresholds',
        help_text="Required when scope is 'employee'"
    )

    # --- Activity Thresholds (Quantity) ---
    min_doors_per_day = models.IntegerField(
        default=70,
        help_text="Minimum doors an employee should knock per day"
    )
    min_doors_per_week = models.IntegerField(
        default=350,
        help_text="Minimum doors per week (e.g. 70 * 5 working days)"
    )

    # --- Quality Thresholds (Percentages stored as 0-100) ---
    min_yes_rate_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=30.00,
        help_text="Minimum acceptable yes-rate percentage (e.g. 30.00 = 30%)"
    )
    max_no_rate_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=50.00,
        help_text="Maximum acceptable rejection rate (e.g. 50.00 = 50%)"
    )
    min_contact_rate_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=60.00,
        help_text="Minimum contact rate — doors where someone answered"
    )

    # --- Trend Thresholds ---
    consecutive_days_threshold = models.IntegerField(
        default=3,
        help_text="Consecutive poor days before a CRITICAL alert fires"
    )
    performance_drop_alert_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=20.00,
        help_text="Alert if performance drops by this % vs rolling average"
    )

    # --- Activity Monitoring ---
    max_inactive_hours = models.IntegerField(
        default=4,
        help_text="Alert if no door activity for this many hours during a work day"
    )

    # --- Meta ---
    is_active = models.BooleanField(
        default=True,
        help_text="Only active thresholds are evaluated"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Analytics Threshold'
        verbose_name_plural = 'Analytics Thresholds'
        indexes = [
            models.Index(fields=['scope', 'is_active']),
        ]

    def clean(self):
        """Validate scope / FK consistency."""
        from django.core.exceptions import ValidationError
        errors = {}
        if self.scope == 'manager' and not self.manager:
            errors['manager'] = 'Manager is required when scope is manager-specific.'
        if self.scope == 'campaign' and not self.campaign:
            errors['campaign'] = 'Campaign is required when scope is campaign-specific.'
        if self.scope == 'employee' and not self.employee:
            errors['employee'] = 'Employee is required when scope is employee-specific.'
        if self.scope == 'global':
            # Only one active global threshold allowed
            qs = AnalyticsThreshold.objects.filter(scope='global', is_active=True)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors['scope'] = 'Only one active global threshold is allowed.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        if self.scope == 'global':
            return 'Global Threshold'
        if self.scope == 'manager' and self.manager:
            return f'Threshold – Manager: {self.manager.name}'
        if self.scope == 'campaign' and self.campaign:
            return f'Threshold – Campaign: {self.campaign.name}'
        if self.scope == 'employee' and self.employee:
            return f'Threshold – Employee: {self.employee.name}'
        return f'Threshold ({self.scope})'


class AnalyticsReport(models.Model):
    """
    Track all sent analytics reports (both manual and cron-triggered).
    Provides audit trail and prevents duplicate sends.
    """
    REPORT_SOURCE_CHOICES = [
        ('manual', 'Manually Triggered'),
        ('cron', 'Automated Cron Job'),
    ]
    
    STATUS_CHOICES = [
        ('success', 'Successfully Sent'),
        ('failed', 'Failed to Send'),
        ('partial', 'Partially Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Report period
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Source & status
    source = models.CharField(max_length=10, choices=REPORT_SOURCE_CHOICES, default='cron')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='success')
    
    # Email details
    recipient_email = models.CharField(
        max_length=500,
        help_text="Comma-separated list of recipient email addresses"
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    email_subject = models.CharField(max_length=255, blank=True)
    
    # Report metrics (snapshot at time of generation)
    total_doors = models.IntegerField(default=0)
    unique_workers = models.IntegerField(default=0)
    alerts_count = models.IntegerField(default=0)
    critical_alerts_count = models.IntegerField(default=0)
    
    # Error tracking
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    
    # Metadata
    execution_time_seconds = models.FloatField(null=True, blank=True)
    pdf_size_bytes = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'analytics_report'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['source', 'status']),
            models.Index(fields=['sent_at']),
        ]
        verbose_name = 'Analytics Report'
        verbose_name_plural = 'Analytics Reports'
    
    def __str__(self):
        return f"Report {self.start_date} to {self.end_date} ({self.source}) - {self.status}"


class TimeTracking(models.Model):
    """
    Model to track employee work time and activities.
    """
    STATUS_CHOICES = [
        ('ready', 'Ready'),
        ('break', 'Break'),
        ('call', 'On Call'),
        ('after_work', 'After Work'),
        ('offline', 'Offline'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='time_tracking')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.IntegerField(default=0)  # in minutes
    
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_time']
        verbose_name_plural = 'Time Tracking'
        indexes = [
            models.Index(fields=['employee', 'start_time']),
            models.Index(fields=['status', 'start_time']),
        ]

    def __str__(self):
        return f"{self.employee} - {self.status} - {self.start_time}"

    def save(self, *args, **kwargs):
        if self.end_time and self.start_time:
            duration = (self.end_time - self.start_time).total_seconds() / 60
            self.duration = int(duration)
        super().save(*args, **kwargs)
