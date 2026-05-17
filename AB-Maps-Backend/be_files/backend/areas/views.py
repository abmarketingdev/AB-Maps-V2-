"""
Views for the areas app.
"""
import logging
import json
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import models, transaction
from django.db.models import Prefetch
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404
from django.contrib.gis.geos import Point
from django.utils import timezone
from users.models import Employee, Manager
from .models import Area, AreaEmployee
from .serializers import (
    AreaSerializer, AreaDetailSerializer, AreaGeoSerializer,
    AreaEmployeeSerializer, AreaNearbySerializer, UnifiedPersonSerializer
)
from users.serializers import EmployeeSerializer
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from drf_spectacular.openapi import OpenApiTypes
# Import CampaignArea for automatic campaign assignment
from campaigns.models import CampaignArea, Campaign

logger = logging.getLogger(__name__)


class AreaPagination(PageNumberPagination):
    """Custom pagination for areas with 100 items per page."""
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000


class ManagerOnlyPermission(permissions.BasePermission):
    """Custom permission to allow only managers and super users to create/modify areas."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Super users can perform all operations (like managers)
        if request.user.is_superuser:
            return True

        # For read operations, allow managers and employees
        if request.method in permissions.SAFE_METHODS:
            return hasattr(request.user, 'manager') or hasattr(request.user, 'employee')
        
        # For write operations, only allow managers
        return hasattr(request.user, 'manager') and request.user.manager is not None
    
    # def has_object_permission(self, request, view, obj):
    #     if not request.user.is_authenticated:
    #         return False
        
    #     # Super users can access all objects (like managers)
    #     if request.user.is_superuser:
    #         return True
        
    #     # Managers can access areas they created, manage, or are assigned to
    #     if hasattr(request.user, 'manager') and request.user.manager:
    #         # Can access if they created it, manage it, or are assigned to it
    #         if obj.created_by == request.user.manager or obj.manager == request.user.manager:
    #             return True
    #         if request.method in permissions.SAFE_METHODS:
    #             # Check if manager is assigned to area
    #             return AreaEmployee.objects.filter(area=obj, manager=request.user.manager).exists()
    #         return False
        
    #     # Employees can only view areas they're assigned to
    #     if hasattr(request.user, 'employee') and request.user.employee:
    #         if request.method in permissions.SAFE_METHODS:
    #             # Check if employee is assigned to area
    #             return AreaEmployee.objects.filter(area=obj, employee=request.user.employee).exists()
    #         return False
        
    #     return False
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Super users can access all objects (like managers)
        if request.user.is_superuser:
            return True
        
        # Managers can access areas they created, manage, or are assigned to
        if hasattr(request.user, 'manager') and request.user.manager:
            # Can access if they created it, manage it, or are assigned to it
            if obj.created_by == request.user.manager or obj.manager == request.user.manager:
                return True
            if request.method in permissions.SAFE_METHODS:
                # Check if manager is assigned to area
                return AreaEmployee.objects.filter(area=obj, manager=request.user.manager).exists()
            # ✅ Allow any manager to perform write operations (create, update, delete) on any area
            return True
        
        # Employees can only view areas they're assigned to
        if hasattr(request.user, 'employee') and request.user.employee:
            if request.method in permissions.SAFE_METHODS:
                # Check if employee is assigned to area
                return AreaEmployee.objects.filter(area=obj, employee=request.user.employee).exists()
            return False
        
        return False


class AreaViewSet(viewsets.ModelViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer
    permission_classes = [ManagerOnlyPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['created_by', 'status', 'fylke', 'employees']
    search_fields = ['name', 'fylke']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    # Use custom pagination with 100 items per page for better map performance
    pagination_class = AreaPagination
    
    def get_queryset(self):
        """Filter areas based on user type, permissions, and campaign ID."""
        queryset = Area.objects.all()
        user = self.request.user
        
        # Get campaign_id from headers
        campaign_id = self.request.headers.get('X-Campaign-ID')
        
        # Filter by campaign if campaign_id is provided
        if campaign_id:
            try:
                # Handle both UUID strings and JSON objects
                if campaign_id.startswith('{'):
                    # It's a JSON object, extract the ID
                    try:
                        campaign_data = json.loads(campaign_id)
                        campaign_id = campaign_data.get('id')
                        logger.info(f"Extracted campaign ID from JSON: {campaign_id}")
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON in X-Campaign-ID header: {campaign_id}")
                        return Area.objects.none()
                
                if campaign_id:
                    # Filter areas to only show those belonging to the current campaign
                    campaign_areas = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
                    queryset = queryset.filter(id__in=campaign_areas)
                    logger.info(f"Filtered areas for campaign {campaign_id}: {queryset.count()} areas found")
                else:
                    logger.warning("No campaign ID found in JSON object")
                    return Area.objects.none()
                    
            except Exception as e:
                logger.error(f"Error filtering areas by campaign {campaign_id}: {e}")
                return Area.objects.none()
        else:
            logger.info("No X-Campaign-ID header provided, showing all areas (legacy behavior)")
        
        # Apply user-specific filtering
        if user.is_superuser:
            # Super users can see all areas (like managers)
            pass
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see all areas in their campaign (already filtered above if campaign_id provided)
            # If no campaign filter, they see all areas (legacy behavior)
            pass
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see areas they're assigned to within the campaign
            # Get area IDs where employee is assigned
            assigned_area_ids = AreaEmployee.objects.filter(employee=user.employee).values_list('area_id', flat=True)
            queryset = queryset.filter(id__in=assigned_area_ids)
        else:
            # If user has no profile, show no areas
            queryset = Area.objects.none()
        
        return queryset.distinct()
    
    def create(self, request, *args, **kwargs):
        """Override create to include enrichment_job_id in response."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        
        # Add enrichment_job_id to response if it was created
        response_data = serializer.data
        if hasattr(self, 'enrichment_job_id') and self.enrichment_job_id:
            # Re-serialize with enrichment_job_id in context
            serializer_with_job = self.get_serializer(
                serializer.instance,
                context={'request': request, 'enrichment_job_id': self.enrichment_job_id}
            )
            response_data = serializer_with_job.data
        
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Set the created_by field to the current manager and create CampaignArea entry.
        Auto-set start_date if not provided. end_date is optional."""
        user = self.request.user
        if hasattr(user, 'manager') and user.manager:
            # Auto-set start_date if not provided
            if 'start_date' not in serializer.validated_data or not serializer.validated_data.get('start_date'):
                serializer.validated_data['start_date'] = timezone.now()
            
            # end_date is optional - can be set later via update
            area = serializer.save(created_by=user.manager)
            
            # Get campaign_id from headers if available
            campaign_id = self.request.headers.get('X-Campaign-ID')
            enrichment_job_id = None
            
            if campaign_id:
                try:
                    # Handle both UUID strings and JSON objects
                    if campaign_id.startswith('{'):
                        # It's a JSON object, extract the ID
                        try:
                            campaign_data = json.loads(campaign_id)
                            campaign_id = campaign_data.get('id')
                            logger.info(f"Extracted campaign ID from JSON: {campaign_id}")
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON in X-Campaign-ID header: {campaign_id}")
                            return
                    
                    if campaign_id:
                        campaign = Campaign.objects.get(id=campaign_id)
                        # Create CampaignArea entry automatically
                        campaign_area, created = CampaignArea.objects.get_or_create(
                            campaign=campaign, 
                            area=area
                        )
                        if created:
                            logger.info(f"Created CampaignArea entry: Campaign {campaign.name} - Area {area.name}")
                        else:
                            logger.info(f"CampaignArea entry already exists: Campaign {campaign.name} - Area {area.name}")
                        
                        # Trigger Talkmore enrichment job if campaign name is "Talkmore"
                        if campaign.name.lower() == "talkmore":
                            try:
                                from talkmore_enrichment.models import EnrichmentJob
                                from talkmore_enrichment.services.redis_streams import enqueue_job
                                
                                # Create enrichment job synchronously (so we can include it in the response)
                                job = EnrichmentJob.objects.create(
                                    area=area,
                                    campaign=campaign,
                                    status='queued'
                                )
                                enrichment_job_id = job.id
                                logger.info(f"Created EnrichmentJob {job.id} for Talkmore campaign area {area.name}")
                                
                                # Enqueue job to Redis Stream (use on_commit to ensure area is committed first)
                                def enqueue_job_after_commit():
                                    try:
                                        enqueue_job(job.id)
                                        logger.info(f"Enqueued enrichment job {job.id} to Redis stream")
                                    except Exception as e:
                                        logger.error(f"Error enqueueing enrichment job {job.id}: {e}")
                                
                                transaction.on_commit(enqueue_job_after_commit)
                            except Exception as e:
                                logger.error(f"Error creating enrichment job for area {area.id}: {e}")
                    else:
                        logger.warning("No campaign ID found in JSON object")
                        
                except Campaign.DoesNotExist:
                    logger.warning(f"Campaign with ID {campaign_id} not found. Area created without campaign assignment.")
                except Exception as e:
                    logger.error(f"Error creating CampaignArea entry: {e}")
            
            # Store enrichment_job_id for use in create response
            self.enrichment_job_id = enrichment_job_id
        else:
            raise PermissionDenied("Only managers can create areas")
    
    def perform_destroy(self, instance):
        """Delete the area and its associated CampaignArea entries."""
        try:
            # Delete all CampaignArea entries for this area
            deleted_count = CampaignArea.objects.filter(area=instance).delete()[0]
            logger.info(f"Deleted {deleted_count} CampaignArea entries for area {instance.name}")
            # Delete the area
            instance.delete()
            logger.info(f"Deleted area: {instance.name}")
        except Exception as e:
            logger.error(f"Error deleting area {instance.name}: {e}")
            raise
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AreaDetailSerializer
        return AreaSerializer
    
    @action(detail=True, methods=['post'])
    def add_employee(self, request, pk=None):
        """Add an employee or manager to the area."""
        # Get area manually to provide better error handling
        try:
            area = Area.objects.get(pk=pk)
        except Area.DoesNotExist:
            return Response({'error': 'Area not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user = request.user
        
        # Check permissions - allow if user is superuser, or if user's manager created the area
        if not user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_superuser:
            if not (hasattr(user, 'manager') and user.manager):
                return Response({'error': 'Only managers can add employees or managers to areas.'}, status=status.HTTP_403_FORBIDDEN)
            
            if area.created_by != user.manager:
                return Response({'error': 'Only the creator of the area can add employees or managers.'}, status=status.HTTP_403_FORBIDDEN)
        
        employee_id = request.data.get('employee_id')
        manager_id = request.data.get('manager_id')
        
        # Ensure exactly one is provided
        if not employee_id and not manager_id:
            return Response({'error': 'Either employee_id or manager_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if employee_id and manager_id:
            return Response({'error': 'Cannot provide both employee_id and manager_id'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if employee_id:
                employee = Employee.objects.get(id=employee_id)
                area_employee, created = AreaEmployee.objects.get_or_create(area=area, employee=employee, defaults={'manager': None})
                person_name = employee.name
                person_type = 'employee'
            else:
                manager = Manager.objects.get(id=manager_id)
                area_employee, created = AreaEmployee.objects.get_or_create(area=area, manager=manager, defaults={'employee': None})
                person_name = manager.name
                person_type = 'manager'
            
            if created:
                return Response({'message': f'{person_name} ({person_type}) assigned to area {area.name}'}, status=status.HTTP_201_CREATED)
            else:
                return Response({'message': f'{person_name} ({person_type}) is already assigned to area {area.name}'}, status=status.HTTP_200_OK)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)
        except Manager.DoesNotExist:
            return Response({'error': 'Manager not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['delete'])
    def remove_employee(self, request, pk=None):
        """Remove an employee or manager from the area."""
        # Get area manually to provide better error handling
        try:
            area = Area.objects.get(pk=pk)
        except Area.DoesNotExist:
            return Response({'error': 'Area not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user = request.user
        
        # Check permissions
        if not user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_superuser:
            if not (hasattr(user, 'manager') and user.manager):
                return Response({'error': 'Only managers can remove employees or managers from areas.'}, status=status.HTTP_403_FORBIDDEN)
            
            if area.created_by != user.manager:
                return Response({'error': 'Only the creator of the area can remove employees or managers.'}, status=status.HTTP_403_FORBIDDEN)
        
        employee_id = request.data.get('employee_id')
        manager_id = request.data.get('manager_id')
        
        # Ensure exactly one is provided
        if not employee_id and not manager_id:
            return Response({'error': 'Either employee_id or manager_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if employee_id and manager_id:
            return Response({'error': 'Cannot provide both employee_id and manager_id'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if employee_id:
                employee = Employee.objects.get(id=employee_id)
                area_employee = AreaEmployee.objects.get(area=area, employee=employee)
                person_name = employee.name
                person_type = 'employee'
            else:
                manager = Manager.objects.get(id=manager_id)
                area_employee = AreaEmployee.objects.get(area=area, manager=manager)
                person_name = manager.name
                person_type = 'manager'
            
            area_employee.delete()
            return Response({'message': f'{person_name} ({person_type}) removed from area {area.name}'}, status=status.HTTP_200_OK)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)
        except Manager.DoesNotExist:
            return Response({'error': 'Manager not found'}, status=status.HTTP_404_NOT_FOUND)
        except AreaEmployee.DoesNotExist:
            return Response({'error': f'{person_name} ({person_type}) is not assigned to area {area.name}'}, status=status.HTTP_404_NOT_FOUND)
    
    @extend_schema(
        summary="Get all employees and managers assigned to an area",
        description="Returns all employees and managers directly assigned to the area via AreaEmployee.",
        responses={200: OpenApiResponse(response=UnifiedPersonSerializer(many=True), description="List of assigned employees and managers")}
    )
    @action(detail=True, methods=['get'], url_path='employees')
    def employees(self, request, pk=None):
        """Get all employees and managers directly assigned to an area."""
        # Only allow managers and superusers to access this endpoint
        if not (hasattr(request.user, 'manager') and request.user.manager) and not request.user.is_superuser:
            return Response(
                {'detail': 'Only managers and superusers can access this endpoint.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        area = self.get_object()
        # Get all assignments (both employees and managers) for this area
        assignments = AreaEmployee.objects.filter(area=area).select_related('employee', 'manager')
        
        # Serialize all assignments (both employees and managers)
        result = [
            UnifiedPersonSerializer.from_area_employee(assignment).data
            for assignment in assignments
        ]
        
        # Sort by name
        result.sort(key=lambda x: x.get('name', ''))
        
        return Response(result)
    
    @action(detail=True, methods=['put'])
    def set_employees(self, request, pk=None):
        """Set multiple employees and/or managers for an area (replaces existing assignments)."""
        # Get area manually to provide better error handling
        try:
            area = Area.objects.get(pk=pk)
        except Area.DoesNotExist:
            return Response({'error': 'Area not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user = request.user
        
        # Check permissions
        if not user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_superuser:
            if not (hasattr(user, 'manager') and user.manager):
                return Response({'error': 'Only managers can set employees and managers for areas.'}, status=status.HTTP_403_FORBIDDEN)
            
            if area.created_by != user.manager:
                return Response({'error': 'Only the creator of the area can set employees and managers.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Accept either employee_ids (list) or assignments (list of objects with employee_id or manager_id)
        employee_ids = request.data.get('employee_ids', [])
        manager_ids = request.data.get('manager_ids', [])
        assignments = request.data.get('assignments', [])
        
        # If assignments list is provided, use it; otherwise use employee_ids and manager_ids
        if assignments:
            if not isinstance(assignments, list):
                return Response({'error': 'assignments must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not isinstance(employee_ids, list):
                return Response({'error': 'employee_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
            if not isinstance(manager_ids, list):
                return Response({'error': 'manager_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove existing assignments
        AreaEmployee.objects.filter(area=area).delete()
        
        # Add new assignments
        if assignments:
            # Process assignments list (list of objects with employee_id or manager_id)
            for assignment in assignments:
                if not isinstance(assignment, dict):
                    continue
                
                employee_id = assignment.get('employee_id')
                manager_id = assignment.get('manager_id')
                
                # Ensure exactly one is provided
                if not employee_id and not manager_id:
                    continue
                if employee_id and manager_id:
                    continue
                
                try:
                    if employee_id:
                        employee = Employee.objects.get(id=employee_id)
                        AreaEmployee.objects.create(area=area, employee=employee, manager=None)
                    else:
                        manager = Manager.objects.get(id=manager_id)
                        AreaEmployee.objects.create(area=area, employee=None, manager=manager)
                except (Employee.DoesNotExist, Manager.DoesNotExist):
                    continue
        else:
            # Process employee_ids and manager_ids lists
            for employee_id in employee_ids:
                try:
                    employee = Employee.objects.get(id=employee_id)
                    AreaEmployee.objects.create(area=area, employee=employee, manager=None)
                except Employee.DoesNotExist:
                    continue
            
            for manager_id in manager_ids:
                try:
                    manager = Manager.objects.get(id=manager_id)
                    AreaEmployee.objects.create(area=area, employee=None, manager=manager)
                except Manager.DoesNotExist:
                    continue
        
        serializer = AreaEmployeeSerializer(AreaEmployee.objects.filter(area=area), many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get unassigned employees and managers for area",
        description="Returns all employees and managers that are NOT currently assigned to the specific area.",
        responses={200: OpenApiResponse(response=UnifiedPersonSerializer(many=True), description="List of unassigned employees and managers")}
    )
    @action(detail=True, methods=['get'])
    def unassigned_employees(self, request, pk=None):
        """Get all employees and managers not assigned to this specific area."""
        area = self.get_object()
        user = request.user
        
        if not (hasattr(user, 'manager') and user.manager):
            return Response({'detail': 'Only managers can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all assigned person IDs (both employees and managers)
        assigned_employee_ids = AreaEmployee.objects.filter(
            area=area,
            employee__isnull=False
        ).values_list('employee_id', flat=True)
        
        assigned_manager_ids = AreaEmployee.objects.filter(
            area=area,
            manager__isnull=False
        ).values_list('manager_id', flat=True)
        
        # Get unassigned employees
        unassigned_employees = Employee.objects.exclude(id__in=assigned_employee_ids)
        
        # Get unassigned managers
        unassigned_managers = Manager.objects.exclude(id__in=assigned_manager_ids)
        
        # Serialize employees
        employee_data = []
        for emp in unassigned_employees:
            user_obj = getattr(emp, 'user', None)
            employee_data.append({
                'id': emp.id,
                'name': emp.name,
                'email': emp.email,
                'phone': emp.phone,
                'status': emp.status,
                'is_online': emp.is_online,
                'person_type': 'employee',
                'ab_person_id': user_obj.ab_person_id if user_obj else None,
            })
        
        # Serialize managers
        manager_data = []
        for mgr in unassigned_managers:
            user_obj = getattr(mgr, 'user', None)
            manager_data.append({
                'id': mgr.id,
                'name': mgr.name,
                'email': mgr.email or '',
                'phone': mgr.phone,
                'status': mgr.status,
                'is_online': mgr.is_online,
                'person_type': 'manager',
                'ab_person_id': user_obj.ab_person_id if user_obj else None,
            })
        
        # Merge and sort by name
        result = employee_data + manager_data
        result.sort(key=lambda x: x.get('name', ''))
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def all_areas(self, request):
        """Get all areas (for managers and employees to view all areas)."""
        user = self.request.user
        if (hasattr(user, 'manager') and user.manager) or (hasattr(user, 'employee') and user.employee):
            areas = Area.objects.all()
            serializer = self.get_serializer(areas, many=True)
            return Response(serializer.data)
        else:
            return Response({'error': 'Only managers or employees can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    
    @action(detail=False, methods=['get'])
    def my_areas(self, request):
        """Get areas created by the current manager, filtered by campaign if specified.
        Excludes expired areas (end_date < current_date)."""
        user = self.request.user
        if not (hasattr(user, 'manager') and user.manager):
            return Response({'error': 'Only managers can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
        
        # Start with areas created by the current manager
        areas = Area.objects.filter(created_by=user.manager)
        
        # Filter out expired areas (end_date < current_date)
        # Include areas with null end_date (treat as active)
        current_date = timezone.now().date()
        areas = areas.filter(models.Q(end_date__isnull=True) | models.Q(end_date__gte=current_date))
        
        # Get campaign_id from headers for filtering
        campaign_id = request.headers.get('X-Campaign-ID')
        
        # Filter by campaign if campaign_id is provided
        if campaign_id:
            try:
                # Handle both UUID strings and JSON objects
                if campaign_id.startswith('{'):
                    # It's a JSON object, extract the ID
                    try:
                        campaign_data = json.loads(campaign_id)
                        campaign_id = campaign_data.get('id')
                        logger.info(f"Extracted campaign ID from JSON in my_areas: {campaign_id}")
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON in X-Campaign-ID header in my_areas: {campaign_id}")
                        return Response({'error': 'Invalid campaign ID format'}, status=status.HTTP_400_BAD_REQUEST)
                
                if campaign_id:
                    # Filter areas to only show those belonging to the current campaign
                    campaign_areas = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
                    areas = areas.filter(id__in=campaign_areas)
                    logger.info(f"Filtered my_areas for campaign {campaign_id}: {areas.count()} areas found")
                else:
                    logger.warning("No campaign ID found in JSON object in my_areas")
                    return Response({'error': 'No campaign ID found'}, status=status.HTTP_400_BAD_REQUEST)
                    
            except Exception as e:
                logger.error(f"Error filtering my_areas by campaign {campaign_id}: {e}")
                return Response({'error': 'Error filtering by campaign'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            logger.info("No X-Campaign-ID header provided in my_areas, showing all manager's areas")
        
        serializer = self.get_serializer(areas, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def assigned_areas(self, request):
        """Get areas assigned to the current employee.
        Excludes expired areas (end_date < current_date)."""
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            # Get areas assigned via AreaEmployee
            assigned_area_ids = AreaEmployee.objects.filter(employee=user.employee).values_list('area_id', flat=True)
            # Filter out expired areas
            # Include areas with null end_date (treat as active)
            current_date = timezone.now().date()
            areas = Area.objects.filter(
                id__in=assigned_area_ids
            ).filter(models.Q(end_date__isnull=True) | models.Q(end_date__gte=current_date))
            serializer = self.get_serializer(areas, many=True)
            return Response(serializer.data)
        else:
            return Response({'error': 'Only employees can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)

    @extend_schema(
        summary="Get areas assigned to the current employee for a specific campaign",
        description="Returns areas directly assigned to the current employee (via areas_employee) and belonging to the campaign specified in X-Campaign-ID header.",
        responses={200: OpenApiResponse(response=AreaDetailSerializer(many=True), description="List of assigned areas in the campaign")}
    )
    @action(detail=False, methods=['get'])
    def assigned_to_me(self, request):
        """Get areas assigned to the current employee, filtered by campaign (intersection).
        Excludes expired areas (end_date < current_date)."""
        user = request.user
        if not (hasattr(user, 'employee') and user.employee):
            return Response({'error': 'Only employees can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
        
        # Read campaign_id from header (supports raw UUID or JSON with id)
        campaign_id = request.headers.get('X-Campaign-ID')
        if not campaign_id:
            return Response({'error': 'X-Campaign-ID header is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Allow JSON object header (e.g., {"id": "..."})
            if campaign_id.startswith('{'):
                try:
                    campaign_data = json.loads(campaign_id)
                    campaign_id = campaign_data.get('id')
                    logger.info(f"Extracted campaign ID from JSON in assigned_to_me: {campaign_id}")
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in X-Campaign-ID header in assigned_to_me: {campaign_id}")
                    return Response({'error': 'Invalid campaign ID format'}, status=status.HTTP_400_BAD_REQUEST)
            
            if not campaign_id:
                return Response({'error': 'No campaign ID found'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify campaign exists
            try:
                Campaign.objects.get(id=campaign_id)
            except Campaign.DoesNotExist:
                return Response({'error': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
            
            employee = user.employee
            
            # Areas assigned to employee via AreaEmployee
            assigned_area_ids = AreaEmployee.objects.filter(employee=employee).values_list('area_id', flat=True)
            employee_area_qs = Area.objects.filter(id__in=assigned_area_ids)
            
            # Areas belonging to the specified campaign
            campaign_area_ids = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
            
            # Intersection: employee-assigned areas that belong to the campaign
            areas = employee_area_qs.filter(id__in=campaign_area_ids)
            
            # Filter out expired areas
            # Include areas with null end_date (treat as active)
            current_date = timezone.now().date()
            areas = areas.filter(models.Q(end_date__isnull=True) | models.Q(end_date__gte=current_date))
            
            logger.info(f"Employee {employee.name} has {areas.count()} active assigned areas in campaign {campaign_id}")
            
            serializer = AreaDetailSerializer(areas, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error in assigned_to_me endpoint: {e}")
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @extend_schema(
        summary="Get areas with campaign information for sales dashboard",
        description="Returns all areas with their associated campaign information for the sales dashboard display.",
        responses={200: OpenApiResponse(response=AreaSerializer(many=True), description="List of areas with campaign info")}
    )
    @action(detail=False, methods=['get'])
    def with_campaigns(self, request):
        """Get areas with their campaign information for sales dashboard."""
        user = request.user
        if not (hasattr(user, 'manager') and user.manager):
            return Response({'error': 'Only managers can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all areas created by this manager
        areas = Area.objects.filter(created_by=user.manager)
        
        # Get campaign information for each area
        areas_with_campaigns = []
        for area in areas:
            area_data = AreaSerializer(area).data
            
            # Get campaign information for this area
            try:
                campaign_area = CampaignArea.objects.get(area=area)
                area_data['campaign'] = {
                    'id': str(campaign_area.campaign.id),
                    'name': campaign_area.campaign.name,
                    'description': campaign_area.campaign.description
                }
            except CampaignArea.DoesNotExist:
                area_data['campaign'] = None
            
            areas_with_campaigns.append(area_data)
        
        return Response(areas_with_campaigns)
    
    @action(detail=False, methods=['get'])
    def available_for_campaign(self, request):
        """Get areas available for assignment to a campaign (not already assigned, and created by the current manager)."""
        campaign_id = request.query_params.get('campaign')
        user = request.user
        if not (hasattr(user, 'manager') and user.manager):
            return Response({'error': 'Only managers can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
        if not campaign_id:
            return Response({'error': 'campaign parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        from campaigns.models import CampaignArea
        # Get all area_ids already assigned to this campaign
        assigned_area_ids = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
        # Get all areas created by this manager and not already assigned
        available_areas = Area.objects.filter(created_by=user.manager).exclude(id__in=assigned_area_ids)
        serializer = self.get_serializer(available_areas, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get all employees directly assigned to an area",
        description="Returns all employees directly assigned to the area via AreaEmployee.",
        responses={200: EmployeeSerializer(many=True)}
    )
    @action(detail=True, methods=['get'], url_path='team_employees')
    def team_employees(self, request, pk=None):
        """Get all employees directly assigned to an area."""
        area = self.get_object()
        # Get all employees directly assigned to this area
        employees = area.employees.all()
        serializer = EmployeeSerializer(employees, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        summary="Get all areas for a specific campaign (for employees)",
        description="Returns all areas that belong to a specific campaign, filtered by the X-Campaign-ID header. This endpoint is designed for employees to see all areas in their current campaign.",
        responses={200: OpenApiResponse(response=AreaSerializer(many=True), description="List of areas in the campaign")}
    )
    @action(detail=False, methods=['get'], url_path='campaign_areas')
    def campaign_areas(self, request):
        """Get all areas for a specific campaign (for employees)."""
        user = request.user
        
        # Check if user is authenticated
        if not user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Get campaign_id from headers
        campaign_id = request.headers.get('X-Campaign-ID')
        
        if not campaign_id:
            return Response(
                {'error': 'X-Campaign-ID header is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Handle both UUID strings and JSON objects
            if campaign_id.startswith('{'):
                # It's a JSON object, extract the ID
                try:
                    campaign_data = json.loads(campaign_id)
                    campaign_id = campaign_data.get('id')
                    logger.info(f"Extracted campaign ID from JSON in campaign_areas: {campaign_id}")
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in X-Campaign-ID header in campaign_areas: {campaign_id}")
                    return Response(
                        {'error': 'Invalid campaign ID format'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            if not campaign_id:
                logger.warning("No campaign ID found in JSON object in campaign_areas")
                return Response(
                    {'error': 'No campaign ID found'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify campaign exists
            try:
                campaign = Campaign.objects.get(id=campaign_id)
                logger.info(f"Campaign found: {campaign.name}")
            except Campaign.DoesNotExist:
                logger.error(f"Campaign with ID {campaign_id} not found")
                return Response(
                    {'error': 'Campaign not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get all areas that belong to this campaign using CampaignArea relationship
            campaign_areas = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
            areas = Area.objects.filter(id__in=campaign_areas)
            
            logger.info(f"Found {areas.count()} areas for campaign {campaign_id}")
            
            # Apply additional filtering based on user type
            if hasattr(user, 'employee') and user.employee:
                # For employees, they can see all areas in the campaign
                # (no additional filtering needed as they should see all campaign areas)
                pass
            elif hasattr(user, 'manager') and user.manager:
                # For managers, they can see all areas in the campaign
                # (no additional filtering needed as they should see all campaign areas)
                pass
            else:
                # For other user types (admin, etc.), return all areas in the campaign
                pass
            
            serializer = self.get_serializer(areas, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error in campaign_areas endpoint: {e}")
            return Response(
                {'error': 'Internal server error'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Get nearby areas within radius",
        description="Returns all areas within a specified radius from given coordinates. No pagination - returns full list of matching areas.",
        parameters=[
            OpenApiParameter(
                name='lat',
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Latitude (-90 to 90)'
            ),
            OpenApiParameter(
                name='lng',
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Longitude (-180 to 180)'
            ),
            OpenApiParameter(
                name='radius_m',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Search radius in meters (> 0, max 100000)'
            ),
            OpenApiParameter(
                name='campaign_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Campaign UUID (optional if X-Campaign-ID header provided)'
            ),
            OpenApiParameter(
                name='status',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Filter by area status (open|closed|active|inactive)'
            ),
            OpenApiParameter(
                name='ordering',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Ordering: distance, -distance, name, -name (default: distance)'
            ),
            OpenApiParameter(
                name='include_geometry',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Include polygon geometry (default: true)'
            ),
            OpenApiParameter(
                name='search',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Search by area name or fylke'
            ),
        ],
        responses={200: AreaNearbySerializer(many=True)}
    )
    @action(detail=False, methods=['get'], url_path='nearby')
    def nearby(self, request):
        """Get areas within specified radius from given coordinates."""
        try:
            # Parameter validation
            lat = request.query_params.get('lat')
            lng = request.query_params.get('lng')
            radius_m = request.query_params.get('radius_m')
            
            if not all([lat, lng, radius_m]):
                return Response(
                    {'error': 'lat, lng, and radius_m parameters are required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                lat = float(lat)
                lng = float(lng)
                radius_m = int(radius_m)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'lat and lng must be valid numbers, radius_m must be a valid integer'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate coordinate ranges
            if not (-90 <= lat <= 90):
                return Response(
                    {'error': 'lat must be between -90 and 90'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not (-180 <= lng <= 180):
                return Response(
                    {'error': 'lng must be between -180 and 180'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if radius_m <= 0:
                return Response(
                    {'error': 'radius_m must be greater than 0'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if radius_m > 150000:  # 150km max
                return Response(
                    {'error': 'radius_m cannot exceed 150000 meters (150km)'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get campaign_id from query params or header
            campaign_id = request.query_params.get('campaign_id') or request.headers.get('X-Campaign-ID')
            
            if not campaign_id:
                return Response(
                    {'error': 'campaign_id parameter or X-Campaign-ID header is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Handle JSON format in header
            if campaign_id.startswith('{'):
                try:
                    campaign_data = json.loads(campaign_id)
                    campaign_id = campaign_data.get('id')
                    logger.info(f"Extracted campaign ID from JSON in nearby: {campaign_id}")
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in campaign_id: {campaign_id}")
                    return Response(
                        {'error': 'Invalid campaign ID format'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            if not campaign_id:
                return Response(
                    {'error': 'No campaign ID found'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify campaign exists
            try:
                campaign = Campaign.objects.get(id=campaign_id)
                logger.info(f"Campaign found for nearby search: {campaign.name}")
            except Campaign.DoesNotExist:
                logger.error(f"Campaign with ID {campaign_id} not found")
                return Response(
                    {'error': 'Campaign not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get campaign areas
            campaign_area_ids = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
            
            # Build queryset with geospatial filtering using PostGIS geography functions
            # Use ST_DWithin with geography casting for meter-based distance
            queryset = Area.objects.filter(
                id__in=campaign_area_ids,
                polygon_geometry__isnull=False
            )
            
            # Use extra() to add PostGIS geography distance calculation
            queryset = queryset.extra(
                select={
                    'distance_m': "ST_Distance(polygon_geometry::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)"
                },
                select_params=[lng, lat],
                where=[
                    "ST_DWithin(polygon_geometry::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)"
                ],
                params=[lng, lat, radius_m]
            )
            
            # Apply additional filters
            status_filter = request.query_params.get('status')
            if status_filter and status_filter in ['open', 'closed', 'active', 'inactive']:
                queryset = queryset.filter(status=status_filter)
            
            search_filter = request.query_params.get('search')
            if search_filter:
                queryset = queryset.filter(
                    models.Q(name__icontains=search_filter) | 
                    models.Q(fylke__icontains=search_filter)
                )
            
            # Apply ordering
            ordering = request.query_params.get('ordering', 'distance')
            valid_orderings = ['distance', '-distance', 'name', '-name']
            if ordering in valid_orderings:
                if ordering == 'distance':
                    queryset = queryset.order_by('distance_m')
                elif ordering == '-distance':
                    queryset = queryset.order_by('-distance_m')
                elif ordering == 'name':
                    queryset = queryset.order_by('name')
                elif ordering == '-name':
                    queryset = queryset.order_by('-name')
            else:
                queryset = queryset.order_by('distance_m')  # Default
            
            # Prefetch AreaEmployee assignments to avoid N+1 queries
            # This prefetches all assignments with related employee/manager and their users
            assignments_qs = AreaEmployee.objects.select_related('employee__user', 'manager__user')
            queryset = queryset.select_related('manager').prefetch_related(
                Prefetch('areaemployee_set', queryset=assignments_qs, to_attr='prefetched_assignments')
            )
            
            # Apply user permissions (same logic as existing endpoints)
            user = request.user
            if user.is_superuser:
                # Super users can see all areas in campaign
                pass
            elif hasattr(user, 'manager') and user.manager:
                # Managers can see all areas in campaign
                pass
            elif hasattr(user, 'employee') and user.employee:
                # Employees can see all areas in campaign (consistent with campaign_areas endpoint)
                pass
            else:
                # No profile, no access
                queryset = Area.objects.none()
            
            # Serialize results (same pagination format as regular areas endpoint)
            serializer = AreaNearbySerializer(
                queryset, 
                many=True, 
                context={'request': request}
            )
            
            # Return in same pagination format as regular areas endpoint
            response_data = {
                "count": len(serializer.data),
                "next": None,
                "previous": None,
                "results": serializer.data
            }
            
            logger.info(f"Found {len(serializer.data)} nearby areas for campaign {campaign_id} within {radius_m}m")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in nearby endpoint: {e}")
            return Response(
                {'error': 'Internal server error'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AreaEmployeeViewSet(viewsets.ModelViewSet):
    queryset = AreaEmployee.objects.all()
    serializer_class = AreaEmployeeSerializer
    permission_classes = [ManagerOnlyPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['area', 'employee']
    ordering_fields = ['area__name', 'employee__name']
    ordering = ['area__name', 'employee__name']
