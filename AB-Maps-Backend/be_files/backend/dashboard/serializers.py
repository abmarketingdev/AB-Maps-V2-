"""
Serializers for the dashboard app.
"""
from rest_framework import serializers
from django.utils import timezone
from datetime import datetime, timedelta
from .models import Activity, Sales, PerformanceMetrics, DashboardSummary, TimeTracking
from users.serializers import EmployeeSerializer, ManagerSerializer
from campaigns.serializers import CampaignSerializer
from areas.serializers import AreaSerializer


class ActivitySerializer(serializers.ModelSerializer):
    """Serializer for Activity model."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignSerializer(read_only=True)
    area = AreaSerializer(read_only=True)
    
    employee_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    manager_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    campaign_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    area_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    
    created_at_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = [
            'id', 'employee', 'manager', 'campaign', 'area',
            'employee_id', 'manager_id', 'campaign_id', 'area_id',
            'activity_type', 'description', 'metadata',
            'created_at', 'created_at_formatted', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_created_at_formatted(self, obj):
        """Format created_at for display."""
        return obj.created_at.strftime('%d. %b %H:%M')
    
    def validate(self, data):
        """Validate that at least one user type is specified."""
        # The user ID is set automatically in perform_create, so we don't need to validate it here
        # The validation will be handled by the view's perform_create method
        return data


class SalesSerializer(serializers.ModelSerializer):
    """Serializer for Sales model."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignSerializer(read_only=True)
    area = AreaSerializer(read_only=True)
    
    employee_id = serializers.UUIDField(write_only=True)
    manager_id = serializers.UUIDField(write_only=True)
    campaign_id = serializers.UUIDField(write_only=True)
    area_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    
    created_at_formatted = serializers.SerializerMethodField()
    completed_at_formatted = serializers.SerializerMethodField()
    sale_date = serializers.DateField(required=False, allow_null=True)
    registration_date = serializers.SerializerMethodField()
    registration_date_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Sales
        fields = [
            'id', 'employee', 'manager', 'campaign', 'area',
            'employee_id', 'manager_id', 'campaign_id', 'area_id',
            'contact_name', 'contact_phone', 'contact_email',
            'status', 'outcome', 'value', 'commission',
            'notes', 'metadata',
            'created_at', 'created_at_formatted', 'updated_at',
            'completed_at', 'completed_at_formatted',
            'sale_date', 'registration_date', 'registration_date_formatted',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'completed_at', 'registration_date', 'registration_date_formatted']

    def get_registration_date(self, obj):
        """Date the sale was registered (sale_date if set, else created_at.date())."""
        return (obj.sale_date or (obj.created_at.date() if obj.created_at else None))

    def get_registration_date_formatted(self, obj):
        """Formatted registration date for display."""
        reg = obj.sale_date or (obj.created_at.date() if obj.created_at else None)
        if not reg:
            return None
        if obj.sale_date:
            return reg.strftime('%d. %b')
        return obj.created_at.strftime('%d. %b %H:%M')

    def get_created_at_formatted(self, obj):
        """Format created_at for display (legacy). Prefer registration_date_formatted for UI."""
        return obj.created_at.strftime('%d. %b %H:%M')
    
    def get_completed_at_formatted(self, obj):
        """Format completed_at for display."""
        if obj.completed_at:
            return obj.completed_at.strftime('%d. %b %H:%M')
        return None


