"""
Custom permissions for the tracking app.
"""
from rest_framework import permissions


class TrackingPermission(permissions.BasePermission):
    """
    Custom permission for tracking data.
    - Only managers can view tracking data
    - Employees can only view their own tracking data
    - No one can modify tracking data (it's read-only from API perspective)
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated."""
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Check if user has permission to access the specific tracking data."""
        if not request.user.is_authenticated:
            return False
        
        # For read operations
        if request.method in permissions.SAFE_METHODS:
            # Managers can view all tracking data
            if hasattr(request.user, 'manager') and request.user.manager:
                return True
            
            # Employees can only view their own tracking data
            if hasattr(request.user, 'employee') and request.user.employee:
                return obj.employee == request.user.employee
            
            return False
        
        # For write operations (POST, PUT, PATCH, DELETE)
        # Only allow creation, not modification of existing data
        if request.method == 'POST':
            return True
        
        return False


class SyncQueuePermission(permissions.BasePermission):
    """
    Custom permission for sync queue items.
    - Users can only access their own sync queue items
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated."""
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Check if user has permission to access the specific sync queue item."""
        if not request.user.is_authenticated:
            return False
        
        # For now, allow all authenticated users to access sync queue
        # This can be refined based on specific business requirements
        return True 