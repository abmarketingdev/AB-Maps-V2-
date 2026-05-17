"""
Serializers for the custom_auth app.
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from users.models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom token serializer that includes user type and additional info."""
    
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        
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
        
        data['user_type'] = user_type
        data['user_info'] = user_info
        return data


class LoginSerializer(serializers.Serializer):
    """Serializer for login requests."""
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Must include username and password')
        
        return attrs


class TokenRefreshSerializer(serializers.Serializer):
    """Serializer for token refresh requests."""
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    """Serializer for logout requests."""
    refresh = serializers.CharField() 