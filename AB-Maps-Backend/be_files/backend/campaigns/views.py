"""
Views for the campaigns app.
"""
import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from .models import Campaign, CampaignForm, CampaignArea, CampaignEmployee
from .serializers import (
    CampaignSerializer, CampaignDetailSerializer, CampaignFormSerializer,
    CampaignFormListSerializer, CampaignAreaSerializer, CampaignEmployeeSerializer,
    UnifiedPersonSerializer,
    AllCampaignsSerializer, EmployeeCampaignSerializer, EmployeeSerializer
)
from users.models import Employee, Manager
from areas.models import Area
from addresses.models import Address
from drf_spectacular.utils import extend_schema, OpenApiResponse
from django.utils import timezone
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def _is_qc_admin(user) -> bool:
    """QC web app admin (Settings, brand color, etc.) — matches qc_system auth gate."""
    return getattr(user, 'admin_type', None) == 'qc_admin'


class ManagerOnlyPermission(permissions.BasePermission):
    """Custom permission to allow only managers and super users to create/modify campaigns."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Super users can perform all operations (like managers)
        if request.user.is_superuser:
            return True

        # QC admins (admin_type=qc_admin) get manager-equivalent access to campaign APIs
        if _is_qc_admin(request.user):
            return True

        # For read operations, allow managers and employees
        if request.method in permissions.SAFE_METHODS:
            return hasattr(request.user, 'manager') or hasattr(request.user, 'employee')
        
        # For write operations, only allow managers
        return hasattr(request.user, 'manager') and request.user.manager is not None
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Super users can access all objects (like managers)
        if request.user.is_superuser:
            return True

        if _is_qc_admin(request.user):
            return True
        
        # Managers can access ALL campaigns (for visibility and management)
        if hasattr(request.user, 'manager') and request.user.manager:
            return True
        
        # Employees can only view campaigns they're assigned to
        if hasattr(request.user, 'employee') and request.user.employee:
            return request.method in permissions.SAFE_METHODS and obj.campaign_employees.filter(employee=request.user.employee).exists()
        
        return False


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerOnlyPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['created_by']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter campaigns based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all campaigns
            return Campaign.objects.all()
        if _is_qc_admin(user):
            # QC admins need the full campaign list for Settings / brand color (same as managers)
            return Campaign.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see ALL campaigns (for visibility and management)
            return Campaign.objects.all()
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see campaigns they're assigned to
            return Campaign.objects.filter(campaign_employees__employee=user.employee)
        
        return Campaign.objects.none()
    
    def perform_create(self, serializer):
        """Set the created_by field to the current manager."""
        user = self.request.user
        if hasattr(user, 'manager') and user.manager:
            serializer.save(created_by=user.manager)
        else:
            raise PermissionDenied("Only managers can create campaigns")
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CampaignDetailSerializer
        return CampaignSerializer

    def _brand_color_write_forbidden_response(self):
        return Response(
            {
                'detail': (
                    'Only QC admins (admin_type=qc_admin) or Django staff superusers '
                    'can change campaign brand color.'
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    @staticmethod
    def _can_write_campaign_brand_color(user):
        if not user.is_authenticated:
            return False
        if _is_qc_admin(user):
            return True
        return bool(user.is_staff and user.is_superuser)

    def create(self, request, *args, **kwargs):
        if 'brand_color_hex' in request.data:
            if not self._can_write_campaign_brand_color(request.user):
                return self._brand_color_write_forbidden_response()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if 'brand_color_hex' in request.data:
            if not self._can_write_campaign_brand_color(request.user):
                return self._brand_color_write_forbidden_response()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if 'brand_color_hex' in request.data:
            if not self._can_write_campaign_brand_color(request.user):
                return self._brand_color_write_forbidden_response()
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(
        summary="Get all campaigns",
        description="Returns all campaigns with basic information including created_by details. All authenticated users (managers, superusers, employees) can see all campaigns.",
        responses={200: AllCampaignsSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def all_campaigns(self, request):
        """Get all campaigns with created_by information. All authenticated users can see all campaigns."""
        user = self.request.user
        
        # All authenticated users (managers, superusers, employees) can see ALL campaigns
        campaigns = Campaign.objects.all()
        
        serializer = AllCampaignsSerializer(campaigns, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        summary="Get campaigns assigned to current employee",
        description="Returns all campaigns that the current employee is assigned to via direct assignment.",
        responses={200: EmployeeCampaignSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def my_campaigns(self, request):
        """Get campaigns assigned to the current employee via direct assignment."""
        user = request.user
        if not (hasattr(user, 'employee') and user.employee):
            return Response({'error': 'Only employees can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get campaigns directly assigned to this employee
        campaign_assignments = CampaignEmployee.objects.filter(employee=user.employee)
        serializer = EmployeeCampaignSerializer(campaign_assignments, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get campaigns for specific employee",
        description="Returns all campaigns that a specific employee is assigned to. Requires employee_id parameter.",
        responses={200: EmployeeCampaignSerializer(many=True), 400: "Bad Request", 404: "Employee Not Found"}
    )
    @action(detail=False, methods=['get'])
    def employee_campaigns(self, request):
        """Get campaigns assigned to a specific employee."""
        employee_id = request.query_params.get('employee_id')
        if not employee_id:
            return Response({'error': 'employee_id parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get campaigns assigned to this employee
        campaign_assignments = CampaignEmployee.objects.filter(employee=employee)
        serializer = EmployeeCampaignSerializer(campaign_assignments, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get campaigns for current employee (alternative endpoint)",
        description="Returns all campaigns that the current employee is assigned to. Alternative to my_campaigns.",
        responses={200: EmployeeCampaignSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def my_campaigns_employee(self, request):
        """Get campaigns assigned to the current employee (alternative endpoint)."""
        user = request.user
        if not (hasattr(user, 'employee') and user.employee):
            return Response({'error': 'Only employees can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get campaigns directly assigned to this employee
        campaign_assignments = CampaignEmployee.objects.filter(employee=user.employee)
        serializer = EmployeeCampaignSerializer(campaign_assignments, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get assigned employees and managers for campaign",
        description="Returns all employees and managers currently assigned to the specific campaign.",
        responses={200: OpenApiResponse(response=UnifiedPersonSerializer(many=True), description="List of assigned employees and managers")}
    )
    @action(detail=True, methods=['get'])
    def assigned_employees(self, request, pk=None):
        """Get all employees and managers assigned to a campaign."""
        campaign = self.get_object()
        campaign_assignments = CampaignEmployee.objects.filter(campaign=campaign).select_related('employee', 'manager')
        
        # Serialize all assignments (both employees and managers)
        result = [
            UnifiedPersonSerializer.from_campaign_employee(assignment).data
            for assignment in campaign_assignments
        ]
        
        # Sort by assigned_at (most recent first)
        result.sort(key=lambda x: x.get('assigned_at') or '', reverse=True)
        
        return Response(result)

    @extend_schema(
        summary="Get unassigned employees and managers for campaign",
        description="Returns all employees and managers that are NOT currently assigned to the specific campaign.",
        responses={200: OpenApiResponse(response=UnifiedPersonSerializer(many=True), description="List of unassigned employees and managers")}
    )
    @action(detail=False, methods=['get'])
    def unassigned_employees(self, request):
        """Get all employees and managers not assigned to a specific campaign."""
        campaign_id = request.query_params.get('campaign_id')
        if not campaign_id:
            return Response({'detail': 'campaign_id parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        
        if not (hasattr(user, 'manager') and user.manager):
            return Response({'detail': 'Only managers can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            campaign = Campaign.objects.get(id=campaign_id)
        except Campaign.DoesNotExist:
            return Response({'detail': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get all assigned person IDs (both employees and managers)
        assigned_employee_ids = CampaignEmployee.objects.filter(
            campaign=campaign, 
            employee__isnull=False
        ).values_list('employee_id', flat=True)
        
        assigned_manager_ids = CampaignEmployee.objects.filter(
            campaign=campaign,
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
                'assigned_at': None
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
                'assigned_at': None
            })
        
        # Merge and sort by name
        result = employee_data + manager_data
        result.sort(key=lambda x: x.get('name', ''))
        
        return Response(result)

    @extend_schema(
        summary="Add employee or manager to campaign",
        description="Assign an employee or manager to a specific campaign. Provide either employee_id or manager_id. Only managers can perform this action.",
        request=CampaignEmployeeSerializer,
        responses={201: CampaignEmployeeSerializer, 400: "Bad Request", 403: "Forbidden"}
    )
    @action(detail=True, methods=['post'])
    def add_employee(self, request, pk=None):
        """Add an employee or manager to a campaign."""
        campaign = self.get_object()
        user = request.user
        
        if not (user.is_superuser or (hasattr(user, 'manager') and user.manager)):
            return Response({'detail': 'Only managers or super users can add people to campaigns.'}, status=status.HTTP_403_FORBIDDEN)
        
        employee_id = request.data.get('employee_id')
        manager_id = request.data.get('manager_id')
        
        # Debug logging
        logger.info(f"add_employee called with employee_id={employee_id}, manager_id={manager_id}")
        logger.info(f"Request data: {request.data}")
        
        # Validate that exactly one is provided
        if not employee_id and not manager_id:
            return Response({
                'detail': 'Either employee_id or manager_id is required.',
                'received_data': dict(request.data)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if employee_id and manager_id:
            return Response({'detail': 'Cannot provide both employee_id and manager_id.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Handle employee assignment
        if employee_id:
            try:
                employee = Employee.objects.get(id=employee_id)
            except Employee.DoesNotExist:
                return Response({
                    'detail': 'Employee not found.',
                    'employee_id': str(employee_id)
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if already assigned
            if CampaignEmployee.objects.filter(campaign=campaign, employee=employee).exists():
                return Response({'detail': 'This employee is already assigned to this campaign.'}, status=status.HTTP_400_BAD_REQUEST)
            
            campaign_employee = CampaignEmployee.objects.create(campaign=campaign, employee=employee)
            serializer = CampaignEmployeeSerializer(campaign_employee)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # Handle manager assignment
        elif manager_id:
            try:
                manager = Manager.objects.get(id=manager_id)
            except Manager.DoesNotExist:
                return Response({'detail': 'Manager not found.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if already assigned
            if CampaignEmployee.objects.filter(campaign=campaign, manager=manager).exists():
                return Response({'detail': 'This manager is already assigned to this campaign.'}, status=status.HTTP_400_BAD_REQUEST)
            
            campaign_employee = CampaignEmployee.objects.create(campaign=campaign, manager=manager)
            serializer = CampaignEmployeeSerializer(campaign_employee)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Remove employee or manager from campaign",
        description="Remove an employee or manager from a specific campaign. Provide either employee_id or manager_id. Only managers can perform this action.",
        responses={200: "Success", 400: "Bad Request", 403: "Forbidden", 404: "Not Found"}
    )
    @action(detail=True, methods=['delete'])
    def remove_employee(self, request, pk=None):
        """Remove an employee or manager from a campaign."""
        campaign = self.get_object()
        user = request.user
        
        if not (user.is_superuser or (hasattr(user, 'manager') and user.manager)):
            return Response({'detail': 'Only managers or super users can remove people from campaigns.'}, status=status.HTTP_403_FORBIDDEN)
        
        employee_id = request.query_params.get('employee_id')
        manager_id = request.query_params.get('manager_id')
        
        # Validate that exactly one is provided
        if not employee_id and not manager_id:
            return Response({'detail': 'Either employee_id or manager_id parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if employee_id and manager_id:
            return Response({'detail': 'Cannot provide both employee_id and manager_id.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if employee_id:
                campaign_employee = CampaignEmployee.objects.get(campaign=campaign, employee_id=employee_id)
            else:
                campaign_employee = CampaignEmployee.objects.get(campaign=campaign, manager_id=manager_id)
            
            campaign_employee.delete()
            person_type = "employee" if employee_id else "manager"
            return Response({'detail': f'{person_type.capitalize()} removed from campaign successfully.'}, status=status.HTTP_200_OK)
        except CampaignEmployee.DoesNotExist:
            return Response({'detail': 'This person is not assigned to this campaign.'}, status=status.HTTP_404_NOT_FOUND)


class CampaignFormViewSet(viewsets.ModelViewSet):
    queryset = CampaignForm.objects.all()
    serializer_class = CampaignFormSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['campaign', 'status', 'sales_rep_id']
    search_fields = ['first_name', 'last_name', 'email', 'address_text']
    ordering_fields = ['created_at', 'current_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter forms based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all forms
            return CampaignForm.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see forms from campaigns they created
            return CampaignForm.objects.filter(campaign__created_by=user.manager)
        elif hasattr(user, 'employee') and user.employee:
            # Employees can see forms they submitted or from campaigns they're assigned to
            return CampaignForm.objects.filter(
                Q(sales_rep_id=user.employee.id) |
                Q(campaign__campaign_employees__employee=user.employee)
            )
        
        return CampaignForm.objects.none()
    
    def perform_create(self, serializer):
        """Set the sales_rep_id to the current user if they're an employee."""
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            serializer.save(sales_rep_id=user.employee.id)
        elif hasattr(user, 'manager') and user.manager:
            serializer.save(sales_rep_id=user.manager.id)
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CampaignFormListSerializer
        return CampaignFormSerializer


