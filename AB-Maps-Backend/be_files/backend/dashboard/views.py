"""
Views for the dashboard app.
"""
import logging
import csv
import io
from collections import Counter
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Q, Count, Sum, Avg, F, FloatField, Subquery, OuterRef
from django.db.models.functions import TruncHour, TruncDay, TruncWeek, TruncMonth
from django.http import StreamingHttpResponse
from datetime import datetime, timedelta
from uuid import UUID
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample, OpenApiResponse
import traceback

logger = logging.getLogger(__name__)

from .models import Activity, Sales, PerformanceMetrics, DashboardSummary, TimeTracking
from .serializers import (
    ActivitySerializer, SalesSerializer, PerformanceMetricsSerializer,
    DashboardSummarySerializer, TimeTrackingSerializer,
    DashboardActivitySerializer, DashboardSalesSerializer,
    DashboardPerformanceSerializer, DashboardCampaignSerializer,
    DashboardConversionSerializer, DashboardLeaderboardSerializer,
    DashboardSummaryDataSerializer, FilteredSalesResponseSerializer,
    SalesPageSerializer
)
from users.models import Employee, Manager
from campaigns.models import Campaign
from areas.models import Area
from addresses.models import Address
from campaigns.models import CampaignForm


class DashboardPermission(permissions.BasePermission):
    """Custom permission for dashboard access."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Super users can access all dashboard data (like managers)
        if request.user.is_superuser:
            return True
        
        # Managers can access all dashboard data
        if hasattr(request.user, 'manager') and request.user.manager:
            return True
        
        # Employees can access their own dashboard data
        if hasattr(request.user, 'employee') and request.user.employee:
            return True
        
        return False


class ActivityViewSet(viewsets.ModelViewSet):
    """ViewSet for Activity model."""
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['activity_type', 'employee', 'manager', 'campaign', 'area']
    search_fields = ['description']
    ordering_fields = ['created_at', 'activity_type']
    ordering = ['-created_at']
    
    @extend_schema(
        summary="Create a new activity",
        description="Create a new activity record. The employee or manager will be automatically set based on the authenticated user.",
        request=ActivitySerializer,
        responses={
            201: ActivitySerializer,
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden"
        },
        examples=[
            OpenApiExample(
                'VIPPS Contact Example',
                value={
                    'activity_type': 'vipps_contact',
                    'description': 'VIPPS payment processed for donation',
                    'campaign_id': '171e49f0-ea24-4888-9493-3a53f09cb36b',
                    'metadata': {
                        'amount': 500.00,
                        'transaction_id': 'VIPPS123456',
                        'status': 'completed'
                    }
                },
                request_only=True
            ),
            OpenApiExample(
                'Avtalegiro Contact Example',
                value={
                    'activity_type': 'avtalegiro_contact',
                    'description': 'Avtalegiro agreement signed',
                    'campaign_id': '171e49f0-ea24-4888-9493-3a53f09cb36b',
                    'metadata': {
                        'agreement_id': 'AG123456',
                        'monthly_amount': 250.00,
                        'start_date': '2024-01-15'
                    }
                },
                request_only=True
            )
        ]
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all activities (like managers)
            return Activity.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see all activities
            return Activity.objects.all()
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see their own activities
            return Activity.objects.filter(employee=user.employee)
        
        return Activity.objects.none()
    
    def perform_create(self, serializer):
        """Set the user when creating an activity."""
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            serializer.save(employee=user.employee)
        elif hasattr(user, 'manager') and user.manager:
            serializer.save(manager=user.manager)
        elif user.is_superuser:
            # For super users, we need to create a temporary manager record or handle differently
            # For now, we'll save without manager/employee (they can see all data anyway)
            serializer.save()
    
    @extend_schema(
        description="Get activities formatted for dashboard display",
        responses={200: DashboardActivitySerializer(many=True)},
        parameters=[
            OpenApiParameter(name='days', type=int, description='Number of days to look back', default=7),
            OpenApiParameter(
                name='activity_type', 
                type=str, 
                description='Filter by activity type',
                enum=['address_contact', 'location_update', 'area_assignment', 'status_change', 'login', 'logout', 'campaign_start', 'campaign_end', 'vipps_contact', 'avtalegiro_contact']
            ),
        ]
    )
    @action(detail=False, methods=['get'])
    def dashboard_data(self, request):
        """Get activities formatted for dashboard display."""
        days = int(request.query_params.get('days', 7))
        activity_type = request.query_params.get('activity_type')
        
        start_date = timezone.now() - timedelta(days=days)
        queryset = self.get_queryset().filter(created_at__gte=start_date)
        
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        
        # Transform to dashboard format
        activities = []
        for activity in queryset[:50]:  # Limit to 50 most recent
            activities.append({
                'id': activity.id,
                'date': activity.created_at.strftime('%d. %b %H:%M'),
                'activity': activity.get_activity_type_display(),
                'campaign': activity.campaign.name if activity.campaign else 'N/A',
                'name': activity.employee.name if activity.employee else activity.manager.name if activity.manager else 'Unknown',
                'mobile': activity.metadata.get('phone', 'N/A'),
                'outcome': activity.metadata.get('outcome', 'N/A'),
                'employee_id': str(activity.employee.id) if activity.employee else '',
                'manager_id': str(activity.manager.id) if activity.manager else '',
            })
        
        serializer = DashboardActivitySerializer(activities, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        summary="Get filtered activities data for manager dashboard",
        description="Returns activities data filtered by campaign and optional date range with specific columns: Date, Name, Mobile, Outcome, Status. If no dates provided, returns all data for the campaign.",
        responses={200: DashboardActivitySerializer(many=True)},
        parameters=[
            OpenApiParameter(name='campaign_id', type=str, required=True, description='Campaign ID to filter by'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date (YYYY-MM-DD). If not provided, no date filtering is applied.'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date (YYYY-MM-DD). If not provided, no date filtering is applied.'),
            OpenApiParameter(name='status', type=str, required=False, description='Filter by status (can be comma-separated)'),
            OpenApiParameter(name='search', type=str, required=False, description='Search in description or metadata'),
            OpenApiParameter(name='page', type=int, required=False, description='Page number', default=1),
            OpenApiParameter(name='page_size', type=int, required=False, description='Items per page', default=50),
        ]
    )
    @action(detail=False, methods=['get'], url_path='filtered')
    def filtered_activities(self, request):
        """Get filtered activities data for manager dashboard."""
        campaign_id = request.query_params.get('campaign_id')
        if not campaign_id:
            return Response({'error': 'campaign_id is required'}, status=400)
        
        try:
            campaign_uuid = UUID(campaign_id)
        except ValueError:
            return Response({'error': 'Invalid campaign_id format'}, status=400)
        
        # Get base queryset filtered by campaign and activity type
        queryset = self.get_queryset().filter(
            campaign_id=campaign_uuid,
            activity_type='address_contact'  # Only address contact activities
        )
        
        # Date filtering (optional)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date and end_date:
            try:
                start_datetime = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
                end_datetime = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
                queryset = queryset.filter(created_at__range=(start_datetime, end_datetime))
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
        elif start_date or end_date:
            return Response({'error': 'Both start_date and end_date must be provided together, or neither'}, status=400)
        
        # Status filtering (from metadata)
        status_filter = request.query_params.get('status')
        if status_filter:
            status_list = [s.strip() for s in status_filter.split(',')]
            queryset = queryset.filter(metadata__status__in=status_list)
        
        # Search filtering
        search_term = request.query_params.get('search')
        if search_term:
            queryset = queryset.filter(
                Q(description__icontains=search_term) |
                Q(metadata__address_text__icontains=search_term) |
                Q(employee__name__icontains=search_term) |
                Q(manager__name__icontains=search_term)
            )
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        
        # Calculate pagination
        total_count = queryset.count()
        total_pages = (total_count + page_size - 1) // page_size
        
        # Apply pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        activities_page = queryset[start_index:end_index]
        
        # Transform to dashboard format
        activities = []
        for activity in activities_page:
            activities.append({
                'id': activity.id,
                'date': activity.created_at.strftime('%d. %b %H:%M'),
                'activity': activity.get_activity_type_display(),
                'campaign': activity.campaign.name if activity.campaign else 'N/A',
                'name': activity.employee.name if activity.employee else activity.manager.name if activity.manager else 'Unknown',
                'mobile': activity.metadata.get('phone', 'N/A'),
                'outcome': activity.metadata.get('status', 'N/A'),
                'employee_id': str(activity.employee.id) if activity.employee else '',
                'manager_id': str(activity.manager.id) if activity.manager else '',
            })
        
        return Response({
            'results': activities,
            'total_count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages
        })

    @extend_schema(
        summary="Get comprehensive summary of address activities with performance metrics",
        description="Returns detailed metrics for address_contact activities including total counts, status breakdown, hit rates, conversion rates, and performance indicators. Supports filtering by campaign, status, manager, employee, and date range.",
        responses={200: OpenApiExample(
            'Summary Example',
            value={
                'total': 123,
                'by_status': {'Ja': 50, 'Ikke Hjem': 40, 'Nei': 33},
                'hit_rate': '40.7%',
                'conversion_rate': '40.7%',
                'rejection_rate': '26.8%',
                'no_answer_rate': '32.5%',
                'performance_metrics': {
                    'avg_per_day': 12.3,
                    'best_day': '2024-01-15',
                    'best_day_count': 25,
                    'total_employees': 5,
                    'avg_per_employee': 24.6
                },
                'trends': {
                    'daily_totals': [10, 15, 12, 18, 20, 25, 23],
                    'daily_hit_rates': [40.0, 50.0, 30.0, 60.0, 40.0, 50.0, 40.0]
                }
            },
            response_only=True
        )},
        parameters=[
            OpenApiParameter(name='campaign_id', type=str, required=True, description='Campaign ID to filter'),
            OpenApiParameter(name='status', type=str, required=False, description='Status to filter (can be comma-separated)'),
            OpenApiParameter(name='manager_id', type=str, required=False, description='Manager ID to filter'),
            OpenApiParameter(name='employee_id', type=str, required=False, description='Employee ID to filter'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date (YYYY-MM-DD)'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date (YYYY-MM-DD)'),
            OpenApiParameter(name='date_range', type=str, required=False, description='Shortcut: today, yesterday, this_week'),
            OpenApiParameter(name='include_trends', type=bool, required=False, description='Include daily trends data', default=False),
        ]
    )
    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Summary of address activities by status, campaign, user, and date range."""
        params = request.query_params
        campaign_id = params.get('campaign_id')
        if not campaign_id:
            return Response({'error': 'campaign_id is required'}, status=400)
        status_filter = params.get('status')
        manager_id = params.get('manager_id')
        employee_id = params.get('employee_id')
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        date_range = params.get('date_range')

        queryset = self.get_queryset().filter(activity_type='address_contact', campaign_id=campaign_id)

        # Filter by manager/employee
        if manager_id:
            queryset = queryset.filter(manager_id=manager_id)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        # Date range logic
        now = timezone.now()
        if date_range == 'today':
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif date_range == 'yesterday':
            start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
        elif date_range == 'this_week':
            start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        else:
            start = None
            end = None
        if start_date:
            try:
                start = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
            except Exception:
                return Response({'error': 'Invalid start_date'}, status=400)
        if end_date:
            try:
                end = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
            except Exception:
                return Response({'error': 'Invalid end_date'}, status=400)
        if start:
            queryset = queryset.filter(created_at__gte=start)
        if end:
            queryset = queryset.filter(created_at__lt=end)

        # Status filter (from metadata)
        if status_filter:
            status_list = [s.strip() for s in status_filter.split(',')]
            queryset = queryset.filter(metadata__status__in=status_list)

        # Group and count by status
        by_status = {}
        total = queryset.count()
        for status_val in queryset.values_list('metadata__status', flat=True):
            if status_val:
                by_status[status_val] = by_status.get(status_val, 0) + 1
        
        # Calculate various rates - handle both uppercase and lowercase status values
        ja_count = by_status.get('Ja', 0) + by_status.get('ja', 0)
        nei_count = by_status.get('Nei', 0) + by_status.get('nei', 0)
        ikke_hjem_count = by_status.get('Ikke Hjem', 0) + by_status.get('ikke_hjemme', 0)
        
        # Calculate rates as percentages (0.0 to 100.0)
        hit_rate = round((ja_count / total) * 100, 1) if total else 0.0
        conversion_rate = round((ja_count / total) * 100, 1) if total else 0.0  # Same as hit rate
        rejection_rate = round((nei_count / total) * 100, 1) if total else 0.0
        no_answer_rate = round((ikke_hjem_count / total) * 100, 1) if total else 0.0
        
        # Performance metrics
        performance_metrics = {}
        if start and end:
            days_diff = (end - start).days
            if days_diff > 0:
                performance_metrics['avg_per_day'] = round(total / days_diff, 1)
        
        # Get unique employees in the queryset
        unique_employees = queryset.values('employee').distinct().count()
        if unique_employees > 0:
            performance_metrics['total_employees'] = unique_employees
            performance_metrics['avg_per_employee'] = round(total / unique_employees, 1)
        
        # Find best performing day
        if start and end:
            daily_counts = queryset.extra(
                select={'day': 'date(created_at)'}
            ).values('day').annotate(count=Count('id')).order_by('-count')
            
            if daily_counts.exists():
                best_day = daily_counts.first()
                performance_metrics['best_day'] = best_day['day']
                performance_metrics['best_day_count'] = best_day['count']
        
        # Trends data (if requested)
        trends = {}
        include_trends = params.get('include_trends', 'false').lower() == 'true'
        if include_trends and start and end:
            daily_data = []
            daily_hit_rates = []
            current_date = start.date()
            end_date = end.date()
            
            while current_date <= end_date:
                day_start = timezone.make_aware(datetime.combine(current_date, datetime.min.time()))
                day_end = timezone.make_aware(datetime.combine(current_date, datetime.max.time()))
                
                day_queryset = queryset.filter(created_at__range=(day_start, day_end))
                day_total = day_queryset.count()
                day_ja_count = day_queryset.filter(metadata__status__in=['Ja', 'ja']).count()
                
                daily_data.append(day_total)
                daily_hit_rate = round((day_ja_count / day_total) * 100, 1) if day_total > 0 else 0.0
                daily_hit_rates.append(daily_hit_rate)
                
                current_date += timedelta(days=1)
            
            trends['daily_totals'] = daily_data
            trends['daily_hit_rates'] = daily_hit_rates
        
        return Response({
            'total': total,
            'by_status': by_status,
            'hit_rate': f"{hit_rate:.1f}%",
            'conversion_rate': f"{conversion_rate:.1f}%",
            'rejection_rate': f"{rejection_rate:.1f}%",
            'no_answer_rate': f"{no_answer_rate:.1f}%",
            'performance_metrics': performance_metrics,
            'trends': trends if include_trends else None,
        })


