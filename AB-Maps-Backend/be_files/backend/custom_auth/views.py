"""
Views for the custom_auth app.
"""
from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.conf import settings as django_settings
from django.utils import timezone
from .serializers import (
    CustomTokenObtainPairSerializer,
    LoginSerializer,
    TokenRefreshSerializer,
    LogoutSerializer
)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom token obtain view that includes user type and additional info.
    
    This view returns JWT tokens with enhanced user information including
    user type (employee/manager/admin) and relevant user details.
    """
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        """Handle login request with enhanced response."""
        serializer = self.get_serializer(data=request.data)
    
        if serializer.is_valid():
            user = serializer.user
            refresh = RefreshToken.for_user(user)
            
            # Update last login
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user_id': str(user.id),
                'username': user.username,
                'email': user.email,
                'user_type': serializer.validated_data.get('user_type'),
                'user_info': serializer.validated_data.get('user_info'),
                'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
            })
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenRefreshView(TokenRefreshView):
    """
    Custom token refresh view for cross-site authentication.
    Returns a new access token from a valid refresh token.
    """
    serializer_class = TokenRefreshSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        """Handle token refresh request."""
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(serializer.validated_data['refresh'])
            return Response({
                'access': str(token.access_token),
                'expires_in': int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            })
        except Exception as e:
            return Response({
                'error': 'Invalid token',
                'detail': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class LoginView(generics.GenericAPIView):
    """
    Enhanced login view with user type detection.
    
    This view provides an alternative login endpoint that returns
    detailed user information along with JWT tokens.
    """
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        """Handle login request."""
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.validated_data['user']
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
                'is_superuser': user.is_superuser,
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
            })
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """
    Enhanced logout view that blacklists refresh tokens.
    
    This view can be used for cross-site logout by blacklisting
    the refresh token to prevent further use.
    """
    serializer = LogoutSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        refresh_token = serializer.validated_data.get('refresh')
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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def verify_token(request):
    """
    Token verification endpoint for cross-site authentication.
    
    This endpoint allows other sites to verify if a JWT token
    is valid and get user information without needing to decode
    the token themselves.
    """
    user = request.user
    
    # Determine user type and info
    user_type = 'admin'
    user_info = {
        'id': str(user.id),
        'name': user.username,
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


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def verify_token_public(request):
    """
    Public token verification endpoint for cross-site authentication.
    
    This endpoint allows other sites to verify if a JWT token
    is valid without requiring authentication.
    """
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    # Get token from Authorization header
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return Response({
            'valid': False,
            'error': 'Missing or invalid Authorization header'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    token = auth_header.split(' ')[1]
    
    try:
        # Verify the token
        access_token = AccessToken(token)
        user_id = access_token['user_id']
        user = User.objects.get(id=user_id)
        
        # Determine user type and info
        user_type = 'admin'
        user_info = {
            'id': str(user.id),
            'name': user.username,
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