class PerformanceMetricsSerializer(serializers.ModelSerializer):
    """Serializer for PerformanceMetrics model."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignSerializer(read_only=True)
    area = AreaSerializer(read_only=True)
    
    employee_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    manager_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    campaign_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    area_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    
    conversion_rate_percentage = serializers.SerializerMethodField()
    avg_call_duration_formatted = serializers.SerializerMethodField()
    total_work_time_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = PerformanceMetrics
        fields = [
            'id', 'date', 'hour', 'period_type',
            'employee', 'manager', 'campaign', 'area',
            'employee_id', 'manager_id', 'campaign_id', 'area_id',
            'total_calls', 'successful_calls', 'total_sales', 'total_value',
            'conversion_rate', 'conversion_rate_percentage',
            'avg_call_duration', 'avg_call_duration_formatted',
            'total_work_time', 'total_work_time_formatted',
            'callback_requests', 'no_answers', 'not_home',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_conversion_rate_percentage(self, obj):
        """Return conversion rate as percentage."""
        return f"{obj.conversion_rate:.1f}%"
    
    def get_avg_call_duration_formatted(self, obj):
        """Format average call duration."""
        if obj.avg_call_duration:
            minutes = obj.avg_call_duration // 60
            seconds = obj.avg_call_duration % 60
            return f"{minutes}m {seconds}s"
        return "0m 0s"
    
    def get_total_work_time_formatted(self, obj):
        """Format total work time."""
        if obj.total_work_time:
            hours = obj.total_work_time // 60
            minutes = obj.total_work_time % 60
            return f"{hours}t {minutes}m"
        return "0t 0m"


class DashboardSummarySerializer(serializers.ModelSerializer):
    """Serializer for DashboardSummary model."""
    manager = ManagerSerializer(read_only=True)
    employee = EmployeeSerializer(read_only=True)
    
    manager_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    employee_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    
    conversion_rate_percentage = serializers.SerializerMethodField()
    total_work_time_formatted = serializers.SerializerMethodField()
    total_break_time_formatted = serializers.SerializerMethodField()
    total_call_time_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = DashboardSummary
        fields = [
            'id', 'manager', 'employee', 'date',
            'manager_id', 'employee_id',
            'total_orders', 'total_calls', 'successful_calls', 'conversion_rate',
            'conversion_rate_percentage',
            'online_employees', 'total_employees', 'active_employees',
            'total_work_time', 'total_work_time_formatted',
            'total_break_time', 'total_break_time_formatted',
            'total_call_time', 'total_call_time_formatted',
            'active_campaigns', 'campaign_progress',
            'total_revenue', 'total_commission',
            'status_breakdown',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_conversion_rate_percentage(self, obj):
        """Return conversion rate as percentage."""
        return f"{obj.conversion_rate:.1f}%"
    
    def get_total_work_time_formatted(self, obj):
        """Format total work time."""
        if obj.total_work_time:
            hours = obj.total_work_time // 60
            minutes = obj.total_work_time % 60
            return f"{hours}t {minutes}m"
        return "0t 0m"
    
    def get_total_break_time_formatted(self, obj):
        """Format total break time."""
        if obj.total_break_time:
            hours = obj.total_break_time // 60
            minutes = obj.total_break_time % 60
            return f"{hours}t {minutes}m"
        return "0t 0m"
    
    def get_total_call_time_formatted(self, obj):
        """Format total call time."""
        if obj.total_call_time:
            hours = obj.total_call_time // 60
            minutes = obj.total_call_time % 60
            return f"{hours}t {minutes}m"
        return "0t 0m"


class TimeTrackingSerializer(serializers.ModelSerializer):
    """Serializer for TimeTracking model."""
    employee = EmployeeSerializer(read_only=True)
    employee_id = serializers.UUIDField(write_only=True)
    
    duration_formatted = serializers.SerializerMethodField()
    start_time_formatted = serializers.SerializerMethodField()
    end_time_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeTracking
        fields = [
            'id', 'employee', 'employee_id', 'status',
            'start_time', 'start_time_formatted',
            'end_time', 'end_time_formatted',
            'duration', 'duration_formatted',
            'notes', 'metadata',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'duration', 'created_at', 'updated_at']
    
    def get_duration_formatted(self, obj):
        """Format duration."""
        if obj.duration:
            hours = obj.duration // 60
            minutes = obj.duration % 60
            return f"{hours}t {minutes}m"
        return "0t 0m"
    
    def get_start_time_formatted(self, obj):
        """Format start time."""
        return obj.start_time.strftime('%d. %b %H:%M')
    
    def get_end_time_formatted(self, obj):
        """Format end time."""
        if obj.end_time:
            return obj.end_time.strftime('%d. %b %H:%M')
        return None


# Specialized serializers for dashboard data
class DashboardActivitySerializer(serializers.Serializer):
    """Serializer for dashboard activity data."""
    id = serializers.UUIDField()
    date = serializers.CharField()
    activity = serializers.CharField()
    campaign = serializers.CharField()
    name = serializers.CharField()
    mobile = serializers.CharField()
    outcome = serializers.CharField()
    employee_id = serializers.CharField()
    manager_id = serializers.CharField()


class DashboardSalesSerializer(serializers.Serializer):
    """Serializer for dashboard sales data."""
    id = serializers.UUIDField()
    campaign = serializers.CharField()
    time = serializers.CharField()
    contact = serializers.CharField()
    mobile = serializers.CharField()
    status = serializers.CharField()
    activity = serializers.CharField()


class DashboardPerformanceSerializer(serializers.Serializer):
    """Serializer for dashboard performance data."""
    name = serializers.CharField()
    calls = serializers.IntegerField()
    orders = serializers.IntegerField()


class DashboardCampaignSerializer(serializers.Serializer):
    """Serializer for dashboard campaign data."""
    name = serializers.CharField()
    value = serializers.IntegerField()


class DashboardConversionSerializer(serializers.Serializer):
    """Serializer for dashboard conversion data."""
    name = serializers.CharField()
    value = serializers.IntegerField()


class DashboardLeaderboardSerializer(serializers.Serializer):
    """Serializer for dashboard leaderboard data."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    avatar = serializers.CharField()
    initials = serializers.CharField()
    team = serializers.CharField()
    sales = serializers.IntegerField()
    target = serializers.IntegerField()
    conversion = serializers.IntegerField()
    avgValue = serializers.IntegerField()
    trend = serializers.CharField()


