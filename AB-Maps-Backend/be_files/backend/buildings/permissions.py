"""
Permissions for the buildings app.
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


class IsBuildingCreator(permissions.BasePermission):
    """
    Permission class that allows deletion only if the user is the creator of the building.
    
    Rules:
    - Managers can only delete buildings they created (created_by == user.manager)
    - Employees can only delete buildings they created (created_by_employee == user.employee)
    - Users cannot delete buildings created by others
    """
    
    def has_object_permission(self, request, view, obj):
        """
        Check if the user has permission to delete this building.
        
        Only the creator (manager or employee) can delete their own building.
        """
        # Only check for DELETE method
        if request.method != 'DELETE':
            return True
        
        user = request.user
        
        # Check if user is a manager and created this building
        if hasattr(user, 'manager') and user.manager:
            if obj.created_by_id == user.manager.id:
                return True
        
        # Check if user is an employee and created this building
        if hasattr(user, 'employee') and user.employee:
            if obj.created_by_employee_id == user.employee.id:
                return True
        
        # User is not the creator - deny permission
        return False

