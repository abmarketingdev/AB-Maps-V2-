"""
Admin configuration for the users app.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Manager, Employee


@admin.register(Manager)
class ManagerAdmin(admin.ModelAdmin):
    """Admin configuration for Manager model."""
    list_display = ['name', 'email', 'phone', 'status', 'is_online', 'last_seen', 'created_at']
    list_filter = ['status', 'is_online', 'created_at']
    search_fields = ['name', 'email', 'phone']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['name']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    """Admin configuration for Employee model."""
    list_display = ['name', 'email', 'phone', 'status', 'is_online', 'last_seen', 'created_at']
    list_filter = ['status', 'is_online', 'created_at']
    search_fields = ['name', 'email', 'phone']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['name']
    
    def get_managers(self, obj):
        """Get a comma-separated list of manager names."""
        return ", ".join([manager.name for manager in obj.managers.all()])
    get_managers.short_description = 'Managers'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for User model."""
    list_display = ['username', 'email', 'first_name', 'last_name', 'employee', 'manager', 'is_active', 'date_joined']
    list_filter = ['is_active', 'is_staff', 'is_superuser', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    readonly_fields = ['id', 'date_joined', 'last_login']
    ordering = ['username']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('AB Maps Profile', {
            'fields': ('employee', 'manager', 'ab_person_id', 'employee_type', 'admin_type', 'is_sales_chief'),
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('AB Maps Profile', {
            'fields': ('employee', 'manager', 'ab_person_id', 'employee_type', 'admin_type', 'is_sales_chief'),
        }),
    )
