"""
Admin configuration for the uploaded_addresses app.
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import UploadedAddress


class CampaignFilter(admin.SimpleListFilter):
    """Filter uploaded addresses by campaign."""
    title = 'Campaign'
    parameter_name = 'campaign'

    def lookups(self, request, model_admin):
        campaigns = set([obj.campaign for obj in model_admin.model.objects.all()])
        return [(campaign.id, campaign.name) for campaign in campaigns]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(campaign_id=self.value())
        return queryset


class GeocodingStatusFilter(admin.SimpleListFilter):
    """Filter uploaded addresses by geocoding status."""
    title = 'Geocoding Status'
    parameter_name = 'geocoding_status'

    def lookups(self, request, model_admin):
        return (
            ('geocoded', 'Geocoded'),
            ('not_geocoded', 'Not Geocoded'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'geocoded':
            return queryset.filter(latitude__isnull=False, longitude__isnull=False)
        if self.value() == 'not_geocoded':
            return queryset.filter(latitude__isnull=True, longitude__isnull=True)
        return queryset


@admin.register(UploadedAddress)
class UploadedAddressAdmin(admin.ModelAdmin):
    """Admin configuration for UploadedAddress model."""
    
    list_display = [
        'id', 'address_text', 'campaign_link', 'manager_link', 
        'geocoding_status', 'coordinates_display', 'added_at', 'geocoded_at'
    ]
    list_filter = [
        CampaignFilter,
        GeocodingStatusFilter,
        'added_at',
        'geocoded_at',
        'manager',
    ]
    search_fields = [
        'address_text',
        'campaign__name',
        'manager__name',
        'manager__email',
    ]
    readonly_fields = [
        'id', 'added_at', 'geocoded_at', 'is_geocoded', 'coordinates'
    ]
    ordering = ['-added_at']
    list_per_page = 50
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'address_text', 'campaign', 'manager')
        }),
        ('Geocoding Information', {
            'fields': ('latitude', 'longitude', 'geocoded_at', 'is_geocoded', 'coordinates')
        }),
        ('Timestamps', {
            'fields': ('added_at',),
            'classes': ('collapse',)
        }),
    )

    def campaign_link(self, obj):
        """Display campaign as a link."""
        if obj.campaign:
            url = reverse('admin:campaigns_campaign_change', args=[obj.campaign.id])
            return format_html('<a href="{}">{}</a>', url, obj.campaign.name)
        return '-'
    campaign_link.short_description = 'Campaign'
    campaign_link.admin_order_field = 'campaign__name'

    def manager_link(self, obj):
        """Display manager as a link."""
        if obj.manager:
            url = reverse('admin:users_manager_change', args=[obj.manager.id])
            return format_html('<a href="{}">{}</a>', url, obj.manager.name)
        return '-'
    manager_link.short_description = 'Manager'
    manager_link.admin_order_field = 'manager__name'

    def geocoding_status(self, obj):
        """Display geocoding status with color coding."""
        if obj.is_geocoded:
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Geocoded</span>'
            )
        else:
            return format_html(
                '<span style="color: red; font-weight: bold;">✗ Not Geocoded</span>'
            )
    geocoding_status.short_description = 'Geocoding Status'
    geocoding_status.admin_order_field = 'latitude'

    def coordinates_display(self, obj):
        """Display coordinates in a readable format."""
        if obj.is_geocoded:
            return format_html(
                '<span style="font-family: monospace;">{:.6f}, {:.6f}</span>',
                obj.latitude, obj.longitude
            )
        return '-'
    coordinates_display.short_description = 'Coordinates'

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related('campaign', 'manager')

    def has_add_permission(self, request):
        """Disable adding addresses through admin interface."""
        return False

    def has_change_permission(self, request, obj=None):
        """Allow editing geocoding fields only."""
        return True

    def get_readonly_fields(self, request, obj=None):
        """Make most fields readonly, allow editing of geocoding fields."""
        if obj:  # Editing an existing object
            return [
                'id', 'address_text', 'campaign', 'manager', 
                'added_at', 'geocoded_at', 'is_geocoded', 'coordinates'
            ]
        return self.readonly_fields

    actions = ['retry_geocoding', 'bulk_geocode']

    def retry_geocoding(self, request, queryset):
        """Admin action to retry geocoding for selected addresses."""
        from .tasks import geocode_address
        
        count = 0
        for address in queryset:
            if not address.is_geocoded:
                geocode_address.delay(str(address.id))
                count += 1
        
        self.message_user(
            request,
            f'Successfully triggered geocoding for {count} addresses.'
        )
    retry_geocoding.short_description = "Retry geocoding for selected addresses"

    def bulk_geocode(self, request, queryset):
        """Admin action to bulk geocode selected addresses."""
        from .tasks import bulk_geocode_addresses
        
        address_ids = [str(address.id) for address in queryset]
        bulk_geocode_addresses.delay(address_ids)
        
        self.message_user(
            request,
            f'Bulk geocoding task triggered for {len(address_ids)} addresses.'
        )
    bulk_geocode.short_description = "Bulk geocode selected addresses"
