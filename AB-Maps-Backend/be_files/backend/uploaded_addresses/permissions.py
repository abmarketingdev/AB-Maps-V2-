"""
Custom permissions for the uploaded_addresses app.
"""
from rest_framework import permissions


class UploadedAddressPermission(permissions.BasePermission):
    """
    Custom permission for UploadedAddress model.
    - Only authenticated users can access
    - Only managers can upload addresses
    - Users can only view addresses they uploaded or addresses in their campaigns
    """
    
    def has_permission(self, request, view):
        """Check if user has permission to access the view."""
        if not request.user.is_authenticated:
            return False
        
        # For upload operations, only managers are allowed
        if request.method == 'POST':
            return hasattr(request.user, 'manager') and request.user.manager is not None
        
        # For read operations, allow all authenticated users
        return True

    def has_object_permission(self, request, view, obj):
        """Check if user has permission to access specific object."""
        if not request.user.is_authenticated:
            return False
        
        # Managers can access all addresses
        if hasattr(request.user, 'manager') and request.user.manager:
            return True
        
        # Employees can only view addresses in their campaigns
        if hasattr(request.user, 'employee') and request.user.employee:
            # Check if employee is assigned to the campaign
            return obj.campaign.campaign_employees.filter(employee=request.user.employee).exists()
        
        return False


class ManagerOnlyPermission(permissions.BasePermission):
    """
    Permission that only allows managers to access the view.
    """
    
    def has_permission(self, request, view):
        """Check if user is a manager."""
        if not request.user.is_authenticated:
            return False
        
        return hasattr(request.user, 'manager') and request.user.manager is not None 