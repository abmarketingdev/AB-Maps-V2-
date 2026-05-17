"""
Views for the Todos app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from datetime import timedelta
from drf_spectacular.utils import extend_schema

from .models import Todo
from .serializers import (
    TodoSerializer, TodoMinimalSerializer,
    TodoAssignmentUserSerializer, TodoAssignmentUsersResponseSerializer,
    TodoAssignUsersSerializer,
)
from .permissions import (
    TodoPermission,
    TodoAssignmentUsersPermission,
    TaskAssignmentPermission,
)

User = get_user_model()


class TodoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Todo model.
    
    Users can only see and manage their OWN todos.
    Includes both personal todos and admin-assigned todos.
    
    Use ?is_admin_assigned=true to filter admin-assigned todos only.
    Use ?is_admin_assigned=false to filter personal todos only.
    """
    
    serializer_class = TodoSerializer
    permission_classes = [IsAuthenticated, TodoPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'deadline']
    search_fields = ['title', 'description']
    ordering_fields = ['deadline', 'priority', 'created_at', 'updated_at']
    ordering = ['-priority', 'deadline']
    
    def get_queryset(self):
        """
        Return only current user's todos.
        
        Supports filtering by is_admin_assigned query parameter.
        """
        queryset = Todo.objects.filter(user=self.request.user)
        
        is_admin_assigned = self.request.query_params.get('is_admin_assigned')
        if is_admin_assigned is not None:
            queryset = queryset.filter(
                is_admin_assigned=is_admin_assigned.lower() == 'true'
            )
        
        return queryset
    
    def perform_create(self, serializer):
        """Personal task: always owned by requester, never flagged as assigned."""
        serializer.save(
            user=self.request.user,
            assigned_by=None,
            is_admin_assigned=False,
        )
    
    @extend_schema(
        summary="Mark todo as completed",
        description="Mark a todo as completed and set completion timestamp",
        responses={200: TodoSerializer}
    )
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark todo as completed."""
        todo = self.get_object()
        todo.status = Todo.Status.COMPLETED
        todo.completed_at = timezone.now()
        todo.save()
        
        serializer = self.get_serializer(todo)
        return Response(serializer.data)
    
    @extend_schema(
        summary="Mark todo as in progress",
        description="Mark a todo as in progress",
        responses={200: TodoSerializer}
    )
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Mark todo as in progress."""
        todo = self.get_object()
        todo.status = Todo.Status.IN_PROGRESS
        todo.save()
        
        serializer = self.get_serializer(todo)
        return Response(serializer.data)
    
    @extend_schema(
        summary="Get todos due today",
        description="Retrieve all todos due today that are not completed",
        responses={200: TodoSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get todos due today."""
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        todos = self.get_queryset().filter(
            deadline__gte=today_start,
            deadline__lt=today_end,
            status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
        )
        
        serializer = self.get_serializer(todos, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        summary="Get overdue todos",
        description="Retrieve all overdue todos that are not completed",
        responses={200: TodoSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue todos."""
        todos = self.get_queryset().filter(
            deadline__lt=timezone.now(),
            status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
        )
        
        serializer = self.get_serializer(todos, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        summary="Get todo statistics",
        description="Get comprehensive statistics about current user's todos",
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'total': {'type': 'integer'},
                    'pending': {'type': 'integer'},
                    'in_progress': {'type': 'integer'},
                    'completed': {'type': 'integer'},
                    'overdue': {'type': 'integer'},
                    'today': {'type': 'integer'},
                    'this_week': {'type': 'integer'},
                    'high_priority': {'type': 'integer'},
                    'with_deadline': {'type': 'integer'},
                }
            }
        }
    )
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get todo statistics for current user."""
        queryset = self.get_queryset()
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        week_end = today_start + timedelta(days=7)
        
        stats = {
            'total': queryset.count(),
            'pending': queryset.filter(status=Todo.Status.PENDING).count(),
            'in_progress': queryset.filter(status=Todo.Status.IN_PROGRESS).count(),
            'completed': queryset.filter(status=Todo.Status.COMPLETED).count(),
            'overdue': queryset.filter(
                deadline__lt=now,
                status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
            ).count(),
            'today': queryset.filter(
                deadline__gte=today_start,
                deadline__lt=today_end,
                status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
            ).count(),
            'this_week': queryset.filter(
                deadline__gte=today_start,
                deadline__lt=week_end,
                status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
            ).count(),
            'high_priority': queryset.filter(
                priority=Todo.Priority.HIGH,
                status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
            ).count(),
            'with_deadline': queryset.filter(
                deadline__isnull=False
            ).count(),
        }
        
        return Response(stats)
    
    @extend_schema(
        summary="Get upcoming todos",
        description="Get todos due within the next 7 days",
        responses={200: TodoSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get todos due within next 7 days."""
        now = timezone.now()
        week_from_now = now + timedelta(days=7)
        
        todos = self.get_queryset().filter(
            deadline__gte=now,
            deadline__lte=week_from_now,
            status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
        ).order_by('deadline')
        
        serializer = self.get_serializer(todos, many=True)
        return Response(serializer.data)
    
    def list(self, request, *args, **kwargs):
        """
        List todos with optional filters.
        
        Query Parameters:
        - status: Filter by status (pending, in_progress, completed)
        - priority: Filter by priority (low, medium, high)
        - deadline: Filter by deadline
        - search: Search in title and description
        - ordering: Order by fields (deadline, priority, created_at, updated_at)
        """
        return super().list(request, *args, **kwargs)
    
    def create(self, request, *args, **kwargs):
        """
        Create a new todo.
        
        The user field is automatically set to the current user.
        """
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """
        Update a todo (full update).
        
        You can only update your own todos.
        """
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """
        Partially update a todo.
        
        You can only update your own todos.
        """
        return super().partial_update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete a todo.
        
        You can only delete your own todos.
        Deleting a todo does NOT affect related addresses or campaigns.
        """
        return super().destroy(request, *args, **kwargs)
    
    @extend_schema(
        summary="Bulk complete todos",
        description="Mark multiple todos as completed at once",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'todo_ids': {
                        'type': 'array',
                        'items': {'type': 'string', 'format': 'uuid'},
                        'description': 'List of TODO IDs to mark as complete'
                    }
                },
                'required': ['todo_ids']
            }
        },
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'completed': {'type': 'integer', 'description': 'Number of TODOs marked as complete'},
                    'failed': {'type': 'integer', 'description': 'Number of TODOs that failed'},
                    'message': {'type': 'string'}
                }
            }
        }
    )
    @action(detail=False, methods=['post'])
    def bulk_complete(self, request):
        """
        Mark multiple todos as completed.
        
        Request body:
        {
            "todo_ids": ["uuid1", "uuid2", "uuid3"]
        }
        
        Only completes TODOs that belong to the current user.
        """
        todo_ids = request.data.get('todo_ids', [])
        
        if not todo_ids:
            return Response(
                {'error': 'todo_ids is required and must be a non-empty list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not isinstance(todo_ids, list):
            return Response(
                {'error': 'todo_ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter to only user's own TODOs
        todos = self.get_queryset().filter(
            id__in=todo_ids,
            status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
        )
        
        completed_count = 0
        for todo in todos:
            todo.status = Todo.Status.COMPLETED
            todo.completed_at = timezone.now()
            todo.save()
            completed_count += 1
        
        failed_count = len(todo_ids) - completed_count
        
        return Response({
            'completed': completed_count,
            'failed': failed_count,
            'message': f'Successfully completed {completed_count} todo(s)'
        })
    
    @extend_schema(
        summary="Bulk delete todos",
        description="Delete multiple todos at once",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'todo_ids': {
                        'type': 'array',
                        'items': {'type': 'string', 'format': 'uuid'},
                        'description': 'List of TODO IDs to delete'
                    }
                },
                'required': ['todo_ids']
            }
        },
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'deleted': {'type': 'integer', 'description': 'Number of TODOs deleted'},
                    'message': {'type': 'string'}
                }
            }
        }
    )
    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """
        Delete multiple todos at once.
        
        Request body:
        {
            "todo_ids": ["uuid1", "uuid2", "uuid3"]
        }
        
        Only deletes TODOs that belong to the current user.
        Deleting TODOs does NOT affect related addresses or campaigns.
        """
        todo_ids = request.data.get('todo_ids', [])
        
        if not todo_ids:
            return Response(
                {'error': 'todo_ids is required and must be a non-empty list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not isinstance(todo_ids, list):
            return Response(
                {'error': 'todo_ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter to only user's own TODOs
        todos = self.get_queryset().filter(id__in=todo_ids)
        deleted_count = todos.count()
        todos.delete()
        
        return Response({
            'deleted': deleted_count,
            'message': f'Successfully deleted {deleted_count} todo(s)'
        })


@extend_schema(
    summary="List assignment users by requester role",
    description=(
        "Returns users available for TODO assignment based on JWT requester role.\n\n"
        "- If requester is manager: returns managers + employees\n"
        "- If requester is admin (is_superuser + is_staff): returns admins + managers + employees\n\n"
        "Each result includes full user fields and explicit manager_id / employee_id plus role metadata."
    ),
    responses={200: TodoAssignmentUsersResponseSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, TodoAssignmentUsersPermission])
def assignment_users(request):
    """
    Role-aware user directory for TODO assignment UIs.

    Managers receive managers + employees.
    Admins receive admins + managers + employees.
    """
    user = request.user
    is_admin = user.is_superuser and user.is_staff

    queryset = User.objects.select_related('manager', 'employee')

    if is_admin:
        queryset = queryset.filter(
            Q(is_superuser=True, is_staff=True) |
            Q(manager__isnull=False) |
            Q(employee__isnull=False)
        ).distinct()
    else:
        queryset = queryset.filter(
            Q(manager__isnull=False) |
            Q(employee__isnull=False)
        ).exclude(
            is_superuser=True,
            is_staff=True
        ).distinct()

    queryset = queryset.order_by('username')
    serializer = TodoAssignmentUserSerializer(queryset, many=True)

    requester_role = 'admin' if is_admin else 'manager'
    return Response({
        'requester_role': requester_role,
        'count': queryset.count(),
        'results': serializer.data
    })


@extend_schema(
    summary="Assign task to users (role-aware)",
    description=(
        "Creates one Todo per assignee with `is_admin_assigned=True`.\n\n"
        "Role matrix:\n"
        "- Admin  -> admin, manager, employee\n"
        "- Manager -> manager, employee (NOT admin)\n"
        "- Employee -> 403\n"
    ),
    request=TodoAssignUsersSerializer,
    responses={
        201: {
            'type': 'object',
            'properties': {
                'message': {'type': 'string'},
                'assigned_count': {'type': 'integer'},
                'created_todos': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'todo_id': {'type': 'string', 'format': 'uuid'},
                            'user_id': {'type': 'string', 'format': 'uuid'},
                            'username': {'type': 'string'},
                            'user_type': {'type': 'string'},
                        }
                    }
                }
            }
        }
    },
)
@api_view(['POST'])
@permission_classes([IsAuthenticated, TaskAssignmentPermission])
def assign_users_create(request):
    """
    Unified task assignment endpoint.

    Creates one Todo per user_id with is_admin_assigned=True and
    assigned_by=request.user. Enforces role matrix in the serializer.
    """
    serializer = TodoAssignUsersSerializer(
        data=request.data, context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    user_ids = data['user_ids']
    users = User.objects.filter(id__in=user_ids).select_related('manager', 'employee')

    created_todos = []
    with transaction.atomic():
        for assignee in users:
            todo = Todo.objects.create(
                user=assignee,
                assigned_by=request.user,
                is_admin_assigned=True,
                title=data['title'],
                description=data.get('description', ''),
                priority=data.get('priority', Todo.Priority.MEDIUM),
                deadline=data.get('deadline'),
                status=Todo.Status.PENDING,
            )

            if assignee.is_superuser and assignee.is_staff:
                user_type = 'admin'
            elif hasattr(assignee, 'manager') and assignee.manager:
                user_type = 'manager'
            elif hasattr(assignee, 'employee') and assignee.employee:
                user_type = 'employee'
            else:
                user_type = 'unknown'

            created_todos.append({
                'todo_id': str(todo.id),
                'user_id': str(assignee.id),
                'username': assignee.username,
                'user_type': user_type,
            })

    return Response(
        {
            'message': f'Successfully assigned task to {len(created_todos)} user(s)',
            'assigned_count': len(created_todos),
            'created_todos': created_todos,
        },
        status=status.HTTP_201_CREATED,
    )
