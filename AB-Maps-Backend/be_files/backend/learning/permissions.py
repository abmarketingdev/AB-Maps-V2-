"""
Permissions for the learning platform integrated with AB Maps.
"""
from rest_framework import permissions


class IsLearningManager(permissions.BasePermission):
    """Allow managers to manage learning content."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can manage learning content
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        # Employees can only read content
        if hasattr(request.user, 'employee') and request.user.employee is not None:
            return request.method in permissions.SAFE_METHODS
        
        return False


class IsLearningAdmin(permissions.BasePermission):
    """Allow only superusers and managers to access admin functions."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can access admin functions
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        return False


class IsLearningContentManager(permissions.BasePermission):
    """Allow managers to create, edit, and delete learning content."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can manage content
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        # Employees can only read
        if hasattr(request.user, 'employee') and request.user.employee is not None:
            return request.method in permissions.SAFE_METHODS
        
        return False


class IsLearningProgressManager(permissions.BasePermission):
    """Allow managers to view and manage user progress."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can view and manage progress
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        # Employees can only view their own progress
        if hasattr(request.user, 'employee') and request.user.employee is not None:
            return True
        
        return False


class IsLearningAnalyticsViewer(permissions.BasePermission):
    """Allow managers to view learning analytics."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can view analytics
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        return False


class IsLearningUser(permissions.BasePermission):
    """Allow authenticated users to access learning content."""
    
    def has_permission(self, request, view):
        return request.user.is_authenticated


class IsLearningContentOwner(permissions.BasePermission):
    """Allow users to manage their own learning progress."""
    
    def has_permission(self, request, view):
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Superusers (admins) can do anything
        if request.user.is_superuser:
            return True
        
        # Managers can manage anything
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        # Users can only manage their own progress
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        return False


class IsLearningQuizManager(permissions.BasePermission):
    """Allow managers to manage quiz content."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can manage quiz content
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        return False


class IsLearningSectionManager(permissions.BasePermission):
    """Allow managers to manage learning sections."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can manage sections
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        return False


class IsLearningLessonManager(permissions.BasePermission):
    """Allow managers to manage learning lessons."""
    
    def has_permission(self, request, view):
        # Superusers (admins) can do everything
        if request.user.is_superuser:
            return True
        
        # Managers can manage lessons
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True
        
        return False
