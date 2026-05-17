"""
Serializers for the Todos app.
"""
from rest_framework import serializers
from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import Todo
from users.serializers import ManagerSerializer, EmployeeSerializer

User = get_user_model()


class TodoSerializer(serializers.ModelSerializer):
    """Serializer for Todo model."""
    
    # Read-only computed fields
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_deadline = serializers.SerializerMethodField()
    
    # Display fields
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    
    # User info (read-only, auto-set to current user)
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    # Assignment fields
    assigned_by = serializers.SerializerMethodField()
    
    class Meta:
        model = Todo
        fields = [
            'id', 'title', 'description', 'status', 'status_display',
            'priority', 'priority_display', 'deadline',
            'is_overdue', 'days_until_deadline',
            'related_address', 'related_campaign',
            'created_at', 'updated_at', 'completed_at',
            'user_id', 'user_name',
            'is_admin_assigned', 'assigned_by',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'completed_at', 
            'is_overdue', 'user_id', 'user_name',
            'is_admin_assigned', 'assigned_by',
        ]
    
    def get_days_until_deadline(self, obj):
        """Calculate days until deadline."""
        if not obj.deadline:
            return None
        delta = obj.deadline - timezone.now()
        return delta.days
    
    def get_assigned_by(self, obj):
        """Get admin who assigned this task."""
        if obj.assigned_by:
            return {
                'id': str(obj.assigned_by.id),
                'username': obj.assigned_by.username
            }
        return None
    
    def validate_deadline(self, value):
        """Validate deadline is not in the past (optional warning)."""
        if value and value < timezone.now():
            # Allow past deadlines (user might be adding old todo)
            # Just a soft validation, no error
            pass
        return value
    
    def validate(self, attrs):
        """Validate todo data."""
        # Ensure title is not empty
        if 'title' in attrs and not attrs['title'].strip():
            raise serializers.ValidationError({
                'title': 'Title cannot be empty.'
            })
        
        return attrs


class TodoMinimalSerializer(serializers.ModelSerializer):
    """Minimal serializer for listing todos (faster queries)."""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Todo
        fields = [
            'id', 'title', 'status', 'status_display',
            'priority', 'priority_display', 'deadline',
            'is_overdue', 'is_admin_assigned', 'created_at'
        ]


class TodoAssignUsersSerializer(serializers.Serializer):
    """
    Payload for POST /api/todos/assign-users/.

    Validates role matrix:
      - Admin  -> admin, manager, employee
      - Manager -> manager, employee only
    """

    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    priority = serializers.ChoiceField(
        choices=Todo.Priority.choices, default=Todo.Priority.MEDIUM
    )
    deadline = serializers.DateTimeField(required=False, allow_null=True, default=None)
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        help_text="List of auth_user UUIDs to assign this task to"
    )

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError('Title cannot be empty.')
        return value

    def validate_user_ids(self, value):
        requester = self.context['request'].user
        is_admin = requester.is_superuser and requester.is_staff

        users = User.objects.filter(id__in=value).select_related('manager', 'employee')
        found_ids = {str(u.id) for u in users}
        missing = [str(v) for v in value if str(v) not in found_ids]
        if missing:
            raise serializers.ValidationError(
                f"User IDs not found: {', '.join(missing)}"
            )

        if not is_admin:
            forbidden = []
            for u in users:
                if u.is_superuser and u.is_staff:
                    forbidden.append(str(u.id))
            if forbidden:
                raise serializers.ValidationError(
                    f"Managers cannot assign tasks to admins: {', '.join(forbidden)}"
                )

        invalid = []
        for u in users:
            is_known = (
                (u.is_superuser and u.is_staff)
                or (hasattr(u, 'manager') and u.manager is not None)
                or (hasattr(u, 'employee') and u.employee is not None)
            )
            if not is_known:
                invalid.append(str(u.id))
        if invalid:
            raise serializers.ValidationError(
                f"Users have no recognized role (admin/manager/employee): {', '.join(invalid)}"
            )

        return value


class TodoAssignmentUserSerializer(serializers.ModelSerializer):
    """
    Full user payload for TODO assignment screens.

    Includes complete user model fields, role/type metadata, and explicit
    manager_id / employee_id values for frontend filtering and rendering.
    """

    manager = ManagerSerializer(read_only=True)
    employee = EmployeeSerializer(read_only=True)
    manager_id = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    user_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'is_staff',
            'is_superuser',
            'ab_person_id',
            'employee_type',
            'admin_type',
            'date_joined',
            'last_login',
            'user_type',
            'manager_id',
            'employee_id',
            'manager',
            'employee',
        ]

    def get_manager_id(self, obj):
        return str(obj.manager.id) if hasattr(obj, 'manager') and obj.manager else None

    def get_employee_id(self, obj):
        return str(obj.employee.id) if hasattr(obj, 'employee') and obj.employee else None

    def get_user_type(self, obj):
        if obj.is_superuser and obj.is_staff:
            return 'admin'
        if hasattr(obj, 'manager') and obj.manager:
            return 'manager'
        if hasattr(obj, 'employee') and obj.employee:
            return 'employee'
        return 'unknown'


class TodoAssignmentUsersResponseSerializer(serializers.Serializer):
    """Response wrapper for role-aware assignment users endpoint."""

    requester_role = serializers.ChoiceField(choices=['admin', 'manager'])
    count = serializers.IntegerField()
    results = TodoAssignmentUserSerializer(many=True)

