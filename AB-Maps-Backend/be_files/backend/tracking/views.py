"""
Views for the tracking app.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta
from .models import LocationPing, SyncQueueItem, WorkSession
from .serializers import (
    LocationPingSerializer,
    LocationPingGeoSerializer,
    SyncQueueItemSerializer,
    WorkSessionSerializer,
)
from .permissions import TrackingPermission, SyncQueuePermission
from .services import (
    get_working_seconds_today,
    ACTIVE_THRESHOLD_SECONDS,
)
from users.models import Employee, Manager


class LocationPingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for LocationPing model.
    
    Provides full CRUD operations for location tracking data.
    Supports filtering by device_id, employee, and date ranges.
    """
    queryset = LocationPing.objects.all()
    serializer_class = LocationPingSerializer
    permission_classes = [TrackingPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['device_id', 'employee', 'manager', 'timestamp', 'is_moving']
    search_fields = ['device_id']
    ordering_fields = ['timestamp', 'device_id']
    ordering = ['-timestamp']
    
    def get_queryset(self):
        """Filter queryset based on user type and permissions."""
        user = self.request.user
        
        # Managers can view all location data
        if hasattr(user, 'manager') and user.manager:
            return LocationPing.objects.all()
        
        # Employees can only view their own location data
        if hasattr(user, 'employee') and user.employee:
            return LocationPing.objects.filter(employee=user.employee)
        
        # Admin users cannot view any tracking data
        return LocationPing.objects.none()
    
    def get_serializer_class(self):
        """Use GeoJSON serializer for specific actions."""
        if self.action in ['list', 'retrieve'] and self.request.query_params.get('format') == 'geojson':
            return LocationPingGeoSerializer
        return LocationPingSerializer
    
    def perform_create(self, serializer):
        """Set the user (employee or manager) who created the location ping."""
        user = self.request.user
        
        if hasattr(user, 'employee') and user.employee:
            serializer.save(employee=user.employee)
        elif hasattr(user, 'manager') and user.manager:
            serializer.save(manager=user.manager)
        else:
            serializer.save()
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get the latest location for each employee."""
        user = self.request.user
        
        if not (hasattr(user, 'manager') and user.manager):
            return Response(
                {'error': 'Only managers can access this endpoint'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get latest location for each employee
        from django.db.models import Max
        latest_pings = LocationPing.objects.filter(
            employee__isnull=False
        ).values('employee').annotate(
            latest_timestamp=Max('timestamp')
        )
        
        latest_locations = []
        for ping in latest_pings:
            location = LocationPing.objects.filter(
                employee_id=ping['employee'],
                timestamp=ping['latest_timestamp']
            ).first()
            
            if location:
                serializer = self.get_serializer(location)
                latest_locations.append(serializer.data)
        
        return Response(latest_locations)
    
    @action(detail=False, methods=['get'])
    def by_employee(self, request):
        """Get location history for a specific employee."""
        user = self.request.user
        employee_id = request.query_params.get('employee_id')
        
        if not employee_id:
            return Response(
                {'error': 'employee_id parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Managers can view any employee's data
        if hasattr(user, 'manager') and user.manager:
            queryset = LocationPing.objects.filter(employee_id=employee_id)
        # Employees can only view their own data
        elif hasattr(user, 'employee') and user.employee and str(user.employee.id) == employee_id:
            queryset = LocationPing.objects.filter(employee=user.employee)
        else:
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Apply time filter if provided
        hours = request.query_params.get('hours', 24)
        try:
            hours = int(hours)
            cutoff_time = timezone.now() - timedelta(hours=hours)
            queryset = queryset.filter(timestamp__gte=cutoff_time)
        except ValueError:
            pass
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def real_time(self, request):
        """Get real-time location data for all employees (managers only)."""
        user = self.request.user
        
        if not (hasattr(user, 'manager') and user.manager):
            return Response(
                {'error': 'Only managers can access this endpoint'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get locations from the last 5 minutes
        cutoff_time = timezone.now() - timedelta(minutes=5)
        recent_locations = LocationPing.objects.filter(
            employee__isnull=False,
            timestamp__gte=cutoff_time
        ).select_related('employee')
        
        serializer = self.get_serializer(recent_locations, many=True)
        return Response(serializer.data)


class SyncQueueItemViewSet(viewsets.ModelViewSet):
    """ViewSet for SyncQueueItem model."""
    queryset = SyncQueueItem.objects.all()
    serializer_class = SyncQueueItemSerializer
    permission_classes = [SyncQueuePermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_synced', 'created_at']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['patch'])
    def mark_synced(self, request, pk=None):
        """Mark a sync queue item as synced."""
        sync_item = self.get_object()
        sync_item.is_synced = True
        sync_item.synced_at = timezone.now()
        sync_item.save()
        
        serializer = self.get_serializer(sync_item)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_sync(self, request):
        """Mark multiple sync items as synced."""
        item_ids = request.data.get('item_ids', [])
        
        if not item_ids:
            return Response(
                {'error': 'item_ids parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updated_count = SyncQueueItem.objects.filter(
            id__in=item_ids
        ).update(
            is_synced=True,
            synced_at=timezone.now()
        )
        
        return Response({
            'message': f'Marked {updated_count} items as synced',
            'updated_count': updated_count
        })


class WorkSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API for WorkSession records.

    - Employees see only their own sessions.
    - Managers and superusers see all sessions.

    Custom actions:
      GET /tracking/work-sessions/working-time-today/
        ?employee_id=<uuid>   (managers/superusers)
        ?manager_id=<uuid>    (managers/superusers, or self)
      GET /tracking/work-sessions/active-today/
        Manager/superuser only. Returns employees and managers with >15 min today.
    """
    serializer_class = WorkSessionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'manager', 'source']
    ordering_fields = ['started_at', 'ended_at', 'last_heartbeat_at']
    ordering = ['-started_at']

    def _is_manager_or_superuser(self, user):
        if user.is_superuser:
            return True
        return hasattr(user, 'manager') and user.manager is not None

    def get_queryset(self):
        user = self.request.user
        if self._is_manager_or_superuser(user):
            return WorkSession.objects.all().select_related('employee', 'manager')
        if hasattr(user, 'employee') and user.employee:
            return WorkSession.objects.filter(employee=user.employee).select_related('employee')
        return WorkSession.objects.none()

    def _resolve_target(self, request):
        """Resolve the target actor (Employee or Manager) from query params.

        Returns (kind, obj, error_response_or_none). `kind` is 'employee' or 'manager'.
        """
        user = request.user
        employee_id = request.query_params.get('employee_id')
        manager_id = request.query_params.get('manager_id')

        if employee_id and manager_id:
            return None, None, Response(
                {'error': 'Pass employee_id OR manager_id, not both'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if employee_id:
            if not self._is_manager_or_superuser(user) and not (
                hasattr(user, 'employee') and user.employee and str(user.employee.id) == str(employee_id)
            ):
                return None, None, Response(
                    {'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN
                )
            try:
                return 'employee', Employee.objects.get(id=employee_id), None
            except Employee.DoesNotExist:
                return None, None, Response(
                    {'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND
                )

        if manager_id:
            if not self._is_manager_or_superuser(user):
                return None, None, Response(
                    {'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN
                )
            try:
                return 'manager', Manager.objects.get(id=manager_id), None
            except Manager.DoesNotExist:
                return None, None, Response(
                    {'error': 'Manager not found'}, status=status.HTTP_404_NOT_FOUND
                )

        # No params → default to self
        if hasattr(user, 'employee') and user.employee:
            return 'employee', user.employee, None
        if hasattr(user, 'manager') and user.manager:
            return 'manager', user.manager, None
        return None, None, Response(
            {'error': 'Caller has no Employee or Manager record'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=['get'], url_path='working-time-today')
    def working_time_today(self, request):
        kind, obj, err = self._resolve_target(request)
        if err is not None:
            return err

        if kind == 'employee':
            seconds = get_working_seconds_today(employee=obj)
        else:
            seconds = get_working_seconds_today(manager=obj)

        return Response({
            'actor_kind': kind,
            'actor_id': str(obj.id),
            'name': obj.name,
            'seconds': seconds,
            'threshold_seconds': ACTIVE_THRESHOLD_SECONDS,
            'is_active_today': seconds > ACTIVE_THRESHOLD_SECONDS,
        })

    @action(detail=False, methods=['get'], url_path='active-today')
    def active_today(self, request):
        user = request.user
        if not self._is_manager_or_superuser(user):
            return Response(
                {'error': 'Only managers and superusers can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN,
            )

        employees_out = []
        for emp in Employee.objects.all():
            seconds = get_working_seconds_today(employee=emp)
            if seconds > ACTIVE_THRESHOLD_SECONDS:
                employees_out.append({
                    'id': str(emp.id),
                    'name': emp.name,
                    'seconds': seconds,
                })

        managers_out = []
        for mgr in Manager.objects.all():
            seconds = get_working_seconds_today(manager=mgr)
            if seconds > ACTIVE_THRESHOLD_SECONDS:
                managers_out.append({
                    'id': str(mgr.id),
                    'name': mgr.name,
                    'seconds': seconds,
                })

        return Response({
            'threshold_seconds': ACTIVE_THRESHOLD_SECONDS,
            'employees': employees_out,
            'managers': managers_out,
        })
