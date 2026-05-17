"""
Permission classes for the QC System.
Controls access to QC-specific endpoints based on user type.
"""
from rest_framework.permissions import BasePermission


class IsQCUser(BasePermission):
    """
    Only allow QC employees or QC admins.
    Used as the base permission for all QC endpoints.
    """
    message = 'Access denied. Only QC users (qc_emp or qc_admin) can access this resource.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        is_qc_employee = request.user.employee_type == 'qc_emp'
        is_qc_admin = (
            request.user.admin_type == 'qc_admin'
            and request.user.is_superuser
        )

        return is_qc_employee or is_qc_admin


class IsQCAdmin(BasePermission):
    """
    Only allow QC admins (admin_type='qc_admin' and is_superuser=True).
    Used for admin-only operations like bulk transfer and imports.
    """
    message = 'Access denied. Only QC admins can access this resource.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return (
            request.user.admin_type == 'qc_admin'
            and request.user.is_superuser
        )


class IsQCEmployee(BasePermission):
    """
    Only allow QC employees (employee_type='qc_emp').
    Used for employee-only operations like get_next and approve.
    """
    message = 'Access denied. Only QC employees can access this resource.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.employee_type == 'qc_emp'
