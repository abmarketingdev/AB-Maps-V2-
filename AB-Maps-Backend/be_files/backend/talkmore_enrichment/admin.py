"""
Admin configuration for talkmore_enrichment app.
"""
from django.contrib import admin
from .models import EnrichmentJob, EnrichedAddressResult, PhoneCarrierCache


@admin.register(EnrichmentJob)
class EnrichmentJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'area', 'campaign', 'status', 'expected_count', 'done_count', 'success_count', 'created_at')
    list_filter = ('status', 'campaign', 'created_at')
    search_fields = ('area__name', 'campaign__name', 'id')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'area', 'campaign', 'status')
        }),
        ('Counts', {
            'fields': ('expected_count', 'done_count', 'success_count', 'no_data_count', 'failed_count')
        }),
        ('Timestamps', {
            'fields': ('started_at', 'finished_at', 'created_at', 'updated_at')
        }),
        ('Error Information', {
            'fields': ('last_error',)
        }),
    )


@admin.register(EnrichedAddressResult)
class EnrichedAddressResultAdmin(admin.ModelAdmin):
    list_display = ('address_text', 'job', 'status', 'show_marker', 'created_at')
    list_filter = ('status', 'show_marker', 'job__campaign', 'created_at')
    search_fields = ('address_text', 'address_uuid', 'job__id')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'job', 'address_uuid', 'address_text', 'status')
        }),
        ('Location', {
            'fields': ('geom', 'municipality_code', 'postcode')
        }),
        ('Enrichment Data', {
            'fields': ('people', 'carrier_summary', 'show_marker')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(PhoneCarrierCache)
class PhoneCarrierCacheAdmin(admin.ModelAdmin):
    list_display = ('phone_e164', 'carrier', 'source', 'updated_at', 'expires_at')
    list_filter = ('carrier', 'source', 'updated_at')
    search_fields = ('phone_e164', 'carrier')
    readonly_fields = ('updated_at',)
