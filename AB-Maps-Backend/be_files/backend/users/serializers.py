"""
Serializers for the users app.
"""
from rest_framework import serializers
from .models import User, Manager, Employee, SalesChiefTeamMember
from drf_spectacular.utils import extend_schema_serializer, OpenApiExample, extend_schema_field


class ManagerSerializer(serializers.ModelSerializer):
    """Serializer for Manager model."""
    ab_person_id = serializers.SerializerMethodField()
    is_sales_chief = serializers.SerializerMethodField()

    class Meta:
        model = Manager
        fields = [
            'id', 'name', 'email', 'phone', 'status',
            'ab_person_id', 'is_sales_chief',
            'is_online', 'last_seen', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ab_person_id', 'is_sales_chief', 'created_at', 'updated_at']

    def get_ab_person_id(self, obj):
        """Get ab_person_id from related User."""
        try:
            return obj.user.ab_person_id if obj.user else None
        except Exception:
            return None

    def get_is_sales_chief(self, obj):
        try:
            return obj.user.is_sales_chief
        except Exception:
            return False


class EmployeeSerializer(serializers.ModelSerializer):
    """Serializer for Employee model."""
    ab_person_id = serializers.SerializerMethodField()
    is_sales_chief = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'name', 'email', 'phone', 'status',
            'ab_person_id', 'is_sales_chief',
            'is_online', 'last_seen', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ab_person_id', 'is_sales_chief', 'created_at', 'updated_at']

    def get_ab_person_id(self, obj):
        """Get ab_person_id from related User."""
        try:
            return obj.user.ab_person_id if obj.user else None
        except Exception:
            return None

    def get_is_sales_chief(self, obj):
        try:
            return obj.user.is_sales_chief
        except Exception:
            return False


class EmployeeRequestSerializer(serializers.ModelSerializer):
    """Serializer for Employee creation/update requests."""
    is_sales_chief = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = Employee
        fields = [
            'name', 'email', 'phone', 'status',
            'is_online', 'last_seen', 'is_sales_chief'
        ]

    def update(self, instance, validated_data):
        is_sales_chief = validated_data.pop('is_sales_chief', None)
        if is_sales_chief is True:
            try:
                _linked = instance.user
            except Exception:
                _linked = None
            if not _linked:
                raise serializers.ValidationError({
                    'is_sales_chief': (
                        'No login user is linked to this employee. Link a User to this employee '
                        '(or set is_sales_chief on PATCH /api/users/users/{userId}/).'
                    ),
                })
        new_email = validated_data.get('email')
        employee = super().update(instance, validated_data)
        try:
            user = employee.user
        except Exception:
            user = None
        if user:
            user_fields = []
            if is_sales_chief is not None:
                user.is_sales_chief = is_sales_chief
                user_fields.append('is_sales_chief')
            if new_email and user.email != new_email:
                user.email = new_email
                user_fields.append('email')
            if user_fields:
                user.save(update_fields=user_fields)
        return employee

    def create(self, validated_data):
        is_sales_chief = validated_data.pop('is_sales_chief', None)
        employee = super().create(validated_data)
        if is_sales_chief is not None:
            try:
                user = employee.user
            except Exception:
                user = None
            if user:
                user.is_sales_chief = is_sales_chief
                user.save(update_fields=['is_sales_chief'])
            elif is_sales_chief:
                raise serializers.ValidationError({
                    'is_sales_chief': (
                        'No login user is linked to this employee. Link a User first, '
                        'then set is_sales_chief.'
                    ),
                })
        return employee

    def to_representation(self, instance):
        return EmployeeSerializer(instance, context=self.context).data


class ManagerRequestSerializer(serializers.ModelSerializer):
    """Serializer for Manager create/update — writes User.is_sales_chief when linked."""
    is_sales_chief = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = Manager
        fields = [
            'name', 'email', 'phone', 'status',
            'is_online', 'last_seen', 'is_sales_chief'
        ]

    def update(self, instance, validated_data):
        is_sales_chief = validated_data.pop('is_sales_chief', None)
        if is_sales_chief is True:
            try:
                _linked = instance.user
            except Exception:
                _linked = None
            if not _linked:
                raise serializers.ValidationError({
                    'is_sales_chief': (
                        'No login user is linked to this manager. Link a User to this manager '
                        '(or set is_sales_chief on PATCH /api/users/users/{userId}/).'
                    ),
                })
        new_email = validated_data.get('email')
        manager = super().update(instance, validated_data)
        try:
            user = manager.user
        except Exception:
            user = None
        if user:
            user_fields = []
            if is_sales_chief is not None:
                user.is_sales_chief = is_sales_chief
                user_fields.append('is_sales_chief')
            if new_email and user.email != new_email:
                user.email = new_email
                user_fields.append('email')
            if user_fields:
                user.save(update_fields=user_fields)
        return manager

    def create(self, validated_data):
        is_sales_chief = validated_data.pop('is_sales_chief', None)
        manager = super().create(validated_data)
        if is_sales_chief is not None:
            try:
                user = manager.user
            except Exception:
                user = None
            if user:
                user.is_sales_chief = is_sales_chief
                user.save(update_fields=['is_sales_chief'])
            elif is_sales_chief:
                raise serializers.ValidationError({
                    'is_sales_chief': (
                        'No login user is linked to this manager. Link a User first, '
                        'then set is_sales_chief.'
                    ),
                })
        return manager

    def to_representation(self, instance):
        return ManagerSerializer(instance, context=self.context).data


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    ab_person_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    employee_type = serializers.ChoiceField(
        choices=User.EMPLOYEE_TYPE_CHOICES,
        required=False,
        allow_null=True,
        help_text="Employee type - only for employees"
    )
    admin_type = serializers.ChoiceField(
        choices=User.ADMIN_TYPE_CHOICES,
        required=False,
        allow_null=True,
        help_text="Admin type - only for superusers"
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'ab_person_id', 'employee_type', 'admin_type',
            'employee', 'manager', 'is_active', 'is_sales_chief'
        ]
        read_only_fields = ['id']
    
    def validate_ab_person_id(self, value):
        """Validate ab_person_id format and uniqueness."""
        if value is None or value == '':
            return None
        
        # Check format (must be 4 digits)
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError("Person ID must be exactly 4 digits")
        
        # Check uniqueness (exclude current instance if updating)
        queryset = User.objects.filter(ab_person_id=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError("This Person ID is already in use")
        
        return value


class UserRequestSerializer(serializers.ModelSerializer):
    """Serializer for User creation/update requests."""

    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name', 'is_active', 'is_sales_chief'
        ]


# Authentication Serializers
class LoginRequestSerializer(serializers.Serializer):
    """Serializer for login request."""
    username = serializers.CharField(
        help_text="User's username"
    )
    password = serializers.CharField(
        help_text="User's password",
        write_only=True
    )


class UserInfoSerializer(serializers.Serializer):
    """Serializer for user info in auth responses."""
    id = serializers.CharField(help_text="User ID")
    name = serializers.CharField(help_text="User's display name")
    email = serializers.CharField(help_text="User's email address")
    ab_person_id = serializers.CharField(help_text="4-digit person ID", required=False, allow_null=True)
    employee_type = serializers.CharField(help_text="Employee type (maps_emp or qc_emp)", required=False, allow_null=True)
    admin_type = serializers.CharField(help_text="Admin type (maps_admin or qc_admin)", required=False, allow_null=True)


class LoginResponseSerializer(serializers.Serializer):
    """Serializer for login response."""
    refresh = serializers.CharField(help_text="JWT refresh token")
    access = serializers.CharField(help_text="JWT access token")
    user_id = serializers.CharField(help_text="User ID")
    username = serializers.CharField(help_text="Username")
    email = serializers.CharField(help_text="User's email")
    user_type = serializers.CharField(help_text="User type: manager, employee, or admin")
    user_info = UserInfoSerializer(help_text="Detailed user information")
    expires_in = serializers.IntegerField(help_text="Token expiration time in seconds")
    is_sales_chief = serializers.BooleanField(
        help_text="True if user is flagged as sales chief (QC sales-chief directory)"
    )


class LogoutRequestSerializer(serializers.Serializer):
    """Serializer for logout request."""
    refresh = serializers.CharField(
        help_text="JWT refresh token to blacklist"
    )


class LogoutResponseSerializer(serializers.Serializer):
    """Serializer for logout response."""
    message = serializers.CharField(help_text="Success message")
    timestamp = serializers.CharField(help_text="Logout timestamp")


class RefreshRequestSerializer(serializers.Serializer):
    """Serializer for token refresh request."""
    refresh = serializers.CharField(
        help_text="JWT refresh token"
    )


class RefreshResponseSerializer(serializers.Serializer):
    """Serializer for token refresh response."""
    access = serializers.CharField(help_text="New JWT access token")
    expires_in = serializers.IntegerField(help_text="Token expiration time in seconds")


class ErrorResponseSerializer(serializers.Serializer):
    """Serializer for error responses."""
    error = serializers.CharField(help_text="Error message")
    detail = serializers.CharField(help_text="Detailed error information", required=False)


@extend_schema_serializer(
    examples=[
        OpenApiExample(
            'Maps Admin registration',
            value={
                "username": "maps_admin1",
                "email": "maps_admin1@example.com",
                "password": "strongpassword123",
                "password_confirm": "strongpassword123",
                "first_name": "Maps",
                "last_name": "Admin",
                "user_type": "superuser",
                "admin_type": "maps_admin"
            },
            request_only=True,
        ),
        OpenApiExample(
            'QC Admin registration',
            value={
                "username": "qc_admin1",
                "email": "qc_admin1@example.com",
                "password": "strongpassword123",
                "password_confirm": "strongpassword123",
                "first_name": "QC",
                "last_name": "Admin",
                "user_type": "superuser",
                "admin_type": "qc_admin"
            },
            request_only=True,
        ),
        OpenApiExample(
            'Manager registration',
            value={
                "username": "manager1",
                "email": "manager1@example.com",
                "password": "strongpassword123",
                "password_confirm": "strongpassword123",
                "first_name": "John",
                "last_name": "Doe",
                "user_type": "manager"
            },
            request_only=True,
        ),
        OpenApiExample(
            'Maps Employee registration',
            value={
                "username": "maps_emp1",
                "email": "maps_emp1@example.com",
                "password": "strongpassword123",
                "password_confirm": "strongpassword123",
                "first_name": "Jane",
                "last_name": "Smith",
                "user_type": "employee",
                "employee_type": "maps_emp"
            },
            request_only=True,
        ),
        OpenApiExample(
            'QC Employee registration',
            value={
                "username": "qc_emp1",
                "email": "qc_emp1@example.com",
                "password": "strongpassword123",
                "password_confirm": "strongpassword123",
                "first_name": "John",
                "last_name": "Doe",
                "user_type": "employee",
                "employee_type": "qc_emp"
            },
            request_only=True,
        ),
    ]
)
class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration."""
    username = serializers.CharField(
        max_length=150, 
        help_text="Unique username for the user"
    )
    email = serializers.EmailField(
        required=False, 
        allow_blank=True, 
        help_text="User's email address (optional)"
    )
    password = serializers.CharField(
        write_only=True, 
        min_length=8, 
        help_text="Password (minimum 8 characters)"
    )
    password_confirm = serializers.CharField(
        write_only=True, 
        min_length=8, 
        help_text="Password confirmation (must match password)"
    )
    first_name = serializers.CharField(
        max_length=30, 
        required=False, 
        allow_blank=True, 
        help_text="First name (optional)"
    )
    last_name = serializers.CharField(
        max_length=30, 
        required=False, 
        allow_blank=True, 
        help_text="Last name (optional)"
    )
    user_type = serializers.ChoiceField(
        choices=[('employee', 'employee'), ('manager', 'manager'), ('superuser', 'superuser')],
        help_text="Type of user to register. Choices: 'employee', 'manager', 'superuser'"
    )
    employee_type = serializers.ChoiceField(
        choices=[('maps_emp', 'Maps Employee'), ('qc_emp', 'QC Employee')],
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Employee type - required when user_type='employee'. Choices: 'maps_emp', 'qc_emp'"
    )
    admin_type = serializers.ChoiceField(
        choices=[('maps_admin', 'Maps Admin'), ('qc_admin', 'QC Admin')],
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Admin type - required when user_type='superuser'. Choices: 'maps_admin', 'qc_admin'"
    )
    ab_person_id = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        max_length=4,
        help_text="Optional 4-digit person ID (admin can set)"
    )
    
    def validate_ab_person_id(self, value):
        """Validate ab_person_id if provided."""
        if not value:
            return None
        
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError("Person ID must be exactly 4 digits")
        
        if User.objects.filter(ab_person_id=value).exists():
            raise serializers.ValidationError("This Person ID is already in use")
        
        return value
    
    def validate(self, attrs) -> dict:
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        
        user_type = attrs.get('user_type')
        employee_type = attrs.get('employee_type')
        admin_type = attrs.get('admin_type')
        
        # Validate employee_type
        if user_type == 'employee':
            if not employee_type:
                # Default to maps_emp for backward compatibility
                attrs['employee_type'] = 'maps_emp'
            elif employee_type not in ['maps_emp', 'qc_emp']:
                raise serializers.ValidationError({
                    'employee_type': 'employee_type must be either "maps_emp" or "qc_emp"'
                })
        elif employee_type is not None:
            raise serializers.ValidationError({
                'employee_type': 'employee_type can only be set when user_type is "employee"'
            })
        
        # Validate admin_type
        if user_type == 'superuser':
            if not admin_type:
                # Default to maps_admin for backward compatibility
                attrs['admin_type'] = 'maps_admin'
            elif admin_type not in ['maps_admin', 'qc_admin']:
                raise serializers.ValidationError({
                    'admin_type': 'admin_type must be either "maps_admin" or "qc_admin"'
                })
        elif admin_type is not None:
            raise serializers.ValidationError({
                'admin_type': 'admin_type can only be set when user_type is "superuser"'
            })
        
        return attrs
    
    def create(self, validated_data) -> 'User':
        user_type = validated_data.pop('user_type')
        password_confirm = validated_data.pop('password_confirm')
        ab_person_id = validated_data.pop('ab_person_id', None)
        employee_type = validated_data.pop('employee_type', None)
        admin_type = validated_data.pop('admin_type', None)
        
        # Create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        
        # Set ab_person_id if provided
        if ab_person_id:
            user.ab_person_id = ab_person_id
        
        # Create corresponding manager, employee, or superuser
        if user_type == 'superuser':
            # Create superuser with manager profile
            user.is_superuser = True
            user.is_staff = True
            # Set admin_type (default to maps_admin if not provided)
            user.admin_type = admin_type or 'maps_admin'
            manager = Manager.objects.create(
                name=f"{user.first_name} {user.last_name}".strip() or user.username,
                email=user.email,
            )
            user.manager = manager
        elif user_type == 'manager':
            manager = Manager.objects.create(
                name=f"{user.first_name} {user.last_name}".strip() or user.username,
                email=user.email,
            )
            user.manager = manager
        else:  # employee
            employee = Employee.objects.create(
                name=f"{user.first_name} {user.last_name}".strip() or user.username,
                email=user.email,
            )
            user.employee = employee
            # Set employee_type (default to maps_emp if not provided)
            user.employee_type = employee_type or 'maps_emp'
        
        user.save()
        return user


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile updates."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    ab_person_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    employee_type = serializers.ChoiceField(
        choices=User.EMPLOYEE_TYPE_CHOICES,
        required=False,
        allow_null=True,
        help_text="Employee type - only for employees"
    )
    admin_type = serializers.ChoiceField(
        choices=User.ADMIN_TYPE_CHOICES,
        required=False,
        allow_null=True,
        help_text="Admin type - only for superusers"
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'ab_person_id', 'employee_type', 'admin_type',
            'employee', 'manager', 'is_active'
        ]
        read_only_fields = ['id', 'username']
    
    def validate_ab_person_id(self, value):
        """Validate ab_person_id format and uniqueness."""
        if value is None or value == '':
            return None
        
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError("Person ID must be exactly 4 digits")
        
        queryset = User.objects.filter(ab_person_id=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError("This Person ID is already in use")
        
        return value


# ──────────────────────────────────────────────
# Sales Chief Team Serializers
# ──────────────────────────────────────────────

class SalesChiefTeamMemberSerializer(serializers.ModelSerializer):
    """Read serializer for a single team membership row."""
    user_id = serializers.UUIDField(source='member.id', read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='member.email', read_only=True)
    ab_person_id = serializers.CharField(source='member.ab_person_id', read_only=True)
    username = serializers.CharField(source='member.username', read_only=True)

    class Meta:
        model = SalesChiefTeamMember
        fields = ['user_id', 'name', 'email', 'username', 'ab_person_id', 'role', 'added_at']

    def get_name(self, obj):
        u = obj.member
        return f"{u.first_name} {u.last_name}".strip() or u.username


class TeamAddSerializer(serializers.Serializer):
    """
    Body for adding a single member to a sales chief's team.

    ``role`` is optional — when omitted the backend infers it from the user's
    profile (``manager`` link → "manager", ``employee`` link → "employee").
    Callers may still pass ``role`` explicitly to override.
    """
    user_id = serializers.UUIDField()
    role = serializers.ChoiceField(
        choices=['manager', 'employee'],
        required=False,
        allow_null=True,
        allow_blank=True,
    )


class TeamBulkAddSerializer(serializers.Serializer):
    """Body for bulk-adding members to a sales chief's team."""
    members = TeamAddSerializer(many=True, min_length=1)


class TeamBulkRemoveSerializer(serializers.Serializer):
    """Body for bulk-removing members from a sales chief's team."""
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )


class WelcomeEmailRequestSerializer(serializers.Serializer):
    """Serializer for welcome email request."""
    receiver_email = serializers.EmailField(
        help_text="The email address of the new user"
    )
    password = serializers.CharField(
        help_text="The password generated for the new user",
        write_only=True
    )
    user_type = serializers.ChoiceField(
        choices=[('manager', 'Manager'), ('employee', 'Employee'), ('superuser', 'Superuser')],
        help_text="The type of user (manager, employee, or superuser)"
    )
    user_name = serializers.CharField(
        help_text="The username of the new user"
    )


class WelcomeEmailResponseSerializer(serializers.Serializer):
    """Serializer for welcome email response."""
    status = serializers.CharField(help_text="Status of the email sending operation")
    message = serializers.CharField(help_text="Success or error message") 