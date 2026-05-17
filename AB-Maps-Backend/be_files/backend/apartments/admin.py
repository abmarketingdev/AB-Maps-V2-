"""
Admin interface for apartments app.
"""
from django.contrib import admin
from .models import Apartment


@admin.register(Apartment)
class ApartmentAdmin(admin.ModelAdmin):
    """Admin interface for Apartment model."""
    
    list_display = [
        'base_address',
        'apartment_number',
        'status',
        'is_visited',
        'campaign',
        'created_at',
        'updated_at'
    ]
    
    list_filter = [
        'status',
        'campaign',
        'created_at',
        'updated_at'
    ]
    
    search_fields = [
        'base_address',
        'apartment_number'
    ]
    
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
        'is_visited',
        'visit_info'
    ]
    
    fieldsets = (
        ('Building Information', {
            'fields': ('base_address', 'apartment_number')
        }),
        ('Visit Information', {
            'fields': ('status', 'address', 'is_visited', 'visit_info')
        }),
        ('Campaign', {
            'fields': ('campaign',)
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def is_visited(self, obj):
        """Display visited status as icon."""
        return "✓" if obj.is_visited else "○"
    is_visited.short_description = "Visited"
    
    def visit_info(self, obj):
        """Display visit information."""
        info = obj.visit_info
        if info['visited']:
            return f"Status: {info['status']}, Address ID: {info['address_id']}"
        return "Not visited"
    visit_info.short_description = "Visit Details"