class DashboardSummaryDataSerializer(serializers.Serializer):
    """Serializer for dashboard summary data."""
    orders = serializers.IntegerField()
    total_calls = serializers.IntegerField()
    yes_responses = serializers.IntegerField()
    no_responses = serializers.IntegerField()
    callback_requests = serializers.IntegerField()
    active_campaign = serializers.CharField()
    online_employees = serializers.IntegerField()
    total_employees = serializers.IntegerField()
    total_work_time = serializers.CharField()
    total_break_time = serializers.CharField()
    total_call_time = serializers.CharField()


class FilteredSalesDataSerializer(serializers.Serializer):
    """Serializer for filtered sales data response."""
    id = serializers.CharField(help_text="Sales record ID")
    date = serializers.CharField(help_text="Formatted date (e.g., '10. Mar 23:35')")
    name = serializers.CharField(help_text="Contact name")
    email = serializers.CharField(help_text="Contact email or 'N/A' if not available")
    number = serializers.CharField(help_text="Contact phone number or 'N/A' if not available")
    status = serializers.CharField(help_text="Sales status in Norwegian")
    outcome = serializers.CharField(help_text="Sales outcome (Ja, Nei, Tilbakeringing, etc.)")
    value = serializers.FloatField(allow_null=True, help_text="Sale value")
    commission = serializers.FloatField(allow_null=True, help_text="Commission amount")
    notes = serializers.CharField(help_text="Additional notes")
    campaign = serializers.CharField(help_text="Campaign name")
    campaign_id = serializers.CharField(allow_null=True, help_text="Campaign ID")
    employee_name = serializers.CharField(help_text="Employee name")
    employee_id = serializers.CharField(allow_null=True, help_text="Employee ID")
    manager_name = serializers.CharField(help_text="Manager name")
    manager_id = serializers.CharField(allow_null=True, help_text="Manager ID")
    area_name = serializers.CharField(help_text="Area name")
    area_id = serializers.CharField(allow_null=True, help_text="Area ID")
    completed_at = serializers.CharField(allow_null=True, help_text="Completion date")
    metadata = serializers.DictField(help_text="Additional metadata")


