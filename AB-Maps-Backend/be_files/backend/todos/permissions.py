"""
Permissions for the Todos app.
"""
from rest_framework import permissions


class TodoPermission(permissions.BasePermission):
    """
    Users can only access their own todos.
    Simple permission: if it's yours, you can do anything with it.
    """
    
    def has_permission(self, request, view):
        """Must be authenticated to access todos."""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Can only access own todos."""
        return obj.user == request.user


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow admins (superuser + staff) to edit.
    Read-only access for others.
    """
    
    def has_permission(self, request, view):
        """Allow read for authenticated, write for admins only."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read permissions for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for admins
        return request.user.is_superuser and request.user.is_staff


class TaskAssignmentPermission(permissions.BasePermission):
    """
    Only admins and managers can assign tasks to other users.
    Employees can only create personal tasks (not use the assignment endpoint).
    """

    message = "Only admins or managers can assign tasks."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        is_admin = request.user.is_superuser and request.user.is_staff
        is_manager = hasattr(request.user, 'manager') and request.user.manager is not None
        return is_admin or is_manager


class TodoAssignmentUsersPermission(permissions.BasePermission):
    """
    Access control for TODO assignment user directory endpoint.

    Allowed:
    - Admins: is_superuser=True and is_staff=True
    - Managers: users with a manager relation
    """

    message = "Only managers or admins can access assignment user directory."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        is_admin = request.user.is_superuser and request.user.is_staff
        is_manager = hasattr(request.user, 'manager') and request.user.manager is not None
        return is_admin or is_manager

