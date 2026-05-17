"""
Admin configuration for the buildings app.
"""
from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Building


@admin.register(Building)
class BuildingAdmin(GISModelAdmin):
    """Admin interface for Building model."""
    
    list_display = [
        'base_address',
        'campaign',
        'total_units',
        'visited_units',
        'status',
        'is_completed',
        'progress_display',
        'created_at',
    ]
    
    list_filter = [
        'status',
        'is_completed',
        'campaign',
        'created_at',
    ]
    
    search_fields = [
        'base_address',
        'campaign__name',
    ]
    
    readonly_fields = [
        'id',
        'total_units',
        'visited_units',
        'status',
        'is_completed',
        'created_at',
        'updated_at',
        'progress_display',
        'remaining_display',
    ]
    
    fieldsets = (
        ('Identification', {
            'fields': ('id', 'base_address', 'position', 'campaign', 'created_by')
        }),
        ('Statistics (Auto-calculated)', {
            'fields': ('total_units', 'visited_units', 'status', 'is_completed', 'progress_display', 'remaining_display'),
            'description': 'These fields are automatically updated when apartments change.'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    ordering = ['-created_at']
    
    def progress_display(self, obj):
        """Display progress as percentage."""
        return f"{obj.progress_percentage}%"
    progress_display.short_description = 'Progress'
    
    def remaining_display(self, obj):
        """Display remaining units."""
        return f"{obj.remaining_units} remaining"
    remaining_display.short_description = 'Remaining'
    
    def has_add_permission(self, request):
        """Buildings are typically created via API, but allow admin creation."""
        return True
    
    def has_change_permission(self, request, obj=None):
        """Allow editing buildings."""
        return True