class CampaignAreaViewSet(viewsets.ModelViewSet):
    queryset = CampaignArea.objects.all()
    serializer_class = CampaignAreaSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerOnlyPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['campaign', 'area']
    ordering_fields = ['campaign__name', 'area__name']
    ordering = ['campaign__name', 'area__name']
    
    def get_queryset(self):
        """Filter campaign areas based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all campaign areas
            return CampaignArea.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see areas from campaigns they created
            return CampaignArea.objects.filter(campaign__created_by=user.manager)
        elif hasattr(user, 'employee') and user.employee:
            # Employees can see areas from campaigns they're assigned to
            return CampaignArea.objects.filter(campaign__campaign_employees__employee=user.employee)
        
        return CampaignArea.objects.none()


class CampaignEmployeeViewSet(viewsets.ModelViewSet):
    queryset = CampaignEmployee.objects.all()
    serializer_class = CampaignEmployeeSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerOnlyPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['campaign', 'employee', 'manager']  # Add manager
    ordering_fields = ['campaign__name', 'employee__name', 'manager__name']  # Add manager__name
    ordering = ['campaign__name', 'employee__name']
    
    def get_queryset(self):
        """Filter campaign assignments based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            # Super users can see all campaign assignments
            return CampaignEmployee.objects.all()
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see assignments from campaigns they created
            # Also include their own assignments as participants
            return CampaignEmployee.objects.filter(
                Q(campaign__created_by=user.manager) |
                Q(manager=user.manager)
            )
        elif hasattr(user, 'employee') and user.employee:
            # Employees can see their own assignments
            return CampaignEmployee.objects.filter(employee=user.employee)
        
        return CampaignEmployee.objects.none()
