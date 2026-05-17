"""
Custom permissions for the addresses app.
"""
from rest_framework import permissions


class AddressPermission(permissions.BasePermission):
    """
    Custom permission for Address model.
    - Users can only delete addresses that have been created by them
    - Admins can delete any address
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        # For read operations, allow all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        # For DELETE operations, check if user created the address
        if request.method == 'DELETE':
            if hasattr(request.user, 'manager') and request.user.manager:
                return obj.manager == request.user.manager
            if hasattr(request.user, 'employee') and request.user.employee:
                return obj.employee == request.user.employee
        # For other operations (POST, PUT, PATCH), allow all authenticated users
        return True 