"""
Views for the users app.
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.contrib.auth import authenticate
from django.conf import settings as django_settings
from django.db import models
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from .models import User, Manager, Employee, SalesChiefTeamMember
from .serializers import (
    UserSerializer, UserRequestSerializer, ProfileSerializer,
    ManagerSerializer, ManagerRequestSerializer, EmployeeSerializer, EmployeeRequestSerializer,
    RegisterSerializer, LoginRequestSerializer, LoginResponseSerializer,
    LogoutRequestSerializer, LogoutResponseSerializer, RefreshRequestSerializer,
    RefreshResponseSerializer, ErrorResponseSerializer,
    WelcomeEmailRequestSerializer, WelcomeEmailResponseSerializer,
    SalesChiefTeamMemberSerializer, TeamAddSerializer, TeamBulkAddSerializer, TeamBulkRemoveSerializer,
)
from drf_spectacular.utils import extend_schema, OpenApiExample
from django.db import IntegrityError


class IsManagerOrReadOnly(permissions.BasePermission):
    """Custom permission to allow managers to edit, others to read."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return hasattr(request.user, 'manager') and request.user.manager is not None


class IsAdminOrManagerOrReadOnly(permissions.BasePermission):
    """Custom permission to allow admins and managers to edit, others to read."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        # Allow superusers (admins) to perform all operations
        if request.user.is_superuser:
            return True
        # Allow managers to perform all operations
        return hasattr(request.user, 'manager') and request.user.manager is not None


class IsManagerOrSelf(permissions.BasePermission):
    """Custom permission to allow managers to edit, users to edit their own profile."""
    
    def has_permission(self, request, view):
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Superusers (admins) can edit anything
        if request.user.is_superuser:
            return True
        # Managers can edit anything
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        # Users can edit their own profile
        if isinstance(obj, User):
            return obj == request.user
        return False


class SuperUserOnlyPermission(permissions.BasePermission):
    """Custom permission to allow only superusers to access certain endpoints."""
    
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser


class ManagerViewSet(viewsets.ModelViewSet):
    """ViewSet for Manager model."""
    queryset = Manager.objects.all()
    serializer_class = ManagerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'is_online']
    search_fields = ['name', 'email']
    ordering_fields = ['name', 'created_at', 'last_seen']
    ordering = ['name']
    pagination_class = None  # No pagination - return all results

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ManagerRequestSerializer
        return ManagerSerializer

    def get_queryset(self):
        """Filter queryset based on user permissions."""
        # Exclude managers who have been promoted to superuser
        # (they should only appear in the superusers list, not the managers list)
        base_qs = Manager.objects.exclude(user__is_superuser=True)
        
        # Superusers (admins) can see all managers
        if self.request.user.is_superuser:
            return base_qs
        elif hasattr(self.request.user, 'manager') and self.request.user.manager is not None:
            # Managers can see all managers
            return base_qs
        elif hasattr(self.request.user, 'employee') and self.request.user.employee is not None:
            # Employees can see all managers (no restriction)
            return base_qs
        return Manager.objects.none()


class EmployeeViewSet(viewsets.ModelViewSet):
    """ViewSet for Employee model."""
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'is_online']
    search_fields = ['name', 'email']
    ordering_fields = ['name', 'created_at', 'last_seen']
    ordering = ['name']
    
    def get_serializer_class(self):
        """Return appropriate serializer class."""
        if self.action in ['create', 'update', 'partial_update']:
            return EmployeeRequestSerializer
        return EmployeeSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions and query params."""
        queryset = Employee.objects.all()
        request = self.request
        
        # Superusers (admins) can see all employees
        if request.user.is_superuser:
            return queryset
        # Managers can see all employees
        elif hasattr(request.user, 'manager') and request.user.manager is not None:
            return queryset
        elif hasattr(request.user, 'employee') and request.user.employee is not None:
            # Employees can only see themselves
            return Employee.objects.filter(id=request.user.employee.id)
        return Employee.objects.none()


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User model."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrSelf]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined']
    ordering = ['username']
    
    def get_serializer_class(self):
        """Return appropriate serializer class."""
        if self.action in ['create', 'update', 'partial_update']:
            return UserRequestSerializer
        return UserSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        # Superusers (admins) can see all users
        if self.request.user.is_superuser:
            return User.objects.all()
        elif hasattr(self.request.user, 'manager') and self.request.user.manager is not None:
            # Managers can see all users
            return User.objects.all()
        elif hasattr(self.request.user, 'employee') and self.request.user.employee is not None:
            # Employees can only see themselves
            return User.objects.filter(id=self.request.user.id)
        return User.objects.none()
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def profile(self, request):
        """Get or update current user's profile."""
        if request.method == 'GET':
            serializer = ProfileSerializer(request.user)
            return Response(serializer.data)
        
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="List all superusers",
        description="Returns all superusers in the system. Only accessible by superusers.",
        responses={200: UserSerializer(many=True)},
        examples=[
            OpenApiExample(
                'Superusers List',
                value=[
                    {
                        'id': '123e4567-e89b-12d3-a456-426614174000',
                        'username': 'admin1',
                        'email': 'admin1@example.com',
                        'first_name': 'Admin',
                        'last_name': 'User',
                        'is_active': True,
                        'manager': {
                            'id': '456e7890-e89b-12d3-a456-426614174001',
                            'name': 'Admin User',
                            'email': 'admin1@example.com'
                        }
                    }
                ],
                response_only=True
            )
        ]
    )
    @action(detail=False, methods=['get'], permission_classes=[SuperUserOnlyPermission])
    def superusers(self, request):
        """List all superusers. Only accessible by superusers."""
        superusers = User.objects.filter(is_superuser=True)
        serializer = UserSerializer(superusers, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Create a new superuser",
        description="Create a new superuser with manager profile. Only accessible by existing superusers.",
        request=RegisterSerializer,
        responses={201: UserSerializer, 400: "Bad Request", 403: "Forbidden"},
        examples=[
            OpenApiExample(
                'Create Superuser',
                value={
                    "username": "admin2",
                    "email": "admin2@example.com",
                    "password": "strongpassword123",
                    "password_confirm": "strongpassword123",
                    "first_name": "Admin",
                    "last_name": "Two",
                    "user_type": "superuser"
                },
                request_only=True
            )
        ]
    )
    @action(detail=False, methods=['post'], permission_classes=[SuperUserOnlyPermission])
    def create_superuser(self, request):
        """Create a new superuser. Only accessible by existing superusers."""
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = serializer.save()
                user_serializer = UserSerializer(user)
                return Response(user_serializer.data, status=status.HTTP_201_CREATED)
            except IntegrityError as e:
                if 'unique constraint' in str(e).lower() or 'duplicate key' in str(e).lower():
                    return Response(
                        {"username": "Username already exists. Please choose another."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                raise
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Delete a superuser",
        description="Delete a superuser by ID. Only accessible by existing superusers.",
        responses={204: "No Content", 400: "Bad Request", 403: "Forbidden", 404: "Not Found"},
        examples=[
            OpenApiExample(
                'Delete Success',
                value=None,
                response_only=True
            )
        ]
    )
    @action(detail=True, methods=['delete'], permission_classes=[SuperUserOnlyPermission])
    def delete_superuser(self, request, pk=None):
        """Delete a superuser. Only accessible by existing superusers."""
        try:
            superuser = User.objects.get(id=pk, is_superuser=True)
            # Prevent self-deletion
            if superuser == request.user:
                return Response(
                    {"error": "You cannot delete your own account."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            superuser.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response(
                {"error": "Superuser not found."},
                status=status.HTTP_404_NOT_FOUND
            )

    @extend_schema(
        summary="Check if current user is superuser",
        description="Returns true if the logged-in user has is_superuser=True in the auth_user table, false otherwise.",
        responses={
            200: OpenApiExample(
                'Superuser Check Response',
                value={
                    'is_superuser': True
                },
                response_only=True
            ),
            401: "Unauthorized"
        },
        examples=[
            OpenApiExample(
                'Is Superuser',
                value={
                    'is_superuser': True
                },
                response_only=True
            ),
            OpenApiExample(
                'Not Superuser',
                value={
                    'is_superuser': False
                },
                response_only=True
            )
        ]
    )
    @action(detail=False, methods=['get'])
    def check_superuser(self, request):
        """Check if the current logged-in user is a superuser."""
        # Query the auth_user table directly using the logged-in user's ID
        is_superuser = request.user.is_superuser
        
        return Response({
            'is_superuser': is_superuser
        })


class AuthViewSet(viewsets.ViewSet):
    """ViewSet for authentication endpoints."""
    permission_classes = [permissions.AllowAny]
    
    @extend_schema(
        request=LoginRequestSerializer,
        responses={
            200: LoginResponseSerializer,
            400: ErrorResponseSerializer,
            401: ErrorResponseSerializer
        },
        description="User login endpoint. Returns JWT tokens and user info.",
        examples=[
            OpenApiExample(
                'Login Success',
                value={
                    'refresh': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                    'access': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                    'user_id': '123e4567-e89b-12d3-a456-426614174000',
                    'username': 'manager1',
                    'email': 'manager1@example.com',
                    'user_type': 'manager',
                    'user_info': {
                        'id': '123e4567-e89b-12d3-a456-426614174000',
                        'name': 'John Doe',
                        'email': 'manager1@example.com',
                    },
                    'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                    'is_sales_chief': False,
                },
                response_only=True
            ),
            OpenApiExample(
                'Login Error',
                value={
                    'error': 'Username and password are required'
                },
                response_only=True
            ),
            OpenApiExample(
                'Login Unauthorized',
                value={
                    'error': 'Invalid credentials'
                },
                response_only=True
            )
        ]
    )
    @action(detail=False, methods=['post'])
    def login(self, request):
        """User login endpoint."""
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'Username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=username, password=password)
        if not user:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        refresh = RefreshToken.for_user(user)
        
        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        
        # Determine user type and info
        user_type = 'admin'
        user_info = {
            'id': str(user.id),
            'name': user.username,
            'email': user.email,
            'ab_person_id': user.ab_person_id,
        }
        
        if user.is_superuser and hasattr(user, 'manager') and user.manager:
            user_type = 'superuser'
            user_info = {
                'id': str(user.manager.id),
                'name': user.manager.name,
                'email': user.manager.email,
                'ab_person_id': user.ab_person_id,
                'admin_type': user.admin_type,
            }
        elif hasattr(user, 'employee') and user.employee:
            user_type = 'employee'
            user_info = {
                'id': str(user.employee.id),
                'name': user.employee.name,
                'email': user.employee.email,
                'ab_person_id': user.ab_person_id,
                'employee_type': user.employee_type,
                # Removed manager_id since direct manager relationship no longer exists
                # Employees are now managed through areas
            }
        elif hasattr(user, 'manager') and user.manager:
            user_type = 'manager'
            user_info = {
                'id': str(user.manager.id),
                'name': user.manager.name,
                'email': user.manager.email,
                'ab_person_id': user.ab_person_id,
            }
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user_id': str(user.id),
            'username': user.username,
            'email': user.email,
            'user_type': user_type,
            'user_info': user_info,
            'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            'is_sales_chief': bool(user.is_sales_chief),
        })
    
    @extend_schema(
        request=LogoutRequestSerializer,
        responses={
            200: LogoutResponseSerializer,
            400: ErrorResponseSerializer
        },
        description="User logout endpoint. Blacklists the refresh token.",
        examples=[
            OpenApiExample(
                'Logout Success',
                value={
                    'message': 'Successfully logged out',
                    'timestamp': '2025-07-13T22:12:38.123456Z'
                },
                response_only=True
            ),
            OpenApiExample(
                'Logout Error',
                value={
                    'error': 'Missing refresh token'
                },
                response_only=True
            )
        ]
    )
    @action(detail=False, methods=['post'])
    def logout(self, request):
        """User logout endpoint."""
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return Response({
                    'error': 'Missing refresh token'
                }, status=status.HTTP_400_BAD_REQUEST)
                
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

            return Response({
                'message': 'Successfully logged out',
                'timestamp': timezone.now().isoformat(),
            })
        except Exception as e:
            return Response({
                'error': 'Invalid token',
                'detail': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @extend_schema(
        request=RefreshRequestSerializer,
        responses={
            200: RefreshResponseSerializer,
            400: ErrorResponseSerializer
        },
        description="Token refresh endpoint. Returns new access token.",
        examples=[
            OpenApiExample(
                'Refresh Success',
                value={
                    'access': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                    'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
                },
                response_only=True
            ),
            OpenApiExample(
                'Refresh Error',
                value={
                    'error': 'Invalid token',
                    'detail': 'Token is invalid or expired'
                },
                response_only=True
            )
        ]
    )
    @action(detail=False, methods=['post'])
    def refresh(self, request):
        """Token refresh endpoint. Returns a new access token."""
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return Response({
                    'error': 'Missing refresh token'
                }, status=status.HTTP_400_BAD_REQUEST)
                
            token = RefreshToken(refresh_token)
            return Response({
                'access': str(token.access_token),
                'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            })
        except Exception as e:
            return Response({
                'error': 'Invalid token',
                'detail': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @extend_schema(
        request=RegisterSerializer,
        responses={
            201: LoginResponseSerializer,
            400: ErrorResponseSerializer
        },
        description="User registration endpoint. Register as manager, employee, or superuser.",
        examples=[
            OpenApiExample(
                'Registration Success',
                value={
                    'refresh': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                    'access': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                    'user_id': '123e4567-e89b-12d3-a456-426614174000',
                    'username': 'manager1',
                    'email': 'manager1@example.com',
                    'user_type': 'manager',
                    'user_info': {
                        'id': '123e4567-e89b-12d3-a456-426614174000',
                        'name': 'John Doe',
                        'email': 'manager1@example.com',
                    },
                    'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                    'is_sales_chief': False,
                    'message': 'User registered successfully'
                },
                response_only=True
            ),
            OpenApiExample(
                'Registration Error',
                value={
                    'username': ['This field is required.'],
                    'password': ['This field is required.'],
                    'password_confirm': ['This field is required.'],
                    'user_type': ['This field is required.']
                },
                response_only=True
            )
        ]
    )
    @action(detail=False, methods=['post'])
    def register(self, request):
        """User registration endpoint."""
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = serializer.save()
            except IntegrityError as e:
                if 'unique constraint' in str(e).lower() or 'duplicate key' in str(e).lower():
                    return Response(
                        {"username": "Username already exists. Please choose another."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                raise
            refresh = RefreshToken.for_user(user)
            
            # Determine user type and info
            user_type = 'employee'
            user_info = {
                'id': str(user.id),
                'name': user.username,
                'email': user.email,
                'ab_person_id': user.ab_person_id,
            }
            
            if user.is_superuser and hasattr(user, 'manager') and user.manager:
                user_type = 'superuser'
                user_info = {
                    'id': str(user.manager.id),
                    'name': user.manager.name,
                    'email': user.manager.email,
                    'ab_person_id': user.ab_person_id,
                    'admin_type': user.admin_type,
                }
            elif hasattr(user, 'manager') and user.manager:
                user_type = 'manager'
                user_info = {
                    'id': str(user.manager.id),
                    'name': user.manager.name,
                    'email': user.manager.email,
                    'ab_person_id': user.ab_person_id,
                }
            elif hasattr(user, 'employee') and user.employee:
                user_info = {
                    'id': str(user.employee.id),
                    'name': user.employee.name,
                    'email': user.employee.email,
                    'ab_person_id': user.ab_person_id,
                    'employee_type': user.employee_type,
                }
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user_id': str(user.id),
                'username': user.username,
                'email': user.email,
                'user_type': user_type,
                'user_info': user_info,
                'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                'is_sales_chief': bool(user.is_sales_chief),
                'message': 'User registered successfully'
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        responses={
            200: OpenApiExample(
                'Token Valid',
                value={
                    'valid': True,
                    'user_id': '123e4567-e89b-12d3-a456-426614174000',
                    'username': 'manager1',
                    'user_type': 'manager',
                    'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
                },
                response_only=True
            ),
            401: OpenApiExample(
                'Token Invalid',
                value={
                    'valid': False,
                    'error': 'Token is invalid or expired'
                },
                response_only=True
            )
        },
        description="Verify if the current access token is valid."
    )
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def verify(self, request):
        """Verify if the current access token is valid."""
        try:
            user = request.user
            user_type = None
            user_info = {}
            
            if hasattr(user, 'employee') and user.employee:
                user_type = 'employee'
                user_info = {
                    'id': str(user.employee.id),
                    'name': user.employee.name,
                    'email': user.employee.email,
                    'ab_person_id': user.ab_person_id,
                }
            elif hasattr(user, 'manager') and user.manager:
                user_type = 'manager'
                user_info = {
                    'id': str(user.manager.id),
                    'name': user.manager.name,
                    'email': user.manager.email,
                    'ab_person_id': user.ab_person_id,
                }
            else:
                user_type = 'admin'
                user_info = {
                    'id': str(user.id),
                    'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'email': user.email,
                    'ab_person_id': user.ab_person_id,
                }
            
            return Response({
                'valid': True,
                'user_id': str(user.id),
                'username': user.username,
                'user_type': user_type,
                'user_info': user_info,
                'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),  # 1 hour in seconds
            })
        except Exception as e:
            return Response({
                'valid': False,
                'error': str(e)
            }, status=status.HTTP_401_UNAUTHORIZED)

    @action(detail=False, methods=['get'], url_path='verify-public', permission_classes=[permissions.AllowAny])
    def verify_public(self, request):
        """Public token verification -- validates the Bearer token without requiring DRF authentication."""
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return Response({
                'valid': False,
                'error': 'Missing or invalid Authorization header'
            }, status=status.HTTP_401_UNAUTHORIZED)

        raw_token = auth_header.split(' ')[1]

        try:
            access_token = AccessToken(raw_token)
            user = User.objects.get(id=access_token['user_id'])

            user_type = 'admin'
            user_info = {
                'id': str(user.id),
                'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'email': user.email,
                'ab_person_id': user.ab_person_id,
            }

            if hasattr(user, 'employee') and user.employee:
                user_type = 'employee'
                user_info = {
                    'id': str(user.employee.id),
                    'name': user.employee.name,
                    'email': user.employee.email,
                    'ab_person_id': user.ab_person_id,
                }
            elif hasattr(user, 'manager') and user.manager:
                user_type = 'manager'
                user_info = {
                    'id': str(user.manager.id),
                    'name': user.manager.name,
                    'email': user.manager.email,
                    'ab_person_id': user.ab_person_id,
                }

            return Response({
                'valid': True,
                'user_id': str(user.id),
                'username': user.username,
                'email': user.email,
                'user_type': user_type,
                'user_info': user_info,
                'timestamp': timezone.now().isoformat(),
            })
        except (InvalidToken, TokenError) as e:
            return Response({
                'valid': False,
                'error': 'Invalid token',
                'detail': str(e)
            }, status=status.HTTP_401_UNAUTHORIZED)
        except User.DoesNotExist:
            return Response({
                'valid': False,
                'error': 'User not found'
            }, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({
                'valid': False,
                'error': 'Token verification failed',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Admin-only: Get all employees with phone number
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_employees(request):
    from .models import Employee
    from .serializers import EmployeeSerializer
    employees = Employee.objects.all()
    data = EmployeeSerializer(employees, many=True).data
    return Response(data)

# Admin-only: Get all managers with phone number
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_managers(request):
    from .models import Manager
    from .serializers import ManagerSerializer
    # Exclude managers who have been promoted to superuser
    managers = Manager.objects.exclude(user__is_superuser=True)
    data = ManagerSerializer(managers, many=True).data
    return Response(data)


@extend_schema(
    summary="Send welcome email to new user",
    description="Send a welcome email to a newly created user with their login credentials. Only accessible by authenticated users.",
    request=WelcomeEmailRequestSerializer,
    responses={
        200: WelcomeEmailResponseSerializer,
        400: ErrorResponseSerializer,
        401: "Unauthorized",
        403: "Forbidden"
    },
    examples=[
        OpenApiExample(
            'Send Welcome Email Success',
            value={
                'status': 'success',
                'message': 'Email sent to new manager successfully'
            },
            response_only=True
        ),
        OpenApiExample(
            'Send Welcome Email Request',
            value={
                'receiver_email': 'm.hassan246810@gmail.com',
                'password': 'thepasswordgeneratedonfrontend',
                'user_type': 'manager',
                'user_name': 'hassan_new'
            },
            request_only=True
        ),
        OpenApiExample(
            'Send Welcome Email Error',
            value={
                'error': 'Failed to send email',
                'detail': 'SMTP connection failed'
            },
            response_only=True
        )
    ]
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_welcome_email(request):
    """Send a welcome email to a newly created user."""
    from django.core.mail import send_mail
    from django.template.loader import render_to_string
    from django.conf import settings
    from django.utils.html import strip_tags
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Validate request data
    serializer = WelcomeEmailRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # Get admin information from the authenticated user
    admin_user = request.user
    admin_name = ""
    admin_email = admin_user.email
    
    # Determine admin name based on user type
    if hasattr(admin_user, 'employee') and admin_user.employee:
        admin_name = admin_user.employee.name
    elif hasattr(admin_user, 'manager') and admin_user.manager:
        admin_name = admin_user.manager.name
    else:
        # For superusers, use first_name + last_name or username
        admin_name = f"{admin_user.first_name} {admin_user.last_name}".strip()
        if not admin_name:
            admin_name = admin_user.username
    
    # Extract data from request
    receiver_email = serializer.validated_data['receiver_email']
    password = serializer.validated_data['password']
    user_type = serializer.validated_data['user_type']
    user_name = serializer.validated_data['user_name']
    
    # Send welcome email
    try:
        # Prepare email context
        context = {
            'receiver_email': receiver_email,
            'password': password,
            'user_type': user_type,
            'admin_name': admin_name,
            'admin_email': admin_email,
            'user_name': user_name,
        }
        
        # Render HTML email template
        html_message = render_to_string('emails/welcome_email.html', context)
        
        # Create plain text version
        plain_message = strip_tags(html_message)
        
        # Email subject
        subject = f"Welcome to AB Maps System, {user_type.title()}!"
        
        # Send email
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[receiver_email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"Welcome email sent successfully to {receiver_email}")
        email_sent = True
        
    except Exception as e:
        logger.error(f"Failed to send welcome email to {receiver_email}: {str(e)}")
        email_sent = False
    
    if email_sent:
        return Response({
            'status': 'success',
            'message': f'Email sent to new {user_type} successfully'
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            'status': 'error',
            'message': 'Failed to send welcome email'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────────────────────
# Sales Chief Team Management
# ─────────────────────────────────────────────────────────────

def _require_sales_chief(request):
    """Return the sales chief User or None if the caller is not a sales chief."""
    if not request.user.is_authenticated:
        return None
    if not request.user.is_sales_chief:
        return None
    return request.user


def _infer_user_role(user):
    """
    Infer a team role (``"manager"`` / ``"employee"``) for a user from their
    linked profile. Returns ``None`` when the user has neither profile so the
    caller can surface a clear error instead of guessing.
    """
    if getattr(user, 'manager_id', None):
        return 'manager'
    if getattr(user, 'employee_id', None):
        return 'employee'
    return None


def _profile_snapshot(user):
    """Return the linked Manager / Employee row that should be used for
    phone / is_online fields in team payloads. Prefers manager over employee
    when both are linked (managers are the more senior role)."""
    if getattr(user, 'manager_id', None) and user.manager:
        return user.manager
    if getattr(user, 'employee_id', None) and user.employee:
        return user.employee
    return None


def _team_member_payload(membership):
    u = membership.member
    profile = _profile_snapshot(u)
    return {
        'user_id': str(u.id),
        'name': f"{u.first_name} {u.last_name}".strip() or u.username,
        'email': u.email,
        'username': u.username,
        'ab_person_id': u.ab_person_id,
        'role': membership.role,
        'added_at': membership.added_at.isoformat(),
        'phone': getattr(profile, 'phone', None) if profile else None,
        'is_online': bool(getattr(profile, 'is_online', False)) if profile else False,
    }


def _available_person_payload(user):
    """Payload for a user eligible to be added to a sales chief's team."""
    profile = _profile_snapshot(user)
    role = _infer_user_role(user)
    return {
        'user_id': str(user.id),
        'name': f"{user.first_name} {user.last_name}".strip() or user.username,
        'email': user.email,
        'username': user.username,
        'ab_person_id': user.ab_person_id,
        'role': role,
        'is_online': bool(getattr(profile, 'is_online', False)) if profile else False,
        'phone': getattr(profile, 'phone', None) if profile else None,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_chief_team_list(request):
    """
    GET /api/users/sales-chief/team/
    Returns all team members under the authenticated sales chief.
    """
    chief = _require_sales_chief(request)
    if not chief:
        return Response({'error': 'Only sales chiefs can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

    memberships = (
        SalesChiefTeamMember.objects
        .filter(sales_chief=chief)
        .select_related('member')
        .order_by('role', 'added_at')
    )
    return Response({
        'count': memberships.count(),
        'team': [_team_member_payload(m) for m in memberships],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sales_chief_team_add(request):
    """
    POST /api/users/sales-chief/team/
    Add a single member to the authenticated sales chief's team.
    Body: { "user_id": "<uuid>", "role": "manager"|"employee" }
    """
    chief = _require_sales_chief(request)
    if not chief:
        return Response({'error': 'Only sales chiefs can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = TeamAddSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user_id = serializer.validated_data['user_id']
    role = serializer.validated_data.get('role') or None

    try:
        member_user = User.objects.select_related('manager', 'employee').get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'detail': 'User not found.', 'code': 'user_not_found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if member_user == chief:
        return Response(
            {'detail': 'A sales chief cannot add themselves to their own team.',
             'code': 'self_add_not_allowed'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not role:
        role = _infer_user_role(member_user)
    if not role:
        return Response(
            {'detail': 'Cannot infer role: user has no manager or employee profile. '
                       'Pass "role" explicitly.',
             'code': 'role_required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    membership, created = SalesChiefTeamMember.objects.get_or_create(
        sales_chief=chief,
        member=member_user,
        defaults={'role': role},
    )
    if not created:
        return Response(
            {'detail': 'Already in team', 'code': 'already_in_team'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(_team_member_payload(membership), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sales_chief_team_bulk_add(request):
    """
    POST /api/users/sales-chief/team/bulk-add/
    Bulk-add members to the authenticated sales chief's team.
    Body: { "members": [{ "user_id": "<uuid>", "role": "manager"|"employee" }, ...] }
    """
    chief = _require_sales_chief(request)
    if not chief:
        return Response({'error': 'Only sales chiefs can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = TeamBulkAddSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    added = []
    already_exists = []
    not_found = []
    no_role = []

    for item in serializer.validated_data['members']:
        user_id = item['user_id']
        role = item.get('role') or None
        try:
            member_user = User.objects.select_related('manager', 'employee').get(id=user_id)
        except User.DoesNotExist:
            not_found.append(str(user_id))
            continue

        if member_user == chief:
            already_exists.append(str(user_id))
            continue

        if not role:
            role = _infer_user_role(member_user)
        if not role:
            no_role.append(str(user_id))
            continue

        membership, created = SalesChiefTeamMember.objects.get_or_create(
            sales_chief=chief,
            member=member_user,
            defaults={'role': role},
        )
        if created:
            added.append(_team_member_payload(membership))
        else:
            already_exists.append(str(user_id))

    return Response({
        'added': added,
        'already_exists': already_exists,
        'not_found': not_found,
        'no_role': no_role,
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def sales_chief_team_remove(request, user_id):
    """
    DELETE /api/users/sales-chief/team/<user_id>/
    Remove a single member from the authenticated sales chief's team.
    """
    chief = _require_sales_chief(request)
    if not chief:
        return Response({'error': 'Only sales chiefs can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        membership = (
            SalesChiefTeamMember.objects
            .select_related('member', 'member__manager', 'member__employee')
            .get(sales_chief=chief, member_id=user_id)
        )
    except SalesChiefTeamMember.DoesNotExist:
        return Response(
            {'detail': 'Member not found in your team.', 'code': 'not_in_team'},
            status=status.HTTP_404_NOT_FOUND,
        )

    snapshot = _team_member_payload(membership)
    membership.delete()

    return Response(
        {'removed': 1, 'member': snapshot},
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sales_chief_team_bulk_remove(request):
    """
    POST /api/users/sales-chief/team/bulk-remove/
    Bulk-remove members from the authenticated sales chief's team.
    Body: { "user_ids": ["<uuid>", ...] }
    """
    chief = _require_sales_chief(request)
    if not chief:
        return Response({'error': 'Only sales chiefs can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = TeamBulkRemoveSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user_ids = serializer.validated_data['user_ids']

    memberships_qs = (
        SalesChiefTeamMember.objects
        .select_related('member', 'member__manager', 'member__employee')
        .filter(sales_chief=chief, member_id__in=user_ids)
    )
    removed_members = [_team_member_payload(m) for m in memberships_qs]
    found_ids = {m.member_id for m in memberships_qs}

    deleted, _ = SalesChiefTeamMember.objects.filter(
        sales_chief=chief, member_id__in=user_ids
    ).delete()

    not_found = [str(uid) for uid in user_ids if uid not in found_ids]

    return Response({
        'removed': deleted,
        'removed_members': removed_members,
        'not_found': not_found,
    }, status=status.HTTP_200_OK)


class SalesChiefAvailablePeoplePagination(PageNumberPagination):
    """Pagination for the sales-chief available-people directory."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_chief_available_people(request):
    """
    GET /api/users/sales-chief/available-people/

    Returns every user who is eligible to be added to the authenticated sales
    chief's team. Users already in the chief's team, the chief themselves,
    superusers, and inactive users are excluded. The role for each person is
    derived from their linked Manager / Employee profile so the frontend
    never has to guess or ask the user.

    Query parameters:
        search    — case-insensitive match against username / email / name /
                    ab_person_id (partial).
        role      — ``manager`` or ``employee`` to limit the directory.
        page      — 1-based page index (default 1).
        page_size — results per page (default 50, max 500).
    """
    chief = _require_sales_chief(request)
    if not chief:
        return Response(
            {'error': 'Only sales chiefs can access this endpoint.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Users already on the team — exclude them on the server so the FE
    # doesn't have to filter after a fetch.
    team_member_ids = set(
        SalesChiefTeamMember.objects
        .filter(sales_chief=chief)
        .values_list('member_id', flat=True)
    )

    qs = (
        User.objects
        .select_related('manager', 'employee')
        .filter(is_active=True)
        .exclude(is_superuser=True)
        .exclude(pk=chief.pk)
    )
    if team_member_ids:
        qs = qs.exclude(pk__in=team_member_ids)

    # Only users who actually have a manager or employee profile can act as
    # team members (otherwise role inference is meaningless).
    qs = qs.filter(
        models.Q(manager__isnull=False) | models.Q(employee__isnull=False)
    )

    role_filter = (request.query_params.get('role') or '').strip().lower()
    if role_filter == 'manager':
        qs = qs.filter(manager__isnull=False)
    elif role_filter == 'employee':
        qs = qs.filter(manager__isnull=True, employee__isnull=False)
    elif role_filter:
        return Response(
            {'detail': 'role must be "manager" or "employee".',
             'code': 'invalid_role_filter'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    search = (request.query_params.get('search') or '').strip()
    if search:
        qs = qs.filter(
            models.Q(username__icontains=search)
            | models.Q(email__icontains=search)
            | models.Q(first_name__icontains=search)
            | models.Q(last_name__icontains=search)
            | models.Q(ab_person_id__icontains=search)
            | models.Q(manager__name__icontains=search)
            | models.Q(employee__name__icontains=search)
        ).distinct()

    qs = qs.order_by('first_name', 'last_name', 'username')

    paginator = SalesChiefAvailablePeoplePagination()
    page = paginator.paginate_queryset(qs, request, view=None)
    if page is not None:
        data = [_available_person_payload(u) for u in page]
        return paginator.get_paginated_response(data)

    data = [_available_person_payload(u) for u in qs]
    return Response({
        'count': len(data),
        'next': None,
        'previous': None,
        'results': data,
    })
