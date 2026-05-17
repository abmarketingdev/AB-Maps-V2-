"""
Permissions for the analytics / weekly-report system.

Admin = User with is_staff=True AND is_superuser=True (derived from JWT).
"""
from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Allow access only to admin users (is_staff=True AND is_superuser=True).
    
    The check is performed on the User object which is already resolved
    from the JWT token by rest_framework_simplejwt.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_staff and request.user.is_superuser


class IsAdminOrManager(permissions.BasePermission):
    """
    Allow access to admins (is_staff + is_superuser) and managers.
    
    Managers can view analytics for their own team / campaigns.
    Admins can view everything and manage thresholds.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Admins can do everything
        if request.user.is_staff and request.user.is_superuser:
            return True

        # Managers can access (read-only for thresholds, full for reports)
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return True

        return False


class IsAdminOrManagerReadOnly(permissions.BasePermission):
    """
    Admins get full CRUD on thresholds.
    Managers get read-only access.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Admins — full access
        if request.user.is_staff and request.user.is_superuser:
            return True

        # Managers — read only
        if hasattr(request.user, 'manager') and request.user.manager is not None:
            return request.method in permissions.SAFE_METHODS

        return False
