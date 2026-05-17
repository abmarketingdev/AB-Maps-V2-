"""
Admin configuration for the Todos app.
"""
from django.contrib import admin
from .models import Todo


@admin.register(Todo)
class TodoAdmin(admin.ModelAdmin):
    """Admin interface for Todo model."""
    
    list_display = [
        'title', 'user', 'status', 'priority', 'deadline', 
        'is_overdue', 'created_at', 'related_address'
    ]
    list_filter = ['status', 'priority', 'created_at', 'deadline']
    search_fields = ['title', 'description', 'user__username', 'user__email']
    readonly_fields = ['id', 'created_at', 'updated_at', 'completed_at']
    
    fieldsets = (
        ('Task Information', {
            'fields': ('user', 'title', 'description')
        }),
        ('Properties', {
            'fields': ('status', 'priority', 'deadline')
        }),
        ('Relationships', {
            'fields': ('related_address', 'related_campaign'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('id', 'created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )
    
    list_per_page = 50
    date_hierarchy = 'created_at'
    
    def is_overdue(self, obj):
        """Display overdue status."""
        if obj.is_overdue:
            return '⚠️ Yes'
        return 'No'
    is_overdue.short_description = 'Overdue'
    is_overdue.boolean = False
