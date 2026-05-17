from rest_framework import permissions


class ManagerOnlyPermission(permissions.BasePermission):
    """Only managers can perform bulk polygon operations."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return hasattr(request.user, 'manager') and request.user.manager is not None