class SalesViewSet(viewsets.ModelViewSet):
    """ViewSet for Sales model."""
    queryset = Sales.objects.all()
    serializer_class = SalesSerializer
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'outcome', 'employee', 'manager', 'campaign', 'area']
    search_fields = ['contact_name', 'contact_phone', 'notes']
    ordering_fields = ['created_at', 'status', 'value']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all sales (like managers)
            return Sales.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see all sales
            return Sales.objects.all()
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see their own sales
            return Sales.objects.filter(employee=user.employee)
        
        return Sales.objects.none()
    
    def perform_create(self, serializer):
        """Set the user when creating a sale."""
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            serializer.save(employee=user.employee)
        elif hasattr(user, 'manager') and user.manager:
            serializer.save(manager=user.manager)
        elif user.is_superuser:
            # For super users, save without manager/employee (they can see all data anyway)
            serializer.save()
    
    @extend_schema(
        description="Get sales formatted for dashboard display",
        responses={200: DashboardSalesSerializer(many=True)},
        parameters=[
            OpenApiParameter(name='days', type=int, description='Number of days to look back', default=7),
            OpenApiParameter(name='status', type=str, description='Filter by status'),
        ]
    )
    @action(detail=False, methods=['get'])
    def dashboard_data(self, request):
        """Get sales formatted for dashboard display."""
        days = int(request.query_params.get('days', 7))
        status_filter = request.query_params.get('status')
        
        start_date = timezone.now() - timedelta(days=days)
        queryset = self.get_queryset().filter(created_at__gte=start_date)
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Transform to dashboard format (use registration date for display when sale_date set)
        sales = []
        for sale in queryset[:50]:  # Limit to 50 most recent
            if sale.sale_date:
                time_display = sale.sale_date.strftime('%d. %b')
            else:
                time_display = sale.created_at.strftime('%d. %b %H:%M') if sale.created_at else ''
            sales.append({
                'id': sale.id,
                'campaign': sale.campaign.name if sale.campaign else 'N/A',
                'time': time_display,
                'contact': sale.contact_name,
                'mobile': sale.contact_phone or 'N/A',
                'status': sale.status,
                'activity': 'Sales Contact',
            })
        
        serializer = DashboardSalesSerializer(sales, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get filtered sales data for manager dashboard",
        description="Returns sales data filtered by campaign and optional date range with specific columns: Date, Name, Email, Number, Status. If no dates provided, returns all data for the campaign.",
        responses={200: FilteredSalesResponseSerializer},
        parameters=[
            OpenApiParameter(name='campaign_id', type=str, required=True, description='Campaign ID to filter by'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date (YYYY-MM-DD). If not provided, no date filtering is applied.'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date (YYYY-MM-DD). If not provided, no date filtering is applied.'),
            OpenApiParameter(name='status', type=str, required=False, description='Filter by status (can be comma-separated)'),
            OpenApiParameter(name='search', type=str, required=False, description='Search in contact name or email'),
            OpenApiParameter(name='page', type=int, required=False, description='Page number', default=1),
            OpenApiParameter(name='page_size', type=int, required=False, description='Items per page', default=50),
        ]
    )
    @action(detail=False, methods=['get'], url_path='filtered')
    def filtered_sales(self, request):
        """Get filtered sales data for manager dashboard with specific columns."""
        # Get query parameters
        campaign_id = request.query_params.get('campaign_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        status_filter = request.query_params.get('status')
        search_query = request.query_params.get('search')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        
        # Validate required parameters
        if not campaign_id:
            return Response({'error': 'campaign_id is required'}, status=400)
        
        # Validate campaign_id format (UUID)
        import uuid
        try:
            campaign_uuid = uuid.UUID(campaign_id)
        except ValueError:
            return Response({
                'error': f'Invalid campaign_id format: "{campaign_id}". Expected UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000")'
            }, status=400)
        
        # Get base queryset with campaign filter
        queryset = self.get_queryset().filter(campaign_id=campaign_uuid)
        
        # Apply date filtering by registration date: sale_date when set, else created_at.date()
        if start_date and end_date:
            try:
                start_d = datetime.strptime(start_date, '%Y-%m-%d').date()
                end_d = datetime.strptime(end_date, '%Y-%m-%d').date()
                queryset = queryset.filter(
                    Q(sale_date__isnull=False, sale_date__gte=start_d, sale_date__lte=end_d)
                    | Q(sale_date__isnull=True, created_at__date__gte=start_d, created_at__date__lte=end_d)
                )
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
        elif start_date or end_date:
            return Response({'error': 'Both start_date and end_date must be provided together, or neither'}, status=400)
        
        # Apply status filter
        if status_filter:
            status_list = [s.strip() for s in status_filter.split(',')]
            queryset = queryset.filter(status__in=status_list)
        
        # Apply search filter
        if search_query:
            queryset = queryset.filter(
                Q(contact_name__icontains=search_query) |
                Q(contact_email__icontains=search_query)
            )
        
        # Get total count before pagination
        total_count = queryset.count()
        
        # Apply pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        sales_page = queryset[start_index:end_index]
        
        # Transform to required format with comprehensive data
        sales_data = []
        for sale in sales_page:
            # Map status to Norwegian display names
            status_display = {
                'pending': 'Venter',
                'completed': 'Fullført',
                'cancelled': 'Kansellert',
                'callback': 'Tilbakeringing',
                'no_answer': 'Ingen Svar'
            }.get(sale.status, sale.status)
            
            # Map outcome to Norwegian display names
            outcome_display = {
                'Ja': 'Ja',
                'Nei': 'Nei',
                'Tilbakeringing': 'Tilbakeringing',
                'Ikke Hjem': 'Ikke Hjem',
                'N/A': 'N/A'
            }.get(sale.outcome, sale.outcome or 'N/A')
            
            # Display date: registration date (sale_date if set, else created_at)
            if sale.sale_date:
                date_display = sale.sale_date.strftime('%d. %b')
            else:
                date_display = sale.created_at.strftime('%d. %b %H:%M') if sale.created_at else ''
            sales_data.append({
                'id': str(sale.id),
                'date': date_display,
                'sale_date': sale.sale_date.isoformat() if sale.sale_date else None,
                'name': sale.contact_name,
                'email': sale.contact_email or 'N/A',
                'number': sale.contact_phone or 'N/A',
                'status': status_display,
                'outcome': outcome_display,
                'value': float(sale.value) if sale.value else None,
                'commission': float(sale.commission) if sale.commission else None,
                'notes': sale.notes or '',
                'campaign': sale.campaign.name if sale.campaign else 'N/A',
                'campaign_id': str(sale.campaign.id) if sale.campaign else None,
                'employee_name': sale.employee.name if sale.employee else 'N/A',
                'employee_id': str(sale.employee.id) if sale.employee else None,
                'manager_name': sale.manager.name if sale.manager else 'N/A',
                'manager_id': str(sale.manager.id) if sale.manager else None,
                'area_name': sale.area.name if sale.area else 'N/A',
                'area_id': str(sale.area.id) if sale.area else None,
                'completed_at': sale.completed_at.strftime('%d. %b %H:%M') if sale.completed_at else None,
                'metadata': sale.metadata or {}
            })
        
        return Response({
            'results': sales_data,
            'total_count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_count + page_size - 1) // page_size
        })


class PerformanceMetricsViewSet(viewsets.ModelViewSet):
    """ViewSet for PerformanceMetrics model."""
    queryset = PerformanceMetrics.objects.all()
    serializer_class = PerformanceMetricsSerializer
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['period_type', 'employee', 'manager', 'campaign', 'area']
    ordering_fields = ['date', 'total_calls', 'conversion_rate']
    ordering = ['-date', '-hour']
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all metrics (like managers)
            return PerformanceMetrics.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see all metrics
            return PerformanceMetrics.objects.all()
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see their own metrics
            return PerformanceMetrics.objects.filter(employee=user.employee)
        
        return PerformanceMetrics.objects.none()
    
    @extend_schema(
        description="Get performance data formatted for dashboard charts",
        responses={200: DashboardPerformanceSerializer(many=True)},
        parameters=[
            OpenApiParameter(name='period', type=str, description='Period type (hourly, daily, weekly, monthly)', default='hourly'),
            OpenApiParameter(name='days', type=int, description='Number of days to look back', default=1),
        ]
    )
    @action(detail=False, methods=['get'])
    def dashboard_performance(self, request):
        """Get performance data formatted for dashboard charts."""
        period = request.query_params.get('period', 'hourly')
        days = int(request.query_params.get('days', 1))
        
        start_date = timezone.now() - timedelta(days=days)
        queryset = self.get_queryset().filter(
            date__gte=start_date.date(),
            period_type=period
        )
        
        # Group by time period and aggregate
        if period == 'hourly':
            queryset = queryset.values('hour').annotate(
                calls=Sum('total_calls'),
                orders=Sum('total_sales')
            ).order_by('hour')
            
            performance_data = []
            for item in queryset:
                performance_data.append({
                    'name': f"{item['hour']}:00",
                    'calls': item['calls'] or 0,
                    'orders': item['orders'] or 0,
                })
        else:
            queryset = queryset.values('date').annotate(
                calls=Sum('total_calls'),
                orders=Sum('total_sales')
            ).order_by('date')
            
            performance_data = []
            for item in queryset:
                performance_data.append({
                    'name': item['date'].strftime('%d. %b'),
                    'calls': item['calls'] or 0,
                    'orders': item['orders'] or 0,
                })
        
        serializer = DashboardPerformanceSerializer(performance_data, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        description="Get campaign data formatted for dashboard charts",
        responses={200: DashboardCampaignSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def dashboard_campaigns(self, request):
        """Get campaign data formatted for dashboard charts."""
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        queryset = self.get_queryset().filter(
            date__gte=start_date.date()
        ).values('campaign__name').annotate(
            value=Sum('total_calls')
        ).order_by('-value')
        
        campaign_data = []
        for item in queryset:
            campaign_data.append({
                'name': item['campaign__name'] or 'Unknown',
                'value': item['value'] or 0,
            })
        
        serializer = DashboardCampaignSerializer(campaign_data, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        description="Get conversion data formatted for dashboard charts",
        responses={200: DashboardConversionSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def dashboard_conversion(self, request):
        """Get conversion data formatted for dashboard charts."""
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        # Get conversion data from sales/addresses
        from addresses.models import Address
        
        user = self.request.user
        if hasattr(user, 'manager') and user.manager:
            addresses = Address.objects.filter(recorded_at__gte=start_date)
        elif hasattr(user, 'employee') and user.employee:
            addresses = Address.objects.filter(
                recorded_at__gte=start_date,
                employee=user.employee
            )
        else:
            addresses = Address.objects.none()
        
        # Calculate conversion funnel
        total_contacts = addresses.count()
        yes_responses = addresses.filter(status='Ja').count()
        no_responses = addresses.filter(status='Nei').count()
        callback_requests = addresses.filter(status='Tilbakeringing').count()
        
        conversion_data = [
            {'name': 'Samtaler', 'value': total_contacts},
            {'name': 'Kvalifisert', 'value': yes_responses},
            {'name': 'Tilbud', 'value': yes_responses},  # Simplified
            {'name': 'Bestillinger', 'value': yes_responses},  # Simplified
        ]
        
        serializer = DashboardConversionSerializer(conversion_data, many=True)
        return Response(serializer.data)


class DashboardSummaryViewSet(viewsets.ModelViewSet):
    """ViewSet for DashboardSummary model."""
    queryset = DashboardSummary.objects.all()
    serializer_class = DashboardSummarySerializer
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['manager', 'employee', 'date']
    ordering_fields = ['date']
    ordering = ['-date']
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all summaries (like managers)
            return DashboardSummary.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see their own summaries and system summaries
            return DashboardSummary.objects.filter(
                Q(manager=user.manager) | Q(manager__isnull=True)
            )
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see their own summaries
            return DashboardSummary.objects.filter(employee=user.employee)
        
        return DashboardSummary.objects.none()
    
    @extend_schema(
        description="Get dashboard summary data",
        responses={200: DashboardSummaryDataSerializer},
        parameters=[
            OpenApiParameter(name='date', type=str, description='Date in YYYY-MM-DD format', default='today'),
        ]
    )
    @action(detail=False, methods=['get'])
    def summary_data(self, request):
        """Get dashboard summary data for the current user."""
        date_param = request.query_params.get('date', 'today')
        
        if date_param == 'today':
            target_date = timezone.now().date()
        else:
            try:
                target_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                target_date = timezone.now().date()
        
        user = self.request.user
        
        # Get or create summary for the date
        if hasattr(user, 'manager') and user.manager:
            summary, created = DashboardSummary.objects.get_or_create(
                date=target_date,
                manager=user.manager,
                defaults={
                    'total_orders': 0,
                    'total_calls': 0,
                    'successful_calls': 0,
                    'conversion_rate': 0,
                    'online_employees': 0,
                    'total_employees': 0,
                    'active_employees': 0,
                    'total_work_time': 0,
                    'total_break_time': 0,
                    'total_call_time': 0,
                    'active_campaigns': 0,
                    'total_revenue': 0,
                    'total_commission': 0,
                }
            )
        elif hasattr(user, 'employee') and user.employee:
            summary, created = DashboardSummary.objects.get_or_create(
                date=target_date,
                employee=user.employee,
                defaults={
                    'total_orders': 0,
                    'total_calls': 0,
                    'successful_calls': 0,
                    'conversion_rate': 0,
                    'online_employees': 0,
                    'total_employees': 0,
                    'active_employees': 0,
                    'total_work_time': 0,
                    'total_break_time': 0,
                    'total_call_time': 0,
                    'active_campaigns': 0,
                    'total_revenue': 0,
                    'total_commission': 0,
                }
            )
        else:
            return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate real-time data
        start_of_day = timezone.make_aware(datetime.combine(target_date, datetime.min.time()))
        end_of_day = timezone.make_aware(datetime.combine(target_date, datetime.max.time()))
        
        # Get address data for the day
        if hasattr(user, 'manager') and user.manager:
            addresses = Address.objects.filter(
                recorded_at__range=(start_of_day, end_of_day),
                manager=user.manager
            )
            employees = Employee.objects.filter(manager=user.manager)
        elif hasattr(user, 'employee') and user.employee:
            addresses = Address.objects.filter(
                recorded_at__range=(start_of_day, end_of_day),
                employee=user.employee
            )
            employees = Employee.objects.filter(id=user.employee.id)
        else:
            addresses = Address.objects.none()
            employees = Employee.objects.none()
        
        # Calculate metrics
        total_calls = addresses.count()
        yes_responses = addresses.filter(status='Ja').count()
        no_responses = addresses.filter(status='Nei').count()
        callback_requests = addresses.filter(status='Tilbakeringing').count()
        online_employees = employees.filter(is_online=True).count()
        total_employees = employees.count()
        
        # Get active campaign
        active_campaign = Campaign.objects.filter(
            created_by=user.manager if hasattr(user, 'manager') else None
        ).first()
        
        # Format time data
        total_work_time = f"{summary.total_work_time // 60}t {summary.total_work_time % 60}m" if summary.total_work_time else "0t 0m"
        total_break_time = f"{summary.total_break_time // 60}t {summary.total_break_time % 60}m" if summary.total_break_time else "0t 0m"
        total_call_time = f"{summary.total_call_time // 60}t {summary.total_call_time % 60}m" if summary.total_call_time else "0t 0m"
        
        summary_data = {
            'orders': yes_responses,  # Simplified: yes responses as orders
            'total_calls': total_calls,
            'yes_responses': yes_responses,
            'no_responses': no_responses,
            'callback_requests': callback_requests,
            'active_campaign': active_campaign.name if active_campaign else 'No Active Campaign',
            'online_employees': online_employees,
            'total_employees': total_employees,
            'total_work_time': total_work_time,
            'total_break_time': total_break_time,
            'total_call_time': total_call_time,
        }
        
        serializer = DashboardSummaryDataSerializer(summary_data)
        return Response(serializer.data)


class TimeTrackingViewSet(viewsets.ModelViewSet):
    """ViewSet for TimeTracking model."""
    queryset = TimeTracking.objects.all()
    serializer_class = TimeTrackingSerializer
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'employee']
    ordering_fields = ['start_time', 'status']
    ordering = ['-start_time']
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all time tracking (like managers)
            return TimeTracking.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see all time tracking
            return TimeTracking.objects.all()
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see their own time tracking
            return TimeTracking.objects.filter(employee=user.employee)
        
        return TimeTracking.objects.none()
    
    def perform_create(self, serializer):
        """Set the employee when creating time tracking."""
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            serializer.save(employee=user.employee)
        else:
            raise permissions.PermissionDenied("Only employees can create time tracking entries")


class DashboardLeaderboardViewSet(viewsets.ViewSet):
    """ViewSet for dashboard leaderboard data."""
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        description="Get leaderboard data for sales performance",
        responses={200: DashboardLeaderboardSerializer(many=True)},
        parameters=[
            OpenApiParameter(name='days', type=int, description='Number of days to look back', default=30),
            OpenApiParameter(name='team', type=str, description='Filter by team'),
        ]
    )
    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Get leaderboard data for sales performance."""
        days = int(request.query_params.get('days', 30))
        
        start_date = timezone.now() - timedelta(days=days)
        
        user = self.request.user
        if user.is_superuser:
            # Super users can see all employees (like managers)
            employees = Employee.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            employees = Employee.objects.filter(manager=user.manager)
        else:
            employees = Employee.objects.none()
        
        # Calculate performance for each employee
        leaderboard_data = []
        for employee in employees:
            # Get employee's address contacts (simplified sales metric)
            employee_addresses = Address.objects.filter(
                employee=employee,
                recorded_at__gte=start_date
            )
            
            total_contacts = employee_addresses.count()
            successful_contacts = employee_addresses.filter(status='Ja').count()
            conversion_rate = (successful_contacts / total_contacts * 100) if total_contacts > 0 else 0
            
            # Simplified metrics
            sales = total_contacts
            target = 50  # Default target
            avg_value = 1250  # Default average value
            trend = "up" if successful_contacts > (total_contacts / 2) else "down"
            
            leaderboard_data.append({
                'id': employee.id,
                'name': employee.name,
                'avatar': f"/placeholder.svg?height=40&width=40",
                'initials': ''.join([name[0] for name in employee.name.split()[:2]]),
                'team': 'Unassigned',  # Teams removed
                'sales': sales,
                'target': target,
                'conversion': int(conversion_rate),
                'avgValue': avg_value,
                'trend': trend,
            })
        
        # Sort by sales (descending)
        leaderboard_data.sort(key=lambda x: x['sales'], reverse=True)
        
        serializer = DashboardLeaderboardSerializer(leaderboard_data, many=True)
        return Response(serializer.data)


class ActivityReportView(APIView):
    """
    View for generating activity reports from Activity model metadata.
    
    Returns structured reporting data including total logs, status counts,
    campaign breakdowns, and top users.
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Get activity report data",
        description="Returns structured reporting data for activity logs including total counts, status breakdown, campaign information, and top users. Supports filtering by campaign, user type, and date range.",
        parameters=[
            OpenApiParameter(name='campaign_id', type=str, required=False, description='Filter by specific campaign ID'),
            OpenApiParameter(name='user_type', type=str, required=False, description='Filter by user ID (employee ID or manager ID)'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date in ISO format (YYYY-MM-DDTHH:MM:SS)'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date in ISO format (YYYY-MM-DDTHH:MM:SS)'),
        ],
        responses={
            200: OpenApiResponse(
                description="Activity report data",
                response={
                    "type": "object",
                    "properties": {
                        "total_logs": {"type": "integer"},
                        "status_counts": {"type": "object"},
                        "campaigns": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "campaign_id": {"type": "string"},
                                    "campaign_name": {"type": "string"},
                                    "count": {"type": "integer"}
                                }
                            }
                        },
                        "top_users": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "user_name": {"type": "string"},
                                    "count": {"type": "integer"}
                                }
                            }
                        }
                    }
                }
            )
        }
    )
    def get(self, request):
        """Get activity report data with optional filtering."""
        try:
            # Get query parameters
            campaign_id = request.query_params.get('campaign_id')
            user_type = request.query_params.get('user_type')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            # Start with base queryset
            queryset = Activity.objects.all()
            
            # Apply filters
            if campaign_id:
                # Filter by campaign foreign key
                queryset = queryset.filter(campaign_id=campaign_id)
                logger.info(f"Filtered by campaign_id: {campaign_id}")
            
            # Apply user type filter
            if user_type:
                try:
                    # Try to parse as UUID
                    uuid_obj = UUID(user_type)
                    # If successful, filter by employee or manager ID
                    queryset = queryset.filter(
                        Q(employee_id=user_type) | Q(manager_id=user_type)
                    )
                    logger.info(f"Filtered by user_id: {user_type}")
                except ValueError:
                    # Not a UUID, treat as role
                    if user_type == "manager":
                        queryset = queryset.filter(manager__isnull=False)
                    elif user_type == "leader":
                        queryset = queryset.filter(employee__isnull=False)
                    logger.info(f"Filtered by user_type: {user_type}")
            
            # Apply date range filter if both dates are provided
            if start_date and end_date:
                try:
                    start_datetime = parse_datetime(start_date)
                    end_datetime = parse_datetime(end_date)
                    
                    if start_datetime and end_datetime:
                        queryset = queryset.filter(
                            metadata__recorded_at__range=(start_datetime.isoformat(), end_datetime.isoformat())
                        )
                        logger.info(f"Filtered by date range: {start_date} to {end_date}")
                    else:
                        logger.warning("Invalid date format provided")
                except Exception as e:
                    logger.error(f"Error parsing dates: {e}")
            
            # Calculate total logs
            total_logs = queryset.count()
            
            # Count by status
            status_counts = {}
            for activity in queryset:
                activity_status = activity.metadata.get('status', 'unknown')
                status_counts[activity_status] = status_counts.get(activity_status, 0) + 1
            
            # Get campaigns with counts
            campaigns = []
            campaign_data = {}
            
            for activity in queryset:
                campaign_id = activity.metadata.get('campaign_id')
                campaign_name = activity.metadata.get('campaign_name', 'Unknown Campaign')
                
                if campaign_id:
                    if campaign_id not in campaign_data:
                        campaign_data[campaign_id] = {
                            'campaign_id': campaign_id,
                            'campaign_name': campaign_name,
                            'count': 0
                        }
                    campaign_data[campaign_id]['count'] += 1
            
            campaigns = list(campaign_data.values())
            
            # Get top users
            user_counts = Counter()
            for activity in queryset:
                user_name = activity.metadata.get('user_name', 'Unknown User')
                user_counts[user_name] += 1
            
            # Get top 5 users
            top_users = [
                {'user_name': user_name, 'count': count}
                for user_name, count in user_counts.most_common(5)
            ]
            
            # Prepare response
            response_data = {
                'total_logs': total_logs,
                'status_counts': status_counts,
                'campaigns': campaigns,
                'top_users': top_users
            }
            
            logger.info(f"Generated report with {total_logs} total logs")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating activity report: {e}")
            return Response(
                {'error': 'Internal server error while generating report'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ActivityExportView(APIView):
    """
    View for exporting activity data to CSV format.
    
    Exports activity logs with all relevant data from the metadata JSONField
    in a downloadable CSV file.
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Export activity data to CSV",
        description="Exports activity logs to CSV format using the same filtering logic as table-data endpoint. Returns exactly what users see on the frontend as a downloadable CSV file.",
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=True, description='Comma-separated list of campaign UUIDs'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date in ISO format (YYYY-MM-DD)'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date in ISO format (YYYY-MM-DD)'),
        ],
        responses={
            200: OpenApiResponse(
                description="CSV file download",
                response={
                    "type": "string",
                    "format": "binary"
                }
            ),
            400: OpenApiResponse(
                description="Bad request",
                response={
                    "type": "object",
                    "properties": {
                        "error": {"type": "string"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Export activity data to CSV format using the same logic as table-data endpoint."""
        try:
            # Get query parameters (same as TableDataView)
            campaign_ids_param = request.query_params.get('campaign_ids')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            if not campaign_ids_param:
                return Response(
                    {'error': 'campaign_ids parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Split campaign IDs into list
            campaign_ids = [cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()]
            
            if not campaign_ids:
                return Response(
                    {'error': 'At least one valid campaign ID is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Exporting activity data for campaigns: {campaign_ids}")
            
            # Start with base queryset - filter by campaign_id in the metadata JSONB field (same as TableDataView)
            queryset = Activity.objects.filter(metadata__campaign_id__in=campaign_ids)
            
            # Apply date range filter if provided (same logic as TableDataView)
            if start_date or end_date:
                try:
                    if start_date and end_date:
                        # Both dates provided
                        start_datetime = datetime.strptime(start_date, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0)
                        end_datetime = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
                        queryset = queryset.filter(metadata__recorded_at__range=(start_datetime.isoformat(), end_datetime.isoformat()))
                        logger.info(f"Export filtered by date range: {start_date} to {end_date}")
                    elif start_date:
                        # Only start date provided
                        start_datetime = datetime.strptime(start_date, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0)
                        queryset = queryset.filter(metadata__recorded_at__gte=start_datetime.isoformat())
                        logger.info(f"Export filtered from start date: {start_date}")
                    elif end_date:
                        # Only end date provided
                        end_datetime = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
                        queryset = queryset.filter(metadata__recorded_at__lte=end_datetime.isoformat())
                        logger.info(f"Export filtered until end date: {end_date}")
                except ValueError as e:
                    logger.error(f"Error parsing dates for export: {e}")
                    return Response(
                        {'error': 'Invalid date format. Use YYYY-MM-DD format.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # If no data found, return empty CSV
            if not queryset.exists():
                # Create empty CSV with headers
                buffer = io.StringIO()
                writer = csv.writer(buffer)
                writer.writerow([
                    'Agent',
                    'Kampanje',
                    'Status', 
                    'Adresse',
                    'Dato'
                ])
                csv_content = buffer.getvalue()
                buffer.close()
                
                response = StreamingHttpResponse(
                    iter([csv_content]),
                    content_type='text/csv'
                )
                response['Content-Disposition'] = 'attachment; filename="activity_export.csv"'
                return response
            
            # Create CSV buffer
            buffer = io.StringIO()
            writer = csv.writer(buffer)
            
            # Write CSV header (matching the frontend table columns)
            writer.writerow([
                'Agent',
                'Kampanje',
                'Status', 
                'Adresse',
                'Dato'
            ])
            
            # Write data rows (using the same data as table-data endpoint)
            for activity in queryset:
                metadata = activity.metadata or {}
                
                # Extract data from metadata (same fields as frontend table)
                agent = metadata.get('user_name', '')
                kampanje = metadata.get('campaign_name', '')
                status = metadata.get('status', '')
                adresse = metadata.get('address_text', '')
                
                # Format date from recorded_at
                recorded_at = metadata.get('recorded_at', '')
                if recorded_at:
                    try:
                        # Parse ISO datetime and format as DD.MM.YYYY
                        dt = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
                        dato = dt.strftime('%d.%m.%Y')
                    except:
                        dato = recorded_at
                else:
                    dato = ''
                
                # Write row with the exact data users see on frontend
                writer.writerow([
                    agent,
                    kampanje,
                    status,
                    adresse,
                    dato
                ])
            
            # Get CSV content
            csv_content = buffer.getvalue()
            buffer.close()
            
            # Create response
            response = StreamingHttpResponse(
                iter([csv_content]),
                content_type='text/csv'
            )
            
            # Set filename for download
            filename = 'activity_export.csv'
            if len(campaign_ids) == 1:
                filename = f'activity_export_campaign_{campaign_ids[0]}.csv'
            else:
                filename = f'activity_export_{len(campaign_ids)}_campaigns.csv'
            
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            logger.info(f"Exported {queryset.count()} activity records to CSV")
            return response
            
        except Exception as e:
            logger.error(f"Error exporting activity data: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while exporting data'},
                status=status.HTTP_400_BAD_REQUEST
            )


class CampaignResponseComparisonView(APIView):
    """
    View for comparing response distributions across multiple campaigns.
    
    Returns grouped data structure for comparing multiple campaigns' responses
    (e.g., ja, nei, ikke_interessert) in a frontend bar chart.
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Compare response distributions across multiple campaigns",
        description="Returns grouped data structure for comparing response distributions across multiple campaigns. Each object groups the same response type across campaigns under 'name' field.",
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=True, description='Comma-separated list of campaign IDs to compare'),
            OpenApiParameter(name='user_type', type=str, required=False, description='Filter by user ID (employee ID or manager ID)'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date in ISO format (YYYY-MM-DDTHH:MM:SS)'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date in ISO format (YYYY-MM-DDTHH:MM:SS)'),
        ],
        responses={
            200: OpenApiResponse(
                description="Campaign response comparison data",
                response={
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Response type (e.g., 'Ja', 'Nei', 'Ikke interessert')"},
                            "campaign_name_1": {"type": "integer", "description": "Count for campaign 1"},
                            "campaign_name_2": {"type": "integer", "description": "Count for campaign 2"}
                        },
                        "additionalProperties": {"type": "integer"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Get campaign response comparison data."""
        try:
            # Get query parameters
            campaign_ids_param = request.query_params.get('campaign_ids')
            user_type = request.query_params.get('user_type')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            if not campaign_ids_param:
                return Response(
                    {'error': 'campaign_ids parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Split campaign IDs into list
            campaign_ids = [cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()]
            
            if not campaign_ids:
                return Response(
                    {'error': 'At least one valid campaign ID is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Comparing responses for campaigns: {campaign_ids}")
            
            # Build the comparison data structure
            comparison_data = {}
            campaign_names = {}
            
            # Process each campaign
            for campaign_id in campaign_ids:
                # Start with base queryset for this campaign
                queryset = Activity.objects.filter(campaign_id=campaign_id)
                
                # Apply user filter if provided
                if user_type:
                    queryset = queryset.filter(
                        Q(employee_id=user_type) | Q(manager_id=user_type)
                    )
                
                # Apply date range filter if both dates are provided
                if start_date and end_date:
                    try:
                        start_datetime = parse_datetime(start_date)
                        end_datetime = parse_datetime(end_date)
                        
                        if start_datetime and end_datetime:
                            queryset = queryset.filter(
                                metadata__recorded_at__range=(start_datetime.isoformat(), end_datetime.isoformat())
                            )
                        else:
                            logger.warning("Invalid date format provided")
                    except Exception as e:
                        logger.error(f"Error parsing dates: {e}")
                
                # Get campaign name from the latest matching record
                latest_activity = queryset.order_by('-created_at').first()
                if latest_activity:
                    campaign_name = latest_activity.metadata.get('campaign_name', f'Campaign {campaign_id}')
                else:
                    campaign_name = f'Campaign {campaign_id}'
                
                campaign_names[campaign_id] = campaign_name
                
                # Count responses by status for this campaign
                status_counts = queryset.values('metadata__status').annotate(
                    count=Count('id')
                )
                
                # Add to comparison data
                for status_data in status_counts:
                    response_status = status_data['metadata__status'] or 'unknown'
                    count = status_data['count']
                    
                    if response_status not in comparison_data:
                        comparison_data[response_status] = {}
                    
                    comparison_data[response_status][campaign_name] = count
                
                # Ensure all campaigns have entries for all statuses (with 0 if missing)
                for response_status in comparison_data:
                    if campaign_name not in comparison_data[response_status]:
                        comparison_data[response_status][campaign_name] = 0
            
            # Convert to the required output format
            result = []
            for response_status, campaign_counts in comparison_data.items():
                row = {'name': response_status}
                row.update(campaign_counts)
                result.append(row)
            
            logger.info(f"Generated comparison data for {len(campaign_ids)} campaigns with {len(result)} status types")
            return Response(result, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating campaign response comparison: {e}")
            return Response(
                {'error': 'Internal server error while generating comparison'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserReportView(APIView):
    """
    View for generating user-specific activity reports.
    
    Returns statistics only for the currently authenticated user (either a manager or employee)
    within a specific time window. If no date range is provided, returns all-time data.
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Get user-specific activity report",
        description="Returns statistics only for the currently authenticated user within a specific time window and optional campaign filtering. If no date range is provided, returns all-time data.",
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=False, description='Comma-separated list of campaign UUIDs to filter by'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date in ISO format (YYYY-MM-DD)'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date in ISO format (YYYY-MM-DD)'),
        ],
        responses={
            200: OpenApiResponse(
                description="User activity report data",
                response={
                    "type": "object",
                    "properties": {
                        "total_responses": {"type": "integer"},
                        "ja": {"type": "integer"},
                        "nei": {"type": "integer"},
                        "ikke_hjemme": {"type": "integer"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Get user-specific activity report data."""
        try:
            # Get query parameters
            campaign_ids_param = request.query_params.get('campaign_ids')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            # Start with base queryset for address_contact activities (no user scoping)
            queryset = Activity.objects.filter(activity_type='address_contact')
            
            # Apply campaign filter if provided (use metadata like table-data)
            if campaign_ids_param:
                try:
                    campaign_ids = [cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()]
                    if campaign_ids:
                        queryset = queryset.filter(metadata__campaign_id__in=campaign_ids)
                        logger.info(f"Filtered user report by campaigns (metadata): {campaign_ids}")
                except Exception as e:
                    logger.error(f"Error parsing campaign_ids: {e}")
                    return Response(
                        {'error': 'Invalid campaign_ids format. Use comma-separated UUIDs.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Apply date range filter using metadata.recorded_at like table-data
            if start_date or end_date:
                try:
                    if start_date and end_date:
                        start_datetime = datetime.strptime(start_date, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0)
                        end_datetime = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
                        queryset = queryset.filter(metadata__recorded_at__range=(start_datetime.isoformat(), end_datetime.isoformat()))
                        logger.info(f"Filtered user report by recorded_at range: {start_date} to {end_date}")
                    elif start_date:
                        start_datetime = datetime.strptime(start_date, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0)
                        queryset = queryset.filter(metadata__recorded_at__gte=start_datetime.isoformat())
                        logger.info(f"Filtered user report from recorded_at start: {start_date}")
                    elif end_date:
                        end_datetime = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
                        queryset = queryset.filter(metadata__recorded_at__lte=end_datetime.isoformat())
                        logger.info(f"Filtered user report until recorded_at end: {end_date}")
                except ValueError as e:
                    logger.error(f"Error parsing dates: {e}")
                    return Response(
                        {'error': 'Invalid date format. Use YYYY-MM-DD format.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # If no data found, return empty response
            if not queryset.exists():
                return Response({
                    'total_responses': 0,
                    'ja': 0,
                    'nei': 0,
                    'ikke_hjemme': 0
                }, status=status.HTTP_200_OK)
            
            # Use aggregation to count responses by status efficiently
            ja_count = 0
            nei_count = 0
            ikke_hjemme_count = 0
            
            for activity in queryset:
                status_value = activity.metadata.get('status', '').lower()
                
                # Count by status
                if status_value in ['ja', 'yes', 'positive']:
                    ja_count += 1
                elif status_value in ['nei', 'no', 'negative']:
                    nei_count += 1
                elif status_value in ['ikke_hjemme', 'not_home', 'not at home']:
                    ikke_hjemme_count += 1
            
            # Calculate total responses
            total_responses = ja_count + nei_count + ikke_hjemme_count
            
            # Prepare response
            response_data = {
                'total_responses': total_responses,
                'ja': ja_count,
                'nei': nei_count,
                'ikke_hjemme': ikke_hjemme_count
            }
            
            logger.info(f"Generated user report with {total_responses} total responses")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating user report: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while generating user report'},
                status=status.HTTP_400_BAD_REQUEST
            )


class TableDataView(APIView):
    """
    Lightweight summary endpoint for the hierarchical dashboard.

    Returns a list of users (employees / managers) with aggregate statistics
    (total responses, city count, percentages).  No individual address records
    are returned – use ``/activity/table-data/addresses/`` for that.

    Query parameters
    ----------------
    campaign_ids : str (required)
        Comma-separated campaign UUIDs.
    start_date : str (optional)
        YYYY-MM-DD
    end_date : str (optional)
        YYYY-MM-DD
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]

    @extend_schema(
        summary="Get user activity summaries for campaigns",
        description=(
            "Returns lightweight user summaries with aggregate statistics "
            "(total responses, city count, ja/nei/ikke_hjemme percentages). "
            "Call /activity/table-data/addresses/?user_id=…&campaign_ids=… "
            "to load the full city → address hierarchy for a single user."
        ),
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=True,
                             description='Comma-separated list of campaign UUIDs'),
            OpenApiParameter(name='start_date', type=str, required=False,
                             description='Start date in ISO format (YYYY-MM-DD)'),
            OpenApiParameter(name='end_date', type=str, required=False,
                             description='End date in ISO format (YYYY-MM-DD)'),
        ],
        responses={
            200: OpenApiResponse(
                description="User summaries with aggregate stats",
                response={
                    "type": "object",
                    "properties": {
                        "users": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "user_id": {"type": "string"},
                                    "name": {"type": "string"},
                                    "role": {"type": "string"},
                                    "total_responses": {"type": "integer"},
                                    "total_cities": {"type": "integer"},
                                    "ja_percentage": {"type": "number"},
                                    "nei_percentage": {"type": "number"},
                                    "ikke_hjemme_percentage": {"type": "number"},
                                }
                            }
                        },
                        "summary": {"type": "object"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Return per-user activity summaries (no individual addresses)."""
        from .utils import extract_city_from_address, normalize_status_value
        from collections import defaultdict

        try:
            # ── Parse & validate params ─────────────────────────────────
            campaign_ids_param = request.query_params.get('campaign_ids')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')

            if not campaign_ids_param:
                return Response(
                    {'error': 'campaign_ids parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            campaign_ids = [
                cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()
            ]
            if not campaign_ids:
                return Response(
                    {'error': 'At least one valid campaign ID is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logger.info(f"TableDataView summary for campaigns: {campaign_ids}")

            # ── Base queryset ───────────────────────────────────────────
            # Use proper FK field (campaign_id) instead of JSONB metadata
            # for reliable filtering and index usage.
            queryset = Activity.objects.filter(
                campaign_id__in=campaign_ids,
                activity_type='address_contact',
            )

            # ── Date filtering ──────────────────────────────────────────
            # Use the model's created_at DateTimeField (indexed) instead
            # of metadata__recorded_at (JSONB string — unreliable across
            # PostgreSQL versions and timezone formats).
            if start_date or end_date:
                try:
                    if start_date and end_date:
                        sd = timezone.make_aware(
                            datetime.strptime(start_date, '%Y-%m-%d').replace(
                                hour=0, minute=0, second=0, microsecond=0))
                        ed = timezone.make_aware(
                            datetime.strptime(end_date, '%Y-%m-%d').replace(
                                hour=23, minute=59, second=59, microsecond=999999))
                        queryset = queryset.filter(
                            created_at__range=(sd, ed))
                    elif start_date:
                        sd = timezone.make_aware(
                            datetime.strptime(start_date, '%Y-%m-%d').replace(
                                hour=0, minute=0, second=0, microsecond=0))
                        queryset = queryset.filter(
                            created_at__gte=sd)
                    elif end_date:
                        ed = timezone.make_aware(
                            datetime.strptime(end_date, '%Y-%m-%d').replace(
                                hour=23, minute=59, second=59, microsecond=999999))
                        queryset = queryset.filter(
                            created_at__lte=ed)
                except ValueError:
                    return Response(
                        {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # ── Empty result shortcut ───────────────────────────────────
            if not queryset.exists():
                return Response({
                    'users': [],
                    'summary': {
                        'total_users': 0,
                        'total_responses': 0,
                        'total_cities': 0,
                        'date_range': (
                            {'start_date': start_date, 'end_date': end_date}
                            if start_date and end_date else None
                        ),
                        'campaigns': [],
                    }
                }, status=status.HTTP_200_OK)

            # ── Aggregate: user → {stats, city set} ────────────────────
            user_data = defaultdict(lambda: {
                'user_id': None,
                'name': None,
                'role': None,
                'cities': set(),
                'ja': 0,
                'nei': 0,
                'ikke_hjemme': 0,
                'total': 0,
            })

            for activity in queryset.select_related('employee', 'manager'):
                metadata = activity.metadata
                address_text = metadata.get('address_text', '')
                status_value = normalize_status_value(metadata.get('status', ''))

                # Identify user
                if activity.employee_id:
                    user_key = str(activity.employee_id)
                    role = 'employee'
                    name = (
                        activity.employee.name
                        if activity.employee else metadata.get('user_name', 'Unknown')
                    )
                elif activity.manager_id:
                    user_key = str(activity.manager_id)
                    role = 'manager'
                    name = (
                        activity.manager.name
                        if activity.manager else metadata.get('user_name', 'Unknown')
                    )
                else:
                    user_key = f"SU-{metadata.get('user_name', 'Unknown')}"
                    role = 'superuser'
                    name = metadata.get('user_name', 'Unknown')

                ud = user_data[user_key]
                ud['user_id'] = user_key
                ud['name'] = name
                ud['role'] = role
                ud['total'] += 1

                # Status counts
                if status_value == 'Ja':
                    ud['ja'] += 1
                elif status_value == 'Nei':
                    ud['nei'] += 1
                elif status_value == 'Ikke Hjemme':
                    ud['ikke_hjemme'] += 1

                # Extract city for unique-city count
                city = extract_city_from_address(address_text)
                ud['cities'].add(city)

            # ── Build response list ─────────────────────────────────────
            users_list = []
            all_cities = set()

            for ud in user_data.values():
                total = ud['total']
                all_cities.update(ud['cities'])

                users_list.append({
                    'user_id': ud['user_id'],
                    'name': ud['name'],
                    'role': ud['role'],
                    'total_responses': total,
                    'total_cities': len(ud['cities']),
                    'ja_percentage': round(ud['ja'] / total * 100, 1) if total else 0.0,
                    'nei_percentage': round(ud['nei'] / total * 100, 1) if total else 0.0,
                    'ikke_hjemme_percentage': round(ud['ikke_hjemme'] / total * 100, 1) if total else 0.0,
                })

            # Sort by total_responses descending
            users_list.sort(key=lambda u: u['total_responses'], reverse=True)

            # ── Campaign names for summary ──────────────────────────────
            campaign_objs = Campaign.objects.filter(id__in=campaign_ids).only('id', 'name')
            campaign_list = [
                {'campaign_id': str(c.id), 'campaign_name': c.name}
                for c in campaign_objs
            ]

            summary = {
                'total_users': len(users_list),
                'total_responses': sum(u['total_responses'] for u in users_list),
                'total_cities': len(all_cities),
                'date_range': (
                    {'start_date': start_date, 'end_date': end_date}
                    if start_date and end_date else None
                ),
                'campaigns': campaign_list,
            }

            logger.info(
                f"TableDataView summary: {summary['total_users']} users, "
                f"{summary['total_responses']} responses, "
                f"{summary['total_cities']} cities"
            )

            return Response({
                'users': users_list,
                'summary': summary,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in TableDataView: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while generating user summaries'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class TableDataAddressesView(APIView):
    """
    Detail endpoint: returns all cities and addresses for a single user.

    Called when the frontend expands a user row to show the city → address
    hierarchy.  The same campaign_ids / date filters used in the summary
    endpoint should be forwarded here so the results are consistent.

    Query parameters
    ----------------
    user_id : str (required)
        Employee or Manager UUID (the ``user_id`` value from ``/table-data/``).
    campaign_ids : str (required)
        Comma-separated campaign UUIDs.
    start_date : str (optional)
        YYYY-MM-DD
    end_date : str (optional)
        YYYY-MM-DD
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]

    @extend_schema(
        summary="Get cities and addresses for a specific user",
        description=(
            "Returns the full city → address hierarchy for a single user. "
            "Pass the same campaign_ids and date range used in the summary "
            "endpoint (/activity/table-data/) so results are consistent."
        ),
        parameters=[
            OpenApiParameter(name='user_id', type=str, required=True,
                             description='User ID (employee_id or manager_id UUID)'),
            OpenApiParameter(name='campaign_ids', type=str, required=True,
                             description='Comma-separated list of campaign UUIDs'),
            OpenApiParameter(name='start_date', type=str, required=False,
                             description='Start date in ISO format (YYYY-MM-DD)'),
            OpenApiParameter(name='end_date', type=str, required=False,
                             description='End date in ISO format (YYYY-MM-DD)'),
        ],
        responses={
            200: OpenApiResponse(
                description="Hierarchical city → address data for one user",
                response={
                    "type": "object",
                    "properties": {
                        "user_id": {"type": "string"},
                        "user_name": {"type": "string"},
                        "user_role": {"type": "string"},
                        "total_responses": {"type": "integer"},
                        "cities": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "city_name": {"type": "string"},
                                    "total": {"type": "integer"},
                                    "ja_count": {"type": "integer"},
                                    "nei_count": {"type": "integer"},
                                    "ikke_hjemme_count": {"type": "integer"},
                                    "ja_percentage": {"type": "number"},
                                    "nei_percentage": {"type": "number"},
                                    "ikke_hjemme_percentage": {"type": "number"},
                                    "addresses": {
                                        "type": "array",
                                        "items": {"type": "object"}
                                    },
                                }
                            }
                        },
                    }
                }
            ),
            400: OpenApiResponse(description="Bad request"),
            404: OpenApiResponse(description="User not found"),
        }
    )
    def get(self, request):
        """Return cities → addresses hierarchy for a single user."""
        from .utils import (
            extract_city_from_address,
            parse_address_components,
            normalize_status_value,
        )
        from collections import defaultdict

        try:
            # ── Parse & validate params ─────────────────────────────────
            user_id = request.query_params.get('user_id')
            campaign_ids_param = request.query_params.get('campaign_ids')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')

            if not user_id:
                return Response(
                    {'error': 'user_id parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not campaign_ids_param:
                return Response(
                    {'error': 'campaign_ids parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            campaign_ids = [
                cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()
            ]
            if not campaign_ids:
                return Response(
                    {'error': 'At least one valid campaign ID is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logger.info(
                f"TableDataAddressesView for user={user_id}, "
                f"campaigns={campaign_ids}"
            )

            # ── Resolve user (employee or manager) ──────────────────────
            user_name = 'Unknown'
            user_role = 'unknown'

            # Check if user_id starts with "SU-" (superuser key from summary)
            if user_id.startswith('SU-'):
                # Superuser — filter by metadata user_name
                su_name = user_id[3:]  # strip "SU-" prefix
                user_name = su_name
                user_role = 'superuser'
                queryset = Activity.objects.filter(
                    campaign_id__in=campaign_ids,
                    activity_type='address_contact',
                    employee__isnull=True,
                    manager__isnull=True,
                    metadata__user_name=su_name,
                )
            else:
                # Validate UUID format before DB lookup
                import uuid as uuid_mod
                try:
                    uuid_mod.UUID(user_id)
                except (ValueError, AttributeError):
                    return Response(
                        {'error': f'Invalid user_id format: {user_id}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Try employee first, then manager
                try:
                    employee = Employee.objects.get(id=user_id)
                    user_name = employee.name
                    user_role = 'employee'
                    queryset = Activity.objects.filter(
                        campaign_id__in=campaign_ids,
                        activity_type='address_contact',
                        employee=employee,
                    )
                except Employee.DoesNotExist:
                    try:
                        manager = Manager.objects.get(id=user_id)
                        user_name = manager.name
                        user_role = 'manager'
                        queryset = Activity.objects.filter(
                            campaign_id__in=campaign_ids,
                            activity_type='address_contact',
                            manager=manager,
                        )
                    except Manager.DoesNotExist:
                        return Response(
                            {'error': f'User with id {user_id} not found'},
                            status=status.HTTP_404_NOT_FOUND,
                        )

            # ── Date filtering ──────────────────────────────────────────
            # Use the model's created_at DateTimeField (indexed) instead
            # of metadata__recorded_at (JSONB string — unreliable).
            if start_date or end_date:
                try:
                    if start_date and end_date:
                        sd = timezone.make_aware(
                            datetime.strptime(start_date, '%Y-%m-%d').replace(
                                hour=0, minute=0, second=0, microsecond=0))
                        ed = timezone.make_aware(
                            datetime.strptime(end_date, '%Y-%m-%d').replace(
                                hour=23, minute=59, second=59, microsecond=999999))
                        queryset = queryset.filter(
                            created_at__range=(sd, ed))
                    elif start_date:
                        sd = timezone.make_aware(
                            datetime.strptime(start_date, '%Y-%m-%d').replace(
                                hour=0, minute=0, second=0, microsecond=0))
                        queryset = queryset.filter(
                            created_at__gte=sd)
                    elif end_date:
                        ed = timezone.make_aware(
                            datetime.strptime(end_date, '%Y-%m-%d').replace(
                                hour=23, minute=59, second=59, microsecond=999999))
                        queryset = queryset.filter(
                            created_at__lte=ed)
                except ValueError:
                    return Response(
                        {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # ── Empty check ─────────────────────────────────────────────
            if not queryset.exists():
                return Response({
                    'user_id': user_id,
                    'user_name': user_name,
                    'user_role': user_role,
                    'total_responses': 0,
                    'cities': [],
                }, status=status.HTTP_200_OK)

            # ── Group activities by city ─────────────────────────────────
            # city_name → { stats, addresses[] }
            city_data = defaultdict(lambda: {
                'ja': 0, 'nei': 0, 'ikke_hjemme': 0, 'total': 0,
                'addresses': [],
            })

            total_responses = 0

            for activity in queryset:
                metadata = activity.metadata
                address_text = metadata.get('address_text', '')
                raw_status = metadata.get('status', '')
                norm_status = normalize_status_value(raw_status)

                parsed = parse_address_components(address_text)
                city_name = parsed['city'] or 'Unknown'

                cd = city_data[city_name]
                cd['total'] += 1
                total_responses += 1

                if norm_status == 'Ja':
                    cd['ja'] += 1
                elif norm_status == 'Nei':
                    cd['nei'] += 1
                elif norm_status == 'Ikke Hjemme':
                    cd['ikke_hjemme'] += 1

                cd['addresses'].append({
                    'address_id': metadata.get('address_id'),
                    'address_text': address_text,
                    'base_address': parsed['base_address'],
                    'apartment_number': parsed['apartment_number'],
                    'status': raw_status,
                    'position': metadata.get('position'),
                    'tags': metadata.get('tags', {}),
                    'recorded_at': metadata.get('recorded_at'),
                    'campaign_id': metadata.get('campaign_id'),
                    'campaign_name': metadata.get('campaign_name'),
                })

            # ── Build response ──────────────────────────────────────────
            cities_list = []
            for city_name, cd in city_data.items():
                total = cd['total']
                # Sort addresses by recorded_at descending
                cd['addresses'].sort(
                    key=lambda a: a.get('recorded_at', ''), reverse=True
                )

                cities_list.append({
                    'city_name': city_name,
                    'total': total,
                    'ja_count': cd['ja'],
                    'nei_count': cd['nei'],
                    'ikke_hjemme_count': cd['ikke_hjemme'],
                    'ja_percentage': round(cd['ja'] / total * 100, 1) if total else 0.0,
                    'nei_percentage': round(cd['nei'] / total * 100, 1) if total else 0.0,
                    'ikke_hjemme_percentage': round(cd['ikke_hjemme'] / total * 100, 1) if total else 0.0,
                    'addresses': cd['addresses'],
                })

            # Sort cities by total descending
            cities_list.sort(key=lambda c: c['total'], reverse=True)

            logger.info(
                f"TableDataAddressesView: user={user_id}, "
                f"{len(cities_list)} cities, {total_responses} addresses"
            )

            return Response({
                'user_id': user_id,
                'user_name': user_name,
                'user_role': user_role,
                'total_responses': total_responses,
                'cities': cities_list,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in TableDataAddressesView: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while loading user addresses'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class SalesPageView(APIView):
    """View for sales page data with gavebeløp annotation."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Get sales page data with donation amounts",
        description="Returns all Activity records for a specific campaign and optional date range, annotated with gavebeløp (donation amount) from matching CampaignForm records. If no dates provided, returns all entries for the campaign. Optional user filtering by employee_id or manager_id.",
        parameters=[
            OpenApiParameter(name='campaign_id', type=str, required=True, description='Campaign ID (UUID)'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date (YYYY-MM-DD). If not provided, no start date filtering is applied.'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date (YYYY-MM-DD). If not provided, no end date filtering is applied.'),
            OpenApiParameter(name='employee_id', type=str, required=False, description='Filter by specific employee ID (UUID). If not provided, no employee filtering is applied.'),
            OpenApiParameter(name='manager_id', type=str, required=False, description='Filter by specific manager ID (UUID). If not provided, no manager filtering is applied.'),
        ],
        responses={
            200: SalesPageSerializer(many=True),
            400: "Bad Request - Missing campaign_id parameter",
            404: "Not Found - Campaign not found"
        },
        examples=[
            OpenApiExample(
                'Success Response',
                value=[
                    {
                        'seller': 'Dana Barzinje',
                        'campaign_name': 'Norsk folkehjelp',
                        'date': '2025-07-28T02:28:00.513Z',
                        'gavebelop': 325.00
                    }
                ],
                response_only=True
            )
        ]
    )
    def get(self, request):
        campaign_id = request.query_params.get("campaign_id")
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        employee_id = request.query_params.get("employee_id")
        manager_id = request.query_params.get("manager_id")

        # Validate required parameters
        if not campaign_id:
            return Response(
                {'detail': 'campaign_id is a required parameter'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate campaign exists
        try:
            campaign = Campaign.objects.get(id=campaign_id)
        except Campaign.DoesNotExist:
            return Response(
                {'detail': 'Campaign not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Validate user IDs if provided
        if employee_id:
            try:
                from users.models import Employee
                Employee.objects.get(id=employee_id)
            except Employee.DoesNotExist:
                return Response(
                    {'detail': 'Employee not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        if manager_id:
            try:
                from users.models import Manager
                Manager.objects.get(id=manager_id)
            except Manager.DoesNotExist:
                return Response(
                    {'detail': 'Manager not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )

        # Subquery: grab the first matching CampaignForm.gavebeløp for this activity
        # Match by campaign, same user (employee/manager), and same date
        from django.db.models import Q
        
        form_amount_sq = CampaignForm.objects.filter(
            Q(campaign_id=OuterRef("campaign_id")) &
            Q(current_date__date=OuterRef("created_at__date")) &  # Same date
            (Q(sales_rep_id=OuterRef("employee_id")) | Q(sales_rep_id=OuterRef("manager_id")))  # Same user
        ).values("gavebeløp")[:1]

        # Start with base queryset filtered by campaign
        qs = Activity.objects.filter(campaign_id=campaign_id)
        
        # Apply user filters if provided
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if manager_id:
            qs = qs.filter(manager_id=manager_id)
        
        # Apply date filters only if provided
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)
        
        # Annotate with gavebelop and order by created_at descending
        qs = qs.annotate(
            gavebelop=Subquery(form_amount_sq, output_field=FloatField())
        ).order_by("-created_at")

        serializer = SalesPageSerializer(qs, many=True)
        return Response(serializer.data)


class DashboardStatsView(APIView):
    """
    View for dashboard statistics API.
    
    Returns comprehensive statistics for the current user including:
    - Total contacts
    - Status counts (Ja, Nei, Ikke Hjemme, Følg Opp)
    - Status percentages
    - Average per day
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Get dashboard statistics for current user",
        description="Returns comprehensive statistics for the current user including total contacts, status counts, percentages, and calculated metrics. Supports campaign and date filtering.",
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=False, description='Comma-separated campaign UUIDs. Omit for all campaigns.'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date (YYYY-MM-DD). Omit for all-time.'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date (YYYY-MM-DD). Omit for all-time.'),
            OpenApiParameter(name='include_percentages', type=bool, required=False, description='Include percentage calculations', default=True),
        ],
        responses={
            200: OpenApiResponse(
                description="Dashboard statistics",
                response={
                    "type": "object",
                    "properties": {
                        "filters": {"type": "object"},
                        "summary": {"type": "object"},
                        "status_counts": {"type": "object"},
                        "status_percentages": {"type": "object"},
                        "calculated_metrics": {"type": "object"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Get dashboard statistics for current user."""
        try:
            # Get current user
            user = request.user
            if not hasattr(user, 'employee') and not hasattr(user, 'manager'):
                return Response(
                    {'error': 'User must be an employee or manager'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get query parameters
            campaign_ids_param = request.query_params.get('campaign_ids')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            include_percentages = request.query_params.get('include_percentages', 'true').lower() == 'true'
            
            # Start with base queryset - filter by user and activity type
            queryset = Activity.objects.filter(activity_type='address_contact')
            
            # Filter by current user
            if hasattr(user, 'employee') and user.employee:
                queryset = queryset.filter(employee=user.employee)
            elif hasattr(user, 'manager') and user.manager:
                queryset = queryset.filter(manager=user.manager)
            
            # Parse campaign filter
            campaign_ids = None
            all_campaigns = False
            if campaign_ids_param:
                try:
                    campaign_ids = [cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()]
                    if campaign_ids:
                        queryset = queryset.filter(campaign_id__in=campaign_ids)
                except Exception as e:
                    logger.error(f"Error parsing campaign_ids: {e}")
                    return Response(
                        {'error': 'Invalid campaign_ids format. Use comma-separated UUIDs.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                all_campaigns = True
            
            # Parse date filter
            all_time = False
            start_datetime = None
            end_datetime = None
            
            if start_date or end_date:
                try:
                    if start_date:
                        start_datetime = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
                    if end_date:
                        end_datetime = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
                    
                    if start_datetime and end_datetime:
                        queryset = queryset.filter(created_at__range=(start_datetime, end_datetime))
                    elif start_datetime:
                        queryset = queryset.filter(created_at__gte=start_datetime)
                    elif end_datetime:
                        queryset = queryset.filter(created_at__lt=end_datetime)
                except ValueError as e:
                    logger.error(f"Error parsing dates: {e}")
                    return Response(
                        {'error': 'Invalid date format. Use YYYY-MM-DD format.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                all_time = True
            
            # Count by status
            ja_count = 0
            nei_count = 0
            ikke_hjemme_count = 0
            folg_opp_count = 0
            
            for activity in queryset:
                status_value = activity.metadata.get('status', '').lower()
                
                if status_value in ['ja', 'yes', 'positive']:
                    ja_count += 1
                elif status_value in ['nei', 'no', 'negative']:
                    nei_count += 1
                elif status_value in ['ikke_hjemme', 'not_home', 'not at home', 'ikke hjemme', 'ikke heime']:
                    ikke_hjemme_count += 1
                elif status_value in ['folg_opp', 'follow_up', 'følg opp', 'folg opp']:
                    folg_opp_count += 1
            
            # Calculate total
            total_responses = ja_count + nei_count + ikke_hjemme_count + folg_opp_count
            
            # Calculate days in range
            days_in_range = None
            avg_per_day = None
            if start_datetime and end_datetime:
                days_in_range = (end_datetime.date() - start_datetime.date()).days
                if days_in_range > 0:
                    avg_per_day = round(total_responses / days_in_range, 2)
            elif all_time:
                # For all-time, calculate from first activity to now
                first_activity = queryset.order_by('created_at').first()
                if first_activity:
                    days_in_range = (timezone.now().date() - first_activity.created_at.date()).days + 1
                    if days_in_range > 0:
                        avg_per_day = round(total_responses / days_in_range, 2)
            
            # Calculate percentages
            status_percentages = {}
            calculated_metrics = {}
            
            if include_percentages and total_responses > 0:
                status_percentages = {
                    'ja': round((ja_count / total_responses) * 100, 1),
                    'nei': round((nei_count / total_responses) * 100, 1),
                    'ikke_hjemme': round((ikke_hjemme_count / total_responses) * 100, 1),
                    'folg_opp': round((folg_opp_count / total_responses) * 100, 1)
                }
                
                calculated_metrics = {
                    'hit_rate': status_percentages['ja'],
                    'rejection_rate': status_percentages['nei'],
                    'no_answer_rate': status_percentages['ikke_hjemme'],
                    'follow_up_rate': status_percentages['folg_opp']
                }
            
            # Build response
            response_data = {
                'filters': {
                    'campaign_ids': campaign_ids if campaign_ids else [],
                    'start_date': start_date,
                    'end_date': end_date,
                    'all_campaigns': all_campaigns,
                    'all_time': all_time
                },
                'summary': {
                    'total_responses': total_responses,
                    'days_in_range': days_in_range,
                    'avg_per_day': avg_per_day
                },
                'status_counts': {
                    'ja': ja_count,
                    'nei': nei_count,
                    'ikke_hjemme': ikke_hjemme_count,
                    'folg_opp': folg_opp_count
                }
            }
            
            if include_percentages:
                response_data['status_percentages'] = status_percentages
                response_data['calculated_metrics'] = calculated_metrics
            
            logger.info(f"Generated dashboard stats for user {user.id}: {total_responses} total responses")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating dashboard stats: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while generating dashboard stats'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardTrendsView(APIView):
    """
    View for dashboard trends API.
    
    Returns daily trend data for line chart showing contacts per day,
    broken down by status (4 separate data series).
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Get dashboard trends for current user",
        description="Returns daily trend data broken down by status (Ja, Nei, Ikke Hjemme, Følg Opp) for multi-line chart visualization. Supports campaign and date filtering.",
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=False, description='Comma-separated campaign UUIDs. Omit for all campaigns.'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date (YYYY-MM-DD). Defaults to 30 days ago if not provided.'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date (YYYY-MM-DD). Defaults to today if not provided.'),
            OpenApiParameter(name='group_by', type=str, required=False, description='Grouping period: day, week, month', enum=['day', 'week', 'month'], default='day'),
        ],
        responses={
            200: OpenApiResponse(
                description="Dashboard trends data",
                response={
                    "type": "object",
                    "properties": {
                        "filters": {"type": "object"},
                        "date_range": {"type": "object"},
                        "trends": {"type": "object"},
                        "summary": {"type": "object"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Get dashboard trends for current user."""
        try:
            # Get current user
            user = request.user
            if not hasattr(user, 'employee') and not hasattr(user, 'manager'):
                return Response(
                    {'error': 'User must be an employee or manager'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get query parameters
            campaign_ids_param = request.query_params.get('campaign_ids')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            group_by = request.query_params.get('group_by', 'day')
            
            # Start with base queryset
            queryset = Activity.objects.filter(activity_type='address_contact')
            
            # Filter by current user
            if hasattr(user, 'employee') and user.employee:
                queryset = queryset.filter(employee=user.employee)
            elif hasattr(user, 'manager') and user.manager:
                queryset = queryset.filter(manager=user.manager)
            
            # Parse campaign filter
            campaign_ids = None
            all_campaigns = False
            if campaign_ids_param:
                try:
                    campaign_ids = [cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()]
                    if campaign_ids:
                        queryset = queryset.filter(campaign_id__in=campaign_ids)
                except Exception as e:
                    logger.error(f"Error parsing campaign_ids: {e}")
                    return Response(
                        {'error': 'Invalid campaign_ids format. Use comma-separated UUIDs.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                all_campaigns = True
            
            # Parse date filter (default to last 30 days if not provided)
            all_time = False
            if start_date or end_date:
                try:
                    if start_date:
                        start_datetime = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
                    else:
                        start_datetime = timezone.now() - timedelta(days=30)
                        start_datetime = start_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
                    
                    if end_date:
                        end_datetime = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
                    else:
                        end_datetime = timezone.now()
                    
                    queryset = queryset.filter(created_at__range=(start_datetime, end_datetime))
                except ValueError as e:
                    logger.error(f"Error parsing dates: {e}")
                    return Response(
                        {'error': 'Invalid date format. Use YYYY-MM-DD format.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                # Default to last 30 days
                end_datetime = timezone.now()
                start_datetime = end_datetime - timedelta(days=30)
                start_datetime = start_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
                queryset = queryset.filter(created_at__range=(start_datetime, end_datetime))
            
            # Generate date range
            current_date = start_datetime.date()
            end_date_obj = end_datetime.date()
            date_list = []
            
            while current_date <= end_date_obj:
                date_list.append(current_date)
                current_date += timedelta(days=1)
            
            # Initialize trend arrays
            trends = {
                'ja': [],
                'nei': [],
                'ikke_hjemme': [],
                'folg_opp': []
            }
            
            # Count by date and status
            for date_obj in date_list:
                day_start = timezone.make_aware(datetime.combine(date_obj, datetime.min.time()))
                day_end = timezone.make_aware(datetime.combine(date_obj, datetime.max.time()))
                
                day_queryset = queryset.filter(created_at__range=(day_start, day_end))
                
                ja_count = 0
                nei_count = 0
                ikke_hjemme_count = 0
                folg_opp_count = 0
                
                for activity in day_queryset:
                    status_value = activity.metadata.get('status', '').lower()
                    
                    if status_value in ['ja', 'yes', 'positive']:
                        ja_count += 1
                    elif status_value in ['nei', 'no', 'negative']:
                        nei_count += 1
                    elif status_value in ['ikke_hjemme', 'not_home', 'not at home', 'ikke hjemme', 'ikke heime']:
                        ikke_hjemme_count += 1
                    elif status_value in ['folg_opp', 'follow_up', 'følg opp', 'folg opp']:
                        folg_opp_count += 1
                
                date_str = date_obj.isoformat()
                trends['ja'].append({'date': date_str, 'count': ja_count})
                trends['nei'].append({'date': date_str, 'count': nei_count})
                trends['ikke_hjemme'].append({'date': date_str, 'count': ikke_hjemme_count})
                trends['folg_opp'].append({'date': date_str, 'count': folg_opp_count})
            
            # Calculate summary totals
            total_by_status = {
                'ja': sum(item['count'] for item in trends['ja']),
                'nei': sum(item['count'] for item in trends['nei']),
                'ikke_hjemme': sum(item['count'] for item in trends['ikke_hjemme']),
                'folg_opp': sum(item['count'] for item in trends['folg_opp'])
            }
            
            # Build response
            response_data = {
                'filters': {
                    'campaign_ids': campaign_ids if campaign_ids else [],
                    'start_date': start_date or start_datetime.date().isoformat(),
                    'end_date': end_date or end_datetime.date().isoformat(),
                    'group_by': group_by,
                    'all_campaigns': all_campaigns,
                    'all_time': all_time
                },
                'date_range': {
                    'start': start_datetime.date().isoformat(),
                    'end': end_datetime.date().isoformat(),
                    'periods': len(date_list)
                },
                'trends': trends,
                'summary': {
                    'total_by_status': total_by_status
                }
            }
            
            logger.info(f"Generated dashboard trends for user {user.id}: {len(date_list)} periods")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating dashboard trends: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while generating dashboard trends'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardFollowUpsView(APIView):
    """
    View for dashboard follow-ups API.
    
    Returns list of addresses requiring follow-up (status='folg_opp') for current user.
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Get follow-up addresses for current user",
        description="Returns list of addresses with status='folg_opp' for the current user. Supports campaign filtering and pagination.",
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=False, description='Comma-separated campaign UUIDs. Omit for all campaigns.'),
            OpenApiParameter(name='limit', type=int, required=False, description='Maximum number of results', default=50),
            OpenApiParameter(name='offset', type=int, required=False, description='Pagination offset', default=0),
        ],
        responses={
            200: OpenApiResponse(
                description="Follow-up addresses",
                response={
                    "type": "object",
                    "properties": {
                        "count": {"type": "integer"},
                        "next": {"type": "string", "nullable": True},
                        "previous": {"type": "string", "nullable": True},
                        "results": {"type": "array"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Get follow-up addresses for current user."""
        try:
            # Get current user
            user = request.user
            if not hasattr(user, 'employee') and not hasattr(user, 'manager'):
                return Response(
                    {'error': 'User must be an employee or manager'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get query parameters
            campaign_ids_param = request.query_params.get('campaign_ids')
            limit = int(request.query_params.get('limit', 50))
            offset = int(request.query_params.get('offset', 0))
            
            # Start with base queryset - filter by status
            queryset = Address.objects.filter(status='folg_opp')
            
            # Filter by current user
            if hasattr(user, 'employee') and user.employee:
                queryset = queryset.filter(employee=user.employee)
            elif hasattr(user, 'manager') and user.manager:
                queryset = queryset.filter(manager=user.manager)
            
            # Parse campaign filter
            campaign_ids = None
            if campaign_ids_param:
                try:
                    campaign_ids = [cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()]
                    if campaign_ids:
                        queryset = queryset.filter(campaign_id__in=campaign_ids)
                except Exception as e:
                    logger.error(f"Error parsing campaign_ids: {e}")
                    return Response(
                        {'error': 'Invalid campaign_ids format. Use comma-separated UUIDs.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Order by recorded_at descending (newest first)
            queryset = queryset.order_by('-recorded_at')
            
            # Get total count
            total_count = queryset.count()
            
            # Apply pagination
            end_index = offset + limit
            addresses_page = queryset[offset:end_index]
            
            # Serialize results
            from addresses.serializers import AddressSerializer
            serializer = AddressSerializer(addresses_page, many=True)
            
            # Build pagination URLs
            next_url = None
            previous_url = None
            
            if end_index < total_count:
                next_url = f"{request.path}?limit={limit}&offset={end_index}"
                if campaign_ids_param:
                    next_url += f"&campaign_ids={campaign_ids_param}"
            
            if offset > 0:
                prev_offset = max(0, offset - limit)
                previous_url = f"{request.path}?limit={limit}&offset={prev_offset}"
                if campaign_ids_param:
                    previous_url += f"&campaign_ids={campaign_ids_param}"
            
            response_data = {
                'count': total_count,
                'next': next_url,
                'previous': previous_url,
                'results': serializer.data
            }
            
            logger.info(f"Generated follow-ups for user {user.id}: {total_count} total, showing {len(serializer.data)}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating follow-ups: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while generating follow-ups'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardRecentActivitiesView(APIView):
    """
    View for dashboard recent activities API.
    
    Returns recent activity records for current user, sorted by date descending.
    """
    permission_classes = [permissions.IsAuthenticated, DashboardPermission]
    
    @extend_schema(
        summary="Get recent activities for current user",
        description="Returns recent activity records for the current user, sorted by date descending. Supports campaign, date, and status filtering.",
        parameters=[
            OpenApiParameter(name='campaign_ids', type=str, required=False, description='Comma-separated campaign UUIDs. Omit for all campaigns.'),
            OpenApiParameter(name='start_date', type=str, required=False, description='Start date filter (YYYY-MM-DD)'),
            OpenApiParameter(name='end_date', type=str, required=False, description='End date filter (YYYY-MM-DD)'),
            OpenApiParameter(name='limit', type=int, required=False, description='Maximum number of results', default=50),
            OpenApiParameter(name='status', type=str, required=False, description='Filter by status: ja, nei, ikke_hjemme, folg_opp', enum=['ja', 'nei', 'ikke_hjemme', 'folg_opp']),
        ],
        responses={
            200: OpenApiResponse(
                description="Recent activities",
                response={
                    "type": "object",
                    "properties": {
                        "count": {"type": "integer"},
                        "results": {"type": "array"}
                    }
                }
            )
        }
    )
    def get(self, request):
        """Get recent activities for current user."""
        try:
            # Get current user
            user = request.user
            if not hasattr(user, 'employee') and not hasattr(user, 'manager'):
                return Response(
                    {'error': 'User must be an employee or manager'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get query parameters
            campaign_ids_param = request.query_params.get('campaign_ids')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            limit = int(request.query_params.get('limit', 50))
            status_filter = request.query_params.get('status')
            
            # Start with base queryset - filter by activity type
            queryset = Activity.objects.filter(activity_type='address_contact')
            
            # Filter by current user
            if hasattr(user, 'employee') and user.employee:
                queryset = queryset.filter(employee=user.employee)
            elif hasattr(user, 'manager') and user.manager:
                queryset = queryset.filter(manager=user.manager)
            
            # Parse campaign filter
            if campaign_ids_param:
                try:
                    campaign_ids = [cid.strip() for cid in campaign_ids_param.split(',') if cid.strip()]
                    if campaign_ids:
                        queryset = queryset.filter(campaign_id__in=campaign_ids)
                except Exception as e:
                    logger.error(f"Error parsing campaign_ids: {e}")
                    return Response(
                        {'error': 'Invalid campaign_ids format. Use comma-separated UUIDs.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Parse date filter
            if start_date or end_date:
                try:
                    if start_date:
                        start_datetime = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
                        queryset = queryset.filter(created_at__gte=start_datetime)
                    if end_date:
                        end_datetime = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
                        queryset = queryset.filter(created_at__lt=end_datetime)
                except ValueError as e:
                    logger.error(f"Error parsing dates: {e}")
                    return Response(
                        {'error': 'Invalid date format. Use YYYY-MM-DD format.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Parse status filter
            if status_filter:
                status_filter_lower = status_filter.lower()
                # Filter by status in metadata
                queryset = queryset.filter(
                    metadata__status__iexact=status_filter_lower
                )
            
            # Order by created_at descending (newest first)
            queryset = queryset.order_by('-created_at')
            
            # Get total count
            total_count = queryset.count()
            
            # Apply limit
            activities = queryset[:limit]
            
            # Format results
            results = []
            for activity in activities:
                metadata = activity.metadata or {}
                status_value = metadata.get('status', '')
                
                results.append({
                    'id': str(activity.id),
                    'status': status_value,
                    'address_text': metadata.get('address_text', ''),
                    'recorded_at': metadata.get('recorded_at') or activity.created_at.isoformat(),
                    'created_at': activity.created_at.isoformat(),
                    'campaign': {
                        'id': str(activity.campaign.id) if activity.campaign else None,
                        'name': activity.campaign.name if activity.campaign else None
                    } if activity.campaign else None,
                    'metadata': metadata
                })
            
            response_data = {
                'count': total_count,
                'results': results
            }
            
            logger.info(f"Generated recent activities for user {user.id}: {total_count} total, showing {len(results)}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating recent activities: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Internal server error while generating recent activities'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