class SalesPageSerializer(serializers.ModelSerializer):
    """Serializer for sales page data with gavebeløp annotation."""
    seller = serializers.SerializerMethodField()
    campaign_name = serializers.CharField(source="campaign.name")
    date = serializers.DateTimeField(source="created_at")
    gavebelop = serializers.FloatField(allow_null=True)

    class Meta:
        model = Activity
        fields = ["seller", "campaign_name", "date", "gavebelop"]

    def get_seller(self, obj):
        # prefer manager, otherwise employee
        if obj.manager is not None:
            return obj.manager.name
        if obj.employee is not None:
            return obj.employee.name
        return None


class FilteredSalesResponseSerializer(serializers.Serializer):
    """Serializer for filtered sales API response."""
    results = FilteredSalesDataSerializer(many=True)
    total_count = serializers.IntegerField(help_text="Total number of sales records")
    page = serializers.IntegerField(help_text="Current page number")
    page_size = serializers.IntegerField(help_text="Number of items per page")
    total_pages = serializers.IntegerField(help_text="Total number of pages") 


class AnalyticsThresholdSerializer(serializers.ModelSerializer):
    """
    Serializer for AnalyticsThreshold model.
    Used for CRUD operations on performance thresholds.
    """
    from users.models import Manager, Employee
    from campaigns.models import Campaign
    
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignSerializer(read_only=True)
    employee = EmployeeSerializer(read_only=True)
    
    manager_id = serializers.PrimaryKeyRelatedField(
        queryset=Manager.objects.all(),
        source='manager',
        write_only=True,
        required=False,
        allow_null=True,
    )
    campaign_id = serializers.PrimaryKeyRelatedField(
        queryset=Campaign.objects.all(),
        source='campaign',
        write_only=True,
        required=False,
        allow_null=True,
    )
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source='employee',
        write_only=True,
        required=False,
        allow_null=True,
    )
    
    class Meta:
        from .models import AnalyticsThreshold
        model = AnalyticsThreshold
        fields = [
            'id', 'scope', 'manager', 'manager_id', 'campaign', 'campaign_id',
            'employee', 'employee_id', 'min_doors_per_day', 'min_doors_per_week',
            'min_yes_rate_percent', 'max_no_rate_percent', 'min_contact_rate_percent',
            'consecutive_days_threshold', 'performance_drop_alert_percent',
            'max_inactive_hours', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ReportRequestSerializer(serializers.Serializer):
    """Validates parameters for analytics preview/download APIs."""
    start_date = serializers.DateField(required=True)
    end_date = serializers.DateField(required=True)
    campaign_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
    )
    employee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
    )
    manager_id = serializers.UUIDField(required=False, allow_null=True)
    
    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError({'end_date': 'End date must be on or after start date.'})
        delta = (data['end_date'] - data['start_date']).days
        if delta > 90:
            raise serializers.ValidationError({'end_date': 'Date range cannot exceed 90 days.'})
        return data


class AnalyticsPreviewSerializer(serializers.Serializer):
    """Read-only serializer for analytics preview endpoint."""
    period = serializers.DictField(read_only=True)
    summary = serializers.DictField(read_only=True)
    previous_period_summary = serializers.DictField(read_only=True)
    comparisons = serializers.DictField(read_only=True)
    campaigns = serializers.ListField(child=serializers.DictField(), read_only=True)
    employees = serializers.ListField(child=serializers.DictField(), read_only=True)
    daily_breakdown = serializers.ListField(child=serializers.DictField(), read_only=True)
    hourly_breakdown = serializers.ListField(child=serializers.DictField(), read_only=True)
    top_performers = serializers.DictField(read_only=True)
    alerts = serializers.ListField(child=serializers.DictField(), read_only=True)


class ManualTriggerReportSerializer(serializers.Serializer):
    """
    Serializer for manually triggering analytics reports.
    Requires at least one recipient email address.
    """
    recipient_emails = serializers.ListField(
        child=serializers.EmailField(),
        min_length=1,
        required=True,
        help_text="List of recipient email addresses (at least one required)",
    )
    
    def validate_recipient_emails(self, value):
        """Validate that all emails are unique."""
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Duplicate email addresses are not allowed.")
        return value 